/* Deterministic catalog definitions, not prescribed workouts or personal records. */
function librarySeed_(){
  var out={CAPACIDADES:[],METODOS:[],UNIDADES:[],INDICADORES:[],EXERCICIOS:[],EXERCICIO_CAPACIDADES:[],EXERCICIO_METODOS:[]},stamp='2026-11-17T00:00:00.000Z';
  function put(table,row){row.createdAt=stamp;if(['EXERCICIO_CAPACIDADES','EXERCICIO_METODOS'].indexOf(table)<0)row.status='active';out[table].push(row);}
  [['strength','Força'],['flexibility','Flexibilidade'],['aerobic','Capacidade aeróbica'],['speed','Velocidade']].forEach(function(c){put('CAPACIDADES',{id:'cap-'+c[0],name:c[1],kind:'capacity',capacityId:''});});
  [['max-strength','Força máxima','strength'],['rapid-strength','Força rápida','strength'],['power','Potência muscular','strength'],['strength-endurance','Força resistente','strength'],['active-flexibility','Flexibilidade ativa','flexibility'],['passive-flexibility','Flexibilidade passiva','flexibility'],['aerobic-power','Potência aeróbica','aerobic'],['aerobic-endurance','Resistência aeróbica','aerobic'],['movement-speed','Velocidade de movimento','speed'],['reaction-speed','Velocidade de reação','speed']].forEach(function(m){put('CAPACIDADES',{id:'manifest-'+m[0],name:m[1],kind:'manifestation',capacityId:'cap-'+m[2]});});
  [['continuous-uniform','Contínuo uniforme',''],['continuous-variable','Contínuo variável',''],['interval','Intervalado',''],['interval-extensive','Intervalado extensivo','method-interval'],['interval-intensive','Intervalado intensivo','method-interval'],['repetition','Método de repetições',''],['max-effort','Esforços máximos',''],['repeated-effort','Esforços repetidos',''],['dynamic-effort','Esforços dinâmicos',''],['isometric','Isométrico',''],['plyometric','Pliométrico',''],['circuit','Circuito','']].forEach(function(m){put('METODOS',{id:'method-'+m[0],name:m[1],kind:'method',parentId:m[2]});});
  [['repeaters','Repeaters'],['max-hangs','Max hangs'],['4x4','4×4']].forEach(function(p){put('METODOS',{id:'protocol-'+p[0],name:p[1],kind:'protocol',parentId:''});});
  [['hand-moves','Movimentos de mão','mov','hand_moves'],['hang-seconds','Segundos de suspensão','s suspensão','time'],['repetitions','Repetições','rep','repetitions'],['seconds','Segundos','s','time'],['meters','Metros','m','distance'],['kg','Quilogramas','kg','mass'],['newton','Newtons','N','force'],['kgf','Quilogramas-força','kgf','force'],['bpm','Batimentos por minuto','bpm','heart_rate'],['degrees','Graus angulares','°','angle'],['cm','Centímetros','cm','distance'],['percent','Percentual','%','percent'],['grade','Grau ordinal','grau','ordinal'],['rpe','Esforço percebido','RPE','perceived_exertion']].forEach(function(u){put('UNIDADES',{id:'unit-'+u[0],name:u[1],symbol:u[2],dimension:u[3]});});
  [['grade','Grau de dificuldade','ordinal','',[]],['campus','Referência específica do campus board — pendente','undefined','',[]],['max-force','Percentual da força máxima definida','relative','max_force',['unit-newton','unit-kgf']],['1rm','Percentual de 1RM','relative','one_rm',['unit-kg']],['hrmax','Percentual de FCmáx','relative','max_heart_rate',['unit-bpm']],['rommax','Percentual da amplitude máxima','relative','max_rom',['unit-degrees','unit-cm']],['rpe','RPE auxiliar','absolute','',['unit-rpe']]].forEach(function(i){put('INDICADORES',{id:'int-'+i[0],name:i[1],kind:i[2],referenceType:i[3],referenceUnitsJson:JSON.stringify(i[4])});});
  var defs=[
    ['route','Escalada em via','Escalada em vias; volume em movimentos efetivos de mão.','Escalada','grade','hand-moves',['hand-moves'],['continuous-uniform','continuous-variable','interval','repetition'],[],['cap-strength','cap-aerobic','manifest-strength-endurance']],
    ['boulder','Boulder','Escalada em blocos; graduação ordinal com escala explícita.','Escalada','grade','hand-moves',['hand-moves'],['repetition','max-effort','dynamic-effort','circuit'],['4x4'],['cap-strength','manifest-max-strength','manifest-power']],
    ['campus','Campus board','Referência de intensidade a definir metodologicamente; sem cálculo automático.','Campus board','campus','hand-moves',['hand-moves'],['repetition','dynamic-effort','plyometric'],[],['cap-strength','cap-speed','manifest-power']],
    ['finger-iso','Fingerboard isométrico','Suspensões; referência máxima e protocolo individuais explicitados.','Fingerboard','max-force','hang-seconds',['hang-seconds'],['isometric','interval'],['repeaters','max-hangs'],['cap-strength','manifest-max-strength','manifest-strength-endurance']],
    ['finger-dynamic','Fingerboard dinâmico','Exemplo de configuração de força dinâmica; referência de 1RM exige protocolo definido.','Fingerboard','1rm','repetitions',['repetitions'],['repetition','max-effort','repeated-effort'],[],['cap-strength','manifest-max-strength']],
    ['pullup','Barra fixa','Exercício dinâmico de força com referência individual de carga definida.','Treinamento resistido','1rm','repetitions',['repetitions'],['max-effort','repeated-effort','dynamic-effort','repetition'],[],['cap-strength','manifest-max-strength']],
    ['bench','Supino','Exercício de força; não aplicar percentuais sem avaliação vinculada.','Treinamento resistido','1rm','repetitions',['repetitions'],['max-effort','repeated-effort','dynamic-effort','repetition'],[],['cap-strength','manifest-max-strength']],
    ['squat','Agachamento','Exercício dinâmico de força.','Treinamento resistido','1rm','repetitions',['repetitions'],['max-effort','repeated-effort','dynamic-effort','repetition'],[],['cap-strength','manifest-max-strength']],
    ['running','Corrida','Configuração de volume por tempo ou distância, sem soma entre essas unidades.','Corrida','hrmax','seconds',['seconds','meters'],['continuous-uniform','continuous-variable','interval','interval-extensive','interval-intensive'],[],['cap-aerobic','manifest-aerobic-power','manifest-aerobic-endurance']],
    ['stretch','Alongamento','Configuração de volume por tempo ou repetições; avaliação de amplitude identifica articulação e protocolo.','Flexibilidade','rommax','seconds',['seconds','repetitions'],['isometric','repetition'],[],['cap-flexibility','manifest-active-flexibility','manifest-passive-flexibility']]
  ];
  defs.forEach(function(e){var exerciseId='exercise-'+e[0];put('EXERCICIOS',{id:exerciseId,name:e[1],nameKey:libraryName_(e[1]),description:e[2],modality:e[3],primaryIndicatorId:'int-'+e[4],primaryVolumeUnitId:'unit-'+e[5],volumeUnitIdsJson:JSON.stringify(e[6].map(function(u){return 'unit-'+u;})),origin:'seed-example'});
    e[7].map(function(m){return 'method-'+m;}).concat(e[8].map(function(p){return 'protocol-'+p;})).forEach(function(methodId){put('EXERCICIO_METODOS',{id:exerciseId+'.'+methodId,exerciseId:exerciseId,methodId:methodId});});
    e[9].forEach(function(capacityId){put('EXERCICIO_CAPACIDADES',{id:exerciseId+'.'+capacityId,exerciseId:exerciseId,capacityId:capacityId});});
  });
  return out;
}
// Run only from the editor against the explicitly selected DEVELOPMENT spreadsheet.
function initializeLibraryDevelopment_(){
  var lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    var db=libraryDb_(),seed=librarySeed_();
    // Validate all existing schemas before the first schema or catalog write.
    Object.keys(LIBRARY_SCHEMA_).forEach(function(name){var sheet=db.getSheetByName(name);if(sheet && (sheet.getLastRow()>0 || sheet.getLastColumn()>0))librarySheet_(db,name);});
    Object.keys(seed).forEach(function(name){
      if(!db.getSheetByName(name)||db.getSheetByName(name).getLastRow()===0)return;
      var rows=libraryRows_(db,name),ids=rows.map(function(r){return r.id;});
      if(new Set(ids).size!==ids.length)fail_('SCHEMA_ERROR');
      if(name==='EXERCICIOS')seed[name].forEach(function(s){if(rows.some(function(r){return r.id!==s.id && r.nameKey===s.nameKey;}))fail_('CONFLICT');});
    });
    Object.keys(LIBRARY_SCHEMA_).forEach(function(name){var sheet=db.getSheetByName(name)||db.insertSheet(name);if(sheet.getLastRow()===0)sheet.appendRow(LIBRARY_SCHEMA_[name]);});
    Object.keys(seed).forEach(function(name){var rows=libraryRows_(db,name);seed[name].forEach(function(record){if(!rows.some(function(r){return r.id===record.id;}))libraryAppend_(db,name,record);});});
    SpreadsheetApp.flush();
    return {ok:true,createdCatalogOnly:true,tables:Object.keys(LIBRARY_SCHEMA_)};
  }finally{lock.releaseLock();}
}
