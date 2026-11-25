/* Trainer integration; same auth, schemas and ScriptLock as libraryApi(). */
function coachAssessments_(db,user,data){
  fields_(data,['workoutId','exerciseId']);var w=workout_(db,user,text_(data.workoutId,100)),e=libraryExercise_(db,data.exerciseId),indicator=libraryOne_(db,'INDICADORES',e.primaryIndicatorId,true);
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
  fields_(d,['workoutId','exerciseId','block','category','metric','quantity','minutes','notes','methodId','protocolId','capacityId','classification','intensity','auxiliaryIntensities','volume','task']);
  var w=workout_(db,user,text_(d.workoutId,100));libraryStudent_(db,user,w.studentId);
  var key=text_(request.requestId,80),fingerprint=libraryJson_([request.action,libraryCanonical_(d)]);
  var reservations=rows_(db,'Requests').filter(function(r){return r.userId===user.id&&r.key===key;});
  if(reservations.length>1)fail_('SCHEMA_ERROR');
  if(reservations.length&&(reservations[0].entity!=='Items'||reservations[0].fingerprint!==fingerprint))fail_('CONFLICT');
  var itemId=reservations.length?reservations[0].entityId:id_();
  var items=rows_(db,'Items').filter(function(i){return i.id===itemId;});if(items.length>1)fail_('SCHEMA_ERROR');
  if(items.length&&items[0].workoutId!==w.id)fail_('SCHEMA_ERROR');
  var plan={workoutId:w.id,itemId:itemId,exerciseId:d.exerciseId,methodId:d.methodId,classification:d.classification,intensity:d.intensity,volume:d.volume,expectedRevision:0};
  ['protocolId','capacityId','auxiliaryIntensities','task'].forEach(function(k){if(d[k]!==undefined)plan[k]=d[k];});
  var prescriptionRequest={action:'createLibraryPrescription',data:plan,requestId:'coach-p-'+hashAuth_(user.id+':'+key)};
  // A lost response or partial child write must replay the existing historical snapshot,
  // but authorization is rechecked by libraryApi, workout_ and libraryWrite_.
  var completed=rows_(db,'Requests').filter(function(r){return r.userId===user.id&&r.key===prescriptionRequest.requestId;})[0];
  if(items.length&&completed&&libraryRows_(db,'PRESCRICOES').some(function(p){return p.id===completed.entityId;})){
    var restored=libraryCreatePrescription_(db,user,prescriptionRequest);return {item:items[0],prescription:restored};
  }
  var exercise=libraryExercise_(db,d.exerciseId),simplified=d.task&&d.task.version===2;
  if(simplified&&['metric','quantity','minutes'].some(function(key){return d[key]!==undefined;}))fail_('INVALID_DATA');
  var item={id:itemId,workoutId:w.id,block:text_(d.block,500),category:d.task&&(d.category===undefined||d.category==='')?'':text_(d.category,500),exercise:exercise.name,metric:simplified?'Reps':text_(d.metric,500),quantity:simplified?'':libraryNumber_(d.quantity,0,100000,false),minutes:simplified?'':libraryNumber_(d.minutes,0,100000,false),notes:d.notes===undefined||d.notes===''?'':text_(d.notes,2000),createdAt:new Date().toISOString()};
  if(d.task&&d.block!=='Treinamento específico')fail_('INVALID_DATA');
  if(!simplified&&(!d.volume||d.metric!==coachMetric_(d.volume.unitId)))fail_('INCOMPATIBLE_UNIT');
  // Candidate exists only in memory. All method/reference/unit checks run before writes.
  var validated=libraryValidateLoad_(db,user,plan,item);
  if(validated.task&&!simplified&&(!Number.isInteger(item.quantity)||item.quantity<validated.task.minMoves||(validated.task.maxMoves!==null&&item.quantity>validated.task.maxMoves)))fail_('INVALID_DATA');
  if(!reservations.length){append_(db,'Requests',{id:id_(),userId:user.id,key:key,fingerprint:fingerprint,entity:'Items',entityId:itemId});SpreadsheetApp.flush();}
  if(!items.length){append_(db,'Items',item);SpreadsheetApp.flush();}
  var prescription=libraryCreatePrescription_(db,user,prescriptionRequest);
  return {item:items[0]||item,prescription:prescription};
}
function coachPendingSaves_(db,user,data){
  fields_(data,[]);var requests=rows_(db,'Requests'),prescriptions=libraryRows_(db,'PRESCRICOES'),series=libraryRows_(db,'PRESCRICAO_SERIES');
  return requests.filter(function(r){return r.userId===user.id&&r.entity==='Items';}).map(function(r){
    var parsed=JSON.parse(r.fingerprint);if(parsed[0]!=='saveCoachPrescription')return null;
    var body=parsed[1];try{var w=workout_(db,user,body.workoutId);libraryStudent_(db,user,w.studentId);}catch(error){if(['NOT_FOUND','FORBIDDEN'].indexOf(error.code)>=0)return null;throw error;}
    var key='coach-p-'+hashAuth_(user.id+':'+r.key),child=requests.filter(function(c){return c.userId===user.id&&c.key===key&&c.entity==='PRESCRICOES';})[0],p=child?prescriptions.filter(function(p){return p.id===child.entityId;})[0]:null;
    var done=p&&JSON.parse(p.volumeJson).lines.every(function(line){return series.some(function(s){return s.id===line.id&&s.prescriptionId===p.id;});});
    return done?null:{requestId:r.key,itemId:r.entityId,data:body};
  }).filter(Boolean).slice(0,20);
}
function coachSaveStatus_(db,user,data){
  fields_(data,['requestId']);var key=text_(data.requestId,80),r=rows_(db,'Requests').filter(function(r){return r.userId===user.id&&r.key===key;});
  if(!r.length)return {state:'not_started'};if(r.length!==1)fail_('SCHEMA_ERROR');
  var fp=JSON.parse(r[0].fingerprint);if(fp[0]!=='saveCoachPrescription')fail_('CONFLICT');
  var w=workout_(db,user,fp[1].workoutId);libraryStudent_(db,user,w.studentId);return {state:'reserved',itemId:r[0].entityId};
}
