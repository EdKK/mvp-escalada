"""Real Chromium for specific tasks; all Google services and identities are fictitious."""
from pathlib import Path
import subprocess,shutil
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','tests/helpers/coach-browser-server.cjs'],cwd=ROOT,stdout=subprocess.PIPE,text=True)
try:
    port=server.stdout.readline().strip();assert port.isdigit();base='http://127.0.0.1:'+port
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or p.chromium.executable_path)
        context=browser.new_context(viewport={'width':1600,'height':1100})
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
        errors=[];context.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e))))
        coach=context.new_page();coach.goto(base);coach.locator('#btnLogin').click();coach.locator('#btnFinishLogin').click();expect(coach.locator('#appPanel')).to_be_visible()
        expect(coach.locator('#libraryClassification option')).to_have_text(['Treinamento geral','Treinamento direcionado','Treinamento específico'])
        expect(coach.locator('#coachMicrocycleType option')).to_have_text(['Introdutório','Ordinário','Choque','Estabilizador','Manutenção','Recuperativo','Controle','Pré-competitivo','Competitivo'])
        coach.locator('#coachMicrocycleType').select_option('Choque')
        coach.locator('#coachAluno').select_option('s1');coach.locator('#coachData').fill('2026-11-24');coach.locator('#btnCriarTreino').click();expect(coach.locator('#previewTreinoAluno')).to_contain_text('2026-11-24');session=coach.locator('#coachTreinoId').input_value()
        before=coach.request.post(base+'/test-tables',data={}).json()
        coach.locator('#libraryClassification').select_option('specific');expect(coach.locator('#libraryPanel')).to_be_hidden()
        for sub in ['boulder_short','boulder_long','resistance_short','resistance_long','continuity']:
            coach.locator('#specificSubblock').select_option(sub);expect(coach.locator('#libraryPanel')).to_be_hidden()
            for removed in ['coachLibrarySection','itemExercicio','itemMetrica','libraryCapacity','libraryMethod','libraryProtocol','legacyVolumeGroup','itemQtd','itemMin','volumeDistribution']:
                expect(coach.locator('#'+removed)).to_be_hidden()
            for kept in ['itemNotas','btnAddItem','specificGrade','specificSets','specificRepetitions','specificRestSeconds','specificRestSets']:
                expect(coach.locator('#'+kept)).to_be_visible()
        assert coach.locator('#specificRestSets option').evaluate_all('(options) => options.map(o => o.value)')==['','60','120','180','300','600','900']
        assert coach.request.post(base+'/test-tables',data={}).json()==before
        coach.locator('#specificSubblock').select_option('boulder_short');expect(coach.locator('#specificTaskFeatures')).to_be_visible()
        expect(coach.locator('#specificGrade option')).to_have_count(17)
        coach.locator('#specificGrade').select_option('V4');coach.locator('#specificSubblock').select_option('resistance_short')
        expect(coach.locator('#specificGrade')).to_have_value('');expect(coach.locator('#specificGrade option')).to_have_count(25)
        coach.locator('#specificSubblock').select_option('boulder_short');coach.locator('#specificGrade').select_option('V4')
        coach.locator('#specificOrientation').select_option('horizontal');coach.locator('#specificInclination').select_option('0_15');coach.locator('#specificRestSeconds').fill('90')
        coach.locator('#specificSets').fill('2');coach.locator('#specificRepetitions').fill('0');coach.locator('#specificRestSets').select_option('300');coach.locator('#btnAddItem').click()
        expect(coach.locator('#specificRepetitions')).to_be_focused();expect(coach.locator('#librarySaveHint')).to_contain_text('entre 1 e 100')
        assert coach.request.post(base+'/test-tables',data={}).json()==before
        coach.locator('#specificRepetitions').fill('3');coach.locator('#btnAddItem').click();expect(coach.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 2')
        expect(coach.locator('#previewTreinoAluno')).to_contain_text('Horizontal — travessia');expect(coach.locator('#previewTreinoAluno')).to_contain_text('recuperação entre repetições: 90 s')
        print('PASS: five subblocks navigate without method/capacity; grade scales never convert; invalid repetition count cannot write; short task persists')
        coach.locator('#specificSubblock').select_option('resistance_short');expect(coach.locator('#specificTaskFeatures')).to_be_visible()
        coach.locator('#specificGrade').select_option('7a');coach.locator('#specificOrientation').select_option('vertical');coach.locator('#specificInclination').select_option('over_45');coach.locator('#specificRestSeconds').fill('0')
        coach.locator('#specificSets').fill('1');coach.locator('#specificRepetitions').fill('2');coach.locator('#btnAddItem').click();expect(coach.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 3')
        coach.locator('#specificSubblock').select_option('continuity');expect(coach.locator('#specificTaskFeatures')).to_be_visible()
        coach.locator('#specificSets').fill('1');coach.locator('#specificRepetitions').fill('2');coach.locator('#btnAddItem').click();expect(coach.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 4');expect(coach.locator('#coachTreinoId')).to_have_value(session)
        tables=coach.request.post(base+'/test-tables',data={}).json();assert len(tables['Items'])==4 and len(tables['PRESCRICOES'])==4
        print('PASS: Brazilian resistance task and continuity with optional characteristics save progressively in the same session')
        student=context.new_page();student.goto(base+'/student');student.evaluate("window.testProfile='student'");student.locator('#prepareLogin').click();student.locator('#finishLogin').click();expect(student.locator('#trainingPanel')).to_be_visible();student.locator('#days button[data-date="2026-11-24"]').click();expect(student.locator('.exercise')).to_have_count(3)
        expect(student.locator('#dayGoalLabel')).to_have_text('Tipo de microciclo');expect(student.locator('#dayGoal')).to_have_text('Choque')
        cards=student.locator('.exercise');first=cards.nth(0)
        if not first.evaluate('e=>e.open'):first.locator('summary').click()
        expect(first).to_contain_text('Boulder curto');expect(first).to_contain_text('V4 (Hueco)');expect(first).to_contain_text('Horizontal — travessia');expect(first).to_contain_text('0°–15°');expect(first).to_contain_text('90 s');expect(first).to_contain_text('rebotear');expect(first).to_contain_text('Recuperação entre séries: 5 min');expect(first).to_contain_text('3 por série')
        second=cards.nth(1)
        if not second.evaluate('e=>e.open'):second.locator('summary').click()
        expect(second).to_contain_text('Resistência curta');expect(second).to_contain_text('7a (Brasileira)');expect(second).to_contain_text('Acima de 45°');expect(second).to_contain_text('0 s')
        third=cards.nth(2)
        if not third.evaluate('e=>e.open'):third.locator('summary').click()
        expect(third).to_contain_text('Continuidade');expect(third.locator('.metrics')).to_contain_text('Não informada')
        second.locator('.feedback-btn').click();student.locator('#feedbackStatus').select_option('partial');student.locator('#feedbackPain').fill('1');student.locator('#actualSets').fill('1');student.locator('#actualQuantity').fill('2');student.locator('#saveFeedback').click();expect(student.locator('#feedbackDialog')).to_be_hidden()
        coach.get_by_role('button',name='Atualizar treinos',exact=True).click();expect(coach.locator('#listaRetornos')).to_contain_text('Quantidade executada: 2 repetições');expect(coach.locator('#previewTreinoAluno')).to_contain_text('Resistência curta')
        print('PASS: student receives task characteristics, grade/rest and definitions; partial feedback returns to coach without reclassifying the task')
        for width in [1600,1024,390]:
            coach.set_viewport_size({'width':width,'height':1000});assert coach.evaluate('document.documentElement.scrollWidth<=innerWidth')
        coach.set_viewport_size({'width':1600,'height':1100});coach.evaluate('scrollTo(0,0)');coach.screenshot(path='/tmp/mvp-especifico-treinador.png',full_page=True);student.screenshot(path='/tmp/mvp-especifico-aluno.png',full_page=True)
        for value in ['directed','general']:
            coach.locator('#libraryClassification').select_option(value);expect(coach.locator('#legacyBlockContext')).to_be_visible();expect(coach.locator('#specificSubblockPanel')).to_be_hidden();expect(coach.locator('#itemExercicio option')).to_have_count(11);expect(coach.locator('#libraryMethod')).to_be_visible()
        assert not errors,errors;browser.close();print('PASS: desktop/narrow layouts and legacy block controls remain usable; no JavaScript errors or real Google services')
finally:
    server.terminate();server.wait(timeout=10)
