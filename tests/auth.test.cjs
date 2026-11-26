const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,setupFinance}=require('./helpers/gas.cjs');
function loginFixture() {
  const f=fixture();
  f.tables.Users[1][1]='coach-test@gmail.com';
  f.tables.Users[2][1]='student-a-test@gmail.com';
  f.tables.Users[3][1]='student-b-test@gmail.com';
  const calls=[];
  let claimsPatch={}, networkFailure=false, status=200;
  f.context.UrlFetchApp.fetch=(url,options)=>{
    calls.push({url,options});
    if(networkFailure) throw Error('private upstream failure');
    let body;
    if(url==='https://oauth2.googleapis.com/token') {
      assert.equal(options.payload.client_secret,'fake-secret');
      assert.equal(options.payload.grant_type,'authorization_code');
      body={id_token:'fake-id-token',access_token:'discard-me'};
    } else {
      assert.equal(url,'https://oauth2.googleapis.com/tokeninfo?id_token=fake-id-token');
      const tx=f.context.authRead_('login:'+f.context.hashAuth_(f.attempt.transaction));
      const now=Math.floor(f.context.DateNowForTest()/1000);
      body={aud:f.properties.GOOGLE_CLIENT_ID,iss:'https://accounts.google.com',exp:now+3600,iat:now,nonce:tx.nonce,sub:'123456789',email:'coach-test@gmail.com',email_verified:'true',...claimsPatch};
    }
    return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(body)};
  };
  f.context.DateNowForTest=()=>require('node:vm').runInContext('Date.now()',f.context);
  f.raw=request=>f.context.api(request);
  f.begin=()=>{const response=f.raw({action:'beginLogin',data:{}}); assert.equal(response.ok,true); f.attempt=response.data; return response.data};
  f.callback=(extra={})=>f.context.completeGoogleLogin_({state:f.attempt.transaction,code:'fake-code',...extra});
  f.finish=(data=f.attempt)=>f.raw({action:'finishLogin',data:{transaction:data.transaction,proof:data.proof}});
  f.claims=patch=>claimsPatch=patch; f.network=value=>networkFailure=value; f.status=value=>status=value; f.calls=calls;
  return f;
}
function rejected(response,code) {assert.equal(response.ok,false); assert.equal(response.error.code,code)}
test('Google code flow, PKCE and browser proof produce a short-lived app session',()=>{
  const f=loginFixture(), attempt=f.begin();
  const url=new URL(attempt.authorizationUrl);
  assert.equal(url.origin,'https://accounts.google.com'); assert.equal(url.searchParams.get('scope'),'openid email');
  assert.equal(url.searchParams.get('response_type'),'code'); assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(f.finish().data.pending,true);
  assert.equal(f.callback(),true);
  assert.equal(url.searchParams.get('code_challenge'),f.context.hashAuth_(f.calls[0].options.payload.code_verifier));
  assert.equal(f.calls.every(c=>c.options.followRedirects===false),true);
  const result=f.finish(); assert.match(result.data.sessionToken,/^[a-f0-9]{64}$/);
  assert.equal(f.finish().data.sessionToken,result.data.sessionToken);
  const request={action:'getSession',data:{},sessionToken:result.data.sessionToken};
  assert.equal(f.raw(request).data.id,'c1');
  assert.equal(f.callback(),false); assert.equal(f.calls.length,2);
  const cached=JSON.stringify([...f.cache.values()]);
  assert.doesNotMatch(cached,/fake-id-token|discard-me|fake-secret|fake-code/);
  f.advance(1801*1000); rejected(f.raw(request),'UNAUTHENTICATED');
});
test('missing or forged app sessions never fall back to Apps Script operator identity',()=>{
  const f=loginFixture();
  rejected(f.raw({action:'getSession',data:{}}),'UNAUTHENTICATED');
  rejected(f.raw({action:'getSession',data:{},sessionToken:'a'.repeat(64)}),'UNAUTHENTICATED');
  rejected(f.raw({action:'getSession',data:{},email:'coach-test@gmail.com'}),'INVALID_DATA');
});
test('only original browser proof can obtain login result; no cross-login swapping',()=>{
  const f=loginFixture(), first=f.begin(), second=f.begin();
  rejected(f.finish({transaction:second.transaction,proof:first.proof}),'UNAUTHENTICATED');
  assert.equal(f.callback(),true);
  rejected(f.finish({transaction:second.transaction,proof:'b'.repeat(64)}),'UNAUTHENTICATED');
  assert.ok(f.finish(second).data.sessionToken);
});
test('callback state is required, expires and cannot be replayed',()=>{
  const f=loginFixture(); f.begin();
  assert.equal(f.callback({state:'a'.repeat(64)}),false); assert.equal(f.calls.length,0);
  f.advance(601*1000); assert.equal(f.callback(),false); rejected(f.finish(),'UNAUTHENTICATED');
});
test('invalid claims and unregistered identities cannot establish sessions',()=>{
  const invalid=[
    {aud:'other-client'}, {azp:'other-client'}, {iss:'https://attacker.invalid'},
    {exp:0}, {exp:'not-a-time'}, {iat:0}, {iat:9999999999},
    {nonce:'wrong'}, {sub:''}, {email_verified:false}, {email_verified:'false'},
    {email:'unknown@gmail.com'}, {email:'untrusted@example.invalid'}
  ];
  for(const patch of invalid) {
    const f=loginFixture(); f.begin(); f.claims(patch);
    assert.equal(f.callback(),false,JSON.stringify(patch)); rejected(f.finish(),'AUTH_FAILED');
  }
});
test('Google errors, consent denial and upstream outage fail closed without details',()=>{
  for(const failure of ['network','http','denied']) {
    const f=loginFixture(); f.begin();
    if(failure==='network') f.network(true);
    if(failure==='http') f.status(400);
    assert.equal(f.callback(failure==='denied'?{error:'access_denied'}:{}),false);
    rejected(f.finish(),'AUTH_FAILED');
  }
});
test('session logout and allowlist deactivation are enforced on subsequent requests',()=>{
  const f=loginFixture(); f.begin(); assert.equal(f.callback(),true);
  const token=f.finish().data.sessionToken;
  f.tables.Users[1][3]=false;
  rejected(f.raw({action:'listWorkouts',data:{},sessionToken:token}),'FORBIDDEN');
  f.tables.Users[1][3]=true;
  assert.equal(f.raw({action:'logout',data:{},sessionToken:token}).data.signedOut,true);
  rejected(f.raw({action:'getSession',data:{},sessionToken:token}),'UNAUTHENTICATED');
});
test('cache eviction fails closed; OAuth configuration and rate limits are required',()=>{
  const f=loginFixture(); f.begin(); f.cache.clear(); rejected(f.finish(),'UNAUTHENTICATED');
  f.properties.ENVIRONMENT='production'; rejected(f.raw({action:'beginLogin',data:{}}),'CONFIGURATION_ERROR');
  f.properties.ENVIRONMENT='homologation'; f.properties.GOOGLE_REDIRECT_URI='https://attacker.invalid';
  rejected(f.raw({action:'beginLogin',data:{}}),'CONFIGURATION_ERROR');
  const other=loginFixture(); for(let i=0;i<20;i++) other.begin();
  rejected(other.raw({action:'beginLogin',data:{}}),'BUSY');
});
test('three independent Gmail identities retain existing coach/student authorization',()=>{
  const f=loginFixture();
  const identities=[['coach-test@gmail.com','101','c1','coach'],['student-a-test@gmail.com','102','s1','student'],['student-b-test@gmail.com','103','s2','student']];
  const sessions=[];
  for(const [email,sub,id,role] of identities) {
    f.begin(); f.claims({email,sub}); assert.equal(f.callback(),true);
    const sessionToken=f.finish().data.sessionToken; sessions.push(sessionToken);
    const who=f.raw({action:'getSession',data:{},sessionToken}).data;
    assert.equal(who.id,id); assert.equal(who.role,role);
  }
  assert.equal(new Set(sessions).size,3);
  const workout=f.raw({action:'createWorkout',data:{studentId:'s1',date:'2026-11-16',goal:'Teste fictício'},requestId:'oauth-test-workout',sessionToken:sessions[0]}).data;
  assert.equal(f.raw({action:'getWorkout',data:{workoutId:workout.id},sessionToken:sessions[1]}).ok,true);
  rejected(f.raw({action:'getWorkout',data:{workoutId:workout.id},sessionToken:sessions[2]}),'NOT_FOUND');
  rejected(f.raw({action:'createWorkout',data:{studentId:'s1',date:'2026-11-16',goal:'Teste'},requestId:'invalid-student-write',sessionToken:sessions[1]}),'FORBIDDEN');
});

test('a student registered by a coach can use the existing Google OAuth callback', () => {
  const f = setupFinance(loginFixture());
  const email = 'new-student-test@gmail.com';
  const registration = f.context.financeApi({
    action: 'saveStudent', requestId: require('node:crypto').randomUUID(),
    sessionToken: f.context.issueSession_({email: 'coach-test@gmail.com', sub: '12345'}),
    data: {studentId: '', name: 'Aluna OAuth', email, whatsapp: '11900000000', startedOn: '2026-06-01'}
  });
  assert.equal(registration.ok, true);
  f.claims({email});
  f.begin();
  assert.equal(f.callback(), true);
  const sessionToken = f.finish().data.sessionToken;
  const session = f.raw({action: 'getSession', data: {}, sessionToken});
  assert.equal(session.data.id, registration.data.id);
  assert.equal(session.data.role, 'student');
  rejected(f.context.financeApi({action: 'listStudents', data: {}, sessionToken}), 'FORBIDDEN');
});
