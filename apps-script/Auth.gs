/* Google OIDC authorization-code flow. Helpers are private to Apps Script RPC.
 * CacheService contains only short-lived login state and opaque app sessions.
 * No Google refresh/access/ID tokens are persisted or returned to the browser.
 */
var LOGIN_TTL_ = 600;
var SESSION_TTL_ = 1800;
function randomAuth_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function hashAuth_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)).replace(/=+$/, '');
}
function authCache_() { return CacheService.getScriptCache(); }
function authPut_(key, value, ttl) { authCache_().put(key, JSON.stringify(value), ttl); }
function authRead_(key) {
  var raw = authCache_().get(key);
  if (!raw) return null;
  var value = JSON.parse(raw);
  return value.expires > Date.now() ? value : null;
}
function authConfig_() {
  var p = PropertiesService.getScriptProperties();
  var config = {clientId:p.getProperty('GOOGLE_CLIENT_ID'), clientSecret:p.getProperty('GOOGLE_CLIENT_SECRET'), redirect:p.getProperty('GOOGLE_REDIRECT_URI')};
  if (p.getProperty('ENVIRONMENT') !== 'homologation' || !config.clientId || !config.clientSecret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.redirect || '')) fail_('CONFIGURATION_ERROR');
  return config;
}
function authString_(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail_('UNAUTHENTICATED');
  return value;
}
function queryAuth_(data) {
  return Object.keys(data).map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]); }).join('&');
}
function beginLogin_(data) {
  fields_(data, []);
  var config = authConfig_(), state = randomAuth_(), proof = randomAuth_(), nonce = randomAuth_(), verifier = randomAuth_();
  // Bounded global login creation rate for this small homologation environment.
  var bucket = 'login-rate:' + Math.floor(Date.now() / 60000);
  var count = Number(authCache_().get(bucket) || 0);
  if (count >= 20) fail_('BUSY');
  authCache_().put(bucket, String(count + 1), 120);
  authPut_('login:' + hashAuth_(state), {proofHash:hashAuth_(proof), nonce:nonce, verifier:verifier, expires:Date.now()+LOGIN_TTL_*1000, status:'pending'}, LOGIN_TTL_);
  return {transaction:state, proof:proof, authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?' + queryAuth_({
    client_id:config.clientId, redirect_uri:config.redirect, response_type:'code', scope:'openid email',
    state:state, nonce:nonce, code_challenge:hashAuth_(verifier), code_challenge_method:'S256', access_type:'online', prompt:'select_account'
  })};
}
function fetchAuthJson_(url, options) {
  options = options || {};
  options.muteHttpExceptions = true; options.followRedirects = false;
  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) fail_('AUTH_FAILED');
  return JSON.parse(response.getContentText());
}
function verifiedClaims_(token, config, nonce) {
  if (typeof token !== 'string' || !token || token.length > 10000) fail_('AUTH_FAILED');
  // Google verifies the signature; any network/validation failure fails closed.
  // tokeninfo is suitable for this small test environment; review quotas before production.
  var claims = fetchAuthJson_('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
  var now = Math.floor(Date.now()/1000);
  if (claims.aud !== config.clientId || (claims.azp && claims.azp !== config.clientId) ||
      ['accounts.google.com','https://accounts.google.com'].indexOf(claims.iss) < 0 ||
      !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now ||
      !Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 60 || Number(claims.iat) < now - LOGIN_TTL_ - 60 ||
      claims.nonce !== nonce || typeof claims.sub !== 'string' || !/^\d{1,255}$/.test(claims.sub) ||
      !(claims.email_verified === true || claims.email_verified === 'true') ||
      typeof claims.email !== 'string' || !/^[^\s@]+@(gmail\.com|googlemail\.com)$/i.test(claims.email)) fail_('AUTH_FAILED');
  return {email:claims.email.toLowerCase(), sub:claims.sub};
}
function completeGoogleLogin_(parameters) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false;
  try {
    var state = authString_(parameters.state), key = 'login:' + hashAuth_(state), pending = authRead_(key);
    if (!pending || pending.status !== 'pending') fail_('AUTH_FAILED');
    // Consume state before code exchange. Replays never exchange the code again.
    pending.status = 'failed'; delete pending.identity;
    authPut_(key, pending, LOGIN_TTL_);
    if (parameters.error || typeof parameters.code !== 'string' || !parameters.code || parameters.code.length > 4096) fail_('AUTH_FAILED');
    var config = authConfig_();
    var response = fetchAuthJson_('https://oauth2.googleapis.com/token', {method:'post', payload:{
      grant_type:'authorization_code', code:parameters.code, client_id:config.clientId, client_secret:config.clientSecret,
      redirect_uri:config.redirect, code_verifier:pending.verifier
    }});
    var identity = verifiedClaims_(response.id_token, config, pending.nonce);
    // Check the allowlist before making a session available; rechecked on every API call.
    userForEmail_(db_(), identity.email);
    delete pending.verifier; delete pending.nonce;
    pending.status = 'ready'; pending.identity = identity;
    authPut_(key, pending, LOGIN_TTL_);
    return true;
  } catch (e) { return false; }
  finally { lock.releaseLock(); }
}
function issueSession_(identity) {
  var token = randomAuth_();
  authPut_('session:' + hashAuth_(token), {email:identity.email, sub:identity.sub, expires:Date.now()+SESSION_TTL_*1000}, SESSION_TTL_);
  return token;
}
function finishLogin_(data) {
  fields_(data, ['transaction', 'proof']);
  var key = 'login:' + hashAuth_(authString_(data.transaction)), pending = authRead_(key);
  if (!pending || pending.proofHash !== hashAuth_(authString_(data.proof))) fail_('UNAUTHENTICATED');
  if (pending.status === 'failed') fail_('AUTH_FAILED');
  if (pending.status === 'pending') return {pending:true};
  if (pending.status === 'ready') {
    userForEmail_(db_(), pending.identity.email);
    pending.sessionToken = issueSession_(pending.identity);
    delete pending.identity; pending.status = 'issued';
    authPut_(key, pending, LOGIN_TTL_);
  }
  // Stable response if RPC delivery was lost; proof remains browser-held.
  return {sessionToken:pending.sessionToken};
}
function sessionIdentity_(token) {
  var value = authRead_('session:' + hashAuth_(authString_(token)));
  if (!value || !value.email || !value.sub) fail_('UNAUTHENTICATED');
  return value;
}
function logout_(token) {
  authCache_().remove('session:' + hashAuth_(authString_(token)));
  return {signedOut:true};
}
