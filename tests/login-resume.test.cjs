const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('student/login-resume.js', 'utf8');
const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

function target() {
  const handlers = new Map();
  return {
    addEventListener: (name, handler) => handlers.set(name, handler),
    emit: name => handlers.get(name)({preventDefault() {}}),
    removeAttribute(name) { delete this[name]; }
  };
}

function setup(finish) {
  const window = target(), document = target(), link = target();
  const prepareButton = target(), finishButton = target();
  const timers = new Map(), statuses = [], sessions = [];
  let nextTimer = 0;
  const context = vm.createContext({
    window, document, URL,
    setTimeout(callback, delay) {
      assert.equal(delay, 2000);
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(source, context);
  const controller = context.createLoginResume({
    link, prepareButton, finishButton, finish,
    onSuccess: token => sessions.push(token),
    onStatus: status => statuses.push(status)
  });
  return {
    window, document, link, prepareButton, finishButton, timers, statuses, sessions,
    reset: controller.reset,
    prepare(transaction = 'current') {
      controller.prepare({authorizationUrl, transaction, proof: transaction + '-proof'});
    },
    tick() {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      return callback();
    }
  };
}

test('both generated interfaces embed the same login controller', () => {
  for (const file of ['apps-script/Index.html', 'apps-script/Student.html']) {
    assert.ok(fs.readFileSync(file, 'utf8').includes(source.trim()));
  }
});

test('return checks start after opening Google and serialize focus, visibility and manual events', async () => {
  const calls = [];
  let release;
  const ui = setup(data => {
    calls.push([data.transaction, data.proof]);
    if (calls.length === 1) return new Promise(resolve => { release = resolve; });
    return {sessionToken: 'app-token'};
  });

  ui.prepare();
  await ui.window.emit('focus');
  assert.equal(calls.length, 0);
  ui.link.emit('click');
  ui.document.hidden = true;
  await ui.document.emit('visibilitychange');
  assert.equal(calls.length, 0);
  ui.document.hidden = false;
  const request = ui.window.emit('focus');
  await ui.document.emit('visibilitychange');
  await ui.finishButton.emit('click');
  assert.equal(ui.prepareButton.disabled, true);
  assert.equal(calls.length, 1);

  release({pending: true});
  await request;
  await ui.window.emit('focus');
  assert.equal(calls.length, 1);
  await ui.tick();
  assert.deepEqual(calls, [['current', 'current-proof'], ['current', 'current-proof']]);
  assert.deepEqual(ui.sessions, ['app-token']);
  assert.equal(ui.finishButton.hidden, true);
  assert.equal(ui.link.href, undefined);
  await ui.window.emit('focus');
  assert.equal(calls.length, 2);
});

test('automatic checks stop at the limit and manual completion remains available', async () => {
  let calls = 0;
  const ui = setup(() => ++calls <= 5 ? {pending: true} : {sessionToken: 'manual'});
  ui.prepare();
  ui.link.emit('click');
  await ui.window.emit('focus');
  while (ui.timers.size) await ui.tick();
  await ui.window.emit('focus');
  await ui.document.emit('visibilitychange');
  assert.equal(calls, 5);
  assert.equal(ui.finishButton.hidden, false);
  await ui.finishButton.emit('click');
  assert.deepEqual(ui.sessions, ['manual']);
});

test('late replies from replaced attempts cannot start a session or change status', async () => {
  let release;
  const ui = setup(({transaction}) => transaction === 'old'
    ? new Promise(resolve => { release = resolve; })
    : {sessionToken: transaction});
  ui.prepare('old');
  ui.link.emit('click');
  const request = ui.window.emit('focus');

  ui.reset();
  ui.prepare('new');
  release({sessionToken: 'obsolete'});
  await request;
  assert.deepEqual(ui.sessions, []);
  assert.deepEqual(ui.statuses, []);
  assert.equal(ui.timers.size, 0);
  await ui.finishButton.emit('click');
  assert.deepEqual(ui.sessions, ['new']);
});

test('transport errors leave manual recovery available and definitive errors reset the attempt', async () => {
  let calls = 0;
  const ui = setup(() => { throw Error(++calls === 1 ? 'TRANSPORT_ERROR' : 'AUTH_FAILED'); });
  ui.prepare();
  ui.link.emit('click');
  await ui.window.emit('focus');
  assert.equal(ui.finishButton.hidden, false);
  assert.match(ui.statuses.at(-1), /TRANSPORT_ERROR/);
  await ui.document.emit('visibilitychange');
  assert.equal(calls, 1);
  await ui.finishButton.emit('click');
  assert.equal(ui.finishButton.hidden, true);
  assert.match(ui.statuses.at(-1), /nova entrada/);
  assert.equal(ui.timers.size, 0);
});

test('retry waits for another return when the original tab becomes hidden', async () => {
  let calls = 0;
  const ui = setup(() => ++calls === 1 ? {pending: true} : {sessionToken: 'app-token'});
  ui.prepare();
  ui.link.emit('click');
  await ui.window.emit('focus');
  ui.document.hidden = true;
  await ui.tick();
  assert.equal(calls, 1);
  ui.document.hidden = false;
  await ui.document.emit('visibilitychange');
  assert.deepEqual(ui.sessions, ['app-token']);
});
