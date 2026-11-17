/* Controlled local homologation: all Google services are in-memory substitutes. */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {fixture}=require('./helpers/gas.cjs');
function setup(){const f=fixture();['TrainingLibrary','TrainingLoad','TrainingCatalog'].forEach(name=>vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),f.context));f.properties.LIBRARY_SPREADSHEET_ID='test-only';let actor='coach@example.invalid',seq=0;f.as=email=>{actor=email;f.email(email);};f.lib=(action,data={},key)=>f.context.libraryApi({action,data,requestId:key||'controlled-'+(++seq),sessionToken:actor?f.context.issueSession_({email:actor,sub:'12345'}):undefined});f.context.initializeLibraryDevelopment_();return f;}
function ok(r){assert.equal(r.ok,true);return r.data;}
function rejected(r,code){assert.equal(r.ok,false);assert.equal(r.error.code,code);}
function prepare(f,student='s1'){
 const w=ok(f.call('createWorkout',{studentId:student,date:'2026-11-18',goal:'Teste fictício'},'cw-'+student));
 const item=ok(f.call('addItem',{workoutId:w.id,block:'Força',category:'Technique',exercise:'Supino fictício',metric:'repetitions',quantity:3,minutes:5},'ci-'+student));
 const assessmentData={studentId:student,exerciseId:'exercise-bench',indicatorId:'int-1rm',value:100,unitId:'unit-kg',protocol:'Protocolo fictício',referenceDefinition:'Referência fictícia definida',assessedOn:'2026-11-01',validUntil:'2026-12-31'};
 const a=ok(f.lib('recordAssessment',assessmentData,'a-'+student));
 const plan={workoutId:w.id,itemId:item.id,exerciseId:'exercise-bench',methodId:'method-max-effort',classification:'general',intensity:{indicatorId:'int-1rm',assessmentId:a.id,percent:85},volume:{kind:'repetitions',unitId:'unit-repetitions',sets:Array.from({length:5},()=>({repetitions:3}))},expectedRevision:0};
 return {w,item,a,assessmentData,plan};
}
test('controlled E: assessment replay rechecks a revoked trainer-student link',()=>{
 const f=setup(),p=prepare(f);f.tables.Links[1][3]=false;
 rejected(f.lib('getAssessment',{assessmentId:p.a.id}),'NOT_FOUND');
 rejected(f.lib('recordAssessment',p.assessmentData,'a-s1'),'NOT_FOUND');
});
test('controlled E: prescription replay cannot return or repair data after access revocation',()=>{
 const f=setup(),p=prepare(f);f.fail('PRESCRICAO_SERIES');rejected(f.lib('createLibraryPrescription',p.plan,'p'),'INTERNAL_ERROR');
 const before=JSON.stringify(f.tables);f.tables.Links[1][3]=false;
 rejected(f.lib('createLibraryPrescription',p.plan,'p'),'NOT_FOUND');
 assert.equal(f.tables.PRESCRICAO_SERIES.length,1);
 f.tables.Links[1][3]=true;ok(f.lib('createLibraryPrescription',p.plan,'p'));
 assert.equal(f.tables.PRESCRICAO_SERIES.length,6);assert.notEqual(JSON.stringify(f.tables),before);
});
test('controlled D/F: Sheets Date values preserve timestamps and date-only assessment fields',()=>{
 const f=setup(),p=prepare(f),columns=f.context.LIBRARY_SCHEMA_.AVALIACOES;
 const row=f.tables.AVALIACOES[1];const stamp='2026-11-17T13:45:12.123Z';
 row[columns.indexOf('createdAt')]=vm.runInContext('new Date("'+stamp+'")',f.context);
 row[columns.indexOf('assessedOn')]=vm.runInContext('new Date("2026-11-01T00:00:00Z")',f.context);
 const result=ok(f.lib('getAssessment',{assessmentId:p.a.id}));assert.equal(result.createdAt,stamp);assert.equal(result.assessedOn,'2026-11-01');
});
test('controlled E: student A cannot access student B or manipulate ownership and parent IDs',()=>{
 const f=setup();f.tables.Links.push(['l2','c1','s2',true]);const a=prepare(f,'s1'),b=prepare(f,'s2');const pb=ok(f.lib('createLibraryPrescription',b.plan,'pb'));
 rejected(f.lib('createLibraryPrescription',{...b.plan,itemId:a.item.id},'mixed-parent'),'NOT_FOUND');
 f.as('one@example.invalid');rejected(f.lib('getAssessment',{assessmentId:b.a.id}),'NOT_FOUND');rejected(f.lib('getLibraryPrescription',{prescriptionId:pb.id}),'NOT_FOUND');rejected(f.lib('getAssessment',{assessmentId:b.a.id,studentId:'s1'}),'INVALID_DATA');rejected(f.lib('createLibraryPrescription',a.plan,'forged-write'),'FORBIDDEN');
});
test('controlled F: retry after partial child persistence preserves IDs and creates no duplicate series',()=>{
 const f=setup(),p=prepare(f),original=f.context.libraryAppend_;let count=0;
 f.context.libraryAppend_=function(db,name,record){if(name==='PRESCRICAO_SERIES'&&++count===2)throw Error('simulated interruption');return original(db,name,record);};
 rejected(f.lib('createLibraryPrescription',p.plan,'recover'),'INTERNAL_ERROR');assert.equal(f.tables.PRESCRICAO_SERIES.length,2);const firstId=f.tables.PRESCRICAO_SERIES[1][0];
 f.context.libraryAppend_=original;const prescription=ok(f.lib('createLibraryPrescription',p.plan,'recover'));assert.equal(f.tables.PRESCRICAO_SERIES.length,6);assert.equal(f.tables.PRESCRICAO_SERIES[1][0],firstId);assert.equal(new Set(f.tables.PRESCRICAO_SERIES.slice(1).map(r=>r[0])).size,5);assert.equal(prescription.totalVolume,15);
});
test('controlled A/B: initialization preserves all contents and every catalog relationship resolves',()=>{
 const f=setup(),before=JSON.stringify(f.tables);f.context.initializeLibraryDevelopment_();assert.equal(JSON.stringify(f.tables),before);
 const db=f.context.db_(),get=name=>f.context.libraryRows_(db,name),exists=(table,id)=>get(table).some(r=>r.id===id);
 for(const name of Object.keys(f.context.LIBRARY_SCHEMA_)){assert.ok(f.tables[name]);const ids=get(name).map(r=>r.id);assert.equal(ids.length,new Set(ids).size);}
 for(const r of get('EXERCICIO_METODOS')){assert.ok(exists('EXERCICIOS',r.exerciseId));assert.ok(exists('METODOS',r.methodId));}
 for(const r of get('EXERCICIO_CAPACIDADES')){assert.ok(exists('EXERCICIOS',r.exerciseId));assert.ok(exists('CAPACIDADES',r.capacityId));}
 for(const r of get('CAPACIDADES'))if(r.capacityId)assert.ok(exists('CAPACIDADES',r.capacityId));for(const r of get('METODOS'))if(r.parentId)assert.ok(exists('METODOS',r.parentId));
 assert.equal(get('EXERCICIOS').length,10);assert.equal(get('AVALIACOES').length,0);assert.equal(get('PRESCRICOES').length,0);assert.equal(get('PRESCRICAO_SERIES').length,0);
});
