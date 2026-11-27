/* BIB-13B — structured musculação prescriptions using the integral session and feedback ledgers. */
function strengthExercises_(db){
  return new Map(listGeneralCatalog_(db,{}).exercises.filter(function(row){
    return row.area==='Musculação';
  }).map(function(row){return [row.id,row];}));
}

function strengthReferenceDefinition_(execution,basis){
  return 'musculacao:added:'+execution+':'+basis;
}

function strengthReferences_(db,studentId,date){
  var rows=libraryRows_(db,'AVALIACOES'),superseded=new Set(rows.map(function(row){return row.supersedesId;}));
  var references=new Map(),ambiguous=new Set();
  rows.forEach(function(row){
    if(row.studentId!==studentId||row.status!=='active'||row.indicatorId!=='int-1rm'||row.referenceType!=='one_rm'||
      row.unitId!=='unit-kg'||!/^musculacao:added:(bilateral|unilateral):(total|per_implement)$/.test(row.referenceDefinition)||
      typeof row.protocol!=='string'||!row.protocol.trim()||superseded.has(row.id)||typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<=0||row.value>1e9)return;
    try{if(libraryDate_(row.assessedOn)>date||libraryDate_(row.validUntil)<date)return;}
    catch(error){if(error.code==='INVALID_DATA')return;throw error;}
    var key=row.exerciseId+'|'+row.referenceDefinition,previous=references.get(key);
    if(!previous||previous.assessedOn<row.assessedOn){
      references.set(key,row);
      ambiguous.delete(key);
    }else if(previous.assessedOn===row.assessedOn)ambiguous.add(key);
  });
  ambiguous.forEach(function(key){references.delete(key);});
  return references;
}

function listStrengthReferences_(db,user,data){
  fields_(data,['studentId','date']);
  var studentId=text_(data.studentId,100),date=libraryDate_(data.date);
  libraryStudent_(db,user,studentId);
  var exercises=strengthExercises_(db);
  return Array.from(strengthReferences_(db,studentId,date).values()).filter(function(row){
    return exercises.has(row.exerciseId);
  }).map(function(row){
    return {exerciseId:row.exerciseId,definition:row.referenceDefinition,kilograms:row.value};
  });
}

function strengthCandidate_(workout,itemId,input,context){
  fields_(input,['block','classification','strength']);
  if(input.block!=='Treinamento geral'||input.classification!=='general')fail_('INVALID_DATA');
  var d=input.strength;
  fields_(d,['version','exerciseId','sets','repetitionsPerSet','restBetweenSetsSeconds','kilograms','condition','execution','loadBasis','durationSeconds','restBetweenRepetitionsSeconds','guidance']);
  if(d.version!==1||['bilateral','unilateral'].indexOf(d.execution)<0||['bodyweight','added','assisted'].indexOf(d.condition)<0||
    ['total','per_implement'].indexOf(d.loadBasis)<0||[60,120,180,300,600,900].indexOf(d.restBetweenSetsSeconds)<0)fail_('INVALID_DATA');
  var exercise=context.exercises.get(text_(d.exerciseId,100));
  if(!exercise)fail_('NOT_FOUND');
  libraryNumber_(d.sets,1,100,true);
  libraryNumber_(d.repetitionsPerSet,1,10000,true);
  libraryNumber_(d.kilograms,0,100000,false);
  if(d.condition==='bodyweight'?(d.kilograms!==0||d.loadBasis!=='total'):d.kilograms<=0)fail_('INVALID_DATA');
  var strength=Object.assign({},d);
  if(d.durationSeconds!==undefined)libraryNumber_(d.durationSeconds,0.001,86400,false);
  if(d.restBetweenRepetitionsSeconds!==undefined)libraryNumber_(d.restBetweenRepetitionsSeconds,0,86400,true);
  if(d.guidance!==undefined)strength.guidance=text_(d.guidance,2000);
  var reference=d.condition==='added'&&context.references.get(d.exerciseId+'|'+strengthReferenceDefinition_(d.execution,d.loadBasis));
  if(reference){
    var ratio=d.kilograms/reference.value*100;
    if(Number.isFinite(ratio))strength.oneRm={assessmentId:reference.id,kilograms:reference.value,percent:ratio};
  }
  var unitId='unit-repetitions',sides=d.execution==='unilateral'?2:1;
  var volume=libraryVolume_({volumeUnitIds:[unitId]},{
    kind:'repetitions',unitId:unitId,sets:Array.from({length:d.sets},function(){return {repetitions:d.repetitionsPerSet*sides};})
  },'prescribed');
  var item={id:itemId,workoutId:workout.id,block:input.block,category:exercise.category,exercise:exercise.name,
    metric:'Reps',quantity:'',minutes:'',notes:strength.guidance||'',createdAt:new Date().toISOString()};
  return {item:item,validated:{workout:workout,exercise:exercise,method:null,protocol:null,capacity:null,
    classification:'general',intensity:{kind:'absolute',value:d.kilograms,unitId:'unit-kg'},
    auxiliaryIntensities:[],strength:strength,volume:volume}};
}

function applyStrengthFeedback_(record,data,p){
  if(data.strengthPrescriptionId!==p.prescriptionId)fail_('CONFLICT');
  if(data.prescriptionId!==undefined)fail_('INVALID_DATA');
  if(data.actualSeries!==undefined||data.actualQuantity!==undefined||data.quantityUnit!==undefined)fail_('INVALID_DATA');
  var notDone=data.status==='not_done';
  var sets=data.actualSets,repetitions=data.actualRepetitions,kilograms=data.actualKilograms;
  if(sets!==undefined)record.actualSets=numberRange_(sets,0,notDone?0:1000,true);
  if(repetitions!==undefined)numberRange_(repetitions,0,notDone?0:10000,true);
  if(kilograms!==undefined)numberRange_(kilograms,0,notDone||p.strength.condition==='bodyweight'?0:100000,false);
  if(sets!==undefined&&repetitions!==undefined){
    record.actualQuantity=sets*repetitions*(p.strength.execution==='unilateral'?2:1);
    record.quantityUnit='repetitions';
  }
}
