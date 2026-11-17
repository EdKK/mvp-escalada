const {test}=require('node:test'); const assert=require('node:assert/strict'); const vm=require('node:vm'); const fs=require('node:fs');
const html=fs.readFileSync('apps-script/Index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({}); vm.runInContext(script.split('// UI integration')[0],ctx);
test('RPC adapter sends request and resolves API data',async()=>{
  let success, failure, sent;
  const run={withSuccessHandler(fn){success=fn;return this},withFailureHandler(fn){failure=fn;return this},api(req){sent=req; success({ok:true,data:{id:'test'}})}};
  const req={action:'createWorkout',requestId:'stable',data:{}};
  assert.equal((await ctx.createRpc(run)(req)).id,'test'); assert.equal(sent,req); assert.equal(typeof failure,'function');
});
test('RPC adapter rejects authorization, malformed responses and transport failures',async()=>{
  for(const value of [{ok:false,error:{code:'FORBIDDEN'}},null]) {
    let success; const run={withSuccessHandler(fn){success=fn;return this},withFailureHandler(){return this},api(){success(value)}};
    await assert.rejects(ctx.createRpc(run)({}),/FORBIDDEN|INVALID_RESPONSE/);
  }
  let failure; const run={withSuccessHandler(){return this},withFailureHandler(fn){failure=fn;return this},api(){failure(Error('private details'))}};
  await assert.rejects(ctx.createRpc(run)({}),/TRANSPORT_ERROR/);
});
test('integration script parses and original integration channels are absent',()=>{
  new vm.Script(script); assert.match(html,/google\.script\.run/);
  assert.doesNotMatch(html,/localStorage|api\.github\.com|backendToken|githubToken|innerHTML/);
});

test('deployment files are consistent and UI references existing unique IDs',()=>{
  const manifest=JSON.parse(fs.readFileSync('apps-script/appsscript.json','utf8'));
  assert.equal(manifest.runtimeVersion,'V8');
  assert.equal(manifest.oauthScopes.length,2);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const m of script.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]),m[1]);
  const backend=fs.readFileSync('apps-script/Backend.gs','utf8');
  assert.match(backend,/createHtmlOutputFromFile\('Index'\)/);
  const routes=backend+fs.readFileSync('apps-script/TrainingLibrary.gs','utf8');
  for(const m of script.matchAll(/(?:action:|write\()'([^']+)'/g)) assert.ok(routes.includes("'"+m[1]+"'"),m[1]);
});
test('RPC attaches in-memory session without mutating caller payload',async()=>{
  let success,sent;
  const run={withSuccessHandler(fn){success=fn;return this},withFailureHandler(){return this},api(req){sent=req;success({ok:true,data:{}})}};
  const request={action:'listWorkouts',data:{}};
  await ctx.createRpc(run,()=> 'opaque-test-session')(request);
  assert.equal(sent.sessionToken,'opaque-test-session'); assert.equal(request.sessionToken,undefined);
  assert.match(html,/rel="noopener noreferrer"/); assert.match(html,/id="appPanel" hidden/);
  assert.doesNotMatch(html,/sessionStorage|localStorage/);
});
