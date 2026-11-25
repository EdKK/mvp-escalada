const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { fixture } = require('./helpers/gas.cjs');

const source = Object.fromEntries(fs.readdirSync('apps-script')
  .filter(name => name.endsWith('.gs'))
  .map(name => [name, fs.readFileSync('apps-script/' + name, 'utf8')]));

const helpers = [
  ['Homologation.gs', 'prepararDadosTeste', 'seedHomologation_'],
  ['TrainingCatalog.gs', 'prepararBibliotecaTeste', 'initializeLibraryDevelopment_']
];

test('server globals expose only the two RPC dispatchers and doGet', () => {
  const context = vm.createContext({});
  for (const [name, code] of Object.entries(source)) {
    vm.runInContext(code, context, { filename: name });
  }
  const publicFunctions = Object.keys(context)
    .filter(name => typeof context[name] === 'function' && !name.endsWith('_'));
  assert.deepEqual(publicFunctions.sort(), ['api', 'doGet', 'libraryApi']);
  for (const [file, wrapper, initializer] of helpers) {
    assert.equal(context[wrapper], undefined);
    assert.match(source[file], new RegExp('^function ' + wrapper + '_\\(\\)', 'm'));
    assert.equal(typeof context[wrapper + '_'], 'function');
    assert.ok(String(context[wrapper + '_']).includes(initializer + '()'));
  }
});

test('RPC allowlists exclude initialization and protect writes by session and role', () => {
  const { context, properties, tables } = fixture();
  properties.LIBRARY_SPREADSHEET_ID = properties.SPREADSHEET_ID;
  vm.runInContext(source['TrainingLibrary.gs'], context);
  const before = JSON.stringify(tables);
  for (const dispatch of [context.api, context.libraryApi]) {
    for (const action of helpers.flatMap(([, wrapper, initializer]) =>
      [wrapper, wrapper + '_', initializer]).concat('initializeSchema_')) {
      assert.equal(dispatch({ action, data: {} }).error.code, 'INVALID_ACTION');
    }
  }
  assert.equal(context.api({ action: 'createWorkout', data: {} }).error.code, 'UNAUTHENTICATED');
  assert.equal(context.libraryApi({ action: 'saveCoachPrescription', data: {} }).error.code, 'UNAUTHENTICATED');
  const sessionToken = context.issueSession_({ email: 'one@example.invalid', sub: 'test-student' });
  assert.equal(context.libraryApi({ action: 'saveCoachPrescription', data: {}, sessionToken }).error.code, 'FORBIDDEN');
  assert.equal(JSON.stringify(tables), before);
});
