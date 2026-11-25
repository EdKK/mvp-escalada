const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {fixture}=require('./helpers/gas.cjs');

function ok(result){
  assert.equal(result.ok,true,JSON.stringify(result));
  return result.data;
}
function rejects(result,code='INVALID_DATA'){
  assert.equal(result.ok,false);
  assert.equal(result.error.code,code);
}
function setup(){
  const f=fixture();
  for(const module of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary']){
    vm.runInContext(fs.readFileSync('apps-script/'+module+'.gs','utf8'),f.context);
  }
  f.properties.LIBRARY_SPREADSHEET_ID='test-only';
  f.context.initializeLibraryDevelopment_();
  const emails={coach:'coach@example.invalid',student:'one@example.invalid',other:'two@example.invalid'};
  const tokens=Object.fromEntries(Object.entries(emails).map(([role,email])=>[role,f.context.issueSession_({email,sub:'12345'})]));
  let sequence=0;
  function call(method,actor,action,data,requestId='fingerboard-'+(++sequence)){
    return f.context[method]({action,data,requestId,sessionToken:tokens[actor]});
  }
  const api=(action,data,key,actor='coach')=>call('api',actor,action,data,key);
  const lib=(action,data,key,actor='coach')=>call('libraryApi',actor,action,data,key);
  const workoutId=ok(api('createWorkout',{studentId:'s1',date:'2026-11-26',goal:'Fingerboard'})).id;
  const data=(overrides={})=>({
    workoutId,block:'Treinamento direcionado',classification:'directed',
    directed:{version:1,subblock:'fingerboard',modality:'isometric',grip:'jug',side:'bilateral',load:{kind:'bodyweight'},sets:2,repetitionsPerSet:3,durationSeconds:5,restBetweenRepetitionsSeconds:10,restBetweenSetsSeconds:120,...overrides}
  });
  const save=(body=data(),key)=>lib('saveCoachPrescription',body,key);
  const read=(actor='student')=>ok(api('getWorkout',{workoutId},undefined,actor));
  const revise=(saved,directed,key)=>save({workoutId,itemId:saved.item.id,classification:'directed',expectedRevision:saved.prescription.revision,directed},key);
  const feedback=(saved,patch={},key)=>api('submitItemFeedback',{
    workoutId,itemId:saved.item.id,prescriptionId:saved.prescription.id,status:'completed',fingerPain:0,expectedRevision:0,...patch
  },key,'student');
  return {...f,api,lib,workoutId,data,save,read,revise,feedback};
}

test('Fingerboard stores both modalities with every grip specification and preserves its own snapshot',()=>{
  const f=setup();
  const grips={
    edge:['0.5','1.0','1.5','2.5','3.5'],sloper:['level1','level2'],mono:['index','middle','ring','little'],
    two:['indexMiddle','middleRing','ringLittle'],pinch:['closed','intermediate','open'],jug:[undefined]
  };
  for(const modality of ['isometric','pull']){
    for(const [grip,options] of Object.entries(grips)){
      for(const gripOption of options){
        const body=f.data({modality,grip});
        if(gripOption!==undefined)body.directed.gripOption=gripOption;
        if(grip==='edge')body.directed.prehension='open';
        if(modality==='pull')delete body.directed.durationSeconds;
        const {prescription:p}=ok(f.save(body));
        const snapshot=JSON.parse(p.snapshotJson);
        assert.equal(snapshot.classification,'directed');
        assert.equal(snapshot.task,undefined);
        assert.equal(snapshot.directed.gripOption,gripOption);
        assert.equal(snapshot.directed.prehension,grip==='edge'?'open':undefined);
        assert.equal(snapshot.directed.modality,modality);
        assert.equal(snapshot.method,null);
        assert.equal(p.volumeUnitId,modality==='pull'?'unit-repetitions':'unit-hang-seconds');
        assert.equal(p.totalVolume,modality==='pull'?6:30);
      }
    }
  }
  for(const prehension of ['half','full'])ok(f.save(f.data({grip:'edge',gripOption:'1.5',prehension})));
});

test('Fingerboard treats bilateral and each unilateral dose once and distinguishes all load conditions',()=>{
  const f=setup(),loads=[
    {kind:'bodyweight'},...[1,2,4,6,8,10].map(kilograms=>({kind:'added',kilograms})),
    ...['foot','band','partner'].map(assistance=>({kind:'assisted',assistance}))
  ];
  for(const side of ['bilateral','left','right']){
    for(const load of loads){
      const {prescription:p}=ok(f.save(f.data({side,load})));
      const d=JSON.parse(p.snapshotJson).directed;
      assert.equal(p.totalVolume,30);
      assert.equal(d.side,side);
      assert.deepEqual(d.load,load);
    }
  }
});

test('Fingerboard rejects missing, incompatible and client-computed fields before reserving any row',()=>{
  const f=setup(),before=JSON.stringify(f.tables);
  const invalid=[
    {version:2},{subblock:'campus'},{modality:undefined},{modality:'toString'},{grip:'edge'},
    {grip:'edge',gripOption:'1.5'},{grip:'sloper',gripOption:'level1',prehension:'open'},
    {grip:'jug',gripOption:'1.5'},{side:'both'},{load:undefined},{load:{kind:'bodyweight',kilograms:0}},
    {load:{kind:'added'}},{load:{kind:'added',kilograms:0}},{load:{kind:'added',kilograms:'2'}},
    {load:{kind:'assisted',assistance:'band',kilograms:2}},{load:{kind:'assisted'}},
    {modality:'pull'},{durationSeconds:0},{durationSeconds:'5'},{sets:0},{sets:1.5},
    {repetitionsPerSet:0},{repetitionsPerSet:1},{restBetweenRepetitionsSeconds:undefined},
    {restBetweenRepetitionsSeconds:2},{restBetweenSetsSeconds:2},{restBetweenSetsSeconds:undefined}
  ];
  invalid.forEach(patch=>rejects(f.save(f.data(patch))));
  for(const patch of [{classification:'general'},{block:'Outro'},{volume:{total:999}},{exerciseId:'exercise-bench'},{methodId:'method-isometric'},{task:{version:3}}]){
    rejects(f.save({...f.data(),...patch}));
  }
  assert.equal(JSON.stringify(f.tables),before);
});

test('Fingerboard preserves allowed recovery choices, explicit zero and optional guidance',()=>{
  const f=setup();
  for(const seconds of [0,3,5,10,15,20,30,45,60,90,120]){
    const saved=ok(f.save(f.data({restBetweenRepetitionsSeconds:seconds})));
    const p=f.read().items.find(i=>i.id===saved.item.id).prescription;
    assert.equal(p.directed.restBetweenRepetitionsSeconds,seconds);
    assert.equal(p.restSeconds,seconds||120);
  }
  for(const minutes of [1,2,3,5,10,15]){
    const data=f.data({repetitionsPerSet:1,restBetweenSetsSeconds:minutes*60,guidance:'  Controle a posição.  '});
    delete data.directed.restBetweenRepetitionsSeconds;
    const saved=ok(f.save(data));
    const p=f.read().items.find(i=>i.id===saved.item.id).prescription;
    assert.equal(p.directed.restBetweenSetsSeconds,60*minutes);
    assert.equal(p.directed.restBetweenRepetitionsSeconds,undefined);
    assert.equal(p.restSeconds,60*minutes);
    assert.equal(p.directed.guidance,'Controle a posição.');
  }
});

test('Fingerboard resumes interrupted creation and revision and reopens saved data without duplicate items or series',()=>{
  const f=setup(),body=f.data();
  f.fail('PRESCRICAO_SERIES');
  rejects(f.save(body,'initial-save'),'INTERNAL_ERROR');
  assert.equal(f.read().items.length,0);
  const pending=ok(f.lib('listPendingCoachSaves',{}))[0];
  const saved=ok(f.save(pending.data,pending.requestId));
  assert.equal(saved.item.id,pending.itemId);
  assert.equal(ok(f.save(body,'initial-save')).prescription.id,saved.prescription.id);
  const revised=f.data({side:'left',durationSeconds:12}).directed;
  f.fail('PRESCRICOES');
  rejects(f.revise(saved,revised,'edit-save'),'INTERNAL_ERROR');
  const edit=ok(f.lib('listPendingCoachSaves',{}))[0];
  assert.equal(edit.itemId,saved.item.id);
  assert.equal(ok(f.lib('coachSaveStatus',{requestId:edit.requestId})).itemId,saved.item.id);
  const result=ok(f.save(edit.data,edit.requestId));
  assert.equal(result.prescription.supersedesId,saved.prescription.id);
  assert.equal(result.item.id,saved.item.id);
  assert.equal(f.read().items[0].prescription.volume.total,72);
  assert.equal(f.read().items[0].prescription.directed.side,'left');
  assert.equal(ok(f.revise(saved,revised,'edit-save')).prescription.id,result.prescription.id);
  rejects(f.revise(saved,revised,'stale-edit'),'CONFLICT');
  assert.equal(f.tables.Items.length,2);
  assert.equal(f.tables.PRESCRICOES.length,3);
  assert.equal(f.tables.PRESCRICAO_SERIES.length,5);
  assert.equal(ok(f.lib('listPendingCoachSaves',{})).length,0);
});

test('Fingerboard feedback derives the complete and not-done dose and returns partial series to the trainer',()=>{
  const f=setup(),saved=ok(f.save());
  const completed=ok(f.feedback(saved));
  assert.deepEqual([completed.actualSets,completed.actualQuantity,completed.quantityUnit],[2,30,'hang_seconds']);
  assert.deepEqual(JSON.parse(JSON.stringify(completed.actualSeries)),[{repetitions:3,seconds:15},{repetitions:3,seconds:15}]);
  const actualSeries=[{repetitions:1,seconds:7.25},{repetitions:0,seconds:2.5}];
  const partial=ok(f.feedback(saved,{status:'partial',expectedRevision:1,actualSeries,fingerPain:3,comment:'Esforço incompleto'}));
  assert.deepEqual([partial.actualSets,partial.actualQuantity,partial.supersedesId],[2,9.75,completed.id]);
  assert.deepEqual(JSON.parse(JSON.stringify(partial.actualSeries)),actualSeries);
  const notDone=ok(f.feedback(saved,{status:'not_done',expectedRevision:2}));
  assert.deepEqual([notDone.actualSets,notDone.actualQuantity,notDone.quantityUnit],[0,0,'hang_seconds']);
  const coach=f.read('coach');
  assert.equal(coach.items[0].prescription.volume.total,30);
  assert.deepEqual(JSON.parse(JSON.stringify(coach.itemFeedback[1])),JSON.parse(JSON.stringify(partial)));
  rejects(f.api('getWorkout',{workoutId:f.workoutId},undefined,'other'),'NOT_FOUND');
});

test('Fingerboard validates partial traction and rejects forged feedback units, totals and unavailable prescriptions',()=>{
  const f=setup(),body=f.data({modality:'pull'});
  delete body.directed.durationSeconds;
  const saved=ok(f.save(body));
  const invalid=[
    {status:'partial'}, {status:'partial',actualSeries:[{repetitions:1}]},
    {status:'partial',actualSeries:[{repetitions:1,seconds:2},{repetitions:0}]},
    {status:'partial',actualSeries:[{repetitions:10001},{repetitions:0}]},
    {status:'partial',actualSeries:[{repetitions:0},{repetitions:null}]},
    {status:'completed',actualSeries:[]},{status:'not_done',actualSeries:[]},{actualSets:2},
    {actualQuantity:999,quantityUnit:'repetitions'},{quantityUnit:'seconds'}
  ];
  invalid.forEach(patch=>rejects(f.feedback(saved,patch)));
  rejects(f.feedback(saved,{prescriptionId:'invalid'}),'CONFLICT');
  const partial=ok(f.feedback(saved,{status:'partial',actualSeries:[{repetitions:4},{repetitions:0}]}));
  assert.deepEqual([partial.actualSets,partial.actualQuantity,partial.quantityUnit],[1,4,'repetitions']);
  assert.equal(partial.actualSeries[1].repetitions,0);
});

test('Fingerboard feedback keeps original prescription provenance during interrupted writes and replay',()=>{
  const f=setup(),saved=ok(f.save());
  f.fail('ItemFeedback');
  rejects(f.feedback(saved,{},'feedback-retry'),'INTERNAL_ERROR');
  const edited=ok(f.revise(saved,f.data({durationSeconds:10}).directed));
  const retry=ok(f.feedback(saved,{},'feedback-retry'));
  assert.equal(retry.prescriptionId,saved.prescription.id);
  assert.equal(retry.actualQuantity,30);
  assert.equal(ok(f.feedback(saved,{},'feedback-retry')).id,retry.id);
  assert.equal(f.tables.ItemFeedback.length,2);
  const workout=f.read();
  assert.equal(workout.items[0].prescription.prescriptionId,edited.prescription.id);
  assert.equal(workout.itemFeedback[0].actualSeries[0].seconds,15);
  rejects(f.feedback(saved,{expectedRevision:1}),'CONFLICT');
});

function tractionData(f,overrides={}){
  return f.data({subblock:'traction_blocks',grip:'edge',gripOption:'1.5',prehension:'half',side:'left',load:{kind:'external',kilograms:12.345678901},...overrides});
}

test('traction blocks support every allowed grip specification, prehension and unilateral side',()=>{
  const f=setup();
  const grips={edge:['0.5','1.0','1.5','2.5','3.5'],mono:['index','middle','ring','little'],two:['indexMiddle','middleRing','ringLittle'],pinch:['closed','intermediate','open']};
  for(const [grip,options] of Object.entries(grips)){
    for(const [index,gripOption] of options.entries()){
      const side=index%2?'right':'left';
      const prehension=grip==='edge'?['open','half','full'][index%3]:undefined;
      const load={kind:'external',kilograms:index%2?8:12.345678901};
      const {item,prescription}=ok(f.save(tractionData(f,{grip,gripOption,prehension,side,load})));
      assert.equal(item.exercise,'Blocos de tração');
      assert.deepEqual([prescription.totalVolume,prescription.volumeUnitId],[30,'unit-seconds']);
      const directed=JSON.parse(prescription.snapshotJson).directed;
      assert.deepEqual([directed.grip,directed.gripOption,directed.prehension,directed.side],[grip,gripOption,prehension,side]);
      assert.deepEqual(directed.load,load);
    }
  }
});

test('traction blocks reject forged modality, grip, prehension, side, load, recovery and volume before writing',()=>{
  const f=setup(),before=JSON.stringify(f.tables);
  const invalid=[
    {modality:'pull'}, {grip:'sloper',gripOption:'level1'}, {grip:'jug'}, {grip:'mono',gripOption:'index'},
    {gripOption:'2.0'}, {prehension:undefined}, {side:'bilateral'}, {sets:0}, {durationSeconds:undefined},
    {repetitionsPerSet:1}, {restBetweenRepetitionsSeconds:1}, {restBetweenSetsSeconds:2},
    {load:{kind:'bodyweight'}}, {load:{kind:'added',kilograms:2}}, {load:{kind:'assisted',assistance:'foot'}},
    {load:{kind:'external',kilograms:1,assistance:'foot'}},
    ...[undefined,null,'','2',0,-1,NaN,Infinity].map(kilograms=>({load:{kind:'external',kilograms}}))
  ];
  for(const patch of invalid)rejects(f.save(tractionData(f,patch)));
  rejects(f.save({...tractionData(f),volume:{total:500}}));
  assert.equal(JSON.stringify(f.tables),before);
});

test('traction blocks preserve recovery and resume creation and revision in a mixed session',()=>{
  const f=setup(),fingerboard=ok(f.save());
  const body=tractionData(f,{restBetweenRepetitionsSeconds:0,restBetweenSetsSeconds:300});
  f.fail('PRESCRICAO_SERIES');
  rejects(f.save(body,'traction-new'),'INTERNAL_ERROR');
  assert.equal(f.read().items.length,1);
  const pending=ok(f.lib('listPendingCoachSaves',{}))[0];
  const saved=ok(f.save(pending.data,pending.requestId));
  assert.equal(ok(f.save(body,'traction-new')).prescription.id,saved.prescription.id);
  const read=f.read();
  assert.deepEqual(Array.from(read.items,i=>i.prescription.directed.subblock),['fingerboard','traction_blocks']);
  assert.equal(read.items[1].prescription.directed.restBetweenRepetitionsSeconds,0);
  assert.equal(read.items[1].prescription.restSeconds,300);
  const edited=tractionData(f,{side:'right',repetitionsPerSet:1,restBetweenRepetitionsSeconds:undefined,durationSeconds:8,restBetweenSetsSeconds:60}).directed;
  rejects(f.revise(fingerboard,edited));
  f.fail('PRESCRICOES');
  rejects(f.revise(saved,edited,'traction-revise'),'INTERNAL_ERROR');
  const revision=ok(f.lib('listPendingCoachSaves',{}))[0];
  const revised=ok(f.save(revision.data,revision.requestId));
  assert.equal(revised.item.id,saved.item.id);
  assert.equal(revised.prescription.supersedesId,saved.prescription.id);
  const p=f.read().items[1].prescription;
  assert.equal(p.directed.side,'right');
  assert.equal(p.directed.restBetweenRepetitionsSeconds,undefined);
  assert.deepEqual([p.restSeconds,p.volume.total,p.quantityUnit],[60,16,'seconds']);
  assert.equal(f.tables.Items.length,3);
  assert.equal(f.tables.PRESCRICOES.length,4);
  assert.equal(f.tables.PRESCRICAO_SERIES.length,7);
});

test('traction block feedback records the prescribed dose, incomplete efforts and explicit zero in seconds',()=>{
  const f=setup(),saved=ok(f.save(tractionData(f)));
  const complete=ok(f.feedback(saved));
  assert.deepEqual([complete.actualQuantity,complete.actualSets,complete.quantityUnit],[30,2,'seconds']);
  assert.equal(complete.actualSeries[0].seconds,15);
  rejects(f.feedback(saved,{expectedRevision:1,status:'partial',actualSeries:[{repetitions:1},{repetitions:0,seconds:3}]}));
  const actualSeries=[{repetitions:1,seconds:6.5},{repetitions:0,seconds:3}];
  const partial=ok(f.feedback(saved,{expectedRevision:1,status:'partial',actualSeries,fingerPain:2,comment:'Esforço incompleto'}));
  const notDone=ok(f.feedback(saved,{expectedRevision:2,status:'not_done'}));
  assert.deepEqual([partial.actualQuantity,notDone.actualQuantity,notDone.quantityUnit],[9.5,0,'seconds']);
  const coach=f.read('coach');
  assert.equal(coach.items[0].prescription.volume.total,30);
  assert.equal(coach.itemFeedback[1].prescriptionId,saved.prescription.id);
  assert.equal(coach.itemFeedback[1].fingerPain,2);
  assert.equal(coach.itemFeedback[1].comment,'Esforço incompleto');
  assert.deepEqual(JSON.parse(JSON.stringify(coach.itemFeedback[1].actualSeries)),actualSeries);
});
