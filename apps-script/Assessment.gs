/* AVA-01A. Append-only anthropometry, scoped to an active coach/student link. */
var ASSESSMENT_SCHEMA_ = {
  CATALOGO_AVALIACAO: ['id', 'name', 'dimension', 'nature', 'unit', 'dataType', 'protocol',
    'allowedOrigins', 'periodicity', 'highlight', 'active'],
  REGISTROS_AVALIACAO: ['id', 'coachId', 'studentId', 'variableId', 'value', 'unit', 'date',
    'createdAt', 'actorId', 'origin', 'notes', 'supersedesId', 'kind', 'operationId', 'fingerprint']
};

var ASSESSMENT_CATALOG_ = [
  ['height', 'Estatura', 'physical_biological', 'characteristic', 'cm', 'decimal',
    'Em pé, descalço e com a cabeça em posição neutra.', 'direct', 'Inicial e conforme necessidade', false, true],
  ['mass', 'Massa corporal', 'physical_biological', 'characteristic', 'kg', 'decimal',
    'Usar a mesma balança em piso firme, de preferência no mesmo horário e com roupas leves.',
    'direct,self_report', 'A cada 30 dias', true, true],
  ['span', 'Envergadura', 'physical_biological', 'characteristic', 'cm', 'decimal',
    'Medir entre as pontas dos dedos médios, com os braços abertos na horizontal.',
    'direct', 'Inicial e conforme necessidade', false, true],
  ['ape', 'Ape Index', 'physical_biological', 'derived_characteristic', 'cm', 'decimal',
    'Envergadura menos estatura, com identificação das duas medidas utilizadas.',
    'calculation', 'Ao atualizar uma medida de origem', false, true]
];

function assessmentCatalog_(db) {
  var catalog = new Map();
  rows_(db, 'CATALOGO_AVALIACAO', ASSESSMENT_SCHEMA_).forEach(function(row) {
    if (!row.id || catalog.has(row.id)) fail_('SCHEMA_ERROR');
    catalog.set(row.id, row);
  });
  return catalog;
}

function assessmentAppend_(sheet, values, formatDates) {
  if (!values.length) return;
  var first = sheet.getLastRow() + 1, maxRows = sheet.getMaxRows();
  var extra = first + values.length - 1 - maxRows;
  if (extra > 0) sheet.insertRowsAfter(maxRows, extra);
  // Keep ISO values literal even when the sheet locale recognizes them as dates.
  if (formatDates) sheet.getRange(first, 7, values.length, 2).setNumberFormat('@');
  sheet.getRange(first, 1, values.length, values[0].length).setValues(values);
}

function assessmentCheckCatalog_(catalog, allowMissing) {
  ASSESSMENT_CATALOG_.forEach(function(entry) {
    var row = catalog.get(entry[0]);
    if (!row && allowMissing) return;
    if (!row || ['dimension', 'nature', 'unit', 'dataType', 'allowedOrigins'].some(function(key) {
      return row[key] !== entry[ASSESSMENT_SCHEMA_.CATALOGO_AVALIACAO.indexOf(key)];
    })) fail_('SCHEMA_ERROR');
  });
}

function prepararAvaliacaoTeste_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties(), id = props.getProperty('SPREADSHEET_ID');
    if (!id || props.getProperty('ENVIRONMENT') !== 'homologation' ||
        props.getProperty('HOMOLOGATION_SPREADSHEET_ID') !== id ||
        props.getProperty('ASSESSMENT_INIT_SPREADSHEET_ID') !== id) fail_('CONFIGURATION_ERROR');
    var db = db_(), names = Object.keys(ASSESSMENT_SCHEMA_), existing = new Map();
    sheet_(db, 'Users');
    sheet_(db, 'Links');
    names.forEach(function(name) {
      var tab = db.getSheetByName(name);
      if (tab && (tab.getLastRow() || tab.getLastColumn())) {
        sheet_(db, name, ASSESSMENT_SCHEMA_);
        if (name === 'CATALOGO_AVALIACAO') existing = assessmentCatalog_(db);
      }
    });
    assessmentCheckCatalog_(existing, true);
    var missing = ASSESSMENT_CATALOG_.filter(function(entry) { return !existing.has(entry[0]); });
    var created = [];
    names.forEach(function(name) {
      var tab = db.getSheetByName(name);
      if (!tab) {
        tab = db.insertSheet(name);
        created.push(name);
      }
      if (!tab.getLastRow()) tab.appendRow(ASSESSMENT_SCHEMA_[name]);
      if (name === 'CATALOGO_AVALIACAO') assessmentAppend_(tab, missing);
    });
    SpreadsheetApp.flush();
    return {created: created, seeded: missing.map(function(row) { return row[0]; }),
      catalogCount: existing.size + missing.length,
      recordCount: sheet_(db, 'REGISTROS_AVALIACAO', ASSESSMENT_SCHEMA_).getLastRow() - 1};
  } finally { lock.releaseLock(); }
}

function assessmentToday_(db) {
  return Utilities.formatDate(new Date(), db.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function assessmentActive_(records) {
  var superseded = new Set(records.map(function(row) { return row.supersedesId; }).filter(Boolean));
  return records.filter(function(row) { return row.kind === 'measurement' && !superseded.has(row.id); });
}

// Effective-date query. Supply a prefix of the append-only log to reproduce an earlier view.
function assessmentAt_(active, variableId, date) {
  return active.reduce(function(latest, row) {
    return row.variableId === variableId && row.date <= date && (!latest || row.date >= latest.date) ? row : latest;
  }, null);
}

function assessmentApe_(active) {
  var dates = new Map();
  active.forEach(function(row) {
    if (row.variableId !== 'height' && row.variableId !== 'span') return;
    if (!dates.has(row.date)) dates.set(row.date, {});
    dates.get(row.date)[row.variableId] = row;
  });
  var height, span, series = [];
  Array.from(dates.keys()).sort().forEach(function(date) {
    var daily = dates.get(date);
    height = daily.height || height;
    span = daily.span || span;
    if (!height || !span) return;
    series.push({id: 'ape:' + height.id + ':' + span.id, variableId: 'ape', origin: 'calculation',
      unit: 'cm', date: date, value: Math.round((span.value - height.value) * 1000) / 1000,
      height: {id: height.id, date: height.date, value: height.value},
      span: {id: span.id, date: span.date, value: span.value}});
  });
  return series.reverse();
}

function assessmentView_(records, today, catalog) {
  var active = assessmentActive_(records), current = {}, mass = null, ape = assessmentApe_(active);
  var validIds = new Set(active.map(function(row) { return row.id; }));
  var history = records.slice().reverse().sort(function(a, b) { return b.date.localeCompare(a.date); }).map(function(row) {
    var result = {};
    ['id', 'variableId', 'value', 'unit', 'date', 'createdAt', 'actorId', 'origin', 'notes', 'supersedesId', 'kind'].forEach(function(key) {
      result[key] = row[key];
    });
    result.valid = validIds.has(row.id);
    return result;
  });
  ['height', 'mass', 'span'].forEach(function(id) {
    current[id] = history.find(function(row) { return row.variableId === id && row.valid; }) || null;
  });
  current.ape = ape[0] || null;
  if (current.mass) {
    var series = history.filter(function(row) { return row.variableId === 'mass' && row.valid; });
    var previous = series[1], latest = series[0], due = new Date(latest.date);
    due.setUTCDate(due.getUTCDate() + 30);
    var dueDate = due.toISOString().slice(0, 10);
    mass = {series: series.reverse(), dueDate: dueDate, overdue: today > dueDate,
      delta: previous ? latest.value - previous.value : null,
      percent: previous ? (latest.value - previous.value) / previous.value * 100 : null};
  }
  return {catalog: Array.from(catalog.values()).filter(function(row) {
    return ASSESSMENT_CATALOG_.some(function(entry) { return entry[0] === row.id; });
  }), current: current, mass: mass, history: history, ape: ape, today: today};
}

function assessmentWrite_(db, request, user, records, catalog, context, today) {
  var data = request.data, student = user.role === 'student', action = request.action;
  var operationId = 'ava-' + hashAuth_(JSON.stringify([user.id, context.studentId, financeRequestId_(request.requestId)]));
  var supersedesId = '', measurements = [], origin = student ? 'self_report' : 'direct';
  var notes = '', date = '';
  if (action === 'invalidate') {
    fields_(data, ['studentId', 'recordId', 'notes']);
    notes = text_(data.notes, 500);
  } else {
    fields_(data, student ? ['date', 'mass'] : ['studentId', 'date', 'measures', 'notes', 'recordId']);
    date = financeDate_(data.date);
    if (date > today) fail_('INVALID_DATA');
    notes = data.notes === undefined || data.notes === '' ? '' : text_(data.notes, 500);
    var input = student ? {mass: data.mass} : data.measures;
    fields_(input, ['height', 'mass', 'span']);
    measurements = Object.keys(input).sort().map(function(id) {
      var row = catalog.get(id), value = input[id];
      if (!row || !String(row.allowedOrigins).split(',').includes(origin) ||
          typeof value !== 'number' || !Number.isFinite(value) || value < 0.01 || value > 1000 ||
          Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-8) fail_('INVALID_DATA');
      return {variableId: id, value: value, unit: row.unit};
    });
    if (!measurements.length || (action === 'correct' && measurements.length !== 1)) fail_('INVALID_DATA');
  }
  if (action === 'correct' || action === 'invalidate') supersedesId = text_(data.recordId, 100);
  else if (data.recordId !== undefined) fail_('INVALID_DATA');

  var fingerprint = 'sha256:' + hashAuth_(JSON.stringify([action, context.studentId, date, measurements, notes, supersedesId]));
  var prior = records.filter(function(row) { return row.operationId === operationId && row.actorId === user.id; });
  if (prior.length) {
    if (prior.some(function(row) { return row.fingerprint !== fingerprint; })) fail_('CONFLICT');
    return {saved: true};
  }
  if (measurements.some(function(row) { return !enabled_(catalog.get(row.variableId).active); })) fail_('INVALID_DATA');
  if (supersedesId) {
    var owned = records.filter(function(row) { return row.coachId === context.coachIds[0] && row.studentId === context.studentId; });
    var source = owned.find(function(row) { return row.id === supersedesId && row.kind === 'measurement'; });
    if (!source) fail_('NOT_FOUND');
    if (owned.some(function(row) { return row.supersedesId === supersedesId; })) fail_('CONFLICT');
    if (action === 'invalidate') {
      date = source.date;
      measurements = [{variableId: source.variableId, value: '', unit: source.unit}];
    } else if (source.origin !== 'direct' || measurements[0].variableId !== source.variableId) {
      fail_('INVALID_DATA');
    }
    origin = source.origin;
  }
  var createdAt = new Date().toISOString();
  var additions = context.coachIds.flatMap(function(coachId) {
    return measurements.map(function(measurement) {
      var row = Object.assign({}, measurement, {id: id_(), coachId: coachId, studentId: context.studentId,
        date: date, createdAt: createdAt, actorId: user.id, origin: origin, notes: notes,
        supersedesId: supersedesId, kind: action === 'invalidate' ? 'invalidation' : 'measurement',
        operationId: operationId, fingerprint: fingerprint});
      return ASSESSMENT_SCHEMA_.REGISTROS_AVALIACAO.map(function(key) { return row[key]; });
    });
  });
  var sheet = sheet_(db, 'REGISTROS_AVALIACAO', ASSESSMENT_SCHEMA_);
  assessmentAppend_(sheet, additions, true);
  SpreadsheetApp.flush();
  return {saved: true};
}

function assessmentApi(request) {
  var lock;
  try {
    fields_(request, ['action', 'data', 'requestId', 'sessionToken']);
    var action = request.action;
    if (!['get', 'save', 'correct', 'invalidate', 'selfReport'].includes(action)) fail_('INVALID_ACTION');
    var identity = sessionIdentity_(request.sessionToken);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) fail_('BUSY');
    var db = db_(), user = userForEmail_(db, identity.email), data = request.data;
    var context;
    if (action === 'selfReport') {
      if (user.role !== 'student') fail_('FORBIDDEN');
      var activeCoaches = new Set(rows_(db, 'Users').filter(function(row) {
        return row.role === 'coach' && enabled_(row.active);
      }).map(function(row) { return row.id; }));
      var coachIds = Array.from(new Set(rows_(db, 'Links').filter(function(link) {
        return link.studentId === user.id && enabled_(link.active) && activeCoaches.has(link.coachId);
      }).map(function(link) { return link.coachId; })));
      if (!coachIds.length) fail_('NO_ACTIVE_LINK');
      context = {studentId: user.id, coachIds: coachIds};
    } else {
      if (user.role !== 'coach') fail_('FORBIDDEN');
      var studentId = text_(data && data.studentId, 100);
      if (!linked_(db, user.id, studentId)) fail_('NOT_FOUND');
      context = {studentId: studentId, coachIds: [user.id]};
    }
    var catalog = assessmentCatalog_(db), today = assessmentToday_(db);
    assessmentCheckCatalog_(catalog, false);
    var records = rows_(db, 'REGISTROS_AVALIACAO', ASSESSMENT_SCHEMA_).filter(function(row) {
      return row.studentId === context.studentId && (action === 'selfReport' ? row.actorId === user.id : row.coachId === user.id);
    });
    if (action === 'get') {
      fields_(data, ['studentId']);
      return {ok: true, data: assessmentView_(records, today, catalog)};
    }
    return {ok: true, data: assessmentWrite_(db, request, user, records, catalog, context, today)};
  } catch (error) {
    var codes = ['INVALID_ACTION', 'INVALID_DATA', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
      'NO_ACTIVE_LINK', 'CONFLICT', 'BUSY', 'CONFIGURATION_ERROR', 'SCHEMA_ERROR'];
    return {ok: false, error: {code: codes.includes(error.code) ? error.code : 'INTERNAL_ERROR'}};
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
