/* Specific training contract tests: in-memory services, no real Google execution. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const {fixture}=require('./helpers/gas.cjs');
const client=vm.createContext({});vm.runInContext(fs.readFileSync('apps-script/Index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI integration')[0],client);vm.runInContext(fs.readFileSync('student/model.js','utf8'),client);const C=client.SpecificTaskModel,M=client.StudentModel;
const definitions=C.definitions;function ok(r){assert.equal(r.ok,true,JSON.stringify(r));return r.data;}function error(r,code='INVALID_DATA'){assert.equal(r.ok,false);assert.equal(r.error.code,code);}
function setup(){const f=fixture();for(const n of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary'])vm.runInContext(fs.readFileSync('apps-script/'+n+'.gs','utf8'),f.context);f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();let seq=0;
 const tokens={coach:f.context.issueSession_({email:'coach@example.invalid',sub:'12345'}),a:f.context.issueSession_({email:'one@example.invalid',sub:'12345'}),b:f.context.issueSession_({email:'two@example.invalid',sub:'12345'})};
 f.lib=(action,data={},key='r'+(++seq),actor='coach')=>f.context.libraryApi({action,data,requestId:key,sessionToken:tokens[actor]});f.api=(action,data={},key='a'+(++seq),actor='coach')=>f.context.api({action,data,requestId:key,sessionToken:tokens[actor]});f.w=ok(f.api('createWorkout',{studentId:'s1',date:'2026-11-24',goal:'Tarefas de escalada'},'workout'));
 f.data=(subblock,moves)=>({workoutId:f.w.id,exerciseId:'exercise-boulder',block:'Treinamento específico',category:'',metric:'Moves',quantity:moves,minutes:5,classification:'specific',intensity:{indicatorId:'int-grade'},volume:{kind:'hand_moves',unitId:'unit-hand-moves',blocks:[{moves:[moves]}]},task:{version:1,subblock}});
 f.read=(actor='a')=>ok(f.api('getWorkout',{workoutId:f.w.id},undefined,actor));return f;
}
test('client/server subblock bounds and both explicit grade scales are identical',()=>{
 const f=setup();assert.equal(JSON.stringify(C.definitions),JSON.stringify(f.context.specificTaskDefinitions_()));
 for(const scale of ['Hueco','Brasileira'])assert.equal(JSON.stringify(C.grades(scale)),JSON.stringify(f.context.specificTaskGrades_(scale)));
 assert.equal(C.grades('Hueco').length,16);assert.equal(C.grades('Brasileira').length,24);
});
test('all five subblocks persist and recover their boundary sequences: 2,6,7,10,11,25,26,40,41',()=>{
 const f=setup();for(const d of definitions)for(const moves of d.max===null?[41,100]:[d.min,d.max]){
  const saved=ok(f.lib('saveCoachPrescription',f.data(d.id,moves)));const p=f.read().items.find(i=>i.id===saved.item.id).prescription;
  assert.equal(p.task.subblock,d.id);assert.equal(p.task.label,d.label);assert.equal(p.task.minMoves,d.min);assert.equal(p.task.maxMoves,d.max);assert.equal(p.intensity.primary.scale,d.scale);assert.equal(p.intensity.primary.notPrescribed,true);assert.equal(p.series[0].quantity,moves);assert.equal(p.volume.unitId,'unit-hand-moves');assert.equal(p.snapshot.method,null);assert.equal(saved.prescription.methodId,'');assert.equal(saved.item.category,'');assert.match(p.task.movementDefinition,/juntar.*rebotear/);
 }
});
test('neighboring ranges and invalid characteristics are rejected before reservations/writes',()=>{
 for(const [sub,moves] of [['boulder_short',1],['boulder_short',7],['boulder_long',6],['boulder_long',11],['resistance_short',10],['resistance_short',26],['resistance_long',25],['resistance_long',41],['continuity',40]]){const f=setup(),before=JSON.stringify(f.tables);error(f.lib('saveCoachPrescription',f.data(sub,moves)));assert.equal(JSON.stringify(f.tables),before);}
 for(const quantity of [1,7,2.5]){const f=setup(),data=f.data('boulder_short',6),before=JSON.stringify(f.tables);data.quantity=quantity;error(f.lib('saveCoachPrescription',data));assert.equal(JSON.stringify(f.tables),before);}
 for(const patch of [{version:2},{subblock:'physiological-power'},{orientation:'automatic'},{wallInclination:'-15_0'},{wallInclination:'positive-wall'},{restSeconds:-1},{restSeconds:1.5},{restSeconds:86401},{capacity:'inferred'}]){const f=setup(),data=f.data('boulder_short',6),before=JSON.stringify(f.tables);data.task={...data.task,...patch};error(f.lib('saveCoachPrescription',data));assert.equal(JSON.stringify(f.tables),before);}
});
test('Hueco belongs to short/long boulder; Brazilian scale belongs to resistance/continuity, without grade conversion',()=>{
 const f=setup();for(const d of definitions)for(const value of d.scale==='Hueco'?['V0','V15']:['4º','4º sup','6º sup','7a','12c']){const data=f.data(d.id,d.min);data.intensity={indicatorId:'int-grade',value,scale:d.scale};const saved=ok(f.lib('saveCoachPrescription',data));const primary=JSON.parse(saved.prescription.intensityJson).primary;assert.equal(primary.value,value);assert.equal(primary.scale,d.scale);assert.equal(primary.percent,undefined);}
 for(const [sub,value,scale] of [['boulder_short','V16','Hueco'],['boulder_long','7a','Hueco'],['resistance_short','V4','Hueco'],['resistance_long','7a','Hueco'],['continuity','13a','Brasileira'],['boulder_short','V4','V-scale']]){const data=f.data(sub,C.definition(sub).min);data.intensity={indicatorId:'int-grade',value,scale};error(f.lib('saveCoachPrescription',data));}
});
test('orientation, all wall bands and optional rest/grade survive snapshot and student hydration',()=>{
 const f=setup();for(const orientation of ['horizontal','vertical','mixed'])for(const wallInclination of ['0_15','15_30','30_45','over_45']){
  const data=f.data('boulder_long',7);data.task={...data.task,orientation,wallInclination,restSeconds:90};const saved=ok(f.lib('saveCoachPrescription',data));const p=f.read().items.find(i=>i.id===saved.item.id).prescription;
  assert.equal(p.task.orientation,orientation);assert.equal(p.task.wallInclination,wallInclination);assert.equal(p.restSeconds,90);assert.equal(M.intensity(p),'Não informada');assert.match(M.prescriptionDetails(p).join(' '),/0° vertical; positivo é extraprumo/);
 }
 const data=f.data('continuity',41);data.task.restSeconds=0;const p=JSON.parse(ok(f.lib('saveCoachPrescription',data)).prescription.snapshotJson).task;assert.equal(p.restSeconds,0);assert.equal(p.orientation,undefined);assert.equal(p.wallInclination,undefined);
});
test('subblock extent applies to EACH sequence, not total volume; heterogeneous sequences remain editable',()=>{
 const f=setup(),data=f.data('boulder_short',6);data.volume.blocks=[{moves:[2,6]},{moves:[6,4]}];const saved=ok(f.lib('saveCoachPrescription',data)),p=f.read().items[0].prescription;assert.equal(p.volume.total,18);assert.equal(p.series.length,4);assert.equal(p.task.subblock,'boulder_short');assert.equal(saved.item.quantity,6);
 const invalid={...data,volume:{...data.volume,blocks:[{moves:[2,7]}]}};error(f.lib('saveCoachPrescription',invalid));
});
test('two specific tasks in one session preserve characteristics through feedback and trainer recovery',()=>{
 const f=setup(),first=f.data('boulder_short',6);first.intensity={indicatorId:'int-grade',value:'V3',scale:'Hueco'};first.task={...first.task,orientation:'horizontal',wallInclination:'30_45',restSeconds:120};const a=ok(f.lib('saveCoachPrescription',first));
 const second=f.data('resistance_short',11);second.exerciseId='exercise-route';second.intensity={indicatorId:'int-grade',value:'7a',scale:'Brasileira'};second.task.orientation='vertical';const b=ok(f.lib('saveCoachPrescription',second));
 const before=JSON.stringify([f.tables.PRESCRICOES,f.tables.PRESCRICAO_SERIES,f.tables.Items]);const w=f.read();assert.equal(w.items.length,2);assert.equal(w.items[0].prescription.task.orientation,'horizontal');assert.equal(w.items[1].prescription.task.subblock,'resistance_short');assert.equal(w.items[1].id,b.item.id);
 const fb=ok(f.api('submitItemFeedback',{workoutId:f.w.id,itemId:a.item.id,status:'partial',fingerPain:1,actualSets:1,actualQuantity:2,quantityUnit:'moves',expectedRevision:0},'fb','a'));assert.equal(f.read('coach').itemFeedback[0].id,fb.id);assert.equal(f.read('coach').items[0].prescription.task.restSeconds,120);assert.equal(JSON.stringify([f.tables.PRESCRICOES,f.tables.PRESCRICAO_SERIES,f.tables.Items]),before);
});
test('task metadata remains attached across partial-write recovery, idempotent replay and conflicts',()=>{
 const f=setup(),data=f.data('boulder_short',6);data.task.orientation='mixed';f.fail('PRESCRICAO_SERIES');error(f.lib('saveCoachPrescription',data,'save'),'INTERNAL_ERROR');assert.equal(f.read().items.length,0);const saved=ok(f.lib('saveCoachPrescription',data,'save'));assert.equal(f.read().items[0].prescription.task.orientation,'mixed');assert.equal(ok(f.lib('saveCoachPrescription',data,'save')).prescription.id,saved.prescription.id);error(f.lib('saveCoachPrescription',{...data,task:{...data.task,orientation:'vertical'}},'save'),'CONFLICT');assert.equal(f.tables.Items.length,2);
});
test('general/directed and historical specific requests keep original required method/intensity rules and schemas',()=>{
 const f=setup(),old=ok(f.api('addItem',{workoutId:f.w.id,block:'Aquecimento',category:'Technique',exercise:'Registro antigo',metric:'Reps',quantity:3,minutes:5},'old')),original=JSON.stringify(f.tables.Items[1]),tables=Object.keys(f.tables).sort().join(',');
 for(const classification of ['general','directed','specific']){const data=f.data('boulder_short',6);delete data.task;data.classification=classification;data.category='Power';data.block='Boulder';data.methodId='method-circuit';data.intensity={indicatorId:'int-grade',value:'V4',scale:'V-scale'};const saved=ok(f.lib('saveCoachPrescription',data));assert.equal(JSON.parse(saved.prescription.snapshotJson).task,undefined);assert.equal(saved.prescription.classification,classification);assert.equal(saved.item.block,'Boulder');error(f.lib('saveCoachPrescription',{...data,methodId:undefined}));error(f.lib('saveCoachPrescription',{...data,intensity:{indicatorId:'int-grade'}}));}
 assert.equal(JSON.stringify(f.tables.Items[1]),original);assert.equal(f.read().items.find(i=>i.id===old.id).exercise,'Registro antigo');assert.equal(Object.keys(f.tables).sort().join(','),tables);for(const row of f.tables.Items)assert.equal(row.length,10);for(const row of f.tables.PRESCRICOES)assert.equal(row.length,f.context.LIBRARY_SCHEMA_.PRESCRICOES.length);
});
test('new task options cannot bypass authorization or exercise/method validation',()=>{
 const f=setup(),data=f.data('boulder_short',6),saved=ok(f.lib('saveCoachPrescription',data));error(f.lib('saveCoachPrescription',data,'bad','a'),'FORBIDDEN');error(f.api('getWorkout',{workoutId:f.w.id},undefined,'b'),'NOT_FOUND');error(f.lib('getLibraryPrescription',{prescriptionId:saved.prescription.id},undefined,'b'),'NOT_FOUND');error(f.lib('saveCoachPrescription',{...data,classification:'general'}));error(f.lib('saveCoachPrescription',{...data,methodId:'method-isometric'}));error(f.lib('saveCoachPrescription',{...data,block:'Boulder'}));
});
