const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {fixture}=require('./helpers/gas.cjs');

function ok(response){
  assert.equal(response.ok,true,JSON.stringify(response));
  return response.data;
}
function setup(){
  const f=fixture();
  for(const name of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary']){
    vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context);
  }
  f.properties.LIBRARY_SPREADSHEET_ID='test-only';
  f.context.initializeLibraryDevelopment_();
  const coach=f.context.issueSession_({email:'coach@example.invalid',sub:'coach'});
  const student=f.context.issueSession_({email:'one@example.invalid',sub:'student'});
  const call=(action,data={},requestId='session',sessionToken=coach)=>f.context.libraryApi({action,data,requestId,sessionToken});
  const assessment=ok(call('recordAssessment',{studentId:'s1',exerciseId:'exercise-bench',indicatorId:'int-1rm',
    value:100,unitId:'unit-kg',protocol:'1RM de teste',referenceDefinition:'Teste',assessedOn:'2026-11-01',validUntil:'2026-12-31'},'assessment'));
  const items=[
    {classification:'general',block:'Força',category:'Tração',exerciseId:'exercise-bench',methodId:'method-max-effort',
      metric:'Reps',quantity:3,minutes:5,intensity:{indicatorId:'int-1rm',assessmentId:assessment.id,percent:85},
      volume:{kind:'repetitions',unitId:'unit-repetitions',sets:[{repetitions:3},{repetitions:4}]}},
    {classification:'directed',block:'Treinamento direcionado',directed:{version:1,subblock:'fingerboard',modality:'isometric',
      grip:'jug',side:'bilateral',load:{kind:'bodyweight'},sets:2,repetitionsPerSet:1,durationSeconds:7,restBetweenSetsSeconds:120}},
    {classification:'specific',block:'Treinamento específico',intensity:{indicatorId:'int-grade'},task:{version:3,subblock:'boulder_short',
      sets:2,repetitionsPerSet:3,restBetweenSetsSeconds:180}}
  ];
  const data=count=>({session:{studentId:'s1',date:'2026-11-18',microcycleType:'Ordinário',instructions:['Aquecer']},
    items:Array.from({length:count},(_,i)=>items[i%items.length])});
  const read=workoutId=>ok(f.context.api({action:'getWorkout',data:{workoutId},sessionToken:student}));
  return {...f,call,data,read,student,assessment};
}
for(const count of [1,5,10]){
  test('saves '+count+' exercises in order and flushes in three stages',()=>{
    const f=setup(),data=f.data(count);
    let flushes=0;
    f.context.SpreadsheetApp.flush=()=>flushes++;
    const result=ok(f.call('saveCoachSession',data));
    assert.equal(result.count,count);
    const workout=f.read(result.workoutId);
    assert.equal(workout.microcycleType,data.session.microcycleType);
    assert.equal(workout.instructions[0],'Aquecer');
    assert.deepEqual(Array.from(workout.items,item=>item.prescription.snapshot.classification),data.items.map(item=>item.classification));
    assert.equal(workout.items[0].prescription.intensity.primary.targetValue,85);
    assert.equal(workout.items[0].prescription.volume.total,7);
    if(count>1){
      assert.equal(workout.items[1].prescription.directed.restBetweenSetsSeconds,120);
      assert.equal(workout.items[2].prescription.task.restBetweenSetsSeconds,180);
    }
    assert.equal(flushes,3);
    const before=JSON.stringify(f.tables);
    assert.equal(ok(f.call('saveCoachSession',data)).workoutId,result.workoutId);
    assert.equal(JSON.stringify(f.tables),before);
    assert.equal(f.call('saveCoachSession',{...data,items:data.items.slice(0,-1)}).error.code,'CONFLICT');
    assert.equal(ok(f.call('listPendingCoachSessions')).length,0);
  });
}
test('validates the final exercise before any write, and validates identity and assessment scope',()=>{
  const f=setup(),data=f.data(10),before=JSON.stringify(f.tables);
  data.items[9]={...data.items[9],intensity:{...data.items[9].intensity,assessmentId:'unknown'}};
  const invalid=f.call('saveCoachSession',data);
  assert.equal(invalid.error.code,'ASSESSMENT_NOT_FOUND');
  assert.equal(invalid.error.itemIndex,9);
  assert.equal(f.call('saveCoachSession',f.data(1),'session',f.student).error.code,'FORBIDDEN');
  assert.equal(f.call('listDraftAssessments',{studentId:'s2',date:'2026-11-18',exerciseId:'exercise-bench'}).error.code,'NOT_FOUND');
  assert.equal(ok(f.call('listDraftAssessments',{studentId:'s1',date:'2026-11-18',exerciseId:'exercise-bench'}))[0].id,f.assessment.id);
  assert.equal(JSON.stringify(f.tables),before);
});
for(const table of ['Requests','WorkoutGuidance','Items','PRESCRICOES','PRESCRICAO_SERIES','Workouts']){
  test('recovers after outage writing '+table,()=>{
    const f=setup(),data=f.data(5);
    f.fail(table);
    assert.equal(f.call('saveCoachSession',data).error.code,'INTERNAL_ERROR');
    assert.equal(f.tables.Workouts.length,1);
    const pending=ok(f.call('listPendingCoachSessions'));
    assert.equal(pending.length,table==='Requests'?0:1);
    const result=table==='Requests'?ok(f.call('saveCoachSession',data)):ok(f.call('resumeCoachSession',{},pending[0].requestId));
    assert.equal(f.read(result.workoutId).items.length,5);
    assert.equal(f.tables.Workouts.length,2);
    assert.equal(f.tables.WorkoutGuidance.length,2);
    assert.equal(f.tables.Items.length,6);
    assert.equal(f.tables.PRESCRICOES.length,6);
    assert.equal(f.tables.PRESCRICAO_SERIES.length,11);
    assert.equal(ok(f.call('listPendingCoachSessions')).length,0);
  });
}
test('resumes the same frozen snapshots after a middle-item outage and rechecks the student link',()=>{
  const f=setup(),data=f.data(10),append=f.context.append_;
  let items=0;
  f.context.append_=(db,name,row,schema)=>{
    if(name==='Items'&&++items===5)throw Error('middle item outage');
    return append(db,name,row,schema);
  };
  assert.equal(f.call('saveCoachSession',data).error.code,'INTERNAL_ERROR');
  assert.equal(f.tables.Items.length,5);
  const pending=ok(f.call('listPendingCoachSessions'))[0];
  f.tables.Links[1][3]=false;
  assert.equal(f.call('resumeCoachSession',{},pending.requestId).error.code,'NOT_FOUND');
  assert.equal(ok(f.call('listPendingCoachSessions')).length,0);
  f.tables.Links[1][3]=true;
  f.tables.AVALIACOES[1][11]='superseded';
  const result=ok(f.call('resumeCoachSession',{},pending.requestId));
  assert.equal(f.read(result.workoutId).items[9].prescription.intensity.primary.targetValue,85);
  assert.equal(f.tables.Items.length,11);
  assert.equal(f.tables.PRESCRICAO_SERIES.length,21);
});
test('an exception after the parent write recovers the same saved workout and never writes twice',()=>{
  const f=setup();
  let flushes=0;
  f.context.SpreadsheetApp.flush=()=>{if(++flushes===3)throw Error('interrupted after parent write');};
  const data=f.data(5);
  assert.equal(f.call('saveCoachSession',data).error.code,'INTERNAL_ERROR');
  const id=f.tables.Workouts[1][0],before=JSON.stringify(f.tables);
  const status=ok(f.call('coachSessionStatus',{requestId:'session'}));
  assert.equal(status.state,'completed');
  assert.equal(status.workoutId,id);
  assert.equal(ok(f.call('resumeCoachSession')).workoutId,id);
  assert.equal(JSON.stringify(f.tables),before);
});
test('only the owning coach can abandon a revoked reservation, which stays closed after relinking',()=>{
  const f=setup(),data=f.data(5),query={requestId:'session'};
  f.fail('PRESCRICOES');
  assert.equal(f.call('saveCoachSession',data).error.code,'INTERNAL_ERROR');
  const id=ok(f.call('coachSessionStatus',query)).workoutId;
  const before=JSON.stringify(f.tables);
  assert.equal(f.call('abandonCoachSession',query).error.code,'CONFLICT');
  assert.equal(JSON.stringify(f.tables),before);
  f.tables.Links[1][3]=false;
  assert.equal(JSON.stringify(ok(f.call('coachSessionStatus',query))),JSON.stringify({state:'link_revoked'}));
  assert.equal(f.call('abandonCoachSession',query,'session',f.student).error.code,'FORBIDDEN');
  f.tables.Users[1][3]=false;
  f.tables.Users.push(['c2','other-coach@example.invalid','coach',true]);
  const other=f.context.issueSession_({email:'other-coach@example.invalid',sub:'other'});
  assert.equal(f.call('abandonCoachSession',query,'session',other).error.code,'NOT_FOUND');
  f.tables.Users.at(-1)[3]=false;
  f.tables.Users[1][3]=true;

  assert.equal(ok(f.call('abandonCoachSession',query)).state,'abandoned');
  f.tables.Links[1][3]=true;
  const abandoned=JSON.stringify(f.tables);
  assert.equal(JSON.stringify(ok(f.call('coachSessionStatus',query))),JSON.stringify({state:'abandoned'}));
  assert.equal(ok(f.call('abandonCoachSession',query)).state,'abandoned');
  assert.equal(f.call('resumeCoachSession').error.code,'NOT_FOUND');
  const replay=f.call('saveCoachSession',data);
  assert.equal(replay.error.code,'NOT_FOUND');
  assert.equal(replay.error.sessionNotStarted,undefined);
  assert.equal(ok(f.call('listPendingCoachSessions')).length,0);
  assert.equal(f.context.api({action:'getWorkout',data:{workoutId:id},sessionToken:f.student}).error.code,'NOT_FOUND');
  assert.equal(JSON.stringify(f.tables),abandoned);
  assert.notEqual(ok(f.call('saveCoachSession',data,'new-session')).workoutId,id);
});
test('abandoning a revoked receipt leaves its committed workout and exercises intact',()=>{
  const f=setup(),data=f.data(5),query={requestId:'session'};
  const id=ok(f.call('saveCoachSession',data)).workoutId;
  f.tables.Links[1][3]=false;
  const before=JSON.stringify(f.read(id));
  assert.equal(JSON.stringify(ok(f.call('coachSessionStatus',query))),JSON.stringify({state:'link_revoked'}));
  assert.equal(ok(f.call('abandonCoachSession',query)).state,'abandoned');
  assert.equal(JSON.stringify(f.read(id)),before);
});
