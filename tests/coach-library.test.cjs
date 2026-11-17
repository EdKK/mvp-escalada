const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {fixture}=require('./helpers/gas.cjs');
const html=fs.readFileSync('apps-script/Index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const client=vm.createContext({});vm.runInContext(script.split('// UI integration')[0],client);const M=client.CoachLibraryModel;
function setup(){const f=fixture();['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary'].forEach(n=>vm.runInContext(fs.readFileSync('apps-script/'+n+'.gs','utf8'),f.context));f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();let actor='coach@example.invalid',seq=0;f.as=email=>{actor=email;f.email(email);};f.lib=(action,data={},key)=>f.context.libraryApi({action,data,requestId:key||'coach-'+(++seq),sessionToken:actor?f.context.issueSession_({email:actor,sub:'12345'}):undefined});return f;}
function ok(r){assert.equal(r.ok,true,JSON.stringify(r));return r.data;}function fail(r,code){assert.equal(r.ok,false);assert.equal(r.error.code,code);}
function scenario(f){const w=ok(f.call('createWorkout',{studentId:'s1',date:'2026-11-18',goal:'Força',instructions:['Orientação preservada']},'w'));const a=ok(f.lib('recordAssessment',{studentId:'s1',exerciseId:'exercise-bench',indicatorId:'int-1rm',value:100,unitId:'unit-kg',protocol:'Teste fictício',referenceDefinition:'Referência fictícia',assessedOn:'2026-11-01',validUntil:'2026-12-31'}));return {w,a,data:{workoutId:w.id,exerciseId:'exercise-bench',block:'Força',category:'Pull strength',metric:'Reps',quantity:3,minutes:5,notes:'Técnica preservada',methodId:'method-max-effort',classification:'general',intensity:{indicatorId:'int-1rm',assessmentId:a.id,percent:85},volume:{kind:'repetitions',unitId:'unit-repetitions',sets:Array.from({length:5},()=>({repetitions:3}))}}};}
test('coach loads active exercises and only compatible active methods and protocols',async()=>{
 const f=setup();f.tables.EXERCICIOS[1][8]='inactive'; // status column
 const lib=async(action,data)=>ok(f.lib(action,data));const controller=M.selectionController(lib),loaded=await controller.load();assert.equal(loaded.exercises.length,9);
 const selected=await controller.select('exercise-finger-iso');assert.equal(selected.indicator.id,'int-max-force');assert.equal(selected.units[0].id,'unit-hang-seconds');assert.ok(selected.methods.some(m=>m.id==='method-isometric'));assert.ok(selected.protocols.some(p=>p.id==='protocol-repeaters'));assert.ok(!selected.methods.some(m=>m.id==='method-plyometric'));
 await assert.rejects(controller.select('exercise-route'),/ativo/);
});
test('selection controller ignores late exercise responses',async()=>{
 const f=setup(),waiting=new Map();const controller=M.selectionController((action,data)=>action==='getExercise'?new Promise(resolve=>waiting.set(data.exerciseId,resolve)):Promise.resolve(ok(f.lib(action,data))));await controller.load();
 const first=controller.select('exercise-bench'),second=controller.select('exercise-boulder');waiting.get('exercise-boulder')(ok(f.lib('getExercise',{exerciseId:'exercise-boulder'})));assert.equal((await second).exercise.id,'exercise-boulder');waiting.get('exercise-bench')(ok(f.lib('getExercise',{exerciseId:'exercise-bench'})));assert.equal(await first,null);assert.equal(controller.current.exercise.id,'exercise-boulder');
});
test('form builds repetitions, isometric suspension, hand moves and heterogeneous series',()=>{
 const rep=M.volume({unitId:'unit-repetitions',sets:'5',quantity:'3'});assert.equal(rep.sets.length,5);assert.equal(rep.sets[0].repetitions,3);
 const iso=M.volume({unitId:'unit-hang-seconds',sets:'4',suspensions:'6',quantity:'7'});assert.equal(iso.sets.length,4);assert.equal(iso.sets[0].seconds,7);
 const moves=M.volume({unitId:'unit-hand-moves',blocks:'4',bouts:'4',quantity:'5'});assert.equal(moves.blocks.length,4);assert.equal(moves.blocks[0].moves.length,4);
 const varied=M.volume({unitId:'unit-repetitions',distribution:'5\n3\n2'});assert.equal(varied.sets.map(s=>s.repetitions).join(','),'5,3,2');
 assert.throws(()=>M.volume({unitId:'unit-repetitions',sets:2,quantity:3.5}),/inválida/);
});
test('intensity form preserves ordinal scale, individual reference and descriptive campus',()=>{
 const a=M.intensity({indicator:{id:'int-1rm',kind:'relative'}},{value:'85',assessmentId:'a'});assert.equal(a.percent,85);assert.equal(a.assessmentId,'a');
 const g=M.intensity({indicator:{id:'int-grade',kind:'ordinal'}},{value:'V4',scale:'V-scale'});assert.equal(g.scale,'V-scale');assert.equal(g.percent,undefined);
 const c=M.intensity({indicator:{id:'int-campus',kind:'undefined'}},{value:'Referência pendente'});assert.equal(c.description,'Referência pendente');assert.equal(c.percent,undefined);
 assert.throws(()=>M.intensity({indicator:{id:'int-1rm',kind:'relative'}},{value:'85'}),/avaliação/);
});
test('library RPC adapter uses libraryApi and the same in-memory OAuth token',async()=>{
 let success,received,legacyCalls=0;const run={withSuccessHandler(fn){success=fn;return this;},withFailureHandler(){return this;},api(){legacyCalls++;},libraryApi(r){received=r;success({ok:true,data:[]});}};
 await client.createRpc(run,()=> 'fictitious-session','libraryApi')({action:'listExercises',data:{}});assert.equal(received.sessionToken,'fictitious-session');assert.equal(legacyCalls,0);
});
test('coordinated save preserves Workouts and metadata and writes item/prescription/series once',()=>{
 const f=setup(),s=scenario(f),before=JSON.stringify(f.tables.Workouts),saved=ok(f.lib('saveCoachPrescription',s.data,'save'));
 assert.equal(saved.item.exercise,'Supino');assert.equal(saved.item.block,'Força');assert.equal(saved.item.category,'Pull strength');assert.equal(saved.item.quantity,3);assert.equal(saved.item.minutes,5);assert.equal(saved.item.notes,'Técnica preservada');assert.equal(saved.prescription.totalVolume,15);assert.equal(JSON.parse(saved.prescription.intensityJson).primary.targetValue,85);assert.equal(saved.prescription.assessmentId,s.a.id);
 assert.equal(ok(f.lib('saveCoachPrescription',s.data,'save')).item.id,saved.item.id);assert.equal(f.tables.Items.length,2);assert.equal(f.tables.PRESCRICOES.length,2);assert.equal(f.tables.PRESCRICAO_SERIES.length,6);assert.equal(JSON.stringify(f.tables.Workouts),before);
 fail(f.lib('saveCoachPrescription',{...s.data,quantity:4},'save'),'CONFLICT');assert.equal(ok(f.lib('listPendingCoachSaves')).length,0);
});
test('invalid methods, units, references and inactive exercises cause no item/reservation writes',()=>{
 const f=setup(),s=scenario(f),before=JSON.stringify(f.tables);
 for(const patch of [{methodId:'method-isometric'},{metric:'Metros'},{intensity:{...s.data.intensity,assessmentId:'missing'}},{volume:{...s.data.volume,unitId:'unit-meters'}}]){const r=f.lib('saveCoachPrescription',{...s.data,...patch});assert.equal(r.ok,false);assert.equal(JSON.stringify(f.tables),before);}
 f.tables.EXERCICIOS.find(r=>r[0]==='exercise-bench')[8]='inactive';fail(f.lib('saveCoachPrescription',s.data),'NOT_FOUND');assert.equal(f.tables.Items.length,1);
 assert.equal(ok(f.lib('coachSaveStatus',{requestId:'never-started'})).state,'not_started');
});
test('assessments are filtered by selected student, exercise, session date and supersession',()=>{
 const f=setup(),s=scenario(f);f.tables.Links.push(['l2','c1','s2',true]);const base={studentId:'s2',exerciseId:'exercise-bench',indicatorId:'int-1rm',value:70,unitId:'unit-kg',protocol:'Outro teste fictício',referenceDefinition:'Outra referência',assessedOn:'2026-11-01',validUntil:'2026-12-31'};ok(f.lib('recordAssessment',base));assert.equal(ok(f.lib('listAssessments',{workoutId:s.w.id,exerciseId:'exercise-bench'})).length,1);
 const next=ok(f.lib('recordAssessment',{...base,studentId:'s1',value:110,supersedesId:s.a.id,assessedOn:'2026-11-02'}));const list=ok(f.lib('listAssessments',{workoutId:s.w.id,exerciseId:'exercise-bench'}));assert.equal(list.length,1);assert.equal(list[0].id,next.id);
});
test('retries recover every interrupted write without duplicate items or prescriptions',()=>{
 for(const table of ['Items','PRESCRICOES','PRESCRICAO_SERIES']){const f=setup(),s=scenario(f);f.fail(table);fail(f.lib('saveCoachPrescription',s.data,'recover'),'INTERNAL_ERROR');const pending=ok(f.lib('listPendingCoachSaves'));assert.equal(pending.length,1);assert.equal(pending[0].requestId,'recover');const firstId=pending[0].itemId;const saved=ok(f.lib('saveCoachPrescription',pending[0].data,pending[0].requestId));assert.equal(saved.item.id,firstId);assert.equal(f.tables.Items.length,2);assert.equal(f.tables.PRESCRICOES.length,2);assert.equal(f.tables.PRESCRICAO_SERIES.length,6);assert.equal(ok(f.lib('listPendingCoachSaves')).length,0);}
});
test('students, revoked links and forged IDs cannot use coach integration or replay writes',()=>{
 const f=setup(),s=scenario(f);ok(f.lib('saveCoachPrescription',s.data,'save'));f.as('one@example.invalid');fail(f.lib('saveCoachPrescription',s.data,'save'),'FORBIDDEN');fail(f.lib('listAssessments',{workoutId:s.w.id,exerciseId:'exercise-bench'}),'FORBIDDEN');fail(f.lib('listPendingCoachSaves'),'FORBIDDEN');
 f.as('coach@example.invalid');fail(f.lib('saveCoachPrescription',{...s.data,studentId:'s2'}),'INVALID_DATA');f.tables.Links[1][3]=false;fail(f.lib('saveCoachPrescription',s.data,'save'),'NOT_FOUND');assert.equal(ok(f.lib('listPendingCoachSaves')).length,0);
});
test('save replay preserves historical reference after assessment replacement and lock contention is safe',()=>{
 const f=setup(),s=scenario(f);f.busy(true);fail(f.lib('saveCoachPrescription',s.data,'save'),'BUSY');f.busy(false);const saved=ok(f.lib('saveCoachPrescription',s.data,'save'));ok(f.lib('recordAssessment',{studentId:'s1',exerciseId:'exercise-bench',indicatorId:'int-1rm',value:110,unitId:'unit-kg',protocol:'Novo teste',referenceDefinition:'Referência fictícia',assessedOn:'2026-11-02',validUntil:'2026-12-31',supersedesId:s.a.id}));
 const replay=ok(f.lib('saveCoachPrescription',s.data,'save'));assert.equal(replay.prescription.id,saved.prescription.id);assert.equal(JSON.parse(replay.prescription.snapshotJson).intensity.reference.value,100);
});
test('all ten exercises expose defined volume/intensity metadata; legacy and library records can coexist',()=>{
 const f=setup();for(const e of ok(f.lib('listExercises'))){const selection=M.describe(ok(f.lib('getExercise',{exerciseId:e.id})),ok(f.lib('catalog')));assert.ok(selection.methods.length);assert.ok(selection.units.length);assert.ok(M.kinds[e.primaryVolumeUnitId]);}
 const s=scenario(f);const legacy=ok(f.call('addItem',{workoutId:s.w.id,block:'Mobilidade',category:'Mobility',exercise:'Registro legado preservado',metric:'Minutos',quantity:10,minutes:10},'legacy'));ok(f.lib('saveCoachPrescription',s.data,'new'));assert.ok(ok(f.call('getWorkout',{workoutId:s.w.id})).items.some(i=>i.id===legacy.id));assert.equal(ok(f.lib('listLibraryPrescriptions',{workoutId:s.w.id})).length,1);
});
