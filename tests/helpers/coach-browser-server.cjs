/* Local browser test server. All identities, Sheets and OAuth replies are fictitious.
   Never use this adapter in an Apps Script deployment. */
const http=require('node:http'),fs=require('node:fs'),vm=require('node:vm');
const {fixture,setupFinance}=require('./gas.cjs');
const f=setupFinance(fixture());
for(const name of ['TrainingLibrary','TrainingLoad','TrainingCatalog','CoachLibrary','GeneralCatalog'])vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context);
f.properties.LIBRARY_SPREADSHEET_ID='test-only';f.context.initializeLibraryDevelopment_();
f.context.prepararCatalogoGeralHomologacao_();
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
 api(r){this.send('api',r)} libraryApi(r){this.send('libraryApi',r)} financeApi(r){this.send('financeApi',r)}
}
window.google={script:{run:new TestRunner()}};
</script>`;
const server=http.createServer(async(req,res)=>{
 if(req.method==='GET'){
  if(req.url==='/exec?view=coach'){
   const src='http://127.0.0.1:'+server.address().port+'/coach-frame';
   res.setHeader('Content-Type','text/html; charset=utf-8');
   res.end('<iframe src="'+src+'" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>');
   return;
  }
  if(req.url==='/test-oauth-return'){
   f.context.HtmlService={
    createHtmlOutputFromFile:name=>({getContent:()=>fs.readFileSync('apps-script/'+name+'.html','utf8')}),
    createHtmlOutput:html=>({html,addMetaTag(){return this;},setTitle(){return this;}})
   };
   res.setHeader('Content-Type','text/html; charset=utf-8');
   res.end(f.context.oauthReturnPage_(true).html);
   return;
  }
  const original=process.env.COACH_BASELINE==='1'?require('node:child_process').execFileSync('git',['show','737a4af:apps-script/Index.html'],{encoding:'utf8'}):fs.readFileSync(req.url.startsWith('/student')?'apps-script/Student.html':'apps-script/Index.html','utf8');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(original.replace('<script>',adapter+'<script>'));return;
 }
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw||'{}');res.setHeader('Content-Type','application/json');
 if(req.url==='/test-control'){loseNext=!!body.loseNext;loseNextFeedback=!!body.loseNextFeedback;delayNext=body.delayNext||0;if(body.failTable)f.fail(body.failTable);
  if(body.expireSession)f.advance(1801*1000);
  if(body.revokeStudent)f.tables.Links.find(row=>row[1]==='c1'&&row[2]===body.revokeStudent)[3]=false;
  // Fictitious pre-fix history for state regression only; never deployed to Apps Script.
  if(body.seedHistoricalFeedback){
   const d=body.seedHistoricalFeedback,record={id:'historical-feedback-test',workoutId:d.workoutId,itemId:d.itemId,studentId:'s1',status:'not_done',actualSets:2,actualQuantity:2,quantityUnit:'repetitions',fingerPain:3,comment:'fadiga',rpe:'',revision:1,supersedesId:'',createdAt:'2026-11-23T12:00:00.000Z'};
   f.tables.ItemFeedback.push(f.context.SCHEMA_.ItemFeedback.map(k=>record[k]));
  }
  res.end('{}');return;}
 if(req.url==='/test-saved-workout'){
  const result=f.context.api({action:'createWorkout',data:body,requestId:require('node:crypto').randomUUID(),sessionToken:coach});
  res.end(JSON.stringify(result));return;
 }
 if(req.url==='/test-tables'){res.end(JSON.stringify(f.tables));return;}
 const {method,request:r,profile}=body;let result;
 if(method==='api'&&r.action==='beginLogin')result={ok:true,data:{authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth',transaction:'fake',proof:'fake'}};
 else if(method==='api'&&r.action==='finishLogin')result={ok:true,data:{sessionToken:f.context.issueSession_({email:profile==='student'?'one@example.invalid':profile==='student-b'?'two@example.invalid':'coach@example.invalid',sub:'12345'})}};
 else result=f.context[method](r);
 if(r.action==='submitItemFeedback'&&result.ok&&loseNextFeedback){loseNextFeedback=false;res.statusCode=503;res.end('{}');return;}
 if(['saveCoachPrescription','saveCoachSession'].includes(r.action)&&result.ok){if(loseNext){loseNext=false;res.statusCode=503;res.end('{}');return;}if(delayNext){const delay=delayNext;delayNext=0;await new Promise(resolve=>setTimeout(resolve,delay));}}
 res.end(JSON.stringify(result));
});
server.listen(0,'127.0.0.1',()=>console.log(server.address().port));
