/* Same authenticated API and OAuth flow as Index; no mock identity in this build. */
window.StudentAPI=(()=>{
  let token = '', generation = 0, resetTraining = () => {}, resetLoginAttempt = () => {};
  const $ = id => document.getElementById(id);

  function resetSession(message = '') {
    generation++;
    token = '';
    $('trainingPanel').hidden = true;
    $('authPanel').hidden = false;
    $('authMessage').textContent = message;
    $('selfMassForm').reset();
    $('selfMassDate').value = '';
    $('selfMassSave').disabled = false;
    $('selfMassStatus').textContent = '';
    $('selfMassStorage').hidden = true;
    const signout = $('studentSignout');
    if (signout) signout.hidden = true;
    resetTraining();
  }

  function call(action, data, requestId, method = 'api') {
    const current = generation;
    const request = {action, data};
    if (requestId) request.requestId = requestId;
    if (token) request.sessionToken = token;
    return new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(response => {
        if (current !== generation) return reject(Error('STALE_SESSION'));
        if (response?.ok) return resolve(response.data);
        const code = response?.error?.code || 'INVALID_RESPONSE';
        if (code === 'UNAUTHENTICATED' && request.sessionToken) {
          resetSession('Sua sessão expirou. Prepare uma nova entrada.');
          resetLoginAttempt();
        }
        reject(Error(code));
      }).withFailureHandler(() => {
        reject(Error(current === generation ? 'TRANSPORT_ERROR' : 'STALE_SESSION'));
      })[method](request);
    });
  }

  async function setupLogin(start, clearTraining) {
    resetTraining = clearTraining;
    $('authPanel').hidden = false;
    if (typeof google === 'undefined' || !google.script?.run) {
      $('authMessage').textContent = 'Abra esta interface pelo Apps Script.';
      return;
    }
    const status = text => { $('authMessage').textContent = text; };
    const loginResume = createLoginResume({
      link: $('loginLink'), prepareButton: $('prepareLogin'), finishButton: $('finishLogin'),
      finish: data => call('finishLogin', data),
      onSuccess: async sessionToken => {
        resetSession();
        const current = generation;
        token = sessionToken;
        const date = new Date();
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        $('selfMassDate').value = date.toISOString().slice(0, 10);
        try {
          await start();
          if (current === generation) $('studentSignout').hidden = false;
        } catch (error) {
          if (current !== generation) return;
          if (error.message !== 'STUDENT_ONLY') {
            resetSession();
            throw error;
          }
          resetSession('Esta tela é para alunos. Use “Sou treinador” para acessar a outra interface.');
          loginResume.reset();
        }
      },
      onStatus: status
    });
    resetLoginAttempt = loginResume.reset;
    $('prepareLogin').addEventListener('click', async () => {
      const button = $('prepareLogin');
      if (button.disabled) return;
      button.disabled = true;
      resetSession();
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
    $('selfMassForm').addEventListener('submit', async event => {
      event.preventDefault();
      const save = $('selfMassSave'), status = $('selfMassStatus');
      if (!token || save.disabled) return;
      const current = generation;
      const isCurrent = () => current === generation;
      const data = {date: $('selfMassDate').value, mass: Number($('selfMassValue').value)};
      save.disabled = true;
      status.textContent = 'Enviando…';
      try {
        const actor = await call('getSession', {});
        if (!isCurrent()) return;
        await writeAssessment(actor.id, 'selfReport', data,
          (action, payload, id) => call(action, payload, id, 'assessmentApi'),
          () => { if (isCurrent()) $('selfMassStorage').hidden = false; },
          isCurrent);
        if (!isCurrent()) return;
        if (Number($('selfMassValue').value) === data.mass) $('selfMassValue').value = '';
        status.textContent = 'Autorrelato registrado.';
      } catch (error) {
        if (!isCurrent()) return;
        const messages = {
          NO_ACTIVE_LINK: 'Seu cadastro precisa de um vínculo ativo com um treinador.',
          INVALID_DATA: 'Confira o peso em kg e a data da medição.',
          SCHEMA_ERROR: 'A avaliação ainda não está disponível.'
        };
        status.textContent = messages[error.message] ||
          'Envio sem confirmação. Tente novamente com o mesmo valor e a mesma data.';
      } finally {
        if (isCurrent()) save.disabled = false;
      }
    });

    const signout = document.createElement('button');
    signout.id = 'studentSignout';
    signout.textContent = 'Sair';
    signout.className = 'student-signout';
    signout.hidden = true;
    signout.addEventListener('click', () => {
      if (!token) return;
      const revoke = call('logout', {});
      resetSession('Sessão encerrada. Prepare uma nova entrada.');
      loginResume.reset();
      // A delayed revocation reply belongs to the session just closed.
      revoke.catch(() => {});
    });
    document.querySelector('.app-footer').append(signout);
  }
  return {isDemo: false, call, setupLogin};
})();
