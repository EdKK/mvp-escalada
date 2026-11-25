/* Editor-only helpers. Never use a production spreadsheet. */
function seedHomologation_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (props.getProperty('ENVIRONMENT') !== 'homologation' || !id || props.getProperty('HOMOLOGATION_SPREADSHEET_ID') !== id) fail_('CONFIGURATION_ERROR');
  initializeSchema_();
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var db = db_();
    // Refuse every populated schema table, including a previous or partial seed.
    Object.keys(SCHEMA_).forEach(function(name) { if (rows_(db, name).length) fail_('HOMOLOGATION_NOT_EMPTY'); });
    var fixture = homologationFixture_();
    Object.keys(fixture).forEach(function(name) { fixture[name].forEach(function(row) { append_(db, name, row); }); });
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}
function homologationFixture_() {
  return {
    Users: [
      {id:'hom-coach', email:'coach@example.invalid', role:'coach', active:true},
      {id:'hom-student-a', email:'student-a@example.invalid', role:'student', active:true},
      {id:'hom-student-b', email:'student-b@example.invalid', role:'student', active:true}
    ],
    Links: [
      {id:'hom-link-a', coachId:'hom-coach', studentId:'hom-student-a', active:true},
      {id:'hom-link-b', coachId:'hom-coach', studentId:'hom-student-b', active:true}
    ],
    Workouts: [
      {id:'hom-workout-a', coachId:'hom-coach', studentId:'hom-student-a', date:'2026-11-16', goal:'Técnica fictícia A', createdAt:'2026-11-16T12:00:00.000Z'},
      {id:'hom-workout-b', coachId:'hom-coach', studentId:'hom-student-b', date:'2026-11-17', goal:'Mobilidade fictícia B', createdAt:'2026-11-16T12:00:00.000Z'}
    ],
    Items: [
      {id:'hom-item-a', workoutId:'hom-workout-a', block:'Aquecimento', category:'Technique', exercise:'Movimento fictício A', metric:'Reps', quantity:5, minutes:10, notes:'Somente teste', createdAt:'2026-11-16T12:00:00.000Z'},
      {id:'hom-item-b', workoutId:'hom-workout-b', block:'Mobilidade', category:'Mobility', exercise:'Movimento fictício B', metric:'Minutos', quantity:5, minutes:5, notes:'Somente teste', createdAt:'2026-11-16T12:00:00.000Z'}
    ]
  };
}

// Administrative entry point for manual use in the Apps Script editor.
function prepararDadosTeste_() {
  seedHomologation_();
}
