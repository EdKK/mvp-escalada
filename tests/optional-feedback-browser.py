"""BIB-13E in Chromium with local OAuth and Sheets substitutes."""
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
        coach = browser.new_page()
        student = browser.new_page(viewport={'width': 390, 'height': 900})
        errors, requests = [], []
        for page in (coach, student):
            page.add_init_script('window.open = () => null')
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page.on('pageerror', lambda error: errors.append(str(error)))
        student.on('request', lambda request: requests.append(request.post_data_json['request'])
                   if request.url.endswith('/rpc') and request.method == 'POST' and
                   request.post_data_json['request']['action'] == 'submitItemFeedback' else None)

        def rpc(method, data):
            response = coach.request.post(base+'/rpc',data={'method':method,'request':data,'profile':'coach'}).json()
            assert response['ok'], response
            return response['data']

        def feedback_rows():
            tables = student.request.post(base+'/test-tables', data={}).json()
            schema, *rows = tables['ItemFeedback']
            return [dict(zip(schema, row)) for row in rows]

        token = rpc('api',{'action':'finishLogin','data':{}})['sessionToken']
        saved = rpc('libraryApi',{
            'action':'saveCoachSession','requestId':'bib13e-fixture','sessionToken':token,'data':{
                'session':{'studentId':'s1','date':'2026-11-25','microcycleType':'Choque','instructions':[]},
                'items':[
                    {'block':'Treinamento geral','classification':'general','strength':{'version':1,'exerciseId':'mus-peitoral-001',
                        'sets':3,'repetitionsPerSet':8,'restBetweenSetsSeconds':120,'kilograms':20,'loadBasis':'total',
                        'condition':'added','execution':'unilateral'}},
                    {'block':'Treinamento direcionado','classification':'directed','directed':{'version':1,'subblock':'fingerboard',
                        'modality':'isometric','grip':'jug','side':'bilateral','load':{'kind':'bodyweight'},
                        'sets':2,'repetitionsPerSet':3,'durationSeconds':5,'restBetweenRepetitionsSeconds':10,'restBetweenSetsSeconds':120}},
                    {'block':'Treinamento específico','classification':'specific','intensity':{'indicatorId':'int-grade'},
                        'task':{'version':3,'subblock':'boulder_short','sets':2,'repetitionsPerSet':3}}
                ]
            }})
        coach.goto(base)
        coach.locator('#btnLogin').click()
        coach.locator('#btnFinishLogin').click()
        expect(coach.locator('#appPanel')).to_be_visible()
        coach.locator('#listaTreinos button', has_text='Choque').click()
        student.goto(base+'/student')
        student.evaluate("window.testProfile='student'")
        student.locator('#prepareLogin').click()
        student.locator('#finishLogin').click()
        student.locator('#days button[data-date="2026-11-25"]').click()
        expect(student.locator('#exercises details')).to_have_count(3)
        assert saved['count'] == 3

        def exercise(name):
            card = student.locator('#exercises details').filter(has_text=name)
            if not card.evaluate('element=>element.open'):
                card.locator('summary').click()
            return card

        strength = exercise('Supino reto com barra')
        student.request.post(base+'/test-control',data={'loseNextFeedback':True})
        strength.locator('.complete-btn').click()
        expect(student.locator('#toast')).to_contain_text('Tente novamente')
        expect(strength).to_have_attribute('data-status','pending')
        expect(student.locator('#feedbackDialog')).to_be_hidden()
        assert student.locator('#confirmDialog').count() == 0
        rows = feedback_rows()
        assert len(rows) == 1 and rows[0]['status'] == 'completed'
        assert all(rows[0][field] == '' for field in ['actualSets','actualQuantity','fingerPain','rpe','comment'])
        strength.locator('.complete-btn').click()
        expect(strength).to_have_attribute('data-status','completed')
        expect(strength.locator('.complete-btn')).to_be_disabled()
        assert len(feedback_rows()) == 1 and requests[0] == requests[1]
        expect(student.locator('#progressText')).to_have_text('1 de 3 marcados como concluídos')

        strength.get_by_role('button',name='Editar feedback').click()
        expect(student.get_by_label('Percepção subjetiva do esforço — PSE (1–10)')).to_have_value('')
        expect(student.locator('#feedbackPain')).to_have_value('')
        expect(student.locator('#actualKilograms')).to_have_value('')
        student.locator('#actualSets').fill('2')
        expect(student.locator('#actualStrengthVolume')).to_have_text('Volume executado: —')
        student.locator('#saveFeedback').click()
        expect(student.locator('#feedbackDialog')).to_be_hidden()
        assert feedback_rows()[-1]['actualSets'] == 2 and feedback_rows()[-1]['actualQuantity'] == ''

        strength.get_by_role('button',name='Editar feedback').click()
        student.locator('#actualQuantity').fill('0')
        student.locator('#actualKilograms').fill('0')
        expect(student.locator('#actualStrengthVolume')).to_have_text('Volume executado: 0 repetições')
        student.locator('#saveFeedback').click()
        expect(strength).to_contain_text('0 repetições • 0 kg')

        directed = exercise('Fingerboard')
        directed.get_by_role('button',name='Dar feedback').click()
        student.locator('#feedbackStatus').select_option('partial')
        student.locator('#actual-0-repetitions').fill('0')
        student.locator('#feedbackRpe').fill('8')
        student.locator('#feedbackPain').fill('0')
        student.locator('#feedbackComment').fill('Apenas a primeira série foi informada.')
        student.locator('#saveFeedback').click()
        expect(directed).to_have_attribute('data-status','partial')
        expect(directed).to_contain_text('Série 1: 0 repetições')
        expect(directed).not_to_contain_text('Série 2:')
        directed.locator('.complete-btn').click()
        expect(directed).to_have_attribute('data-status','completed')
        expect(directed).to_contain_text('Série 1: 0 repetições')
        expect(directed).not_to_contain_text('Série 2:')
        expect(directed).to_contain_text('PSE: 8 • Dor: 0')
        expect(student.locator('#progressText')).to_have_text('2 de 3 marcados como concluídos')
        directed.get_by_role('button',name='Editar feedback').click()
        expect(student.locator('#actual-0-repetitions')).to_have_value('0')
        expect(student.locator('#actual-1-repetitions')).to_have_value('')
        expect(student.locator('#actual-0-seconds')).to_have_value('')
        student.locator('#cancelFeedback').click()

        specific = exercise('Boulder curto')
        specific.get_by_role('button',name='Dar feedback').click()
        student.locator('#feedbackStatus').select_option('partial')
        student.locator('#saveFeedback').click()
        expect(specific).to_have_attribute('data-status','partial')
        expect(specific).to_contain_text('sem dados quantitativos')
        specific.locator('.complete-btn').click()
        expect(specific).to_have_attribute('data-status','completed')
        expect(student.locator('#progressText')).to_have_text('3 de 3 marcados como concluídos')

        coach.get_by_role('button',name='Atualizar treinos',exact=True).click()
        expect(coach.locator('#listaRetornos')).to_contain_text('PSE: 8')
        expect(coach.locator('#listaRetornos')).to_contain_text('Dor: 0')
        expect(coach.locator('#listaRetornos')).to_contain_text('Série 1: 0 repetições')
        expect(coach.locator('#listaRetornos')).to_contain_text('Quantidade executada: 0 repetições')
        expect(coach.locator('#listaRetornos')).to_contain_text('Apenas a primeira série foi informada.')
        expect(coach.locator('#listaRetornos')).not_to_contain_text('undefined')
        assert len(student.request.post(base+'/test-tables',data={}).json()['Feedback']) == 2
        assert not errors, errors
        print('PASS: optional feedback in all three blocks, explicit zeros, one-click completion with lost-response replay, edit and coach PSE')
finally:
    server.terminate()
    server.wait(timeout=10)
