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
  function quantity(p){if(p.source==='library')return `${p.volume.total} ${units[p.quantityUnit]} no total`;return p.quantity!==''&&p.quantity!==undefined?`${p.quantity} ${units[p.quantityUnit]||p.quantityUnit||''}`:'Não informada';}
  function intensity(p){
    if(p.source==='library'){
      const i=p.intensity.primary;
      if(i.kind==='relative')return `${i.percent}% ${i.reference.referenceType==='one_rm'?'de 1RM':'da referência'} • alvo ${i.targetValue} ${referenceUnit(i.targetUnitId)}`;
      if(i.kind==='ordinal')return `${i.value} (${i.scale})`;
      if(i.kind==='undefined')return i.description+' • metodologia pendente';
      return `${i.value}${i.indicatorId==='int-rpe'?' RPE':''}`;
    }
    if(!p.intensityUnit)return 'Não informada';if(p.intensityText)return p.intensityText;const v=p.intensityMin===p.intensityMax?String(p.intensityMin):`${p.intensityMin}–${p.intensityMax}`;return p.intensityUnit==='RPE'?'RPE '+v:v+' '+(p.intensityUnit==='%1RM'?'% de 1RM':p.intensityUnit==='%bodyweight'?'% do peso corporal':p.intensityUnit);}
  function referenceUnit(id){return {'unit-kg':'kg','unit-kgf':'kgf','unit-newton':'N','unit-bpm':'bpm','unit-degrees':'graus','unit-cm':'cm'}[id]||id;}
  function setCount(p){return p.sets!==''&&p.sets!==undefined?`${p.sets} ${p.volume?.kind==='hand_moves'?'blocos':'séries'}`:'Não informadas';}
  function seriesDescription(p,line){
    if(p.volume.kind==='hand_moves')return `Bloco ${line.blockOrder} • trecho ${line.setOrder}: ${line.quantity} movimentos de mão`;
    if(p.volume.kind==='isometric')return `Série ${line.setOrder}: ${line.occurrences} suspensões × ${line.durationSeconds} s = ${line.total} s de suspensão`;
    return `Série ${line.setOrder}: ${line.quantity} ${units[p.quantityUnit]}`;
  }
  function prescriptionDetails(p){
    if(p.source!=='library')return [];
    const snapshot=p.snapshot,details=[`Método: ${snapshot.method.name}${snapshot.protocol?' • protocolo: '+snapshot.protocol.name:''}`];
    if(snapshot.capacity)details.push('Capacidade/manifestação: '+snapshot.capacity.name);
    if(p.reference){const a=p.reference;details.push(`Referência individual: ${a.value} ${referenceUnit(a.unitId)} • avaliação ${a.id} • ${a.assessedOn} • validade ${a.validUntil}`);details.push(`Protocolo da avaliação: ${a.protocol} • ${a.referenceDefinition}`);}
    (p.intensity.auxiliary||[]).forEach(i=>details.push(i.indicatorId==='int-rpe'?`RPE auxiliar prescrito: ${i.value}`:JSON.stringify(i)));
    return details.concat(p.series.map(line=>seriesDescription(p,line)));
  }
  function feedbackData(workout,item,history,values){const p=item.prescription||{},prev=latest(history,item.id);const data={workoutId:workout.id,itemId:item.id,status:values.status,fingerPain:values.fingerPain,comment:values.comment||'',expectedRevision:prev?.revision||0};if(values.rpe!==undefined&&p.rpeApplicable)data.rpe=values.rpe;if(values.actualSets!==undefined&&p.sets!==''&&p.sets!==undefined)data.actualSets=values.actualSets;if(values.actualQuantity!==undefined&&p.quantityUnit){data.actualQuantity=values.actualQuantity;data.quantityUnit=p.quantityUnit;}return data;}
  return {units,statuses,dates,forDate,ordered,latest,state,formatTime,elapsed,start,pause,zero,remaining,restStart,restPause,quantity,intensity,setCount,seriesDescription,prescriptionDetails,feedbackData};
})();
