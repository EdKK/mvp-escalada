/* Shared UI for the simulated demo and the authenticated Apps Script adapter. */
(async()=>{
  const M=StudentModel, $=id=>document.getElementById(id), api=window.StudentAPI;
  let workouts=[], workout=null, selectedDate='', session=null, loadVersion=0, dialogItem=null, sending=false, focusBefore=null;
  const timers=new Map(), rests=new Map(), expanded=new Map(), intentions=new Map();
  const icons={chevron:'<path d="m6 9 6 6 6-6"/>',stack:'<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',repeat:'<path d="m17 2 4 4-4 4M3 10V7a1 1 0 0 1 1-1h17M7 22l-4-4 4-4m14 0v3a1 1 0 0 1-1 1H3"/>',clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',intensity:'<path d="M3 15h3v6H3zM10 9h3v12h-3zM17 3h3v18h-3z"/>',chat:'<path d="M4 17a9 9 0 1 1 4 3l-5 1zM8 9h8M8 13h5"/>',play:'<path d="m8 4 12 8-12 8z"/>',pause:'<path d="M5 4h4v16H5zM15 4h4v16h-4z"/>',reset:'<path d="M3 10a9 9 0 1 1 0 5M3 4v6h6"/>',check:'<path d="m4 12 5 5L20 6"/>'};
  function icon(name){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.innerHTML=icons[name]||icons.clock;return s;}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,cls,handler,ic){const b=el('button',cls);if(ic)b.append(icon(ic));b.append(document.createTextNode(text));b.addEventListener('click',handler);return b;}
  let toastTimer, sessionVersion = 0;
  function clearTraining() {
    sessionVersion++;
    loadVersion++;
    workouts = [];
    workout = session = dialogItem = focusBefore = null;
    selectedDate = '';
    sending = false;
    timers.clear(); rests.clear(); expanded.clear(); intentions.clear();
    hideModal('feedbackDialog');
    $('feedbackForm').reset();
    for (const id of ['days', 'sessionSelect', 'dayInstructions', 'exercises', 'actualSeriesFields']) $(id).replaceChildren();
    for (const id of ['sessionDate', 'dayGoal', 'feedbackExercise', 'feedbackHistory', 'feedbackError', 'actualStrengthVolume', 'progressText', 'toast']) {
      const element = $(id);
      if (element) element.textContent = '';
    }
    $('progressBar').style.width = '0%';
    for (const id of ['emptyState', 'sessionContent', 'sessionSelect', 'sessionLabel', 'toast']) $(id).hidden = true;
    $('saveFeedback').disabled = false;
    clearTimeout(toastTimer);
  }
  function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
  function errorText(e){return ({CONFLICT:'O registro mudou em outra sessão. Atualize o treino antes de corrigir novamente.',BUSY:'O servidor está ocupado. Tente novamente.',UNAUTHENTICATED:'Sua sessão expirou. Entre novamente.',FORBIDDEN:'Esta conta não tem permissão para esta operação.',INVALID_DATA:'Confira os valores e as unidades informadas.'})[e.message]||'Não foi possível carregar ou salvar. Tente novamente.';}
  async function safe(fn){const version=sessionVersion;try{await fn();}catch(e){if(version===sessionVersion)notify(errorText(e));}}
  function timerKey(item){return `${session.id}:${workout.id}:${item.id}`;}
  function selectionVisible(){return workout && !sending;}
  function write(data){
    const version = sessionVersion, signature = JSON.stringify(data);
    if (!intentions.has(signature)) intentions.set(signature, crypto.randomUUID());
    return api.call('submitItemFeedback', data, intentions.get(signature)).then(result => {
      if (version === sessionVersion) intentions.delete(signature);
      return result;
    });
  }
  function hideModal(id){$(id).hidden=true;document.body.style.overflow='';focusBefore?.focus();}
  function showModal(id){focusBefore=document.activeElement;$(id).hidden=false;document.body.style.overflow='hidden';$(id).querySelector('button,select,input').focus();}
  async function loadWorkouts(preferred){
    const version=++loadVersion; const data=await api.call('listWorkouts',{});if(version!==loadVersion)return;
    workouts=data;const dates=M.dates(data);selectedDate=dates.includes(preferred)?preferred:dates[0]||'';
    renderDates();$('emptyState').hidden=!!dates.length;$('sessionContent').hidden=!dates.length;
    if(!dates.length){$('sessionSelect').hidden=true;$('sessionLabel').hidden=true;workout=null;$('exercises').replaceChildren();$('sessionDate').textContent='Seus treinos';return;}
    await chooseDate(selectedDate);
  }
  function renderDates(){
    $('days').replaceChildren();
    M.dates(workouts).forEach(date=>{const day=new Date(date+'T12:00:00'),b=button('','day',()=>safe(()=>chooseDate(date)));b.dataset.date=date;b.setAttribute('aria-pressed',String(date===selectedDate));b.setAttribute('aria-label',day.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}));const week=day.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');b.append(el('span','',week[0].toUpperCase()+week.slice(1)),el('strong','',date.slice(8)));$('days').append(b);});
  }
  async function chooseDate(date){
    if(sending)return;selectedDate=date;renderDates();const options=M.forDate(workouts,date);$('sessionSelect').replaceChildren();
    options.forEach((w,index)=>{const o=el('option','',`${index+1}. ${w.microcycleType||w.goal}`);o.value=w.id;$('sessionSelect').append(o);});
    $('sessionSelect').hidden=options.length<2;$('sessionLabel').hidden=options.length<2;
    $('sessionDate').textContent=new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
    if(options.length)await loadWorkout(options[0].id);
  }
  async function loadWorkout(id){
    const version=++loadVersion;workout=null;$('sessionContent').hidden=true;
    const data=await api.call('getWorkout',{workoutId:id});if(version!==loadVersion)return;
    workout=data;$('dayGoalLabel').textContent=data.microcycleType?'Tipo de microciclo':'Objetivo do dia';$('dayGoal').textContent=data.microcycleType||data.goal;$('dayInstructions').replaceChildren();
    (data.instructions||[]).forEach(text=>$('dayInstructions').append(el('li','',text)));
    $('noInstructions').hidden=!!data.instructions?.length;$('sessionContent').hidden=false;$('emptyState').hidden=true;renderExercises();
  }
  function metric(label,value,ic){const box=el('div','metric'),head=el('span');head.append(icon(ic),document.createTextNode(label));box.append(head,el('strong','',value));return box;}
  function renderExercises(){
    const items=M.ordered(workout.items),history=workout.itemFeedback||[];
    $('exercises').replaceChildren();const count=items.filter(i=>M.state(history,i.id)==='completed').length;
    $('progressText').textContent=`${count} de ${items.length} marcados como concluídos`;$('progressBar').style.width=(items.length?count/items.length*100:0)+'%';
    items.forEach((item,index)=>{
      const p=item.prescription||{},prev=M.latest(history,item.id),key=timerKey(item)+(item.prescription?.directed?':'+item.prescription.revision:''),state=M.state(history,item.id);
      const card=el('details','exercise');card.dataset.itemId=item.id;card.dataset.status=state;
      const defaultOpen=items.length>1?1:0;
      card.open=expanded.has(key)?expanded.get(key):index===defaultOpen;
      card.addEventListener('toggle',()=>expanded.set(key,card.open));
      const summary=el('summary'),number=el('span','number',state==='completed'?'✓':String(index+1)),title=el('span','exercise-title',item.exercise);
      if(prev)title.append(el('span','status-label',M.statuses[prev.status]));
      const arrow=icon('chevron');arrow.classList.add('chevron');summary.append(number,title,el('span','expand-label','Ver detalhes'),arrow);card.append(summary);
      const body=el('div','exercise-body'),metrics=el('div','metrics'),directed=p.directed;
      const restLabel=p.strength?'Entre séries':directed?(directed.restBetweenRepetitionsSeconds>0?'Entre repetições':'Entre séries'):p.task?.version>=2?'Entre repetições':'Descanso';
      metrics.append(metric(p.volume?.kind==='hand_moves'&&!directed?'Blocos':'Séries',M.setCount(p),'stack'),metric(p.quantityUnit==='repetitions'||directed?.path?'Repetições':'Dose / duração',M.quantity(p),'repeat'));
      if(!p.preventive)metrics.append(metric(restLabel,p.restSeconds!==''&&p.restSeconds!==undefined?(p.restSeconds>=60&&p.restSeconds%60===0?`${p.restSeconds/60} min`:`${p.restSeconds} s`):'Não informado','clock'));
      if(!directed)metrics.append(metric(p.strength?'Carga':p.preventive&&p.snapshot.exercise.band?'Resistência do elástico':'Intensidade',M.intensity(p),'intensity'));
      body.append(metrics);
      if(p.source==='library'){
        const prescription=el('div','technical-note'),content=el('div');content.append(el('strong','','Prescrição do treinador'));
        M.prescriptionDetails(p).forEach(description=>content.append(el('p','',description)));
        prescription.append(icon('stack'),content);body.append(prescription);
        if(directed?.path)body.append(renderCampusBoard(directed.path));
      }
      const note=el('div','technical-note'),noteText=el('div');const guidance=directed?directed.guidance:item.notes;
      if(!directed||guidance){
        noteText.append(el('strong','',directed||p.preventive?'Orientações do treinador':'Observações'),el('p','',guidance||'Nenhuma observação técnica adicional.'));
        note.append(icon('chat'),noteText);body.append(note);
      }
      const timer=el('div','exercise-timer'),clock=el('div','clock-face');clock.append(icon('clock'));const clockText=el('span','','00:00');clockText.dataset.elapsed=key;clock.setAttribute('aria-label','Tempo decorrido do exercício');clock.append(clockText);
      timer.append(clock,button('Iniciar','timer-btn primary',()=>{timers.set(key,M.start(timers.get(key),Date.now()));paintClocks();},'play'),button('Pausar','timer-btn',()=>{timers.set(key,M.pause(timers.get(key),Date.now()));paintClocks();},'pause'),button('Zerar','timer-btn',()=>{timers.set(key,M.zero());paintClocks();},'reset'));body.append(timer);
      if(p.restSeconds!==undefined&&p.restSeconds!==''&&p.restSeconds>0){
        const rest=el('div','rest-row');rest.dataset.restRow=key;rest.append(el('span','',directed||p.strength||p.task?.version>=2?'Recuperação '+restLabel.toLowerCase():'Descanso regressivo'));const restText=el('span','rest-value',M.formatTime(p.restSeconds*1000));restText.dataset.rest=key;restText.dataset.seconds=p.restSeconds;rest.append(restText);
        rest.append(button('Iniciar','',()=>{let t=rests.get(key);if(t?.endsAt!=null&&t.endsAt>Date.now())return;if(t&&M.remaining(t,Date.now())===0)t=undefined;rests.set(key,M.restStart(t,p.restSeconds,Date.now()));paintClocks();}),button('Pausar','',()=>{const t=rests.get(key)||{remaining:p.restSeconds*1000,endsAt:null};rests.set(key,M.restPause(t,Date.now()));paintClocks();}),button('Zerar','',()=>{rests.set(key,{remaining:p.restSeconds*1000,endsAt:null});paintClocks();}));body.append(rest);
      }
      const actions=el('div','exercise-actions');
      const complete=button(state==='completed'?'Concluído':'Concluir exercício','complete-btn',()=>completeExercise(item,complete),'check');
      complete.disabled=state==='completed';
      actions.append(button(prev?'Editar feedback':'Dar feedback','feedback-btn',()=>openFeedback(item),'chat'),complete);body.append(actions);
      if(prev){
        const group=p.volume?.kind==='hand_moves'&&!directed?'bloco':'série';
        const unit=prev.actualQuantity===1&&prev.quantityUnit==='repetitions'?'repetição':M.units[prev.quantityUnit]||prev.quantityUnit;
        const dose=[
          prev.actualSets!==''&&prev.actualSets!==undefined?prev.actualSets+' '+group+(prev.actualSets===1?'':'s'):'',
          prev.actualQuantity!==''&&prev.actualQuantity!==undefined?prev.actualQuantity+' '+unit:'',
          prev.actualKilograms!==undefined?prev.actualKilograms+' kg':'',
          prev.actualRepetitions!==undefined?prev.actualRepetitions+' repetições por série'+(p.strength?.execution==='unilateral'?' por lado':''):'',
          prev.rpe!==''&&prev.rpe!==undefined?'PSE: '+prev.rpe:'',
          prev.fingerPain!==''&&prev.fingerPain!==undefined?'Dor: '+prev.fingerPain:''
        ].filter(Boolean).join(' • ');
        body.append(el('p','saved-note','Feedback informado: '+(dose||'sem dados quantitativos')+'.'));
      }
      prev?.actualSeries?.forEach((line,index)=>{
        const values=[
          line.repetitions===undefined?'':line.repetitions+' repetições',
          line.seconds===undefined?'':line.seconds+' '+M.units[prev.quantityUnit||'hang_seconds'],
          line.additionalMoves===undefined?'':line.additionalMoves+' movimentos em repetições incompletas'
        ].filter(Boolean);
        if(values.length)body.append(el('p','saved-note','Série '+(index+1)+': '+values.join(' • ')));
      });
      if(prev)body.append(el('p','saved-note',`Registro ${prev.revision} salvo • ${new Date(prev.createdAt).toLocaleString('pt-BR')} • Pode ser corrigido.`));
      card.append(body);$('exercises').append(card);
    });
    if(!items.length)$('exercises').append(el('p','empty-state','O treinador ainda não adicionou exercícios.'));
    paintClocks();
  }
  function paintClocks(){
    const now=Date.now();document.querySelectorAll('[data-elapsed]').forEach(n=>n.textContent=M.formatTime(M.elapsed(timers.get(n.dataset.elapsed),now)));
    document.querySelectorAll('[data-rest]').forEach(n=>{const t=rests.get(n.dataset.rest),left=t?M.remaining(t,now):Number(n.dataset.seconds)*1000;n.textContent=M.formatTime(left);n.parentElement.dataset.finished=String(!!t&&left===0);});
  }
  function openFeedback(item){
    if(!selectionVisible())return;dialogItem=item;const p=item.prescription||{},prev=M.latest(workout.itemFeedback||[],item.id);
    $('feedbackHeading').textContent=prev?'Corrigir feedback':'Seu feedback';$('feedbackExercise').textContent=item.exercise;
    $('feedbackStatus').value=prev?.status||'completed';$('feedbackPain').value=prev?.fingerPain??'';
    $('feedbackRpe').value=prev?.rpe??'';$('feedbackComment').value=prev?.comment||'';$('actualSets').value=prev?.actualSets??'';
    $('actualQuantity').value=(p.strength?prev?.actualRepetitions:prev?.actualQuantity)??'';
    const load=$('actualKilograms');
    $('actualKilogramsField').hidden=!p.strength;load.disabled=!p.strength;
    load.value=prev?.actualKilograms??'';
    $('actualKilogramsLabel').textContent='Carga executada (kg'+(p.strength?.loadBasis==='per_implement'?' por implemento':'')+')';
    $('actualStrengthVolume').hidden=!p.strength;
    const directed=!!p.directed;
    const fields=$('actualSeriesFields');fields.replaceChildren();
    if(directed){
      for(let i=0;i<p.sets;i++){
        const group=el('fieldset','actual-series'),prior=prev?.prescriptionId===p.prescriptionId?prev.actualSeries?.[i]:undefined;
        group.append(el('legend','','Série '+(i+1)));
        const definitions=[['repetitions','Repetições completas',p.directed.path?p.directed.repetitionsPerSet:10000,1]];
        if(p.directed.path)definitions.push(['additionalMoves','Movimentos nas repetições incompletas',p.directed.repetitionsPerSet*(p.directed.path.movesPerRep-1),1]);
        if(p.directed.modality==='isometric')definitions.push(['seconds','Tempo efetivo acumulado (s)',1e9,'any']);
        for(const [key,label,max,step] of definitions){
          const input=el('input');Object.assign(input,{id:'actual-'+i+'-'+key,type:'number',min:0,max,step,value:prior?.[key]??''});
          input.dataset.seriesField=key;
          const caption=el('label','',label);caption.htmlFor=input.id;
          group.append(caption,input);
        }
        fields.append(group);
      }
    }
    $('setsField').hidden=directed||p.sets===''||p.sets===undefined;$('actualSets').disabled=$('setsField').hidden;
    $('quantityField').hidden=directed||!M.units[p.quantityUnit];$('actualQuantity').disabled=$('quantityField').hidden;
    $('actualSetsLabel').textContent=p.volume?.kind==='hand_moves'?'Blocos executados':'Séries executadas';
    $('actualQuantity').max=p.source==='library'?'1000000000000':'100000';
    $('actualQuantity').step=p.source==='library'&&['repetitions','moves'].includes(p.quantityUnit)?'1':'any';
    $('actualQuantity').placeholder=p.feedbackQuantityScope==='total'?'Total executado • opcional':'Por série • opcional';
    $('actualQuantityLabel').textContent=p.feedbackQuantityScope==='total'?`Total executado (${M.units[p.quantityUnit]})`:(p.quantityUnit==='repetitions'?'Repetições por série':`Executado por série (${M.units[p.quantityUnit]||p.quantityUnit})`);
    if(p.strength){
      $('actualQuantityLabel').textContent='Repetições executadas por série'+(p.strength.execution==='unilateral'?' e por lado':'');
      $('actualQuantity').placeholder='';
    }
    $('feedbackHistory').textContent=(workout.itemFeedback||[]).filter(f=>f.itemId===item.id).sort((a,b)=>b.revision-a.revision).map(f=>`Registro ${f.revision}: ${M.statuses[f.status]}`).join(' · ');
    $('feedbackError').textContent='';syncFeedbackStatus();showModal('feedbackDialog');
  }
  function syncFeedbackStatus(){
    const notDone=$('feedbackStatus').value==='not_done',p=dialogItem?.prescription||{};
    $('actualSeriesFields').hidden=!p.directed;
    const message='Em Não realizado, deixe a dose em branco ou informe zero.';
    let inconsistent=false;
    for(const id of ['actualSets','actualQuantity','actualKilograms']){
      const input=$(id),sets=id==='actualSets',load=id==='actualKilograms';
      input.max=notDone||load&&p.strength?.condition==='bodyweight'?'0':
        load?'100000':sets?'1000':p.strength?'10000':p.source==='library'?'1000000000000':'100000';
      if(notDone&&!input.disabled&&input.value!==''&&Number(input.value)!==0)inconsistent=true;
    }
    if(p.strength){
      const sets=$('actualSets'),repetitions=$('actualQuantity');
      const known=sets.value!==''&&repetitions.value!==''&&sets.validity.valid&&repetitions.validity.valid;
      const total=known?Number(sets.value)*Number(repetitions.value)*(p.strength.execution==='unilateral'?2:1):null;
      $('actualStrengthVolume').textContent='Volume executado: '+(total===null?'—':total+' repetições');
    }
    if(p.directed){
      const d=p.directed,maxReps=d.path?d.repetitionsPerSet:10000;
      $('actualSeriesFields').querySelectorAll('fieldset').forEach(group=>{
        const reps=group.querySelector('[data-series-field=repetitions]');
        const moves=group.querySelector('[data-series-field=additionalMoves]');
        const seconds=group.querySelector('[data-series-field=seconds]');
        reps.max=notDone?0:maxReps;
        if(moves)moves.max=notDone?0:Math.max(0,maxReps-Number(reps.value))*(d.path.movesPerRep-1);
        if(seconds)seconds.max=notDone?0:1e9;
        if(notDone&&[reps,moves,seconds].some(input=>input&&Number(input.value)>0))inconsistent=true;
      });
    }
    $('feedbackError').textContent=inconsistent?message:'';
  }
  $('feedbackStatus').addEventListener('change',syncFeedbackStatus);
  $('actualSeriesFields').addEventListener('input',syncFeedbackStatus);
  ['actualSets','actualQuantity','actualKilograms'].forEach(id=>$(id).addEventListener('input',syncFeedbackStatus));
  async function completeExercise(item,control){
    if(!selectionVisible())return;
    await save(item,{status:'completed',completeOnly:true},control);
  }
  async function save(item,values,control){
    if(sending)return;
    const version = sessionVersion;
    sending=true;control.disabled=true;
    if($('demoProfile'))$('demoProfile').disabled=true;
    try{
      const target=workout,record=await write(M.feedbackData(target,item,target.itemFeedback||[],values));
      if (version !== sessionVersion) return;
      target.itemFeedback=(target.itemFeedback||[]).filter(f=>f.id!==record.id).concat(record);
      if(workout===target){
        if(!values.completeOnly)hideModal('feedbackDialog');
        renderExercises();
        if(values.completeOnly){
          const card=[...$('exercises').children].find(element=>element.dataset.itemId===item.id);
          card?.querySelector('.feedback-btn').focus();
        }
      }
      notify(values.completeOnly?'Exercício concluído.':'Feedback salvo.');
    }catch(e){
      if (version !== sessionVersion) return;
      if(values.completeOnly)notify(errorText(e));
      else $('feedbackError').textContent=errorText(e);
    }finally{
      if (version === sessionVersion) {
        sending=false;control.disabled=false;
        if($('demoProfile'))$('demoProfile').disabled=false;
      }
    }
  }
  $('feedbackForm').addEventListener('submit',event=>{
    event.preventDefault();syncFeedbackStatus();
    if(!$('feedbackForm').reportValidity())return;
    const p=dialogItem.prescription||{},values={status:$('feedbackStatus').value,comment:$('feedbackComment').value};
    const numericFields=[['feedbackRpe','rpe'],['feedbackPain','fingerPain'],['actualSets','actualSets'],
      ['actualQuantity',p.strength?'actualRepetitions':'actualQuantity'],['actualKilograms','actualKilograms']];
    numericFields.forEach(([id,key])=>{
      if(!$(id).disabled&&$(id).value!=='')values[key]=Number($(id).value);
    });
    if(p.directed){
      const series=[...$('actualSeriesFields').children].map(group=>Object.fromEntries(
        [...group.querySelectorAll('input')].filter(input=>input.value!=='').map(input=>[input.dataset.seriesField,Number(input.value)])
      ));
      if(series.some(line=>Object.keys(line).length))values.actualSeries=series;
    }
    save(dialogItem,values,$('saveFeedback'));
  });
  ['closeFeedback','cancelFeedback'].forEach(id=>$(id).addEventListener('click',()=>{if(!sending)hideModal('feedbackDialog');}));
  document.addEventListener('keydown',e=>{const modal=$('feedbackDialog');if(modal.hidden)return;if(e.key==='Escape'&&!sending)hideModal(modal.id);if(e.key==='Tab'){const focus=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0].focus();}}});
  $('previousDays').addEventListener('click',()=>$('days').scrollBy({left:-180,behavior:'smooth'}));$('nextDays').addEventListener('click',()=>$('days').scrollBy({left:180,behavior:'smooth'}));
  $('sessionSelect').addEventListener('change',()=>safe(()=>loadWorkout($('sessionSelect').value)));
  $('refreshWorkouts').addEventListener('click',()=>safe(()=>loadWorkouts(selectedDate)));
  $('profileButton').addEventListener('click',()=>notify(session?`Perfil: ${session.id}. ${api.isDemo?'Demonstração com dados fictícios.':'Conta autenticada.'}`:'Entre para acompanhar seu treino.'));
  document.addEventListener('visibilitychange',paintClocks);window.addEventListener('pageshow',paintClocks);setInterval(paintClocks,500);
  async function start(){
    const version = sessionVersion, profile = await api.call('getSession', {});
    if (version !== sessionVersion) return;
    if (profile.role !== 'student') throw Error('STUDENT_ONLY');
    session = profile;
    $('trainingPanel').hidden = false;
    $('authPanel').hidden = true;
    await loadWorkouts(api.initialDate);
  }
  if(api.isDemo){$('demoFooter').textContent='· DEMONSTRAÇÃO';$('demoProfile').addEventListener('change',()=>safe(async()=>{timers.clear();rests.clear();expanded.clear();intentions.clear();api.switchUser($('demoProfile').value);await start();}));$('resetDemo').addEventListener('click',()=>safe(async()=>{api.reset();timers.clear();rests.clear();expanded.clear();intentions.clear();await start();}));await safe(start);}
  else {await api.setupLogin(start,clearTraining);}
})();
