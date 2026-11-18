"""Real local Chromium rendering, with strictly fictitious Google services.
Run: python tests/coach-layout-browser.py
Screenshots: /tmp/mvp-coach-desktop.png and /tmp/mvp-coach-narrow.png.
No network calls to Google, no deployment, no real OAuth or Sheets execution.
"""
from pathlib import Path
import subprocess
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=ROOT, stdout=subprocess.PIPE, text=True)
try:
    port = server.stdout.readline().strip()
    assert port.isdigit(), 'Local test server failed'
    base = 'http://127.0.0.1:' + port
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium') or p.chromium.executable_path)
        page = browser.new_page(viewport={'width': 1600, 'height': 1100})
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
            expect(page.locator('#notice')).to_have_text('Operação concluída.')
        login()
        expect(page.locator('#itemExercicio option')).to_have_count(11)
        assert page.locator('#previewTreinoAluno').evaluate("e=>!!e.closest('#panelCoach')")
        assert page.locator('#listaRetornos').evaluate("e=>!!e.closest('#panelCoach')")
        expect(page.locator('#panelStudent')).to_be_hidden()
        expect(page.locator('#listaRetornos')).to_contain_text('Retorno fictício para consulta')
        print('PASS: coach consultation uses original nodes; student-only panel hidden')
        # Different student/session selection; creation uses existing RPC handler.
        page.locator('#coachAluno').select_option('s2')
        page.locator('#coachData').fill('2026-11-19')
        page.locator('#coachInstructions').fill('Aquecer\nRespeitar intervalos')
        page.locator('#btnCriarTreino').click()
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
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path='/tmp/mvp-coach-desktop.png', full_page=True)
        for width in [1920,1600,1366,1024,768,390]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), f'horizontal overflow {width}'
            assert page.locator('#coachPrescription').bounding_box()['width'] > 250
            assert page.locator('#coachResultsTitle').is_visible()
        page.screenshot(path='/tmp/mvp-coach-narrow.png', full_page=True)
        print('PASS: no horizontal overflow at 1920,1600,1366,1024,768,390 pixels')
        page.set_viewport_size({'width':1600,'height':1100})
        for target in ['coachSession','coachLibrarySection','coachPrescription']:
            page.locator(f'.coach-sidebar a[href="#{target}"]').click()
            assert page.url.endswith('#'+target)
            box=page.locator('#'+target).bounding_box()
            assert -1<=box['y']<900, (target,box)
        print('PASS: sidebar anchors and desktop layout')
        page.request.post(base+'/test-control',data={'delayNext':600,'loseNext':False})
        page.locator('#btnAddItem').click()
        expect(page.locator('#itemQtd')).to_be_disabled()
        expect(page.locator('#btnCriarTreino')).to_be_disabled()
        expect(page.locator('#savedPrescription')).to_contain_text('volume 15 repetições')
        expect(page.locator('#previewTreinoAluno')).to_contain_text('85%')
        expect(page.locator('#listaRetornos')).to_contain_text('Nenhum retorno registrado.')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path='/tmp/mvp-coach-desktop.png', full_page=True)
        print('PASS: in-flight locks; saved prescription and feedback consultation')
        page.locator('#itemQtd').fill('3');page.locator('#itemIntensVal').fill('85')
        page.request.post(base+'/test-control',data={'loseNext':True})
        page.locator('#btnAddItem').click()
        expect(page.locator('#btnAddItem')).to_have_text('Retomar gravação pendente')
        expect(page.locator('#btnAddItem')).to_be_enabled()
        before=page.request.post(base+'/test-tables',data={}).json()
        page.locator('#btnAddItem').click()
        expect(page.locator('#btnAddItem')).to_have_text('Salvar exercício e prescrição')
        expect(page.locator('#btnAddItem')).to_be_enabled()
        after=page.request.post(base+'/test-tables',data={}).json()
        assert len(before['Items'])==len(after['Items']) and len(before['PRESCRICOES'])==len(after['PRESCRICOES'])
        print('PASS: lost-response retry preserves IDs and record counts')
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
        print('PASS: logout/student login restores shared layout; dedicated student files unchanged')
        assert not errors, errors
        browser.close()
        print('PASS: no browser JavaScript errors')
finally:
    server.terminate()
    server.wait(timeout=10)
