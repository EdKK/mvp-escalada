"""Exercise session models in Chromium with mock Google services."""
from pathlib import Path
import shutil
import subprocess
from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=root, stdout=subprocess.PIPE, text=True)
try:
    base = 'http://127.0.0.1:' + server.stdout.readline().strip()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium') or p.chromium.executable_path)
        page = browser.new_page(viewport={'width': 390, 'height': 900})
        page.set_default_timeout(10000)
        page.add_init_script('window.open = () => null')
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(base)
        page.locator('#btnLogin').click()
        page.locator('#btnFinishLogin').click()
        expect(page.locator('#appPanel')).to_be_visible()
        expect(page.locator('#saveSessionModel')).to_be_hidden()

        def tables():
            return page.request.post(base + '/test-tables', data={}).json()

        def create_model(name, description=''):
            page.locator('#saveSessionModel').click()
            expect(page.locator('#sessionModelName')).to_be_focused()
            page.locator('#sessionModelName').fill(name)
            page.locator('#sessionModelDescription').fill(description)
            page.locator('#submitSessionModel').click()
            expect(page.locator('#sessionModelEditor')).to_be_hidden()

        page.locator('#coachAluno').select_option('s1')
        page.locator('#coachData').fill('2026-11-18')
        page.locator('#coachMicrocycleType').select_option('Ordinário')
        page.locator('#coachInstructions').fill('Aquecer\nRespeitar os intervalos')
        page.locator('#btnCriarTreino').click()
        page.locator('#itemExercicio').select_option('exercise-bench')
        expect(page.locator('#libraryAssessment option')).to_have_count(2)
        page.locator('#libraryMethod').select_option('method-max-effort')
        page.locator('#libraryAssessment').select_option(index=1)
        page.locator('#itemIntensVal').fill('85')
        page.locator('#itemQtd').fill('3')
        page.locator('#itemMin').fill('5')
        page.locator('#coachVolumeDistribution summary').click()
        page.locator('#volumeDistribution').fill('3\n4')
        page.locator('#itemNotas').fill('Controle da técnica')
        page.locator('#btnAddItem').click()
        page.locator('#btnReviewSession').click()
        page.locator('#btnConfirmSession').click()
        expect(page.locator('#btnConfirmSession')).to_have_text('Confirmar recebimento')
        source_id = page.locator('#coachTreinoId').input_value()
        page.locator('#saveSessionModel').click()
        page.locator('#submitSessionModel').click()
        expect(page.locator('#sessionModelEditor')).to_be_visible()
        assert len(tables()['MODELOS_SESSAO']) == 1
        page.locator('#closeSessionModelEditor').click()
        create_model('Força de dedos', 'Progressão')
        page.locator('#btnConfirmSession').click()

        # Save again after visiting another workout, exercising the consultation entry point.
        page.locator('#listaTreinos button', has_text='2026-11-18 • s2').click()
        expect(page.locator('#saveSessionModel')).to_be_hidden()
        page.locator('#listaTreinos button', has_text='Ordinário').click()
        create_model('Resistência técnica')

        page.locator('#coachTabLibrary').click()
        expect(page.locator('#sessionModelsBrowser')).to_be_hidden()
        page.locator('#libraryModelsCard').click()
        expect(page.locator('#libraryPageTitle')).to_have_text('Modelos de sessões')
        expect(page.locator('#sessionModelList article')).to_have_count(2)
        page.locator('#sessionModelSearch').fill('forca')
        expect(page.locator('#sessionModelList article')).to_have_count(1)
        page.locator('#sessionModelMicrocycle').select_option('Choque')
        expect(page.locator('#sessionModelsStatus')).to_have_text('Nenhum modelo encontrado.')
        page.locator('#sessionModelMicrocycle').select_option('Ordinário')
        page.get_by_role('button', name='Visualizar', exact=True).click()
        preview = page.locator('#sessionModelPreview')
        for item in ['Força de dedos', 'Aquecer', 'Respeitar os intervalos', 'Supino', '85%', 'Série 2: 4 repetições', 'Controle da técnica']:
            expect(preview).to_contain_text(item)
        assert '2026-11-18' not in preview.inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')

        before_copy = tables()
        page.get_by_role('button', name='Utilizar', exact=True).click()
        expect(page.locator('#coachBuildPanel')).to_be_visible()
        expect(page.locator('#coachAluno')).to_have_value('')
        expect(page.locator('#coachData')).to_have_value('')
        expect(page.locator('#coachTreinoId')).to_have_value('')
        expect(page.locator('#coachMicrocycleType')).to_have_value('Ordinário')
        expect(page.locator('#coachInstructions')).to_have_value('Aquecer\nRespeitar os intervalos')
        assert tables() == before_copy

        # Sidebar navigation preserves the active subpage, filters, and the unsaved copy.
        page.locator('#coachTabLibrary').click()
        expect(page.locator('#sessionModelSearch')).to_have_value('forca')
        page.get_by_role('button', name='Utilizar', exact=True).click()
        expect(page.locator('#notice')).to_contain_text('Salve ou descarte a montagem em andamento')
        page.locator('#libraryBack').click()
        expect(page.locator('#libraryModelsCard')).to_be_focused()
        page.locator('#coachTabBuild').click()
        expect(page.get_by_role('button', name='Editar exercício 1', exact=True)).to_be_visible()
        expect(page.locator('#coachInstructions')).to_have_value('Aquecer\nRespeitar os intervalos')
        assert tables() == before_copy

        page.locator('#coachAluno').select_option('s2')
        page.locator('#coachData').fill('2026-11-19')
        page.locator('#btnReviewSession').click()
        expect(page.locator('#coachFinishStatus')).to_contain_text('selecione uma avaliação individual válida')
        expect(page.locator('#btnConfirmSession')).to_be_hidden()
        page.get_by_role('button', name='Editar exercício 1', exact=True).click()
        expect(page.locator('#libraryAssessment')).to_have_value('')
        expect(page.locator('#itemIntensVal')).to_have_value('85')
        expect(page.locator('#volumeDistribution')).to_have_value('3\n4')
        page.locator('#libraryAssessment').select_option(index=1)
        page.locator('#itemIntensVal').fill('75')
        page.locator('#btnAddItem').click()
        page.locator('#btnReviewSession').click()
        page.locator('#btnConfirmSession').click()
        expect(page.locator('#btnConfirmSession')).to_have_text('Confirmar recebimento')
        copy_id = page.locator('#coachTreinoId').input_value()
        assert source_id != copy_id
        create_model('Cópia modificada')
        page.locator('#btnConfirmSession').click()

        page.locator('#openSessionModels').click()
        expect(page.locator('#sessionModelsPicker')).to_be_visible()
        expect(page.locator('#sessionModelList article')).to_have_count(1)
        page.get_by_role('button', name='Visualizar', exact=True).click()
        expect(preview).to_contain_text('85%')
        prescriptions = {name: tables()[name] for name in ['Workouts', 'Items', 'PRESCRICOES', 'PRESCRICAO_SERIES']}
        page.get_by_role('button', name='Excluir', exact=True).click()
        expect(page.locator('#sessionModelsStatus')).to_have_text('Nenhum modelo encontrado.')
        assert all(tables()[name] == records for name, records in prescriptions.items())
        page.locator('#sessionModelSearch').fill('copia')
        page.get_by_role('button', name='Utilizar', exact=True).click()
        expect(page.locator('#sessionModelsPicker')).to_be_hidden()
        expect(page.locator('#coachAluno')).to_have_value('')
        expect(page.locator('#coachData')).to_have_value('')
        page.get_by_role('button', name='Editar exercício 1', exact=True).click()
        expect(page.locator('#itemIntensVal')).to_have_value('75')
        print('PASS: creation, consultation, search/filter, preview, independent copies, reassessment, deletion and both model entry points')

        page.locator('#cancelCoachSession').click()
        token = page.request.post(base + '/rpc', data={
            'method': 'api', 'request': {'action': 'finishLogin'}, 'profile': 'coach'
        }).json()['data']['sessionToken']

        def library(action, data, request_id):
            result = page.request.post(base + '/rpc', data={'method': 'libraryApi', 'request': {
                'action': action, 'data': data, 'requestId': request_id, 'sessionToken': token
            }}).json()
            assert result['ok'], result
            return result['data']

        assessment = {
            'exerciseId': 'exercise-bench', 'indicatorId': 'int-max-force', 'unitId': 'unit-newton',
            'protocol': 'Protocolo auxiliar', 'referenceDefinition': 'Referência auxiliar',
            'assessedOn': '2026-11-01', 'validUntil': '2026-12-31'
        }
        previous_reference_id = library('recordAssessment', dict(assessment, studentId='s1', value=200), 'aux-s1')['id']
        new_reference_id = library('recordAssessment', dict(assessment, studentId='s2', value=300), 'aux-s2')['id']
        primary_id = next(row[0] for row in tables()['AVALIACOES'][1:] if row[1:4] == ['s1', 'exercise-bench', 'int-1rm'])
        goal_session = library('saveCoachSession', {
            'session': {'studentId': 's1', 'date': '2026-11-22', 'goal': 'Controle de movimentos', 'instructions': []},
            'items': [{
                'block': 'Treinamento direcionado', 'classification': 'directed',
                'directed': {'version': 1, 'subblock': 'campus_board', 'modality': 'sequence',
                             'sequenceId': 'CB02', 'feet': 'none', 'grip': 'sloper', 'gripOption': 'level1',
                             'load': {'kind': 'bodyweight'},
                             'sets': 2, 'repetitionsPerSet': 2, 'restBetweenRepetitionsSeconds': 30, 'restBetweenSetsSeconds': 120}
            }, {
                'block': 'Força', 'category': 'Tração', 'classification': 'general', 'exerciseId': 'exercise-bench',
                'methodId': 'method-max-effort', 'metric': 'Reps', 'quantity': 0, 'minutes': 5,
                'intensity': {'indicatorId': 'int-1rm', 'assessmentId': primary_id, 'percent': 85},
                'auxiliaryIntensities': [{'indicatorId': 'int-max-force', 'assessmentId': previous_reference_id, 'percent': 50}],
                'volume': {'kind': 'repetitions', 'unitId': 'unit-repetitions', 'sets': [{'repetitions': 3}]}
            }]
        }, 'goal-campus')
        library('createSessionModel', {'workoutId': goal_session['workoutId'], 'name': 'Campus e força'}, 'goal-model')
        page.locator('#openSessionModels').click()
        page.locator('#sessionModelMicrocycle').select_option('')
        page.locator('#sessionModelSearch').fill('campus')
        page.get_by_role('button', name='Visualizar', exact=True).click()
        for item in ['Controle de movimentos', 'Alternada com salto inicial', 'Início na agarra 1 → D3', '50% da avaliação individual']:
            expect(preview).to_contain_text(item)
        page.get_by_role('button', name='Utilizar', exact=True).click()
        expect(page.locator('#coachGoal')).to_have_value('Controle de movimentos')
        expect(page.locator('#coachMicrocycleType')).to_be_hidden()
        page.locator('#coachAluno').select_option('s2')
        page.locator('#coachData').fill('2026-11-23')
        page.get_by_role('button', name='Editar exercício 2', exact=True).click()
        expect(page.locator('#itemCategoria')).to_have_value('Tração')
        expect(page.locator('#itemQtd')).to_have_value('0')
        aux = page.locator('#draftAuxiliaryAssessment0')
        expect(aux).to_have_value('')
        assert [option.get_attribute('value') for option in aux.locator('option').all()] == ['', new_reference_id]
        page.locator('#libraryAssessment').select_option(index=1)
        aux.select_option(new_reference_id)
        page.locator('#btnAddItem').click()
        page.locator('#btnReviewSession').click()
        page.locator('#btnConfirmSession').click()
        expect(page.locator('#btnConfirmSession')).to_have_text('Confirmar recebimento')
        assert not errors, errors
        print('PASS: objective session, Campus Board path and auxiliary assessment revalidation')
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
