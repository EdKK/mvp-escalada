/* Registration and manual financial records for the coach's active student links. */
var FINANCE_SCHEMA_ = {
  CADASTROS: ['id', 'coachId', 'studentId', 'name', 'whatsapp', 'startedOn'],
  PLANOS: ['id', 'coachId', 'studentId', 'mode', 'amountCents', 'startedOn', 'dueOn', 'payment', 'paidOn'],
  AULAS: ['id', 'coachId', 'studentId', 'planId', 'date', 'active']
};

function financeRows_(db, table) {
  return rows_(db, table, FINANCE_SCHEMA_).map(function(row) {
    ['startedOn', 'dueOn', 'paidOn'].forEach(function(key) {
      if (row[key]) row[key] = String(row[key]).slice(0, 10);
    });
    return row;
  });
}

function financeSave_(db, table, record, previous) {
  if (!previous) return append_(db, table, record, FINANCE_SCHEMA_);
  var schema = FINANCE_SCHEMA_[table] || SCHEMA_[table];
  var sheet = sheet_(db, table, FINANCE_SCHEMA_[table] ? FINANCE_SCHEMA_ : SCHEMA_);
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var index = ids.findIndex(function(row) { return row[0] === previous.id; });
  if (index < 0 || ids.filter(function(row) { return row[0] === previous.id; }).length !== 1) fail_('SCHEMA_ERROR');
  sheet.getRange(index + 2, 1, 1, schema.length).setValues([schema.map(function(key) { return record[key]; })]);
}

function financeDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail_('INVALID_DATA');
  return value;
}

function financeRequestId_(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)) fail_('INVALID_DATA');
  return value;
}

function financeId_(owner, requestId) {
  return 'f-' + hashAuth_(JSON.stringify([owner, financeRequestId_(requestId)]));
}

function financeStudents_(db, coachId) {
  var links = new Set(rows_(db, 'Links').filter(function(link) {
    return link.coachId === coachId && enabled_(link.active);
  }).map(function(link) { return link.studentId; }));
  return rows_(db, 'Users').filter(function(user) {
    return user.role === 'student' && enabled_(user.active) && links.has(user.id);
  });
}

function financeStudentNames_(db, coachId, optional) {
  try {
    return new Map(financeRows_(db, 'CADASTROS').filter(function(profile) {
      return profile.coachId === coachId;
    }).map(function(profile) { return [profile.studentId, profile.name]; }));
  } catch (error) {
    if (!optional || error.code !== 'SCHEMA_ERROR') throw error;
    return new Map();
  }
}

function financeOwned_(db, table, coachId, studentId) {
  return financeRows_(db, table).filter(function(row) {
    return row.coachId === coachId && row.studentId === studentId;
  });
}

function financeProfile_(user, profile) {
  return {
    id: user.id, email: user.email, name: profile ? profile.name : '',
    whatsapp: profile ? String(profile.whatsapp).replace(/^tel:/, '') : '',
    startedOn: profile ? String(profile.startedOn).slice(0, 10) : ''
  };
}

function financeSaveStudent_(db, coach, request) {
  var data = request.data;
  fields_(data, ['studentId', 'name', 'email', 'whatsapp', 'startedOn']);
  var creating = data.studentId === '';
  var studentId = creating ? 'student-' + financeId_(coach.id, request.requestId) : text_(data.studentId, 100);
  var users = rows_(db, 'Users'), matches = users.filter(function(user) { return user.id === studentId; });
  if (matches.length > 1) fail_('SCHEMA_ERROR');
  var student = matches[0];
  var links = rows_(db, 'Links').filter(function(link) {
    return link.studentId === studentId && enabled_(link.active);
  });
  var ownLink = links.find(function(link) { return link.coachId === coach.id; });
  if ((!creating || student) && (!student || student.role !== 'student' || !enabled_(student.active) || !ownLink)) fail_('FORBIDDEN');

  var email = text_(data.email, 254).toLowerCase();
  var currentEmail = student && String(student.email).toLowerCase();
  if (email !== currentEmail) {
    if (!/^[a-z0-9][a-z0-9._+%-]*@(gmail\.com|googlemail\.com)$/.test(email)) fail_('INVALID_DATA');
    if (student && links.some(function(link) { return link.coachId !== coach.id; })) fail_('FORBIDDEN');
  }
  if (users.some(function(user) { return user.id !== studentId && String(user.email).toLowerCase() === email; })) fail_('CONFLICT');

  var phone = data.whatsapp;
  if (typeof phone !== 'string' || !/^\+?[\d ()-]{8,24}$/.test(phone)) fail_('INVALID_DATA');
  var digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) fail_('INVALID_DATA');
  var profile = {
    id: JSON.stringify([coach.id, studentId]), coachId: coach.id, studentId: studentId,
    name: text_(data.name, 120), whatsapp: 'tel:' + (phone.startsWith('+') ? '+' : '') + digits,
    startedOn: financeDate_(data.startedOn)
  };
  var profiles = financeOwned_(db, 'CADASTROS', coach.id, studentId);
  if (profiles.length > 1) fail_('SCHEMA_ERROR');
  if (creating && student) {
    if (email !== currentEmail || !profiles[0] ||
        JSON.stringify(financeProfile_(student, profile)) !== JSON.stringify(financeProfile_(student, profiles[0]))) fail_('CONFLICT');
    return financeProfile_(student, profiles[0]);
  }
  // Identity is activated last. A retry can finish after an interrupted profile or link write.
  financeSave_(db, 'CADASTROS', profile, profiles[0]);
  if (!ownLink) append_(db, 'Links', {id: id_(), coachId: coach.id, studentId: studentId, active: true});
  if (!student) {
    SpreadsheetApp.flush();
    student = {id: studentId, email: email, role: 'student', active: true};
    append_(db, 'Users', student);
  } else if (email !== currentEmail) {
    student.email = email;
    financeSave_(db, 'Users', student, student);
  }
  return financeProfile_(student, profile);
}

function financePlan_(db, coachId, studentId, plans, request) {
  var data = request.data;
  fields_(data, ['studentId', 'mode', 'amountCents', 'startedOn', 'dueOn']);
  var id = financeId_([coachId, studentId], request.requestId);
  var mode = data.mode, amount = data.amountCents, start = financeDate_(data.startedOn);
  if (['package8', 'monthly'].indexOf(mode) < 0 || !Number.isSafeInteger(amount) || amount < 0 || amount > 999999999) fail_('INVALID_DATA');
  var due = mode === 'monthly' ? financeDate_(data.dueOn) : '';
  if ((due && due < start) || (mode === 'package8' && data.dueOn !== '')) fail_('INVALID_DATA');
  var previous = plans.find(function(plan) { return plan.id === id; });
  if (previous) {
    if (previous.mode !== mode || previous.amountCents !== amount || previous.startedOn !== start || previous.dueOn !== due) fail_('CONFLICT');
    return {id: id};
  }
  if (plans.length && start < plans[plans.length - 1].startedOn) fail_('INVALID_DATA');
  financeSave_(db, 'PLANOS', {id: id, coachId: coachId, studentId: studentId,
    mode: mode, amountCents: amount, startedOn: start, dueOn: due, payment: 'pending', paidOn: ''});
  return {id: id};
}

function financePayment_(db, plan, data) {
  fields_(data, ['studentId', 'planId', 'payment', 'paidOn']);
  if (['paid', 'pending'].indexOf(data.payment) < 0 || (data.payment === 'pending' && data.paidOn !== '')) fail_('INVALID_DATA');
  plan.payment = data.payment;
  plan.paidOn = data.payment === 'paid' ? financeDate_(data.paidOn) : '';
  financeSave_(db, 'PLANOS', plan, plan);
  return {id: plan.id};
}

function financeLesson_(db, plan, request) {
  var data = request.data;
  fields_(data, ['studentId', 'planId', 'lessonId', 'date', 'active']);
  if (typeof data.active !== 'boolean') fail_('INVALID_DATA');
  var creating = data.lessonId === '';
  var id = creating ? financeId_(plan.id, request.requestId) : text_(data.lessonId, 100);
  var lessons = financeOwned_(db, 'AULAS', plan.coachId, plan.studentId).filter(function(lesson) {
    return lesson.planId === plan.id;
  });
  var previous = lessons.find(function(lesson) { return lesson.id === id; });
  if (!creating && !previous) fail_('NOT_FOUND');
  if (creating && !data.active) fail_('INVALID_DATA');
  var date = data.active ? financeDate_(data.date) : previous.date;
  if (date < plan.startedOn) fail_('INVALID_DATA');
  if (creating && previous) {
    if (previous.date !== date || !enabled_(previous.active)) fail_('CONFLICT');
    return {id: id};
  }
  if (data.active && plan.mode === 'package8' && lessons.filter(function(lesson) {
    return enabled_(lesson.active) && lesson.id !== id;
  }).length >= 8) fail_('CONFLICT');
  financeSave_(db, 'AULAS', {id: id, coachId: plan.coachId, studentId: plan.studentId,
    planId: plan.id, date: date, active: data.active}, previous);
  return {id: id};
}

function financeApi(request) {
  var lock;
  try {
    fields_(request, ['action', 'data', 'requestId', 'sessionToken']);
    var action = request.action;
    if (['listStudents', 'saveStudent', 'getStudent', 'startPlan', 'savePayment', 'saveLesson'].indexOf(action) < 0) fail_('INVALID_ACTION');
    var identity = sessionIdentity_(request.sessionToken);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) fail_('BUSY');
    var db = db_(), coach = userForEmail_(db, identity.email), data = request.data;
    if (coach.role !== 'coach') fail_('FORBIDDEN');
    var result;
    if (action === 'saveStudent') {
      result = financeSaveStudent_(db, coach, request);
    } else if (action === 'listStudents') {
      fields_(data, []);
      var names = financeStudentNames_(db, coach.id);
      result = financeStudents_(db, coach.id).map(function(student) {
        return {id: student.id, name: names.get(student.id) || ''};
      });
    } else {
      var studentId = text_(data && data.studentId, 100);
      var student = financeStudents_(db, coach.id).find(function(user) { return user.id === studentId; });
      if (!student) fail_('NOT_FOUND');
      var plans = financeOwned_(db, 'PLANOS', coach.id, studentId);
      if (action === 'getStudent') {
        fields_(data, ['studentId']);
        var profile = financeOwned_(db, 'CADASTROS', coach.id, studentId)[0];
        result = {profile: financeProfile_(student, profile), plans: plans,
          lessons: financeOwned_(db, 'AULAS', coach.id, studentId)};
      } else if (action === 'startPlan') {
        result = financePlan_(db, coach.id, studentId, plans, request);
      } else {
        var plan = plans.find(function(row) { return row.id === data.planId; });
        if (!plan) fail_('NOT_FOUND');
        result = action === 'savePayment' ? financePayment_(db, plan, data) : financeLesson_(db, plan, request);
      }
    }
    // Apply queued sheet writes before giving the script lock to another request.
    if (['listStudents', 'getStudent'].indexOf(action) < 0) SpreadsheetApp.flush();
    return {ok: true, data: result};
  } catch (error) {
    var codes = ['INVALID_ACTION', 'INVALID_DATA', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
      'CONFLICT', 'BUSY', 'CONFIGURATION_ERROR', 'SCHEMA_ERROR'];
    return {ok: false, error: {code: codes.indexOf(error.code) >= 0 ? error.code : 'INTERNAL_ERROR'}};
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

// Run from the editor against the explicitly configured homologation spreadsheet.
function prepararCadastroFinanceiroTeste_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var id = properties.getProperty('SPREADSHEET_ID');
    if (!id || properties.getProperty('ENVIRONMENT') !== 'homologation' ||
        properties.getProperty('HOMOLOGATION_SPREADSHEET_ID') !== id) fail_('CONFIGURATION_ERROR');
    var db = db_(), tables = Object.keys(FINANCE_SCHEMA_);
    sheet_(db, 'Users');
    sheet_(db, 'Links');
    tables.forEach(function(name) {
      var sheet = db.getSheetByName(name);
      if (sheet && (sheet.getLastRow() || sheet.getLastColumn())) sheet_(db, name, FINANCE_SCHEMA_);
    });
    tables.forEach(function(name) {
      var sheet = db.getSheetByName(name) || db.insertSheet(name);
      if (!sheet.getLastRow()) sheet.appendRow(FINANCE_SCHEMA_[name]);
    });
    SpreadsheetApp.flush();
    return tables;
  } finally { lock.releaseLock(); }
}
