"""Anthropometry flows in Chromium with fictitious OAuth and Sheets."""
from pathlib import Path
import shutil
import subprocess

from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/helpers/coach-browser-server.cjs'], cwd=root,
                          stdout=subprocess.PIPE, text=True)
try:
    base = 'http://127.0.0.1:' + server.stdout.readline().strip()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which('chromium') or playwright.chromium.executable_path)
        coach = browser.new_page(viewport={'width': 1440, 'height': 900})
        student = browser.new_page(viewport={'width': 390, 'height': 900})
        errors = []
        for page in (coach, student):
            page.set_default_timeout(10000)
            page.add_init_script('window.open = () => null')
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page.on('pageerror', lambda error: errors.append(str(error)))

        def coach_login():
            coach.locator('#btnLogin').click()
            coach.locator('#btnFinishLogin').click()
            coach.locator('#coachTabStudents').click()
            coach.locator('#financeStudent').select_option('s1')
            expect(coach.locator('#avaContent')).to_be_visible()

        def state():
            return coach.request.post(base + '/test-tables', data={}).json()

        def lose_confirmation():
            coach.request.post(base + '/test-control', data={'loseNextAssessment': True})

        def fill_measure(day, **values):
            coach.locator('#avaDate').fill(day)
            for key, value in values.items():
                coach.locator('#ava-' + key).fill(value)

        coach.goto(base)
        coach_login()
        original = state()
        expect(coach.locator('#avaMass')).to_have_text('Massa corporal ainda sem registro')
        expect(coach.locator('#avaFigure')).to_be_hidden()

        fill_measure('2025-02-01', height='170', mass='62')
        lose_confirmation()
        coach.locator('#avaSave').click()
        expect(coach.locator('#avaStatus')).to_contain_text('Gravação sem confirmação')
        assert len(state()['REGISTROS_AVALIACAO']) == 3
        coach.reload()
        coach_login()
        expect(coach.locator('#avaMass')).to_contain_text('62 kg')
        fill_measure('2025-02-01', height='170', mass='62')
        coach.locator('#avaSave').click()
        expect(coach.locator('#avaStatus')).to_contain_text('Avaliação atualizada')
        assert len(state()['REGISTROS_AVALIACAO']) == 3

        fill_measure('2025-02-02', span='175')
        coach.locator('#avaSave').click()
        expect(coach.locator('#avaCurrent')).to_contain_text('5 cm')
        expect(coach.locator('#avaDue')).to_contain_text('mais de 30 dias')
        coach.locator('#avaContent summary').click()
        height = coach.locator('#avaHistory li').filter(has_text='Estatura ·')
        height.get_by_role('button', name='Corrigir').click()
        coach.locator('#ava-height').fill('171')
        coach.locator('#avaSave').click()
        expect(coach.locator('#avaCurrent')).to_contain_text('4 cm')
        expect(height.filter(has=coach.get_by_text('Estatura · 01/02/2025 · 170 cm', exact=True))).to_contain_text('Invalidado')
        expect(coach.locator('#avaHistory')).to_contain_text('Substitui 170 cm')

        def student_login():
            student.evaluate("window.testProfile = 'student'")
            student.locator('#prepareLogin').click()
            student.locator('#finishLogin').click()
            expect(student.locator('#selfMassForm')).to_be_visible()

        def fill_self_report():
            student.locator('#selfMassValue').fill('63.5')
            student.locator('#selfMassDate').fill('2025-02-05')

        student.goto(base + '/student')
        student_login()
        fill_self_report()
        lose_confirmation()
        student.locator('#selfMassSave').click()
        expect(student.locator('#selfMassStatus')).to_contain_text('Envio sem confirmação')
        student.reload()
        student_login()
        fill_self_report()
        student.locator('#selfMassSave').click()
        expect(student.locator('#selfMassStatus')).to_have_text('Autorrelato registrado.')

        coach.locator('#avaRefresh').click()
        expect(coach.locator('#avaMass')).to_contain_text('63,5 kg')
        expect(coach.locator('#avaMassChange')).to_contain_text('+1,5 kg (+2,42%)')
        expect(coach.locator('#avaFigure')).to_be_visible()
        report = coach.locator('#avaHistory li').filter(has_text='Autorrelato')
        expect(report).to_contain_text('05/02/2025 · 63,5 kg')
        expect(report.get_by_role('button', name='Corrigir')).to_have_count(0)
        report.get_by_role('button', name='Invalidar').click()
        coach.locator('#avaNotes').fill('Aluno informou erro de digitação')
        coach.locator('#avaSave').click()
        expect(coach.locator('#avaMass')).to_contain_text('62 kg')

        coach.locator('#financeStudent').select_option('s2')
        expect(coach.locator('#avaMass')).to_have_text('Massa corporal ainda sem registro')
        assert len(state()['REGISTROS_AVALIACAO']) == 7
        for table, rows in original.items():
            if table not in ('CATALOGO_AVALIACAO', 'REGISTROS_AVALIACAO'):
                assert state()[table] == rows, table
        assert not errors, errors
        browser.close()
    print('PASS AVA-01A Chromium: partial save, lost confirmation/reload, correction, self-report, chart, invalidation and isolation.')
finally:
    server.terminate()
    server.wait(timeout=10)
