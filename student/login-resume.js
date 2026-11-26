function createLoginResume({link, prepareButton, finishButton, finish, onSuccess, onStatus}) {
  const maxChecks = 5;
  const checkInterval = 2000;
  let attempt, timer, finishing = false;

  function stopTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function reset() {
    stopTimer();
    attempt = undefined;
    link.hidden = true;
    link.removeAttribute('href');
    finishButton.hidden = true;
  }

  function prepare({authorizationUrl, transaction, proof}) {
    const url = new URL(authorizationUrl);
    if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') {
      throw Error('INVALID_RESPONSE');
    }
    attempt = {transaction, proof, opened: false, checks: 0};
    link.href = url.href;
    link.hidden = false;
    finishButton.hidden = false;
  }

  async function check(manual = false) {
    const current = attempt;
    if (!current || finishing) return;
    if (!manual && (!current.opened || document.hidden || timer !== undefined || current.checks >= maxChecks)) return;
    stopTimer();
    finishing = true;
    prepareButton.disabled = finishButton.disabled = true;
    if (!manual) current.checks++;
    try {
      const result = await finish({transaction: current.transaction, proof: current.proof});
      if (attempt !== current) return;
      if (result.pending) {
        if (current.opened && current.checks < maxChecks) {
          timer = setTimeout(() => {
            timer = undefined;
            return check();
          }, checkInterval);
        }
        onStatus(current.checks < maxChecks
          ? 'Ainda aguardamos a autorização do Google.'
          : 'A confirmação automática foi interrompida. Use “Concluir entrada” ou prepare uma nova entrada.');
        return;
      }
      await onSuccess(result.sessionToken);
      if (attempt === current) reset();
    } catch (error) {
      if (attempt !== current) return;
      current.checks = maxChecks;
      if (['AUTH_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN'].includes(error.message)) {
        reset();
        onStatus('Não foi possível autenticar. Prepare uma nova entrada.');
      } else {
        onStatus('Não foi possível concluir: ' + error.message + '. Tente “Concluir entrada” ou prepare uma nova entrada.');
      }
    } finally {
      finishing = false;
      prepareButton.disabled = finishButton.disabled = false;
    }
  }

  link.addEventListener('click', event => {
    if (finishing) event.preventDefault();
    else if (attempt) attempt.opened = true;
  });
  finishButton.addEventListener('click', () => check(true));
  window.addEventListener('focus', () => check());
  document.addEventListener('visibilitychange', () => check());
  return {prepare, reset};
}
