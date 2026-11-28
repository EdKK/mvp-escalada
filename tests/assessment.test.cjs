const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {fixture, setupFinance, setupAssessment} = require('./helpers/gas.cjs');

const coach = 'coach@example.invalid';
const student = 'one@example.invalid';
const otherCoach = 'other@example.invalid';
const date = '2025-01-01';
const next = '2025-01-22';
const plain = value => JSON.parse(JSON.stringify(value));

function setup() {
  const f = setupAssessment(setupFinance(fixture()));
  function call(action, data, {email = coach, requestId = randomUUID()} = {}) {
    const sessionToken = email && f.context.issueSession_({email, sub: '12345'});
    return plain(f.context.assessmentApi({action, data, requestId, sessionToken}));
  }
  const read = email => call('get', {studentId: 's1'}, {email}).data;
  const save = (measures, day = date, options) => call('save', {studentId: 's1', date: day, measures}, options);
  return {...f, call, read, save};
}

test('initializer checks the target and immutable catalog contracts and only inserts missing seeds', () => {
  const f = setup();
  const snapshot = plain(f.tables);
  assert.deepEqual(plain(f.context.prepararAvaliacaoTeste_()), {created: [], seeded: [], catalogCount: 4, recordCount: 0});
  assert.deepEqual(f.tables, snapshot);
  assert.deepEqual(snapshot.CATALOGO_AVALIACAO.slice(1).map(row => [row[0], row[4], row[7]]),
    [['height', 'cm', 'direct'], ['mass', 'kg', 'direct,self_report'], ['span', 'cm', 'direct'], ['ape', 'cm', 'calculation']]);
  f.properties.ASSESSMENT_INIT_SPREADSHEET_ID = 'other-id';
  assert.throws(() => f.context.prepararAvaliacaoTeste_(), /CONFIGURATION_ERROR/);
  assert.deepEqual(f.tables, snapshot);
  f.properties.ASSESSMENT_INIT_SPREADSHEET_ID = f.properties.SPREADSHEET_ID;
  f.tables.CATALOGO_AVALIACAO[1][4] = 'm';
  delete f.tables.REGISTROS_AVALIACAO;
  assert.throws(() => f.context.prepararAvaliacaoTeste_(), /SCHEMA_ERROR/);
  assert.equal(f.tables.REGISTROS_AVALIACAO, undefined);
  f.tables.CATALOGO_AVALIACAO[1][4] = 'cm';
  f.tables.CATALOGO_AVALIACAO.pop();
  assert.deepEqual(plain(f.context.prepararAvaliacaoTeste_()), {
    created: ['REGISTROS_AVALIACAO'], seeded: ['ape'], catalogCount: 4, recordCount: 0
  });
  f.tables.CATALOGO_AVALIACAO.push(f.tables.CATALOGO_AVALIACAO[1].slice());
  assert.throws(() => f.context.prepararAvaliacaoTeste_(), /SCHEMA_ERROR/);
});

test('validates numbers, units, dates and allowed variables before writing any part', () => {
  const f = setup();
  for (const data of [{}, {height: '170'}, {mass: 0}, {mass: Infinity}, {mass: 1001},
    {mass: 60.1234}, {height: 170, mass: -1}, {ape: 2}, {unit: 'lb'}]) {
    assert.equal(f.save(data).error.code, 'INVALID_DATA');
  }
  for (const day of ['2025-02-29', '2025-2-1', '9999-01-01']) {
    assert.equal(f.save({mass: 60}, day).error.code, 'INVALID_DATA');
  }
  assert.equal(f.save({mass: 60.123}).ok, true);
  assert.equal(f.read().current.mass.unit, 'kg');
  assert.equal(f.tables.REGISTROS_AVALIACAO.length, 2);
});

test('partial and retroactive measures produce an effective-date Ape Index with both source IDs', () => {
  const f = setup();
  assert.deepEqual(f.read().current, {height: null, span: null, mass: null, ape: null});
  assert.equal(f.read().mass, null);
  assert.ok(f.save({span: 174}, next).ok);
  assert.equal(f.read().current.ape, null);
  assert.ok(f.save({height: 170}).ok);
  const {current} = f.read();
  assert.deepEqual(current.ape.height, {id: current.height.id, date, value: 170});
  assert.deepEqual(current.ape.span, {id: current.span.id, date: next, value: 174});
  assert.equal(current.ape.date, next);
  assert.equal(current.ape.value, 4);
  assert.equal(current.ape.origin, 'calculation');
  assert.ok(f.save({height: 176}, '2025-02-01').ok);
  assert.deepEqual(f.read().ape.map(row => row.value), [-2, 4]);
  assert.ok(f.save({span: 177}, next).ok);
  assert.deepEqual(f.read().ape.map(row => row.value), [1, 7]);
});

test('corrections append a revision, invalidation is auditable, and both affect valid historical queries', () => {
  const f = setup();
  f.save({height: 170, span: 174, mass: 60});
  const original = f.read().current.height;
  const data = {studentId: 's1', recordId: original.id, date, measures: {height: 171}, notes: 'Ajuste de leitura'};
  const options = {requestId: randomUUID()};
  assert.ok(f.call('correct', data, options).ok);
  assert.ok(f.call('correct', data, options).ok);
  assert.equal(f.call('correct', data).error.code, 'CONFLICT');
  let view = f.read();
  assert.equal(view.current.ape.value, 3);
  assert.equal(view.current.height.supersedesId, original.id);
  assert.equal(view.history.find(row => row.id === original.id).valid, false);
  assert.ok(f.call('invalidate', {studentId: 's1', recordId: view.current.height.id, notes: 'Instrumento incorreto'}).ok);
  view = f.read();
  assert.equal(view.current.height, null);
  assert.equal(view.current.ape, null);
  assert.equal(view.history.find(row => row.kind === 'invalidation').actorId, 'c1');
  assert.equal(view.history.find(row => row.id === original.id).value, 170);
  assert.equal(view.history.filter(row => row.variableId === 'height').length, 3);
});

test('monthly mass recommendation uses effective dates and valid records; earlier follow-ups are accepted', () => {
  const f = setup();
  assert.ok(f.save({mass: 65}, next).ok);
  assert.ok(f.save({mass: 60}).ok);
  const view = f.read();
  assert.deepEqual(view.mass.series.map(row => row.value), [60, 65]);
  assert.equal(view.mass.dueDate, '2025-02-21');
  assert.equal(view.mass.delta, 5);
  assert.equal(view.mass.percent, 5 / 60 * 100);
  const catalog = f.context.assessmentCatalog_(f.context.db_());
  const rows = f.context.rows_(f.context.db_(), 'REGISTROS_AVALIACAO', f.context.ASSESSMENT_SCHEMA_);
  assert.equal(f.context.assessmentView_(rows, '2025-02-21', catalog).mass.overdue, false);
  assert.equal(f.context.assessmentView_(rows, '2025-02-22', catalog).mass.overdue, true);
  const active = f.context.assessmentActive_(rows);
  assert.equal(f.context.assessmentAt_(active, 'mass', '2024-12-31'), null);
  assert.equal(f.context.assessmentAt_(active, 'mass', '2025-01-10').value, 60);
  assert.equal(f.context.assessmentAt_(active, 'mass', next).value, 65);
});

test('self-report is restricted to the current student and shared only at submission with active coaches', () => {
  const f = setup();
  f.tables.Users.push(['c2', otherCoach, 'coach', true], ['c3', 'third@example.invalid', 'coach', true]);
  f.tables.Links.push(['other-link', 'c2', 's1', true], ['disabled-link', 'c3', 's1', false]);
  const options = {email: student, requestId: randomUUID()};
  assert.equal(f.call('selfReport', {date, mass: 69, studentId: 's2'}, options).error.code, 'INVALID_DATA');
  assert.equal(f.call('selfReport', {date, mass: 69}, {email: 'two@example.invalid'}).error.code, 'NO_ACTIVE_LINK');
  assert.equal(f.call('selfReport', {date, mass: 69}, {email: coach}).error.code, 'FORBIDDEN');
  assert.equal(f.call('get', {studentId: 's1'}, options).error.code, 'FORBIDDEN');
  assert.equal(f.call('get', {studentId: 's1'}, {email: ''}).error.code, 'UNAUTHENTICATED');
  assert.equal(f.call('get', {studentId: 's2'}).error.code, 'NOT_FOUND');
  assert.ok(f.call('selfReport', {date, mass: 69}, options).ok);
  f.tables.Links.find(row => row[0] === 'disabled-link')[3] = true;
  assert.ok(f.call('selfReport', {date, mass: 69}, options).ok);
  assert.equal(f.tables.REGISTROS_AVALIACAO.length, 3);
  assert.equal(f.read().current.mass.origin, 'self_report');
  assert.equal(f.read(otherCoach).current.mass.actorId, 's1');
  assert.equal(f.read('third@example.invalid').current.mass, null);
  const recordId = f.read().current.mass.id;
  assert.equal(f.call('invalidate', {studentId: 's1', recordId, notes: 'Erro'}, {email: otherCoach}).error.code, 'NOT_FOUND');
  assert.equal(f.call('correct', {studentId: 's1', recordId, date, measures: {mass: 67}}).error.code, 'INVALID_DATA');
  assert.ok(f.call('invalidate', {studentId: 's1', recordId, notes: 'Solicitado pelo aluno'}).ok);
  assert.equal(f.read().current.mass, null);
  assert.equal(f.read(otherCoach).current.mass.value, 69);
});

test('single write batch survives retries, rejects a changed intent, and observes the script lock', () => {
  const f = setup();
  const options = {requestId: randomUUID()};
  f.busy(true);
  assert.equal(f.save({height: 170, mass: 60}, date, options).error.code, 'BUSY');
  f.busy(false);
  f.fail('REGISTROS_AVALIACAO');
  assert.equal(f.save({height: 170, mass: 60}, date, options).error.code, 'INTERNAL_ERROR');
  assert.equal(f.tables.REGISTROS_AVALIACAO.length, 1);
  assert.ok(f.save({height: 170, mass: 60}, date, options).ok);
  assert.ok(f.save({mass: 60, height: 170}, date, options).ok);
  assert.equal(f.save({mass: 61, height: 170}, date, options).error.code, 'CONFLICT');
  f.tables.CATALOGO_AVALIACAO.find(row => row[0] === 'mass')[10] = false;
  assert.equal(f.save({mass: 61}).error.code, 'INVALID_DATA');
  assert.ok(f.save({height: 170, mass: 60}, date, options).ok);
  assert.equal(f.tables.REGISTROS_AVALIACAO.length, 3);
  assert.equal(f.tables.Workouts.length, 1);
  assert.equal(f.tables.Requests.length, 1);
});
