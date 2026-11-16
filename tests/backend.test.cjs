const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {fixture}=require('./helpers/gas.cjs');

const workout = {studentId:'s1',date:'2026-11-16',goal:'Technique'};
const item = id => ({workoutId:id,block:'Warmup',category:'Mobility',exercise:'Movement',metric:'reps',quantity:5,minutes:10});
function code(result, expected) {assert.equal(result.ok,false); assert.equal(result.error.code,expected)}
test('missing identity and unregistered/disabled users are rejected', () => {
  const f=fixture(); f.email(''); code(f.call('listWorkouts'),'UNAUTHENTICATED');
  f.email('unknown@example.invalid'); code(f.call('listWorkouts'),'FORBIDDEN');
  f.email('coach@example.invalid'); f.tables.Users[1][3]=false; code(f.call('listWorkouts'),'FORBIDDEN');
});
test('student sees only own workouts and cannot create or add items', () => {
  const f=fixture(), w=f.call('createWorkout',workout).data;
  f.email('two@example.invalid'); assert.equal(f.call('listWorkouts').data.length,0);
  code(f.call('getWorkout',{workoutId:w.id}),'NOT_FOUND');
  code(f.call('createWorkout',workout),'FORBIDDEN'); code(f.call('addItem',item(w.id)),'FORBIDDEN');
  f.email('one@example.invalid'); assert.equal(f.call('getWorkout',{workoutId:w.id}).data.id,w.id);
});
test('coach relationship required on reads and writes', () => {
  const f=fixture(); code(f.call('createWorkout',{...workout,studentId:'s2'}),'FORBIDDEN');
  const w=f.call('createWorkout',workout).data; f.tables.Links[1][3]=false;
  code(f.call('getWorkout',{workoutId:w.id}),'NOT_FOUND'); code(f.call('addItem',item(w.id)),'NOT_FOUND');
});
test('validation rejects dates, formulas, unknown fields and invalid numbers', () => {
  const f=fixture();
  for(const d of [{...workout,date:'2026-02-30'},{...workout,goal:'=IMPORTXML()'},{...workout,coachId:'c2'},{}]) code(f.call('createWorkout',d),'INVALID_DATA');
  const w=f.call('createWorkout',workout).data;
  for (const quantity of [-1,NaN,Infinity,'5']) code(f.call('addItem',{...item(w.id),quantity},'item'),'INVALID_DATA');
  code(f.call('arbitraryAction'),'INVALID_ACTION'); assert.equal(f.tables.Items.length,1);
});
test('idempotent workout and item writes; reused key with changed payload conflicts', () => {
  const f=fixture(), a=f.call('createWorkout',workout), b=f.call('createWorkout',workout);
  assert.equal(a.data.id,b.data.id); assert.equal(f.tables.Workouts.length,2);
  code(f.call('createWorkout',{...workout,goal:'Other'}),'CONFLICT');
  const x=f.call('addItem',item(a.data.id),'item'), y=f.call('addItem',item(a.data.id),'item');
  assert.equal(x.data.id,y.data.id); assert.equal(f.tables.Items.length,2);
  assert.equal(f.call('getWorkout',{workoutId:a.data.id}).data.items.length,1);
});
test('partial write recovery retains reserved ID and creates one record', () => {
  const f=fixture(); f.fail('Workouts'); code(f.call('createWorkout',workout),'INTERNAL_ERROR');
  const reserved=f.tables.Requests[1][5]; assert.equal(f.call('createWorkout',workout).data.id,reserved);
  assert.equal(f.tables.Workouts.length,2); assert.equal(f.tables.Requests.length,2);
});
test('lock contention rejects write without side effects, retry succeeds', () => {
  const f=fixture(); f.busy(true); code(f.call('createWorkout',workout),'BUSY'); assert.equal(f.tables.Requests.length,1);
  f.busy(false); assert.equal(f.call('createWorkout',workout).ok,true);
});
test('schema mismatch does not overwrite existing cells', () => {
  const f=fixture(); f.tables.Workouts[0][0]='legacy'; code(f.call('createWorkout',workout),'SCHEMA_ERROR');
  assert.equal(f.tables.Workouts[0][0],'legacy');
});
test('feedback ownership, coach read, validation and duplicate protection', () => {
  const f=fixture(), w=f.call('createWorkout',workout).data;
  const data={workoutId:w.id,status:'Parcial',reason:'Dor',fingerPain:3,rpe:6,comment:'Rest'};
  code(f.call('submitFeedback',data,'fb'),'FORBIDDEN');
  f.email('two@example.invalid'); code(f.call('submitFeedback',data,'fb'),'NOT_FOUND'); code(f.call('listFeedback',{workoutId:w.id}),'NOT_FOUND');
  f.email('one@example.invalid');
  for(const bad of [{...data,fingerPain:11},{...data,rpe:0},{...data,rpe:1.5},{...data,reason:''},{...data,studentId:'s2'},{...data,comment:'=formula'}]) code(f.call('submitFeedback',bad,'fb'),'INVALID_DATA');
  const a=f.call('submitFeedback',data,'fb'), b=f.call('submitFeedback',data,'fb'); assert.equal(a.ok,true); assert.equal(a.data.id,b.data.id); assert.equal(a.data.studentId,'s1');
  code(f.call('submitFeedback',{...data,rpe:8},'fb'),'CONFLICT');
  f.email('coach@example.invalid'); assert.equal(f.call('listFeedback',{workoutId:w.id}).data.length,1);
  f.tables.Links[1][3]=false; code(f.call('listFeedback',{workoutId:w.id}),'NOT_FOUND');
});
test('session and student picker disclose only authorized IDs',()=>{
  const f=fixture(); assert.equal(f.call('getSession').data.role,'coach');
  assert.equal(f.call('listStudents').data.length,1); assert.equal(f.call('listStudents').data[0].id,'s1');
  assert.equal(Object.keys(f.call('listStudents').data[0]).join(','),'id');
  f.email('one@example.invalid'); code(f.call('listStudents'),'FORBIDDEN');
});
test('feedback partial write and lock contention are recoverable',()=>{
  const f=fixture(), w=f.call('createWorkout',workout).data; f.email('one@example.invalid');
  const data={workoutId:w.id,status:'Concluído',reason:'',fingerPain:0,rpe:5,comment:''};
  f.busy(true); code(f.call('submitFeedback',data,'fb'),'BUSY'); f.busy(false);
  f.fail('Feedback'); code(f.call('submitFeedback',data,'fb'),'INTERNAL_ERROR');
  assert.equal(f.call('submitFeedback',data,'fb').ok,true); assert.equal(f.tables.Feedback.length,2);
});

test('homologation seed requires explicit environment and empty tables',()=>{
  const f=fixture(); vm.runInContext(fs.readFileSync('apps-script/Homologation.gs','utf8'),f.context);
  assert.throws(()=>f.context.seedHomologation_(),/CONFIGURATION_ERROR/);
  f.context.PropertiesService={getScriptProperties:()=>({getProperty:k=>({ENVIRONMENT:'homologation',SPREADSHEET_ID:'test-only',HOMOLOGATION_SPREADSHEET_ID:'test-only'})[k]})};
  assert.throws(()=>f.context.seedHomologation_(),/HOMOLOGATION_NOT_EMPTY/);
  assert.equal(f.tables.Users.length,4);
  Object.values(f.tables).forEach(table=>table.splice(1));
  f.context.seedHomologation_();
  assert.equal(f.tables.Users.length,4); assert.equal(f.tables.Links.length,3);
  assert.equal(f.tables.Workouts.length,3); assert.equal(f.tables.Items.length,3);
  assert.equal(f.tables.Feedback.length,1); assert.equal(f.tables.Requests.length,1);
  f.email('student-a@example.invalid');
  assert.equal(f.call('listWorkouts').data.length,1);
  code(f.call('getWorkout',{workoutId:'hom-workout-b'}),'NOT_FOUND');
  f.email('coach@example.invalid'); assert.equal(f.call('listWorkouts').data.length,2);
  assert.throws(()=>f.context.seedHomologation_(),/HOMOLOGATION_NOT_EMPTY/);
  assert.equal(f.tables.Workouts.length,3);
});
