const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {fixture}=require('./helpers/gas.cjs');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('student/model.js','utf8'),ctx);const M=ctx.StudentModel;
const prescription={position:2,sets:4,quantity:6,quantityUnit:'hang_seconds',restSeconds:120,intensityMin:7,intensityMax:8,intensityUnit:'RPE',rpeApplicable:true};
function prepared(){const f=fixture(),w=f.call('createWorkout',{studentId:'s1',date:'2026-09-04',goal:'Controle de pegada',instructions:['Aquecer.','Respeitar os intervalos.']},'w').data;const i=f.call('addItem',{workoutId:w.id,block:'Força',category:'Finger strength',exercise:'Suspensão 20 mm',metric:'seconds',quantity:6,minutes:5,notes:'Escápula ativa.',prescription},'i').data;return {...f,w,i};}
function feedback(f,patch={}){return {workoutId:f.w.id,itemId:f.i.id,status:'completed',fingerPain:0,comment:'Teste fictício',expectedRevision:0,...patch};}
function code(r,c){assert.equal(r.ok,false);assert.equal(r.error.code,c);}
test('dates are sorted/deduplicated; session selection and item order preserve inputs',()=>{
 const w=[{id:'b',date:'2026-09-06'},{id:'a',date:'2026-09-02'},{id:'c',date:'2026-09-06'}];
 assert.equal(M.dates(w).join(','),'2026-09-02,2026-09-06');assert.equal(M.forDate(w,'2026-09-06').length,2);assert.equal(M.forDate(w,'2026-09-04').length,0);
 const items=[{id:'second',prescription:{position:2}},{id:'first',prescription:{position:1}}];assert.equal(M.ordered(items).map(i=>i.id).join(','),'first,second');assert.equal(items[0].id,'second');
});
test('exercise clock uses timestamps across hidden intervals, pause, restart and reset',()=>{
 let t=M.start(undefined,1000);assert.equal(M.elapsed(t,46000),45000);assert.equal(M.formatTime(M.elapsed(t,46000)),'00:45');
 assert.equal(M.elapsed(t,3610000),3609000);t=M.pause(t,61000);assert.equal(M.elapsed(t,999000),60000);
 t=M.start(t,1000000);assert.equal(M.elapsed(t,1005000),65000);t=M.start(t,1002000);assert.equal(t.startedAt,1000000);
 assert.equal(M.formatTime(M.elapsed(M.zero(),999999)),'00:00');
});
test('rest countdown is independent, pauses and clamps to zero after screen lock',()=>{
 let rest=M.restStart(undefined,120,1000);assert.equal(M.remaining(rest,46000),75000);
 rest=M.restPause(rest,46000);assert.equal(M.remaining(rest,999000),75000);rest=M.restStart(rest,120,1000000);
 assert.equal(M.remaining(rest,2000000),0);assert.equal(M.formatTime(M.remaining(rest,2000000)),'00:00');assert.equal(M.elapsed(M.start(undefined,1000),46000),45000);
});
test('specific units remain visible; PSE is optional and dose follows item units',()=>{
 assert.match(M.quantity(prescription),/6 s de suspensão/);assert.equal(M.intensity(prescription),'PSE 7–8');
 assert.equal(M.intensity({intensityUnit:'%1RM',intensityMin:80,intensityMax:85}),'80–85 % de 1RM');
 assert.equal(M.intensity({intensityUnit:'kg',intensityMin:10,intensityMax:10}),'10 kg');
 const d=M.feedbackData({id:'w'},{id:'i',prescription:{rpeApplicable:false}},[],{status:'not_done',fingerPain:0,rpe:7,actualSets:2});assert.equal(d.rpe,7);assert.equal(d.actualSets,undefined);assert.equal(d.expectedRevision,0);
});
test('new schema preserves legacy rows and adds structured instructions/prescriptions',()=>{
 const f=prepared();assert.equal(f.w.id,f.tables.Workouts[1][0]);assert.equal(f.tables.Items[1].length,10);
 const w=f.call('getWorkout',{workoutId:f.w.id}).data;assert.equal(w.instructions.length,2);assert.equal(w.items[0].prescription.quantityUnit,'hang_seconds');assert.equal(w.items[0].prescription.restSeconds,120);
 const before=JSON.stringify(f.tables.Items);f.context.initializeSchema_();assert.equal(JSON.stringify(f.tables.Items),before);
});
test('item feedback is authorized by owner and parent workout; coach cannot submit',()=>{
 const f=prepared();code(f.call('submitItemFeedback',feedback(f),'fb'),'FORBIDDEN');f.email('two@example.invalid');code(f.call('submitItemFeedback',feedback(f),'fb'),'NOT_FOUND');
 f.email('one@example.invalid');code(f.call('submitItemFeedback',feedback(f,{itemId:'another-item'}),'fb'),'NOT_FOUND');
 assert.equal(f.call('submitItemFeedback',feedback(f,{rpe:7,actualSets:4,actualQuantity:6,quantityUnit:'hang_seconds'}),'fb').ok,true);
});
test('correction appends a revision, changes visual state, and never modifies prescription/session',()=>{
 const f=prepared();const before=JSON.stringify({workouts:f.tables.Workouts,items:f.tables.Items,prescription:f.tables.ItemPrescription});f.email('one@example.invalid');
 const first=f.call('submitItemFeedback',feedback(f),'fb').data;
 const duplicate=f.call('submitItemFeedback',feedback(f),'fb');assert.equal(duplicate.data.id,first.id);
 const second=f.call('submitItemFeedback',feedback(f,{status:'partial',expectedRevision:1}),'correction').data;assert.equal(second.supersedesId,first.id);assert.equal(second.revision,2);
 const w=f.call('getWorkout',{workoutId:f.w.id}).data;assert.equal(w.itemFeedback.length,2);assert.equal(M.state(w.itemFeedback,f.i.id),'partial');
 assert.equal(JSON.stringify({workouts:f.tables.Workouts,items:f.tables.Items,prescription:f.tables.ItemPrescription}),before);
 code(f.call('submitItemFeedback',feedback(f,{status:'not_done',expectedRevision:1}),'stale'),'CONFLICT');
 f.email('coach@example.invalid');assert.equal(f.call('getWorkout',{workoutId:f.w.id}).data.itemFeedback.length,2);
});
test('feedback validation rejects invalid pain, RPE, quantities, and wrong units',()=>{
 const f=prepared();f.email('one@example.invalid');
 for(const patch of [{fingerPain:11},{rpe:11},{actualSets:-1},{actualQuantity:5,quantityUnit:'repetitions'},{expectedRevision:-1}])code(f.call('submitItemFeedback',feedback(f,patch),'invalid'),'INVALID_DATA');
 assert.equal(f.tables.ItemFeedback.length,1);
});
test('partial structured write recovers with same request and item id',()=>{
 const f=fixture(),w=f.call('createWorkout',{studentId:'s1',date:'2026-09-04',goal:'Test'},'w').data;
 const d={workoutId:w.id,block:'Força',category:'Finger strength',exercise:'Suspensão',metric:'seconds',quantity:6,minutes:1,notes:'',prescription};
 f.fail('ItemPrescription');code(f.call('addItem',d,'partial'),'INTERNAL_ERROR');assert.equal(f.tables.Items.length,2);
 code(f.call('addItem',d,'competing-reservation'),'CONFLICT');
 assert.equal(f.call('addItem',d,'partial').ok,true);assert.equal(f.tables.Items.length,2);assert.equal(f.tables.ItemPrescription.length,2);
});
test('order conflicts and simultaneous/stale feedback requests do not duplicate records',()=>{
 const f=prepared();code(f.call('addItem',{workoutId:f.w.id,block:'Força',category:'Finger strength',exercise:'Outro',metric:'seconds',quantity:6,minutes:1,prescription},'duplicate-order'),'CONFLICT');assert.equal(f.tables.Items.length,2);
 f.email('one@example.invalid');f.busy(true);code(f.call('submitItemFeedback',feedback(f),'lock'),'BUSY');f.busy(false);assert.equal(f.call('submitItemFeedback',feedback(f),'lock').ok,true);code(f.call('submitItemFeedback',feedback(f),'second-session'),'CONFLICT');assert.equal(f.tables.ItemFeedback.length,2);
});
test('student UI has native multi-expansion, touch targets, small-screen rules and separate feedback controls',()=>{
 const app=fs.readFileSync('student/app.js','utf8'),css=fs.readFileSync('student/style.css','utf8'),html=fs.readFileSync('student/template.html','utf8');
 new vm.Script(app);assert.match(app,/el\('details','exercise'\)/);assert.match(app,/expanded\.set\(key,card.open\)/);assert.match(app,/visibilitychange/);assert.match(app,/pageshow/);
 assert.match(css,/@media\(max-width:480px\)/);assert.match(css,/min-height:44px/);assert.match(css,/font-size:16px/);assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);assert.match(html,/viewport-fit=cover/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1])||['demoProfile','resetDemo'].includes(m[1]),m[1]);
 assert.doesNotMatch(html,/id="confirmDialog"/);assert.match(html,/id="feedbackDialog"/);assert.match(css,/\[data-status=completed\]/);
});
test('new demo adapter offers authorized dates and full item feedback with shared server validation',async()=>{
 const html=fs.readFileSync('demo/student.html','utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const ctx=vm.createContext({window:{},setTimeout:fn=>fn()});vm.runInContext(scripts[0],ctx);vm.runInContext(scripts[1],ctx);const api=ctx.window.StudentAPI;
 const w=await api.call('listWorkouts',{});assert.equal(w.filter(w=>w.date.startsWith('2026-09')).length,4);const target=w.find(w=>w.date==='2026-09-04');const details=await api.call('getWorkout',{workoutId:target.id});assert.equal(details.items.length,4);assert.equal(details.instructions.length,4);
 api.switchUser('hom-student-b');await assert.rejects(api.call('getWorkout',{workoutId:target.id}),/NOT_FOUND/);
 api.switchUser('hom-student-empty');assert.equal((await api.call('listWorkouts',{})).length,0);
 assert.doesNotMatch(scripts[1],/UrlFetchApp|google\.script|fetch\(/);
});
