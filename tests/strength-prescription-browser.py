"""BIB-13B on Chromium with simulated OAuth and Sheets."""
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
        coach = browser.new_page(viewport={'width': 1440, 'height': 900})
        student = browser.new_page(viewport={'width': 390, 'height': 900})
        errors, saves = [], []
        for page in (coach, student):
            page.set_default_timeout(10000)
            page.add_init_script('window.open = () => null')
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page.on('pageerror', lambda error: errors.append(str(error)))
        coach.on('request', lambda request: saves.append(request.post_data_json['request'])
                 if request.url.endswith('/rpc') and request.method == 'POST' and
                 request.post_data_json['request']['action'] == 'saveCoachSession' else None)

        def rpc(method, action, data, token=None, key=None):
            payload = {'action':action, 'data':data}
            if token:
                payload['sessionToken'] = token
            if key:
                payload['requestId'] = key
            response = coach.request.post(base+'/rpc', data={'method':method,'request':payload,'profile':'coach'}).json()
            assert response['ok'], response
            return response['data']

        token = rpc('api', 'finishLogin', {})['sessionToken']
        for person, value in [('s1', 80), ('s2', 100)]:
            rpc('libraryApi','recordAssessment',{
                'studentId':person,'exerciseId':'mus-peitoral-001','indicatorId':'int-1rm','value':value,'unitId':'unit-kg',
                'protocol':'Teste direto de 1RM','referenceDefinition':'musculacao:added:bilateral:total',
                'assessedOn':'2026-11-01','validUntil':'2026-12-31'
            },token,'strength-reference-'+person)

        def login_coach():
            coach.locator('#btnLogin').click()
            coach.locator('#btnFinishLogin').click()
            expect(coach.locator('#appPanel')).to_be_visible()

        def tables():
            return coach.request.post(base+'/test-tables',data={}).json()

        def card(name):
            return coach.locator('#strengthCards article').filter(has=coach.get_by_role('heading',name=name,exact=True))

        def field(article, name):
            return article.locator(f'[name="{name}"]')

        coach.goto(base)
        login_coach()
        coach.locator('#coachAluno').select_option('s1')
        coach.locator('#coachData').fill('2026-11-18')
        coach.locator('#coachMicrocycleType').select_option('Choque')
        coach.locator('#btnCriarTreino').click()
        coach.locator('#openStrength').click()
        expect(coach.locator('#strengthPanel')).to_be_visible()
        before = tables()
        coach.locator('#strengthRegion').select_option('Membros superiores')
        coach.locator('#strengthCategory').select_option('Peitoral')
        names = ['Supino reto com barra','Barra fixa unilateral','Paralelas','Agachamento búlgaro','Encurtamento ativo do pé (short foot)']
        coach.get_by_role('checkbox',name=names[0],exact=True).check()
        coach.locator('#strengthCategory').select_option('Dorsais')
        coach.get_by_role('checkbox',name=names[1],exact=True).check()
        for query,name in zip(['paralelas','bulgaro','short foot','inseto morto'],names[2:]+['Inseto morto (Dead bug)']):
            coach.locator('#strengthSearch').fill(query)
            coach.get_by_role('checkbox',name=name,exact=True).check()
        coach.get_by_role('button',name='Remover Inseto morto (Dead bug)',exact=True).click()
        expect(coach.locator('#strengthSelectionCount')).to_have_text('5 selecionado(s)')
        expect(coach.locator('#strengthCards h4')).to_have_text(names)
        expect(card(names[0]).locator('.strength-fields label')).to_have_text(
            ['Séries','Repetições por série','Recuperação entre séries','Carga (kg)'])
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems button')).to_have_count(0)

        for index,name in enumerate(names):
            article = card(name)
            expect(field(article,'execution')).to_have_value('bilateral')
            expect(field(article,'condition')).to_have_value('added')
            field(article,'sets').fill('3')
            field(article,'repetitionsPerSet').fill('8')
            field(article,'restBetweenSetsSeconds').select_option('120')
            field(article,'kilograms').fill('40')
            if index in [0,1,2,3]:
                article.locator('summary').click()
            if index == 0:
                field(article,'durationSeconds').fill('2.5')
                field(article,'restBetweenRepetitionsSeconds').fill('4')
                field(article,'guidance').fill('Controle a descida.')
            if index == 1:
                field(article,'condition').select_option('bodyweight')
                field(article,'execution').select_option('unilateral')
                expect(field(article,'kilograms')).to_have_value('0')
            if index == 2:
                field(article,'condition').select_option('assisted')
                field(article,'kilograms').fill('15')
            if index == 3:
                field(article,'execution').select_option('unilateral')
                field(article,'loadBasis').select_option('per_implement')
                field(article,'kilograms').fill('12.5')
            if index != 4:
                article.locator('summary').click()
        expect(card(names[0]).locator('p')).to_contain_text('Volume: 24 repetições • %1RM: 50%')
        expect(card(names[1]).locator('p')).to_contain_text('Peso corporal • Volume: 48 repetições • %1RM: —')
        expect(card(names[2]).locator('p')).to_contain_text('Carga assistida')
        expect(card(names[3]).locator('p')).to_contain_text('Por implemento independente')
        coach.set_viewport_size({'width':390,'height':900})
        assert coach.evaluate('document.documentElement.scrollWidth<=innerWidth')
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(5)
        assert tables() == before and not saves

        coach.reload()
        login_coach()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(5)
        expect(coach.locator('#coachDraftItems')).to_contain_text('Controle a descida.')
        coach.get_by_role('button',name='Editar exercício 4',exact=True).click()
        edited = card(names[3])
        expect(field(edited,'kilograms')).to_have_value('12.5')
        field(edited,'sets').fill('4')
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems')).to_contain_text('64 repetições')
        coach.get_by_role('button',name='Excluir exercício 5',exact=True).click()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(4)

        coach.locator('#openStrength').click()
        coach.locator('#strengthSearch').fill('short foot')
        coach.get_by_role('checkbox',name=names[4],exact=True).check()
        foot = card(names[4])
        field(foot,'sets').fill('2')
        field(foot,'repetitionsPerSet').fill('5')
        field(foot,'restBetweenSetsSeconds').select_option('60')
        field(foot,'kilograms').fill('5')
        coach.locator('#strengthAdd').click()
        expect(coach.locator('#coachDraftItems > div')).to_have_count(5)
        coach.locator('#btnReviewSession').click()
        coach.locator('#btnConfirmSession').click()
        expect(coach.locator('#btnConfirmSession')).to_have_text('Confirmar recebimento')
        assert len(saves) == 1 and len(saves[0]['data']['items']) == 5
        source_id = coach.locator('#coachTreinoId').input_value()
        coach.locator('#saveSessionModel').click()
        coach.locator('#sessionModelName').fill('Cinco exercícios')
        coach.locator('#submitSessionModel').click()
        expect(coach.locator('#sessionModelEditor')).to_be_hidden()
        coach.locator('#btnConfirmSession').click()

        student.goto(base+'/student')
        student.evaluate("window.testProfile='student'")
        student.locator('#prepareLogin').click()
        student.locator('#finishLogin').click()
        expect(student.locator('#trainingPanel')).to_be_visible()
        student.locator('#sessionSelect').select_option(source_id)
        exercise = student.locator('#exercises details').filter(has_text='Agachamento búlgaro')
        if not exercise.evaluate('(element)=>element.open'):
            exercise.locator('summary').click()
        expect(exercise).to_contain_text('64 repetições')
        expect(exercise).to_contain_text('12.5 kg por implemento')
        expect(exercise).to_contain_text('por série por lado')
        exercise.get_by_role('button',name='Dar feedback').click()
        student.locator('#feedbackStatus').select_option('partial')
        student.locator('#actualSets').fill('2')
        student.locator('#actualQuantity').fill('6')
        student.locator('#actualKilograms').fill('10.5')
        student.locator('#feedbackRpe').fill('7')
        student.locator('#feedbackPain').fill('2')
        student.locator('#feedbackComment').fill('Reduzi a carga.')
        expect(student.locator('#actualStrengthVolume')).to_have_text('Volume executado: 24 repetições')
        student.locator('#saveFeedback').click()
        expect(exercise).to_contain_text('24 repetições • 10.5 kg')
        expect(exercise).to_contain_text('Volume prescrito: 64 repetições')
        coach.locator('#listaTreinos button',has_text='Choque').click()
        expect(coach.locator('#listaRetornos')).to_contain_text('Carga executada: 10.5 kg')
        expect(coach.locator('#listaRetornos')).to_contain_text('PSE: 7')
        expect(coach.locator('#listaRetornos')).to_contain_text('Reduzi a carga.')

        coach.locator('#openSessionModels').click()
        coach.get_by_role('button',name='Visualizar',exact=True).click()
        expect(coach.locator('#sessionModelPreview')).to_contain_text('Controle a descida.')
        expect(coach.locator('#sessionModelPreview')).not_to_contain_text('50%')
        coach.get_by_role('button',name='Utilizar',exact=True).click()
        expect(coach.locator('#coachAluno')).to_have_value('')
        expect(coach.locator('#coachDraftItems')).to_contain_text('%1RM: —')
        coach.locator('#coachAluno').select_option('s2')
        coach.locator('#coachData').fill('2026-11-18')
        expect(coach.locator('#coachDraftItems')).to_contain_text('%1RM: 40%')
        expect(coach.locator('#coachDraftItems > div')).to_have_count(5)
        assert len(saves) == 1
        assert not errors, errors
        print('PASS: five categories, individual cards, validation, drafts, recovery, edit/delete, single save, student dose/feedback and new-student model reference')
finally:
    server.terminate()
    server.wait(timeout=10)
