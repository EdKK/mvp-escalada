"""AVA-01C session boundaries with real browser callbacks and simulated Google services."""
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
        page = browser.new_page()
        page.add_init_script("""window.open = () => null;
          window.finishedReports = [];
          const fetchRPC = window.fetch.bind(window);
          window.fetch = async (url, options) => {
            const response = await fetchRPC(url, options);
            const request = url === '/rpc' && JSON.parse(options.body).request;
            if (request?.action === 'selfReport') {
              const read = response.json.bind(response);
              response.json = async () => {
                const result = await read();
                setTimeout(() => window.finishedReports.push(request.requestId), 0);
                return result;
              };
            }
            return response;
          };""")
        capture = set()
        pending = []
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def route_request(route):
            if not route.request.url.startswith(base):
                return route.abort()
            if route.request.url.endswith('/rpc'):
                body = route.request.post_data_json
                if body['request']['action'] == 'selfReport' and body['profile'] in capture:
                    pending.append((route, body['request']))
                    return
            route.continue_()

        page.route('**/*', route_request)

        def login(profile):
            page.evaluate('(profile) => window.testProfile = profile', profile)
            page.locator('#prepareLogin').click()
            page.locator('#finishLogin').click()
            expect(page.locator('.student-signout')).to_be_visible()
            expect(page.locator('#selfMassForm')).to_be_visible()

        def prepare_report(value='63.5'):
            page.locator('#selfMassValue').fill(value)
            page.locator('#selfMassDate').fill('2025-02-05')

        def submit(profile):
            capture.add(profile)
            with page.expect_request(lambda request: request.url.endswith('/rpc') and
                                     request.post_data_json['request']['action'] == 'selfReport'):
                page.locator('#selfMassSave').click()
            expect(page.locator('#selfMassSave')).to_be_disabled()
            capture.remove(profile)
            return pending.pop()

        def release(route, request, response):
            request_id = request['requestId']
            count = page.evaluate('(id) => window.finishedReports.filter(reply => reply === id).length', request_id)
            with page.expect_response(lambda reply: reply.url.endswith('/rpc') and
                                      reply.request.post_data_json['request'].get('requestId') == request['requestId']):
                route.fulfill(response=response)
            page.wait_for_function('([id, count]) => window.finishedReports.filter(reply => reply === id).length > count',
                                   arg=[request_id, count])

        def expire():
            page.request.post(base + '/test-control', data={'expireSession': True})

        def check_cleared():
            expect(page.locator('#selfMassValue')).to_have_value('')
            expect(page.locator('#selfMassDate')).to_have_value('')
            expect(page.locator('#selfMassStatus')).to_have_text('')
            expect(page.locator('#selfMassSave')).to_be_enabled()
            expect(page.locator('#selfMassStorage')).to_be_hidden()
            expect(page.locator('#days')).to_be_empty()
            expect(page.locator('#dayGoal')).to_have_text('')
            expect(page.locator('#exercises')).to_be_empty()

        page.goto(base + '/student')
        initial = page.request.post(base + '/test-tables', data={}).json()

        # A pending write gets UNAUTHENTICATED and the same document accepts a new identity.
        login('student')
        prepare_report()
        old_route, expired = submit('student')
        expire()
        response = old_route.fetch()
        assert response.json()['error']['code'] == 'UNAUTHENTICATED'
        release(old_route, expired, response)
        expect(page.locator('#authMessage')).to_contain_text('Sua sessão expirou')
        expect(page.locator('#trainingPanel')).to_be_hidden()
        check_cleared()
        login('student-b')
        expect(page.locator('#selfMassValue')).to_have_value('')
        expect(page.locator('#selfMassStatus')).to_have_text('')
        assert page.locator('#selfMassDate').input_value() != '2025-02-05'
        page.locator('.student-signout').click()
        check_cleared()

        # A writes successfully but the response is held while B submits identical data.
        login('student')
        prepare_report()
        a_route, a_request = submit('student')
        saved = a_route.fetch()
        assert saved.json()['ok']
        page.locator('.student-signout').click()
        check_cleared()
        login('student-b')
        prepare_report()
        b_route, b_request = submit('student-b')
        assert b_request['requestId'] != a_request['requestId']
        release(a_route, a_request, saved)
        expect(page.locator('#selfMassValue')).to_have_value('63.5')
        expect(page.locator('#selfMassStatus')).to_have_text('Enviando…')
        expect(page.locator('#selfMassSave')).to_be_disabled()
        release(b_route, b_request, b_route.fetch())
        expect(page.locator('#selfMassStatus')).to_have_text('Autorrelato registrado.')
        page.locator('.student-signout').click()

        # A can still reconcile its committed intent after B used the page.
        login('student')
        prepare_report()
        retry_route, retry = submit('student')
        assert retry['requestId'] == a_request['requestId']
        release(retry_route, retry, retry_route.fetch())
        expect(page.locator('#selfMassStatus')).to_have_text('Autorrelato registrado.')

        # Expire A through a second RPC while its write is in flight. A's delayed
        # UNAUTHENTICATED response must neither cancel B's login nor reset B's draft.
        prepare_report('71.2')
        late_route, late = submit('student')
        expire()
        page.locator('#refreshWorkouts').click()
        expect(page.locator('#authMessage')).to_contain_text('Sua sessão expirou')
        check_cleared()
        login('student-b')
        prepare_report('74.1')
        stale = late_route.fetch()
        assert stale.json()['error']['code'] == 'UNAUTHENTICATED'
        release(late_route, late, stale)
        expect(page.locator('#selfMassValue')).to_have_value('74.1')
        expect(page.locator('#selfMassStatus')).to_have_text('')
        expect(page.locator('#trainingPanel')).to_be_visible()
        expect(page.locator('.student-signout')).to_be_visible()

        final = page.request.post(base + '/test-tables', data={}).json()
        assert final['REGISTROS_AVALIACAO'][0] == initial['REGISTROS_AVALIACAO'][0]
        assert [(row[2], row[4]) for row in final['REGISTROS_AVALIACAO'][1:]] == [('s1', 63.5), ('s2', 63.5)]
        assert all(rows == final[name] for name, rows in initial.items() if name != 'REGISTROS_AVALIACAO')
        assert not errors, errors
        browser.close()
    print('PASS AVA-01C Chromium: expiry, same-tab identity changes, delayed success and expiry, isolated intents and same-actor recovery.')
finally:
    server.terminate()
    server.wait(timeout=10)
