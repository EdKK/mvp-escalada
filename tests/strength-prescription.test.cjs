const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {fixture}=require('./helpers/gas.cjs');

const plain=value=>JSON.parse(JSON.stringify(value));
function ok(response){
  assert.equal(response.ok,true,JSON.stringify(response));
  return response.data;
}
function strength(exerciseId,changes={}){
  return {block:'Treinamento geral',classification:'general',strength:{version:1,exerciseId,sets:3,repetitionsPerSet:8,
    restBetweenSetsSeconds:120,kilograms:40,condition:'added',execution:'bilateral',loadBasis:'total',...changes}};
}
function setup(){
  const f=fixture();
  for(const name of ['TrainingLibrary','TrainingCatalog','GeneralCatalog','TrainingLoad','StrengthPrescription','CoachLibrary']){
    vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context);
  }
  f.properties.LIBRARY_SPREADSHEET_ID='test-only';
  f.context.initializeLibraryDevelopment_();
  f.context.prepararCatalogoGeralHomologacao_();
  f.tables.Links.push(['l2','c1','s2',true]);
  const token=email=>f.context.issueSession_({email,sub:email});
  const coach=token('coach@example.invalid'),student=token('one@example.invalid'),other=token('two@example.invalid');
  const call=(action,data={},requestId,sessionToken=coach)=>f.context.libraryApi({action,data,requestId,sessionToken});
  const get=(workoutId,sessionToken=student)=>f.context.api({action:'getWorkout',data:{workoutId},sessionToken});
  const submit=(data,requestId,sessionToken=student)=>f.context.api({action:'submitItemFeedback',data,requestId,sessionToken});
  const assessment=(exerciseId,value,requestId,patch={})=>call('recordAssessment',{studentId:'s1',exerciseId,indicatorId:'int-1rm',
    value,unitId:'unit-kg',protocol:'Teste direto',referenceDefinition:'musculacao:added:bilateral:total',
    assessedOn:'2026-11-01',validUntil:'2026-12-31',...patch},requestId);
  const session=(items,studentId='s1')=>({session:{studentId,date:'2026-11-18',microcycleType:'Ordinário',instructions:['Aquecer']},items});
  return {...f,coach,student,other,call,get,submit,assessment,session};
}

test('five strength items use the approved catalog and the existing integral session tables',()=>{
  const f=setup();
  const a=ok(f.assessment('mus-peitoral-001',80,'ref'));
  const items=[
    strength('mus-peitoral-001',{durationSeconds:2.5,restBetweenRepetitionsSeconds:4,guidance:'Pausa breve'}),
    strength('mus-dorsais-004',{execution:'unilateral',condition:'bodyweight',kilograms:0}),
    strength('mus-triceps-007',{condition:'assisted',kilograms:15}),
    strength('mus-quadriceps-005',{execution:'unilateral',loadBasis:'per_implement',kilograms:12.5}),
    strength('mus-pes-001',{condition:'bodyweight',kilograms:0,sets:2,repetitionsPerSet:5})
  ];
  const before=Object.keys(f.tables).sort(),legacy=plain(f.tables.EXERCICIOS);
  const {workoutId,count}=ok(f.call('saveCoachSession',f.session(items),'session'));
  assert.equal(count,5);
  const saved=plain(ok(f.get(workoutId)));
  assert.deepEqual(saved.items.map(item=>item.category),['Peitoral','Dorsais','Tríceps','Quadríceps','Pés']);
  assert.deepEqual(saved.items.map(item=>item.prescription.volume.total),[24,48,24,48,10]);
  assert.deepEqual(saved.items.map(item=>item.prescription.strength.oneRm?.percent??null),[50,null,null,null,null]);
  assert.deepEqual(saved.items[0].prescription.strength,{...items[0].strength,oneRm:{assessmentId:a.id,kilograms:80,percent:50}});
  assert.equal(saved.items[0].notes,'Pausa breve');
  assert.equal(saved.items[1].prescription.quantity,8);
  assert.equal(saved.items[1].prescription.restSeconds,120);
  assert.equal(saved.items[0].prescription.rpeApplicable,true);
  assert.deepEqual(Object.keys(f.tables).sort(),before);
  assert.deepEqual(f.tables.EXERCICIOS,legacy);
  const persisted=JSON.stringify(f.tables);
  assert.equal(ok(f.call('saveCoachSession',f.session(items),'session')).workoutId,workoutId);
  assert.equal(JSON.stringify(f.tables),persisted);
});

test('strength validation is atomic and rejects foreign IDs, invalid loads and injected references',()=>{
  const f=setup(),good=strength('mus-peitoral-001');
  const before=JSON.stringify(f.tables);
  const invalid=[
    [strength('exercise-bench'),'NOT_FOUND'],
    [strength('mus-peitoral-001',{restBetweenSetsSeconds:75}),'INVALID_DATA'],
    [strength('mus-peitoral-001',{condition:'bodyweight',kilograms:4}),'INVALID_DATA'],
    [strength('mus-peitoral-001',{condition:'assisted',kilograms:0}),'INVALID_DATA'],
    [strength('mus-peitoral-001',{condition:'added',kilograms:0}),'INVALID_DATA'],
    [strength('mus-peitoral-001',{repetitionsPerSet:6.2}),'INVALID_DATA'],
    [strength('mus-peitoral-001',{guidance:'=SUM(A1)'}),'INVALID_DATA'],
    [strength('mus-peitoral-001',{oneRm:{percent:60}}),'INVALID_DATA'],
    [{...good,methodId:'method-repetition'},'INVALID_DATA']
  ];
  invalid.forEach(([item,code],index)=>{
    const result=f.call('saveCoachSession',f.session([good,item]),'invalid-'+index);
    assert.equal(result.error.code,code);
    assert.equal(result.error.itemIndex,1);
    assert.equal(result.error.sessionNotStarted,true);
  });
  assert.equal(f.call('listStrengthReferences',{studentId:'s1',date:'2026-11-18'},'ref',f.student).error.code,'FORBIDDEN');
  assert.equal(JSON.stringify(f.tables),before);
});

test('1RM requires matching execution, basis, validity and one unambiguous direct assessment',()=>{
  const f=setup(),id='mus-peitoral-002',def='musculacao:added:unilateral:per_implement';
  const item=strength(id,{execution:'unilateral',loadBasis:'per_implement',kilograms:30});
  assert.equal(f.assessment(id,100,'invalid',{referenceDefinition:'Teste com halter'}).error.code,'INVALID_DATA');
  ok(f.assessment(id,200,'total'));
  ok(f.assessment(id,120,'expired',{referenceDefinition:def,validUntil:'2026-11-05'}));
  ok(f.assessment(id,120,'future',{referenceDefinition:def,assessedOn:'2026-11-19'}));
  const save=key=>{
    const {workoutId}=ok(f.call('saveCoachSession',f.session([item]),key));
    return ok(f.get(workoutId)).items[0].prescription.strength.oneRm;
  };
  assert.equal(save('unmatched'),undefined);
  const first=ok(f.assessment(id,60,'per',{referenceDefinition:def}));
  assert.equal(save('match').percent,50);
  const second=ok(f.assessment(id,50,'second',{referenceDefinition:def}));
  assert.equal(save('ambiguous'),undefined);
  const latest=ok(f.assessment(id,40,'revised',{referenceDefinition:def,assessedOn:'2026-11-10',supersedesId:second.id}));
  assert.equal(save('match-latest').assessmentId,latest.id);
  const rows=plain(ok(f.call('listStrengthReferences',{studentId:'s1',date:'2026-11-18'})));
  assert.ok(rows.some(row=>row.exerciseId===id&&row.definition===def&&row.kilograms===40));
  assert.equal(f.assessment(id,80,'wrong-chain',{referenceDefinition:def,supersedesId:first.id,studentId:'s2'}).error.code,'INVALID_DATA');
});

test('strength feedback records actual dose and survives retry, revision and the v29 read path',()=>{
  const f=setup();
  const {workoutId}=ok(f.call('saveCoachSession',f.session([strength('mus-gluteos-004',{execution:'unilateral'})]),'session'));
  const item=ok(f.get(workoutId)).items[0],before=JSON.stringify(f.tables.PRESCRICOES);
  const data={workoutId,itemId:item.id,strengthPrescriptionId:item.prescription.prescriptionId,status:'partial',fingerPain:2,
    rpe:7,comment:'Teste de execução',actualSets:2,actualRepetitions:7,actualKilograms:32.5,expectedRevision:0};
  assert.equal(f.submit(data,'feedback',f.other).error.code,'NOT_FOUND');
  assert.equal(f.submit({...data,actualQuantity:100},'invalid').error.code,'INVALID_DATA');
  f.fail('ItemFeedback');
  assert.equal(f.submit(data,'feedback').error.code,'INTERNAL_ERROR');
  const partial=ok(f.submit(data,'feedback'));
  assert.equal(partial.actualQuantity,28);
  assert.equal(partial.actualRepetitions,7);
  assert.equal(partial.actualKilograms,32.5);
  assert.equal(partial.rpe,7);
  assert.equal(ok(f.submit(data,'feedback')).id,partial.id);
  const completed=ok(f.submit({...data,status:'completed',expectedRevision:1,actualSets:3,actualRepetitions:6},'complete'));
  assert.equal(completed.actualQuantity,36);
  const absent={workoutId,itemId:item.id,strengthPrescriptionId:item.prescription.prescriptionId,status:'not_done',
    fingerPain:0,expectedRevision:2};
  assert.equal(f.submit({...absent,actualKilograms:5},'incorrect').error.code,'INVALID_DATA');
  const unreported=ok(f.submit(absent,'absent'));
  assert.deepEqual([unreported.actualSets,unreported.actualQuantity,unreported.actualRepetitions,unreported.actualKilograms],['','',undefined,undefined]);
  const zero=ok(f.submit({...absent,expectedRevision:3,actualSets:0,actualRepetitions:0,actualKilograms:0},'zero'));
  assert.deepEqual([zero.actualSets,zero.actualQuantity,zero.actualRepetitions,zero.actualKilograms],[0,0,0,0]);
  assert.equal(JSON.stringify(f.tables.PRESCRICOES),before);
  assert.equal(ok(f.get(workoutId,f.coach)).itemFeedback[1].actualKilograms,32.5);
  vm.runInContext(execFileSync('git',['show','45a5f35:apps-script/Student.gs'],{encoding:'utf8'}),f.context);
  const old=ok(f.get(workoutId,f.coach));
  assert.equal(old.items[0].prescription.volume.total,48);
  assert.equal(old.itemFeedback[1].actualQuantity,36);
});

test('model copies preserve the strength parameters and recompute references for the new student',()=>{
  const f=setup(),id='mus-peitoral-001',item=strength(id,{guidance:'Manter o ritmo'});
  ok(f.assessment(id,80,'original'));
  ok(f.assessment(id,100,'target',{studentId:'s2'}));
  const source=ok(f.call('saveCoachSession',f.session([item]),'source')).workoutId;
  const model=ok(f.call('createSessionModel',{workoutId:source,name:'Musculação'},'model'));
  const payload=plain(ok(f.call('getSessionModel',{modelId:model.id})).payload);
  assert.equal(payload.version,2);
  assert.deepEqual(payload.items[0].input,item);
  const copy=payload.items[0].input;
  copy.strength.sets=4;
  const target=ok(f.call('saveCoachSession',f.session([copy],'s2'),'copy')).workoutId;
  const targetItem=ok(f.get(target,f.other)).items[0];
  assert.equal(targetItem.prescription.strength.oneRm.percent,40);
  assert.equal(targetItem.prescription.volume.total,32);
  const sourceItem=ok(f.get(source)).items[0];
  assert.equal(sourceItem.prescription.strength.oneRm.percent,50);
  assert.equal(sourceItem.prescription.volume.total,24);
  assert.equal(ok(f.call('getSessionModel',{modelId:model.id})).payload.items[0].input.strength.sets,3);
});
