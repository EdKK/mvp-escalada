"""Real browser, generated Student.html and trainer UI; Google/Sheets/OAuth mocked locally.
Run from repository root: python tests/prescription-cycle-browser.py
No production access. Screenshot outputs are under /tmp only.
"""
from pathlib import Path
import subprocess
import shutil
from playwright.sync_api import sync_playwright, expect
from helpers.saved_workout import select_saved_workout

ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','tests/helpers/coach-browser-server.cjs'],cwd=ROOT,stdout=subprocess.PIPE,text=True)
try:
    port=server.stdout.readline().strip()
    assert port.isdigit()
    base='http://127.0.0.1:'+port
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or p.chromium.executable_path)
        context=browser.new_context(viewport={'width':1440,'height':1000})
        context.add_init_script("window.open = () => null")  # Exercise manual login with no external tab.
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
        errors=[]
        context.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e))))
        coach=context.new_page();coach.goto(base)
        coach.locator('#btnLogin').click();coach.locator('#btnFinishLogin').click()
        expect(coach.locator('#appPanel')).to_be_visible()
        coach.locator('#coachAluno').select_option('s1');coach.locator('#coachData').fill('2026-11-23')
        coach.locator('#coachInstructions').fill('Aquecer com cuidado.\nPreservar as unidades.')
        select_saved_workout(coach, base);expect(coach.locator('#previewTreinoAluno')).to_contain_text('2026-11-23')
        workout_id=coach.locator('#coachTreinoId').input_value()
        def fill_exercise():
            coach.locator('#itemExercicio').select_option('exercise-bench');expect(coach.locator('#libraryMethod')).to_be_enabled()
            coach.locator('#libraryMethod').select_option('method-max-effort');coach.locator('#libraryAssessment').select_option(index=1)
            coach.locator('#itemIntensVal').fill('85');coach.locator('#librarySets').fill('5');coach.locator('#itemQtd').fill('3');coach.locator('#itemMin').fill('5')
        fill_exercise();coach.locator('#btnAddItem').click();expect(coach.locator('#savedPrescription')).to_contain_text('15 repetições')
        student=context.new_page()
        def login_student(page,profile='student'):
            page.goto(base+'/student');page.evaluate('(p)=>window.testProfile=p',profile)
            page.locator('#prepareLogin').click();page.locator('#finishLogin').click()
            expect(page.locator('#trainingPanel')).to_be_visible()
        def choose_session():
            student.locator('#days button[data-date="2026-11-23"]').click()
            expect(student.locator('.exercise')).to_have_count(1)
        login_student(student);choose_session()
        expect(student.locator('.metrics')).to_contain_text('5 séries')
        expect(student.locator('.metrics')).to_contain_text('15 repetições no total')
        expect(student.locator('.metrics')).to_contain_text('85% de 1RM')
        expect(student.locator('.exercise-body')).to_contain_text('alvo 85 kg')
        expect(student.locator('.exercise-body')).to_contain_text('Referência individual: 100 kg')
        expect(student.locator('.exercise-body')).to_contain_text('Série 5: 3 repetições')
        print('PASS: trainer creates structured prescription; generated student UI receives sets, units, intensity, individual reference and all series')
        student.locator('.feedback-btn').click();expect(student.locator('#rpeField')).to_be_hidden()
        student.locator('#feedbackStatus').select_option('partial');student.locator('#feedbackPain').fill('2')
        student.locator('#actualSets').fill('4');expect(student.locator('#actualQuantityLabel')).to_have_text('Total executado (repetições)')
        student.locator('#actualQuantity').fill('12');student.locator('#feedbackComment').fill('Retorno fictício com dose executada')
        student.request.post(base+'/test-control',data={'loseNextFeedback':True})
        student.locator('#saveFeedback').click();expect(student.locator('#feedbackError')).not_to_have_text('')
        expect(student.locator('#actualSets')).to_have_value('4');expect(student.locator('#actualQuantity')).to_have_value('12')
        first=student.request.post(base+'/test-tables',data={}).json()
        student.locator('#saveFeedback').click();expect(student.locator('#feedbackDialog')).to_be_hidden()
        after=student.request.post(base+'/test-tables',data={}).json()
        assert len(first['ItemFeedback'])==len(after['ItemFeedback'])==2
        expect(student.locator('.status-label')).to_have_text('Parcial')
        coach.get_by_role('button',name='Atualizar treinos',exact=True).click()
        expect(coach.locator('#listaRetornos')).to_contain_text('Séries/blocos executados: 4')
        expect(coach.locator('#listaRetornos')).to_contain_text('Quantidade executada: 12 repetições')
        expect(coach.locator('#listaRetornos')).to_contain_text('Retorno fictício com dose executada')
        print('PASS: quantitative feedback survives lost response without duplicates and appears to coach')
        login_student(student);choose_session();expect(student.locator('.status-label')).to_have_text('Parcial')
        student.locator('.feedback-btn').click();student.locator('#actualQuantity').fill('10');student.locator('#saveFeedback').click()
        expect(student.locator('#feedbackDialog')).to_be_hidden();expect(student.locator('.saved-note').filter(has_text='Registro')).to_contain_text('Registro 2 salvo')
        coach.get_by_role('button',name='Atualizar treinos',exact=True).click();expect(coach.locator('#listaRetornos')).to_contain_text('Quantidade executada: 10 repetições')
        print('PASS: new login recovers feedback; correction appends revision and coach sees executed dose')
        other=context.new_page();login_student(other,'student-b')
        expect(other.locator('#days button[data-date="2026-11-23"]')).to_have_count(0)
        code=other.evaluate("async(id)=>{try{await StudentAPI.call('getWorkout',{workoutId:id});return 'unexpected';}catch(e){return e.message;}}",workout_id)
        assert code=='NOT_FOUND'
        print('PASS: second student cannot list or fetch another student workout')
        fill_exercise();coach.request.post(base+'/test-control',data={'failTable':'PRESCRICAO_SERIES'})
        coach.locator('#btnAddItem').click();expect(coach.locator('#btnAddItem')).to_have_text('Retomar gravação pendente')
        student.locator('#refreshWorkouts').click();expect(student.locator('.exercise')).to_have_count(1)
        coach.locator('#btnAddItem').click();expect(coach.locator('#itemExercicio')).to_have_value('')
        student.locator('#refreshWorkouts').click();expect(student.locator('.exercise')).to_have_count(2)
        tables=coach.request.post(base+'/test-tables',data={}).json()
        assert len(tables['Items'])==3 and len(tables['PRESCRICOES'])==3 and len(tables['PRESCRICAO_SERIES'])==11
        print('PASS: partially saved exercise stays hidden until same-intent recovery completes all series')
        student.screenshot(path='/tmp/mvp-ciclo-aluno.png',full_page=True)
        coach.get_by_role('button',name='Atualizar treinos',exact=True).click();coach.screenshot(path='/tmp/mvp-ciclo-treinador.png',full_page=True)
        # Reproduce version-14 inconsistent feedback as immutable pre-existing history.
        second_item=tables['Items'][2][0]
        student.request.post(base+'/test-control',data={'seedHistoricalFeedback':{'workoutId':workout_id,'itemId':second_item}})
        original=student.request.post(base+'/test-tables',data={}).json()['ItemFeedback'][-1]
        student.locator('#refreshWorkouts').click()
        card=student.locator('.exercise[data-item-id="'+second_item+'"]')
        expect(card.locator('.status-label')).to_have_text('Não realizado')
        if not card.evaluate('e=>e.open'):card.locator('summary').click()
        card.locator('.feedback-btn').click()
        expect(student.locator('#feedbackStatus')).to_have_value('not_done')
        expect(student.locator('#actualSets')).to_have_value('2');expect(student.locator('#actualQuantity')).to_have_value('2')
        expect(student.locator('#feedbackError')).to_contain_text('devem ser zero')
        requests=[]
        def track_feedback(request):
            if request.url.endswith('/rpc') and request.method=='POST' and request.post_data_json['request']['action']=='submitItemFeedback':requests.append(request.post_data_json)
        student.on('request',track_feedback)
        before=student.request.post(base+'/test-tables',data={}).json()
        student.locator('#saveFeedback').click()
        assert len(requests)==0, 'inconsistent status must be blocked before RPC'
        assert student.request.post(base+'/test-tables',data={}).json()==before
        print('PASS: historical not_done 2/2 stays intact and UI blocks resubmission without clearing inputs')
        student.locator('#feedbackStatus').select_option('partial')
        expect(student.locator('#feedbackError')).to_have_text('')
        student.locator('#saveFeedback').click();expect(student.locator('#feedbackDialog')).to_be_hidden()
        expect(card.locator('.status-label')).to_have_text('Parcial')
        card.locator('.complete-btn').click();expect(student.locator('#confirmDialog')).to_contain_text('não comprova execução integral')
        student.locator('#confirmComplete').click();expect(student.locator('#confirmDialog')).to_be_hidden()
        expect(card.locator('.status-label')).to_have_text('Concluído')
        expect(card).to_contain_text('2 séries/blocos • 2 repetições')
        expect(card).to_contain_text('não equivale à dose integral prescrita')
        coach.get_by_role('button',name='Atualizar treinos',exact=True).click()
        expect(coach.locator('#listaRetornos')).to_contain_text('Conclusão informada; dose integral não presumida.')
        expect(coach.locator('#listaRetornos')).to_contain_text('Quantidade executada: 2 repetições')
        data=student.request.post(base+'/test-tables',data={}).json()
        schema=data['ItemFeedback'][0]
        history=[dict(zip(schema,row)) for row in data['ItemFeedback'][1:] if row[schema.index('itemId')]==second_item]
        assert len(history)==3 and history[-1]['status']=='completed'
        assert history[-1]['actualSets']==history[-1]['actualQuantity']==2
        assert next(row for row in data['ItemFeedback'][1:] if row[0]=='historical-feedback-test')==original
        print('PASS: partial execution remains available; completion appends revision without assuming 5 sets/15 repetitions')
        card.locator('.feedback-btn').click();student.locator('#feedbackStatus').select_option('not_done')
        expect(student.locator('#feedbackError')).to_contain_text('devem ser zero')
        student.locator('#actualSets').fill('0');student.locator('#actualQuantity').fill('0')
        expect(student.locator('#feedbackError')).to_have_text('')
        student.locator('#saveFeedback').click();expect(student.locator('#feedbackDialog')).to_be_hidden()
        expect(card.locator('.status-label')).to_have_text('Não realizado')
        card.locator('.feedback-btn').click();student.locator('#actualSets').fill('');student.locator('#actualQuantity').fill('')
        student.locator('#saveFeedback').click();expect(student.locator('#feedbackDialog')).to_be_hidden()
        data=student.request.post(base+'/test-tables',data={}).json()
        history=[dict(zip(schema,row)) for row in data['ItemFeedback'][1:] if row[schema.index('itemId')]==second_item]
        assert len(history)==5 and history[-2]['actualSets']==history[-2]['actualQuantity']==0
        assert history[-1]['actualSets']==history[-1]['actualQuantity']==''
        assert history[-1]['fingerPain']==3 and history[-1]['comment']=='fadiga'
        assert next(row for row in data['ItemFeedback'][1:] if row[0]=='historical-feedback-test')==original
        print('PASS: not_done accepts zero/absent quantities, preserving pain/comment and all earlier revisions')
        assert not errors,errors
        browser.close();print('PASS: no browser JavaScript errors; no Google services or real data used')
finally:
    server.terminate();server.wait(timeout=10)
