/* Pure student view model; timers are derived from timestamps, never tick counters. */
var StudentModel = (() => {
  const units={repetitions:'repetições',seconds:'segundos',hang_seconds:'s de suspensão',minutes:'minutos',meters:'metros',attempts:'tentativas',moves:'movimentos'};
  const statuses={completed:'Concluído',partial:'Parcial',not_done:'Não realizado'};
  function dates(workouts){return [...new Set(workouts.map(w=>w.date))].sort();}
  function forDate(workouts,date){return workouts.filter(w=>w.date===date);}
  function ordered(items){return items.map((item,index)=>({item,index})).sort((a,b)=>(a.item.prescription?.position??a.index+1)-(b.item.prescription?.position??b.index+1)||a.index-b.index).map(x=>x.item);}
  function latest(history,itemId){return history.filter(f=>f.itemId===itemId).sort((a,b)=>b.revision-a.revision)[0];}
  function state(history,itemId){return latest(history,itemId)?.status||'pending';}
  function formatTime(ms){const secs=Math.max(0,Math.floor(ms/1000));return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');}
  function elapsed(t,now){return (t?.accumulated||0)+(t?.startedAt!==null&&t?.startedAt!==undefined?Math.max(0,now-t.startedAt):0);}
  function start(t,now){return {...(t||{accumulated:0}),startedAt:t?.startedAt??now};}
  function pause(t,now){return {accumulated:elapsed(t,now),startedAt:null};}
  function zero(){return {accumulated:0,startedAt:null};}
  function remaining(t,now){return t?.endsAt!==null&&t?.endsAt!==undefined?Math.max(0,t.endsAt-now):(t?.remaining||0);}
  function restStart(t,seconds,now){return {remaining:t?.remaining??seconds*1000,endsAt:now+(t?.remaining??seconds*1000)};}
  function restPause(t,now){return {remaining:remaining(t,now),endsAt:null};}
  function quantity(p){if(p.strength)return p.strength.repetitionsPerSet+' por série'+(p.strength.execution==='unilateral'?' por lado':'');if(p.directed){const d=p.directed;return d.repetitionsPerSet+' por série'+(d.durationSeconds===undefined?'':' × '+d.durationSeconds+' s');}if(p.task?.version>=2)return `${p.task.repetitionsPerSet} por série`;if(p.source==='library')return `${p.volume.total} ${units[p.quantityUnit]} no total`;return p.quantity!==''&&p.quantity!==undefined?`${p.quantity} ${units[p.quantityUnit]||p.quantityUnit||''}`:'Não informada';}
  function intensity(p){
    if(p.strength){
      const d=p.strength;
      return d.kilograms+' kg'+(d.loadBasis==='per_implement'?' por implemento':'');
    }
    if(p.source==='library'){
      const i=p.intensity.primary;if(i.notPrescribed)return 'Não informada';
      if(i.kind==='relative')return `${i.percent}% ${i.reference.referenceType==='one_rm'?'de 1RM':'da referência'} • alvo ${i.targetValue} ${referenceUnit(i.targetUnitId)}`;
      if(i.kind==='ordinal')return `${i.value} (${i.scale})`;
      if(i.kind==='undefined')return i.description+' • metodologia pendente';
      return `${i.value}${i.indicatorId==='int-rpe'?' PSE':''}`;
    }
    if(!p.intensityUnit)return 'Não informada';if(p.intensityText)return p.intensityText;const v=p.intensityMin===p.intensityMax?String(p.intensityMin):`${p.intensityMin}–${p.intensityMax}`;return p.intensityUnit==='RPE'?'PSE '+v:v+' '+(p.intensityUnit==='%1RM'?'% de 1RM':p.intensityUnit==='%bodyweight'?'% do peso corporal':p.intensityUnit);}
  function referenceUnit(id){return {'unit-kg':'kg','unit-kgf':'kgf','unit-newton':'N','unit-bpm':'bpm','unit-degrees':'graus','unit-cm':'cm'}[id]||id;}
  function setCount(p){return p.sets!==''&&p.sets!==undefined?`${p.sets} ${p.volume?.kind==='hand_moves'&&!p.directed?'blocos':'séries'}`:'Não informadas';}
  function seriesDescription(p,line){
    if(p.volume.kind==='hand_moves')return `Bloco ${line.blockOrder} • trecho ${line.setOrder}: ${line.quantity} movimentos de mão`;
    if(p.volume.kind==='isometric')return `Série ${line.setOrder}: ${line.occurrences} suspensões × ${line.durationSeconds} s = ${line.total} s de suspensão`;
    return `Série ${line.setOrder}: ${line.quantity} ${units[p.quantityUnit]}`;
  }
  function prescriptionDetails(p){
    if(p.source!=='library')return [];
    if(p.strength){
      const d=p.strength,condition={bodyweight:'Peso corporal',added:'Carga adicional',assisted:'Carga assistida'}[d.condition];
      const details=['Musculação • '+(d.execution==='unilateral'?'Unilateral, mesma dose nos dois lados':'Bilateral'),condition+' • '+intensity(p),
        'Volume prescrito: '+p.volume.total+' repetições','%1RM: '+(d.oneRm?d.oneRm.percent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—')];
      if(d.durationSeconds!==undefined)details.push('Duração da repetição: '+d.durationSeconds+' s');
      if(d.restBetweenRepetitionsSeconds!==undefined)details.push('Recuperação entre repetições: '+d.restBetweenRepetitionsSeconds+' s');
      return details;
    }
    if(p.directed){
      const d=p.directed,l=d.labels;
      const grip=[l.grip,l.gripOption,l.prehension].filter(Boolean).join(' • ');
      const load=[l.load,d.load.kilograms===undefined?'':d.load.kilograms+' kg',l.assistance].filter(Boolean).join(' • ');
      const details=['Treinamento direcionado • '+p.snapshot.exercise.name+' • '+l.modality,[grip,l.side,l.feet].filter(Boolean).join(' • '),load,'Volume prescrito: '+p.volume.total+' '+(d.path?'movimentos efetivos de mão':units[p.quantityUnit])];
      if(d.path)details.splice(1,0,d.path.name+(d.bouts===undefined?'':' • '+d.bouts+' botes por repetição'));
      if(d.restBetweenRepetitionsSeconds!==undefined)details.push('Recuperação entre repetições: '+d.restBetweenRepetitionsSeconds+' s');
      details.push('Recuperação entre séries: '+d.restBetweenSetsSeconds/60+' min');
      return details;
    }
    const snapshot=p.snapshot,details=p.task?.version>=2?[]:[`Método: ${snapshot.method?snapshot.method.name:'não informado'}${snapshot.protocol?' • protocolo: '+snapshot.protocol.name:''}`];
    if(p.task){
      const t=p.task,orientations={horizontal:'Horizontal — travessia',vertical:'Vertical — ascendente ou desescalada',mixed:'Misto'},walls={'0_15':'0°–15°','15_30':'Acima de 15° até 30°','30_45':'Acima de 30° até 45°',over_45:'Acima de 45°'};
      details.push('Treinamento específico • '+t.label);
      details.push('Deslocamento: '+(orientations[t.orientation]||'não informado')+' • inclinação: '+(walls[t.wallInclination]||'não informada')+' (0° vertical; positivo é extraprumo).');details.push(t.movementDefinition);
    }
    if(snapshot.capacity)details.push('Capacidade/manifestação: '+snapshot.capacity.name);
    if(p.reference){const a=p.reference;details.push(`Referência individual: ${a.value} ${referenceUnit(a.unitId)} • avaliação ${a.id} • ${a.assessedOn} • validade ${a.validUntil}`);details.push(`Protocolo da avaliação: ${a.protocol} • ${a.referenceDefinition}`);}
    (p.intensity.auxiliary||[]).forEach(i=>details.push(i.indicatorId==='int-rpe'?`PSE auxiliar prescrita: ${i.value}`:JSON.stringify(i)));
    if(p.task?.version>=2){
      const rest=p.task.restBetweenSetsSeconds;
      details.push('Recuperação entre séries: '+(rest===undefined?'não informada':`${rest/60} min`));
      return details;
    }
    return details.concat(p.series.map(line=>seriesDescription(p,line)));
  }
  function feedbackData(workout,item,history,values){
    const p=item.prescription||{},prev=latest(history,item.id);
    const data={workoutId:workout.id,itemId:item.id,status:values.status,expectedRevision:prev?.revision||0};
    if(values.completeOnly)return {...data,completeOnly:true};
    for(const key of ['rpe','fingerPain','comment'])if(values[key]!==undefined)data[key]=values[key];
    if(p.strength){
      data.strengthPrescriptionId=p.prescriptionId;
      for(const key of ['actualSets','actualRepetitions','actualKilograms'])if(values[key]!==undefined)data[key]=values[key];
    }else if(p.directed){
      data.prescriptionId=p.prescriptionId;
      if(values.actualSeries!==undefined)data.actualSeries=values.actualSeries;
    }else{
      if(values.actualSets!==undefined&&p.sets!==''&&p.sets!==undefined)data.actualSets=values.actualSets;
      if(values.actualQuantity!==undefined&&p.quantityUnit){data.actualQuantity=values.actualQuantity;data.quantityUnit=p.quantityUnit;}
    }
    return data;
  }
  return {units,statuses,dates,forDate,ordered,latest,state,formatTime,elapsed,start,pause,zero,remaining,restStart,restPause,quantity,intensity,setCount,seriesDescription,prescriptionDetails,feedbackData};
})();
