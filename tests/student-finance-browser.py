"""Trainer registration and financial history, using only the local fictitious Apps Script."""
from pathlib import Path
import shutil
import subprocess

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]

with subprocess.Popen(
    ['node', 'tests/helpers/coach-browser-server.cjs'], cwd=ROOT, stdout=subprocess.PIPE, text=True
) as server:
    try:
        base = 'http://127.0.0.1:' + server.stdout.readline().strip()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=shutil.which('chromium') or playwright.chromium.executable_path
            )
            with browser.new_context(viewport={'width': 1366, 'height': 900}) as context:
                context.add_init_script('window.open = () => null')
                context.route('**/*', lambda route: route.continue_()
                              if route.request.url.startswith(base + '/') else route.abort())
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(base)
                page.locator('#btnLogin').click()
                page.locator('#btnFinishLogin').click()
                page.locator('#coachTabStudents').click()

                status = page.locator('#financeStatus')
                student = page.locator('#financeStudent')
                expect(student.locator('option')).to_have_count(3)
                student.select_option('s1')
                expect(page.locator('#financeEmail')).to_have_value('one@example.invalid')
                page.get_by_role('button', name='+ Novo aluno').click()
                page.locator('#financeName').fill('Aluna Fictícia')
                page.locator('#financeEmail').fill('aluna.financeira@gmail.com')
                page.locator('#financePhone').fill('+55 (11) 90000-0000')
                page.locator('#financeStart').fill('2026-06-01')
                page.get_by_role('button', name='Salvar cadastro').click()
                expect(status).to_have_text('Cadastro salvo.')
                student_id = student.input_value()
                assert student_id.startswith('student-')
                expect(page.locator('#coachAluno option', has_text='Aluna Fictícia')).to_have_count(1)
                page.locator('#financeName').fill('Aluna Fictícia Editada')
                page.get_by_role('button', name='Salvar cadastro').click()
                expect(status).to_have_text('Cadastro salvo.')
                expect(student).to_have_value(student_id)
                print('PASS: consult, register, edit and integrate the linked student into training')

                page.get_by_role('button', name='Novo plano', exact=True).click()
                page.locator('#financeAmount').fill('880.00')
                page.locator('#financePlanStart').fill('2026-06-01')
                page.get_by_role('button', name='Salvar novo período').click()
                progress = page.locator('#financeProgress')
                expect(progress).to_have_attribute('max', '8')
                expect(page.locator('#financeSummary')).to_contain_text('8 restantes')
                original_plan = page.locator('#financePeriod').input_value()

                page.locator('#financeLessonDate').fill('2026-06-02')
                page.get_by_role('button', name='Registrar aula').click()
                expect(status).to_have_text('Aula registrada.')
                expect(progress).to_have_js_property('value', 1)
                lesson = page.locator('#financeLessons input')
                lesson.fill('2026-06-03')
                page.get_by_role('button', name='Corrigir data').click()
                expect(status).to_have_text('Data corrigida.')
                expect(lesson).to_have_value('2026-06-03')

                page.locator('#financePayment').select_option('paid')
                page.locator('#financePaidDate').fill('2026-06-01')
                page.get_by_role('button', name='Salvar pagamento').click()
                expect(status).to_have_text('Pagamento atualizado.')
                expect(page.locator('#financePeriod option:checked')).to_contain_text('Pago em 01/06/2026')
                print('PASS: package progress, corrected attendance and payment')

                page.get_by_role('button', name='Mudar modalidade / novo plano').click()
                page.locator('#financeMode').select_option('monthly')
                page.locator('#financeAmount').fill('250')
                page.locator('#financePlanStart').fill('2026-07-01')
                page.locator('#financeDue').fill('2026-08-01')
                page.get_by_role('button', name='Salvar novo período').click()
                expect(page.locator('#financeSummary')).to_contain_text('Vencimento em 01/08/2026')
                expect(progress).to_be_hidden()
                page.get_by_role('button', name='Renovar plano').click()
                expect(page.locator('#financeMode')).to_have_value('monthly')
                expect(page.locator('#financeAmount')).to_have_value('250.00')
                page.locator('#financePlanStart').fill('2026-08-01')
                page.locator('#financeDue').fill('2026-09-01')
                page.get_by_role('button', name='Salvar novo período').click()
                expect(page.locator('#financePeriod option')).to_have_count(3)
                page.locator('#financePeriod').select_option(original_plan)
                expect(lesson).to_have_value('2026-06-03')
                expect(page.locator('#financePayment')).to_have_value('paid')
                page.get_by_role('button', name='Cancelar aula').click()
                expect(page.locator('#financeLessons')).to_contain_text('Registro cancelado')
                expect(progress).to_have_js_property('value', 0)
                page.set_viewport_size({'width': 390, 'height': 900})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
                print('PASS: mode change, renewal, history, canceled attendance and mobile sizing')

                page.locator('#btnLogout').click()
                expect(page.locator('#loginPanel')).to_be_visible()
                for field in ('financeName', 'financeEmail', 'financeAmount', 'financePaidDate'):
                    expect(page.locator('#'+field)).to_have_value('')
                page.reload()
                page.locator('#btnLogin').click()
                page.locator('#btnFinishLogin').click()
                expect(page.locator('#coachAluno option', has_text='Aluna Fictícia Editada')).to_have_count(1)
                page.locator('#coachTabStudents').click()
                student.select_option(student_id)
                expect(page.locator('#financePeriod option')).to_have_count(3)
                assert not errors, errors
                print('PASS: persisted records and named training selection after reload')
    finally:
        server.terminate()
