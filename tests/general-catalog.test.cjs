const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {fixture}=require('./helpers/gas.cjs');

function setup(){
  const scenario=fixture();
  const {context,properties}=scenario;
  for(const name of ['TrainingLibrary','TrainingCatalog','GeneralCatalog']){
    vm.runInContext(fs.readFileSync('apps-script/'+name+'.gs','utf8'),context);
  }
  properties.LIBRARY_SPREADSHEET_ID='test-only';
  context.initializeLibraryDevelopment_();
  const token=email=>context.issueSession_({email,sub:'test'});
  const request=(sessionToken=token('coach@example.invalid'),data={})=>
    context.libraryApi({action:'listGeneralCatalog',data,sessionToken});
  return {...scenario,request,token,initialize:context.prepararCatalogoGeralHomologacao_};
}

function plain(value){return JSON.parse(JSON.stringify(value));}

test('approved version 1 has exactly 183 stable IDs, 14 categories and the 12 foot exercises',()=>{
  const {initialize,request,tables}=setup();
  assert.deepEqual(plain(initialize()),{version:1,inserted:183,total:183});
  const response=request();
  assert.equal(response.ok,true);
  assert.equal(response.data.version,1);
  const exercises=plain(response.data.exercises);
  assert.equal(exercises.length,183);
  assert.equal(new Set(exercises.map(row=>row.id)).size,183);
  assert.deepEqual([...new Set(exercises.map(row=>row.area))],['Musculação']);
  const counts=Object.fromEntries(['Membros superiores','Membros inferiores','Tronco'].map(region=>[
    region,exercises.filter(row=>row.region===region).length
  ]));
  assert.deepEqual(counts,{'Membros superiores':64,'Membros inferiores':63,Tronco:56});
  const categories=new Map();
  exercises.forEach(row=>categories.set(row.category,(categories.get(row.category)||0)+1));
  assert.deepEqual(Object.fromEntries(categories),{Peitoral:10,Dorsais:12,'Cintura escapular':16,Bíceps:8,Tríceps:8,
    Antebraços:10,Quadríceps:12,Isquiotibiais:9,Glúteos:12,Adutores:8,Perna:10,Pés:12,Dinâmicos:27,Estabilizadores:29});
  assert.deepEqual(exercises.filter(row=>row.category==='Pés').map(row=>row.name),[
    'Encurtamento ativo do pé (short foot)','Afastamento ativo dos dedos (toe spread)','Elevação isolada do hálux',
    'Elevação dos quatro dedos menores','Flexão dos dedos com toalha','Preensão de objetos com os dedos',
    'Flexão resistida do hálux','Flexão resistida dos dedos menores','Abdução resistida do hálux',
    'Extensão resistida dos dedos','Pressão isométrica do hálux','Encurtamento ativo do pé em apoio unilateral'
  ]);
  // Digest of the approved ordered tuples, including immutable identifiers and exact spelling.
  const digest=createHash('sha256').update(JSON.stringify(tables.CATALOGO_GERAL.slice(1))).digest('hex');
  assert.equal(digest,'e65873936bd4e7e8e7c17a17b1940206faf23a8a06e42910ff4f160e85e19a5f');
});

test('initialization is additive, idempotent and repairs a verified partial load',()=>{
  const {initialize,request,tables}=setup();
  const before=plain(tables);
  initialize();
  const {CATALOGO_GERAL,...existingTables}=plain(tables);
  assert.deepEqual(existingTables,before);
  assert.deepEqual(plain(initialize()),{version:1,inserted:0,total:183});
  assert.deepEqual(tables.CATALOGO_GERAL,CATALOGO_GERAL);
  const expected=plain(request());
  tables.CATALOGO_GERAL.splice(1,9);
  assert.equal(request().error.code,'SCHEMA_ERROR');
  assert.deepEqual(plain(initialize()),{version:1,inserted:9,total:183});
  assert.deepEqual(plain(request()),expected);
  assert.deepEqual(plain(initialize()),{version:1,inserted:0,total:183});
});

test('initialization rejects incompatible headers and conflicts without overwriting rows',()=>{
  const {initialize,request,tables}=setup();
  initialize();
  const approved=plain(tables.CATALOGO_GERAL);
  for(const modify of [
    rows=>{rows[0][0]='codigo';},
    rows=>{rows[3][4]='Nome divergente';},
    rows=>rows.push(rows[1].slice()),
    rows=>rows.push(['mus-externo','Musculação','Tronco','Dinâmicos','Outro'])
  ]){
    tables.CATALOGO_GERAL=plain(approved);
    modify(tables.CATALOGO_GERAL);
    const before=plain(tables);
    assert.throws(initialize,error=>['SCHEMA_ERROR','CONFLICT'].includes(error.code));
    assert.equal(request().ok,false);
    assert.deepEqual(plain(tables),before);
  }
});

test('initialization recovers after a batch failure and is restricted to homologation',()=>{
  const {initialize,request,tables,properties,busy,fail}=setup();
  const before=plain(tables);
  properties.ENVIRONMENT='production';
  assert.throws(initialize,error=>error.code==='CONFIGURATION_ERROR');
  assert.equal(request().error.code,'CONFIGURATION_ERROR');
  properties.ENVIRONMENT='homologation';
  properties.LIBRARY_SPREADSHEET_ID='other';
  assert.throws(initialize,error=>error.code==='CONFIGURATION_ERROR');
  assert.deepEqual(plain(tables),before);
  properties.LIBRARY_SPREADSHEET_ID='test-only';
  busy(true);
  assert.throws(initialize,error=>error.code==='BUSY');
  busy(false);
  fail('CATALOGO_GERAL');
  assert.throws(initialize,/simulated outage/);
  assert.deepEqual(tables.CATALOGO_GERAL,[]);
  assert.deepEqual(plain(initialize()),{version:1,inserted:183,total:183});
});

test('authenticated coach consultation is read-only and independent from prescription',()=>{
  const {initialize,request,tables,token,context}=setup();
  const coach=token('coach@example.invalid');
  assert.equal(request(coach).error.code,'SCHEMA_ERROR');
  initialize();
  const before=plain(tables);
  assert.equal(request(null).error.code,'UNAUTHENTICATED');
  assert.equal(request(token('one@example.invalid')).error.code,'FORBIDDEN');
  assert.equal(request(coach,{name:'Supino'}).error.code,'INVALID_DATA');
  const exercises=request(coach).data.exercises;
  const prescription=context.libraryApi({action:'listExercises',data:{},sessionToken:coach});
  const prescriptionIds=new Set(prescription.data.map(row=>row.id));
  assert.equal(prescriptionIds.size,10);
  assert.ok(exercises.every(row=>!prescriptionIds.has(row.id)));
  const unrecognized=context.libraryApi({action:'prepararCatalogoGeralHomologacao_',data:{},sessionToken:coach});
  assert.equal(unrecognized.error.code,'INVALID_ACTION');
  assert.deepEqual(plain(tables),before);
});
