const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {fixture}=require('./helpers/gas.cjs');

const v30='d57adae1e1bbf34c698bf68dc0273149df3aa62a';
const modules=['Backend','Auth','TrainingLibrary','TrainingCatalog','TrainingLoad','GeneralCatalog','StrengthPrescription','CoachLibrary','Student'];
const plain=value=>JSON.parse(JSON.stringify(value));
function ok(response){
  assert.equal(response.ok,true,JSON.stringify(response));
  return response.data;
}

function setup(){
  const f=fixture();
  const {context,tables}=f;
  f.properties.LIBRARY_SPREADSHEET_ID='test-only';
  const sources=modules.map(name=>{
    const path='apps-script/'+name+'.gs';
    return {path,candidate:fs.readFileSync(path,'utf8'),v30:execFileSync('git',['show',v30+':'+path],{encoding:'utf8'})};
  });
  const install=version=>sources.forEach(source=>{
    vm.runInContext(source[version],context,{filename:version+'/'+source.path});
  });
  install('candidate');
  context.initializeLibraryDevelopment_();
  context.prepararCatalogoGeralHomologacao_();
  const coach=context.issueSession_({email:'coach@example.invalid',sub:'coach'});
  const student=context.issueSession_({email:'one@example.invalid',sub:'student'});
  const directed={block:'Treinamento direcionado',classification:'directed',directed:{
    version:1,subblock:'fingerboard',modality:'isometric',grip:'jug',side:'bilateral',load:{kind:'bodyweight'},
    sets:2,repetitionsPerSet:3,durationSeconds:5,restBetweenRepetitionsSeconds:10,restBetweenSetsSeconds:120
  }};
  const strength={block:'Treinamento geral',classification:'general',strength:{
    version:1,exerciseId:'mus-peitoral-001',sets:3,repetitionsPerSet:8,restBetweenSetsSeconds:120,
    kilograms:20,condition:'added',execution:'unilateral',loadBasis:'total'
  }};
  const {workoutId}=ok(context.libraryApi({action:'saveCoachSession',requestId:'session',
    sessionToken:coach,data:{session:{studentId:'s1',date:'2026-11-18',microcycleType:'Ordinário'},
      items:[directed,strength,directed]}}));
  const read=(sessionToken=student)=>plain(ok(context.api({action:'getWorkout',data:{workoutId},sessionToken})));
  const send=(item,requestId,data)=>context.api({action:'submitItemFeedback',sessionToken:student,requestId,
    data:{workoutId,itemId:item.id,...data}});
  const submit=(item,requestId,data)=>plain(ok(send(item,requestId,data)));
  const complete=(item,requestId,expectedRevision)=>submit(item,requestId,{status:'completed',expectedRevision,completeOnly:true});
  return {...f,coach,install,read,send,submit,complete,tables};
}

test('v30 reads only aggregates from new structured feedback; restoring the candidate recovers exact details',()=>{
  const f=setup(),[directed,strength,virgin]=f.read().items;
  const d={prescriptionId:directed.prescription.prescriptionId},s={strengthPrescriptionId:strength.prescription.prescriptionId};
  const isometricSparse=[{repetitions:0},{seconds:2.5}],isometricFull=[{repetitions:1,seconds:4},{repetitions:0,seconds:0}];
  const empty=f.submit(directed,'directed-empty',{...d,status:'completed',expectedRevision:0});
  const sparse=f.submit(directed,'directed-sparse',{...d,status:'partial',expectedRevision:1,actualSeries:isometricSparse,rpe:7});
  const full=f.submit(directed,'directed-full',{...d,status:'completed',expectedRevision:2,actualSeries:isometricFull,fingerPain:0});
  const partial=f.submit(directed,'directed-partial',{...d,status:'partial',expectedRevision:3,actualSeries:isometricSparse});
  const directedComplete=f.complete(directed,'directed-complete',4);
  const strengthEmpty=f.submit(strength,'strength-empty',{...s,status:'partial',expectedRevision:0});
  const strengthSparse=f.submit(strength,'strength-sparse',{...s,status:'partial',expectedRevision:1,actualSets:2,fingerPain:0});
  const strengthComplete=f.complete(strength,'strength-complete',2);
  const strengthZero=f.submit(strength,'strength-zero',{...s,status:'completed',expectedRevision:3,actualSets:2,actualRepetitions:0,actualKilograms:0});
  const strengthFull=f.submit(strength,'strength-full',{...s,status:'completed',expectedRevision:4,actualSets:2,actualRepetitions:6,actualKilograms:13.5});
  const virginComplete=f.complete(virgin,'virgin-complete',0);
  assert.deepEqual([empty.actualQuantity,full.actualQuantity,strengthZero.actualQuantity,strengthFull.actualQuantity],['',4,0,24]);
  assert.deepEqual([directedComplete.actualSeries,strengthComplete.actualRepetitions,strengthComplete.actualKilograms],[isometricSparse,undefined,undefined]);
  assert.equal(virginComplete.actualQuantity,'');

  const expected=[empty,sparse,full,partial,directedComplete,strengthEmpty,strengthSparse,strengthComplete,strengthZero,strengthFull,virginComplete];
  const tablesBefore=JSON.stringify(f.tables);
  const requests=Object.fromEntries(f.tables.Requests.slice(1).filter(row=>row[4]==='ItemFeedback').map(row=>[row[2],JSON.parse(row[3])]));
  for(const key of ['directed-empty','directed-sparse','directed-full','directed-partial','strength-empty','strength-sparse','strength-zero','strength-full']){
    const [,data]=requests[key];
    assert.equal(data.structuredFeedback.version,2,key);
    assert.equal(data.prescriptionId,undefined,key);
    assert.equal(data.strengthPrescriptionId,undefined,key);
  }

  f.install('v30');
  for(const workout of [f.read(),f.read(f.coach)]){
    assert.deepEqual(workout.itemFeedback.map(row=>row.id),expected.map(row=>row.id));
    workout.itemFeedback.forEach((row,index)=>{
      const {prescriptionId,actualSeries,actualRepetitions,actualKilograms,...aggregates}=expected[index];
      assert.deepEqual(row,aggregates);
    });
  }
  assert.equal(JSON.stringify(f.tables),tablesBefore);
  f.install('candidate');
  assert.deepEqual(f.read().itemFeedback,expected);
  assert.equal(JSON.stringify(f.tables),tablesBefore);
});

test('v30 revisions are kept separate, and a versioned candidate retry plays back its original details',()=>{
  const f=setup(),[directed,strength]=f.read().items;
  const input={prescriptionId:directed.prescription.prescriptionId,status:'completed',expectedRevision:0,
    actualSeries:[{repetitions:1,seconds:3},{repetitions:0,seconds:0}]};
  const original=f.submit(directed,'directed-candidate',input);
  const strengthInput={strengthPrescriptionId:strength.prescription.prescriptionId,status:'partial',expectedRevision:0,actualKilograms:0};
  f.fail('ItemFeedback');
  assert.equal(f.send(strength,'strength-reserved',strengthInput).error.code,'INTERNAL_ERROR');
  const originalStrength=f.submit(strength,'strength-reserved',strengthInput);

  f.install('v30');
  assert.equal(f.read().itemFeedback[0].actualSeries,undefined);
  const old=f.submit(directed,'directed-legacy',{prescriptionId:directed.prescription.prescriptionId,status:'completed',expectedRevision:1,fingerPain:0});
  assert.equal(old.actualQuantity,30);
  assert.equal(f.send(strength,'strength-legacy',{...strengthInput,expectedRevision:1,fingerPain:0}).error.code,'INVALID_DATA');

  f.install('candidate');
  assert.deepEqual(f.read().itemFeedback,[original,originalStrength,old]);
  assert.deepEqual(f.submit(directed,'directed-candidate',input),original);
  assert.deepEqual(f.submit(strength,'strength-reserved',strengthInput),originalStrength);
  assert.equal(f.send(directed,'directed-candidate',{...input,rpe:4}).error.code,'CONFLICT');
});
