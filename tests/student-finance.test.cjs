const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {fixture, setupFinance} = require('./helpers/gas.cjs');

const coachEmail = 'coach@example.invalid';
const june = '2026-06-01';
const august = '2026-08-01';

function setup() {
  const f = setupFinance(fixture());
  function call(action, data = {}, {email = coachEmail, requestId = randomUUID()} = {}) {
    const sessionToken = f.context.issueSession_({email, sub: '12345'});
    return JSON.parse(JSON.stringify(f.context.financeApi({action, data, requestId, sessionToken})));
  }
  return {...f, call};
}

const registration = {
  studentId: '', name: 'Aluna de Teste', email: 'Aluna.Financeira@gmail.com',
  whatsapp: '+55 (11) 90000-0000', startedOn: june
};
const packagePlan = studentId => ({studentId, mode: 'package8', amountCents: 88000, startedOn: june, dueOn: ''});
const monthlyPlan = studentId => ({studentId, mode: 'monthly', amountCents: 25000, startedOn: august, dueOn: '2026-09-01'});

test('finance initializer is guarded, idempotent and leaves legacy tables unchanged', () => {
  const f = setup();
  const snapshot = JSON.stringify(f.tables);
  assert.deepEqual(Array.from(f.context.prepararCadastroFinanceiroTeste_()), ['CADASTROS', 'PLANOS', 'AULAS']);
  assert.equal(JSON.stringify(f.tables), snapshot);
  f.properties.HOMOLOGATION_SPREADSHEET_ID = 'different-sheet';
  assert.throws(() => f.context.prepararCadastroFinanceiroTeste_(), /CONFIGURATION_ERROR/);
  assert.equal(JSON.stringify(f.tables), snapshot);
  f.properties.HOMOLOGATION_SPREADSHEET_ID = f.properties.SPREADSHEET_ID;
  delete f.tables.CADASTROS;
  f.tables.AULAS[0][0] = 'unexpected';
  assert.throws(() => f.context.prepararCadastroFinanceiroTeste_(), /SCHEMA_ERROR/);
  assert.equal(f.tables.CADASTROS, undefined);
  assert.equal(f.tables.Users.length, 4);
  assert.equal(f.tables.AULAS[0][0], 'unexpected');
});

test('registration reuses the same identity on retry and integrates with training and authorization', () => {
  const f = setup();
  const requestId = randomUUID();
  f.fail('Users');
  assert.equal(f.call('saveStudent', registration, {requestId}).error.code, 'INTERNAL_ERROR');
  assert.equal(f.tables.CADASTROS.length, 2);
  assert.equal(f.tables.Users.length, 4);
  assert.throws(() => f.context.userForEmail_(f.context.db_(), registration.email), /FORBIDDEN/);
  const saved = f.call('saveStudent', registration, {requestId});
  assert.equal(saved.ok, true);
  assert.deepEqual(f.call('saveStudent', registration, {requestId}), saved);
  const {id, name, email} = saved.data;
  assert.equal(saved.data.whatsapp, '+5511900000000');
  assert.equal(f.tables.CADASTROS.length, 2);
  assert.equal(f.tables.Users.length, 5);
  assert.equal(f.tables.Links.length, 3);
  assert.equal(f.call('saveStudent', registration).error.code, 'CONFLICT');
  const coachCall = action => f.context.api({action, data: {}, sessionToken: f.context.issueSession_({email: coachEmail, sub: '12345'})});
  assert.ok(coachCall('listStudents').data.some(student => student.id === id && student.name === name));
  const session = f.context.api({action: 'getSession', data: {}, sessionToken: f.context.issueSession_({email, sub: '12345'})});
  assert.equal(session.data.id, id);
  assert.equal(session.data.role, 'student');
});

test('legacy student keeps ID, existing links and training records when profile and email change', () => {
  const f = setup();
  assert.equal(f.call('getStudent', {studentId: 's1'}).data.profile.email, 'one@example.invalid');
  f.tables.Workouts.push(['existing-workout', 'c1', 's1', june, 'Força', june]);
  const workouts = JSON.stringify(f.tables.Workouts);
  const links = JSON.stringify(f.tables.Links);
  const saved = f.call('saveStudent', {...registration, studentId: 's1'}).data;
  assert.equal(saved.id, 's1');
  assert.equal(JSON.stringify(f.tables.Workouts), workouts);
  assert.equal(JSON.stringify(f.tables.Links), links);
  assert.throws(() => f.context.userForEmail_(f.context.db_(), 'one@example.invalid'), /FORBIDDEN/);
  assert.equal(f.context.userForEmail_(f.context.db_(), saved.email).id, 's1');
  const sessionToken = f.context.issueSession_({email: saved.email, sub: '12345'});
  assert.equal(f.context.api({action: 'listWorkouts', data: {}, sessionToken}).data[0].id, 'existing-workout');
  assert.equal(f.call('saveStudent', {...registration, studentId: 's2'}).error.code, 'FORBIDDEN');
  assert.equal(f.call('saveStudent', {...registration, email: 'wrong@invalid.example'}).error.code, 'INVALID_DATA');
  assert.equal(f.call('saveStudent', {...registration, name: '=IMPORTXML(...)', email: 'formula.user@gmail.com'}).error.code, 'INVALID_DATA');
});

test('only a coach with an active relationship can access its own finance records', () => {
  const f = setup();
  const other = 'other@example.invalid';
  f.tables.Users.push(['c2', other, 'coach', true]);
  const planId = f.call('startPlan', packagePlan('s1')).data.id;
  assert.equal(f.call('listStudents', {}, {email: 'one@example.invalid'}).error.code, 'FORBIDDEN');
  assert.equal(f.call('getStudent', {studentId: 's1'}, {email: other}).error.code, 'NOT_FOUND');
  f.tables.Links.push(['l-other', 'c2', 's1', true]);
  assert.deepEqual(f.call('getStudent', {studentId: 's1'}, {email: other}).data.plans, []);
  assert.equal(f.call('savePayment', {studentId: 's1', planId, payment: 'paid', paidOn: june}, {email: other}).error.code, 'NOT_FOUND');
  assert.equal(f.call('saveStudent', {...registration, studentId: 's1'}, {email: other}).error.code, 'FORBIDDEN');
  f.tables.Links[1][3] = false;
  assert.equal(f.call('getStudent', {studentId: 's1'}).error.code, 'NOT_FOUND');
  assert.equal(f.tables.PLANOS[1][7], 'pending');
});

test('eight-lesson package validates capacity and preserves corrected and canceled attendance', () => {
  const f = setup();
  const studentId = 's1';
  const requestId = randomUUID();
  const planId = f.call('startPlan', packagePlan(studentId), {requestId}).data.id;
  assert.equal(f.call('startPlan', packagePlan(studentId), {requestId}).data.id, planId);
  const addLesson = (date, options) => f.call('saveLesson', {studentId, planId, lessonId: '', date, active: true}, options);
  assert.equal(addLesson('2026-06-31').error.code, 'INVALID_DATA');
  const lessonRequest = {requestId: randomUUID()};
  const lessonId = addLesson(june, lessonRequest).data.id;
  assert.equal(addLesson(june, lessonRequest).data.id, lessonId);
  for (let day = 2; day <= 8; day++) assert.equal(addLesson('2026-06-0' + day).ok, true);
  assert.equal(addLesson('2026-06-09').error.code, 'CONFLICT');
  const correct = (date, active) => f.call('saveLesson', {studentId, planId, lessonId, date, active});
  assert.equal(correct('2026-06-10', true).ok, true);
  assert.equal(correct('', false).ok, true);
  assert.equal(addLesson('2026-06-09').ok, true);
  const {lessons} = f.call('getStudent', {studentId}).data;
  assert.equal(lessons.filter(lesson => lesson.active).length, 8);
  assert.deepEqual(lessons.find(lesson => lesson.id === lessonId).date, '2026-06-10');
  assert.equal(lessons.find(lesson => lesson.id === lessonId).active, false);
});

test('renewal and mode changes keep paid periods and monthly attendance has no cap', () => {
  const f = setup();
  const studentId = 's1';
  const planId = f.call('startPlan', packagePlan(studentId)).data.id;
  assert.equal(f.call('savePayment', {studentId, planId, payment: 'paid', paidOn: ''}).error.code, 'INVALID_DATA');
  assert.equal(f.call('savePayment', {studentId, planId, payment: 'paid', paidOn: june}).ok, true);
  assert.equal(f.call('startPlan', {...monthlyPlan(studentId), amountCents: 12.5}).error.code, 'INVALID_DATA');
  assert.equal(f.call('startPlan', {...monthlyPlan(studentId), dueOn: june}).error.code, 'INVALID_DATA');
  const monthlyId = f.call('startPlan', monthlyPlan(studentId)).data.id;
  for (let day = 1; day <= 10; day++) {
    const date = '2026-08-' + String(day).padStart(2, '0');
    assert.equal(f.call('saveLesson', {studentId, planId: monthlyId, lessonId: '', date, active: true}).ok, true);
  }
  const renewedId = f.call('startPlan', {...monthlyPlan(studentId), startedOn: '2026-09-01', dueOn: '2026-10-01'}).data.id;
  assert.equal(f.tables.AULAS.length, 11);
  const result = f.call('getStudent', {studentId}).data;
  assert.deepEqual(result.plans.map(plan => [plan.id, plan.payment, plan.paidOn]),
    [[planId, 'paid', june], [monthlyId, 'pending', ''], [renewedId, 'pending', '']]);
  assert.ok(result.lessons.every(lesson => lesson.planId === monthlyId));
  const training = f.context.api({
    action: 'createWorkout', requestId: 'test-workout', data: {studentId, date: august, goal: 'Força'},
    sessionToken: f.context.issueSession_({email: coachEmail, sub: '12345'})
  });
  assert.equal(training.ok, true);
  assert.equal(f.tables.AULAS.length, 11);
});
