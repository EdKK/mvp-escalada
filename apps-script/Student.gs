/* Additive student training model. Legacy tables and prescriptions are immutable. */
function optionalRows_(db, name) { return db.getSheetByName(name) ? rows_(db, name) : []; }
function numberRange_(v, min, max, integer) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail_('INVALID_DATA');
  return v;
}
function prescription_(data) {
  fields_(data, ['position','sets','quantity','quantityUnit','restSeconds','intensityMin','intensityMax','intensityUnit','intensityText','rpeApplicable']);
  var p = {position:numberRange_(data.position,1,10000,true), sets:'', quantity:'', quantityUnit:'', restSeconds:'', intensityMin:'', intensityMax:'', intensityUnit:'', intensityText:'', rpeApplicable:false};
  if (data.sets !== undefined) p.sets = numberRange_(data.sets,1,1000,true);
  if (data.quantity !== undefined) {
    p.quantity = numberRange_(data.quantity,0,100000,false);
    if (['repetitions','seconds','hang_seconds','minutes','meters','attempts','moves'].indexOf(data.quantityUnit) < 0) fail_('INVALID_DATA');
    p.quantityUnit = data.quantityUnit;
  } else if (data.quantityUnit !== undefined) fail_('INVALID_DATA');
  if (data.restSeconds !== undefined) p.restSeconds = numberRange_(data.restSeconds,0,86400,true);
  if (data.intensityUnit !== undefined) {
    if (['RPE','kg','%1RM','%bodyweight','grade','other'].indexOf(data.intensityUnit) < 0) fail_('INVALID_DATA');
    p.intensityUnit = data.intensityUnit;
    if (['grade','other'].indexOf(p.intensityUnit)>=0) p.intensityText = text_(data.intensityText,100);
    else {
      var min=p.intensityUnit==='RPE'?1:(p.intensityUnit==='kg'?-1000:0), max=p.intensityUnit==='RPE'?10:10000;
      p.intensityMin=numberRange_(data.intensityMin,min,max,false);
      p.intensityMax=data.intensityMax === undefined?p.intensityMin:numberRange_(data.intensityMax,p.intensityMin,max,false);
    }
  } else if (data.intensityMin !== undefined || data.intensityMax !== undefined || data.intensityText !== undefined) fail_('INVALID_DATA');
  if (data.rpeApplicable !== undefined) {
    if (typeof data.rpeApplicable !== 'boolean') fail_('INVALID_DATA');
    p.rpeApplicable=data.rpeApplicable;
  }
  return p;
}
function supplement_(db, name, key, record) {
  var matches=optionalRows_(db,name).filter(function(r){return r.id===key;});
  if (matches.length>1) fail_('SCHEMA_ERROR');
  if (!matches.length) { append_(db,name,record); SpreadsheetApp.flush(); }
}
function positionTaken_(db,workoutId,itemId,position) {
  if(optionalRows_(db,'ItemPrescription').some(function(r){return r.workoutId===workoutId && r.itemId!==itemId && r.position===position;})) return true;
  // Also respect pending item reservations after a partial multi-sheet write.
  return rows_(db,'Requests').some(function(r){
    if(r.entity!=='Items' || r.entityId===itemId)return false;
    var parsed=JSON.parse(r.fingerprint),d=parsed[1];
    return parsed[0]==='addItem' && d.workoutId===workoutId && d.prescription && d.prescription.position===position;
  });
}
function ensureStudentData_(db, req, record) {
  if (req.action==='createWorkout' && (req.data.instructions !== undefined||req.data.microcycleType!==undefined)) {
    var steps=req.data.microcycleType===undefined?req.data.instructions:{version:1,microcycleType:req.data.microcycleType,instructions:req.data.instructions||[]};
    supplement_(db,'WorkoutGuidance',record.id,{id:record.id,workoutId:record.id,steps:JSON.stringify(steps)});
  }
  if (req.action==='addItem' && req.data.prescription !== undefined) {
    var p=prescription_(req.data.prescription);
    var occupied=positionTaken_(db,record.workoutId,record.id,p.position);
    if (occupied) fail_('CONFLICT');
    p.id=record.id; p.itemId=record.id; p.workoutId=record.workoutId;
    supplement_(db,'ItemPrescription',record.id,p);
  }
}
/* Read-only adapter: library snapshots are authoritative; old rows remain untouched. */
function studentJson_(value){try{return JSON.parse(value);}catch(error){fail_('SCHEMA_ERROR');}}
function studentPrescriptionContext_(db){
  function libraryRows(name){
    if(!db.getSheetByName(name))return [];
    if(typeof libraryRows_!=='function')fail_('CONFIGURATION_ERROR');
    return libraryRows_(db,name);
  }
  return {legacy:optionalRows_(db,'ItemPrescription'),requests:rows_(db,'Requests'),prescriptions:libraryRows('PRESCRICOES'),series:libraryRows('PRESCRICAO_SERIES')};
}
function effectiveItemPrescription_(workout,item,index,context){
  var legacy=context.legacy.filter(function(p){return p.itemId===item.id;});
  if(legacy.length>1 || (legacy.length&&legacy[0].workoutId!==workout.id))fail_('SCHEMA_ERROR');
  var records=context.prescriptions.filter(function(p){return p.itemId===item.id;});
  records.forEach(function(p){if(p.workoutId!==workout.id||p.studentId!==workout.studentId||!Number.isInteger(p.revision)||p.revision<1)fail_('SCHEMA_ERROR');});
  if(new Set(records.map(function(p){return p.revision;})).size!==records.length)fail_('SCHEMA_ERROR');
  var structured=records.length>0,pending=false;
  context.requests.filter(function(r){return r.entity==='Items'||r.entity==='PRESCRICOES';}).forEach(function(r){
    var fp=studentJson_(r.fingerprint);
    if(!Array.isArray(fp)||fp.length!==2||!fp[1]||typeof fp[1]!=='object')fail_('SCHEMA_ERROR');
    var d=fp[1];
    if(r.entity==='Items'&&r.entityId===item.id){
      if(d.workoutId!==workout.id||r.userId!==workout.coachId)fail_('SCHEMA_ERROR');
      if(fp[0]==='saveCoachPrescription')structured=true;
      if(fp[0]==='addItem'&&d.prescription&&!legacy.length)pending=true;
    }
    if(r.entity==='PRESCRICOES'&&fp[0]==='createLibraryPrescription'&&d.itemId===item.id){
      if(d.workoutId!==workout.id||r.userId!==workout.coachId)fail_('SCHEMA_ERROR');
      structured=true;
      if(!records.some(function(p){return p.id===r.entityId;}))pending=true;
    }
  });
  if(pending)return null;
  if(!structured){
    if(legacy.length){legacy[0].rpeApplicable=enabled_(legacy[0].rpeApplicable);return legacy[0];}
    return {position:index+1,quantity:item.quantity,quantityUnit:item.metric,rpeApplicable:false};
  }
  if(!records.length)return null;
  records.sort(function(a,b){return b.revision-a.revision;});var record=records[0];
  if(record.status!=='active')return null;
  var volume=studentJson_(record.volumeJson),intensity=studentJson_(record.intensityJson),snapshot=studentJson_(record.snapshotJson);
  if(!volume||!Array.isArray(volume.lines)||!volume.lines.length||!intensity||!intensity.primary||!snapshot||!snapshot.exercise||!snapshot.session||snapshot.session.id!==workout.id||snapshot.session.studentId!==workout.studentId||snapshot.exercise.id!==record.exerciseId||volume.unitId!==record.volumeUnitId||volume.total!==record.totalVolume)fail_('SCHEMA_ERROR');
  var lines=context.series.filter(function(line){return line.prescriptionId===record.id;});
  if(new Set(volume.lines.map(function(line){return line.id;})).size!==volume.lines.length)fail_('SCHEMA_ERROR');
  if(lines.length<volume.lines.length)return null;
  if(lines.length!==volume.lines.length)fail_('SCHEMA_ERROR');
  volume.lines.forEach(function(expected){
    var matches=lines.filter(function(line){return line.id===expected.id;});if(!matches.length){pending=true;return;}
    if(matches.length!==1)fail_('SCHEMA_ERROR');
    ['blockOrder','setOrder','quantity','occurrences','durationSeconds','volumeUnitId','total'].forEach(function(key){if(matches[0][key]!==expected[key])fail_('SCHEMA_ERROR');});
  });
  if(pending)return null;
  lines.sort(function(a,b){return a.blockOrder-b.blockOrder||a.setOrder-b.setOrder;});
  var unit={'unit-repetitions':'repetitions','unit-hand-moves':'moves','unit-hang-seconds':'hang_seconds','unit-seconds':'seconds','unit-meters':'meters'}[volume.unitId];
  if(!unit)fail_('SCHEMA_ERROR');
  var primary=intensity.primary,aux=intensity.auxiliary||[];
  if(primary.kind==='relative'&&(!primary.reference||primary.reference.id!==record.assessmentId||primary.reference.studentId!==workout.studentId||primary.reference.exerciseId!==record.exerciseId||primary.reference.indicatorId!==primary.indicatorId))fail_('SCHEMA_ERROR');
  if(JSON.stringify(libraryCanonical_(primary))!==JSON.stringify(libraryCanonical_(snapshot.intensity)))fail_('SCHEMA_ERROR');
  var p={position:legacy.length?legacy[0].position:index+1,source:'library',prescriptionId:record.id,revision:record.revision,sets:volume.kind==='hand_moves'?new Set(lines.map(function(line){return line.blockOrder;})).size:lines.length,quantity:'',quantityUnit:unit,restSeconds:'',intensityUnit:'',rpeApplicable:[primary].concat(aux).some(function(i){return i.indicatorId==='int-rpe';}),volume:volume,series:lines,intensity:intensity,reference:primary.reference||null,snapshot:snapshot,feedbackQuantityScope:'total'};
  // A scalar is only a compatibility hint; heterogeneous doses stay in series/volume.
  var doses=lines.map(function(line){return volume.kind==='isometric'?line.durationSeconds:line.quantity;});
  if(doses.every(function(value){return value===doses[0];}))p.quantity=doses[0];
  if(snapshot.task){p.task=snapshot.task;var rest=snapshot.task.version>=2?snapshot.task.restBetweenRepetitionsSeconds:snapshot.task.restSeconds;if(rest!==undefined)p.restSeconds=numberRange_(rest,0,86400,true);}
  if(snapshot.directed){
    var d=snapshot.directed;
    if(record.classification!=='directed'||snapshot.classification!=='directed'||d.version!==1||!Object.prototype.hasOwnProperty.call(directedSubblockNames_(),d.subblock)||snapshot.task)fail_('SCHEMA_ERROR');
    p.directed=d;
    p.restSeconds=d.restBetweenRepetitionsSeconds>0?d.restBetweenRepetitionsSeconds:d.restBetweenSetsSeconds;
  }
  if(snapshot.strength){
    var strength=snapshot.strength;
    var repetitions=strength.repetitionsPerSet*(strength.execution==='unilateral'?2:1);
    if(record.classification!=='general'||snapshot.classification!=='general'||strength.version!==1||
      strength.exerciseId!==record.exerciseId||unit!=='repetitions'||strength.sets!==p.sets||p.directed||p.task||
      volume.total!==strength.sets*repetitions||lines.some(function(line){return line.total!==repetitions;})||
      (strength.oneRm?strength.oneRm.assessmentId:'')!==record.assessmentId)fail_('SCHEMA_ERROR');
    p.strength=strength;
    p.quantity=strength.repetitionsPerSet;
    p.restSeconds=strength.restBetweenSetsSeconds;
    p.rpeApplicable=true;
  }
  return p;
}
function workoutGuidance_(rows,workoutId) {
  var matches=rows.filter(function(g){return g.workoutId===workoutId;});
  if(matches.length>1) fail_('SCHEMA_ERROR');
  if(!matches.length) return {instructions:[]};
  var data=studentJson_(matches[0].steps);
  if(Array.isArray(data)) return {instructions:data};
  if(!data||data.version!==1||typeof data.microcycleType!=='string'||!Array.isArray(data.instructions)) fail_('SCHEMA_ERROR');
  return data;
}
function hydrateStudentWorkout_(db, workout, user) {
  var context=studentPrescriptionContext_(db);
  var guidance=workoutGuidance_(optionalRows_(db,'WorkoutGuidance'),workout.id);
  workout.instructions=guidance.instructions;
  if(guidance.microcycleType!==undefined) workout.microcycleType=guidance.microcycleType;
  workout.items=workout.items.filter(function(item,index){
    var p=effectiveItemPrescription_(workout,item,index,context);
    if(!p){if(!user||user.role!=='coach')return false;item.prescriptionPending=true;}
    item.prescription=p;return true;
  });
  workout.items.sort(function(a,b){return (a.prescription?a.prescription.position:100000)-(b.prescription?b.prescription.position:100000);});
  if(user&&user.role==='coach'&&typeof coachSessionModelEligible_==='function'){
    workout.canSaveSessionModel=coachSessionModelEligible_(user,workout,workout.items,context.requests);
  }
  var visibleIds=new Set(workout.items.map(function(item){return item.id;}));
  var feedback=optionalRows_(db,'ItemFeedback').filter(function(f){return f.workoutId===workout.id&&f.studentId===workout.studentId&&visibleIds.has(f.itemId);});
  workout.itemFeedback=feedback.map(itemFeedbackReader_(context,workout,feedback));
  return workout;
}
// An immediate completion keeps the previous dose and links to its revision.
function itemFeedbackReader_(context,workout,history){
  var requests=new Map(context.requests.filter(function(row){return row.entity==='ItemFeedback';}).map(function(row){return [row.entityId,row];}));
  var prescriptions=new Map(context.prescriptions.filter(function(row){return row.workoutId===workout.id;}).map(function(row){return [row.id,row];}));
  var byId=new Map(history.map(function(row){return [row.id,row];}));
  return function(record){
    var source=record,reservation=requests.get(source.id);
    while(reservation&&studentJson_(reservation.fingerprint)[1].completeOnly&&source.supersedesId){
      var previous=byId.get(source.supersedesId);
      if(!previous||previous.workoutId!==source.workoutId||previous.itemId!==source.itemId||
        previous.studentId!==source.studentId||previous.revision!==source.revision-1)fail_('SCHEMA_ERROR');
      source=previous;reservation=requests.get(source.id);
    }
    var details=structuredFeedbackDetails_(Object.assign({},source),reservation,prescriptions);
    ['prescriptionId','actualSeries','actualRepetitions','actualKilograms'].forEach(function(key){
      if(details[key]!==undefined)record[key]=details[key];
    });
    return record;
  };
}
// Revisions written before BIB-13E can have a stored aggregate without explicit series.
function structuredFeedbackDetails_(record,reservation,prescriptions){
  if(!reservation)return record;
  var fp=studentJson_(reservation.fingerprint);
  if(fp[0]!=='submitItemFeedback')return record;
  var data=fp[1],versioned=data.structuredFeedback;
  if(versioned!==undefined&&(!versioned||versioned.version!==2))fail_('SCHEMA_ERROR');
  var details=versioned||data,strengthId=details.strengthPrescriptionId,prescriptionId=strengthId||details.prescriptionId;
  if(!prescriptionId)return record;
  if(reservation.userId!==record.studentId||data.itemId!==record.itemId||data.workoutId!==record.workoutId)fail_('SCHEMA_ERROR');
  record.prescriptionId=prescriptionId;
  if(details.actualSeries!==undefined)record.actualSeries=details.actualSeries;
  var historicalCompletion=!versioned&&!strengthId&&data.actualSeries===undefined&&record.status==='completed'&&record.actualQuantity!=='';
  if(!strengthId&&!historicalCompletion)return record;
  var prescription=prescriptions.get(prescriptionId);
  if(!prescription||prescription.itemId!==record.itemId||prescription.workoutId!==record.workoutId)fail_('SCHEMA_ERROR');
  var snapshot=studentJson_(prescription.snapshotJson);
  if(strengthId){
    if(!snapshot.strength)fail_('SCHEMA_ERROR');
    if(details.actualRepetitions!==undefined)record.actualRepetitions=details.actualRepetitions;
    if(details.actualKilograms!==undefined)record.actualKilograms=details.actualKilograms;
    return record;
  }
  var directed=snapshot.directed;
  if(!directed||directed.version!==1||!Object.prototype.hasOwnProperty.call(directedSubblockNames_(),directed.subblock))fail_('SCHEMA_ERROR');
  record.actualSeries=Array.from({length:directed.sets},function(){
    var line={repetitions:directed.repetitionsPerSet};
    if(directed.modality==='isometric')line.seconds=Math.round(directed.repetitionsPerSet*directed.durationSeconds*1e9)/1e9;
    if(directed.path)line.additionalMoves=0;
    return line;
  });
  return record;
}
function applyDirectedFeedback_(record,data,p){
  if(data.prescriptionId!==p.prescriptionId)fail_('CONFLICT');
  if(data.actualSets!==undefined||data.actualQuantity!==undefined||data.quantityUnit!==undefined)fail_('INVALID_DATA');
  if(data.actualSeries===undefined)return;
  if(!Array.isArray(data.actualSeries)||data.actualSeries.length!==p.sets)fail_('INVALID_DATA');
  var isometric=p.directed.modality==='isometric',path=p.directed.path,notDone=data.status==='not_done';
  var sets=0,volume=0,allSetsKnown=true,allVolumesKnown=true;
  data.actualSeries.forEach(function(line){
    fields_(line,isometric?['repetitions','seconds']:path?['repetitions','additionalMoves']:['repetitions']);
    var reps=line.repetitions,seconds=line.seconds,moves=line.additionalMoves;
    var maxReps=path?p.directed.repetitionsPerSet:10000;
    if(reps!==undefined)numberRange_(reps,0,notDone?0:maxReps,true);
    if(seconds!==undefined)numberRange_(seconds,0,notDone?0:1e9,false);
    if(moves!==undefined)numberRange_(moves,0,notDone?0:(maxReps-(reps??0))*(path.movesPerRep-1),true);
    var quantity=isometric?seconds:path?(reps!==undefined&&moves!==undefined?reps*path.movesPerRep+moves:undefined):reps;
    if(reps>0||quantity>0||moves>0)sets++;
    else if(reps!==0||quantity!==0)allSetsKnown=false;
    if(quantity===undefined)allVolumesKnown=false;
    else volume+=quantity;
  });
  if(allSetsKnown)record.actualSets=sets;
  if(allVolumesKnown){
    record.actualQuantity=Math.round(volume*1e9)/1e9;
    record.quantityUnit=p.quantityUnit;
  }
}
// Hide structured details from the v30 reader while retaining the same public request.
function versionedFeedbackRequest_(req){
  var data=Object.assign({},req.data),details={version:2};
  ['prescriptionId','strengthPrescriptionId','actualSeries','actualRepetitions','actualKilograms'].forEach(function(key){
    if(data[key]!==undefined)details[key]=data[key];
    delete data[key];
  });
  data.structuredFeedback=details;
  return Object.assign({},req,{data:data});
}
function saveItemFeedback_(db,user,req) {
  if (user.role!=='student') fail_('FORBIDDEN');
  var d=req.data;
  fields_(d,['workoutId','itemId','status','rpe','fingerPain','comment','actualSets','actualQuantity','quantityUnit','expectedRevision','prescriptionId','actualSeries','actualRepetitions','actualKilograms','strengthPrescriptionId','completeOnly']);
  var w=workout_(db,user,text_(d.workoutId,100));
  var items=rows_(db,'Items').filter(function(i){return i.id===d.itemId && i.workoutId===w.id;});
  if(items.length!==1) fail_('NOT_FOUND');
  var completeOnly=d.completeOnly===true;
  if(d.completeOnly!==undefined){
    fields_(d,['workoutId','itemId','status','expectedRevision','completeOnly']);
    if(!completeOnly||d.status!=='completed')fail_('INVALID_DATA');
  }
  var context=studentPrescriptionContext_(db);
  var reservations=context.requests.filter(function(r){return r.userId===user.id&&r.key===req.requestId;});
  if(reservations.length>1)fail_('CONFLICT');
  var reservation=reservations[0];
  if(d.prescriptionId!==undefined&&d.strengthPrescriptionId!==undefined)fail_('INVALID_DATA');
  var prescriptionId=d.strengthPrescriptionId===undefined?d.prescriptionId:d.strengthPrescriptionId;
  var prescriptions,storedRequest=req;
  if(prescriptionId!==undefined){
    prescriptions=new Map(context.prescriptions.filter(function(p){return p.workoutId===w.id;}).map(function(p){return [p.id,p];}));
    // A receipt written by an older release still replays with its original fingerprint.
    if(!reservation||reservation.fingerprint!==fingerprint_(req.action,d))storedRequest=versionedFeedbackRequest_(req);
  }
  var storedFingerprint=fingerprint_(storedRequest.action,storedRequest.data);
  if(reservation&&prescriptionId!==undefined){
    if(reservation.entity!=='ItemFeedback'||reservation.fingerprint!==storedFingerprint)fail_('CONFLICT');
    var saved=optionalRows_(db,'ItemFeedback').filter(function(f){return f.id===reservation.entityId;});
    if(saved.length>1)fail_('SCHEMA_ERROR');
    if(saved.length)return structuredFeedbackDetails_(saved[0],reservation,prescriptions);
    // An interrupted submission retains the original prescription even after an edit.
    context.prescriptions=context.prescriptions.filter(function(p){return p.itemId!==d.itemId||p.id===prescriptionId;});
    context.requests=context.requests.filter(function(r){
      if(r.entity!=='PRESCRICOES')return true;
      var fp=studentJson_(r.fingerprint);
      return fp[1].itemId!==d.itemId||r.entityId===prescriptionId;
    });
  }
  var p=effectiveItemPrescription_(w,items[0],0,context);
  if(!p)fail_('NOT_FOUND');
  if (['completed','partial','not_done'].indexOf(d.status)<0) fail_('INVALID_DATA');
  var record={id:id_(),workoutId:w.id,itemId:items[0].id,studentId:user.id,status:d.status,
    rpe:d.rpe===undefined||d.rpe===null?'':numberRange_(d.rpe,1,10,true),
    fingerPain:d.fingerPain===undefined?'':numberRange_(d.fingerPain,0,10,true),
    comment:d.comment===undefined||d.comment===''?'':text_(d.comment,2000),
    actualSets:'',actualQuantity:'',quantityUnit:'',createdAt:new Date().toISOString()};
  if(!completeOnly){
    if(!p.strength&&(d.actualRepetitions!==undefined||d.actualKilograms!==undefined||d.strengthPrescriptionId!==undefined))fail_('INVALID_DATA');
    if(p.strength)applyStrengthFeedback_(record,d,p);
    else if(p.directed)applyDirectedFeedback_(record,d,p);
    else{
      if(d.prescriptionId!==undefined||d.actualSeries!==undefined)fail_('INVALID_DATA');
      if(d.actualSets!==undefined){
        if(p.sets===''||p.sets===undefined)fail_('INVALID_DATA');
        record.actualSets=numberRange_(d.actualSets,0,1000,true);
      }
      if(d.actualQuantity!==undefined){
        if(!p.quantityUnit||d.quantityUnit!==p.quantityUnit)fail_('INVALID_DATA');
        record.actualQuantity=numberRange_(d.actualQuantity,0,p.source==='library'?1e12:100000,p.source==='library'&&['repetitions','moves'].indexOf(p.quantityUnit)>=0);
        record.quantityUnit=d.quantityUnit;
      }else if(d.quantityUnit!==undefined)fail_('INVALID_DATA');
      if(d.status==='not_done'&&(record.actualSets>0||record.actualQuantity>0))fail_('INVALID_DATA');
    }
  }
  numberRange_(d.expectedRevision,0,100000,true);
  var beforeInsert=function(){
    var previous=optionalRows_(db,'ItemFeedback').filter(function(f){return f.itemId===record.itemId && f.studentId===user.id && f.workoutId===w.id;}).sort(function(a,b){return b.revision-a.revision;})[0];
    if(d.expectedRevision!==(previous?previous.revision:0)) fail_('CONFLICT');
    record.revision=d.expectedRevision+1; record.supersedesId=previous?previous.id:'';
    if(completeOnly&&previous){
      ['rpe','fingerPain','comment','actualSets','actualQuantity','quantityUnit'].forEach(function(key){record[key]=previous[key];});
    }
  };
  var savedRecord=persistRecord_(db,user,storedRequest,'ItemFeedback',record,beforeInsert);
  if(completeOnly){
    var history=optionalRows_(db,'ItemFeedback').filter(function(row){
      return row.workoutId===w.id&&row.itemId===d.itemId&&row.studentId===user.id;
    });
    context.requests=rows_(db,'Requests');
    return itemFeedbackReader_(context,w,history)(savedRecord);
  }
  return p.directed||p.strength?structuredFeedbackDetails_(savedRecord,{fingerprint:storedFingerprint,userId:user.id},prescriptions):savedRecord;
}
