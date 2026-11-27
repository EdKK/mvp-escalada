/* Isolated development module. Existing APIs, tables, OAuth and clients are unchanged. */
var LIBRARY_SCHEMA_ = {
  CAPACIDADES:['id','name','kind','capacityId','status','createdAt'],
  METODOS:['id','name','kind','parentId','status','createdAt'],
  UNIDADES:['id','name','symbol','dimension','status','createdAt'],
  INDICADORES:['id','name','kind','referenceType','referenceUnitsJson','status','createdAt'],
  EXERCICIOS:['id','name','nameKey','description','modality','primaryIndicatorId','primaryVolumeUnitId','volumeUnitIdsJson','status','origin','createdAt'],
  EXERCICIO_CAPACIDADES:['id','exerciseId','capacityId','createdAt'],
  EXERCICIO_METODOS:['id','exerciseId','methodId','createdAt'],
  AVALIACOES:['id','studentId','exerciseId','indicatorId','referenceType','value','unitId','protocol','referenceDefinition','assessedOn','validUntil','supersedesId','status','createdBy','createdAt'],
  PRESCRICOES:['id','workoutId','itemId','studentId','exerciseId','methodId','protocolId','capacityId','classification','intensityJson','volumeJson','totalVolume','volumeUnitId','assessmentId','snapshotJson','revision','supersedesId','status','createdBy','createdAt'],
  MODELOS_SESSAO:['id','coachId','fingerprint','name','description','microcycleType','payloadJson','status'],
  PRESCRICAO_SERIES:['id','prescriptionId','blockOrder','setOrder','quantity','occurrences','durationSeconds','volumeUnitId','total']
};
function libraryDb_() {
  var p=PropertiesService.getScriptProperties(),id=p.getProperty('SPREADSHEET_ID');
  if(p.getProperty('ENVIRONMENT')!=='homologation' || !id || p.getProperty('LIBRARY_SPREADSHEET_ID')!==id) fail_('CONFIGURATION_ERROR');
  var db=db_();
  ['Users','Links','Workouts','Items','Requests'].forEach(function(name){sheet_(db,name);});
  return db;
}
function librarySheet_(db,name) {
  var columns=LIBRARY_SCHEMA_[name],s=db.getSheetByName(name);
  if(!columns || !s || s.getLastColumn()!==columns.length || JSON.stringify(s.getRange(1,1,1,columns.length).getValues()[0])!==JSON.stringify(columns))fail_('SCHEMA_ERROR');
  return s;
}
function libraryRows_(db,name) {
  var s=librarySheet_(db,name),count=s.getLastRow()-1;
  if(count<=0)return [];
  return s.getRange(2,1,count,LIBRARY_SCHEMA_[name].length).getValues().map(function(row){var out={};LIBRARY_SCHEMA_[name].forEach(function(key,i){out[key]=row[i] instanceof Date?(['assessedOn','validUntil'].indexOf(key)>=0?row[i].toISOString().slice(0,10):row[i].toISOString()):row[i];});return out;});
}
function libraryAppend_(db,name,row) {
  // Guard every write, including manual initialization. No production fallback.
  libraryDb_();
  librarySheet_(db,name).appendRow(LIBRARY_SCHEMA_[name].map(function(k){return row[k]===undefined?'':row[k];}));
}
function libraryOne_(db,name,id,active) {
  var found=libraryRows_(db,name).filter(function(r){return r.id===id;});
  if(found.length!==1 || (active && found[0].status!=='active'))fail_(found.length>1?'SCHEMA_ERROR':'NOT_FOUND');
  return found[0];
}
function libraryCoach_(db,user) {
  var coaches=rows_(db,'Users').filter(function(u){return u.role==='coach' && enabled_(u.active);});
  if(user.role!=='coach')fail_('FORBIDDEN');
  if(coaches.length!==1 || coaches[0].id!==user.id)fail_('CONFIGURATION_ERROR');
}
function libraryStudent_(db,user,studentId) {
  if(user.role==='student'){if(user.id!==studentId)fail_('NOT_FOUND');return;}
  libraryCoach_(db,user);if(!linked_(db,user.id,studentId))fail_('NOT_FOUND');
}
function libraryName_(s){return text_(s,150).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function libraryJson_(value){var s=JSON.stringify(value);if(s.length>45000)fail_('INVALID_DATA');return s;}
function libraryCanonical_(v){if(Array.isArray(v))return v.map(libraryCanonical_);if(v && typeof v==='object'){var o={};Object.keys(v).sort().forEach(function(k){o[k]=libraryCanonical_(v[k]);});return o;}return v;}
function libraryUnique_(db,table,predicate,id,action,payloadPredicate){
  if(libraryRows_(db,table).some(function(r){return r.id!==id && predicate(r);}))fail_('CONFLICT');
  if(payloadPredicate && rows_(db,'Requests').some(function(r){if(r.entity!==table || r.entityId===id)return false;var fp=JSON.parse(r.fingerprint);return fp[0]===action && payloadPredicate(fp[1]);}))fail_('CONFLICT');
}
function libraryWrite_(db,user,req,table,build) {
  var key=text_(req.requestId,100),fingerprint=libraryJson_([req.action,libraryCanonical_(req.data)]);
  var reservations=rows_(db,'Requests').filter(function(r){return r.userId===user.id && r.key===key;});
  if(reservations.length>1)fail_('SCHEMA_ERROR');
  if(reservations.length && (reservations[0].entity!==table || reservations[0].fingerprint!==fingerprint))fail_('CONFLICT');
  var id=reservations.length?reservations[0].entityId:id_();
  var existing=libraryRows_(db,table).filter(function(r){return r.id===id;});
  if(existing.length>1)fail_('SCHEMA_ERROR');
  if(existing.length){
    // Idempotency does not grant enduring access after a link is revoked.
    if(table==='AVALIACOES'||table==='PRESCRICOES')libraryStudent_(db,user,existing[0].studentId);
    if(table==='PRESCRICOES')workout_(db,user,existing[0].workoutId);
    libraryRepairChildren_(db,table,existing[0]);return existing[0];
  }
  var record=build(id);record.id=id;
  if(!reservations.length){append_(db,'Requests',{id:id_(),userId:user.id,key:key,fingerprint:fingerprint,entity:table,entityId:id});SpreadsheetApp.flush();}
  libraryAppend_(db,table,record);SpreadsheetApp.flush();libraryRepairChildren_(db,table,record);return record;
}
function libraryRepairChildren_(db,table,record){
  if(table!=='PRESCRICOES')return;
  var lines=JSON.parse(record.volumeJson).lines,existing=libraryRows_(db,'PRESCRICAO_SERIES');
  if(new Set(lines.map(function(l){return l.id;})).size!==lines.length)fail_('SCHEMA_ERROR');
  lines.forEach(function(line){var rows=existing.filter(function(r){return r.id===line.id;});if(rows.length>1)fail_('SCHEMA_ERROR');var child=Object.assign({},line,{prescriptionId:record.id});if(rows.length){LIBRARY_SCHEMA_.PRESCRICAO_SERIES.forEach(function(k){if(rows[0][k]!==child[k])fail_('SCHEMA_ERROR');});}else libraryAppend_(db,'PRESCRICAO_SERIES',child);});
  SpreadsheetApp.flush();
}
function libraryExercise_(db,exerciseId){var e=libraryOne_(db,'EXERCICIOS',exerciseId,true);e.volumeUnitIds=JSON.parse(e.volumeUnitIdsJson);return e;}
function libraryCreateExercise_(db,user,req){
  fields_(req.data,['name','description','modality','primaryIndicatorId','primaryVolumeUnitId','volumeUnitIds','status']);
  return libraryWrite_(db,user,req,'EXERCICIOS',function(id){
    var d=req.data,key=libraryName_(d.name);libraryUnique_(db,'EXERCICIOS',function(e){return e.nameKey===key;},id,req.action,function(p){return libraryName_(p.name)===key;});
    libraryOne_(db,'INDICADORES',d.primaryIndicatorId,true);libraryOne_(db,'UNIDADES',d.primaryVolumeUnitId,true);
    if(!Array.isArray(d.volumeUnitIds)||!d.volumeUnitIds.length||d.volumeUnitIds.length>10||new Set(d.volumeUnitIds).size!==d.volumeUnitIds.length||d.volumeUnitIds.indexOf(d.primaryVolumeUnitId)<0)fail_('INVALID_DATA');
    d.volumeUnitIds.forEach(function(unit){if(['unit-hand-moves','unit-hang-seconds','unit-repetitions','unit-seconds','unit-meters'].indexOf(unit)<0)fail_('INVALID_DATA');libraryOne_(db,'UNIDADES',unit,true);});
    if(d.status!==undefined && ['active','inactive'].indexOf(d.status)<0)fail_('INVALID_DATA');
    return {id:id,name:text_(d.name,150),nameKey:key,description:text_(d.description,2000),modality:text_(d.modality,150),primaryIndicatorId:d.primaryIndicatorId,primaryVolumeUnitId:d.primaryVolumeUnitId,volumeUnitIdsJson:libraryJson_(d.volumeUnitIds),status:d.status||'active',origin:'coach',createdAt:new Date().toISOString()};
  });
}
function libraryAssociate_(db,user,req,table,targetTable,targetField){
  fields_(req.data,['exerciseId',targetField]);
  return libraryWrite_(db,user,req,table,function(id){var d=req.data;libraryExercise_(db,d.exerciseId);libraryOne_(db,targetTable,d[targetField],true);
    libraryUnique_(db,table,function(r){return r.exerciseId===d.exerciseId && r[targetField]===d[targetField];},id,req.action,function(p){return p.exerciseId===d.exerciseId && p[targetField]===d[targetField];});
    var record={id:id,exerciseId:d.exerciseId,createdAt:new Date().toISOString()};record[targetField]=d[targetField];return record;});
}
// A separate RPC avoids changing the existing api() contracts or frontend behavior.
function libraryApi(request){
  var lock;
  try{
    fields_(request,['action','data','requestId','sessionToken']);
    var actions=['catalog','listGeneralCatalog','listExercises','getExercise','createExercise','linkExerciseMethod','linkExerciseCapacity','recordAssessment','getAssessment','validateLoad','createLibraryPrescription','getLibraryPrescription','listAssessments','listLibraryPrescriptions','saveCoachPrescription','listPendingCoachSaves','coachSaveStatus','fingerboardDefinitions','listDraftAssessments','saveCoachSession','resumeCoachSession','coachSessionStatus','abandonCoachSession','listPendingCoachSessions','listSessionModels','getSessionModel','createSessionModel','deleteSessionModel'];
    if(actions.indexOf(request.action)<0)fail_('INVALID_ACTION');
    var identity=sessionIdentity_(request.sessionToken);lock=LockService.getScriptLock();if(!lock.tryLock(5000))fail_('BUSY');
    var db=libraryDb_(),user=userForEmail_(db,identity.email),d=request.data,result;
    if(request.action==='getAssessment'){fields_(d,['assessmentId']);result=libraryOne_(db,'AVALIACOES',d.assessmentId,false);libraryStudent_(db,user,result.studentId);}
    else if(request.action==='getLibraryPrescription'){
      fields_(d,['prescriptionId']);result=libraryOne_(db,'PRESCRICOES',d.prescriptionId,false);workout_(db,user,result.workoutId);libraryStudent_(db,user,result.studentId);
      result.series=libraryRows_(db,'PRESCRICAO_SERIES').filter(function(r){return r.prescriptionId===result.id;});
    }else{
      libraryCoach_(db,user);
      if(request.action==='catalog'){fields_(d,[]);result={};['CAPACIDADES','METODOS','UNIDADES','INDICADORES'].forEach(function(name){result[name]=libraryRows_(db,name);});}
      else if(request.action==='listGeneralCatalog')result=listGeneralCatalog_(db,d);
      else if(request.action==='fingerboardDefinitions'){fields_(d,[]);result=fingerboardDefinitions_();result.tractionBlocks=tractionBlockDefinitions_();result.campusBoard=campusDefinitions_();}
      else if(request.action==='listExercises'){fields_(d,[]);result=libraryRows_(db,'EXERCICIOS');}
      else if(request.action==='getExercise'){fields_(d,['exerciseId']);result=libraryOne_(db,'EXERCICIOS',d.exerciseId,false);result.methods=libraryRows_(db,'EXERCICIO_METODOS').filter(function(r){return r.exerciseId===result.id;});result.capacities=libraryRows_(db,'EXERCICIO_CAPACIDADES').filter(function(r){return r.exerciseId===result.id;});}
      else if(request.action==='listAssessments')result=coachAssessments_(db,user,d);
      else if(request.action==='listLibraryPrescriptions')result=coachPrescriptions_(db,user,d);
      else if(request.action==='listPendingCoachSaves')result=coachPendingSaves_(db,user,d);
      else if(request.action==='coachSaveStatus')result=coachSaveStatus_(db,user,d);
      else if(request.action==='listDraftAssessments')result=coachDraftAssessments_(db,user,d);
      else if(request.action==='coachSessionStatus')result=coachSessionStatus_(db,user,d);
      else if(request.action==='abandonCoachSession')result=coachSessionAbandon_(db,user,d);
      else if(request.action==='listPendingCoachSessions')result=coachSessionPending_(db,user,d);
      else if(request.action==='saveCoachSession'||request.action==='resumeCoachSession')result=coachSessionSave_(db,user,request);
      else if(request.action==='listSessionModels')result=listSessionModels_(db,user,d);
      else if(request.action==='getSessionModel'||request.action==='deleteSessionModel')result=accessSessionModel_(db,user,request);
      else if(request.action==='createSessionModel')result=createSessionModel_(db,user,request);
      else if(request.action==='saveCoachPrescription')result=coachSavePrescription_(db,user,request);
      else if(request.action==='createExercise')result=libraryCreateExercise_(db,user,request);
      else if(request.action==='linkExerciseMethod')result=libraryAssociate_(db,user,request,'EXERCICIO_METODOS','METODOS','methodId');
      else if(request.action==='linkExerciseCapacity')result=libraryAssociate_(db,user,request,'EXERCICIO_CAPACIDADES','CAPACIDADES','capacityId');
      else if(request.action==='recordAssessment')result=libraryRecordAssessment_(db,user,request);
      else if(request.action==='validateLoad')result=libraryValidateLoad_(db,user,d);
      else if(request.action==='createLibraryPrescription')result=libraryCreatePrescription_(db,user,request);
    }
    return {ok:true,data:result};
  }catch(e){var codes=['INVALID_ACTION','INVALID_DATA','IMPOSSIBLE_CAMPUS_PATH','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND','CONFLICT','BUSY','CONFIGURATION_ERROR','SCHEMA_ERROR','ASSESSMENT_NOT_FOUND','ASSESSMENT_OUTDATED','INCOMPATIBLE_INDICATOR','INCOMPATIBLE_UNIT','INCOMPATIBLE_SESSION','MODEL_TOO_LARGE'];return {ok:false,error:{code:codes.indexOf(e.code)>=0?e.code:'INTERNAL_ERROR',...(Number.isInteger(e.itemIndex)?{itemIndex:e.itemIndex}:{}),...(e.sessionNotStarted?{sessionNotStarted:true}:{})}};}
  finally{if(lock && lock.hasLock())lock.releaseLock();}
}
