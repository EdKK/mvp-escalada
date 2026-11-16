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
  if (req.action==='createWorkout' && req.data.instructions !== undefined) {
    supplement_(db,'WorkoutGuidance',record.id,{id:record.id,workoutId:record.id,steps:JSON.stringify(req.data.instructions)});
  }
  if (req.action==='addItem' && req.data.prescription !== undefined) {
    var p=prescription_(req.data.prescription);
    var occupied=positionTaken_(db,record.workoutId,record.id,p.position);
    if (occupied) fail_('CONFLICT');
    p.id=record.id; p.itemId=record.id; p.workoutId=record.workoutId;
    supplement_(db,'ItemPrescription',record.id,p);
  }
}
function hydrateStudentWorkout_(db, workout) {
  var details=optionalRows_(db,'ItemPrescription').filter(function(p){return p.workoutId===workout.id;});
  var guidance=optionalRows_(db,'WorkoutGuidance').filter(function(g){return g.workoutId===workout.id;});
  if (guidance.length>1) fail_('SCHEMA_ERROR');
  workout.instructions=guidance.length?JSON.parse(guidance[0].steps):[];
  workout.items.forEach(function(item,index){
    var matches=details.filter(function(p){return p.itemId===item.id;});
    if (matches.length>1) fail_('SCHEMA_ERROR');
    if(matches[0]) matches[0].rpeApplicable=enabled_(matches[0].rpeApplicable);
    item.prescription=matches[0] || {position:index+1,quantity:item.quantity,quantityUnit:item.metric,rpeApplicable:false};
  });
  workout.items.sort(function(a,b){return a.prescription.position-b.prescription.position;});
  var history=optionalRows_(db,'ItemFeedback').filter(function(f){return f.workoutId===workout.id && f.studentId===workout.studentId;});
  workout.itemFeedback=history;
  return workout;
}
function saveItemFeedback_(db,user,req) {
  if (user.role!=='student') fail_('FORBIDDEN');
  var d=req.data;
  fields_(d,['workoutId','itemId','status','rpe','fingerPain','comment','actualSets','actualQuantity','quantityUnit','expectedRevision']);
  var w=workout_(db,user,text_(d.workoutId,100));
  var items=rows_(db,'Items').filter(function(i){return i.id===d.itemId && i.workoutId===w.id;});
  if(items.length!==1) fail_('NOT_FOUND');
  var p=optionalRows_(db,'ItemPrescription').filter(function(p){return p.itemId===d.itemId && p.workoutId===w.id;})[0];
  if (['completed','partial','not_done'].indexOf(d.status)<0) fail_('INVALID_DATA');
  var record={id:id_(),workoutId:w.id,itemId:items[0].id,studentId:user.id,status:d.status,rpe:'',fingerPain:numberRange_(d.fingerPain,0,10,true),comment:d.comment===undefined||d.comment===''?'':text_(d.comment,2000),actualSets:'',actualQuantity:'',quantityUnit:'',createdAt:new Date().toISOString()};
  if(d.rpe!==undefined && d.rpe!==null) {
    if(!p || !enabled_(p.rpeApplicable)) fail_('INVALID_DATA');
    record.rpe=numberRange_(d.rpe,1,10,true);
  }
  if(d.actualSets!==undefined) {
    if(!p || p.sets==='') fail_('INVALID_DATA');
    record.actualSets=numberRange_(d.actualSets,0,1000,true);
  }
  if(d.actualQuantity!==undefined) {
    if(!p || !p.quantityUnit || d.quantityUnit!==p.quantityUnit) fail_('INVALID_DATA');
    record.actualQuantity=numberRange_(d.actualQuantity,0,100000,false); record.quantityUnit=d.quantityUnit;
  } else if(d.quantityUnit!==undefined) fail_('INVALID_DATA');
  numberRange_(d.expectedRevision,0,100000,true);
  var beforeInsert=function(){
    var previous=optionalRows_(db,'ItemFeedback').filter(function(f){return f.itemId===record.itemId && f.studentId===user.id && f.workoutId===w.id;}).sort(function(a,b){return b.revision-a.revision;})[0];
    if(d.expectedRevision!==(previous?previous.revision:0)) fail_('CONFLICT');
    record.revision=d.expectedRevision+1; record.supersedesId=previous?previous.id:'';
  };
  return persistRecord_(db,user,req,'ItemFeedback',record,beforeInsert);
}
