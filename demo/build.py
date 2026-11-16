"""Build an isolated single-file demo from the maintained Apps Script UI/backend."""
from pathlib import Path
import re
root = Path(__file__).resolve().parent.parent
source = (root / 'apps-script/Index.html').read_text()
backend = (root / 'apps-script/Backend.gs').read_text().split('// Serves the isolated integration UI')[0]
backend += '\n' + (root / 'apps-script/Student.gs').read_text()
backend = backend.replace("['beginLogin', 'finishLogin', 'logout', 'getSession'", "['getSession'")
backend = re.sub(r"    if \(request.action === 'beginLogin'\).*?    var identity", '    var identity', backend, flags=re.S)
fixture = (root / 'apps-script/Homologation.gs').read_text().split('function homologationFixture_()')[1]
backend_js = '''function createDemoBackend() {
  let active = 'hom-coach', sequence = 0;
  let tables = {};
  const profiles = [{id:'hom-coach',label:'Treinador Demo',role:'coach'}, {id:'hom-student-a',label:'Aluna A Demo',role:'student'}, {id:'hom-student-b',label:'Aluno B Demo',role:'student'}, {id:'hom-student-empty',label:'Sem treinos Demo',role:'student'}];
  const PropertiesService = {getScriptProperties:()=>({getProperty:()=> 'demo-only'})};
  const SpreadsheetApp = {openById:()=>({getSheetByName: name=>sheet(name)}), flush() {}};
  const Utilities = {getUuid:()=> 'demo-'+(++sequence)};
  const LockService = {getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock(){}})};
  function sessionIdentity_() { return {email:tables.Users.find(u=>u[0]===active)[1]}; }
  function sheet(name) { return tables[name] && {
    getLastRow:()=>tables[name].length, getLastColumn:()=>tables[name][0].length,
    getRange:(r,c,n,w)=>({getValues:()=>tables[name].slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w))}),
    appendRow:row=>tables[name].push([...row])
  }; }
''' + backend + '\nfunction homologationFixture_()' + fixture + '''
  function reset() {
    sequence=0;
    tables=Object.fromEntries(Object.entries(SCHEMA_).map(([name,headers])=>[name,[[...headers]]]));
    const seed=homologationFixture_();
    seed.Users.push({id:'hom-student-empty',email:'empty@example.invalid',role:'student',active:true});
    Object.keys(seed).forEach(name=>seed[name].forEach(row=>append_(db_(),name,row)));
    append_(db_(),'Feedback',{id:'hom-feedback-a',workoutId:'hom-workout-a',studentId:'hom-student-a',status:'Concluído',reason:'',fingerPain:0,rpe:6,comment:'Retorno fictício: sessão concluída com boa técnica.',createdAt:'2026-11-16T13:00:00.000Z'});
  }
  reset();
  return {api,reset,profiles,switchUser(id){if(!profiles.some(p=>p.id===id)) throw Error('Perfil inválido'); active=id;}};
}
'''
start=source.index('(async function() {')
end=source.index('  function clearSession()', start)
ui=source[start:end]
ui=ui.replace("let rpc, selected = '', session, sessionToken = '', loginAttempt, busy = false, generation = 0;", "const backend=createDemoBackend();\n  let selected='', session, busy=false, generation=0;\n  const rpc=async request=>{await new Promise(resolve=>setTimeout(resolve,120)); const r=backend.api(request); if(!r.ok) throw Error(r.error.code); return r.data;};")
ui=ui.replace("const key = () => crypto.randomUUID();", "let intent=0; const key=()=> 'demo-request-'+Date.now()+'-'+(++intent);")
ui=ui.replace("if(e.message==='UNAUTHENTICATED') clearSession(); ",'')
ui=ui.replace("busy=true; document.querySelectorAll", "busy=true; $('demoProfile').disabled=true; document.querySelectorAll")
ui=ui.replace("finally { busy=false; document.querySelectorAll", "finally { busy=false; $('demoProfile').disabled=false; document.querySelectorAll")
ui=ui.replace("w.date+' • '+w.studentId+' • '+w.goal", "w.date+' • '+nameFor(w.studentId)+' • '+w.goal")
ui=ui.replace("w.date+' • '+w.goal+' • '+w.studentId", "w.date+' • '+w.goal+' • '+nameFor(w.studentId)")
ui=ui.replace("b.textContent=label;", "b.textContent=label; b.className='demo-workout';")
ui=ui.replace("$('coachTreinoId').value=id;", "$('coachTreinoId').value=id; $('selectedWorkout').textContent='Treino selecionado: '+id;")
ui += '''
  function nameFor(id) {return backend.profiles.find(p=>p.id===id)?.label || id;}
  async function loadProfile(id) {
    backend.switchUser(id); selected=''; generation++; pending.clear();
    session=await rpc({action:'getSession',data:{}});
    $('currentProfile').textContent=nameFor(session.id)+' • '+(session.role==='coach'?'Treinador':'Aluno');
    $('panelCoach').classList.toggle('hidden',session.role!=='coach');
    $('feedbackForm').hidden=session.role!=='student';
    $('panelStudent').classList.remove('hidden');
    $('alunoNome').value=nameFor(session.id);
    $('coachAluno').replaceChildren();
    if(session.role==='coach') {
      const students=await rpc({action:'listStudents',data:{}});
      students.forEach(s=>{const o=document.createElement('option'); o.value=s.id; o.textContent=nameFor(s.id); $('coachAluno').appendChild(o);});
    }
    $('coachData').value='2026-11-18'; $('alunoDor').value='0'; $('alunoRpe').value='6';
    $('alunoStatus').value='Concluído'; $('alunoMotivo').value=''; $('alunoComentario').value='';
    $('itemExercicio').value=''; $('itemQtd').value=''; $('itemMin').value=''; $('itemNotas').value='';
    await refresh();
  }
  $('demoProfile').addEventListener('change',()=>perform(()=>loadProfile($('demoProfile').value)));
  $('resetDemo').addEventListener('click',()=>perform(async()=>{backend.reset(); await loadProfile($('demoProfile').value);}));
  $('refreshDemo').addEventListener('click',()=>perform(()=>refresh(selected)));
  await perform(()=>loadProfile('hom-coach'));
})();
'''
html=source[:source.index('<script>')]
html=html.replace('<p id="notice" role="status" aria-live="polite">Entre com sua conta Google de teste.</p>', '')
html=re.sub(r'<section id="loginPanel".*?</section>', '', html, flags=re.S)
html=html.replace('<button id="btnLogout" hidden>Sair do MVP</button>', '')
html=html.replace('<div id="appPanel" hidden>', '''<div class="demo-banner"><strong>DEMONSTRAÇÃO VISUAL</strong><span>Dados fictícios • backend simulado • sem conexão com Google</span></div>
<div class="demo-toolbar card">
  <div><label for="demoProfile">Visualizar como</label><select id="demoProfile"><option value="hom-coach">Treinador Demo</option><option value="hom-student-a">Aluna A Demo</option><option value="hom-student-b">Aluno B Demo</option></select></div>
  <span id="currentProfile" class="pill"></span>
  <div class="btnbar"><button id="refreshDemo">Atualizar</button><button id="resetDemo">Reiniciar demonstração</button></div>
  <p class="muted">Experimente: crie um treino para Aluna A, adicione um item, troque para ela e envie um retorno. Volte ao treinador para consultar. As alterações duram até recarregar esta página.</p>
  <p id="notice" role="status" aria-live="polite">Preparando demonstração…</p>
</div><div id="appPanel">''')
html=re.sub(r'<div class="tabs".*?</div>', '', html, flags=re.S)
html=html.replace('Dados protegidos por identidade Google e permissões no servidor.', 'Nesta demonstração, os perfis e as operações são simulados neste navegador.')
html=html.replace('aria-labelledby="tabCoach"','aria-label="Treinador"').replace('aria-labelledby="tabStudent"','aria-label="Consulta e retorno do aluno"')
# Wrap just the student submission form; keep the shared workout preview for coaches.
html=html.replace('<h2>Retorno do aluno</h2>','<h2>Treino e retorno</h2>')
html=html.replace('<label for="alunoNome">Aluno (confirmação)</label>','<label for="alunoNome">Perfil em visualização</label>')
marker='<div class="row" style="margin-top:10px">\n          <div>\n            <label for="alunoStatus">'
html=html.replace(marker,'<div id="feedbackForm">'+marker)
html=html.replace('''        <div class="hr"></div>
        <h2>Detalhes do treino selecionado</h2>''','''        </div><div class="hr"></div>
        <h2>Detalhes do treino selecionado</h2><p id="selectedWorkout" class="muted"></p>''')
html=html.replace('O aluno acessa o treino em sua própria conta Google.','Troque o perfil acima para visualizar a experiência de cada aluno fictício.')
html=html.replace('Sem dados','Sem dados fictícios')
css='''
[hidden]{display:none !important}
.demo-banner{background:#0f2446;border-bottom:1px solid #6ee7ff66;padding:14px 16px;text-align:center;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;font-size:12px;color:#cfefff}
.demo-toolbar{max-width:1068px;margin:18px auto 0;padding:16px}
.demo-toolbar select{max-width:420px;margin-bottom:12px}
select{color-scheme:dark} option{background:#101a33;color:#eaf0ff}
button,input,select,textarea{min-height:44px}
#notice{font-size:13px;color:#6ee7ff;margin-bottom:0;overflow-wrap:anywhere}
#listaTreinos button{text-align:left;font-weight:600;overflow-wrap:anywhere}
#selectedWorkout{overflow-wrap:anywhere}
@media(max-width:680px){.demo-toolbar{margin:12px 12px 0}input,select,textarea{font-size:16px}.demo-toolbar .btnbar button{flex:1} .pill{white-space:normal;overflow-wrap:anywhere} .split{flex-wrap:wrap}}
'''
html=html.replace('</style>',css+'</style>')
html=html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow"><title>MVP Escalada — Demonstração</title>')
html += '<script>\n'+backend_js+'\n</script>\n<script>\n'+ui+'\n</script></body></html>'
(root/'demo/index.html').write_text(html)
print('demo/index.html generated')
