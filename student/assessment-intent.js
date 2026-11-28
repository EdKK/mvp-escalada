/* Store only an intent ID and digest in this tab, so a retry after reload reuses the ID. */
function createAssessmentWriter() {
  const pending = new Map();
  return async (actorId, action, data, send, onStorageFailure) => {
    const payload = JSON.stringify([actorId, action, data]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const storageKey = 'mvp.ava.' + Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, '0')).join('');
    let id = pending.get(storageKey);
    try { id ||= window.sessionStorage.getItem(storageKey); }
    catch { onStorageFailure(); }
    const retrying = Boolean(id);
    id ||= crypto.randomUUID();
    pending.set(storageKey, id);
    try { window.sessionStorage.setItem(storageKey, id); }
    catch { onStorageFailure(); }
    const clear = () => {
      pending.delete(storageKey);
      try { window.sessionStorage.removeItem(storageKey); }
      catch { onStorageFailure(); }
    };
    try {
      const result = await send(action, data, id);
      clear();
      return result;
    } catch (error) {
      const rejected = ['INVALID_DATA', 'CONFLICT', 'NOT_FOUND', 'FORBIDDEN', 'NO_ACTIVE_LINK'];
      if (!retrying && rejected.includes(error.message)) clear();
      throw error;
    }
  };
}
