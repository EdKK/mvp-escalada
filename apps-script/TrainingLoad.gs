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
  var expected={isometric:'unit-hang-seconds',repetitions:'unit-repetitions',hand_moves:'unit-hand-moves',time:'unit-seconds',distance:'unit-meters'};
  if(expected[input.kind]!==input.unitId || allowed.indexOf(input.unitId)<0)fail_('INCOMPATIBLE_UNIT');
  var lines=[],min=mode==='prescribed'?1:0;
  function add(block,order,quantity,occurrences,duration){var total=quantity*occurrences*(duration===''?1:duration);if(!Number.isFinite(total)||total>1e12)fail_('INVALID_DATA');lines.push({blockOrder:block,setOrder:order,quantity:quantity,occurrences:occurrences,durationSeconds:duration,volumeUnitId:input.unitId,total:Math.round(total*1e9)/1e9});if(lines.length>100)fail_('INVALID_DATA');}
  if(input.kind==='hand_moves'){
    if(input.sets!==undefined||!Array.isArray(input.blocks)||!input.blocks.length||input.blocks.length>100)fail_('INVALID_DATA');
    input.blocks.forEach(function(block,b){fields_(block,['moves']);if(!Array.isArray(block.moves)||!block.moves.length||block.moves.length>100)fail_('INVALID_DATA');block.moves.forEach(function(m,s){add(b+1,s+1,libraryNumber_(m,min,100000,true),1,'');});});
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
    var d=req.data;libraryStudent_(db,user,d.studentId);libraryExercise_(db,d.exerciseId);
    var indicator=libraryOne_(db,'INDICADORES',d.indicatorId,true);if(indicator.kind!=='relative')fail_('INCOMPATIBLE_INDICATOR');
    if(JSON.parse(indicator.referenceUnitsJson).indexOf(d.unitId)<0)fail_('INCOMPATIBLE_UNIT');libraryOne_(db,'UNIDADES',d.unitId,true);
    var on=libraryDate_(d.assessedOn),until=libraryDate_(d.validUntil);if(until<on)fail_('INVALID_DATA');
    var parent=d.supersedesId||'';
    if(parent){var old=libraryOne_(db,'AVALIACOES',parent,false);if(old.studentId!==d.studentId||old.exerciseId!==d.exerciseId||old.indicatorId!==d.indicatorId||old.assessedOn>on)fail_('INVALID_DATA');libraryUnique_(db,'AVALIACOES',function(a){return a.supersedesId===parent;},id,req.action,function(p){return p.supersedesId===parent;});}
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
function specificTaskGrades_(scale){
  if(scale==='Hueco')return Array.from({length:16},function(_,i){return 'V'+i;});
  var grades=['4º','4º sup','5º','5º sup','6º','6º sup'];
  for(var n=7;n<=12;n++)['a','b','c'].forEach(function(letter){grades.push(n+letter);});return grades;
}
function validateSpecificTask_(exercise,data,volume){
  fields_(data,['version','subblock','orientation','wallInclination','restSeconds']);
  if(data.version!==1||exercise.primaryIndicatorId!=='int-grade'||exercise.modality!=='Escalada'||volume.kind!=='hand_moves'||volume.unitId!=='unit-hand-moves')fail_('INVALID_DATA');
  var definition=specificTaskDefinitions_().filter(function(d){return d.id===data.subblock;})[0];if(!definition)fail_('INVALID_DATA');
  volume.lines.forEach(function(line){if(line.quantity<definition.min||(definition.max!==null&&line.quantity>definition.max))fail_('INVALID_DATA');});
  var task={version:1,subblock:definition.id,label:definition.label,minMoves:definition.min,maxMoves:definition.max,scale:definition.scale,movementDefinition:'Movimentos efetivos de mão incluem progressões, juntar a outra mão na mesma agarra e rebotear.'};
  if(data.orientation!==undefined){if(['horizontal','vertical','mixed'].indexOf(data.orientation)<0)fail_('INVALID_DATA');task.orientation=data.orientation;}
  if(data.wallInclination!==undefined){if(['0_15','15_30','30_45','over_45'].indexOf(data.wallInclination)<0)fail_('INVALID_DATA');task.wallInclination=data.wallInclination;}
  if(data.restSeconds!==undefined)task.restSeconds=libraryNumber_(data.restSeconds,0,86400,true);
  return task;
}
function libraryValidateLoad_(db,user,data,candidateItem){
  fields_(data,['workoutId','itemId','exerciseId','methodId','protocolId','capacityId','classification','intensity','auxiliaryIntensities','volume','expectedRevision','task']);
  var w=workout_(db,user,text_(data.workoutId,100));
  var item=candidateItem?[candidateItem]:rows_(db,'Items').filter(function(i){return i.id===data.itemId && i.workoutId===w.id;});
  if(item.length!==1||item[0].id!==data.itemId||item[0].workoutId!==w.id)fail_('NOT_FOUND');
  var exercise=libraryExercise_(db,data.exerciseId),volume=libraryVolume_(exercise,data.volume,'prescribed');
  var task=data.task!==undefined?validateSpecificTask_(exercise,data.task,volume):null;
  if(task&&data.classification!=='specific')fail_('INVALID_DATA');
  var method=data.methodId?libraryOne_(db,'METODOS',data.methodId,true):null,protocol=data.protocolId?libraryOne_(db,'METODOS',data.protocolId,true):null;
  if((!task&&!method)||(method&&method.kind!=='method')||(protocol&&protocol.kind!=='protocol'))fail_('INVALID_DATA');
  [method,protocol].filter(Boolean).forEach(function(m){if(!libraryRows_(db,'EXERCICIO_METODOS').some(function(link){return link.exerciseId===exercise.id&&link.methodId===m.id;}))fail_('INVALID_DATA');});
  var capacity=data.capacityId?libraryOne_(db,'CAPACIDADES',data.capacityId,true):null;
  if(capacity&&!libraryRows_(db,'EXERCICIO_CAPACIDADES').some(function(c){return c.exerciseId===exercise.id && c.capacityId===capacity.id;}))fail_('INVALID_DATA');
  if(['general','directed','specific'].indexOf(data.classification)<0)fail_('INVALID_DATA');
  var intensity,aux=[];
  if(task&&data.intensity&&data.intensity.value===undefined){
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
    // Reserve revisions even when an earlier write failed after reserving an ID.
    libraryUnique_(db,'PRESCRICOES',function(r){return r.itemId===d.itemId && r.revision===d.expectedRevision+1;},id,req.action,function(p){return p.itemId===d.itemId && p.expectedRevision===d.expectedRevision;});
    validated.volume.lines.forEach(function(line){line.id=id_();});
    var snapshot={exercise:validated.exercise,method:validated.method,protocol:validated.protocol,capacity:validated.capacity,intensity:validated.intensity,auxiliaryIntensities:validated.auxiliaryIntensities,classification:validated.classification,session:{id:validated.workout.id,studentId:validated.workout.studentId,date:validated.workout.date},volumeMode:'prescribed'};
    if(validated.task)snapshot.task=validated.task;
    return {id:id,workoutId:d.workoutId,itemId:d.itemId,studentId:validated.workout.studentId,exerciseId:d.exerciseId,methodId:d.methodId||'',protocolId:d.protocolId||'',capacityId:d.capacityId||'',classification:d.classification,intensityJson:libraryJson_({primary:validated.intensity,auxiliary:validated.auxiliaryIntensities}),volumeJson:libraryJson_(validated.volume),totalVolume:validated.volume.total,volumeUnitId:validated.volume.unitId,assessmentId:validated.intensity.assessmentId||'',snapshotJson:libraryJson_(snapshot),revision:d.expectedRevision+1,supersedesId:existing?existing.id:'',status:'active',createdBy:user.id,createdAt:new Date().toISOString()};
  });
}
