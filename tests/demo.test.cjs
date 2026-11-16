const {test}=require('node:test'); const assert=require('node:assert/strict'); const vm=require('node:vm'); const fs=require('node:fs');
const html=fs.readFileSync('demo/index.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function demo(){const ctx=vm.createContext({}); vm.runInContext(scripts[0],ctx); return ctx.createDemoBackend();}
function call(b,action,data={},requestId='demo-intent-1'){return b.api({action,data,requestId});}
test('demo simulates complete coach/student feedback flow and preserves isolation',()=>{
  const b=demo(); assert.equal(call(b,'listWorkouts').data.length,2);
  const w=call(b,'createWorkout',{studentId:'hom-student-a',date:'2026-11-18',goal:'Técnica fictícia'}).data;
  assert.ok(w.id);
  assert.equal(call(b,'addItem',{workoutId:w.id,block:'Técnica',category:'Technique',exercise:'Movimento de teste',metric:'Reps',quantity:6,minutes:10,notes:''},'demo-item-1').ok,true);
  b.switchUser('hom-student-b'); assert.equal(call(b,'getWorkout',{workoutId:w.id}).error.code,'NOT_FOUND');
  b.switchUser('hom-student-a'); assert.equal(call(b,'getWorkout',{workoutId:w.id}).data.items.length,1);
  const data={workoutId:w.id,status:'Parcial',reason:'Cansaço',fingerPain:0,rpe:7,comment:'Retorno fictício'};
  assert.equal(call(b,'submitFeedback',data,'demo-feedback-1').ok,true);
  assert.equal(call(b,'submitFeedback',data,'demo-feedback-1').ok,true);
  b.switchUser('hom-coach'); assert.equal(call(b,'listFeedback',{workoutId:w.id}).data.length,1);
  b.reset(); assert.equal(call(b,'listWorkouts').data.length,2);
  assert.equal(call(b,'getWorkout',{workoutId:w.id}).error.code,'NOT_FOUND');
});
test('demo backend has no remote data operations or login credentials',()=>{
  for(const script of scripts) new vm.Script(script);
  assert.doesNotMatch(html,/fetch\(|XMLHttpRequest|google\.script|UrlFetchApp|localStorage|sessionStorage|GOOGLE_CLIENT_SECRET|https:\/\//);
  assert.match(html,/DEMONSTRAÇÃO VISUAL/); assert.match(html,/max-width:680px/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]); assert.equal(ids.length,new Set(ids).size);
  for(const m of scripts[1].matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]),m[1]);
});
