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

test('captures a portable, immutable model of the current integral prescription',()=>{
  const f=setup(),source=f.data(5);
  source.items[0]={...source.items[0],notes:'Orientação técnica',auxiliaryIntensities:[{indicatorId:'int-rpe',value:8}]};
  const {workoutId}=ok(f.call('saveCoachSession',source));
  const before=f.read(workoutId);
  const slide={workoutId,itemId:before.items[1].id,expectedRevision:1,classification:'directed',
    directed:{...source.items[1].directed,sets:4,guidance:'Progredir com controle'}};
  ok(f.call('saveCoachPrescription',slide,'revision'));
  const revised=f.read(workoutId);
  const metadata={workoutId,name:'  Força e técnica  ',description:'Progressão'};
  const model=ok(f.call('createSessionModel',metadata,'model'));
  assert.equal(model.name,'Força e técnica');
  assert.equal(model.microcycleType,'Ordinário');
  assert.equal(ok(f.call('listSessionModels'))[0].id,model.id);
  const get=()=>ok(f.call('getSessionModel',{modelId:model.id}));
  const {payload}=get(),json=JSON.stringify(payload);
  assert.equal(payload.version,1);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.session)),{microcycleType:'Ordinário',instructions:['Aquecer']});
  assert.deepEqual(Array.from(payload.items,entry=>entry.input.classification),source.items.map(i=>i.classification));
  assert.deepEqual(JSON.parse(JSON.stringify(payload.items[0].input.intensity)),{indicatorId:'int-1rm',percent:85});
  assert.equal(payload.items[0].input.auxiliaryIntensities[0].value,8);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.items[0].input.volume)),source.items[0].volume);
  assert.equal(payload.items[0].input.notes,'Orientação técnica');
  assert.equal(payload.items[1].input.directed.sets,4);
  assert.equal(payload.items[1].input.directed.restBetweenSetsSeconds,120);
  assert.equal(payload.items[1].input.directed.guidance,'Progredir com controle');
  assert.equal(payload.items[2].input.task.restBetweenSetsSeconds,180);
  for(const privateValue of [workoutId,f.assessment.id,'2026-11-18','1RM de teste','studentId','assessmentId','targetValue','feedback']){
    assert.equal(json.includes(privateValue),false,privateValue);
  }
  assert.equal(ok(f.call('createSessionModel',metadata,'model')).id,model.id);
  assert.equal(f.call('createSessionModel',{...metadata,name:'Diferente'},'model').error.code,'CONFLICT');
  f.tables.Links.push(['l2','c1','s2',true]);
  const copy=JSON.parse(json);
  const data={session:{...copy.session,studentId:'s2',date:'2026-11-20'},items:copy.items.map(entry=>entry.input)};
  assert.equal(f.call('saveCoachSession',data,'copy').error.code,'ASSESSMENT_NOT_FOUND');
  const assessment=(indicatorId,value,unitId,requestId)=>ok(f.call('recordAssessment',{studentId:'s2',exerciseId:'exercise-bench',indicatorId,
    value,unitId,protocol:'Avaliação nova',referenceDefinition:'Referência',assessedOn:'2026-11-01',validUntil:'2026-12-31'},requestId));
  const primary=assessment('int-1rm',200,'unit-kg','s2-primary');
  const auxiliary=assessment('int-max-force',300,'unit-newton','s2-auxiliary');
  assert.equal(ok(f.call('listDraftAssessments',{studentId:'s2',date:'2026-11-20',exerciseId:'exercise-bench',indicatorId:'int-max-force'}))[0].id,auxiliary.id);
  data.items[0].auxiliaryIntensities.push({indicatorId:'int-max-force',percent:50,assessmentId:auxiliary.id});
  data.items[0].intensity.assessmentId=primary.id;
  data.items[3].intensity.assessmentId=primary.id;
  data.items[1].directed.sets=2;
  const created=ok(f.call('saveCoachSession',data,'copy'));
  const s2=f.context.issueSession_({email:'two@example.invalid',sub:'s2'});
  const readCopy=()=>ok(f.context.api({action:'getWorkout',data:{workoutId:created.workoutId},sessionToken:s2}));
  assert.equal(readCopy().items[0].prescription.intensity.primary.targetValue,170);
  assert.equal(readCopy().items[0].prescription.intensity.auxiliary[1].targetValue,150);
  assert.equal(readCopy().items[1].prescription.directed.sets,2);
  assert.equal(get().payload.items[1].input.directed.sets,4);
  const secondModel=ok(f.call('createSessionModel',{workoutId:created.workoutId,name:'Cópia prescrita'},'second-model'));
  const secondPayload=ok(f.call('getSessionModel',{modelId:secondModel.id})).payload;
  assert.deepEqual(JSON.parse(JSON.stringify(secondPayload.items[0].input.auxiliaryIntensities[1])),{indicatorId:'int-max-force',percent:50});
  assert.notEqual(created.workoutId,workoutId);
  const rows=JSON.stringify([f.tables.Workouts,f.tables.Items,f.tables.PRESCRICOES,f.tables.PRESCRICAO_SERIES]);
  ok(f.call('deleteSessionModel',{modelId:model.id}));
  ok(f.call('deleteSessionModel',{modelId:model.id}));
  assert.equal(f.call('getSessionModel',{modelId:model.id}).error.code,'NOT_FOUND');
  assert.equal(f.call('createSessionModel',metadata,'model').error.code,'NOT_FOUND');
  assert.deepEqual(Array.from(ok(f.call('listSessionModels')),m=>m.id),[secondModel.id]);
  assert.equal(JSON.stringify([f.tables.Workouts,f.tables.Items,f.tables.PRESCRICOES,f.tables.PRESCRICAO_SERIES]),rows);
  assert.equal(JSON.stringify(f.read(workoutId)),JSON.stringify(revised));
});

test('model access is coach-scoped and accepts only completed compatible sources',()=>{
  const f=setup(),legacy=ok(f.call('createSessionModel',{workoutId:ok(f.call('saveCoachSession',f.data(1))).workoutId,name:'V25'},'v25'));
  const data={modelId:legacy.id};
  for(const action of ['getSessionModel','deleteSessionModel','listSessionModels','createSessionModel']){
    assert.equal(f.call(action,data,'student-model',f.student).error.code,'FORBIDDEN');
  }
  assert.equal(f.context.libraryApi({action:'listSessionModels',data:{}}).error.code,'UNAUTHENTICATED');
  const origin=ok(f.call('saveCoachSession',f.data(1),'origin')).workoutId;
  assert.equal(f.call('createSessionModel',{workoutId:origin,name:'   '},'required').error.code,'INVALID_DATA');
  assert.equal(f.call('createSessionModel',{workoutId:origin,name:'=FORMULA'},'required').error.code,'INVALID_DATA');
  const previous=ok(f.call('saveCoachSession',f.data(1),'previous')).workoutId;
  f.tables.Requests.splice(f.tables.Requests.findIndex(row=>row[4]==='CoachSession'&&row[5]===previous),1);
  assert.equal(f.call('createSessionModel',{workoutId:previous,name:'Histórica'},'old').error.code,'INCOMPATIBLE_SESSION');
  f.tables.Links[1][3]=false;
  assert.equal(f.call('createSessionModel',{workoutId:origin,name:'Revogada'},'revoked').error.code,'NOT_FOUND');
  assert.equal(ok(f.call('getSessionModel',data)).id,legacy.id);
  f.tables.Users[1][3]=false;
  f.tables.Users.push(['c2','other@example.invalid','coach',true]);
  const other=f.context.issueSession_({email:'other@example.invalid',sub:'other'});
  assert.equal(ok(f.call('listSessionModels',{},'other',other)).length,0);
  for(const action of ['getSessionModel','deleteSessionModel'])assert.equal(f.call(action,data,'other',other).error.code,'NOT_FOUND');
  assert.equal(f.call('createSessionModel',{workoutId:origin,name:'Outro'},'other',other).error.code,'NOT_FOUND');
});

test('handles objective sessions, retries, and the existing per-cell JSON limit',()=>{
  const f=setup(),data=f.data(1);
  delete data.session.microcycleType;data.session.goal='Resistência';
  const {workoutId}=ok(f.call('saveCoachSession',data));
  const request={workoutId,name:'Objetivo'};
  f.fail('MODELOS_SESSAO');
  assert.equal(f.call('createSessionModel',request,'retry').error.code,'INTERNAL_ERROR');
  const model=ok(f.call('createSessionModel',request,'retry'));
  const {payload}=ok(f.call('getSessionModel',{modelId:model.id}));
  assert.equal(model.microcycleType,'');
  assert.equal(payload.session.goal,'Resistência');
  assert.equal(payload.session.microcycleType,undefined);
  const big=f.data(1);
  big.items=Array.from({length:25},()=>({...big.items[0],notes:'z'.repeat(2000)}));
  const large=ok(f.call('saveCoachSession',big,'large'));
  assert.equal(f.call('createSessionModel',{workoutId:large.workoutId,name:'Grande'},'too-large').error.code,'MODEL_TOO_LARGE');
  assert.equal(f.tables.MODELOS_SESSAO.length,2);
});
