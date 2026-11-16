/* Shared UI for the simulated demo and the authenticated Apps Script adapter. */
(async()=>{
  const M=StudentModel, $=id=>document.getElementById(id), api=window.StudentAPI;
  let workouts=[], workout=null, selectedDate='', session=null, loadVersion=0, dialogItem=null, sending=false, focusBefore=null;
  const timers=new Map(), rests=new Map(), expanded=new Map(), intentions=new Map();
  const icons={chevron:'<path d="m6 9 6 6 6-6"/>',stack:'<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',repeat:'<path d="m17 2 4 4-4 4M3 10V7a1 1 0 0 1 1-1h17M7 22l-4-4 4-4m14 0v3a1 1 0 0 1-1 1H3"/>',clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',intensity:'<path d="M3 15h3v6H3zM10 9h3v12h-3zM17 3h3v18h-3z"/>',chat:'<path d="M4 17a9 9 0 1 1 4 3l-5 1zM8 9h8M8 13h5"/>',play:'<path d="m8 4 12 8-12 8z"/>',pause:'<path d="M5 4h4v16H5zM15 4h4v16h-4z"/>',reset:'<path d="M3 10a9 9 0 1 1 0 5M3 4v6h6"/>',check:'<path d="m4 12 5 5L20 6"/>'};
  function icon(name){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.innerHTML=icons[name]||icons.clock;return s;}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,cls,handler,ic){const b=el('button',cls);if(ic)b.append(icon(ic));b.append(document.createTextNode(text));b.addEventListener('click',handler);return b;}
  let toastTimer;
  function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
  function errorText(e){return ({CONFLICT:'O registro mudou em outra sessão. Atualize o treino antes de corrigir novamente.',BUSY:'O servidor está ocupado. Tente novamente.',UNAUTHENTICATED:'Sua sessão expirou. Entre novamente.',FORBIDDEN:'Esta conta não tem permissão para esta operação.',INVALID_DATA:'Confira os valores e as unidades informadas.'})[e.message]||'Não foi possível carregar ou salvar. Tente novamente.';}
  async function safe(fn){try{await fn();}catch(e){notify(errorText(e));}}
  function timerKey(item){return `${session.id}:${workout.id}:${item.id}`;}
  function selectionVisible(){return workout && !sending;}
  function write(data){const signature=JSON.stringify(data);if(!intentions.has(signature))intentions.set(signature,crypto.randomUUID());return api.call('submitItemFeedback',data,intentions.get(signature)).then(result=>{intentions.delete(signature);return result;});}
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
    options.forEach((w,index)=>{const o=el('option','',`${index+1}. ${w.goal}`);o.value=w.id;$('sessionSelect').append(o);});
    $('sessionSelect').hidden=options.length<2;$('sessionLabel').hidden=options.length<2;
    $('sessionDate').textContent=new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
    if(options.length)await loadWorkout(options[0].id);
  }
  async function loadWorkout(id){
    const version=++loadVersion;workout=null;$('sessionContent').hidden=true;
    const data=await api.call('getWorkout',{workoutId:id});if(version!==loadVersion)return;
    workout=data;$('dayGoal').textContent=data.goal;$('dayInstructions').replaceChildren();
    (data.instructions||[]).forEach(text=>$('dayInstructions').append(el('li','',text)));
    $('noInstructions').hidden=!!data.instructions?.length;$('sessionContent').hidden=false;$('emptyState').hidden=true;renderExercises();
  }
  function metric(label,value,ic){const box=el('div','metric'),head=el('span');head.append(icon(ic),document.createTextNode(label));box.append(head,el('strong','',value));return box;}
  function renderExercises(){
    const items=M.ordered(workout.items),history=workout.itemFeedback||[];
    $('exercises').replaceChildren();const count=items.filter(i=>M.state(history,i.id)==='completed').length;
    $('progressText').textContent=`${count} de ${items.length} concluídos`;$('progressBar').style.width=(items.length?count/items.length*100:0)+'%';
    items.forEach((item,index)=>{
      const p=item.prescription||{},prev=M.latest(history,item.id),key=timerKey(item),state=M.state(history,item.id);
      const card=el('details','exercise');card.dataset.itemId=item.id;card.dataset.status=state;
      const defaultOpen=items.length>1?1:0;
      card.open=expanded.has(key)?expanded.get(key):index===defaultOpen;
      card.addEventListener('toggle',()=>expanded.set(key,card.open));
      const summary=el('summary'),number=el('span','number',state==='completed'?'✓':String(index+1)),title=el('span','exercise-title',item.exercise);
      if(prev)title.append(el('span','status-label',M.statuses[prev.status]));
      const arrow=icon('chevron');arrow.classList.add('chevron');summary.append(number,title,el('span','expand-label','Ver detalhes'),arrow);card.append(summary);
      const body=el('div','exercise-body'),metrics=el('div','metrics');
      metrics.append(metric('Séries',p.sets!==''&&p.sets!==undefined?`${p.sets} séries`:'Não informadas','stack'),metric(p.quantityUnit==='repetitions'?'Repetições':'Dose / duração',M.quantity(p),'repeat'),metric('Descanso',p.restSeconds!==''&&p.restSeconds!==undefined?(p.restSeconds>=60&&p.restSeconds%60===0?`${p.restSeconds/60} min`:`${p.restSeconds} s`):'Não informado','clock'),metric('Intensidade',M.intensity(p),'intensity'));body.append(metrics);
      const note=el('div','technical-note'),noteText=el('div');noteText.append(el('strong','','Observações'),el('p','',item.notes||'Nenhuma observação técnica adicional.'));note.append(icon('chat'),noteText);body.append(note);
      const timer=el('div','exercise-timer'),clock=el('div','clock-face');clock.append(icon('clock'));const clockText=el('span','','00:00');clockText.dataset.elapsed=key;clock.setAttribute('aria-label','Tempo decorrido do exercício');clock.append(clockText);
      timer.append(clock,button('Iniciar','timer-btn primary',()=>{timers.set(key,M.start(timers.get(key),Date.now()));paintClocks();},'play'),button('Pausar','timer-btn',()=>{timers.set(key,M.pause(timers.get(key),Date.now()));paintClocks();},'pause'),button('Zerar','timer-btn',()=>{timers.set(key,M.zero());paintClocks();},'reset'));body.append(timer);
      if(p.restSeconds!==undefined&&p.restSeconds!==''&&p.restSeconds>0){
        const rest=el('div','rest-row');rest.dataset.restRow=key;rest.append(el('span','','Descanso regressivo'));const restText=el('span','rest-value',M.formatTime(p.restSeconds*1000));restText.dataset.rest=key;restText.dataset.seconds=p.restSeconds;rest.append(restText);
        rest.append(button('Iniciar','',()=>{let t=rests.get(key);if(t?.endsAt!=null&&t.endsAt>Date.now())return;if(t&&M.remaining(t,Date.now())===0)t=undefined;rests.set(key,M.restStart(t,p.restSeconds,Date.now()));paintClocks();}),button('Pausar','',()=>{const t=rests.get(key)||{remaining:p.restSeconds*1000,endsAt:null};rests.set(key,M.restPause(t,Date.now()));paintClocks();}),button('Zerar','',()=>{rests.set(key,{remaining:p.restSeconds*1000,endsAt:null});paintClocks();}));body.append(rest);
      }
      const actions=el('div','exercise-actions');actions.append(button(prev?'Editar feedback':'Dar feedback','feedback-btn',()=>openFeedback(item),'chat'),button(state==='completed'?'Concluído':'Concluir exercício','complete-btn',()=>openComplete(item),'check'));body.append(actions);
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
    $('feedbackStatus').value=prev?.status||'completed';$('feedbackPain').value=prev?.fingerPain??0;
    $('feedbackRpe').value=prev?.rpe??'';$('feedbackComment').value=prev?.comment||'';$('actualSets').value=prev?.actualSets??'';$('actualQuantity').value=prev?.actualQuantity??'';
    $('rpeField').hidden=!p.rpeApplicable;$('feedbackRpe').disabled=!p.rpeApplicable;
    $('setsField').hidden=p.sets===''||p.sets===undefined;$('actualSets').disabled=$('setsField').hidden;
    $('quantityField').hidden=!M.units[p.quantityUnit];$('actualQuantity').disabled=$('quantityField').hidden;
    $('actualQuantityLabel').textContent=(p.quantityUnit==='repetitions'?'Repetições por série':`Executado por série (${M.units[p.quantityUnit]||p.quantityUnit})`);
    $('feedbackHistory').textContent=(workout.itemFeedback||[]).filter(f=>f.itemId===item.id).sort((a,b)=>b.revision-a.revision).map(f=>`Registro ${f.revision}: ${M.statuses[f.status]}`).join(' · ');
    $('feedbackError').textContent='';showModal('feedbackDialog');
  }
  function openComplete(item){if(!selectionVisible())return;dialogItem=item;$('confirmExercise').textContent=item.exercise;$('confirmError').textContent='';showModal('confirmDialog');}
  async function save(values,modal,errorId){
    if(sending)return;sending=true;document.querySelectorAll('.overlay button').forEach(b=>b.disabled=true);$('demoProfile')&&($('demoProfile').disabled=true);
    try{
      const target=workout,record=await write(M.feedbackData(workout,dialogItem,workout.itemFeedback||[],values));
      target.itemFeedback=(target.itemFeedback||[]).filter(f=>f.id!==record.id).concat(record);
      hideModal(modal);renderExercises();notify('Registro salvo. Apenas este exercício foi atualizado.');
    }catch(e){$(errorId).textContent=errorText(e);}finally{sending=false;document.querySelectorAll('.overlay button').forEach(b=>b.disabled=false);$('demoProfile')&&($('demoProfile').disabled=false);}
  }
  $('feedbackForm').addEventListener('submit',e=>{e.preventDefault();if(!$('feedbackForm').reportValidity())return;const values={status:$('feedbackStatus').value,fingerPain:Number($('feedbackPain').value),comment:$('feedbackComment').value};[['feedbackRpe','rpe'],['actualSets','actualSets'],['actualQuantity','actualQuantity']].forEach(([id,key])=>{if(!$(id).disabled&&$(id).value!=='')values[key]=Number($(id).value);});save(values,'feedbackDialog','feedbackError');});
  $('confirmComplete').addEventListener('click',()=>{const prev=M.latest(workout.itemFeedback||[],dialogItem.id);const values={status:'completed',fingerPain:prev?.fingerPain??0,comment:prev?.comment||''};['rpe','actualSets','actualQuantity'].forEach(k=>{if(prev&&prev[k]!==''&&prev[k]!==undefined)values[k]=prev[k];});save(values,'confirmDialog','confirmError');});
  ['closeFeedback','cancelFeedback'].forEach(id=>$(id).addEventListener('click',()=>{if(!sending)hideModal('feedbackDialog');}));$('cancelComplete').addEventListener('click',()=>{if(!sending)hideModal('confirmDialog');});
  document.addEventListener('keydown',e=>{const modal=['feedbackDialog','confirmDialog'].map($).find(n=>!n.hidden);if(!modal)return;if(e.key==='Escape'&&!sending)hideModal(modal.id);if(e.key==='Tab'){const focus=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0].focus();}}});
  $('previousDays').addEventListener('click',()=>$('days').scrollBy({left:-180,behavior:'smooth'}));$('nextDays').addEventListener('click',()=>$('days').scrollBy({left:180,behavior:'smooth'}));
  $('sessionSelect').addEventListener('change',()=>safe(()=>loadWorkout($('sessionSelect').value)));
  $('refreshWorkouts').addEventListener('click',()=>safe(()=>loadWorkouts(selectedDate)));
  $('profileButton').addEventListener('click',()=>notify(session?`Perfil: ${session.id}. ${api.isDemo?'Demonstração com dados fictícios.':'Conta autenticada.'}`:'Entre para acompanhar seu treino.'));
  document.addEventListener('visibilitychange',paintClocks);window.addEventListener('pageshow',paintClocks);setInterval(paintClocks,500);
  async function start(){session=await api.call('getSession',{});if(session.role!=='student')throw Error('STUDENT_ONLY');$('trainingPanel').hidden=false;$('authPanel').hidden=true;await loadWorkouts(api.initialDate);}
  if(api.isDemo){$('demoFooter').textContent='· DEMONSTRAÇÃO';$('demoProfile').addEventListener('change',()=>safe(async()=>{timers.clear();rests.clear();expanded.clear();intentions.clear();api.switchUser($('demoProfile').value);await start();}));$('resetDemo').addEventListener('click',()=>safe(async()=>{api.reset();timers.clear();rests.clear();expanded.clear();intentions.clear();await start();}));await safe(start);}
  else {await api.setupLogin(start,notify);}
})();
