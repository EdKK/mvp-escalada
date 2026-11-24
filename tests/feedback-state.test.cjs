/* State/dose regression with fictitious, in-memory sheets only. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/gas.cjs');
function ok(r){assert.equal(r.ok,true,JSON.stringify(r));return r.data;}function invalid(r,code='INVALID_DATA'){assert.equal(r.ok,false);assert.equal(r.error.code,code);}
function setup(library=false){
 const f=fixture(),w=ok(f.call('createWorkout',{studentId:'s1',date:'2026-11-23',goal:'Força'},'workout'));let item;
 if(library){for(const n of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary'])vm.runInContext(fs.readFileSync('apps-script/'+n+'.gs','utf8'),f.context);f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();const token=f.context.issueSession_({email:'coach@example.invalid',sub:'12345'});const lib=(action,data,requestId)=>f.context.libraryApi({action,data,requestId,sessionToken:token});const a=ok(lib('recordAssessment',{studentId:'s1',exerciseId:'exercise-bench',indicatorId:'int-1rm',value:100,unitId:'unit-kg',protocol:'Fictício',referenceDefinition:'Fictícia',assessedOn:'2026-11-01',validUntil:'2026-12-31'},'a'));
 item=ok(lib('saveCoachPrescription',{workoutId:w.id,exerciseId:'exercise-bench',methodId:'method-max-effort',classification:'general',block:'Força',category:'Pull strength',metric:'Reps',quantity:3,minutes:5,intensity:{indicatorId:'int-1rm',assessmentId:a.id,percent:85},volume:{kind:'repetitions',unitId:'unit-repetitions',sets:Array.from({length:5},()=>({repetitions:3}))}},'item')).item;
 }else item=ok(f.call('addItem',{workoutId:w.id,block:'Força',category:'Pull strength',exercise:'Supino fictício',metric:'Reps',quantity:3,minutes:5,prescription:{position:1,sets:5,quantity:3,quantityUnit:'repetitions'}},'item'));
 f.email('one@example.invalid');f.w=w;f.item=item;
 f.send=(patch={},key='feedback')=>f.call('submitItemFeedback',{workoutId:w.id,itemId:item.id,status:'not_done',fingerPain:3,comment:'fadiga',expectedRevision:0,...patch},key);
 return f;
}
test('not_done accepts only absent/zero execution on both legacy and library prescriptions',()=>{
 for(const library of [false,true])for(const dose of [{},{actualSets:0},{actualQuantity:0,quantityUnit:'repetitions'},{actualSets:0,actualQuantity:0,quantityUnit:'repetitions'}]){
  const f=setup(library),record=ok(f.send(dose));assert.equal(record.status,'not_done');assert.equal(record.fingerPain,3);assert.equal(record.comment,'fadiga');assert.equal(record.actualSets,dose.actualSets??'');assert.equal(record.actualQuantity,dose.actualQuantity??'');assert.equal(record.revision,1);
 }
});
test('not_done positive/mixed quantities are rejected before any reservation or write, including the version-14 case',()=>{
 for(const library of [false,true])for(const dose of [{actualSets:2},{actualQuantity:2,quantityUnit:'repetitions'},{actualSets:2,actualQuantity:2,quantityUnit:'repetitions'},{actualSets:0,actualQuantity:2,quantityUnit:'repetitions'},{actualSets:2,actualQuantity:0,quantityUnit:'repetitions'}]){
  const f=setup(library),before=JSON.stringify(f.tables);invalid(f.send(dose));assert.equal(JSON.stringify(f.tables),before);
 }
});
test('partial and completed preserve declared quantities without assuming the prescribed 5x3 dose',()=>{
 for(const library of [false,true])for(const status of ['partial','completed'])for(const dose of [{},{actualSets:0,actualQuantity:0,quantityUnit:'repetitions'},{actualSets:2,actualQuantity:2,quantityUnit:'repetitions'}]){
  const f=setup(library),before=JSON.stringify([f.tables.Workouts,f.tables.Items,f.tables.ItemPrescription,f.tables.PRESCRICOES,f.tables.PRESCRICAO_SERIES]);const record=ok(f.send({status,...dose}));assert.equal(record.status,status);assert.equal(record.actualSets,dose.actualSets??'');assert.equal(record.actualQuantity,dose.actualQuantity??'');assert.equal(JSON.stringify([f.tables.Workouts,f.tables.Items,f.tables.ItemPrescription,f.tables.PRESCRICOES,f.tables.PRESCRICAO_SERIES]),before);
 }
});
test('existing range, unit and revision checks still apply when execution is zero or absent',()=>{
 for(const library of [false,true])for(const patch of [{actualSets:-1},{actualSets:0.5},{actualQuantity:-1,quantityUnit:'repetitions'},{actualQuantity:0,quantityUnit:'moves'},{actualQuantity:0},{quantityUnit:'repetitions'},{fingerPain:11},{expectedRevision:-1}]){
  const f=setup(library);invalid(f.send(patch));assert.equal(f.tables.ItemFeedback.length,1);
 }
});
test('historical inconsistent row remains byte-identical; completion/corrections append revisions without replacing actual dose',()=>{
 for(const library of [false,true]){
  const f=setup(library),historical={id:'historical-feedback',workoutId:f.w.id,itemId:f.item.id,studentId:'s1',status:'not_done',rpe:'',fingerPain:3,comment:'fadiga',actualSets:2,actualQuantity:2,quantityUnit:'repetitions',revision:1,supersedesId:'',createdAt:'2026-11-20T12:00:00.000Z'};
  f.tables.ItemFeedback.push(f.context.SCHEMA_.ItemFeedback.map(k=>historical[k]));const original=JSON.stringify(f.tables.ItemFeedback[1]);
  const read=ok(f.call('getWorkout',{workoutId:f.w.id}));assert.equal(read.itemFeedback[0].actualSets,2);assert.equal(read.itemFeedback[0].status,'not_done');assert.equal(JSON.stringify(f.tables.ItemFeedback[1]),original);
  const second=ok(f.send({status:'completed',actualSets:2,actualQuantity:2,quantityUnit:'repetitions',expectedRevision:1},'completion'));assert.equal(second.revision,2);assert.equal(second.supersedesId,historical.id);assert.equal(second.actualSets,2);assert.equal(second.actualQuantity,2);assert.equal(JSON.stringify(f.tables.ItemFeedback[1]),original);
  const before=JSON.stringify(f.tables);invalid(f.send({actualSets:2,actualQuantity:2,quantityUnit:'repetitions',expectedRevision:2},'invalid-correction'));assert.equal(JSON.stringify(f.tables),before);
  const third=ok(f.send({actualSets:0,actualQuantity:0,quantityUnit:'repetitions',expectedRevision:2},'valid-correction'));assert.equal(third.revision,3);assert.equal(third.supersedesId,second.id);assert.equal(JSON.stringify(f.tables.ItemFeedback[1]),original);
  f.email('coach@example.invalid');const history=ok(f.call('getWorkout',{workoutId:f.w.id})).itemFeedback;assert.equal(history.length,3);assert.equal(history[0].actualQuantity,2);assert.equal(history[1].actualQuantity,2);assert.equal(history[2].actualQuantity,0);
 }
});
test('state correction preserves idempotency and stale-revision protection',()=>{
 const f=setup(true),data={actualSets:0,actualQuantity:0,quantityUnit:'repetitions'},first=ok(f.send(data));assert.equal(ok(f.send(data)).id,first.id);assert.equal(f.tables.ItemFeedback.length,2);invalid(f.send({status:'partial',actualSets:2,actualQuantity:2,quantityUnit:'repetitions'}),'CONFLICT');invalid(f.send({...data,status:'completed'},'stale'),'CONFLICT');assert.equal(f.tables.ItemFeedback.length,2);
});
