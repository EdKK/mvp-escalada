const vm=require('node:vm'); const fs=require('node:fs'); const crypto=require('node:crypto');
function fixture() {
  let email = 'coach@example.invalid', busy = false, held = false, failTable;
  const tables = {}, rowCapacity = new Map(), cache = new Map();
  const properties = {SPREADSHEET_ID:'test-only', ENVIRONMENT:'homologation', GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET:'fake-secret', GOOGLE_REDIRECT_URI:'https://script.google.com/macros/s/test-deployment/exec'};
  let now = Date.now();
  const context = vm.createContext({
    Session: {getActiveUser: () => ({getEmail: () => email})},
    PropertiesService: {getScriptProperties: () => ({getProperty: k => properties[k] || null})},
    Utilities: {getUuid: () => crypto.randomUUID(), DigestAlgorithm:{SHA_256:'sha256'}, Charset:{UTF_8:'utf8'},
      computeDigest: (_,value) => [...crypto.createHash('sha256').update(value).digest()],
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url')},
    CacheService: {getScriptCache: () => ({
      get: k => {const v=cache.get(k); return v && v.until>now ? v.value : null},
      put: (k,value,ttl) => cache.set(k,{value,until:now+ttl*1000}), remove:k=>cache.delete(k)
    })},
    UrlFetchApp: {fetch:()=>{throw Error('No real network in tests')}},
    LockService: {getScriptLock: () => ({tryLock: () => {if (busy || held) return false; held = true; return true}, waitLock: () => {held = true}, hasLock: () => held, releaseLock: () => {held = false}})},
    SpreadsheetApp: {flush() {}, openById: () => ({getSheetByName: name => tables[name] && sheet(name), insertSheet: name => {tables[name] = []; return sheet(name)}})}
  });
  function sheet(name) {return {
    getLastRow: () => tables[name].length,
    getMaxRows: () => rowCapacity.get(name)||1000,
    insertRowsAfter: (position,count) => rowCapacity.set(name,position+count),
    getLastColumn: () => tables[name][0]?.length || 0,
    getRange: (r,c,n,w) => ({getValues: () => tables[name].slice(r-1,r-1+n).map(row => row.slice(c-1,c-1+w)),
      setValues: values => {
        if (failTable === name) {failTable = null; throw Error('simulated outage')}
        values.forEach((row, offset) => (tables[name][r-1+offset]??=[]).splice(c-1,w,...row));
      }}),
    appendRow: row => {if (failTable === name) {failTable = null; throw Error('simulated outage')} tables[name].push([...row]); return sheet(name)}
  }}
  vm.runInContext(fs.readFileSync('apps-script/Backend.gs','utf8'), context);
  vm.runInContext(fs.readFileSync('apps-script/Auth.gs','utf8'), context);
  vm.runInContext('Date',context).now=()=>now;
  vm.runInContext(fs.readFileSync('apps-script/Student.gs','utf8'), context);
  context.initializeSchema_();
  tables.Users.push(['c1','coach@example.invalid','coach',true],['s1','one@example.invalid','student',true],['s2','two@example.invalid','student',true]);
  tables.Links.push(['l1','c1','s1',true]);
  const call = (action,data={},requestId='request-1') => context.api({action,data,requestId,sessionToken:email ? context.issueSession_({email,sub:'12345'}) : undefined});
  return {context,call,tables,cache,properties,advance:ms=>now+=ms,email: value => email=value,busy: value => busy=value, fail: name => failTable=name};
}
function setupFinance(f) {
  vm.runInContext(fs.readFileSync('apps-script/StudentFinance.gs','utf8'), f.context);
  f.properties.HOMOLOGATION_SPREADSHEET_ID = f.properties.SPREADSHEET_ID;
  f.context.prepararCadastroFinanceiroTeste_();
  return f;
}
module.exports={fixture,setupFinance};
