"""Real local Chromium rendering, with strictly fictitious Google services.
Run: python tests/coach-layout-browser.py
Screenshots: /tmp/mvp-fluxo-desktop.png and /tmp/mvp-fluxo-narrow.png.
No network calls to Google, no deployment, no real OAuth or Sheets execution.
"""
from pathlib import Path
import subprocess
import shutil
from playwright.sync_api import sync_playwright, expect
from helpers.saved_workout import select_saved_workout

ROOT = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=ROOT, stdout=subprocess.PIPE, text=True)
try:
    port = server.stdout.readline().strip()
    assert port.isdigit(), 'Local test server failed'
    base = 'http://127.0.0.1:' + port
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium') or p.chromium.executable_path)
        page = browser.new_page(viewport={'width': 1600, 'height': 1100})
        page.add_init_script("window.open = () => null")  # Exercise manual login with no external tab.
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        # Abort unexpected external requests: only the local fictitious backend is usable.
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
        page.goto(base)
        def login(profile='coach'):
            page.evaluate('(profile)=>window.testProfile=profile', profile)
            page.locator('#btnLogin').click()
            expect(page.locator('#btnFinishLogin')).to_be_enabled()
            page.locator('#btnFinishLogin').click()
            expect(page.locator('#appPanel')).to_be_visible()
            expect(page.locator('#notice')).to_have_text('Entrada concluída.')
        login()
        expect(page.locator('#itemExercicio option')).to_have_count(11)
        assert page.locator('#previewTreinoAluno').evaluate("e=>!!e.closest('#panelCoach')")
        assert page.locator('#listaRetornos').evaluate("e=>!!e.closest('#panelCoach')")
        expect(page.locator('#panelStudent')).to_be_hidden()
        expect(page.locator('#listaRetornos')).to_contain_text('Retorno fictício para consulta')
        print('PASS: coach consultation uses original nodes; student-only panel hidden')
        # Select a saved session to exercise legacy consultation and item writes.
        page.locator('#coachAluno').select_option('s2')
        page.locator('#coachData').fill('2026-11-19')
        page.locator('#coachInstructions').fill('Aquecer\nRespeitar intervalos')
        select_saved_workout(page, base)
        expect(page.locator('#previewTreinoAluno')).to_contain_text('2026-11-19')
        expect(page.locator('#coachAluno')).to_have_value('s2')
        page.locator('#itemExercicio').select_option('exercise-bench')
        expect(page.locator('#libraryAssessment option')).to_have_count(2)
        page.locator('#libraryMethod').select_option('method-max-effort')
        page.locator('#libraryAssessment').select_option(index=1)
        page.locator('#itemIntensVal').fill('85')
        page.locator('#librarySets').fill('5')
        page.locator('#itemQtd').fill('3')
        page.locator('#itemMin').fill('5')
        print('PASS: student/session selection and creation; exercise/reference loading')
        writes=[]
        def track_write(request):
            if request.url.endswith('/rpc') and request.method=='POST' and request.post_data_json['request']['action']=='saveCoachPrescription':writes.append(request.post_data_json)
        page.on('request',track_write)
        tables_before=page.request.post(base+'/test-tables',data={}).json()
        counter_before=page.locator('#coachNextExercise').inner_text()
        page.locator('#libraryMethod').select_option('')
        page.locator('#btnAddItem').click()
        expect(page.locator('#librarySaveHint')).to_contain_text('Selecione um método compatível')
        expect(page.locator('#librarySaveHint')).to_have_attribute('data-kind','validation')
        expect(page.locator('#libraryMethod')).to_be_focused()
        expect(page.locator('#libraryMethod')).to_have_attribute('aria-invalid','true')
        expect(page.locator('label[for="libraryMethod"]')).to_contain_text('obrigatório')
        page.locator('#libraryMethod').select_option('method-max-effort')
        page.locator('#libraryAssessment').select_option('')
        page.locator('#btnAddItem').click()
        expect(page.locator('#librarySaveHint')).to_contain_text('avaliação individual válida')
        expect(page.locator('#libraryAssessment')).to_be_focused()
        page.locator('#libraryAssessment').select_option(index=1)
        page.locator('#itemIntensVal').fill('')
        page.locator('#btnAddItem').click()
        expect(page.locator('#librarySaveHint')).to_contain_text('percentual da referência individual')
        expect(page.locator('#itemIntensVal')).to_be_focused()
        page.locator('#itemIntensVal').fill('85')
        page.locator('#itemMin').fill('')
        page.locator('#btnAddItem').click()
        expect(page.locator('#itemMin')).to_be_focused()
        expect(page.locator('#coachNextExercise')).to_have_text(counter_before)
        assert not writes
        assert page.request.post(base+'/test-tables',data={}).json()==tables_before
        page.locator('#itemMin').fill('5')
        print('PASS: inline fill errors, first-invalid focus/highlight, relative assessment/percent guidance and zero writes/count changes')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path='/tmp/mvp-fluxo-desktop.png', full_page=True)
        for width in [1920,1600,1366,1024,768,390]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), f'horizontal overflow {width}'
            assert page.locator('#coachPrescription').bounding_box()['width'] > 250
            assert page.locator('#coachResultsTitle').is_visible()
        page.screenshot(path='/tmp/mvp-fluxo-narrow.png', full_page=True)
        print('PASS: no horizontal overflow at 1920,1600,1366,1024,768,390 pixels')
        page.set_viewport_size({'width':1600,'height':1100})
        draft_ids=['coachAluno','coachTreinoId','itemExercicio','libraryMethod','libraryAssessment','itemQtd','itemIntensVal','librarySets','itemMin']
        values={id:page.locator('#'+id).input_value() for id in draft_ids}
        page.evaluate("window.originalPrescription=document.getElementById('coachPrescription')")
        initial_url=page.url
        for button,panel,title in [('coachTabStudents','coachStudentsPanel','Alunos'),('coachTabLibrary','coachLibraryPanel','Biblioteca')]:
            page.locator('#'+button).click()
            expect(page.locator('#'+panel)).to_be_visible()
            expect(page.locator('#coachBuildPanel')).to_be_hidden()
            expect(page.locator('#'+button)).to_have_attribute('aria-selected','true')
            is_library=panel=='coachLibraryPanel'
            card_selector='#libraryOverview .library-overview-card' if is_library else '.students-card'
            prefix='#'+panel
            cards=page.locator(prefix+' '+card_selector)
            expect(cards).to_have_count(6 if is_library else 4)
            if is_library:
                titles=['Treinamento geral','Treinamento direcionado','Treinamento específico',
                        'Modelos de sessões','Mídias e orientações','Modelos de planejamento']
                expect(cards.locator('.library-overview-card-title')).to_have_text(titles)
                before_navigation=page.request.post(base+'/test-tables',data={}).json()
                library_width=page.locator('#libraryOverview').bounding_box()['width']
                expect(page.locator('#sessionModelsBrowser')).to_be_hidden()
                for index,title in enumerate(titles):
                    card=page.get_by_role('button',name=title,exact=True)
                    icon_id=card.locator('svg > g').get_attribute('id')
                    card.focus()
                    card.press('Enter' if index%2==0 else 'Space')
                    expect(page.locator('#libraryOverview')).to_be_hidden()
                    expect(page.locator('#libraryPageTitle')).to_have_text(title)
                    expect(page.locator('#libraryPageTitle')).to_be_focused()
                    expect(page.locator('#libraryPageIcon')).to_have_attribute('href','#'+icon_id)
                    assert page.locator('#libraryPageIcon').evaluate('icon=>icon.getBBox().width')>0
                    expect(page.locator('#coachTabLibrary')).to_be_visible()
                    if title=='Modelos de sessões':
                        expect(page.locator('#sessionModelSearch')).to_be_visible()
                        assert page.locator('#sessionModelsBrowser').bounding_box()['width']>0.9*library_width
                    elif title=='Treinamento geral':
                        expect(page.locator('#generalTrainingAreas button')).to_have_count(6)
                        expect(page.locator('#sessionModelsBrowser')).to_be_hidden()
                        expect(page.locator('#libraryPageFuture')).to_be_hidden()
                    else:
                        expect(page.locator('#libraryPageFuture')).to_be_visible()
                        expect(page.locator('#sessionModelsBrowser')).to_be_hidden()
                        expect(page.locator('#libraryPage button:visible')).to_have_count(1)
                    page.get_by_role('button',name='Voltar à Biblioteca').click()
                    expect(card).to_be_focused()
                # A click near the bottom edge hits the same native button.
                cards.first.click(position={'x':20,'y':130})
                expect(page.locator('#libraryPageTitle')).to_have_text(titles[0])
                page.locator('#libraryBack').click()
                assert page.request.post(base+'/test-tables',data={}).json()==before_navigation
            else:
                static_cards=prefix+' '+card_selector+':not([aria-labelledby="studentsRegistrationTitle"])'
                expect(page.locator('#financeStudent option')).to_have_count(3)
                expect(page.locator(', '.join(static_cards+' '+tag for tag in ('input','select','button','textarea','a')))).to_have_count(0)
                expect(page.locator(prefix+' table tbody tr')).to_have_count(4)
            boxes=[c.bounding_box() for c in cards.all()]
            columns=3 if is_library else 2
            for index in [0,columns]:
                row=boxes[index:index+columns]
                assert all(abs(box['y']-row[0]['y'])<1 for box in row)
                assert all(a['x']<b['x'] for a,b in zip(row,row[1:]))
            assert boxes[columns]['y']>boxes[0]['y']
            if is_library:
                assert len({box['height'] for box in boxes})==1
                assert max(box['width'] for box in boxes)-min(box['width'] for box in boxes)<1
            page.evaluate('window.scrollTo(0,0)')
            screenshot='biblioteca' if is_library else 'alunos'
            page.screenshot(path='/tmp/mvp-layout-'+screenshot+'.png',full_page=True)
            for width in [1366,1024,900,390]:
                page.set_viewport_size({'width':width,'height':1000})
                assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), f'{screenshot} overflow {width}'
                if is_library:
                    columns=cards.evaluate_all("""cards=>cards.filter(card=>card.offsetTop===cards[0].offsetTop).length""")
                    assert columns==(3 if width>=1024 else 2 if width>=640 else 1)
            page.screenshot(path='/tmp/mvp-layout-'+screenshot+'-estreito.png',full_page=True)
            page.set_viewport_size({'width':1600,'height':1100})
            assert page.url==initial_url
        page.locator('#coachTabBuild').click()
        expect(page.locator('#coachBuildPanel')).to_be_visible()
        assert page.evaluate("window.originalPrescription===document.getElementById('coachPrescription')")
        assert all(page.locator('#'+id).input_value()==value for id,value in values.items())
        page.locator('#coachTabBuild').focus();page.keyboard.press('Home')
        expect(page.locator('#coachTabStudents')).to_be_focused()
        expect(page.locator('#coachStudentsPanel')).to_be_visible()
        page.keyboard.press('End')
        expect(page.locator('#coachBuildPanel')).to_be_visible()
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path='/tmp/mvp-navegacao-treinador.png',full_page=True)
        print('PASS: Library card navigation and focus, responsive equal-size cards, and preserved unsaved draft, tables and URL')
        def contrast(colors):
            import re
            def lum(value):
                channels=[int(n)/255 for n in re.findall(r'\d+',value)[:3]]
                return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip([.2126,.7152,.0722],channels))
            a,b=sorted([lum(colors['color']),lum(colors['background'])]);return (b+.05)/(a+.05)
        colors=page.locator('#coachMicrocycleType option').evaluate_all('(options)=>options.map(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}))')
        assert all(contrast(c)>=4.5 for c in colors)
        page.locator('#coachMicrocycleType option').nth(1).evaluate('e=>e.disabled=true')
        disabled=page.locator('#coachMicrocycleType option').nth(1).evaluate('e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor})')
        assert contrast(disabled)>=4.5
        page.locator('#coachMicrocycleType option').nth(1).evaluate('e=>e.disabled=false')
        print('PASS: desktop layout, normal/selected/disabled option contrast >=4.5:1')
        page.request.post(base+'/test-control',data={'delayNext':600,'loseNext':False})
        page.locator('#btnAddItem').click()
        expect(page.locator('#itemQtd')).to_be_disabled()
        expect(page.locator('#btnCriarTreino')).to_be_disabled()
        expect(page.locator('#savedPrescription')).to_contain_text('volume 15 repetições')
        expect(page.locator('#librarySaveHint')).to_have_attribute('data-kind','success')
        expect(page.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 2')
        expect(page.locator('#previewTreinoAluno')).to_contain_text('85%')
        expect(page.locator('#listaRetornos')).to_contain_text('Nenhum retorno registrado.')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path='/tmp/mvp-fluxo-desktop.png', full_page=True)
        print('PASS: in-flight locks; saved prescription and feedback consultation')
        session_id=page.locator('#coachTreinoId').input_value()
        def fill_next():
            page.locator('#itemExercicio').select_option('exercise-bench')
            expect(page.locator('#libraryMethod')).to_be_enabled()
            page.locator('#libraryMethod').select_option('method-max-effort')
            page.locator('#libraryAssessment').select_option(index=1)
            page.locator('#itemQtd').fill('3');page.locator('#itemIntensVal').fill('85')
            page.locator('#librarySets').fill('5');page.locator('#itemMin').fill('5')
        expect(page.locator('#itemExercicio')).to_have_value('')
        expect(page.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 2')
        fill_next()
        page.request.post(base+'/test-control',data={'loseNext':True})
        page.locator('#btnAddItem').click()
        expect(page.locator('#btnAddItem')).to_have_text('Retomar gravação pendente')
        expect(page.locator('#librarySaveHint')).to_contain_text('Falha de comunicação')
        expect(page.locator('#librarySaveHint')).to_have_attribute('data-kind','error')
        expect(page.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 2')
        expect(page.locator('#btnAddItem')).to_be_enabled()
        expect(page.locator('#itemQtd')).to_have_value('3')
        expect(page.locator('#itemIntensVal')).to_have_value('85')
        expect(page.locator('#itemExercicio')).to_have_value('exercise-bench')
        page.locator('#coachTabLibrary').click();expect(page.locator('#coachLibraryPanel')).to_be_visible()
        page.locator('#coachTabBuild').click();expect(page.locator('#itemQtd')).to_have_value('3')
        before=page.request.post(base+'/test-tables',data={}).json()
        page.locator('#btnAddItem').click()
        expect(page.locator('#btnAddItem')).to_have_text('Salvar e adicionar próximo exercício')
        expect(page.locator('#itemExercicio')).to_be_enabled()
        expect(page.locator('#itemExercicio')).to_have_value('')
        after=page.request.post(base+'/test-tables',data={}).json()
        assert len(before['Items'])==len(after['Items']) and len(before['PRESCRICOES'])==len(after['PRESCRICOES'])
        print('PASS: lost-response retry preserves IDs and record counts')
        page.locator('#itemNotas').fill('Parâmetros ainda não salvos')
        page.locator('#btnReviewSession').click()
        expect(page.locator('#coachFinishStatus')).to_contain_text('parâmetros ainda não salvos')
        expect(page.locator('#itemNotas')).to_have_value('Parâmetros ainda não salvos')
        fill_next();page.locator('#itemNotas').fill('Terceiro exercício fictício');page.locator('#btnAddItem').click()
        expect(page.locator('#coachNextExercise')).to_contain_text('Próximo: Exercício 4')
        expect(page.locator('#coachTreinoId')).to_have_value(session_id)
        expect(page.locator('#coachAluno')).to_have_value('s2')
        expect(page.locator('.coach-exercise h3')).to_have_text(['Exercício 1 — Supino','Exercício 2 — Supino','Exercício 3 — Supino'])
        before=page.request.post(base+'/test-tables',data={}).json()
        page.locator('#btnReviewSession').click()
        expect(page.locator('#coachFinishStatus')).to_contain_text('3 exercício(s) gravado(s)')
        page.locator('#btnConfirmSession').click()
        expect(page.locator('#coachFinishStatus')).to_contain_text('Montagem concluída visualmente')
        after=page.request.post(base+'/test-tables',data={}).json()
        assert before==after, 'Finalization must not write any table'
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path='/tmp/mvp-fluxo-finalizado.png',full_page=True)
        print('PASS: three progressive items, sequential numbering, dirty-draft warning, finalization with zero writes')
        page.locator('#itemExercicio').select_option('exercise-boulder')
        expect(page.locator('#blocksField')).to_be_visible();expect(page.locator('#gradeField')).to_be_visible();expect(page.locator('#assessmentField')).to_be_hidden()
        page.locator('#itemExercicio').select_option('exercise-finger-iso')
        expect(page.locator('#suspensionsField')).to_be_visible();expect(page.locator('#blocksField')).to_be_hidden()
        print('PASS: conditional fields by exercise/volume')
        page.locator('#btnLogout').click()
        expect(page.locator('#loginPanel')).to_be_visible()
        login('student')
        expect(page.locator('#panelCoach')).to_be_hidden();expect(page.locator('#panelStudent')).to_be_visible()
        assert page.locator('#previewTreinoAluno').evaluate("e=>!!e.closest('#panelStudent')")
        assert page.locator('#listaRetornos').evaluate("e=>!!e.closest('#panelStudent')")
        assert not page.locator('#appPanel').evaluate("e=>e.classList.contains('coach-layout-active')")
        print('PASS: logout/student login restores shared layout')
        page.reload()
        expect(page.locator('#loginPanel')).to_be_visible()
        expect(page.locator('#appPanel')).to_be_hidden()
        print('PASS: reload still requires login; no unsafe token persistence introduced')
        assert not errors, errors
        browser.close()
        print('PASS: no browser JavaScript errors')
finally:
    server.terminate()
    server.wait(timeout=10)
