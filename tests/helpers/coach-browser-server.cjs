/* Local browser test server. All identities, Sheets and OAuth replies are fictitious.
   Never use this adapter in an Apps Script deployment. */
const http=require('node:http'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./gas.cjs');
const f=fixture();
for(const name of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary'])vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context);
f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();
f.tables.Links.push(['l2','c1','s2',true]);
const coach=f.context.issueSession_({email:'coach@example.invalid',sub:'12345'});
for(const studentId of ['s1','s2'])f.context.libraryApi({action:'recordAssessment',data:{studentId,exerciseId:'exercise-bench',indicatorId:'int-1rm',value:100,unitId:'unit-kg',protocol:'Teste fictício',referenceDefinition:'Referência fictícia',assessedOn:'2026-11-01',validUntil:'2026-12-31'},requestId:'assessment-'+studentId,sessionToken:coach});
for(const studentId of ['s1','s2'])f.context.api({action:'createWorkout',data:{studentId,date:'2026-11-18',goal:'Força'},requestId:'workout-'+studentId,sessionToken:coach});
const firstWorkout=f.tables.Workouts[1][0];
const feedback=f.context.api({action:'submitFeedback',data:{workoutId:firstWorkout,status:'Concluído',reason:'',fingerPain:0,rpe:6,comment:'Retorno fictício para consulta'},requestId:'feedback-test',sessionToken:f.context.issueSession_({email:'one@example.invalid',sub:'12345'})});
if(!feedback.ok)throw Error('Fictitious feedback fixture failed');
let loseNext=false,loseNextFeedback=false,delayNext=0;
const adapter=`<script>
window.testProfile='coach';
class TestRunner{
 constructor(success,failure){this.success=success;this.failure=failure;}
 withSuccessHandler(fn){return new TestRunner(fn,this.failure)}
 withFailureHandler(fn){return new TestRunner(this.success,fn)}
 send(method,request){fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,request,profile:window.testProfile})}).then(r=>{if(!r.ok)throw Error('test transport failure');return r.json()}).then(this.success).catch(this.failure)}
 api(r){this.send('api',r)} libraryApi(r){this.send('libraryApi',r)}
}
window.google={script:{run:new TestRunner()}};
</script>`;
const server=http.createServer(async(req,res)=>{
 if(req.method==='GET'){
  const original=process.env.COACH_BASELINE==='1'?require('node:child_process').execFileSync('git',['show','737a4af:apps-script/Index.html'],{encoding:'utf8'}):fs.readFileSync(req.url.startsWith('/student')?'apps-script/Student.html':'apps-script/Index.html','utf8');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(original.replace('<script>',adapter+'<script>'));return;
 }
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw||'{}');res.setHeader('Content-Type','application/json');
 if(req.url==='/test-control'){loseNext=!!body.loseNext;loseNextFeedback=!!body.loseNextFeedback;delayNext=body.delayNext||0;if(body.failTable)f.fail(body.failTable);res.end('{}');return;}
 if(req.url==='/test-tables'){res.end(JSON.stringify(f.tables));return;}
 const {method,request:r,profile}=body;let result;
 if(method==='api'&&r.action==='beginLogin')result={ok:true,data:{authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth',transaction:'fake',proof:'fake'}};
 else if(method==='api'&&r.action==='finishLogin')result={ok:true,data:{sessionToken:f.context.issueSession_({email:profile==='student'?'one@example.invalid':profile==='student-b'?'two@example.invalid':'coach@example.invalid',sub:'12345'})}};
 else result=f.context[method](r);
 if(r.action==='submitItemFeedback'&&result.ok&&loseNextFeedback){loseNextFeedback=false;res.statusCode=503;res.end('{}');return;}
 if(r.action==='saveCoachPrescription'&&result.ok){if(loseNext){loseNext=false;res.statusCode=503;res.end('{}');return;}if(delayNext){const delay=delayNext;delayNext=0;await new Promise(resolve=>setTimeout(resolve,delay));}}
 res.end(JSON.stringify(result));
});
server.listen(0,'127.0.0.1',()=>console.log(server.address().port));
