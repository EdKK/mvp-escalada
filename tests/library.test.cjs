const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {fixture}=require('./helpers/gas.cjs');
const examples=JSON.parse(fs.readFileSync('tests/fixtures/library-examples.json','utf8'));
function setup(init=true){
 const f=fixture();['TrainingLibrary','TrainingLoad','TrainingCatalog'].forEach(name=>vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context));
 f.properties.LIBRARY_SPREADSHEET_ID='test-only';let actor='coach@example.invalid',seq=0;
 f.as=email=>{actor=email;f.email(email);};
 f.lib=(action,data={},requestId)=>f.context.libraryApi({action,data,requestId:requestId||'library-'+(++seq),sessionToken:actor?f.context.issueSession_({email:actor,sub:'12345'}):undefined});
 if(init)f.context.initializeLibraryDevelopment_();return f;
}
function ok(r){assert.equal(r.ok,true,JSON.stringify(r));return r.data;}
function error(r,code){assert.equal(r.ok,false);assert.equal(r.error.code,code);}
function parent(f){const w=ok(f.call('createWorkout',{studentId:'s1',date:'2026-11-18',goal:'Teste fictício de biblioteca'},'legacy-w'));const item=ok(f.call('addItem',{workoutId:w.id,block:'Força',category:'Technique',exercise:'Nome legado preservado',metric:'repetitions',quantity:1,minutes:1},'legacy-i'));return {w,item};}
function assessment(f,exerciseId='exercise-bench',patch={}){return ok(f.lib('recordAssessment',{studentId:'s1',exerciseId,indicatorId:exerciseId==='exercise-finger-iso'?'int-max-force':'int-1rm',value:100,unitId:exerciseId==='exercise-finger-iso'?'unit-newton':'unit-kg',protocol:'Protocolo fictício documentado',referenceDefinition:'Definição fictícia: valor absoluto de teste, sem equivalência entre protocolos.',assessedOn:'2026-11-01',validUntil:'2026-12-31',...patch}));}
function requestFor(f,example=examples[3],p=parent(f)){
 const e=ok(f.lib('getExercise',{exerciseId:example.exerciseId}));
 const a=example.grade?null:assessment(f,example.exerciseId,{indicatorId:e.primaryIndicatorId,value:example.referenceValue,unitId:example.referenceUnit});
 return {workoutId:p.w.id,itemId:p.item.id,exerciseId:example.exerciseId,methodId:example.methodId,...(example.protocolId?{protocolId:example.protocolId}:{}),classification:'specific',intensity:example.grade?{indicatorId:'int-grade',value:example.grade,scale:example.scale}:{indicatorId:e.primaryIndicatorId,assessmentId:a.id,percent:example.percent},volume:example.volume,expectedRevision:0};
}
test('development initialization is explicit, idempotent and preserves every legacy record',()=>{
 const f=setup(false),legacy=JSON.parse(JSON.stringify(f.tables));delete f.properties.LIBRARY_SPREADSHEET_ID;
 assert.throws(()=>f.context.initializeLibraryDevelopment_(),/CONFIGURATION_ERROR/);assert.deepEqual(f.tables,legacy);
 f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();const seeded=JSON.stringify(f.tables);f.context.initializeLibraryDevelopment_();assert.equal(JSON.stringify(f.tables),seeded);
 for(const name of Object.keys(legacy))assert.deepEqual(f.tables[name],legacy[name]);
 assert.equal(ok(f.lib('listExercises')).length,10);assert.equal(f.tables.AVALIACOES.length,1);assert.equal(f.tables.PRESCRICOES.length,1);
 f.properties.ENVIRONMENT='production';error(f.lib('createExercise',{}),'CONFIGURATION_ERROR');
});
test('existing incompatible headers prevent all schema/catalog writes; partial seed can resume',()=>{
 const f=setup(false);f.tables.EXERCICIOS=[['legacy-column'],['do-not-change']];const before=JSON.stringify(f.tables);assert.throws(()=>f.context.initializeLibraryDevelopment_(),/SCHEMA_ERROR/);assert.equal(JSON.stringify(f.tables),before);
 const g=setup(false);g.fail('METODOS');assert.throws(()=>g.context.initializeLibraryDevelopment_());g.context.initializeLibraryDevelopment_();assert.equal(ok(g.lib('listExercises')).length,10);
});
test('exercise registration, stable IDs, canonical duplicate prevention and request replay',()=>{
 const f=setup(),d={name:'Exercício fictício de força',description:'Exemplo neutro',modality:'Força geral',primaryIndicatorId:'int-1rm',primaryVolumeUnitId:'unit-repetitions',volumeUnitIds:['unit-repetitions']};
 const a=ok(f.lib('createExercise',d,'new-exercise'));const b=ok(f.lib('createExercise',{...d},'new-exercise'));assert.equal(a.id,b.id);assert.equal(ok(f.lib('getExercise',{exerciseId:a.id})).name,d.name);
 error(f.lib('createExercise',{...d,name:'  EXERCICIO   FICTICIO DE FORCA  '},'another'),'CONFLICT');
 error(f.lib('createExercise',{...d,description:'changed'},'new-exercise'),'CONFLICT');
 const ids=ok(f.lib('listExercises')).map(e=>e.id);assert.equal(ids.length,new Set(ids).size);
});
test('exercise name reservation also prevents duplicates after a failed entity write',()=>{
 const f=setup(),d={name:'Exemplo reservado',description:'Teste',modality:'Força',primaryIndicatorId:'int-1rm',primaryVolumeUnitId:'unit-repetitions',volumeUnitIds:['unit-repetitions']};
 f.fail('EXERCICIOS');error(f.lib('createExercise',d,'reserved'),'INTERNAL_ERROR');error(f.lib('createExercise',d,'competing'),'CONFLICT');assert.ok(ok(f.lib('createExercise',d,'reserved')).id);
});
test('one exercise associates with different methods/capacities without duplicating exercise',()=>{
 const f=setup(),before=ok(f.lib('listExercises')).length;
 const a=ok(f.lib('linkExerciseMethod',{exerciseId:'exercise-bench',methodId:'method-isometric'},'m'));
 assert.equal(ok(f.lib('linkExerciseMethod',{methodId:'method-isometric',exerciseId:'exercise-bench'},'m')).id,a.id);
 error(f.lib('linkExerciseMethod',{exerciseId:'exercise-bench',methodId:'method-isometric'},'m2'),'CONFLICT');
 ok(f.lib('linkExerciseCapacity',{exerciseId:'exercise-bench',capacityId:'manifest-power'}));
 const e=ok(f.lib('getExercise',{exerciseId:'exercise-bench'}));assert.ok(e.methods.length>1);assert.ok(e.capacities.some(c=>c.capacityId==='manifest-power'));assert.equal(ok(f.lib('listExercises')).length,before);
 assert.equal(e.classification,undefined);
});
test('all four fictitious examples retain distinct units and expected volume',()=>{
 for(const example of examples){const f=setup(),d=requestFor(f,example),v=ok(f.lib('validateLoad',d));assert.equal(v.volume.total,example.expected,example.name);assert.equal(v.volume.unitId,example.volume.unitId);assert.equal(v.volume.mode,'prescribed');if(example.grade){assert.equal(v.intensity.value,'V4');assert.equal(v.intensity.scale,'V-scale');assert.equal(v.intensity.targetValue,undefined);}else assert.equal(v.intensity.targetValue,example.referenceValue*example.percent/100);}
});
test('heterogeneous performed sets are summed; zero is valid only for executed amounts',()=>{
 const f=setup(),exercise=f.context.libraryExercise_(f.context.db_(),'exercise-bench');
 const actual={kind:'repetitions',unitId:'unit-repetitions',sets:[{repetitions:5},{repetitions:3},{repetitions:0}]};
 assert.equal(f.context.libraryVolume_(exercise,actual,'executed').total,8);assert.throws(()=>f.context.libraryVolume_(exercise,actual,'prescribed'),/INVALID_DATA/);
});
test('intensity mismatches, ordinal percentages, missing grade scale and unit mismatches fail',()=>{
 const f=setup(),d=requestFor(f);error(f.lib('validateLoad',{...d,intensity:{indicatorId:'int-hrmax',assessmentId:'none',percent:80}}),'INCOMPATIBLE_INDICATOR');
 error(f.lib('validateLoad',{...d,volume:{...d.volume,unitId:'unit-hand-moves'}}),'INCOMPATIBLE_UNIT');
 const g=setup(),b=requestFor(g,examples[2]);error(g.lib('validateLoad',{...b,intensity:{indicatorId:'int-grade',percent:80,value:'V4',scale:'V-scale'}}),'INVALID_DATA');error(g.lib('validateLoad',{...b,intensity:{indicatorId:'int-grade',value:'V4'}}),'INVALID_DATA');
});
test('campus remains descriptive, and auxiliary RPE never replaces the primary indicator',()=>{
 const f=setup(),p=parent(f),campus={workoutId:p.w.id,itemId:p.item.id,exerciseId:'exercise-campus',methodId:'method-dynamic-effort',classification:'specific',intensity:{indicatorId:'int-campus',description:'Referência mecânica fictícia pendente de definição.'},volume:{kind:'hand_moves',unitId:'unit-hand-moves',blocks:[{moves:[5]}]},expectedRevision:0};
 const result=ok(f.lib('validateLoad',campus));assert.equal(result.intensity.methodologyPending,true);assert.equal(result.intensity.targetValue,undefined);
 error(f.lib('validateLoad',{...campus,intensity:{...campus.intensity,percent:80}}),'INVALID_DATA');
 const d=requestFor(f,examples[3],p);const v=ok(f.lib('validateLoad',{...d,auxiliaryIntensities:[{indicatorId:'int-rpe',value:7}]}));assert.equal(v.intensity.indicatorId,'int-1rm');assert.equal(v.auxiliaryIntensities[0].indicatorId,'int-rpe');
});
test('assessments must exist, match the student/exercise, remain current, and use explicit reference units',()=>{
 const f=setup(),d=requestFor(f);error(f.lib('validateLoad',{...d,intensity:{...d.intensity,assessmentId:'missing'}}),'ASSESSMENT_NOT_FOUND');
 error(f.lib('recordAssessment',{studentId:'s1',exerciseId:'exercise-bench',indicatorId:'int-1rm',value:100,unitId:'unit-newton',protocol:'Teste',referenceDefinition:'Teste',assessedOn:'2026-11-01',validUntil:'2026-12-31'}),'INCOMPATIBLE_UNIT');
 const stale=assessment(f,'exercise-bench',{validUntil:'2026-11-10'});error(f.lib('validateLoad',{...d,intensity:{...d.intensity,assessmentId:stale.id}}),'ASSESSMENT_OUTDATED');
 f.tables.Links.push(['l2','c1','s2',true]);const other=assessment(f,'exercise-bench',{studentId:'s2'});error(f.lib('validateLoad',{...d,intensity:{...d.intensity,assessmentId:other.id}}),'ASSESSMENT_NOT_FOUND');
});
test('prescriptions snapshot assessments, append revisions and recover child writes without rewriting history',()=>{
 const f=setup(),d=requestFor(f),legacy=JSON.stringify({items:f.tables.Items,workouts:f.tables.Workouts});
 f.fail('PRESCRICAO_SERIES');error(f.lib('createLibraryPrescription',d,'p'),'INTERNAL_ERROR');
 const first=ok(f.lib('createLibraryPrescription',d,'p'));assert.equal(first.totalVolume,15);assert.equal(ok(f.lib('createLibraryPrescription',d,'p')).id,first.id);assert.equal(f.tables.PRESCRICAO_SERIES.length,6);
 const snapshot=first.snapshotJson;const old=f.tables.AVALIACOES[1].slice();const replacement=assessment(f,'exercise-bench',{value:110,assessedOn:'2026-11-02',supersedesId:d.intensity.assessmentId});assert.deepEqual(f.tables.AVALIACOES[1],old);
 error(f.lib('validateLoad',d),'ASSESSMENT_OUTDATED');
 const next=ok(f.lib('createLibraryPrescription',{...d,classification:'general',intensity:{...d.intensity,assessmentId:replacement.id},expectedRevision:1},'p2'));assert.equal(next.revision,2);assert.equal(next.supersedesId,first.id);
 const saved=ok(f.lib('getLibraryPrescription',{prescriptionId:first.id}));assert.equal(saved.snapshotJson,snapshot);assert.equal(JSON.parse(snapshot).intensity.reference.value,100);assert.equal(saved.series.length,5);
 assert.equal(JSON.stringify({items:f.tables.Items,workouts:f.tables.Workouts}),legacy);
 error(f.lib('createLibraryPrescription',{...d,intensity:{...d.intensity,assessmentId:replacement.id},expectedRevision:1},'stale'),'CONFLICT');
});
test('student isolation, coach-only administration and existing OAuth identity are enforced',()=>{
 const f=setup(),d=requestFor(f),p=ok(f.lib('createLibraryPrescription',d,'p')),assessmentId=d.intensity.assessmentId;
 f.as('two@example.invalid');error(f.lib('getLibraryPrescription',{prescriptionId:p.id}),'NOT_FOUND');error(f.lib('getAssessment',{assessmentId}),'NOT_FOUND');error(f.lib('createExercise',{}),'FORBIDDEN');
 f.as('one@example.invalid');assert.equal(ok(f.lib('getLibraryPrescription',{prescriptionId:p.id})).studentId,'s1');assert.equal(ok(f.lib('getAssessment',{assessmentId})).studentId,'s1');error(f.lib('recordAssessment',{}),'FORBIDDEN');
 f.as('');error(f.lib('catalog'),'UNAUTHENTICATED');
 f.as('coach@example.invalid');f.tables.Users.push(['c2','other-coach@example.invalid','coach',true]);error(f.lib('catalog'),'CONFIGURATION_ERROR');
});
test('lock contention and failed prescription reservations prevent duplicate writes',()=>{
 const f=setup(),d=requestFor(f);f.busy(true);error(f.lib('createLibraryPrescription',d,'p'),'BUSY');f.busy(false);f.fail('PRESCRICOES');error(f.lib('createLibraryPrescription',d,'p'),'INTERNAL_ERROR');error(f.lib('createLibraryPrescription',d,'p2'),'CONFLICT');assert.ok(ok(f.lib('createLibraryPrescription',d,'p')).id);assert.equal(f.tables.PRESCRICOES.length,2);
});
test('aerobic and flexibility indicators preserve reference units and configurable volume units',()=>{
 const f=setup(),p=parent(f);
 for(const c of [{exerciseId:'exercise-running',indicatorId:'int-hrmax',unitId:'unit-bpm',value:180,methodId:'method-continuous-uniform',volume:{kind:'distance',unitId:'unit-meters',sets:[{meters:1000},{meters:500}]},expected:1500},{exerciseId:'exercise-stretch',indicatorId:'int-rommax',unitId:'unit-degrees',value:120,methodId:'method-isometric',volume:{kind:'time',unitId:'unit-seconds',sets:[{seconds:30},{seconds:45}]},expected:75}]){
  const a=assessment(f,c.exerciseId,{indicatorId:c.indicatorId,unitId:c.unitId,value:c.value});
  const result=ok(f.lib('validateLoad',{workoutId:p.w.id,itemId:p.item.id,exerciseId:c.exerciseId,methodId:c.methodId,classification:'general',intensity:{indicatorId:c.indicatorId,assessmentId:a.id,percent:80},volume:c.volume}));assert.equal(result.intensity.targetUnitId,c.unitId);assert.equal(result.volume.total,c.expected);
 }
});
test('hand moves are totals only, and seed catalog foreign keys remain valid',()=>{
 const f=setup(),exercise=f.context.libraryExercise_(f.context.db_(),'exercise-boulder');
 assert.equal(f.context.libraryVolume_(exercise,{kind:'hand_moves',unitId:'unit-hand-moves',blocks:[{moves:[7,4,2]}]},'executed').total,13);
 assert.throws(()=>f.context.libraryVolume_(exercise,{kind:'hand_moves',unitId:'unit-hand-moves',blocks:[{moves:[5],reboteios:2}]},'executed'),/INVALID_DATA/);
 const catalog=ok(f.lib('catalog')),unitIds=new Set(catalog.UNIDADES.map(u=>u.id)),indicators=new Set(catalog.INDICADORES.map(i=>i.id));
 for(const e of ok(f.lib('listExercises'))){assert.ok(indicators.has(e.primaryIndicatorId));assert.ok(unitIds.has(e.primaryVolumeUnitId));for(const id of JSON.parse(e.volumeUnitIdsJson))assert.ok(unitIds.has(id));}
 for(const i of catalog.INDICADORES)for(const id of JSON.parse(i.referenceUnitsJson))assert.ok(unitIds.has(id));
 assert.equal(catalog.CAPACIDADES.filter(c=>c.kind==='capacity').length,4);
});
test('data dictionary covers every physical field in the new schema',()=>{
 const f=setup(false),csv=fs.readFileSync('docs/biblioteca/DICIONARIO.csv','utf8');
 for(const [table,fields] of Object.entries(f.context.LIBRARY_SCHEMA_))for(const field of fields)assert.ok(csv.includes('\n'+table+','+field+','),table+'.'+field);
});
