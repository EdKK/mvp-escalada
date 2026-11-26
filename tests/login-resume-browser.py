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
                executable_path=shutil.which('chromium') or playwright.chromium.executable_path
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
                    page.locator(prepare).click()
                    expect(page.locator(link)).to_be_visible()
                    assert 'finishLogin' not in calls
                    with page.expect_popup() as popup:
                        page.locator(link).click()
                    expect(popup.value.locator('body')).to_have_text('Fictitious Google')
                    popup.value.close()
                    page.bring_to_front()
                    # Headless Chromium may keep every tab visible. Exercise the same return
                    # events with explicit dispatch in addition to closing the popup.
                    page.evaluate("""() => {
                        window.dispatchEvent(new Event('focus'));
                        document.dispatchEvent(new Event('visibilitychange'));
                    }""")
                    expect(page.locator(panel)).to_be_visible()
                    expect(page.locator(finish)).to_be_hidden()
                    assert calls.count('finishLogin') == 2, calls
                    assert calls.count('getSession') == 1, calls
                    print(f'{role}: automatic return, bounded retry and panel initialization passed')
    finally:
        server.terminate()
