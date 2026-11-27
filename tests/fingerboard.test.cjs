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

test('Fingerboard leaves omitted dose blank and returns explicit partial and zero series to the trainer',()=>{
  const f=setup(),saved=ok(f.save());
  const completed=ok(f.feedback(saved));
  assert.deepEqual([completed.actualSets,completed.actualQuantity,completed.quantityUnit],['','','']);
  assert.equal(completed.actualSeries,undefined);
  const actualSeries=[{repetitions:1,seconds:7.25},{repetitions:0,seconds:2.5}];
  const partial=ok(f.feedback(saved,{status:'partial',expectedRevision:1,actualSeries,fingerPain:3,comment:'Esforço incompleto'}));
  assert.deepEqual([partial.actualSets,partial.actualQuantity,partial.supersedesId],[2,9.75,completed.id]);
  assert.deepEqual(JSON.parse(JSON.stringify(partial.actualSeries)),actualSeries);
  const notDone=ok(f.feedback(saved,{status:'not_done',expectedRevision:2,actualSeries:[{repetitions:0,seconds:0},{repetitions:0,seconds:0}]}));
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
    {status:'partial',actualSeries:[{repetitions:1}]},
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
  const dose={actualSeries:[{repetitions:3,seconds:15},{repetitions:3,seconds:15}]};
  f.fail('ItemFeedback');
  rejects(f.feedback(saved,dose,'feedback-retry'),'INTERNAL_ERROR');
  const edited=ok(f.revise(saved,f.data({durationSeconds:10}).directed));
  const retry=ok(f.feedback(saved,dose,'feedback-retry'));
  assert.equal(retry.prescriptionId,saved.prescription.id);
  assert.equal(retry.actualQuantity,30);
  assert.equal(ok(f.feedback(saved,dose,'feedback-retry')).id,retry.id);
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

test('traction block feedback records reported dose, incomplete efforts and explicit zero in seconds',()=>{
  const f=setup(),saved=ok(f.save(tractionData(f)));
  const complete=ok(f.feedback(saved,{actualSeries:[{repetitions:3,seconds:15},{repetitions:3,seconds:15}]}));
  assert.deepEqual([complete.actualQuantity,complete.actualSets,complete.quantityUnit],[30,2,'seconds']);
  assert.equal(complete.actualSeries[0].seconds,15);
  rejects(f.feedback(saved,{expectedRevision:1,status:'partial',actualSeries:[{repetitions:1,seconds:-1},{repetitions:0,seconds:3}]}));
  const actualSeries=[{repetitions:1,seconds:6.5},{repetitions:0,seconds:3}];
  const partial=ok(f.feedback(saved,{expectedRevision:1,status:'partial',actualSeries,fingerPain:2,comment:'Esforço incompleto'}));
  const notDone=ok(f.feedback(saved,{expectedRevision:2,status:'not_done',actualSeries:[{seconds:0,repetitions:0},{seconds:0,repetitions:0}]}));
  assert.deepEqual([partial.actualQuantity,notDone.actualQuantity,notDone.quantityUnit],[9.5,0,'seconds']);
  const coach=f.read('coach');
  assert.equal(coach.items[0].prescription.volume.total,30);
  assert.equal(coach.itemFeedback[1].prescriptionId,saved.prescription.id);
  assert.equal(coach.itemFeedback[1].fingerPain,2);
  assert.equal(coach.itemFeedback[1].comment,'Esforço incompleto');
  assert.deepEqual(JSON.parse(JSON.stringify(coach.itemFeedback[1].actualSeries)),actualSeries);
});

function campusData(f,overrides={}){
  return f.data({subblock:'campus_board',modality:'sequence',grip:'edge',gripOption:'4.5',prehension:'open',side:undefined,durationSeconds:undefined,feet:'none',sequenceId:'CB03',...overrides});
}

test('Campus Board snapshots the exact canonical sequences, counting rebounds and joins by hand',()=>{
  const f=setup(),expected=[
    ['E2 D3 E4 D5 E6 D7 E8 D9 E10',5,4],
    ['D3 E4 D5 E6 D7 E8 D9 E10',4,4],
    ['D1 D2 D3 E3 E4 E5 D5 D6 D7 E7 E8 E9 D9',6,7],
    ['D3 E3 E5 D5 D7 E7 E9 D9',4,4],
    ['D3 E5 D7 E9',2,2],
    ['D4 E7 D10 E10',2,2],
    ['D2 D3 D4 D3 D2 D1',0,6],
    ['D2 E3 D4 E5 D5 E4 D3 E2 D1 E1',5,5]
  ];
  for(const [i,[steps,left,right]] of expected.entries()){
    const sequenceId='CB0'+(i+1);
    const saved=ok(f.save(campusData(f,{sequenceId})));
    const path=JSON.parse(saved.prescription.snapshotJson).directed.path;
    assert.equal(path.catalogVersion,1);
    assert.equal(path.holdCount,10);
    assert.equal(path.start,1);
    assert.equal(path.steps.flat().join(' '),steps);
    assert.equal(path.steps.flat().filter(step=>step.startsWith('E')).length,left);
    assert.equal(path.steps.flat().filter(step=>step.startsWith('D')).length,right);
    assert.equal(path.movesPerRep,left+right);
    assert.equal(saved.prescription.totalVolume,6*(left+right));
    assert.equal(saved.prescription.volumeUnitId,'unit-hand-moves');
    assert.equal(JSON.parse(saved.prescription.volumeJson).lines.length,2);
  }
});

test('Campus Board doubles stay on the equipment and count both hands at each step',()=>{
  const f=setup();
  for(const interval of [1,2,3]){
    const leg=Math.floor(9/interval);
    for(const direction of ['up','down','up_down']){
      const bouts=direction==='up_down'?2*leg:leg;
      const body=campusData(f,{modality:'double',sequenceId:undefined,interval,direction,bouts});
      const saved=ok(f.save(body));
      const path=JSON.parse(saved.prescription.snapshotJson).directed.path;
      let from=direction==='down'?10:1;
      assert.equal(path.start,from);
      for(const [i,step] of path.steps.entries()){
        from+=direction==='up'||(direction==='up_down'&&i<leg)?interval:-interval;
        assert.deepEqual(step,['E'+from,'D'+from]);
        assert.ok(from>=1&&from<=10);
      }
      assert.equal(saved.prescription.totalVolume,6*bouts*2);
      rejects(f.save(campusData(f,{...body.directed,bouts:bouts+1})),'IMPOSSIBLE_CAMPUS_PATH');
    }
  }
  rejects(f.save(campusData(f,{modality:'double',sequenceId:undefined,interval:3,direction:'up_down',bouts:1})),'IMPOSSIBLE_CAMPUS_PATH');
  const maximum=ok(f.save(campusData(f,{modality:'double',sequenceId:undefined,interval:1,direction:'up_down',bouts:18,sets:1,repetitionsPerSet:10000})));
  assert.equal(maximum.prescription.totalVolume,360000);
});

test('Campus Board validates grips, foot support, load and forged fields before writing',()=>{
  const f=setup(),before=JSON.stringify(f.tables);
  for(const patch of [
    {grip:'mono'},{grip:'sloper',gripOption:'level1'},{prehension:'full'},{feet:undefined},{feet:'left'},
    {side:'bilateral'},{durationSeconds:5},{load:{kind:'assisted',assistance:'foot'}},{load:{kind:'bodyweight',kilograms:2}},
    {sequenceId:'CB09'},{sequenceId:'constructor'},{modality:'pull'},{bouts:2},{path:{movesPerRep:100}},
    {modality:'double',sequenceId:undefined,interval:4,direction:'up',bouts:2},
    {modality:'double',sequenceId:undefined,interval:1,direction:'reverse',bouts:2}
  ])rejects(f.save(campusData(f,patch)));
  assert.equal(JSON.stringify(f.tables),before);
  for(const [i,feet] of ['none','ground','wall','alternate'].entries()){
    const load=[{kind:'bodyweight'},{kind:'added',kilograms:6},{kind:'assisted',assistance:'band'},{kind:'assisted',assistance:'partner'}][i];
    const body=campusData(f,{feet,load,restBetweenRepetitionsSeconds:0,restBetweenSetsSeconds:900});
    const saved=ok(f.save(body));
    const p=f.read().items.find(item=>item.id===saved.item.id).prescription;
    assert.equal(p.directed.feet,feet);
    assert.equal(p.restSeconds,900);
    assert.equal(p.directed.restBetweenRepetitionsSeconds,0);
    assert.deepEqual(JSON.parse(saved.prescription.snapshotJson).directed.load,load);
  }
  for(const gripOption of ['0.5','1.0','1.5','2.5','3.5','4.5'])ok(f.save(campusData(f,{gripOption,prehension:'half'})));
  for(const gripOption of ['level1','level2'])ok(f.save(campusData(f,{grip:'sloper',gripOption,prehension:undefined})));
});

test('Campus Board recovers writes, retains historical paths and pins feedback to the saved revision',()=>{
  const f=setup();
  ok(f.save());
  ok(f.save(tractionData(f)));
  const body=campusData(f);
  f.fail('PRESCRICAO_SERIES');
  rejects(f.save(body,'campus-create'),'INTERNAL_ERROR');
  assert.equal(f.read().items.length,2);
  const pending=ok(f.lib('listPendingCoachSaves',{}))[0];
  const saved=ok(f.save(pending.data,pending.requestId));
  assert.equal(ok(f.save(body,'campus-create')).item.id,saved.item.id);
  const complete=ok(f.feedback(saved,{actualSeries:[{repetitions:3,additionalMoves:0},{repetitions:3,additionalMoves:0}]}));
  assert.deepEqual([complete.actualQuantity,complete.quantityUnit],[78,'moves']);
  assert.equal(complete.actualSeries[0].additionalMoves,0);
  for(const line of [{repetitions:4,additionalMoves:0},{repetitions:3,additionalMoves:1},{repetitions:2,additionalMoves:13},{repetitions:0,seconds:2},{repetitions:0,additionalMoves:0.5}]){
    rejects(f.feedback(saved,{status:'partial',expectedRevision:1,actualSeries:[line,{repetitions:0,additionalMoves:0}]}));
  }
  const actualSeries=[{repetitions:2,additionalMoves:4},{repetitions:0,additionalMoves:0}];
  const partial=ok(f.feedback(saved,{status:'partial',expectedRevision:1,actualSeries,comment:'Retorno de Campus'}));
  assert.equal(partial.actualQuantity,30);
  const zero=ok(f.feedback(saved,{status:'not_done',expectedRevision:2,actualSeries:[{repetitions:0,additionalMoves:0},{repetitions:0,additionalMoves:0}]}));
  assert.equal(zero.actualQuantity,0);
  const originalCatalog=f.context.campusCatalog_;
  f.context.campusCatalog_=()=>{
    const catalog=originalCatalog();
    catalog.version=2;
    catalog.sequences.CB03.steps='E2';
    return catalog;
  };
  assert.equal(f.read().items[2].prescription.directed.path.steps[0][0],'D1');
  const revised=ok(f.revise(saved,campusData(f,{sequenceId:'CB03'}).directed));
  assert.equal(revised.item.id,saved.item.id);
  const coach=f.read('coach');
  assert.equal(coach.items[2].prescription.directed.path.catalogVersion,2);
  assert.equal(coach.items[2].prescription.volume.total,6);
  assert.equal(coach.itemFeedback[0].actualQuantity,78);
  assert.equal(coach.itemFeedback[1].prescriptionId,saved.prescription.id);
  assert.deepEqual(JSON.parse(JSON.stringify(coach.itemFeedback[1].actualSeries)),actualSeries);
  assert.equal(f.tables.Items.length,4);
});

test('one workout retains five directed prescriptions in order and all three feedback states per modality',()=>{
  const f=setup();
  const dose={sets:3,repetitionsPerSet:4,durationSeconds:7};
  const cases=[
    [f.data(dose),84,'hang_seconds',{repetitions:0,seconds:3},3],
    [f.data({...dose,modality:'pull',repetitionsPerSet:5,durationSeconds:undefined}),15,'repetitions',{repetitions:2},2],
    [tractionData(f,{...dose,load:{kind:'external',kilograms:12.5}}),84,'seconds',{repetitions:0,seconds:3},3],
    [campusData(f,{sets:3,repetitionsPerSet:2,sequenceId:'CB04'}),48,'moves',{repetitions:1,additionalMoves:3},11],
    [campusData(f,{sets:3,repetitionsPerSet:2,modality:'double',sequenceId:undefined,interval:2,direction:'up',bouts:3}),36,'moves',{repetitions:1,additionalMoves:3},9]
  ];
  const itemIds=[];
  for(const [index,[body,total,unit,line,actual]] of cases.entries()){
    const key='integrated-save-'+index;
    f.busy(true);
    rejects(f.save(body,key),'BUSY');
    f.busy(false);
    const saved=ok(f.save(body,key));
    assert.equal(ok(f.save(body,key)).prescription.id,saved.prescription.id);
    itemIds.push(saved.item.id);
    const read=f.read();
    assert.equal(read.id,f.workoutId);
    assert.equal(read.items.map(item=>item.id).join(','),itemIds.join(','));
    const item=read.items[index];
    assert.equal(item.workoutId,f.workoutId);
    assert.equal(item.prescription.volume.total,total);
    assert.equal(item.prescription.quantityUnit,unit);

    const complete=ok(f.feedback(saved,{fingerPain:0,comment:'Completa'}));
    assert.equal(complete.actualQuantity,'');
    assert.equal(complete.actualSets,'');
    const zero=Object.fromEntries(Object.keys(line).map(key=>[key,0]));
    const partial={status:'partial',expectedRevision:1,actualSeries:[line,zero,zero],fingerPain:3,comment:'Parcial'};
    rejects(f.feedback(saved,{...partial,actualSeries:[line,zero]}));
    rejects(f.feedback(saved,{...partial,actualSeries:[{...line,repetitions:10001},zero,zero]}));
    const returned=ok(f.feedback(saved,partial,'integrated-feedback-'+index));
    assert.equal(returned.actualQuantity,actual);
    assert.equal(returned.actualSets,1);
    assert.equal(ok(f.feedback(saved,partial,'integrated-feedback-'+index)).id,returned.id);
    rejects(f.feedback(saved,partial),'CONFLICT');
    const notDone=ok(f.feedback(saved,{status:'not_done',expectedRevision:2,fingerPain:0,actualSeries:[zero,zero,zero]}));
    assert.equal(notDone.actualQuantity,0);
    assert.deepEqual(JSON.parse(JSON.stringify(notDone.actualSeries)),[zero,zero,zero]);

    const revised=ok(f.revise(saved,{...body.directed,guidance:'Instrução revisada'}));
    rejects(f.revise(saved,body.directed),'CONFLICT');
    assert.equal(revised.item.id,saved.item.id);
    assert.equal(revised.prescription.totalVolume,total);
    const coach=f.read('coach');
    assert.equal(coach.items[index].prescription.prescriptionId,revised.prescription.id);
    assert.equal(f.read().items[index].prescription.directed.guidance,'Instrução revisada');
    const history=coach.itemFeedback.filter(record=>record.itemId===saved.item.id);
    assert.equal(history.length,3);
    assert.ok(history.every(record=>record.prescriptionId===saved.prescription.id)&&history.slice(1).every(record=>record.quantityUnit===unit));
    assert.equal(history[1].fingerPain,3);
    assert.equal(history[1].comment,'Parcial');
    assert.deepEqual(JSON.parse(JSON.stringify(history[1].actualSeries)),[line,zero,zero]);
    assert.equal(f.tables.PRESCRICOES[index*2+1][f.tables.PRESCRICOES[0].indexOf('snapshotJson')],saved.prescription.snapshotJson);
  }
  assert.equal(f.tables.Items.length,6);
  assert.equal(f.tables.PRESCRICOES.length,11);
  assert.equal(f.tables.PRESCRICAO_SERIES.length,31);
  assert.equal(f.tables.ItemFeedback.length,16);
  rejects(f.api('getWorkout',{workoutId:f.workoutId},undefined,'other'),'NOT_FOUND');
});

test('directed snapshot coexists with general, legacy directed and specific prescriptions',()=>{
  const f=setup();
  const legacy=(block,exercise)=>ok(f.api('addItem',{
    workoutId:f.workoutId,block,exercise,category:'Técnica',metric:'Reps',quantity:5,minutes:2
  }));
  const general=legacy('Treinamento geral','Aquecimento');
  const oldDirected=legacy('Treinamento direcionado','Exercício histórico');
  const specific=ok(f.save({
    workoutId:f.workoutId,block:'Treinamento específico',classification:'specific',
    intensity:{indicatorId:'int-grade'},
    task:{version:3,subblock:'continuity',sets:2,repetitionsPerSet:3,restBetweenRepetitionsSeconds:0,restBetweenSetsSeconds:300}
  }));
  const directed=ok(f.save());
  const items=f.read().items;
  assert.equal(items.map(i=>i.id).join(','),[general.id,oldDirected.id,specific.item.id,directed.item.id].join(','));
  assert.equal(items[0].prescription.quantity,5);
  assert.equal(items[1].prescription.directed,undefined);
  assert.equal(items[2].prescription.task.version,3);
  assert.equal(items[3].prescription.directed.version,1);
});

test('directed feedback replay rejects duplicate reservations and duplicate saved rows',()=>{
  const f=setup(),saved=ok(f.save()),key='duplicate-feedback';
  const first=ok(f.feedback(saved,{},key));
  const receipt=f.tables.Requests.find(row=>row[2]===key);
  f.tables.Requests.push([...receipt]);
  rejects(f.feedback(saved,{},key),'CONFLICT');
  f.tables.Requests.pop();
  const persisted=f.tables.ItemFeedback.find(row=>row[0]===first.id);
  f.tables.ItemFeedback.push([...persisted]);
  rejects(f.feedback(saved,{},key),'SCHEMA_ERROR');
  f.tables.ItemFeedback.pop();
  assert.equal(ok(f.feedback(saved,{},key)).id,first.id);
});

test('one-click completion preserves sparse feedback across a directed prescription revision and a lost reply',()=>{
  const f=setup(),saved=ok(f.save());
  const sparse=[{repetitions:0},{}];
  const last=ok(f.feedback(saved,{status:'partial',actualSeries:sparse,rpe:8,fingerPain:0,comment:'Mantive a técnica'}));
  assert.deepEqual([last.actualSets,last.actualQuantity,last.fingerPain,last.rpe],['','',0,8]);
  ok(f.revise(saved,f.data({sets:3,durationSeconds:9}).directed));
  const complete={workoutId:f.workoutId,itemId:saved.item.id,status:'completed',expectedRevision:1,completeOnly:true};
  f.fail('ItemFeedback');
  rejects(f.api('submitItemFeedback',complete,'finish','student'),'INTERNAL_ERROR');
  const result=ok(f.api('submitItemFeedback',complete,'finish','student'));
  assert.equal(result.status,'completed');
  assert.equal(result.revision,2);
  assert.equal(result.prescriptionId,saved.prescription.id);
  assert.equal(result.actualQuantity,'');
  assert.deepEqual(JSON.parse(JSON.stringify(result.actualSeries)),sparse);
  assert.deepEqual([result.fingerPain,result.rpe,result.comment],[0,8,'Mantive a técnica']);
  assert.equal(ok(f.api('submitItemFeedback',complete,'finish','student')).id,result.id);
  rejects(f.api('submitItemFeedback',complete,'new-finish','student'),'CONFLICT');
  const history=f.read('coach').itemFeedback;
  assert.equal(history.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(history[1])),JSON.parse(JSON.stringify(result)));
});

test('historical directed completion still reads its recorded aggregate and per-series dose',()=>{
  const {execFileSync}=require('node:child_process');
  const f=setup(),saved=ok(f.save());
  vm.runInContext(execFileSync('git',['show','d57adae:apps-script/Student.gs'],{encoding:'utf8'}),f.context);
  const historical=ok(f.feedback(saved,{},'historical'));
  vm.runInContext(fs.readFileSync('apps-script/Student.gs','utf8'),f.context);
  const [record]=f.read().itemFeedback;
  assert.equal(record.id,historical.id);
  assert.equal(record.actualQuantity,30);
  assert.deepEqual(JSON.parse(JSON.stringify(record.actualSeries)),[{repetitions:3,seconds:15},{repetitions:3,seconds:15}]);
  assert.equal(ok(f.feedback(saved,{},'historical')).id,record.id);
});
