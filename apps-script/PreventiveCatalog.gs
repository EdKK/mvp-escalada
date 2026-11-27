/* BIB-14B. Os identificadores da edição 1 permanecem estáveis entre revisões do catálogo. */
function preventiveCatalog_(){
  var general='Gerais',injury='Específicos para lesões';
  var shoulders='Ombros',elbows='Cotovelos',wrists='Punhos',core='Tronco',hips='Quadril',feet='Pés';
  var lower='Membros inferiores',fingers='Dedos',spine='Coluna e tronco',knees='Joelhos',ankles='Tornozelos';
  return [
    ['01','Caminhada lateral em parada de mãos',false,[general,shoulders,20],[injury,shoulders,44]],
    ['02','Puxada diagonal de baixo para cima com elástico',true,[general,shoulders,21],[injury,shoulders,41],[injury,elbows,64]],
    ['03','Rosca após extensão e rotação externa do ombro',false,[general,shoulders,22],[injury,shoulders,43]],
    ['04','Abertura de peitoral sobre rolo',false,[general,shoulders,22]],
    ['05','Tração na barra com elástico nos antebraços',true,[general,shoulders,23],[injury,shoulders,53]],
    ['06','Deslizamento dos antebraços na parede',false,[general,shoulders,24],[injury,shoulders,54]],
    ['07','Extensão e abertura dos dedos com elástico',true,[general,elbows,25],[injury,elbows,58],[injury,fingers,69]],
    ['08','Extensão dos dedos e do punho com rotação externa e elástico',true,[general,elbows,26]],
    ['09','Elevação de kettlebell invertido com pausa',false,[general,wrists,27]],
    ['10','Prancha com puxada unilateral de elástico',true,[general,core,28],[injury,spine,71]],
    ['11','Escalador cruzado com bola suíça',false,[general,core,29]],
    ['12','Pêndulo dos joelhos com elástico nos punhos',true,[general,core,29],[injury,spine,70]],
    ['13','Terra romeno unilateral com flexão do joelho de apoio',false,[general,hips,30],[injury,knees,83]],
    ['14','Mobilização ativa dos isquiotibiais com elástico',true,[general,lower,31],[injury,hips,81]],
    ['15','Agachamento unilateral sobre cadeira com espuma',false,[general,lower,32]],
    ['16','Rolamento em supinação dos tornozelos',false,[general,feet,33],[injury,ankles,85]],
    ['17','Bússola em apoio unilateral',false,[general,feet,33],[injury,ankles,85]],
    ['18','Extensão lateral de braço em quatro apoios',false,[injury,shoulders,42]],
    ['19','Tração do elástico atrás das costas',true,[injury,shoulders,42]],
    ['20','Rotação externa do ombro com cotovelo elevado e elástico',true,[injury,shoulders,43],[injury,shoulders,51]],
    ['21','Caminhada do urso com elevação de braço e variações',false,[injury,shoulders,45]],
    ['22','Puxada ajoelhada com elástico até a altura do pescoço',true,[injury,shoulders,45],[injury,shoulders,49]],
    ['23','Flexão de braços nas argolas',false,[injury,shoulders,46]],
    ['24','Depressão escapular em apoio com braços estendidos',false,[injury,shoulders,46]],
    ['25','Remada nas argolas com elástico nos punhos',true,[injury,shoulders,47],[injury,shoulders,48]],
    ['26','Simulação de tração com bastão em decúbito ventral',false,[injury,shoulders,49]],
    ['27','Desenvolvimento acima da cabeça com kettlebell',false,[injury,shoulders,50]],
    ['28','Flexão circular em parada de mãos',false,[injury,shoulders,51]],
    ['29','Rosca rotacional com braço estendido na descida',false,[injury,shoulders,52]],
    ['30','Rotação interna de ombros em decúbito ventral com halteres',false,[injury,shoulders,52]],
    ['31','Estabilização escapular em decúbito ventral',false,[injury,shoulders,55]],
    ['32','Flexão escapular combinada',false,[injury,shoulders,55]],
    ['33','Flexão excêntrica dos dedos com elástico',true,[injury,elbows,57],[injury,elbows,61]],
    ['34','Alongamento da cadeia flexora sobre bola suíça',false,[injury,elbows,57]],
    ['35','Extensão do punho com halter e antebraço apoiado',false,[injury,elbows,58],[injury,elbows,62]],
    ['36','Descida excêntrica do martelo com extensão do cotovelo',false,[injury,elbows,59]],
    ['37','Flexão excêntrica dos dedos com resistência manual',false,[injury,elbows,59]],
    ['38','Extensão excêntrica dos dedos com resistência manual',false,[injury,elbows,60]],
    ['39','Flexão de punho com halter e palma para cima',false,[injury,elbows,61]],
    ['40','Rotação excêntrica com martelo para dentro',false,[injury,elbows,62]],
    ['41','Trabalho excêntrico do braquial',false,[injury,elbows,63]],
    ['42','Trabalho excêntrico do bíceps',false,[injury,elbows,64]],
    ['43','Estabilização ajoelhada do punho com kettlebell invertido',false,[injury,wrists,65]],
    ['44','Extensão do punho e abertura dos dedos com elástico',true,[injury,wrists,66]],
    ['45','Rotação excêntrica com martelo para fora',false,[injury,wrists,66]],
    ['46','Flexão de braços sobre kettlebells invertidos',false,[injury,wrists,67]],
    ['47','Extensão e abertura ativa dos dedos',false,[injury,fingers,69]],
    ['48','Empurrar e puxar kettlebell deitado sobre rolo',false,[injury,spine,72]],
    ['49','Abertura da cintura escapular sobre bola suíça',false,[injury,spine,73]],
    ['50','Anjo no chão',false,[injury,spine,73]],
    ['51','Anjo na parede',false,[injury,spine,74]],
    ['52','Agachamento com barra acima da cabeça',false,[injury,spine,74]],
    ['53','Elevação dos cotovelos',false,[injury,spine,75]],
    ['54','Rotação em pretzel sobre bola suíça',false,[injury,spine,76]],
    ['55','Rotação em pretzel no chão',false,[injury,spine,76]],
    ['56','Pressão cervical para trás e na diagonal com elástico',true,[injury,spine,77]],
    ['57','Pressão cervical contra a mão',false,[injury,spine,77]],
    ['58','Rotação do quadril em apoio unilateral em T',false,[injury,hips,78]],
    ['59','Elevação da perna em prancha lateral',false,[injury,hips,79]],
    ['60','Agachamento em apoio unilateral em T com elástico',true,[injury,hips,79]],
    ['61','Abdução do quadril em quatro apoios',false,[injury,hips,80]],
    ['62','Alongamento dos isquiotibiais com rotação',false,[injury,hips,82]],
    ['63','Agachamento em apoio unilateral em T',false,[injury,hips,82]],
    ['64','Subida unilateral no banco com carga acima da cabeça',false,[injury,knees,84]],
    ['65','Agachamento com pé suspenso no elástico e kettlebell acima da cabeça',true,[injury,knees,84]]
  ].map(function(row){
    return {id:'prev-'+row[0],name:row[1],band:row[2],references:row.slice(3).map(function(ref){
      return {subgroup:ref[0],category:ref[1],page:ref[2]};
    })};
  });
}

function listPreventiveCatalog_(data){
  fields_(data,[]);
  return {version:1,exercises:preventiveCatalog_()};
}

function preventiveCandidate_(workout,itemId,input,exercises){
  fields_(input,['block','classification','preventive']);
  if(input.block!=='Treinamento geral'||input.classification!=='general')fail_('INVALID_DATA');
  var d=input.preventive;
  fields_(d,['version','exerciseId','sets','repetitionsPerSet','resistance','guidance']);
  if(d.version!==1||(d.resistance!==undefined&&['Fraca','Média','Forte'].indexOf(d.resistance)<0))fail_('INVALID_DATA');
  var exercise=exercises.get(text_(d.exerciseId,100));
  if(!exercise)fail_('NOT_FOUND');
  libraryNumber_(d.sets,1,100,true);
  libraryNumber_(d.repetitionsPerSet,1,10000,true);
  var preventive=Object.assign({},d);
  if(d.guidance!==undefined)preventive.guidance=text_(d.guidance,2000);
  var unitId='unit-repetitions';
  var volume=libraryVolume_({volumeUnitIds:[unitId]},{
    kind:'repetitions',unitId:unitId,sets:Array.from({length:d.sets},function(){return {repetitions:d.repetitionsPerSet};})
  },'prescribed');
  var item={id:itemId,workoutId:workout.id,block:input.block,category:'Exercícios preventivos',exercise:exercise.name,
    metric:'Reps',quantity:'',minutes:'',notes:preventive.guidance||'',createdAt:new Date().toISOString()};
  return {item:item,validated:{workout:workout,exercise:{id:exercise.id,name:exercise.name,band:exercise.band},
    method:null,protocol:null,capacity:null,classification:'general',intensity:d.resistance===undefined
      ?{kind:'ordinal',notPrescribed:true,scale:'qualitativa'}:{kind:'ordinal',value:d.resistance,scale:'qualitativa'},
    auxiliaryIntensities:[],preventive:preventive,volume:volume}};
}
