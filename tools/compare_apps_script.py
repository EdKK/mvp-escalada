#!/usr/bin/env python3
"""Read-only comparison of USER-SUPPLIED code copies. No Google/network/sync access.
Never reads Script Properties, prints source/diffs or modifies an input file.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/biblioteca/REFERENCIA-SINCRONIZACAO.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def lf(data):
    return data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')


def read_copies(path, allowed):
    copies = {}
    unknown = 0
    if path.is_symlink():
        raise ValueError('unsafe input')
    if path.is_dir():
        for name in allowed:
            p = path / name
            if p.is_symlink():
                raise ValueError('unsafe input')
            if p.is_file():
                copies[name] = p.read_bytes()
        unknown = sum(1 for p in path.iterdir() if p.suffix in ('.gs', '.js') and p.name not in allowed)
    else:
        # Apps Script projects.getContent-shaped export, supplied by its owner.
        body = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(body, dict) or not isinstance(body.get('files'), list):
            raise ValueError('invalid export')
        for item in body['files']:
            if not isinstance(item, dict) or not isinstance(item.get('name'), str):
                raise ValueError('invalid file')
            suffix = {'SERVER_JS': '.gs', 'HTML': '.html', 'JSON': '.json'}.get(item.get('type'))
            if not suffix:
                raise ValueError('invalid type')
            name = item['name'] if item['name'].endswith(suffix) else item['name'] + suffix
            if name not in allowed:
                unknown += int(suffix == '.gs')
                continue
            if name in copies or not isinstance(item.get('source'), str):
                raise ValueError('duplicate or invalid source')
            copies[name] = item['source'].encode('utf-8')
    return copies, unknown


def compare(installed=None):
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    allowed = {name for row in manifest['files'] for name in row['installedNames']}
    copies, unknown = read_copies(installed, allowed) if installed is not None else ({}, 0)
    rows = []
    reference_ok = True
    for definition in manifest['files']:
        reference = (ROOT / definition['repositoryFile']).read_bytes()
        valid_reference = sha(reference) == definition['sha256']
        reference_ok = reference_ok and valid_reference
        found = [name for name in definition['installedNames'] if name in copies]
        row = {'repositoryFile': definition['repositoryFile'], 'group': definition['group'],
               'expectedSha256': definition['sha256'], 'referenceIntact': valid_reference}
        if installed is None:
            row['status'] = 'NAO_COMPARADO'
        elif len(found) > 1:
            row['status'] = 'DUPLICIDADE_DE_MODULO'
        elif not found:
            row['status'] = 'AUSENTE_NA_COPIA'
        else:
            data = copies[found[0]]
            row.update(installedName=found[0], installedSha256=sha(data))
            if data == reference:
                row['status'] = 'IDENTICO_BYTES'
            elif lf(data) == lf(reference):
                row['status'] = 'DIFERENTE_APENAS_FIM_DE_LINHA'
            else:
                row['status'] = 'DIFERENTE'
            if definition['repositoryFile'].endswith('appsscript.json'):
                try:
                    row['sameManifestJson'] = json.loads(data) == json.loads(reference)
                except (ValueError, UnicodeError):
                    row['sameManifestJson'] = False
        rows.append(row)
    def exact(group):
        return installed is not None and all(r['status'] == 'IDENTICO_BYTES' and r['referenceIntact']
                                             for r in rows if r['group'] == group)
    return {'referenceCommit': manifest['referenceCommit'], 'referenceIntact': reference_ok,
            'comparisonOrigin': 'COPIAS_FORNECIDAS' if installed is not None else 'SOMENTE_REFERENCIA',
            'liveGoogleVerified': False, 'unknownServerFilesCount': unknown,
            'existingFilesExact': exact('existing'), 'libraryFilesExact': exact('library'),
            'allExpectedFilesExact': reference_ok and unknown == 0 and exact('existing') and exact('library'),
            'files': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--installed', type=Path, help='Directory of code copies or owner-supplied source export JSON')
    args = parser.parse_args()
    try:
        result = compare(args.installed)
    except (OSError, ValueError, KeyError, TypeError):
        # Do not echo source, paths, project IDs, JSON contents or exception messages.
        print(json.dumps({'error': 'ENTRADA_INVALIDA_OU_INACESSIVEL', 'liveGoogleVerified': False}))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result['referenceIntact']:
        return 2
    return 0 if args.installed is None or result['allExpectedFilesExact'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
