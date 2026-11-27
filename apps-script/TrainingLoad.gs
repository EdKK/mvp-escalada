/* Unit-specific load validation. There is deliberately no universal load score. */
function libraryNumber_(value,min,max,integer){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))fail_('INVALID_DATA');return value;}
function libraryDate_(value){var d=text_(value,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)fail_('INVALID_DATA');return d;}
function libraryReference_(db,studentId,exerciseId,indicator,onDate,id){
  var found=libraryRows_(db,'AVALIACOES').filter(function(a){return a.id===id;});
  if(found.length!==1 || found[0].studentId!==studentId || found[0].exerciseId!==exerciseId || found[0].indicatorId!==indicator.id)fail_('ASSESSMENT_NOT_FOUND');
  var a=found[0];
  if(a.status!=='active'||a.assessedOn>onDate||a.validUntil<onDate||libraryRows_(db,'AVALIACOES').some(function(r){return r.supersedesId===a.id;}))fail_('ASSESSMENT_OUTDATED');
  if(a.referenceType!==indicator.referenceType||JSON.parse(indicator.referenceUnitsJson).indexOf(a.unitId)<0)fail_('INCOMPATIBLE_UNIT');
  libraryNumber_(a.value,Number.MIN_VALUE,1e9,false);text_(a.protocol,2000);text_(a.referenceDefinition,2000);return a;
}
function libraryIntensity_(db,exercise,studentId,onDate,input,auxiliary){
  if(!input || typeof input!=='object')fail_('INVALID_DATA');
  if(!auxiliary && input.indicatorId!==exercise.primaryIndicatorId)fail_('INCOMPATIBLE_INDICATOR');
  var indicator=libraryOne_(db,'INDICADORES',input.indicatorId,true),result={indicatorId:indicator.id,kind:indicator.kind};
  if(indicator.kind==='relative'){
    fields_(input,['indicatorId','assessmentId','percent']);
    // Technical bound only; no automatic recommendation, equivalence or prescription.
    var percent=libraryNumber_(input.percent,Number.MIN_VALUE,1000,false);
    var a=libraryReference_(db,studentId,exercise.id,indicator,onDate,input.assessmentId);
    result.percent=percent;result.assessmentId=a.id;result.reference=Object.assign({},a);result.targetValue=Math.round(a.value*percent/100*1e9)/1e9;result.targetUnitId=a.unitId;if(!Number.isFinite(result.targetValue)||result.targetValue<=0)fail_('INVALID_DATA');
  }else if(indicator.kind==='ordinal'){
    fields_(input,['indicatorId','value','scale']);result.value=text_(input.value,100);result.scale=text_(input.scale,150);
  }else if(indicator.kind==='undefined'){
    fields_(input,['indicatorId','description']);result.description=text_(input.description,1000);result.methodologyPending=true;
  }else if(indicator.kind==='absolute' && indicator.id==='int-rpe'){
    fields_(input,['indicatorId','value']);result.value=libraryNumber_(input.value,1,10,true);result.unitId='unit-rpe';
  }else fail_('INCOMPATIBLE_INDICATOR');
  return result;
}
function libraryVolume_(exercise,input,mode){
  if(mode!=='prescribed'&&mode!=='executed')fail_('INVALID_DATA');
  fields_(input,['kind','unitId','sets','blocks']);
  var allowed=exercise.volumeUnitIds||JSON.parse(exercise.volumeUnitIdsJson);
  var expected={isometric:exercise.isometricUnitId||'unit-hang-seconds',repetitions:'unit-repetitions',hand_moves:'unit-hand-moves',time:'unit-seconds',distance:'unit-meters'};
  if(expected[input.kind]!==input.unitId || allowed.indexOf(input.unitId)<0)fail_('INCOMPATIBLE_UNIT');
  var lines=[],min=mode==='prescribed'?1:0;
  function add(block,order,quantity,occurrences,duration){var total=quantity*occurrences*(duration===''?1:duration);if(!Number.isFinite(total)||total>1e12)fail_('INVALID_DATA');lines.push({blockOrder:block,setOrder:order,quantity:quantity,occurrences:occurrences,durationSeconds:duration,volumeUnitId:input.unitId,total:Math.round(total*1e9)/1e9});if(lines.length>100)fail_('INVALID_DATA');}
  if(input.kind==='hand_moves'){
    if(input.sets!==undefined||!Array.isArray(input.blocks)||!input.blocks.length||input.blocks.length>100)fail_('INVALID_DATA');
    input.blocks.forEach(function(block,b){fields_(block,['moves']);if(!Array.isArray(block.moves)||!block.moves.length||block.moves.length>100)fail_('INVALID_DATA');block.moves.forEach(function(m,s){add(b+1,s+1,libraryNumber_(m,min,exercise.campus?360000:100000,true),1,'');});});
  }else{
    if(input.blocks!==undefined||!Array.isArray(input.sets)||!input.sets.length||input.sets.length>100)fail_('INVALID_DATA');
    input.sets.forEach(function(set,s){
      if(input.kind==='isometric'){fields_(set,['suspensions','seconds']);add(1,s+1,1,libraryNumber_(set.suspensions,min,10000,true),libraryNumber_(set.seconds,mode==='prescribed'?Number.MIN_VALUE:0,86400,false));}
      else{var field={repetitions:'repetitions',time:'seconds',distance:'meters'}[input.kind];fields_(set,[field]);add(1,s+1,libraryNumber_(set[field],mode==='prescribed'?(field==='repetitions'?1:Number.MIN_VALUE):0,1e9,field==='repetitions'),1,'');}
    });
  }
  var total=lines.reduce(function(sum,l){return sum+l.total;},0);if(!Number.isFinite(total)||total>1e12)fail_('INVALID_DATA');
  return {mode:mode,kind:input.kind,unitId:input.unitId,total:Math.round(total*1e9)/1e9,lines:lines};
}
function libraryRecordAssessment_(db,user,req){
  fields_(req.data,['studentId','exerciseId','indicatorId','value','unitId','protocol','referenceDefinition','assessedOn','validUntil','supersedesId']);
  return libraryWrite_(db,user,req,'AVALIACOES',function(id){
    var d=req.data;libraryStudent_(db,user,d.studentId);
    if(typeof d.exerciseId==='string'&&d.exerciseId.indexOf('mus-')===0){
      if(!strengthExercises_(db).has(d.exerciseId))fail_('NOT_FOUND');
      if(d.indicatorId!=='int-1rm'||d.unitId!=='unit-kg'||!/^musculacao:added:(bilateral|unilateral):(total|per_implement)$/.test(d.referenceDefinition))fail_('INVALID_DATA');
    }else libraryExercise_(db,d.exerciseId);
    var indicator=libraryOne_(db,'INDICADORES',d.indicatorId,true);if(indicator.kind!=='relative')fail_('INCOMPATIBLE_INDICATOR');
    if(JSON.parse(indicator.referenceUnitsJson).indexOf(d.unitId)<0)fail_('INCOMPATIBLE_UNIT');libraryOne_(db,'UNIDADES',d.unitId,true);
    var on=libraryDate_(d.assessedOn),until=libraryDate_(d.validUntil);if(until<on)fail_('INVALID_DATA');
    var parent=d.supersedesId||'';
    if(parent){var old=libraryOne_(db,'AVALIACOES',parent,false);if(old.studentId!==d.studentId||old.exerciseId!==d.exerciseId||old.indicatorId!==d.indicatorId||old.assessedOn>on||
      (d.exerciseId.indexOf('mus-')===0&&old.referenceDefinition!==d.referenceDefinition))fail_('INVALID_DATA');libraryUnique_(db,'AVALIACOES',function(a){return a.supersedesId===parent;},id,req.action,function(p){return p.supersedesId===parent;});}
    return {id:id,studentId:d.studentId,exerciseId:d.exerciseId,indicatorId:indicator.id,referenceType:indicator.referenceType,value:libraryNumber_(d.value,Number.MIN_VALUE,1e9,false),unitId:d.unitId,protocol:text_(d.protocol,2000),referenceDefinition:text_(d.referenceDefinition,2000),assessedOn:on,validUntil:until,supersedesId:parent,status:'active',createdBy:user.id,createdAt:new Date().toISOString()};
  });
}
/* Explicit coach task characteristics; no physiological inference or new sheet schema. */
function specificTaskDefinitions_(){return [
  {id:'boulder_short',label:'Boulder curto',min:2,max:6,scale:'Hueco'},
  {id:'boulder_long',label:'Boulder longo',min:7,max:10,scale:'Hueco'},
  {id:'resistance_short',label:'Resistência curta',min:11,max:25,scale:'Brasileira'},
  {id:'resistance_long',label:'Resistência longa',min:26,max:40,scale:'Brasileira'},
  {id:'continuity',label:'Continuidade',min:41,max:null,scale:'Brasileira'}
];}
function specificExercise_(subblock){
  var definition=specificTaskDefinitions_().filter(function(d){return d.id===subblock;})[0];
  if(!definition) fail_('INVALID_DATA');
  return {id:'specific:'+definition.id,name:definition.label,modality:'Escalada',primaryIndicatorId:'int-grade'};
}
function specificTaskGrades_(scale){
  if(scale==='Hueco')return Array.from({length:16},function(_,i){return 'V'+i;});
  var grades=['4º','4º sup','5º','5º sup','6º','6º sup'];
  for(var n=7;n<=12;n++)['a','b','c'].forEach(function(letter){grades.push(n+letter);});return grades;
}
function validateSpecificTask_(exercise,data,volume){
  if(!data||typeof data!=='object')fail_('INVALID_DATA');
  var simplified=data.version===2||data.version===3;
  fields_(data,['version','subblock','orientation','wallInclination'].concat(simplified?['sets','repetitionsPerSet','restBetweenRepetitionsSeconds','restBetweenSetsSeconds']:['restSeconds']));
  if((!simplified&&data.version!==1)||exercise.primaryIndicatorId!=='int-grade'||exercise.modality!=='Escalada'||(data.version!==3&&JSON.parse(exercise.volumeUnitIdsJson).indexOf('unit-hand-moves')<0))fail_('INVALID_DATA');
  if(!simplified&&(volume.kind!=='hand_moves'||volume.unitId!=='unit-hand-moves'))fail_('INVALID_DATA');
  var definition=specificTaskDefinitions_().filter(function(d){return d.id===data.subblock;})[0];if(!definition)fail_('INVALID_DATA');
  if(!simplified)volume.lines.forEach(function(line){if(line.quantity<definition.min||(definition.max!==null&&line.quantity>definition.max))fail_('INVALID_DATA');});
  var task={version:data.version,subblock:definition.id,label:definition.label,minMoves:definition.min,maxMoves:definition.max,scale:definition.scale,movementDefinition:'Movimentos efetivos de mão incluem progressões, juntar a outra mão na mesma agarra e rebotear.'};
  if(data.orientation!==undefined){if(['horizontal','vertical','mixed'].indexOf(data.orientation)<0)fail_('INVALID_DATA');task.orientation=data.orientation;}
  if(data.wallInclination!==undefined){if(['0_15','15_30','30_45','over_45'].indexOf(data.wallInclination)<0)fail_('INVALID_DATA');task.wallInclination=data.wallInclination;}
  if(data.restSeconds!==undefined)task.restSeconds=libraryNumber_(data.restSeconds,0,86400,true);
  if(simplified){
    task.sets=libraryNumber_(data.sets,1,100,true);
    task.repetitionsPerSet=libraryNumber_(data.repetitionsPerSet,1,100,true);
    if(data.restBetweenRepetitionsSeconds!==undefined)task.restBetweenRepetitionsSeconds=libraryNumber_(data.restBetweenRepetitionsSeconds,0,86400,true);
    if(data.restBetweenSetsSeconds!==undefined){
      if([60,120,180,300,600,900].indexOf(data.restBetweenSetsSeconds)<0)fail_('INVALID_DATA');
      task.restBetweenSetsSeconds=data.restBetweenSetsSeconds;
    }
  }
  return task;
}
/* Versioned directed prescription, independent of the historical specific task. */
function fingerboardDefinitions_(){
  return {
    modalities:{isometric:'Suspensão isométrica',pull:'Tração dos membros superiores'},
    grips:{
      edge:{label:'Reglete',options:{'0.5':'0,5 cm','1.0':'1,0 cm','1.5':'1,5 cm','2.5':'2,5 cm','3.5':'3,5 cm'}},
      sloper:{label:'Abaulado',options:{level1:'Nível 1',level2:'Nível 2'}},
      mono:{label:'Monodedo',options:{index:'Indicador',middle:'Médio',ring:'Anelar',little:'Mínimo'}},
      two:{label:'Bidedo',options:{indexMiddle:'Indicador + médio',middleRing:'Médio + anelar',ringLittle:'Anelar + mínimo'}},
      pinch:{label:'Pinça',options:{closed:'Fechada',intermediate:'Intermediária',open:'Aberta'}},
      jug:{label:'Patacão'}
    },
    prehensions:{open:'Aberta',half:'Semi-arqueada',full:'Arqueada'},
    sides:{bilateral:'Bilateral simultânea',left:'Lado esquerdo',right:'Lado direito'},
    loads:{bodyweight:'Massa corporal',added:'Sobrecarga adicional',assisted:'Assistência'},
    kilograms:[1,2,4,6,8,10],
    assistance:{foot:'Um pé apoiado',band:'Elástico',partner:'Auxílio de assistente'},
    repetitionRest:[0,3,5,10,15,20,30,45,60,90,120],
    seriesRest:[60,120,180,300,600,900]
  };
}
function directedSubblockNames_(){
  return {fingerboard:'Fingerboard',traction_blocks:'Blocos de tração',campus_board:'Campus Board'};
}
function tractionBlockDefinitions_(){
  var definitions=fingerboardDefinitions_();
  delete definitions.grips.sloper;
  delete definitions.grips.jug;
  delete definitions.sides.bilateral;
  definitions.modalities={isometric:'Tração isométrica'};
  definitions.loads={external:'Carga externa'};
  return definitions;
}
/* Catalog v1. Each token is an effective hand movement, including same-hold rebounds. */
function campusCatalog_(){
  return {version:1,holdCount:10,start:1,sequences:{
    CB01:{name:'Alternada 1 em 1',steps:'E2 D3 E4 D5 E6 D7 E8 D9 E10'},
    CB02:{name:'Alternada com salto inicial',steps:'D3 E4 D5 E6 D7 E8 D9 E10'},
    CB03:{name:'Reboteio alternado com junção',steps:'D1 D2 D3 E3 E4 E5 D5 D6 D7 E7 E8 E9 D9'},
    CB04:{name:'Salta dois e junta',steps:'D3 E3 E5 D5 D7 E7 E9 D9'},
    CB05:{name:'Alternada saltando agarras',steps:'D3 E5 D7 E9'},
    CB06:{name:'Progressão com alcance ampliado',steps:'D4 E7 D10 E10'},
    CB07:{name:'Reboteio com retorno',steps:'D2 D3 D4 D3 D2 D1'},
    CB08:{name:'Alternada com subida e descida',steps:'D2 E3 D4 E5 D5 E4 D3 E2 D1 E1'}
  }};
}
function campusDoublePath_(holdCount,interval,direction,count){
  var start=direction==='down'?holdCount:1;
  var leg=Math.floor((holdCount-1)/interval);
  var up=direction==='up_down'?Math.min(leg,count-1):direction==='up'?count:0;
  if(up>leg||count-up>leg||(direction==='up_down'&&(up<1||count-up>up)))return null;
  var rung=start,steps=[];
  for(var i=0;i<count;i++){
    rung+=i<up?interval:-interval;
    steps.push(['E'+rung,'D'+rung]);
  }
  return {start:start,steps:steps};
}
function campusDefinitions_(){
  var base=fingerboardDefinitions_(),catalog=campusCatalog_();
  base.grips={edge:base.grips.edge,sloper:base.grips.sloper};
  base.grips.edge.options['4.5']='4,5 cm';
  delete base.prehensions.full;
  delete base.assistance.foot;
  base.modalities={sequence:'Sequência de movimentos',double:'Botes duplos'};
  base.feet={none:'Sem apoio',ground:'Ambos os pés no solo',wall:'Ambos os pés na parede',alternate:'Apoio alternado de um pé na parede'};
  base.intervals={1:'Agarras consecutivas',2:'Saltando uma agarra',3:'Saltando duas agarras'};
  base.directions={up:'Subida',down:'Descida',up_down:'Subida e descida'};
  base.catalog=catalog;
  return base;
}
function campusPrescription_(d,defs){
  var catalog=defs.catalog,path,name;
  directedChoice_(d.feet,defs.feet);
  if(d.modality==='sequence'){
    if(d.interval!==undefined||d.direction!==undefined||d.bouts!==undefined)fail_('INVALID_DATA');
    var sequence=catalog.sequences[directedChoice_(d.sequenceId,catalog.sequences)];
    name=sequence.name;
    path={start:catalog.start,steps:sequence.steps.split(' ').map(function(step){return [step];})};
  }else{
    if(d.sequenceId!==undefined)fail_('INVALID_DATA');
    directedOption_(d.interval,[1,2,3]);
    directedChoice_(d.direction,defs.directions);
    libraryNumber_(d.bouts,1,Number.MAX_SAFE_INTEGER,true);
    path=campusDoublePath_(catalog.holdCount,d.interval,d.direction,d.bouts);
    if(!path)fail_('IMPOSSIBLE_CAMPUS_PATH');
  }
  path.catalogVersion=catalog.version;
  path.holdCount=catalog.holdCount;
  path.name=name||defs.intervals[d.interval]+' • '+defs.directions[d.direction];
  path.movesPerRep=path.steps.reduce(function(total,step){return total+step.length;},0);
  return path;
}
function directedChoice_(value,choices){
  if(typeof value!=='string'||!Object.prototype.hasOwnProperty.call(choices,value))fail_('INVALID_DATA');
  return value;
}
function directedOption_(value,choices){
  if(choices.indexOf(value)<0)fail_('INVALID_DATA');
  return value;
}
function validateDirectedLoad_(data,workout,item){
  fields_(data,['workoutId','itemId','classification','expectedRevision','directed']);
  var d=data.directed;
  fields_(d,['version','subblock','modality','grip','gripOption','prehension','side','load','sets','repetitionsPerSet','durationSeconds','restBetweenRepetitionsSeconds','restBetweenSetsSeconds','guidance','feet','sequenceId','interval','direction','bouts']);
  if(data.classification!=='directed'||item.block!=='Treinamento direcionado'||d.version!==1)fail_('INVALID_DATA');
  var names=directedSubblockNames_();
  directedChoice_(d.subblock,names);
  var traction=d.subblock==='traction_blocks',campus=d.subblock==='campus_board';
  var defs=campus?campusDefinitions_():traction?tractionBlockDefinitions_():fingerboardDefinitions_();
  if(!campus&&['feet','sequenceId','interval','direction','bouts'].some(function(k){return d[k]!==undefined;}))fail_('INVALID_DATA');
  directedChoice_(d.modality,defs.modalities);
  var grip=defs.grips[directedChoice_(d.grip,defs.grips)];
  if(grip.options)directedChoice_(d.gripOption,grip.options);
  else if(d.gripOption!==undefined)fail_('INVALID_DATA');
  if(d.grip==='edge')directedChoice_(d.prehension,defs.prehensions);
  else if(d.prehension!==undefined)fail_('INVALID_DATA');
  if(campus){if(d.side!==undefined)fail_('INVALID_DATA');}
  else directedChoice_(d.side,defs.sides);
  fields_(d.load,['kind','kilograms','assistance']);
  directedChoice_(d.load.kind,defs.loads);
  if(traction)libraryNumber_(d.load.kilograms,Number.MIN_VALUE,Number.MAX_VALUE,false);
  else if(d.load.kind==='added')directedOption_(d.load.kilograms,defs.kilograms);
  else if(d.load.kilograms!==undefined)fail_('INVALID_DATA');
  if(d.load.kind==='assisted')directedChoice_(d.load.assistance,defs.assistance);
  else if(d.load.assistance!==undefined)fail_('INVALID_DATA');
  libraryNumber_(d.sets,1,100,true);
  libraryNumber_(d.repetitionsPerSet,1,10000,true);
  var isometric=d.modality==='isometric';
  if(isometric)libraryNumber_(d.durationSeconds,0.001,86400,false);
  else if(d.durationSeconds!==undefined)fail_('INVALID_DATA');
  if(d.repetitionsPerSet>1)directedOption_(d.restBetweenRepetitionsSeconds,defs.repetitionRest);
  else if(d.restBetweenRepetitionsSeconds!==undefined)fail_('INVALID_DATA');
  directedOption_(d.restBetweenSetsSeconds,defs.seriesRest);
  var directed=Object.assign({},d);
  directed.labels={
    modality:defs.modalities[d.modality],grip:grip.label,side:defs.sides[d.side],load:defs.loads[d.load.kind]
  };
  if(campus){
    delete directed.labels.side;
    directed.labels.feet=defs.feet[d.feet];
    directed.path=campusPrescription_(d,defs);
  }
  if(grip.options)directed.labels.gripOption=grip.options[d.gripOption];
  if(d.prehension!==undefined)directed.labels.prehension=defs.prehensions[d.prehension];
  if(d.load.assistance!==undefined)directed.labels.assistance=defs.assistance[d.load.assistance];
  if(d.guidance!==undefined)directed.guidance=text_(d.guidance,2000);
  var kind=campus?'hand_moves':isometric?'isometric':'repetitions',unitId=campus?'unit-hand-moves':traction?'unit-seconds':isometric?'unit-hang-seconds':'unit-repetitions';
  var sets=Array.from({length:d.sets},function(){
    return isometric?{suspensions:d.repetitionsPerSet,seconds:d.durationSeconds}:{repetitions:d.repetitionsPerSet};
  });
  var input={kind:kind,unitId:unitId};
  if(campus)input.blocks=sets.map(function(){return {moves:[d.repetitionsPerSet*directed.path.movesPerRep]};});
  else input.sets=sets;
  var volume=libraryVolume_({volumeUnitIds:[unitId],isometricUnitId:traction?'unit-seconds':undefined,campus:campus},input,'prescribed');
  return {workout:workout,item:item,exercise:{id:'directed:'+d.subblock,name:names[d.subblock]},method:null,protocol:null,capacity:null,classification:'directed',intensity:{notPrescribed:true},auxiliaryIntensities:[],volume:volume,directed:directed};
}
function libraryValidateLoad_(db,user,data,candidateItem,candidateWorkout){
  fields_(data,['workoutId','itemId','exerciseId','methodId','protocolId','capacityId','classification','intensity','auxiliaryIntensities','volume','expectedRevision','task','directed']);
  var w=candidateWorkout||workout_(db,user,text_(data.workoutId,100));
  var item=candidateItem?[candidateItem]:rows_(db,'Items').filter(function(i){return i.id===data.itemId && i.workoutId===w.id;});
  if(item.length!==1||item[0].id!==data.itemId||item[0].workoutId!==w.id)fail_('NOT_FOUND');
  if(data.directed!==undefined)return validateDirectedLoad_(data,w,item[0]);
  var standalone=data.task&&data.task.version===3;
  if(standalone&&(data.exerciseId!==undefined||data.auxiliaryIntensities!==undefined))fail_('INVALID_DATA');
  var exercise=standalone?specificExercise_(data.task.subblock):libraryExercise_(db,data.exerciseId);
  var simplified=standalone||(data.task&&data.task.version===2);
  var volume,task=null;
  if(simplified){
    if(['volume','methodId','protocolId','capacityId'].some(function(key){return data[key]!==undefined;}))fail_('INVALID_DATA');
    task=validateSpecificTask_(exercise,data.task);
    // Count prescribed repetitions independently from the unknown number of hand moves.
    var sets=Array.from({length:task.sets},function(){return {repetitions:task.repetitionsPerSet};});
    volume=libraryVolume_({volumeUnitIds:['unit-repetitions']},{kind:'repetitions',unitId:'unit-repetitions',sets:sets},'prescribed');
  }else{
    volume=libraryVolume_(exercise,data.volume,'prescribed');
    if(data.task!==undefined)task=validateSpecificTask_(exercise,data.task,volume);
  }
  if(task&&data.classification!=='specific')fail_('INVALID_DATA');
  var method=data.methodId?libraryOne_(db,'METODOS',data.methodId,true):null,protocol=data.protocolId?libraryOne_(db,'METODOS',data.protocolId,true):null;
  if((!task&&!method)||(method&&method.kind!=='method')||(protocol&&protocol.kind!=='protocol'))fail_('INVALID_DATA');
  [method,protocol].filter(Boolean).forEach(function(m){if(!libraryRows_(db,'EXERCICIO_METODOS').some(function(link){return link.exerciseId===exercise.id&&link.methodId===m.id;}))fail_('INVALID_DATA');});
  var capacity=data.capacityId?libraryOne_(db,'CAPACIDADES',data.capacityId,true):null;
  if(capacity&&!libraryRows_(db,'EXERCICIO_CAPACIDADES').some(function(c){return c.exerciseId===exercise.id && c.capacityId===capacity.id;}))fail_('INVALID_DATA');
  if(['general','directed','specific'].indexOf(data.classification)<0)fail_('INVALID_DATA');
  var intensity,aux=[];
  if(standalone){
    fields_(data.intensity,['indicatorId','value','scale']);
    if(data.intensity.indicatorId!=='int-grade')fail_('INCOMPATIBLE_INDICATOR');
    intensity={indicatorId:'int-grade',kind:'ordinal',value:'',scale:task.scale};
    if(data.intensity.value===undefined){
      if(data.intensity.scale!==undefined)fail_('INVALID_DATA');
      intensity.notPrescribed=true;
    }else{
      if(data.intensity.scale!==task.scale||specificTaskGrades_(task.scale).indexOf(data.intensity.value)<0)fail_('INVALID_DATA');
      intensity.value=data.intensity.value;
    }
  }else if(task&&data.intensity&&data.intensity.value===undefined){
    fields_(data.intensity,['indicatorId']);if(data.intensity.indicatorId!==exercise.primaryIndicatorId)fail_('INCOMPATIBLE_INDICATOR');
    libraryOne_(db,'INDICADORES',exercise.primaryIndicatorId,true);
    intensity={indicatorId:exercise.primaryIndicatorId,kind:'ordinal',value:'',scale:task.scale,notPrescribed:true};
  }else intensity=libraryIntensity_(db,exercise,w.studentId,w.date,data.intensity,false);
  if(task&&!intensity.notPrescribed&&(intensity.scale!==task.scale||specificTaskGrades_(task.scale).indexOf(intensity.value)<0))fail_('INVALID_DATA');
  if(data.auxiliaryIntensities!==undefined){if(!Array.isArray(data.auxiliaryIntensities)||data.auxiliaryIntensities.length>10)fail_('INVALID_DATA');data.auxiliaryIntensities.forEach(function(i){if(i.indicatorId===intensity.indicatorId||aux.some(function(a){return a.indicatorId===i.indicatorId;}))fail_('INVALID_DATA');aux.push(libraryIntensity_(db,exercise,w.studentId,w.date,i,true));});}
  return {workout:w,item:item[0],exercise:exercise,method:method,protocol:protocol,capacity:capacity,classification:data.classification,intensity:intensity,auxiliaryIntensities:aux,volume:volume,task:task};
}
function libraryCreatePrescription_(db,user,req){
  return libraryWrite_(db,user,req,'PRESCRICOES',function(id){
    var d=req.data,validated=libraryValidateLoad_(db,user,d);libraryNumber_(d.expectedRevision,0,100000,true);
    var existing=libraryRows_(db,'PRESCRICOES').filter(function(r){return r.itemId===d.itemId;}).sort(function(a,b){return b.revision-a.revision;})[0];
    if(d.expectedRevision!==(existing?existing.revision:0))fail_('CONFLICT');
    if(existing){
      var previousDirected=JSON.parse(existing.snapshotJson).directed;
      if((previousDirected&&previousDirected.subblock)!==(validated.directed&&validated.directed.subblock))fail_('INVALID_DATA');
    }
    if(validated.directed&&!existing){
      var creation=rows_(db,'Requests').some(function(r){
        if(r.entity!=='Items'||r.entityId!==d.itemId||r.userId!==user.id)return false;
        var fp=JSON.parse(r.fingerprint);
        return fp[0]==='saveCoachPrescription'&&fp[1].directed&&fp[1].workoutId===d.workoutId&&libraryJson_(libraryCanonical_(fp[1].directed))===libraryJson_(libraryCanonical_(d.directed))&&req.requestId==='coach-p-'+hashAuth_(user.id+':'+r.key);
      });
      if(!creation)fail_('INVALID_DATA');
    }
    // Reserve revisions even when an earlier write failed after reserving an ID.
    libraryUnique_(db,'PRESCRICOES',function(r){return r.itemId===d.itemId && r.revision===d.expectedRevision+1;},id,req.action,function(p){return p.itemId===d.itemId && p.expectedRevision===d.expectedRevision;});
    return prescriptionRecord_(user,id,d,validated,existing);
  });
}

function prescriptionRecord_(user,id,d,validated,existing){
  validated.volume.lines.forEach(function(line){line.id=id_();});
  var snapshot={exercise:validated.exercise,method:validated.method,protocol:validated.protocol,capacity:validated.capacity,intensity:validated.intensity,auxiliaryIntensities:validated.auxiliaryIntensities,classification:validated.classification,session:{id:validated.workout.id,studentId:validated.workout.studentId,date:validated.workout.date},volumeMode:'prescribed'};
  if(validated.task)snapshot.task=validated.task;
  if(validated.directed)snapshot.directed=validated.directed;
  if(validated.strength)snapshot.strength=validated.strength;
  return {id:id,workoutId:d.workoutId,itemId:d.itemId,studentId:validated.workout.studentId,exerciseId:validated.exercise.id,methodId:d.methodId||'',protocolId:d.protocolId||'',capacityId:d.capacityId||'',classification:d.classification,intensityJson:libraryJson_({primary:validated.intensity,auxiliary:validated.auxiliaryIntensities}),volumeJson:libraryJson_(validated.volume),totalVolume:validated.volume.total,volumeUnitId:validated.volume.unitId,assessmentId:validated.intensity.assessmentId||(validated.strength&&validated.strength.oneRm?validated.strength.oneRm.assessmentId:''),snapshotJson:libraryJson_(snapshot),revision:d.expectedRevision+1,supersedesId:existing?existing.id:'',status:'active',createdBy:user.id,createdAt:new Date().toISOString()};
}
