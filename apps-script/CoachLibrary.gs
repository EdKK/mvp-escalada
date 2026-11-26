/* Trainer integration; same auth, schemas and ScriptLock as libraryApi(). */
function coachAssessments_(db,user,data){
  fields_(data,['workoutId','exerciseId']);var w=workout_(db,user,text_(data.workoutId,100)),e=libraryExercise_(db,data.exerciseId),indicator=libraryOne_(db,'INDICADORES',e.primaryIndicatorId,true);
  return assessmentsForCandidate_(db,w,e,indicator);
}
function assessmentsForCandidate_(db,w,e,indicator){
  if(indicator.kind!=='relative')return [];
  return libraryRows_(db,'AVALIACOES').filter(function(a){
    if(a.studentId!==w.studentId||a.exerciseId!==e.id||a.indicatorId!==indicator.id)return false;
    try{libraryReference_(db,w.studentId,e.id,indicator,w.date,a.id);return true;}catch(error){if(['ASSESSMENT_NOT_FOUND','ASSESSMENT_OUTDATED','INCOMPATIBLE_UNIT','INVALID_DATA'].indexOf(error.code)>=0)return false;throw error;}
  }).sort(function(a,b){return b.assessedOn.localeCompare(a.assessedOn);});
}
function coachPrescriptions_(db,user,data){
  fields_(data,['workoutId']);var w=workout_(db,user,text_(data.workoutId,100));
  return libraryRows_(db,'PRESCRICOES').filter(function(p){return p.workoutId===w.id && p.studentId===w.studentId;});
}
function coachMetric_(unitId){return {'unit-repetitions':'Reps','unit-hand-moves':'Moves','unit-hang-seconds':'Segundos de suspensão','unit-seconds':'Segundos','unit-meters':'Metros'}[unitId];}
function coachSavePrescription_(db,user,request){
  var d=request.data;
  fields_(d,['workoutId','exerciseId','block','category','metric','quantity','minutes','notes','methodId','protocolId','capacityId','classification','intensity','auxiliaryIntensities','volume','task','directed','itemId','expectedRevision']);
  var w=workout_(db,user,text_(d.workoutId,100));libraryStudent_(db,user,w.studentId);
  if(d.itemId!==undefined){
    fields_(d,['workoutId','itemId','expectedRevision','directed','classification']);
    if(d.directed===undefined)fail_('INVALID_DATA');
    libraryNumber_(d.expectedRevision,1,100000,true);
    var revised=libraryCreatePrescription_(db,user,{action:'createLibraryPrescription',data:d,requestId:request.requestId});
    return {item:rows_(db,'Items').filter(function(i){return i.id===d.itemId&&i.workoutId===w.id;})[0],prescription:revised};
  }
  if(d.expectedRevision!==undefined)fail_('INVALID_DATA');
  var key=text_(request.requestId,80),fingerprint=libraryJson_([request.action,libraryCanonical_(d)]);
  var reservations=rows_(db,'Requests').filter(function(r){return r.userId===user.id&&r.key===key;});
  if(reservations.length>1)fail_('SCHEMA_ERROR');
  if(reservations.length&&(reservations[0].entity!=='Items'||reservations[0].fingerprint!==fingerprint))fail_('CONFLICT');
  var itemId=reservations.length?reservations[0].entityId:id_();
  var items=rows_(db,'Items').filter(function(i){return i.id===itemId;});if(items.length>1)fail_('SCHEMA_ERROR');
  if(items.length&&items[0].workoutId!==w.id)fail_('SCHEMA_ERROR');
  var plan=coachPlan_(w,itemId,d);
  var prescriptionRequest={action:'createLibraryPrescription',data:plan,requestId:'coach-p-'+hashAuth_(user.id+':'+key)};
  // A lost response or partial child write must replay the existing historical snapshot,
  // but authorization is rechecked by libraryApi, workout_ and libraryWrite_.
  var completed=rows_(db,'Requests').filter(function(r){return r.userId===user.id&&r.key===prescriptionRequest.requestId;})[0];
  if(items.length&&completed&&libraryRows_(db,'PRESCRICOES').some(function(p){return p.id===completed.entityId;})){
    var restored=libraryCreatePrescription_(db,user,prescriptionRequest);return {item:items[0],prescription:restored};
  }
  var item=coachItemCandidate_(db,user,w,d,plan).item;
  if(!reservations.length){append_(db,'Requests',{id:id_(),userId:user.id,key:key,fingerprint:fingerprint,entity:'Items',entityId:itemId});SpreadsheetApp.flush();}
  if(!items.length){append_(db,'Items',item);SpreadsheetApp.flush();}
  var prescription=libraryCreatePrescription_(db,user,prescriptionRequest);
  return {item:items[0]||item,prescription:prescription};
}
function coachPlan_(w,itemId,d){
  var directed=d.directed!==undefined;
  if(directed)fields_(d,['workoutId','block','classification','directed']);
  var plan={workoutId:w.id,itemId:itemId,exerciseId:d.exerciseId,methodId:d.methodId,classification:d.classification,intensity:d.intensity,volume:d.volume,expectedRevision:0};
  ['protocolId','capacityId','auxiliaryIntensities','task'].forEach(function(k){if(d[k]!==undefined)plan[k]=d[k];});
  if(directed)plan={workoutId:w.id,itemId:itemId,classification:d.classification,expectedRevision:0,directed:d.directed};
  return plan;
}
function coachItemCandidate_(db,user,w,d,plan){
  var itemId=plan.itemId,directed=d.directed!==undefined;
  var standalone=d.task&&d.task.version===3;
  var exercise=directed?{name:''}:standalone?specificExercise_(d.task.subblock):libraryExercise_(db,d.exerciseId);
  var simplified=directed||standalone||(d.task&&d.task.version===2);
  if(simplified&&['metric','quantity','minutes'].some(function(key){return d[key]!==undefined;}))fail_('INVALID_DATA');
  var item={id:itemId,workoutId:w.id,block:text_(d.block,500),category:(directed||d.task)&&(d.category===undefined||d.category==='')?'':text_(d.category,500),exercise:exercise.name,metric:simplified?'Reps':text_(d.metric,500),quantity:simplified?'':libraryNumber_(d.quantity,0,100000,false),minutes:simplified?'':libraryNumber_(d.minutes,0,100000,false),notes:d.notes===undefined||d.notes===''?'':text_(d.notes,2000),createdAt:new Date().toISOString()};
  if(d.task&&d.block!=='Treinamento específico')fail_('INVALID_DATA');
  if(!simplified&&(!d.volume||d.metric!==coachMetric_(d.volume.unitId)))fail_('INCOMPATIBLE_UNIT');
  // Candidate exists only in memory. All method/reference/unit checks run before writes.
  var validated=libraryValidateLoad_(db,user,plan,item,w);
  if(directed){item.exercise=validated.exercise.name;item.metric=coachMetric_(validated.volume.unitId);}
  if(validated.task&&!simplified&&(!Number.isInteger(item.quantity)||item.quantity<validated.task.minMoves||(validated.task.maxMoves!==null&&item.quantity>validated.task.maxMoves)))fail_('INVALID_DATA');
  return {item:item,validated:validated};
}
function coachPendingSaves_(db,user,data){
  fields_(data,[]);
  var requests=rows_(db,'Requests').filter(function(r){return r.userId===user.id;});
  var candidates=requests.filter(function(r){
    if(r.entity!=='Items'&&r.entity!=='PRESCRICOES')return false;
    var fp=JSON.parse(r.fingerprint);
    return r.entity==='Items'?fp[0]==='saveCoachPrescription':
      fp[0]==='createLibraryPrescription'&&fp[1].directed&&fp[1].expectedRevision>0;
  });
  if(!candidates.length)return [];
  var byKey=new Map(requests.map(function(r){return [r.key,r];}));
  var prescriptions=new Map(libraryRows_(db,'PRESCRICOES').map(function(p){return [p.id,p];}));
  var series=new Map(libraryRows_(db,'PRESCRICAO_SERIES').map(function(line){return [line.id,line.prescriptionId];}));
  var result=[];
  for(var i=0;i<candidates.length&&result.length<20;i++){
    var r=candidates[i],body=JSON.parse(r.fingerprint)[1],revision=r.entity==='PRESCRICOES';
    var child=revision?r:byKey.get('coach-p-'+hashAuth_(user.id+':'+r.key));
    var p=child&&child.entity==='PRESCRICOES'?prescriptions.get(child.entityId):null;
    if(p&&JSON.parse(p.volumeJson).lines.every(function(line){return series.get(line.id)===p.id;}))continue;
    try{var w=workout_(db,user,body.workoutId);libraryStudent_(db,user,w.studentId);}
    catch(error){if(['NOT_FOUND','FORBIDDEN'].indexOf(error.code)>=0)continue;throw error;}
    result.push({requestId:r.key,itemId:revision?body.itemId:r.entityId,data:body});
  }
  return result;
}
function coachSaveStatus_(db,user,data){
  fields_(data,['requestId']);var key=text_(data.requestId,80),r=rows_(db,'Requests').filter(function(r){return r.userId===user.id&&r.key===key;});
  if(!r.length)return {state:'not_started'};if(r.length!==1)fail_('SCHEMA_ERROR');
  var fp=JSON.parse(r[0].fingerprint);if(fp[0]!=='saveCoachPrescription'&&!(fp[0]==='createLibraryPrescription'&&fp[1].directed&&fp[1].expectedRevision>0))fail_('CONFLICT');
  var w=workout_(db,user,fp[1].workoutId);libraryStudent_(db,user,w.studentId);return {state:'reserved',itemId:fp[1].itemId||r[0].entityId};
}

function coachDraftAssessments_(db,user,d){
  fields_(d,['studentId','date','exerciseId']);
  var studentId=text_(d.studentId,100),date=libraryDate_(d.date);
  libraryStudent_(db,user,studentId);
  var exercise=libraryExercise_(db,d.exerciseId);
  return assessmentsForCandidate_(db,{studentId:studentId,date:date},exercise,libraryOne_(db,'INDICADORES',exercise.primaryIndicatorId,true));
}

// Requests stores the immutable write plan only after the whole session validates.
function coachSessionIndex_(requests,user){
  return requests.filter(function(row){return row.userId===user.id&&row.entity==='CoachSession';});
}
function coachSessionPending_(db,user,data){
  fields_(data,[]);
  var saved=new Set(rows_(db,'Workouts').map(function(w){return w.id;}));
  return coachSessionIndex_(rows_(db,'Requests'),user).filter(function(r){
    return !saved.has(r.entityId)&&linked_(db,user.id,JSON.parse(r.fingerprint).studentId);
  }).map(function(r){
    var info=JSON.parse(r.fingerprint);
    return {requestId:r.key,studentId:info.studentId,date:info.date,count:info.count};
  });
}
function coachSessionSave_(db,user,request){
  var resume=request.action==='resumeCoachSession',d=request.data;
  fields_(d,resume?[]:['session','items']);
  var key=text_(request.requestId,80),requests=rows_(db,'Requests');
  var matches=requests.filter(function(row){return row.userId===user.id&&row.key===key;});
  if(matches.length>1||(matches.length&&matches[0].entity!=='CoachSession'))fail_('CONFLICT');
  var reservation=matches[0],plan,partStart,partCount;
  var signature=resume?'':hashAuth_(JSON.stringify(libraryCanonical_(d)));
  if(reservation){
    var info=JSON.parse(reservation.fingerprint);
    if(!resume&&info.signature!==signature)fail_('CONFLICT');
    libraryStudent_(db,user,info.studentId);
    var saved=rows_(db,'Workouts').filter(function(w){return w.id===reservation.entityId;});
    if(saved.length){
      if(saved.length!==1||saved[0].coachId!==user.id||saved[0].studentId!==info.studentId)fail_('SCHEMA_ERROR');
      return {workoutId:reservation.entityId,count:info.count};
    }
    var chunks=requests.filter(function(row){return row.userId===user.id&&row.entity==='CoachSessionPlan'&&row.entityId===reservation.entityId;});
    var parts=new Map(chunks.map(function(row){return JSON.parse(row.fingerprint);}));
    if(chunks.length!==info.parts||parts.size!==info.parts)fail_('SCHEMA_ERROR');
    var serialized=Array.from({length:info.parts},function(_,i){return parts.get(i);}).join('');
    if(hashAuth_(serialized)!==info.planHash)fail_('SCHEMA_ERROR');
    plan=JSON.parse(serialized);
    partStart=requests.indexOf(chunks[0])+2;
    if(chunks.every(function(row,i){return requests[partStart+i-2]===row;}))partCount=chunks.length;
  }else{
    if(resume)fail_('NOT_FOUND');
    if(!Array.isArray(d.items)||!d.items.length)fail_('INVALID_DATA');
    var workout=workoutCandidate_(db,user,d.session);
    sheet_(db,'WorkoutGuidance');
    var items=d.items.map(function(input,index){
      try{
        fields_(input,['exerciseId','block','category','metric','quantity','minutes','notes','methodId','protocolId','capacityId','classification','intensity','auxiliaryIntensities','volume','task','directed']);
        var itemPlan=coachPlan_(workout,id_(),input);
        var prepared=coachItemCandidate_(db,user,workout,Object.assign({workoutId:workout.id},input),itemPlan);
        return {item:prepared.item,prescription:prescriptionRecord_(user,id_(),itemPlan,prepared.validated,null)};
      }catch(error){error.itemIndex=index;throw error;}
    });
    plan={workout:workout,guidance:{id:workout.id,workoutId:workout.id,steps:JSON.stringify(
      d.session.microcycleType===undefined?(d.session.instructions||[]):{version:1,microcycleType:d.session.microcycleType,instructions:d.session.instructions||[]}
    )},items:items};
    // Verify the target sheets before preparing the durable recovery plan.
    sheet_(db,'Items');librarySheet_(db,'PRESCRICOES');librarySheet_(db,'PRESCRICAO_SERIES');
    var payload=JSON.stringify(plan),records=[];
    for(var offset=0;offset<payload.length;offset+=12000){
      records.push({id:id_(),userId:user.id,key:'',fingerprint:JSON.stringify([records.length,payload.slice(offset,offset+12000)]),entity:'CoachSessionPlan',entityId:workout.id});
    }
    records.unshift({id:id_(),userId:user.id,key:key,entity:'CoachSession',entityId:workout.id,fingerprint:JSON.stringify({
      studentId:workout.studentId,date:workout.date,count:items.length,signature:signature,parts:records.length,planHash:hashAuth_(payload)
    })});
    var sheet=sheet_(db,'Requests');
    partStart=sheet.getLastRow()+2;
    partCount=records.length-1;
    var needed=partStart+partCount-1-sheet.getMaxRows();
    if(needed>0)sheet.insertRowsAfter(sheet.getMaxRows(),needed);
    sheet.getRange(partStart-1,1,records.length,SCHEMA_.Requests.length).setValues(records.map(function(row){
      return SCHEMA_.Requests.map(function(column){return row[column];});
    }));
    SpreadsheetApp.flush();
  }
  var result=coachSessionPersist_(db,plan,!!reservation);
  // After the parent is durable, only the small receipt is needed for retries.
  if(partCount)try{
    sheet_(db,'Requests').getRange(partStart,SCHEMA_.Requests.indexOf('fingerprint')+1,partCount,1)
      .setValues(Array.from({length:partCount},function(){return [''];}));
  }catch(error){console.warn('Could not compact completed coach session request');}
  return result;
}
function coachSessionPersist_(db,plan,recovering){
  var workout=plan.workout;
  var tables=[
    ['WorkoutGuidance',SCHEMA_],['Items',SCHEMA_],['PRESCRICOES',LIBRARY_SCHEMA_],['PRESCRICAO_SERIES',LIBRARY_SCHEMA_]
  ];
  var existing={};
  tables.forEach(function(table){
    existing[table[0]]=new Map();
    if(recovering)rows_(db,table[0],table[1]).forEach(function(row){
      var index=existing[table[0]];
      index.set(row.id,index.has(row.id)?null:row);
    });
  });
  function persist(table,schema,record){
    var index=existing[table];
    if(index.has(record.id)){
      var row=index.get(record.id);
      if(!row||schema[table].some(function(column){return row[column]!==record[column];}))fail_('SCHEMA_ERROR');
      return;
    }
    append_(db,table,record,schema);
  }
  persist('WorkoutGuidance',SCHEMA_,plan.guidance);
  plan.items.forEach(function(entry){
    persist('Items',SCHEMA_,entry.item);
    persist('PRESCRICOES',LIBRARY_SCHEMA_,entry.prescription);
    JSON.parse(entry.prescription.volumeJson).lines.forEach(function(line){
      persist('PRESCRICAO_SERIES',LIBRARY_SCHEMA_,Object.assign({},line,{prescriptionId:entry.prescription.id}));
    });
  });
  // The parent becomes visible after all dependent rows have been flushed.
  SpreadsheetApp.flush();
  append_(db,'Workouts',workout);
  SpreadsheetApp.flush();
  return {workoutId:workout.id,count:plan.items.length};
}
