const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {fixture}=require('./helpers/gas.cjs');
const css=fs.readFileSync('student/style.css','utf8');
function matches(query,w,h){return [...query.matchAll(/\((min-width|max-width|max-height|orientation):\s*([^)]*)\)/g)].every(([,key,value])=>key==='orientation'?(value.trim()==='landscape'?w>h:h>=w):key==='min-width'?w>=parseFloat(value):key==='max-width'?w<=parseFloat(value):h<=parseFloat(value));}
// Evaluate the declaration cascade for layout contracts; this does not render a browser.
function declarations(selector,w,h,text=css){const result={};let pos=0;while(pos<text.length){const begin=text.indexOf('{',pos);if(begin<0)break;const header=text.slice(pos,begin).replace(/\/\*[\s\S]*?\*\//g,'').trim();let level=1,end=begin+1;for(;end<text.length&&level;end++){if(text[end]==='{')level++;if(text[end]==='}')level--;}const body=text.slice(begin+1,end-1);if(header.startsWith('@media')){if(!header.includes('prefers-')&&matches(header,w,h))Object.assign(result,declarations(selector,w,h,body));}else if(header.split(',').map(s=>s.trim()).includes(selector)){body.split(';').forEach(part=>{const idx=part.indexOf(':');if(idx>0)result[part.slice(0,idx).trim()]=part.slice(idx+1).trim();});}pos=end;}return result;}
test('Apps Script student route supplies the effective device viewport',()=>{
 const f=fixture();f.context.HtmlService={createHtmlOutputFromFile:name=>({getContent:()=>'<html>'+name+' @@COACH_URL@@</html>'}),createHtmlOutput:html=>({html,meta:[],addMetaTag(name,value){this.meta.push({name,value});return this;},setTitle(){return this;}})};
 for(const query of [undefined,{parameter:{view:'student'}}]){const page=f.context.doGet(query);assert.equal(page.meta.length,1);assert.equal(page.meta[0].name,'viewport');assert.equal(page.meta[0].value,'width=device-width, initial-scale=1, viewport-fit=cover');assert.doesNotMatch(page.meta[0].value,/maximum-scale|user-scalable/);}
});
test('portrait and landscape phone widths do not acquire a desktop frame',()=>{
 for(const [w,h] of [[320,568],[375,667],[390,844],[430,932],[667,375],[844,390],[932,430],[1024,600]]){
  const shell=declarations('.app-shell',w,h);assert.equal(shell.width,'100%',`${w}x${h}`);assert.equal(shell['max-width'],'none');assert.equal(shell.margin,'0');assert.equal(shell.border,'0');assert.equal(shell['border-radius'],'0');
  const days=declarations('.days',w,h);assert.equal(days['min-width'],'0');assert.equal(days['overflow-x'],'auto');assert.equal(days['justify-content'],'flex-start');
  const metric=declarations('.metric span',w,h);assert.equal(metric['white-space'],'normal');assert.equal(declarations('.content',w,h)['min-width'],'0');
  assert.equal(declarations('input',w,h)['font-size'],'16px');assert.equal(declarations('.timer-btn',w,h)['min-height'],'48px');
 }
 assert.equal(declarations('.form-grid',320,568)['grid-template-columns'],'minmax(0,1fr)');
 assert.equal(declarations('.metrics',932,430)['grid-template-columns'],'repeat(4,minmax(0,1fr))');
 assert.equal(declarations('.overlay',844,390)['align-items'],'flex-start');
});
test('generated Google and demo pages include current responsive CSS and unchanged source controllers',()=>{
 const style=css.replace('assets/climbing.jpg','PHOTO');
 for(const path of ['apps-script/Student.html','demo/student.html']){
  const html=fs.readFileSync(path,'utf8');const normalized=html.replace(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g,'PHOTO').replace('assets/climbing.jpg','PHOTO');
  assert.ok(normalized.includes(style),path);assert.ok(html.includes(fs.readFileSync('student/app.js','utf8')));assert.ok(html.includes(fs.readFileSync('student/model.js','utf8')));
 }
});
