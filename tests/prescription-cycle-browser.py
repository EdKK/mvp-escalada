"""Real browser, generated Student.html and trainer UI; Google/Sheets/OAuth mocked locally.
Run from repository root: python tests/prescription-cycle-browser.py
No production access. Screenshot outputs are under /tmp only.
"""
from pathlib import Path
import subprocess
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','tests/helpers/coach-browser-server.cjs'],cwd=ROOT,stdout=subprocess.PIPE,text=True)
try:
    port=server.stdout.readline().strip()
    assert port.isdigit()
    base='http://127.0.0.1:'+port
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or p.chromium.executable_path)
        context=browser.new_context(viewport={'width':1440,'height':1000})
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
        errors=[]
        context.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e))))
        coach=context.new_page();coach.goto(base)
        coach.locator('#btnLogin').click();coach.locator('#btnFinishLogin').click()
        expect(coach.locator('#appPanel')).to_be_visible()
        coach.locator('#coachAluno').select_option('s1');coach.locator('#coachData').fill('2026-11-23')
        coach.locator('#coachInstructions').fill('Aquecer com cuidado.\nPreservar as unidades.')
        coach.locator('#btnCriarTreino').click();expect(coach.locator('#previewTreinoAluno')).to_contain_text('2026-11-23')
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
        expect(student.locator('#feedbackDialog')).to_be_hidden();expect(student.locator('.saved-note')).to_contain_text('Registro 2 salvo')
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
        assert not errors,errors
        browser.close();print('PASS: no browser JavaScript errors; no Google services or real data used')
finally:
    server.terminate();server.wait(timeout=10)
