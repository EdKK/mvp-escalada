/* Same authenticated API and OAuth flow as Index; no mock identity in this build. */
window.StudentAPI=(()=>{
  let token='';
  const $=id=>document.getElementById(id);
  const call=(action,data,requestId,method = 'api')=>new Promise((resolve,reject)=>{
    const request={action,data};if(requestId)request.requestId=requestId;if(token)request.sessionToken=token;
    google.script.run.withSuccessHandler(r=>{if(r&&r.ok){resolve(r.data);return;}const code=r?.error?.code||'INVALID_RESPONSE';if(code==='UNAUTHENTICATED' && token){token='';$('trainingPanel').hidden=true;$('authPanel').hidden=false;$('authMessage').textContent='Sua sessão expirou. Prepare uma nova entrada.';}reject(Error(code));}).withFailureHandler(()=>reject(Error('TRANSPORT_ERROR')))[method](request);
  });
  async function setupLogin(start){
    $('authPanel').hidden=false;
    if(typeof google==='undefined'||!google.script?.run){$('authMessage').textContent='Abra esta interface pelo Apps Script.';return;}
    const status = text => { $('authMessage').textContent = text; };
    const loginResume = createLoginResume({
      link: $('loginLink'), prepareButton: $('prepareLogin'), finishButton: $('finishLogin'),
      finish: data => call('finishLogin', data),
      onSuccess: async sessionToken => {
        token = sessionToken;
        try {
          await start();
        } catch (error) {
          if (error.message !== 'STUDENT_ONLY') throw error;
          loginResume.reset();
          status('Esta tela é para alunos. Use “Sou treinador” para acessar a outra interface.');
        }
      },
      onStatus: status
    });
    $('prepareLogin').addEventListener('click', async () => {
      const button = $('prepareLogin');
      if (button.disabled) return;
      button.disabled = true;
      token = '';
      loginResume.reset();
      try {
        loginResume.prepare(await call('beginLogin', {}));
        status('Abra o Google e volte a esta aba para entrar automaticamente.');
      } catch (error) {
        status('Não foi possível preparar a entrada: ' + error.message + '. Tente novamente.');
      } finally {
        button.disabled = false;
      }
    });
    const writeAssessment = createAssessmentWriter();
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    $('selfMassDate').value = date.toISOString().slice(0, 10);
    $('selfMassForm').addEventListener('submit', async event => {
      event.preventDefault();
      const save = $('selfMassSave'), status = $('selfMassStatus');
      if (!token || save.disabled) return;
      const sessionToken = token;
      const data = {date: $('selfMassDate').value, mass: Number($('selfMassValue').value)};
      save.disabled = true;
      status.textContent = 'Enviando…';
      try {
        const actor = await call('getSession', {});
        await writeAssessment(actor.id, 'selfReport', data,
          (action, payload, id) => {
            if (token !== sessionToken) throw Error('UNAUTHENTICATED');
            return call(action, payload, id, 'assessmentApi');
          },
          () => { $('selfMassStorage').hidden = false; });
        if (Number($('selfMassValue').value) === data.mass) $('selfMassValue').value = '';
        status.textContent = 'Autorrelato registrado.';
      } catch (error) {
        const messages = {
          NO_ACTIVE_LINK: 'Seu cadastro precisa de um vínculo ativo com um treinador.',
          INVALID_DATA: 'Confira o peso em kg e a data da medição.',
          SCHEMA_ERROR: 'A avaliação ainda não está disponível.'
        };
        status.textContent = messages[error.message] ||
          'Envio sem confirmação. Tente novamente com o mesmo valor e a mesma data.';
      } finally { save.disabled = false; }
    });
    const signout=document.createElement('button');signout.textContent='Sair';signout.className='student-signout';signout.addEventListener('click',async()=>{try{await call('logout',{});}finally{token='';location.reload();}});document.querySelector('.app-footer').append(signout);
  }
  return {isDemo:false,call,setupLogin};
})();
