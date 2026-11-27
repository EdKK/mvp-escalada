const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {fixture}=require('./helpers/gas.cjs');

const v30='d57adae1e1bbf34c698bf68dc0273149df3aa62a';
const modules=['Backend','Auth','TrainingLibrary','TrainingLoad','TrainingCatalog','GeneralCatalog',
  'PreventiveCatalog','StrengthPrescription','CoachLibrary','Student'];
const plain=value=>JSON.parse(JSON.stringify(value));
function ok(response){
  assert.equal(response.ok,true,JSON.stringify(response));
  return plain(response.data);
}
function setup(){
  const f=fixture(),{context,tables}=f;
  function install(version='candidate'){
    for(const name of modules){
      if(version===v30&&name==='PreventiveCatalog')continue;
      const path='apps-script/'+name+'.gs';
      vm.runInContext(version===v30?execFileSync('git',['show',version+':'+path],{encoding:'utf8'}):fs.readFileSync(path,'utf8'),
        context,{filename:path});
    }
  }
  install();
  f.properties.LIBRARY_SPREADSHEET_ID='test-only';
  context.initializeLibraryDevelopment_();
  context.prepararCatalogoGeralHomologacao_();
  const token=email=>context.issueSession_({email,sub:email});
  const coach=token('coach@example.invalid'),student=token('one@example.invalid'),other=token('two@example.invalid');
  const library=(action,data={},requestId,sessionToken=coach)=>context.libraryApi({action,data,requestId,sessionToken});
  const api=(action,data,requestId,sessionToken=student)=>context.api({action,data,requestId,sessionToken});
  const session={studentId:'s1',date:'2026-11-18',microcycleType:'Ordinário',instructions:['Aquecimento.']};
  const save=(items,requestId)=>library('saveCoachSession',{session,items},requestId);
  return {install,library,api,save,tables,coach,student,other,session};
}
const exercise=(exerciseId,fields={})=>({block:'Treinamento geral',classification:'general',
  preventive:{version:1,exerciseId,sets:3,repetitionsPerSet:5,...fields}});

test('catalog is coach-only, read-only and reconciles all 84 occurrences without changing musculação',()=>{
  const f=setup();
  const before=JSON.stringify(f.tables);
  const {version,exercises}=ok(f.library('listPreventiveCatalog'));
  assert.equal(version,1);
  assert.equal(exercises.length,65);
  assert.equal(new Set(exercises.map(row=>row.id)).size,65);
  assert.equal(new Set(exercises.map(row=>row.name)).size,65);
  const groups={};
  for(const row of exercises){
    assert.match(row.id,/^prev-\d{2}$/);
    assert.equal(typeof row.band,'boolean');
    assert.ok(row.references.length);
    for(const ref of row.references){
      const group=groups[ref.subgroup]??={};
      (group[ref.category]??=[]).push(ref.page);
    }
  }
  for(const categories of Object.values(groups))for(const pages of Object.values(categories))pages.sort((a,b)=>a-b);
  assert.deepEqual(groups,{
    Gerais:{Ombros:[20,21,22,22,23,24],Cotovelos:[25,26],Punhos:[27],Tronco:[28,29,29],Quadril:[30],
      'Membros inferiores':[31,32],Pés:[33,33]},
    'Específicos para lesões':{Ombros:[41,42,42,43,43,44,45,45,46,46,47,48,49,49,50,51,51,52,52,53,54,55,55],
      Cotovelos:[57,57,58,58,59,59,60,61,61,62,62,63,64,64],Punhos:[65,66,66,67],Dedos:[69,69],
      'Coluna e tronco':[70,71,72,73,73,74,74,75,76,76,77,77],Quadril:[78,79,79,80,81,82,82],Joelhos:[83,84,84],Tornozelos:[85,85]}
  });
  const byId=id=>exercises.find(row=>row.id===id);
  assert.deepEqual(byId('prev-07').references.map(ref=>ref.page),[25,58,69]);
  assert.deepEqual(byId('prev-25').references.map(ref=>ref.page),[47,48]);
  for(const [id,page] of [['prev-03',22],['prev-29',52],['prev-36',59],['prev-40',62],['prev-45',66]]){
    assert.equal(byId(id).references[0].page,page);
  }
  assert.equal(ok(f.library('listGeneralCatalog')).exercises.length,183);
  assert.equal(f.library('listPreventiveCatalog',{},undefined,f.student).error.code,'FORBIDDEN');
  assert.equal(f.library('listPreventiveCatalog',{category:'Dedos'}).error.code,'INVALID_DATA');
  assert.equal(JSON.stringify(f.tables),before);
});

test('preventive inputs validate atomically, retry safely and round-trip through an independent model',()=>{
  const f=setup(),before=JSON.stringify(f.tables);
  const minimal=exercise('prev-13'),band=exercise('prev-07',{sets:2,resistance:'Forte',guidance:'Pausar antes de repetir.'});
  const invalid=[
    [exercise('mus-peitoral-001'),'NOT_FOUND'],[exercise('prev-07',{resistance:'Moderada'}),'INVALID_DATA'],
    [exercise('prev-07',{resistance:60}),'INVALID_DATA'],[exercise('prev-07',{guidance:'=1+2'}),'INVALID_DATA'],
    [exercise('prev-07',{version:2}),'INVALID_DATA'],[exercise('prev-07',{sets:0}),'INVALID_DATA'],
    [exercise('prev-07',{repetitionsPerSet:2.5}),'INVALID_DATA'],[exercise('prev-07',{kilograms:20}),'INVALID_DATA'],
    [exercise('prev-07',{execution:'unilateral'}),'INVALID_DATA'],[{...minimal,classification:'directed'},'INVALID_DATA']
  ];
  for(const [index,[item,code]] of invalid.entries()){
    assert.equal(f.save([minimal,item],'invalid-'+index).error.code,code);
    assert.equal(JSON.stringify(f.tables),before);
  }

  const strength={block:'Treinamento geral',classification:'general',strength:{version:1,exerciseId:'mus-peitoral-001',
    sets:2,repetitionsPerSet:6,restBetweenSetsSeconds:60,kilograms:10,condition:'added',execution:'unilateral',loadBasis:'total'}};
  const result=ok(f.save([minimal,band,strength],'mixed'));
  assert.deepEqual(ok(f.save([minimal,band,strength],'mixed')),result);
  const read=id=>ok(f.api('getWorkout',{workoutId:id}));
  const source=read(result.workoutId);
  const [first,second,third]=source.items;
  assert.deepEqual(first.prescription.preventive,minimal.preventive);
  assert.equal(first.prescription.volume.total,15);
  assert.equal(first.prescription.intensity.primary.notPrescribed,true);
  assert.equal(first.prescription.snapshot.exercise.band,false);
  assert.deepEqual(second.prescription.preventive,band.preventive);
  assert.equal(second.prescription.snapshot.exercise.band,true);
  assert.equal(second.prescription.rpeApplicable,true);
  assert.equal(second.notes,band.preventive.guidance);
  assert.equal(second.prescription.volume.total,10);
  assert.equal(third.prescription.volume.total,24);

  const created=ok(f.library('createSessionModel',{workoutId:source.id,name:'Preventivos'},'model'));
  const {payload}=ok(f.library('getSessionModel',{modelId:created.id}));
  assert.equal(payload.version,3);
  assert.deepEqual(payload.session,{microcycleType:'Ordinário',instructions:['Aquecimento.']});
  assert.deepEqual(payload.items.map(row=>row.input),[minimal,band,strength]);
  assert.deepEqual(payload.items.slice(0,2).map(row=>row.display.band),[false,true]);
  payload.items[0].input.preventive.sets=5;
  const copied=ok(f.save(payload.items.map(item=>item.input),'copied'));
  assert.equal(read(copied.workoutId).items[0].prescription.volume.total,25);
  assert.notEqual(read(copied.workoutId).items[0].id,first.id);
  assert.equal(ok(f.library('getSessionModel',{modelId:created.id})).payload.items[0].input.preventive.sets,3);
  ok(f.library('deleteSessionModel',{modelId:created.id},'delete'));
  assert.equal(read(source.id).items[0].prescription.volume.total,15);
});

test('v30 reads preventive prescriptions and feedback aggregates without replacing blanks or zeros',()=>{
  const f=setup();
  const {workoutId}=ok(f.save([exercise('prev-07',{resistance:'Média'}),exercise('prev-13')],'session'));
  const read=(token=f.student)=>ok(f.api('getWorkout',{workoutId},undefined,token));
  const [first,second]=read().items;
  const submit=(item,requestId,data,token=f.student)=>f.api('submitItemFeedback',{workoutId,itemId:item.id,...data},requestId,token);
  const empty=ok(submit(first,'empty',{expectedRevision:0,status:'completed',completeOnly:true}));
  assert.deepEqual(ok(submit(first,'empty',{expectedRevision:0,status:'completed',completeOnly:true})),empty);
  const sparse=ok(submit(first,'sparse',{expectedRevision:1,status:'partial',actualSets:0,rpe:6}));
  const complete=ok(submit(first,'complete',{expectedRevision:2,status:'completed',completeOnly:true}));
  const full=ok(submit(first,'full',{expectedRevision:3,status:'completed',actualSets:3,actualQuantity:15,
    quantityUnit:'repetitions',fingerPain:0,rpe:7,comment:'Concluído.'}));
  assert.deepEqual([empty.actualSets,empty.actualQuantity,empty.fingerPain,sparse.actualSets,sparse.actualQuantity,
    complete.actualSets,complete.actualQuantity,complete.rpe,full.actualQuantity,full.fingerPain],['','','',0,'',0,'',6,15,0]);
  assert.equal(read().itemFeedback.filter(row=>row.itemId===second.id).length,0);
  assert.equal(f.api('getWorkout',{workoutId},undefined,f.other).error.code,'NOT_FOUND');
  const model=ok(f.library('createSessionModel',{workoutId,name:'Preventivos'},'model'));
  const before=JSON.stringify(f.tables);

  f.install(v30);
  assert.equal(read().items[0].prescription.volume.total,15);
  assert.equal(read().items[0].prescription.preventive,undefined);
  assert.equal(read().items[0].prescription.intensity.primary.value,'Média');
  for(const token of [f.student,f.coach])assert.deepEqual(read(token).itemFeedback,[empty,sparse,complete,full]);
  assert.equal(f.library('getSessionModel',{modelId:model.id}).error.code,'SCHEMA_ERROR');
  assert.equal(submit(first,'legacy-rpe',{expectedRevision:4,status:'completed',fingerPain:0,rpe:7}).error.code,'INVALID_DATA');
  assert.equal(JSON.stringify(f.tables),before);
  const legacyEdit=ok(submit(first,'legacy-edit',{expectedRevision:4,status:'completed',fingerPain:0,actualQuantity:0,
    quantityUnit:'repetitions'}));

  f.install();
  assert.deepEqual(read().items[0].prescription.preventive,first.prescription.preventive);
  assert.deepEqual(read().itemFeedback,[empty,sparse,complete,full,legacyEdit]);
  assert.equal(ok(f.library('getSessionModel',{modelId:model.id})).payload.version,3);
});
