/* MVP Escalada. Public RPC: api(request). All helpers are private to Apps Script. */
var SCHEMA_ = {
  Users: ['id', 'email', 'role', 'active'],
  Links: ['id', 'coachId', 'studentId', 'active'],
  Workouts: ['id', 'coachId', 'studentId', 'date', 'goal', 'createdAt'],
  Items: ['id', 'workoutId', 'block', 'category', 'exercise', 'metric', 'quantity', 'minutes', 'notes', 'createdAt'],
  Feedback: ['id', 'workoutId', 'studentId', 'status', 'reason', 'fingerPain', 'rpe', 'comment', 'createdAt'],
  WorkoutGuidance: ['id','workoutId','steps'],
  ItemPrescription: ['id','itemId','workoutId','position','sets','quantity','quantityUnit','restSeconds','intensityMin','intensityMax','intensityUnit','intensityText','rpeApplicable'],
  ItemFeedback: ['id','workoutId','itemId','studentId','status','rpe','fingerPain','comment','actualSets','actualQuantity','quantityUnit','revision','supersedesId','createdAt'],
  Requests: ['id', 'userId', 'key', 'fingerprint', 'entity', 'entityId']
};
function fail_(code) { var e = new Error(code); e.code = code; throw e; }
function text_(v, max) {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /^[\s]*[=+@-]/.test(v)) fail_('INVALID_DATA');
  return v.trim();
}
function fields_(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).some(function(k) { return allowed.indexOf(k) < 0; })) fail_('INVALID_DATA');
}
function db_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) fail_('CONFIGURATION_ERROR');
  return SpreadsheetApp.openById(id);
}
function sheet_(db, name, schema) {
  schema = schema || SCHEMA_;
  var s = db.getSheetByName(name);
  if (!s || JSON.stringify(s.getRange(1, 1, 1, schema[name].length).getValues()[0]) !== JSON.stringify(schema[name]) || s.getLastColumn() !== schema[name].length) fail_('SCHEMA_ERROR');
  return s;
}
function rows_(db, name, schema) {
  schema = schema || SCHEMA_;
  var s = sheet_(db, name, schema), n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, schema[name].length).getValues().map(function(row) {
    var out = {}; schema[name].forEach(function(k, i) { out[k] = row[i] instanceof Date ? (k === 'date' ? row[i].toISOString().slice(0, 10) : row[i].toISOString()) : row[i]; }); return out;
  });
}
function append_(db, name, obj, schema) {
  schema = schema || SCHEMA_;
  sheet_(db, name, schema).appendRow(schema[name].map(function(k) { return obj[k] === undefined ? '' : obj[k]; }));
}
function enabled_(v) { return v === true || v === 'TRUE'; }
function userForEmail_(db, email) {
  var matches = rows_(db, 'Users').filter(function(u) { return String(u.email).toLowerCase() === email.toLowerCase() && enabled_(u.active); });
  if (matches.length !== 1 || ['coach', 'student'].indexOf(matches[0].role) < 0) fail_('FORBIDDEN');
  var user = matches[0];
  if (rows_(db, 'Users').filter(function(u) { return u.id === user.id; }).length !== 1) fail_('SCHEMA_ERROR');
  return user;
}
function linked_(db, coach, student) {
  return rows_(db, 'Users').some(function(u) { return u.id === student && u.role === 'student' && enabled_(u.active); }) && rows_(db, 'Links').some(function(l) { return l.coachId === coach && l.studentId === student && enabled_(l.active); });
}
function visible_(db, user, w) {
  return user.role === 'student' ? w.studentId === user.id : w.coachId === user.id && linked_(db, user.id, w.studentId);
}
function workout_(db, user, id) {
  var found = rows_(db, 'Workouts').filter(function(w) { return w.id === id; });
  if (found.length !== 1 || !visible_(db, user, found[0])) fail_('NOT_FOUND');
  return found[0];
}
function id_() { return Utilities.getUuid(); }
function fingerprint_(action, data) {
  var canonical = {}; Object.keys(data).sort().forEach(function(k) { canonical[k] = data[k]; });
  return JSON.stringify([action, canonical]);
}
function microcycleType_(value) {
  if (['Introdutório','Ordinário','Choque','Estabilizador','Manutenção','Recuperativo','Controle','Pré-competitivo','Competitivo'].indexOf(value)<0) fail_('INVALID_DATA');
  return value;
}
function create_(db, user, req) {
  if (user.role !== (req.action === 'submitFeedback' ? 'student' : 'coach')) fail_('FORBIDDEN');
  var d = req.data, entity, record;
  var key = text_(req.requestId, 100);
  if (req.action === 'createWorkout') {
    fields_(d, ['studentId', 'date', 'goal', 'microcycleType', 'instructions']);
    if (d.instructions !== undefined && (!Array.isArray(d.instructions) || d.instructions.length>20)) fail_('INVALID_DATA');
    if (d.instructions) d.instructions.forEach(function(step){text_(step,500);});
    if ((d.goal === undefined) === (d.microcycleType === undefined)) fail_('INVALID_DATA');
    if (d.microcycleType !== undefined) { microcycleType_(d.microcycleType); sheet_(db,'WorkoutGuidance'); }
    var student = text_(d.studentId, 100), date = text_(d.date, 10), goal = d.goal===undefined?'':text_(d.goal, 500);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail_('INVALID_DATA');
    if (!linked_(db, user.id, student)) fail_('FORBIDDEN');
    entity = 'Workouts'; record = {id: id_(), coachId: user.id, studentId: student, date: date, goal: goal, createdAt: new Date().toISOString()};
  } else if (req.action === 'submitFeedback') {
    fields_(d, ['workoutId', 'status', 'reason', 'fingerPain', 'rpe', 'comment']);
    var target = workout_(db, user, text_(d.workoutId, 100));
    if (['Concluído', 'Parcial', 'Não fez'].indexOf(d.status) < 0) fail_('INVALID_DATA');
    var reason = d.reason === undefined ? '' : d.reason;
    if (['', 'Sem tempo', 'Dor', 'Cansaço', 'Sem acesso', 'Outro'].indexOf(reason) < 0 || (d.status !== 'Concluído' && !reason)) fail_('INVALID_DATA');
    ['fingerPain', 'rpe'].forEach(function(k) { if (!Number.isInteger(d[k]) || d[k] < (k === 'rpe' ? 1 : 0) || d[k] > 10) fail_('INVALID_DATA'); });
    entity = 'Feedback'; record = {id: id_(), workoutId: target.id, studentId: user.id, status: d.status, reason: reason, fingerPain: d.fingerPain, rpe: d.rpe, comment: d.comment === undefined || d.comment === '' ? '' : text_(d.comment, 2000), createdAt: new Date().toISOString()};
  } else {
    fields_(d, ['workoutId', 'block', 'category', 'exercise', 'metric', 'quantity', 'minutes', 'notes', 'prescription']);
    if (d.prescription !== undefined) prescription_(d.prescription);
    var w = workout_(db, user, text_(d.workoutId, 100));
    entity = 'Items'; record = {id: id_(), workoutId: w.id, createdAt: new Date().toISOString()};
    ['block', 'category', 'exercise', 'metric'].forEach(function(k) { record[k] = text_(d[k], 500); });
    ['quantity', 'minutes'].forEach(function(k) { if (typeof d[k] !== 'number' || !Number.isFinite(d[k]) || d[k] < 0 || d[k] > 100000) fail_('INVALID_DATA'); record[k] = d[k]; });
    record.notes = d.notes === undefined || d.notes === '' ? '' : text_(d.notes, 2000);
  }
  return persistRecord_(db,user,req,entity,record,function(){
    if(req.action==='addItem' && req.data.prescription) {
      var position=req.data.prescription.position;
      if(positionTaken_(db,record.workoutId,record.id,position)) fail_('CONFLICT');
    }
  });
}
function persistRecord_(db,user,req,entity,record,beforeInsert) {
  var key=text_(req.requestId,100), fingerprint=fingerprint_(req.action,req.data);
  var previous=rows_(db,'Requests').filter(function(r){return r.userId===user.id && r.key===key;});
  if(previous.length) {
    if(previous.length!==1 || previous[0].fingerprint!==fingerprint || previous[0].entity!==entity) fail_('CONFLICT');
    record.id=previous[0].entityId;
  }
  var existing=rows_(db,entity).filter(function(r){return r.id===record.id;});
  if(existing.length>1) fail_('SCHEMA_ERROR');
  if(!existing.length && beforeInsert) beforeInsert();
  if(!previous.length) {
    append_(db,'Requests',{id:id_(),userId:user.id,key:key,fingerprint:fingerprint,entity:entity,entityId:record.id});
    SpreadsheetApp.flush();
  }
  var saved=existing[0]||record;
  var microcycle=req.action==='createWorkout'&&req.data.microcycleType!==undefined;
  if(microcycle) ensureStudentData_(db,req,saved);
  if(!existing.length) {append_(db,entity,record); SpreadsheetApp.flush();}
  if(!microcycle) ensureStudentData_(db,req,saved);
  else saved.microcycleType=req.data.microcycleType;
  return saved;
}

function api(request) {
  var lock;
  try {
    fields_(request, ['action', 'data', 'requestId', 'sessionToken']);
    if (['beginLogin', 'finishLogin', 'logout', 'getSession', 'listStudents', 'listFeedback', 'submitFeedback', 'submitItemFeedback', 'listWorkouts', 'getWorkout', 'createWorkout', 'addItem'].indexOf(request.action) < 0) fail_('INVALID_ACTION');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) fail_('BUSY');
    if (request.action === 'beginLogin') return {ok:true, data:beginLogin_(request.data)};
    if (request.action === 'finishLogin') return {ok:true, data:finishLogin_(request.data)};
    if (request.action === 'logout') { fields_(request.data, []); return {ok:true, data:logout_(request.sessionToken)}; }
    var identity = sessionIdentity_(request.sessionToken);
    var db = db_(), user = userForEmail_(db, identity.email), result;
    if (request.action === 'getSession') {
      fields_(request.data, []); result = {id: user.id, role: user.role};
    } else if (request.action === 'listStudents') {
      fields_(request.data, []); if (user.role !== 'coach') fail_('FORBIDDEN');
      var names = typeof financeStudentNames_ === 'function' ? financeStudentNames_(db, user.id, true) : new Map();
      result = rows_(db, 'Users').filter(function(u) { return u.role === 'student' && linked_(db, user.id, u.id); }).map(function(u) {
        return names.has(u.id) ? {id: u.id, name: names.get(u.id)} : {id: u.id};
      });
    } else if (request.action === 'listFeedback') {
      fields_(request.data, ['workoutId']);
      var target = workout_(db, user, text_(request.data.workoutId, 100));
      result = rows_(db, 'Feedback').filter(function(f) { return f.workoutId === target.id && f.studentId === target.studentId; });
    } else if (request.action === 'listWorkouts') {
      fields_(request.data, []);
      var guidance=optionalRows_(db,'WorkoutGuidance');
      result = rows_(db, 'Workouts').filter(function(w) { return visible_(db, user, w); }).map(function(w){
        var metadata=workoutGuidance_(guidance,w.id);
        if(metadata.microcycleType!==undefined) w.microcycleType=metadata.microcycleType;
        return w;
      });
    } else if (request.action === 'getWorkout') {
      fields_(request.data, ['workoutId']);
      result = workout_(db, user, text_(request.data.workoutId, 100));
      result.items = rows_(db, 'Items').filter(function(i) { return i.workoutId === result.id; });
      result=hydrateStudentWorkout_(db,result,user);
    } else if(request.action==='submitItemFeedback') result=saveItemFeedback_(db,user,request);
    else result = create_(db, user, request);
    return {ok: true, data: result};
  } catch (e) {
    var allowed = ['INVALID_DATA', 'INVALID_ACTION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'BUSY', 'CONFIGURATION_ERROR', 'SCHEMA_ERROR', 'AUTH_FAILED'];
    return {ok: false, error: {code: allowed.indexOf(e.code) >= 0 ? e.code : 'INTERNAL_ERROR'}};
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
// Run manually from the editor. Existing sheets are checked, never cleared or overwritten.
function initializeSchema_() {
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var db = db_();
    Object.keys(SCHEMA_).forEach(function(name) {
      if (!db.getSheetByName(name)) db.insertSheet(name).appendRow(SCHEMA_[name]);
      sheet_(db, name);
    });
  } finally { lock.releaseLock(); }
}

// Serves the isolated integration UI; does not deploy the project.
function doGet(e) {
  var p = e && e.parameter;
  if (p && (p.state !== undefined || p.code !== undefined || p.error !== undefined)) {
    var ok = completeGoogleLogin_(p);
    // No tokens or claims in the callback page or URL. Only original tab can finish login.
    return oauthReturnPage_(ok);
  }
  if(!p || p.view!=='coach') {
    var redirect=PropertiesService.getScriptProperties().getProperty('GOOGLE_REDIRECT_URI') || '';
    var coachUrl=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(redirect)?redirect:'https://script.google.com/home';
    return HtmlService.createHtmlOutput(HtmlService.createHtmlOutputFromFile('Student').getContent().replace('@@COACH_URL@@',coachUrl+'?view=coach')).addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover').setTitle('MVP Escalada — Aluno');
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('MVP Escalada');
}

// Presentation only. Callback URLs/claims/tokens are never interpolated into HTML.
function oauthReturnPage_(ok) {
  var redirect=PropertiesService.getScriptProperties().getProperty('GOOGLE_REDIRECT_URI') || '';
  var validUrl=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(redirect);
  var values={
    RESULT:ok?'success':'failure',
    ICON:ok?'<path d="m12 24 8 8 16-18"/>':'<path d="m15 15 18 18m0-18L15 33"/>',
    TITLE:ok?'Autenticação concluída':'Não foi possível autenticar',
    INSTRUCTION:ok?"Volte à aba original do MVP Escalada para entrar automaticamente. Se precisar, use “Concluir entrada”.":'Volte à aba original do MVP Escalada e prepare uma nova entrada.',
    FALLBACK:'Tentaremos fechar esta aba para voltar ao MVP. Se isso não funcionar, abra o seletor de abas do Safari ou do seu navegador e volte à aba original. Não recarregue a aba original.',
    RECOVERY_HIDDEN:validUrl?'':'hidden',
    APP_URL:validUrl?redirect:'#'
  };
  var html=HtmlService.createHtmlOutputFromFile('OAuthReturn').getContent().replace(/@@([A-Z_]+)@@/g,function(_,key){return values[key];});
  return HtmlService.createHtmlOutput(html).addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover').setTitle('MVP Escalada — entrada');
}
