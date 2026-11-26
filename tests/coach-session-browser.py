"""Exercise integral session assembly in Chromium using fictitious local Sheets."""
from pathlib import Path
import json
import shutil
import subprocess
from time import perf_counter
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=root,
                      stdout=subprocess.PIPE, text=True) as server:
    try:
        port = server.stdout.readline().strip()
        assert port.isdigit()
        base = 'http://127.0.0.1:' + port
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
            page = browser.new_page()
            page.add_init_script('window.open = () => null')
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            requests = []
            page.on('request', lambda request: requests.append(json.loads(request.post_data)['request'])
                    if request.url.endswith('/rpc') else None)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base)
            field = lambda name: page.locator('#' + name)
            field('btnLogin').click()
            field('btnFinishLogin').click()
            expect(field('appPanel')).to_be_visible()

            def add_exercise(index):
                if index % 3 == 0:
                    field('libraryClassification').select_option('general')
                    field('itemExercicio').select_option('exercise-bench')
                    expect(field('libraryAssessment').locator('option')).to_have_count(2)
                    field('libraryAssessment').select_option(index=1)
                    field('libraryMethod').select_option('method-max-effort')
                    for name, value in {'itemIntensVal': '85', 'librarySets': '2',
                                        'itemQtd': '3', 'itemMin': '5'}.items():
                        field(name).fill(value)
                elif index % 3 == 1:
                    field('libraryClassification').select_option('directed')
                    field('directedSubblock').select_option('fingerboard')
                    for name, value in {'fbModality': 'isometric', 'fbGrip': 'jug',
                                        'fbSide': 'bilateral', 'fbSeriesRest': '120'}.items():
                        field(name).select_option(value)
                    for name, value in {'fbSets': '2', 'fbRepetitions': '1', 'fbDuration': '7'}.items():
                        field(name).fill(value)
                else:
                    field('libraryClassification').select_option('specific')
                    field('specificSubblock').select_option('boulder_short')
                    field('specificSets').fill('2')
                    field('specificRepetitions').fill('3')
                field('btnAddItem').click()

            for count in (1, 5, 10):
                requests.clear()
                field('coachAluno').select_option('s1')
                field('coachData').fill('2026-11-18')
                field('btnCriarTreino').click()
                for index in range(count):
                    add_exercise(index)
                if count > 1:
                    page.get_by_role('button', name='Editar exercício 2', exact=True).click()
                    expect(field('fbDuration')).to_have_value('7')
                    field('fbDuration').fill('8')
                    field('btnAddItem').click()
                    page.get_by_role('button', name=f'Excluir exercício {count}', exact=True).click()
                    add_exercise(count - 1)
                assert all(request['action'] not in ('createWorkout', 'saveCoachPrescription', 'saveCoachSession')
                           for request in requests)
                field('btnReviewSession').click()
                start = perf_counter()
                field('btnConfirmSession').click()
                expect(field('coachFinishStatus')).to_have_text(f'Sessão gravada com {count} exercício(s).')
                elapsed = (perf_counter() - start) * 1000
                actions = [request['action'] for request in requests]
                assert actions.count('saveCoachSession') == 1
                assert 'coachSessionStatus' not in actions
                assert not any(action.startswith('listPending') for action in actions)
                expect(field('previewTreinoAluno').locator('article')).to_have_count(count)
                print(f'{count} exercício(s): {elapsed:.0f} ms no navegador com backend simulado')

            # Expire the real fixture token before save, reauthenticate, then lose
            # the confirmation of the same request and reload the actual document.
            requests.clear()
            field('coachAluno').select_option('s1')
            field('coachData').fill('2026-11-18')
            field('coachInstructions').fill('Orientação da sessão recuperada')
            field('btnCriarTreino').click()
            for index in range(5):
                add_exercise(index)
            rows = field('coachDraftItems').locator(':scope > div')
            expected = rows.all_text_contents()
            assert len(expected) == 5
            page.request.post(base + '/test-control', data={'expireSession': True})
            field('btnReviewSession').click()
            field('btnConfirmSession').click()
            expect(field('loginPanel')).to_be_visible()
            field('btnLogin').click()
            field('btnFinishLogin').click()
            expect(field('appPanel')).to_be_visible()
            expect(rows).to_have_text(expected)
            expect(field('coachInstructions')).to_have_value('Orientação da sessão recuperada')
            expect(field('coachFinishStatus')).to_contain_text('ainda não foi gravada')
            page.request.post(base + '/test-control', data={'loseNext': True})
            field('btnConfirmSession').click()
            expect(field('coachFinishStatus')).to_contain_text('TRANSPORT_ERROR')
            before_reload = page.request.post(base + '/test-tables', data={}).json()
            attempts = [r for r in requests if r['action'] == 'saveCoachSession']
            assert len(attempts) == 2
            assert attempts[0]['requestId'] == attempts[1]['requestId']
            requests.clear()
            page.reload()
            field('btnLogin').click()
            field('btnFinishLogin').click()
            expect(field('coachFinishStatus')).to_have_text('Sessão gravada com 5 exercício(s).')
            expect(field('coachTreinoId')).to_have_value(before_reload['Workouts'][-1][0])
            assert page.request.post(base + '/test-tables', data={}).json() == before_reload
            assert [r['data']['requestId'] for r in requests if r['action'] == 'coachSessionStatus'] == [attempts[0]['requestId']]
            assert all(r['action'] not in ('saveCoachSession', 'resumeCoachSession') for r in requests)
            print('PASS: cinco exercícios após expiração; confirmação perdida e recarga recuperam o mesmo ID.')
            assert not errors, errors
            browser.close()
    finally:
        server.terminate()
