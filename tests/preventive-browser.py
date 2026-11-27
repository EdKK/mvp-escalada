"""BIB-14B on Chromium with simulated OAuth and Sheets."""
from pathlib import Path
import shutil
import subprocess
from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=root,
                          stdout=subprocess.PIPE, text=True)
try:
    base = 'http://127.0.0.1:' + server.stdout.readline().strip()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium') or p.chromium.executable_path)
        coach = browser.new_page(viewport={'width': 1440, 'height': 900})
        student = browser.new_page(viewport={'width': 390, 'height': 900})
        errors, requests = [], []
        for page in (coach, student):
            page.set_default_timeout(10000)
            page.add_init_script('window.open = () => null')
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda request: requests.append(request.post_data_json['request'])
                    if request.url.endswith('/rpc') and request.method == 'POST' else None)

        def login_coach():
            coach.locator('#btnLogin').click()
            coach.locator('#btnFinishLogin').click()
            expect(coach.locator('#appPanel')).to_be_visible()

        def tables():
            return coach.request.post(base+'/test-tables', data={}).json()

        def button(name):
            return coach.get_by_role('button', name=name, exact=True)

        def exercise_card(name):
            return coach.locator('#strengthCards article').filter(has=coach.get_by_role('heading', name=name, exact=True))

        coach.goto(base)
        login_coach()
        coach.locator('#coachAluno').select_option('s1')
        coach.locator('#coachData').fill('2026-11-18')
        coach.locator('#coachMicrocycleType').select_option('Choque')
        coach.locator('#btnCriarTreino').click()
        before = tables()

        coach.locator('#coachTabLibrary').click()
        coach.locator('#libraryGeneralCard').press('Enter')
        coach.locator('#generalPrevention').press('Space')
        path = coach.locator('#generalCatalogBreadcrumb li')
        choices = coach.locator('#generalCatalogChoices')
        back = coach.locator('#libraryBack')
        expect(path).to_have_text(['Treinamento geral', 'Exercícios preventivos'])
        expect(choices.locator('button')).to_have_text(['Gerais', 'Específicos para lesões'])
        counts = {
            'Gerais': [('Ombros', 6), ('Cotovelos', 2), ('Punhos', 1), ('Tronco', 3), ('Quadril', 1),
                       ('Membros inferiores', 2), ('Pés', 2)],
            'Específicos para lesões': [('Ombros', 20), ('Cotovelos', 12), ('Punhos', 4), ('Dedos', 2),
                                       ('Coluna e tronco', 12), ('Quadril', 7), ('Joelhos', 3), ('Tornozelos', 2)]
        }
        exercises = coach.locator('#generalExerciseList li')
        for subgroup, categories in counts.items():
            button(subgroup).click()
            expect(path.last).to_have_text(subgroup)
            if subgroup == 'Específicos para lesões':
                expect(coach.locator('#generalPreventiveNote')).to_contain_text('equipe de saúde')
            else:
                expect(coach.locator('#generalPreventiveNote')).to_be_hidden()
            expect(choices.locator('.library-overview-card-title')).to_have_text([x[0] for x in categories])
            for category, count in categories:
                button(f'{category} {count} '+('exercício' if count == 1 else 'exercícios')).click()
                expect(path.last).to_have_text(category)
                expect(exercises).to_have_count(count)
                if subgroup == 'Específicos para lesões' and category == 'Ombros':
                    coach.locator('#generalExerciseSearch').fill('elastico nos punhos')
                    expect(exercises).to_have_text(['Remada nas argolas com elástico nos punhos — p. 47, 48'])
                    coach.set_viewport_size({'width': 390, 'height': 900})
                    assert coach.evaluate('document.documentElement.scrollWidth<=innerWidth')
                back.click()
            back.click()
        back.click()
        expect(coach.locator('#generalPrevention')).to_be_focused()
        assert tables() == before

        coach.locator('#coachTabBuild').click()
        coach.locator('#openPreventive').click()
        expect(coach.locator('#preventivePrescriptionNote')).to_be_visible()
        coach.locator('#strengthRegion').select_option('Específicos para lesões')
        coach.locator('#strengthCategory').select_option('Dedos')
        band = 'Extensão e abertura dos dedos com elástico'
        plain = 'Terra romeno unilateral com flexão do joelho de apoio'
        coach.get_by_role('checkbox', name=band, exact=True).check()
        coach.locator('#strengthSearch').fill('extensao e abertura dos dedos')
        expect(coach.locator('#strengthResults input')).to_have_count(1)
        expect(coach.get_by_role('checkbox', name=band, exact=True)).to_be_checked()
        coach.locator('#strengthSearch').fill('terra romeno')
        coach.get_by_role('checkbox', name=plain, exact=True).check()
        expect(coach.locator('#strengthSelectionCount')).to_have_text('2 selecionado(s)')
        band_card, plain_card = exercise_card(band), exercise_card(plain)
        expect(band_card.locator('label')).to_have_text(['Séries', 'Repetições por série',
                                                        'Resistência do elástico (opcional)', 'Orientações (opcional)'])
        expect(plain_card.locator('select option')).to_have_text(['Não informada', 'Fraca', 'Média', 'Forte'])
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(0)
        for card in (band_card, plain_card):
            card.locator('[name=sets]').fill('3')
            card.locator('[name=repetitionsPerSet]').fill('7')
            expect(card.locator('p')).to_have_text('Volume: 21 repetições')
        band_card.locator('[name=resistance]').select_option('Média')
        band_card.locator('[name=guidance]').fill('Pausar antes de repetir.')
        assert coach.evaluate('document.documentElement.scrollWidth<=innerWidth')
        coach.locator('#coachTabLibrary').click()
        coach.locator('#coachTabBuild').click()
        expect(band_card.locator('[name=guidance]')).to_have_value('Pausar antes de repetir.')
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(2)
        assert tables() == before
        assert sum(r['action'] == 'listPreventiveCatalog' for r in requests) == 1

        coach.reload()
        login_coach()
        expect(coach.locator('#coachDraftItems')).to_contain_text('Pausar antes de repetir.')
        button('Editar exercício 2').click()
        expect(plain_card.locator('[name=resistance]')).to_have_value('')
        plain_card.locator('[name=sets]').fill('4')
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems')).to_contain_text('Volume: 28 repetições')
        coach.locator('#btnReviewSession').click()
        coach.locator('#btnConfirmSession').click()
        expect(coach.locator('#btnConfirmSession')).to_have_text('Confirmar recebimento')
        source_id = coach.locator('#coachTreinoId').input_value()
        coach.locator('#saveSessionModel').click()
        coach.locator('#sessionModelName').fill('Dois preventivos')
        coach.locator('#submitSessionModel').click()
        expect(coach.locator('#sessionModelEditor')).to_be_hidden()
        coach.locator('#btnConfirmSession').click()

        student.goto(base+'/student')
        student.evaluate("window.testProfile='student'")
        student.locator('#prepareLogin').click()
        student.locator('#finishLogin').click()
        expect(student.locator('#trainingPanel')).to_be_visible()
        student.locator('#sessionSelect').select_option(source_id)
        card = student.locator('#exercises details').filter(has_text=band)
        if not card.evaluate('(element)=>element.open'):
            card.locator('summary').click()
        for phrase in ('3 séries', '7 por série', 'Resistência do elástico', 'Média',
                       'Pausar antes de repetir.', 'Volume prescrito: 21 repetições'):
            expect(card).to_contain_text(phrase)
        expect(card.get_by_text('Descanso', exact=True)).to_have_count(0)
        card.get_by_role('button', name='Concluir exercício').click()
        expect(card).to_contain_text('Concluído')
        expect(student.locator('#feedbackDialog')).to_be_hidden()
        expect(student.locator('#exercises details').filter(has_text=plain)).not_to_contain_text('Concluído')
        card.get_by_role('button', name='Editar feedback').click()
        expect(student.locator('#actualSets')).to_have_value('')
        expect(student.locator('#actualQuantity')).to_have_value('')
        expect(student.locator('#feedbackPain')).to_have_value('')
        expect(student.get_by_text('Percepção subjetiva do esforço — PSE (1–10)')).to_be_visible()
        student.locator('#actualSets').fill('0')
        student.locator('#feedbackRpe').fill('4')
        student.locator('#saveFeedback').click()
        expect(card).to_contain_text('PSE: 4')
        expect(card).to_contain_text('0 séries')
        expect(card).not_to_contain_text('21 repetições executadas')
        coach.locator('#listaTreinos button', has_text='Choque').click()
        expect(coach.locator('#listaRetornos')).to_contain_text('PSE: 4')

        coach.locator('#openSessionModels').click()
        button('Visualizar').click()
        expect(coach.locator('#sessionModelPreview')).to_contain_text('Resistência do elástico: Média')
        button('Utilizar').click()
        expect(coach.locator('#coachAluno')).to_have_value('')
        expect(coach.locator('#coachData')).to_have_value('')
        expect(coach.locator('#coachDraftItems > div')).to_have_count(2)
        button('Excluir exercício 2').click()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(1)
        assert sum(r['action'] == 'saveCoachSession' for r in requests) == 1
        assert not errors, errors
        print('PASS: subgroup navigation, counts, responsive design, batch, draft recovery, save, student feedback and model copy')
finally:
    server.terminate()
    server.wait(timeout=10)
