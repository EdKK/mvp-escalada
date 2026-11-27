var GENERAL_CATALOG_SCHEMA_ = {CATALOGO_GERAL:['id','area','region','category','name']};

// BIB-12B version 1. Keep existing IDs when updating names or order in a later version.
function generalCatalogSeedV1_(){
  var groups=[
    ["Membros superiores", "Peitoral", [
      ["mus-peitoral-001", "Supino reto com barra"],
      ["mus-peitoral-002", "Supino reto com halteres"],
      ["mus-peitoral-003", "Supino inclinado com barra"],
      ["mus-peitoral-004", "Supino inclinado com halteres"],
      ["mus-peitoral-005", "Supino declinado"],
      ["mus-peitoral-006", "Supino na máquina"],
      ["mus-peitoral-007", "Crucifixo com halteres"],
      ["mus-peitoral-008", "Crucifixo na máquina"],
      ["mus-peitoral-009", "Crossover na polia"],
      ["mus-peitoral-010", "Flexão de braços"]
    ]],
    ["Membros superiores", "Dorsais", [
      ["mus-dorsais-001", "Barra fixa pronada"],
      ["mus-dorsais-002", "Barra fixa supinada"],
      ["mus-dorsais-003", "Barra fixa neutra"],
      ["mus-dorsais-004", "Barra fixa unilateral"],
      ["mus-dorsais-005", "Puxada frontal pronada"],
      ["mus-dorsais-006", "Puxada frontal supinada"],
      ["mus-dorsais-007", "Puxada frontal neutra"],
      ["mus-dorsais-008", "Remada curvada com barra"],
      ["mus-dorsais-009", "Remada unilateral com halter"],
      ["mus-dorsais-010", "Remada baixa na polia"],
      ["mus-dorsais-011", "Remada invertida"],
      ["mus-dorsais-012", "Pullover na polia"]
    ]],
    ["Membros superiores", "Cintura escapular", [
      ["mus-cintura-escapular-001", "Desenvolvimento com barra"],
      ["mus-cintura-escapular-002", "Desenvolvimento com halteres"],
      ["mus-cintura-escapular-003", "Desenvolvimento Arnold"],
      ["mus-cintura-escapular-004", "Desenvolvimento na máquina"],
      ["mus-cintura-escapular-005", "Elevação frontal"],
      ["mus-cintura-escapular-006", "Elevação lateral"],
      ["mus-cintura-escapular-007", "Crucifixo inverso"],
      ["mus-cintura-escapular-008", "Face pull"],
      ["mus-cintura-escapular-009", "Encolhimento de ombros"],
      ["mus-cintura-escapular-010", "Rotação interna do ombro"],
      ["mus-cintura-escapular-011", "Rotação externa do ombro"],
      ["mus-cintura-escapular-012", "Elevação em Y"],
      ["mus-cintura-escapular-013", "Elevação em T"],
      ["mus-cintura-escapular-014", "Elevação em W"],
      ["mus-cintura-escapular-015", "Flexão escapular (scapular push-up)"],
      ["mus-cintura-escapular-016", "Tração escapular (scapular pull-up)"]
    ]],
    ["Membros superiores", "Bíceps", [
      ["mus-biceps-001", "Rosca direta com barra reta"],
      ["mus-biceps-002", "Rosca direta com barra W"],
      ["mus-biceps-003", "Rosca alternada com halteres"],
      ["mus-biceps-004", "Rosca simultânea com halteres"],
      ["mus-biceps-005", "Rosca Scott"],
      ["mus-biceps-006", "Rosca concentrada"],
      ["mus-biceps-007", "Rosca martelo"],
      ["mus-biceps-008", "Rosca na polia"]
    ]],
    ["Membros superiores", "Tríceps", [
      ["mus-triceps-001", "Tríceps testa"],
      ["mus-triceps-002", "Tríceps francês"],
      ["mus-triceps-003", "Tríceps na polia com barra"],
      ["mus-triceps-004", "Tríceps na polia com corda"],
      ["mus-triceps-005", "Tríceps unilateral na polia"],
      ["mus-triceps-006", "Tríceps coice"],
      ["mus-triceps-007", "Paralelas"],
      ["mus-triceps-008", "Supino com pegada fechada"]
    ]],
    ["Membros superiores", "Antebraços", [
      ["mus-antebracos-001", "Flexão de punho"],
      ["mus-antebracos-002", "Extensão de punho"],
      ["mus-antebracos-003", "Pronação resistida"],
      ["mus-antebracos-004", "Supinação resistida"],
      ["mus-antebracos-005", "Desvio radial resistido"],
      ["mus-antebracos-006", "Desvio ulnar resistido"],
      ["mus-antebracos-007", "Rosca inversa"],
      ["mus-antebracos-008", "Extensão dos dedos com elástico"],
      ["mus-antebracos-009", "Flexão dos dedos com barra (finger curl)"],
      ["mus-antebracos-010", "Enrolamento de carga com os punhos (wrist roller)"]
    ]],
    ["Membros inferiores", "Quadríceps", [
      ["mus-quadriceps-001", "Agachamento livre"],
      ["mus-quadriceps-002", "Agachamento frontal"],
      ["mus-quadriceps-003", "Agachamento no Smith"],
      ["mus-quadriceps-004", "Agachamento goblet"],
      ["mus-quadriceps-005", "Agachamento búlgaro"],
      ["mus-quadriceps-006", "Agachamento unilateral (pistol squat)"],
      ["mus-quadriceps-007", "Agachamento hack"],
      ["mus-quadriceps-008", "Leg press bilateral"],
      ["mus-quadriceps-009", "Leg press unilateral"],
      ["mus-quadriceps-010", "Cadeira extensora"],
      ["mus-quadriceps-011", "Afundo"],
      ["mus-quadriceps-012", "Subida no banco (step-up)"]
    ]],
    ["Membros inferiores", "Isquiotibiais", [
      ["mus-isquiotibiais-001", "Mesa flexora"],
      ["mus-isquiotibiais-002", "Cadeira flexora"],
      ["mus-isquiotibiais-003", "Flexão de joelho em pé com resistência"],
      ["mus-isquiotibiais-004", "Levantamento terra romeno"],
      ["mus-isquiotibiais-005", "Levantamento terra romeno unilateral"],
      ["mus-isquiotibiais-006", "Stiff"],
      ["mus-isquiotibiais-007", "Flexão nórdica"],
      ["mus-isquiotibiais-008", "Flexão de joelhos na bola suíça"],
      ["mus-isquiotibiais-009", "Good morning"]
    ]],
    ["Membros inferiores", "Glúteos", [
      ["mus-gluteos-001", "Levantamento terra convencional"],
      ["mus-gluteos-002", "Levantamento terra sumô"],
      ["mus-gluteos-003", "Elevação pélvica com barra (hip thrust)"],
      ["mus-gluteos-004", "Elevação pélvica unilateral"],
      ["mus-gluteos-005", "Ponte dorsal dinâmica"],
      ["mus-gluteos-006", "Extensão do quadril na polia"],
      ["mus-gluteos-007", "Extensão do quadril em quadrupedia"],
      ["mus-gluteos-008", "Cadeira abdutora"],
      ["mus-gluteos-009", "Abdução do quadril em decúbito lateral"],
      ["mus-gluteos-010", "Abdução do quadril na polia"],
      ["mus-gluteos-011", "Caminhada lateral com elástico"],
      ["mus-gluteos-012", "Abdução com rotação externa do quadril (clamshell)"]
    ]],
    ["Membros inferiores", "Adutores", [
      ["mus-adutores-001", "Cadeira adutora"],
      ["mus-adutores-002", "Adução do quadril na polia"],
      ["mus-adutores-003", "Adução do quadril com elástico"],
      ["mus-adutores-004", "Adução em decúbito lateral"],
      ["mus-adutores-005", "Adução isométrica com bola"],
      ["mus-adutores-006", "Copenhagen isométrico"],
      ["mus-adutores-007", "Copenhagen dinâmico"],
      ["mus-adutores-008", "Afundo lateral"]
    ]],
    ["Membros inferiores", "Perna", [
      ["mus-perna-001", "Elevação bilateral de panturrilhas em pé"],
      ["mus-perna-002", "Elevação unilateral de panturrilha em pé"],
      ["mus-perna-003", "Elevação de panturrilhas sentado"],
      ["mus-perna-004", "Flexão plantar no leg press"],
      ["mus-perna-005", "Flexão plantar com elástico"],
      ["mus-perna-006", "Dorsiflexão com elástico"],
      ["mus-perna-007", "Elevação do antepé (tibialis raise)"],
      ["mus-perna-008", "Inversão resistida"],
      ["mus-perna-009", "Eversão resistida"],
      ["mus-perna-010", "Flexão plantar excêntrica"]
    ]],
    ["Membros inferiores", "Pés", [
      ["mus-pes-001", "Encurtamento ativo do pé (short foot)"],
      ["mus-pes-002", "Afastamento ativo dos dedos (toe spread)"],
      ["mus-pes-003", "Elevação isolada do hálux"],
      ["mus-pes-004", "Elevação dos quatro dedos menores"],
      ["mus-pes-005", "Flexão dos dedos com toalha"],
      ["mus-pes-006", "Preensão de objetos com os dedos"],
      ["mus-pes-007", "Flexão resistida do hálux"],
      ["mus-pes-008", "Flexão resistida dos dedos menores"],
      ["mus-pes-009", "Abdução resistida do hálux"],
      ["mus-pes-010", "Extensão resistida dos dedos"],
      ["mus-pes-011", "Pressão isométrica do hálux"],
      ["mus-pes-012", "Encurtamento ativo do pé em apoio unilateral"]
    ]],
    ["Tronco", "Dinâmicos", [
      ["mus-dinamicos-001", "Abdominal convencional"],
      ["mus-dinamicos-002", "Abdominal curto"],
      ["mus-dinamicos-003", "Abdominal reverso"],
      ["mus-dinamicos-004", "Abdominal oblíquo"],
      ["mus-dinamicos-005", "Abdominal bicicleta"],
      ["mus-dinamicos-006", "Abdominal em V"],
      ["mus-dinamicos-007", "Abdominal canivete"],
      ["mus-dinamicos-008", "Abdominal na bola suíça"],
      ["mus-dinamicos-009", "Abdominal na polia"],
      ["mus-dinamicos-010", "Abdominal na máquina"],
      ["mus-dinamicos-011", "Elevação de pernas no solo"],
      ["mus-dinamicos-012", "Elevação de pernas em suspensão"],
      ["mus-dinamicos-013", "Elevação de joelhos em suspensão"],
      ["mus-dinamicos-014", "Elevação dos pés até a barra"],
      ["mus-dinamicos-015", "Rotação russa"],
      ["mus-dinamicos-016", "Rotação de pernas"],
      ["mus-dinamicos-017", "Rotação do tronco na polia"],
      ["mus-dinamicos-018", "Rotação diagonal descendente"],
      ["mus-dinamicos-019", "Rotação diagonal ascendente"],
      ["mus-dinamicos-020", "Inclinação lateral com halter"],
      ["mus-dinamicos-021", "Elevação do quadril em prancha lateral"],
      ["mus-dinamicos-022", "Extensão do tronco no solo"],
      ["mus-dinamicos-023", "Extensão do tronco no banco"],
      ["mus-dinamicos-024", "Extensão do tronco na bola suíça"],
      ["mus-dinamicos-025", "Extensão reversa"],
      ["mus-dinamicos-026", "Superman dinâmico"],
      ["mus-dinamicos-027", "Rotação com medicine ball"]
    ]],
    ["Tronco", "Estabilizadores", [
      ["mus-estabilizadores-001", "Prancha frontal"],
      ["mus-estabilizadores-002", "Prancha lateral"],
      ["mus-estabilizadores-003", "Prancha reversa"],
      ["mus-estabilizadores-004", "Prancha com braços estendidos"],
      ["mus-estabilizadores-005", "Prancha com braços afastados"],
      ["mus-estabilizadores-006", "Prancha com elevação de braço"],
      ["mus-estabilizadores-007", "Prancha com elevação de perna"],
      ["mus-estabilizadores-008", "Prancha com toque nos ombros"],
      ["mus-estabilizadores-009", "Prancha com remada"],
      ["mus-estabilizadores-010", "Prancha na bola suíça"],
      ["mus-estabilizadores-011", "Prancha em suspensão"],
      ["mus-estabilizadores-012", "Prancha lateral com remada"],
      ["mus-estabilizadores-013", "Sustentação abdominal côncava"],
      ["mus-estabilizadores-014", "Sustentação em L"],
      ["mus-estabilizadores-015", "Sustentação horizontal em suspensão"],
      ["mus-estabilizadores-016", "Superman isométrico"],
      ["mus-estabilizadores-017", "Sustentação lombar"],
      ["mus-estabilizadores-018", "Ponte dorsal isométrica"],
      ["mus-estabilizadores-019", "Ponte dorsal unilateral isométrica"],
      ["mus-estabilizadores-020", "Extensão contralateral em quadrupedia (Bird dog)"],
      ["mus-estabilizadores-021", "Inseto morto (Dead bug)"],
      ["mus-estabilizadores-022", "Pressão antirrotacional (Pallof press)"],
      ["mus-estabilizadores-023", "Sustentação antirrotacional (Pallof hold)"],
      ["mus-estabilizadores-024", "Rolamento com roda abdominal"],
      ["mus-estabilizadores-025", "Rolamento na bola suíça"],
      ["mus-estabilizadores-026", "Circundução dos braços na bola suíça"],
      ["mus-estabilizadores-027", "Caminhada com cargas bilaterais"],
      ["mus-estabilizadores-028", "Caminhada com carga unilateral"],
      ["mus-estabilizadores-029", "Caminhada com carga acima da cabeça"]
    ]]
  ];
  return groups.flatMap(function(group){
    return group[2].map(function(exercise){
      return {id:exercise[0],area:'Musculação',region:group[0],category:group[1],name:exercise[1]};
    });
  });
}

function generalCatalogApprovedRows_(db,approved){
  var byId=new Map(approved.map(function(row){return [row.id,row];}));
  var columns=GENERAL_CATALOG_SCHEMA_.CATALOGO_GERAL;
  var existing=new Map();
  rows_(db,'CATALOGO_GERAL',GENERAL_CATALOG_SCHEMA_).forEach(function(row){
    var expected=byId.get(row.id);
    if(!expected||existing.has(row.id)||columns.some(function(key){return expected[key]!==row[key];}))fail_('CONFLICT');
    existing.set(row.id,row);
  });
  return existing;
}

function listGeneralCatalog_(db,data){
  fields_(data,[]);
  var approved=generalCatalogSeedV1_(),existing=generalCatalogApprovedRows_(db,approved);
  if(existing.size!==approved.length)fail_('SCHEMA_ERROR');
  return {version:1,exercises:approved.map(function(row){return existing.get(row.id);})};
}

// Manual Apps Script editor entry point. Never exposed through libraryApi.
function prepararCatalogoGeralHomologacao_(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))fail_('BUSY');
  try{
    var db=libraryDb_(),table='CATALOGO_GERAL',approved=generalCatalogSeedV1_();
    var sheet=db.getSheetByName(table);
    var hasRows=sheet&&sheet.getLastRow()>0;
    var columns=GENERAL_CATALOG_SCHEMA_[table];
    var existing=hasRows?generalCatalogApprovedRows_(db,approved):new Map();
    var missing=approved.filter(function(row){return !existing.has(row.id);});
    if(missing.length){
      if(!sheet)sheet=db.insertSheet(table);
      var values=missing.map(function(row){return columns.map(function(key){return row[key];});});
      if(!hasRows)values.unshift(columns);
      var lastRow=sheet.getLastRow(),maxRows=sheet.getMaxRows(),required=lastRow+values.length-maxRows;
      if(required>0)sheet.insertRowsAfter(maxRows,required);
      sheet.getRange(lastRow+1,1,values.length,columns.length).setValues(values);
      SpreadsheetApp.flush();
    }
    return {version:1,inserted:missing.length,total:approved.length};
  }finally{lock.releaseLock();}
}
