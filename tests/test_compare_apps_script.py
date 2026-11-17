"""Synthetic local copies only. These tests do not inspect a Google project."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('compare_apps_script', Path(__file__).resolve().parents[1] / 'tools/compare_apps_script.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.manifest = json.loads(MODULE.MANIFEST.read_text())

    def copies(self):
        for row in self.manifest['files']:
            (self.folder / row['installedNames'][0]).write_bytes((MODULE.ROOT / row['repositoryFile']).read_bytes())

    def test_reference_only_never_claims_google_comparison(self):
        r = MODULE.compare()
        self.assertTrue(r['referenceIntact'])
        self.assertFalse(r['allExpectedFilesExact'])
        self.assertFalse(r['liveGoogleVerified'])
        self.assertTrue(all(f['status'] == 'NAO_COMPARADO' for f in r['files']))

    def test_exact_copies_accept_studentlogic_alias_without_writing(self):
        self.copies()
        before = {p.name: p.read_bytes() for p in self.folder.iterdir()}
        r = MODULE.compare(self.folder)
        self.assertTrue(r['allExpectedFilesExact'])
        self.assertFalse(r['liveGoogleVerified'])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.folder.iterdir()})

    def test_missing_library_modules_are_pending_not_verified(self):
        self.copies()
        for row in self.manifest['files']:
            if row['group'] == 'library':
                (self.folder / row['installedNames'][0]).unlink()
        r = MODULE.compare(self.folder)
        self.assertTrue(r['existingFilesExact'])
        self.assertFalse(r['libraryFilesExact'])
        self.assertEqual(sum(f['status'] == 'AUSENTE_NA_COPIA' for f in r['files']), sum(row['group'] == 'library' for row in self.manifest['files']))

    def test_duplicate_student_modules_and_unknown_server_files_block_exactness(self):
        self.copies()
        (self.folder / 'Student.gs').write_bytes((self.folder / 'StudentLogic.gs').read_bytes())
        (self.folder / 'Unreviewed.gs').write_text('function extra() {}')
        r = MODULE.compare(self.folder)
        self.assertFalse(r['allExpectedFilesExact'])
        self.assertEqual(r['unknownServerFilesCount'], 1)
        self.assertTrue(any(f['status'] == 'DUPLICIDADE_DE_MODULO' for f in r['files']))

    def test_eol_differences_are_not_reported_as_exact_bytes(self):
        self.copies()
        p = self.folder / 'TrainingLibrary.gs'
        p.write_bytes(p.read_bytes().replace(b'\n', b'\r\n'))
        r = MODULE.compare(self.folder)
        self.assertFalse(r['libraryFilesExact'])
        self.assertTrue(any(f['status'] == 'DIFERENTE_APENAS_FIM_DE_LINHA' for f in r['files']))

    def test_export_json_is_compared_as_source_without_echoing_metadata_or_source(self):
        secret_marker = 'TEST_ONLY_DO_NOT_LOG'
        files = []
        for row in self.manifest['files']:
            name = row['installedNames'][0]
            suffix = Path(name).suffix
            files.append({'name': name[:-len(suffix)], 'type': {'.gs': 'SERVER_JS', '.html': 'HTML', '.json': 'JSON'}[suffix], 'source': (MODULE.ROOT / row['repositoryFile']).read_text()})
        exported = self.folder / 'export.json'
        exported.write_text(json.dumps({'scriptId': secret_marker, 'files': files}))
        r = MODULE.compare(exported)
        self.assertTrue(r['allExpectedFilesExact'])
        self.assertNotIn(secret_marker, json.dumps(r))
        self.assertNotIn('function libraryDb_', json.dumps(r))

    def test_changed_source_and_manifest_formatting_are_diagnosed_without_overwrite(self):
        self.copies()
        (self.folder / 'Auth.gs').write_text('/* TEST_ONLY_PRIVATE_VALUE */')
        p = self.folder / 'appsscript.json'
        p.write_text(json.dumps(json.loads(p.read_text()), separators=(',', ':')))
        r = MODULE.compare(self.folder)
        self.assertFalse(r['existingFilesExact'])
        self.assertNotIn('TEST_ONLY_PRIVATE_VALUE', json.dumps(r))
        self.assertTrue(next(f for f in r['files'] if f['repositoryFile'].endswith('appsscript.json'))['sameManifestJson'])

    def test_symlink_is_rejected_without_reading_its_target(self):
        self.copies()
        p = self.folder / 'Auth.gs'
        p.unlink()
        p.symlink_to(self.folder / 'missing-target')
        with self.assertRaises(ValueError):
            MODULE.compare(self.folder)


if __name__ == '__main__':
    unittest.main()
