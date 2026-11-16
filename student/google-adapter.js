/* Same authenticated API and OAuth flow as Index; no mock identity in this build. */
window.StudentAPI=(()=>{
  let token='',attempt;
  const $=id=>document.getElementById(id);
  const call=(action,data,requestId)=>new Promise((resolve,reject)=>{
    const request={action,data};if(requestId)request.requestId=requestId;if(token)request.sessionToken=token;
    google.script.run.withSuccessHandler(r=>{if(r&&r.ok){resolve(r.data);return;}const code=r?.error?.code||'INVALID_RESPONSE';if(code==='UNAUTHENTICATED'){token='';$('trainingPanel').hidden=true;$('authPanel').hidden=false;$('authMessage').textContent='Sua sessão expirou. Prepare uma nova entrada.';}reject(Error(code));}).withFailureHandler(()=>reject(Error('TRANSPORT_ERROR'))).api(request);
  });
  async function setupLogin(start,notify){
    $('authPanel').hidden=false;
    if(typeof google==='undefined'||!google.script?.run){$('authMessage').textContent='Abra esta interface pelo Apps Script.';return;}
    const message=e=>{if(e.message==='STUDENT_ONLY')return 'Esta tela é para alunos. Use “Sou treinador” para acessar a outra interface.';return 'Não foi possível entrar: '+e.message+'. Prepare uma nova entrada se necessário.';};
    let busy=false;
    async function run(fn){if(busy)return;busy=true;$('prepareLogin').disabled=true;$('finishLogin').disabled=true;try{await fn();}catch(e){$('authMessage').textContent=message(e);}finally{busy=false;$('prepareLogin').disabled=false;$('finishLogin').disabled=false;}}
    $('prepareLogin').addEventListener('click',()=>run(async()=>{token='';attempt=await call('beginLogin',{});const url=new URL(attempt.authorizationUrl);if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw Error('INVALID_RESPONSE');$('loginLink').href=url.href;$('loginLink').hidden=false;$('finishLogin').hidden=false;$('authMessage').textContent='Abra o Google na nova aba e volte aqui para concluir.';}));
    $('finishLogin').addEventListener('click',()=>run(async()=>{if(!attempt)throw Error('UNAUTHENTICATED');const result=await call('finishLogin',{transaction:attempt.transaction,proof:attempt.proof});if(result.pending){$('authMessage').textContent='Conclua a autorização na aba do Google primeiro.';return;}token=result.sessionToken;await start();attempt=null;$('loginLink').removeAttribute('href');}));
    const signout=document.createElement('button');signout.textContent='Sair';signout.className='student-signout';signout.addEventListener('click',async()=>{try{await call('logout',{});}finally{token='';location.reload();}});document.querySelector('.app-footer').append(signout);
  }
  return {isDemo:false,call,setupLogin};
})();
