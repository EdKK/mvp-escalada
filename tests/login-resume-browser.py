"""Exercise both production HTML entry points with fictitious Google and a local RPC server."""
from pathlib import Path
import shutil
import subprocess

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]

with subprocess.Popen(
    ['node', 'tests/helpers/coach-browser-server.cjs'],
    cwd=ROOT, stdout=subprocess.PIPE, text=True,
) as server:
    try:
        base = 'http://127.0.0.1:' + server.stdout.readline().strip()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=shutil.which('chromium') or playwright.chromium.executable_path,
                ignore_default_args=['--disable-popup-blocking'],
            )
            for role, path, prepare, link, finish, panel in [
                ('coach', '/', '#btnLogin', '#googleLoginLink', '#btnFinishLogin', '#appPanel'),
                ('student', '/student', '#prepareLogin', '#loginLink', '#finishLogin', '#trainingPanel'),
            ]:
                with browser.new_context() as context:
                    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(
                        base + '/'
                    ) else route.abort())
                    context.route('https://accounts.google.com/**', lambda route: route.fulfill(body='Fictitious Google'))
                    page = context.new_page()
                    page.goto(base + path)
                    page.evaluate('(role) => { window.testProfile = role; }', role)
                    calls = []

                    def rpc(route):
                        action = route.request.post_data_json['request']['action']
                        calls.append(action)
                        if action == 'finishLogin' and calls.count(action) == 1:
                            route.fulfill(json={'ok': True, 'data': {'pending': True}})
                        else:
                            route.continue_()

                    page.route('**/rpc', rpc)
                    if role == 'student':
                        page.locator(prepare).click()
                        expect(page.locator(link)).to_be_visible()
                        assert 'finishLogin' not in calls
                    with page.expect_popup() as popup:
                        page.locator(prepare if role == 'coach' else link).click()
                    expect(popup.value.locator('body')).to_have_text('Fictitious Google')
                    assert popup.value.evaluate('window.opener === null')
                    if role == 'coach':
                        expect(page.locator(link)).to_be_hidden()
                    popup.value.close()
                    page.bring_to_front()
                    # Headless Chromium may keep every tab visible. Exercise the same return
                    # events with explicit dispatch in addition to closing the popup.
                    page.evaluate("""() => {
                        window.dispatchEvent(new Event('focus'));
                        document.dispatchEvent(new Event('visibilitychange'));
                    }""")
                    expect(page.locator(panel)).to_be_visible(timeout=10000)
                    expect(page.locator(finish)).to_be_hidden()
                    assert calls.count('finishLogin') == 2, calls
                    assert calls.count('getSession') == 1, calls
                    print(f'{role}: automatic return, bounded retry and panel initialization passed')
            with browser.new_context() as context:
                shell = base.replace('127.0.0.1', 'localhost') + '/exec?view=coach'
                context.route('**/*', lambda route: route.continue_() if (
                    route.request.url == shell or route.request.url.startswith(base + '/')
                ) else route.abort())
                context.route('https://accounts.google.com/**', lambda route: route.fulfill(body='Fictitious Google'))
                # Model browsers that do not forward return events to the embedded app.
                context.add_init_script("""(() => {
                    if (location.pathname !== '/coach-frame') return;
                    const addWindowListener = window.addEventListener.bind(window);
                    const addDocumentListener = document.addEventListener.bind(document);
                    window.addEventListener = (type, ...args) => {
                        if (type !== 'focus') addWindowListener(type, ...args);
                    };
                    document.addEventListener = (type, ...args) => {
                        if (type !== 'visibilitychange') addDocumentListener(type, ...args);
                    };
                })()""")
                page = context.new_page()
                calls = []
                callback_ready = False
                busy_replies = []

                def coach_rpc(route):
                    action = route.request.post_data_json['request']['action']
                    calls.append(action)
                    if action == 'finishLogin' and not callback_ready:
                        route.fulfill(json={'ok': True, 'data': {'pending': True}})
                    elif action == 'finishLogin' and not busy_replies:
                        busy_replies.append('BUSY')
                        route.fulfill(json={'ok': False, 'error': {'code': 'BUSY'}})
                    else:
                        route.continue_()

                page.route('**/rpc', coach_rpc)
                response = page.goto(shell)
                assert response.ok, response.status
                expect(page.locator('iframe')).to_be_attached()
                coach = page.frame_locator('iframe')
                with page.expect_popup() as popup:
                    coach.get_by_role('button', name='Entrar com Google').click(timeout=8000)
                google = popup.value
                expect(google.locator('body')).to_have_text('Fictitious Google')
                assert google.evaluate('window.opener === null')
                expect(coach.locator('#googleLoginLink')).to_be_hidden()
                google.goto(base + '/test-oauth-return')
                callback_ready = True
                with google.expect_event('close'):
                    google.locator('#return-button').click()
                page.bring_to_front()
                expect(coach.locator('#appPanel')).to_be_visible(timeout=10000)
                expect(coach.locator('#btnFinishLogin')).to_be_hidden()
                assert calls.count('finishLogin') >= 2, calls
                assert busy_replies == ['BUSY']
                assert calls.count('getSession') == 1, calls
                print('coach iframe: automatic completion after return without focus or visibility events, even after BUSY')
            with browser.new_context() as context:
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(
                    base + '/'
                ) else route.abort())
                context.route('https://accounts.google.com/**', lambda route: route.fulfill(body='Fictitious Google'))
                context.add_init_script("window.open = () => null")
                page = context.new_page()
                page.goto(base)
                page.get_by_role('button', name='Entrar com Google').click()
                expect(page.locator('#notice')).to_contain_text('A aba do Google não abriu')
                expect(page.locator('#googleLoginLink')).to_be_visible()
                assert len(context.pages) == 1
                with page.expect_popup() as popup:
                    page.locator('#googleLoginLink').click()
                expect(popup.value.locator('body')).to_have_text('Fictitious Google')
                assert popup.value.evaluate('window.opener === null')
                popup.value.close()
                page.locator('#btnFinishLogin').click()
                expect(page.locator('#appPanel')).to_be_visible()
                print('coach: blocked popup leaves an isolated Google link and manual completion')

            with browser.new_context() as context:
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(
                    base + '/'
                ) else route.abort())
                page = context.new_page()
                auth_calls = []

                def reject_preparation(route):
                    action = route.request.post_data_json['request']['action']
                    auth_calls.append(action)
                    response = (
                        {'ok': False, 'error': {'code': 'BUSY'}}
                        if len(auth_calls) == 1 else
                        {'ok': True, 'data': {'authorizationUrl': 'https://invalid.example/'}}
                    )
                    route.fulfill(json=response)

                page.route('**/rpc', reject_preparation)
                page.goto(base)
                for expected_calls in (1, 2):
                    page.get_by_role('button', name='Entrar com Google').click()
                    expect(page.locator('#notice')).to_contain_text('Não foi possível preparar a entrada')
                    expect(page.locator('#btnLogin')).to_be_enabled()
                    expect(page.locator('#googleLoginLink')).to_be_hidden()
                    expect(page.locator('#btnFinishLogin')).to_be_hidden()
                    assert len(context.pages) == 1
                    assert auth_calls == ['beginLogin'] * expected_calls
                print('coach: failed preparation and invalid OAuth URL clean up the reserved tab')
    finally:
        server.terminate()
