/* DOM and Google RPC substitutes exercise event handlers; no browser rendering claim. */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const crypto=require('node:crypto');const {fixture}=require('./helpers/gas.cjs');
const html=fs.readFileSync('apps-script/Index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function dom(source=html){const elements=new Map(),all=[];
 class Element{
  constructor(tag,id=''){this.tagName=tag.toUpperCase();this.id=id;this.value='';this.children=[];this.events={};this.disabled=false;this.hidden=false;this.textContent='';const classes=new Set();this.classList={toggle(c,force){const on=force??!classes.has(c);on?classes.add(c):classes.delete(c);return on;},add(c){classes.add(c);},remove(c){classes.delete(c);},contains(c){return classes.has(c);}};all.push(this);if(id)elements.set(id,this);}
  get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;}
  appendChild(n){return this.insertBefore(n,null);}
  insertBefore(n,before){if(n.parentNode)n.parentNode.children.splice(n.parentNode.children.indexOf(n),1);const index=before?this.children.indexOf(before):this.children.length;assert.ok(index>=0);this.children.splice(index,0,n);n.parentNode=this;if(this.tagName==='SELECT'&&this.children.length===1)this.value=n.value;return n;}
  append(...nodes){nodes.forEach(n=>this.appendChild(n));}
  replaceChildren(...nodes){this.children.forEach(n=>n.parentNode=null);this.children=[];if(this.tagName==='SELECT')this.value='';this.append(...nodes);}
  focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  addEventListener(name,fn){this.events[name]=fn;}removeAttribute(name){delete this[name];}setAttribute(name,value){this[name]=value;}
 }
 const stack=[],voids=new Set(['input','meta','link','br','hr','img']);
 for(const m of source.split('<script>')[0].replace(/<style>[\s\S]*?<\/style>/g,'').replace(/<!--[\s\S]*?-->/g,'').matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/g)){
  if(m[1]){assert.equal(stack.pop()?.tagName,m[2].toUpperCase(),'balanced HTML '+m[2]);continue;}
  const attrs=m[3],id=attrs.match(/\bid="([^"]+)"/)?.[1]||'',e=new Element(m[2],id),value=attrs.match(/\bvalue="([^"]*)"/);if(value)e.value=value[1];e.hidden=/\bhidden\b/.test(attrs);for(const c of (attrs.match(/\bclass="([^"]*)"/)?.[1]||'').split(/\s+/).filter(Boolean))e.classList.add(c);
  if(stack.length)stack.at(-1).appendChild(e);if(!voids.has(m[2])&&!attrs.trim().endsWith('/'))stack.push(e);
 }
 for(const m of source.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const first=m[2].match(/<option([^>]*)>([^<]*)<\/option>/);if(first)elements.get(m[1]).value=first[1].match(/value="([^"]*)"/)?.[1]??first[2];}
 const descendant=(e,id)=>{for(let p=e.parentNode;p;p=p.parentNode)if(p.id===id)return true;return false;};
 const document={getElementById:id=>{assert.ok(elements.has(id),'missing DOM id '+id);return elements.get(id);},createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),createComment:text=>({textContent:text}),querySelectorAll:selector=>all.filter(e=>selector.split(',').some(part=>{const scope=part.match(/#([\w-]+)/)?.[1],tag=part.trim().match(/([a-z]+)$/)?.[1];return e.tagName===tag?.toUpperCase()&&(!scope||descendant(e,scope));}))};
 return {document,elements,all,descendant};
}
async function boot(options={}){
 const f=options.backend||fixture();if(!options.backend){for(const name of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary'])vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context);f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();f.context.libraryApi({action:'recordAssessment',data:{studentId:'s1',exerciseId:'exercise-bench',indicatorId:'int-1rm',value:100,unitId:'unit-kg',protocol:'Teste fictício',referenceDefinition:'Referência fictícia',assessedOn:'2026-11-01',validUntil:'2026-12-31'},requestId:'assessment',sessionToken:f.context.issueSession_({email:'coach@example.invalid',sub:'12345'})});}
 const d=dom(options.source);const requests=[];let lose=!!options.loseSaveResponse;
 class Runner{constructor(success,failure){this.success=success;this.failure=failure;}withSuccessHandler(fn){return new Runner(fn,this.failure);}withFailureHandler(fn){return new Runner(this.success,fn);}send(method,r){requests.push(JSON.parse(JSON.stringify({method,request:r})));let result;if(method==='api'&&r.action==='beginLogin')result={ok:true,data:{authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth',transaction:'fake',proof:'fake'}};else if(method==='api'&&r.action==='finishLogin')result={ok:true,data:{sessionToken:f.context.issueSession_({email:options.student?'one@example.invalid':'coach@example.invalid',sub:'12345'})}};else result=f.context[method](r);if(lose&&method==='libraryApi'&&r.action==='saveCoachPrescription'&&result.ok){lose=false;this.failure();}else this.success(result);}api(r){this.send('api',r);}libraryApi(r){this.send('libraryApi',r);}}
 const context=vm.createContext({document:d.document,google:{script:{run:new Runner()}},crypto:{randomUUID:()=>crypto.randomUUID()},URL});await vm.runInContext(options.source?options.source.match(/<script>([\s\S]*?)<\/script>/)[1]:script,context);
 const click=async id=>{const e=d.elements.get(id);assert.equal(e.disabled,false,'button disabled '+id);await e.events.click();};
 const change=async(id,value)=>{d.elements.get(id).value=value;await d.elements.get(id).events.change();};
 await click('btnLogin');await click('btnFinishLogin');
 return {f,...d,context,requests,click,change,set(id,value){d.elements.get(id).value=value;}};
}
async function fill(ui){ui.set('coachData','2026-11-18');ui.set('coachObjetivoDia','Força');ui.set('coachInstructions','Aquecer\nRespeitar intervalos');await ui.click('btnCriarTreino');await ui.change('itemExercicio','exercise-bench');ui.set('libraryMethod','method-max-effort');ui.set('libraryAssessment',ui.f.tables.AVALIACOES[1][0]);ui.set('itemIntensVal','85');ui.set('librarySets','5');ui.set('itemQtd','3');ui.set('itemMin','5');ui.set('itemNotas','Técnica preservada');}
test('trainer UI loads library and preserves session fields through select/prescribe/save/read',async()=>{
 const ui=await boot();assert.equal(ui.elements.get('itemExercicio').children.length,11);await fill(ui);assert.match(ui.elements.get('libraryDescription').textContent,/força/);assert.equal(ui.elements.get('itemMetrica').value,'Reps');assert.equal(ui.elements.get('assessmentField').hidden,false);
 await ui.click('btnAddItem');assert.equal(ui.f.tables.Workouts.length,2);assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.f.tables.PRESCRICOES.length,2);assert.equal(ui.f.tables.PRESCRICAO_SERIES.length,6);assert.equal(ui.f.tables.WorkoutGuidance.length,2);assert.match(ui.elements.get('savedPrescription').textContent,/volume 15 repetições/);assert.equal(ui.elements.get('pendingCoachPanel').hidden,true);
});
test('UI retry after a lost successful response reuses the same intent and does not duplicate',async()=>{
 const ui=await boot({loseSaveResponse:true});await fill(ui);await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.elements.get('itemQtd').disabled,true);assert.equal(ui.elements.get('btnAddItem').textContent,'Retomar gravação pendente');await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.f.tables.PRESCRICOES.length,2);assert.equal(ui.f.tables.PRESCRICAO_SERIES.length,6);assert.doesNotMatch(ui.elements.get('librarySaveHint').textContent,/TRANSPORT_ERROR/);
});
test('UI reload discovers incomplete server intent and resumes without creating a second item',async()=>{
 const ui=await boot();await fill(ui);ui.f.fail('PRESCRICOES');await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.f.tables.PRESCRICOES.length,1);
 const next=await boot({backend:ui.f});const buttons=next.elements.get('pendingCoachSaves').children;assert.equal(buttons.length,1);await buttons[0].events.click();assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.f.tables.PRESCRICOES.length,2);assert.equal(ui.f.tables.PRESCRICAO_SERIES.length,6);
});

// Only the audited executed-dose display is allowed to differ from layout snapshots.
const withoutExecutedFields=source=>source.replace(/function coachExecutedFeedback\(f\)\{[\s\S]*?\n\}\n/,'').replace('...coachExecutedFeedback(f),','');
const baselineHtml=require('node:child_process').execFileSync('git',['show','737a4afda80702fe15dcc377c36ef6ca438e30eb:apps-script/Index.html'],{encoding:'utf8'});
test('layout preserves original field IDs, labels, handlers and request payloads',async()=>{
 const before=await boot({source:baselineHtml}),after=await boot();
 for(const [id,element] of before.elements){assert.ok(after.elements.has(id),id);assert.deepEqual(Object.keys(after.elements.get(id).events),Object.keys(element.events),'events '+id);}
 const labels=source=>[...source.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m=>m[1]).sort();assert.deepEqual(labels(html),labels(baselineHtml));
 for(const ui of [before,after]){await fill(ui);await ui.click('btnAddItem');}
 const saves=ui=>ui.requests.filter(r=>['createWorkout','saveCoachPrescription'].includes(r.request.action)).map(r=>({method:r.method,action:r.request.action,data:{...r.request.data,...(r.request.action==='saveCoachPrescription'?{workoutId:'SESSION',intensity:{...r.request.data.intensity,assessmentId:'ASSESSMENT'}}:{})}}));
 assert.deepEqual(saves(after),saves(before));
});
test('coach-only mounting preserves functional ancestry and restores shared consultation on logout/student login',async()=>{
 const ui=await boot();assert.ok(ui.elements.get('appPanel').classList.contains('coach-layout-active'));
 assert.equal(ui.elements.get('sharedWorkoutDetails').parentNode.id,'coachDetailsSlot');assert.equal(ui.elements.get('sharedWorkoutFeedback').parentNode.id,'coachFeedbackSlot');
 for(const id of ['coachAluno','coachData','coachTreinoId','itemExercicio','itemQtd','libraryAssessment','btnAddItem','correctCoachDraft'])assert.ok(ui.descendant(ui.elements.get(id),'panelCoach'),id);
 await ui.click('btnLogout');assert.equal(ui.elements.get('appPanel').classList.contains('coach-layout-active'),false);assert.ok(ui.descendant(ui.elements.get('previewTreinoAluno'),'panelStudent'));assert.ok(ui.descendant(ui.elements.get('listaRetornos'),'panelStudent'));
 await ui.click('btnLogin');await ui.click('btnFinishLogin');assert.equal(ui.elements.get('sharedWorkoutDetails').parentNode.id,'coachDetailsSlot');
 const student=await boot({student:true});assert.equal(student.elements.get('appPanel').classList.contains('coach-layout-active'),false);assert.ok(student.descendant(student.elements.get('previewTreinoAluno'),'panelStudent'));assert.ok(student.elements.get('panelCoach').classList.contains('hidden'));assert.equal(student.requests.some(r=>r.method==='libraryApi'),false);
});
test('conditional fields and session consultation remain functional after rearranging controls',async()=>{
 const ui=await boot();await fill(ui);await ui.click('btnAddItem');assert.ok(ui.elements.get('previewTreinoAluno').children.some(e=>e.children.some(child=>/Supino/.test(child.textContent))));assert.match(ui.elements.get('listaRetornos').children[0].textContent,/Nenhum retorno/);
 await ui.change('itemExercicio','exercise-boulder');assert.equal(ui.elements.get('gradeField').hidden,false);assert.equal(ui.elements.get('assessmentField').hidden,true);assert.equal(ui.elements.get('blocksField').hidden,false);assert.equal(ui.elements.get('setsField').hidden,true);
 await ui.change('itemExercicio','exercise-finger-iso');assert.equal(ui.elements.get('suspensionsField').hidden,false);assert.equal(ui.elements.get('setsField').hidden,false);assert.equal(ui.elements.get('blocksField').hidden,true);assert.equal(ui.elements.get('assessmentField').hidden,false);
});

const fillNext=async ui=>{await ui.change('itemExercicio','exercise-bench');ui.set('libraryMethod','method-max-effort');ui.set('libraryAssessment',ui.f.tables.AVALIACOES[1][0]);ui.set('itemIntensVal','85');ui.set('librarySets','5');ui.set('itemQtd','3');ui.set('itemMin','5');};
const exerciseHeadings=ui=>ui.elements.get('previewTreinoAluno').children.filter(e=>e.tagName==='ARTICLE').map(e=>e.children[0].textContent);
test('three progressive saves keep one session, render sequential items, and reset only confirmed drafts',async()=>{
 const ui=await boot();await fill(ui);const workoutId=ui.elements.get('coachTreinoId').value,student=ui.elements.get('coachAluno').value;
 assert.ok(ui.elements.get('coachPrescriptionTitle').focused);assert.ok(ui.elements.get('coachPrescription').scrolled);
 for(let n=1;n<=3;n++){if(n>1)await fillNext(ui);await ui.click('btnAddItem');assert.equal(ui.elements.get('coachTreinoId').value,workoutId);assert.equal(ui.elements.get('coachAluno').value,student);assert.equal(ui.elements.get('itemExercicio').value,'');assert.equal(ui.elements.get('itemMin').value,'');assert.equal(ui.elements.get('itemNotas').value,'');assert.match(ui.elements.get('coachNextExercise').textContent,new RegExp('Próximo: Exercício '+(n+1)));}
 assert.equal(ui.f.tables.Workouts.length,2);assert.equal(ui.f.tables.Items.length,4);assert.deepEqual(exerciseHeadings(ui),['Exercício 1 — Supino','Exercício 2 — Supino','Exercício 3 — Supino']);
 const before=JSON.stringify(ui.f.tables),writes=ui.requests.filter(r=>r.request.action==='saveCoachPrescription').length;
 await ui.click('btnReviewSession');assert.match(ui.elements.get('coachFinishStatus').textContent,/3 exercício/);assert.equal(ui.elements.get('btnConfirmSession').hidden,false);
 await ui.click('btnConfirmSession');assert.match(ui.elements.get('coachFinishStatus').textContent,/Montagem concluída visualmente/);assert.equal(JSON.stringify(ui.f.tables),before);assert.equal(ui.requests.filter(r=>r.request.action==='saveCoachPrescription').length,writes);
});
test('finalization warns about dirty drafts and pending writes without clearing parameters or resending items',async()=>{
 const ui=await boot();await fill(ui);ui.f.fail('PRESCRICOES');await ui.click('btnAddItem');
 for(const [id,value] of [['itemExercicio','exercise-bench'],['itemIntensVal','85'],['itemQtd','3'],['itemNotas','Técnica preservada']])assert.equal(ui.elements.get(id).value,value);
 await ui.click('btnReviewSession');assert.match(ui.elements.get('coachFinishStatus').textContent,/gravação pendente/);assert.equal(ui.elements.get('btnConfirmSession').hidden,true);
 await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);await fillNext(ui);ui.set('itemNotas','Ainda não salvo');
 await ui.click('btnReviewSession');assert.match(ui.elements.get('coachFinishStatus').textContent,/parâmetros ainda não salvos/);assert.equal(ui.elements.get('itemNotas').value,'Ainda não salvo');assert.equal(ui.elements.get('btnConfirmSession').hidden,true);
});
test('review confirmation rechecks draft changes and selector contrast is coach scoped',async()=>{
 const ui=await boot();await fill(ui);await ui.click('btnAddItem');await ui.click('btnReviewSession');ui.set('itemNotas','Alteração após revisão');
 await ui.click('btnConfirmSession');assert.match(ui.elements.get('coachFinishStatus').textContent,/parâmetros ainda não salvos/);assert.equal(ui.f.tables.Items.length,2);
 assert.match(html,/#panelCoach select option,#panelCoach select optgroup\{background:#101a33;color:#eaf0ff\}/);assert.match(html,/#panelCoach select option:checked\{background:#123e78;color:#ffffff\}/);assert.match(html,/#panelCoach select:disabled,#panelCoach select option:disabled\{background:#182438;color:#b7c5df;opacity:1\}/);
});

test('coach tabs default to build and preserve the same unsaved prescription nodes and RPC state',async()=>{
 const ui=await boot();assert.equal(ui.elements.get('coachBuildPanel').hidden,false);assert.equal(ui.elements.get('coachTabBuild')['aria-selected'],'true');
 await fill(ui);const draft=['coachAluno','coachTreinoId','itemExercicio','libraryMethod','libraryAssessment','itemIntensVal','librarySets','itemQtd','itemMin','itemNotas'].map(id=>({id,node:ui.elements.get(id),value:ui.elements.get(id).value}));
 const calls=ui.requests.length,tables=JSON.stringify(ui.f.tables);
 for(const [button,panel,title] of [['coachTabStudents','coachStudentsPanel','Alunos'],['coachTabLibrary','coachLibraryPanel','Biblioteca']]){
  await ui.click(button);assert.equal(ui.elements.get(panel).hidden,false);assert.equal(ui.elements.get('coachBuildPanel').hidden,true);assert.equal(ui.elements.get(button)['aria-selected'],'true');assert.ok(ui.descendant(ui.elements.get(panel==='coachLibraryPanel'?'libraryExercisesTitle':'studentsRegistrationTitle'),panel));
 }
 await ui.click('coachTabBuild');for(const f of draft){assert.equal(ui.elements.get(f.id),f.node);assert.equal(ui.elements.get(f.id).value,f.value);}
 assert.equal(ui.requests.length,calls);assert.equal(JSON.stringify(ui.f.tables),tables);await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);
 assert.doesNotMatch(html,/Atalhos para os controles desta página|href="#coach(?:Session|LibrarySection|Prescription)"/);
});
test('tabs preserve pending intents and review state, support keyboard navigation, and reset only the selected tab on login',async()=>{
 const ui=await boot({loseSaveResponse:true});await fill(ui);await ui.click('btnAddItem');const first=ui.requests.find(r=>r.request.action==='saveCoachPrescription').request;
 await ui.click('coachTabLibrary');await ui.click('coachTabStudents');await ui.click('coachTabBuild');assert.equal(ui.elements.get('itemQtd').value,'3');assert.equal(ui.elements.get('itemQtd').disabled,true);assert.equal(ui.elements.get('btnAddItem').textContent,'Retomar gravação pendente');
 await ui.click('btnAddItem');const writes=ui.requests.filter(r=>r.request.action==='saveCoachPrescription');assert.equal(writes.length,2);assert.deepEqual(writes[1].request,first);assert.equal(ui.f.tables.Items.length,2);
 await ui.click('btnReviewSession');assert.equal(ui.elements.get('btnConfirmSession').hidden,false);const review=ui.elements.get('coachFinishStatus').textContent;await ui.click('coachTabStudents');await ui.click('coachTabBuild');assert.equal(ui.elements.get('coachFinishStatus').textContent,review);await ui.click('btnConfirmSession');assert.match(ui.elements.get('coachFinishStatus').textContent,/Montagem concluída visualmente/);
 let prevented=false;ui.elements.get('coachTabBuild').events.keydown({key:'Home',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(ui.elements.get('coachStudentsPanel').hidden,false);assert.equal(ui.elements.get('coachTabStudents').focused,true);
 await ui.click('btnLogout');await ui.click('btnLogin');await ui.click('btnFinishLogin');assert.equal(ui.elements.get('coachBuildPanel').hidden,false);assert.equal(ui.elements.get('coachStudentsPanel').hidden,true);assert.equal(ui.elements.get('coachLibraryPanel').hidden,true);
});


test('student overview is static with four cards; build markup and prescription RPC/model stay byte-identical to navigation baseline',()=>{
 const baseline=require('node:child_process').execFileSync('git',['show','0faa4f2714546d06697789cb1288594b9941ce03:apps-script/Index.html'],{encoding:'utf8'});
 assert.equal(withoutExecutedFields(script.split('// UI integration')[0]),baseline.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI integration')[0]);
 const build=source=>source.slice(source.indexOf('<section id="coachBuildPanel"'),source.indexOf('<!-- ALUNO -->'));
 // Build form validation changed intentionally; unchanged RPC/model contracts are checked above.
 const overview=html.slice(html.indexOf('<section id="coachStudentsPanel"'),html.indexOf('<section id="coachLibraryPanel"'));
 assert.equal((overview.match(/class="card students-card"/g)||[]).length,4);assert.doesNotMatch(overview,/<(?:input|select|textarea|button|a)\b|contenteditable=/);
 for(const title of ['Cadastro e controle financeiro','Avaliação física','Diretrizes individuais de treino','Últimas quatro sessões'])assert.ok(overview.includes(title));
 assert.equal((overview.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>/g)||[]).length,4);
 assert.match(overview,/Exemplo fictício, sem vínculo com as sessões cadastradas/);assert.match(overview,/role="img"/);assert.match(overview,/students-status-green/);assert.match(overview,/students-status-yellow/);assert.match(overview,/students-status-red/);
});


test('library overview adds four presentation-only cards while student markup and prescription RPC/model remain unchanged',()=>{
 const baseline=require('node:child_process').execFileSync('git',['show','a2aa41bf495bbc7eab2ca685f183c0f1640ebd68:apps-script/Index.html'],{encoding:'utf8'});
 assert.equal(withoutExecutedFields(script.split('// UI integration')[0]),baseline.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI integration')[0]);
 const students=source=>source.slice(source.indexOf('<section id="coachStudentsPanel"'),source.indexOf('<section id="coachLibraryPanel"'));
 const build=source=>source.slice(source.indexOf('<section id="coachBuildPanel"'),source.indexOf('<!-- ALUNO -->'));
 assert.equal(students(html),students(baseline));// Build form validation changed intentionally; unchanged RPC/model contracts are checked above.
 const library=html.slice(html.indexOf('<section id="coachLibraryPanel"'),html.indexOf('<section id="coachBuildPanel"'));
 assert.equal((library.match(/class="card library-overview-card"/g)||[]).length,4);
 assert.doesNotMatch(library,/<(?:input|select|textarea|button|a|form)\b|contenteditable=|\bon(?:click|input|change)=/);
 for(const text of ['Exercícios','Escalada em via','Boulder','Campus board','Fingerboard','Exercícios complementares','Capacidades físicas','Força máxima','Força explosiva','Resistência muscular','Flexibilidade','Coordenação','Métodos de treinamento','Protocolos de treinamento','Vinculação entre exercícios e métodos','Indicadores e unidades','Intensidade','Volume','Grau de dificuldade','Carga absoluta','Carga relativa','Percepção subjetiva de esforço','Movimentos efetivos de mão','Repetições','Tempo acumulado de suspensão','EXERCICIOS','CAPACIDADES','EXERCICIO_CAPACIDADES','METODOS','EXERCICIO_METODOS','INDICADORES','UNIDADES'])assert.ok(library.includes(text),text);
 assert.match(library,/Campo de busca ilustrativo, sem interação/);assert.match(library,/Nenhum dado é consultado ou alterado/);
});


test('missing method reports inline, focuses/highlights Method and does not create a write intent or update count',async()=>{
 const ui=await boot();await fill(ui);ui.set('libraryMethod','');const calls=ui.requests.length,tables=JSON.stringify(ui.f.tables),count=ui.elements.get('coachNextExercise').textContent;
 await ui.click('btnAddItem');assert.match(ui.elements.get('librarySaveHint').textContent,/preenchimento.*método/i);assert.equal(ui.elements.get('librarySaveHint')['data-kind'],'validation');assert.equal(ui.elements.get('libraryMethod').focused,true);assert.equal(ui.elements.get('libraryMethod')['aria-invalid'],'true');assert.equal(ui.elements.get('libraryMethod').disabled,false);assert.equal(ui.elements.get('coachNextExercise').textContent,count);assert.equal(ui.requests.length,calls);assert.equal(JSON.stringify(ui.f.tables),tables);assert.equal(ui.elements.get('btnAddItem').textContent,'Salvar e adicionar próximo exercício');
});
test('relative intensity requires the loaded assessment and percent with targeted field feedback before RPC',async()=>{
 const ui=await boot();await fill(ui);const calls=ui.requests.length;ui.set('libraryAssessment','');await ui.click('btnAddItem');assert.match(ui.elements.get('librarySaveHint').textContent,/avaliação individual válida/);assert.equal(ui.elements.get('libraryAssessment').focused,true);
 ui.set('libraryAssessment',ui.f.tables.AVALIACOES[1][0]);ui.set('itemIntensVal','');await ui.click('btnAddItem');assert.match(ui.elements.get('librarySaveHint').textContent,/percentual da referência/);assert.equal(ui.elements.get('itemIntensVal')['aria-invalid'],'true');assert.equal(ui.elements.get('libraryAssessment')['aria-invalid'],undefined);assert.equal(ui.requests.length,calls);
 ui.set('itemIntensVal','85');await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.elements.get('librarySaveHint')['data-kind'],'success');assert.match(ui.elements.get('coachNextExercise').textContent,/Próximo: Exercício 2/);
});
test('ordinal and campus exercises do not require assessment or percentage',async()=>{
 const ui=await boot();await fill(ui);ui.set('libraryAssessment','');await ui.click('btnAddItem');assert.equal(ui.elements.get('librarySaveHint')['data-kind'],'validation');
 await ui.change('itemExercicio','exercise-boulder');assert.equal(ui.elements.get('librarySaveHint')['data-kind'],'info');ui.set('libraryMethod','method-circuit');ui.set('itemIntensVal','V4');ui.set('gradeScale','V-scale');ui.set('libraryBlocks','4');ui.set('libraryBouts','4');ui.set('itemQtd','5');await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);
 await ui.change('itemExercicio','exercise-campus');ui.set('libraryMethod','method-repetition');ui.set('itemIntensVal','Referência qualitativa');ui.set('libraryBlocks','1');ui.set('libraryBouts','1');ui.set('itemQtd','5');ui.set('itemMin','5');await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,3);assert.equal(ui.elements.get('libraryAssessment')['aria-required'],'false');
});
test('volume and minutes errors focus their own fields without requests; communication failure is not a fill error',async()=>{
 const ui=await boot({loseSaveResponse:true});await fill(ui);ui.set('librarySets','');const calls=ui.requests.length;await ui.click('btnAddItem');assert.equal(ui.elements.get('librarySets').focused,true);assert.equal(ui.requests.length,calls);
 ui.set('librarySets','5');ui.set('itemMin','');await ui.click('btnAddItem');assert.equal(ui.elements.get('itemMin').focused,true);assert.equal(ui.requests.length,calls);
 ui.set('itemMin','5');const count=ui.elements.get('coachNextExercise').textContent;await ui.click('btnAddItem');assert.equal(ui.elements.get('librarySaveHint')['data-kind'],'error');assert.match(ui.elements.get('librarySaveHint').textContent,/Falha de comunicação/);assert.equal(ui.elements.get('coachNextExercise').textContent,count);assert.equal(ui.elements.get('itemQtd').value,'3');await ui.click('btnAddItem');assert.equal(ui.f.tables.Items.length,2);assert.equal(ui.elements.get('librarySaveHint')['data-kind'],'success');assert.match(ui.elements.get('coachNextExercise').textContent,/Próximo: Exercício 2/);
});
