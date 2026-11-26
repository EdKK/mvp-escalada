const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {fixture}=require('./helpers/gas.cjs');
function page(ok,redirect){
 const f=fixture();if(redirect!==undefined)f.properties.GOOGLE_REDIRECT_URI=redirect;
 f.context.completeGoogleLogin_=()=>ok;
 f.context.HtmlService={createHtmlOutputFromFile:name=>({getContent:()=>fs.readFileSync('apps-script/'+name+'.html','utf8')}),createHtmlOutput:html=>({html,meta:[],addMetaTag(name,value){this.meta.push({name,value});return this;},setTitle(){return this;}})};
 return f.context.doGet({parameter:{state:'not-rendered',code:'private-code-not-rendered'}});
}
test('OAuth success and failure use responsive presentation without exposing callback data',()=>{
 const success=page(true),failure=page(false);
 assert.match(success.html,/<h1[^>]*>Autenticação concluída<\/h1>/);
 assert.match(success.html,/Volte à aba original do MVP Escalada para entrar automaticamente/);
 assert.match(success.html,/font-size: 30px/);assert.match(success.html,/font-size: 19px/);assert.match(success.html,/Voltar ao MVP/);
 assert.equal(success.meta[0].name,'viewport');assert.match(success.html,/max-width: 500px/);
 assert.match(failure.html,/data-result="failure"/);assert.match(failure.html,/Não foi possível autenticar/);
 for(const p of [success,failure]){assert.doesNotMatch(p.html,/private-code-not-rendered|not-rendered|@@[A-Z_]+@@/);}
 assert.match(page(true,'https://attacker.invalid/?token=bad').html,/<p class="recovery" hidden>/);
 assert.doesNotMatch(page(true,'https://attacker.invalid/?token=bad').html,/attacker/);
});
test('return navigation preserves original-tab proof and has a fallback when closing is blocked',()=>{
 const html=page(true).html,script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 let handler,timer,attempts=0;const help={textContent:''};
 const context=vm.createContext({window:{top:{close(){attempts++;throw Error('sandbox');}},close(){attempts++;throw Error('blocked');}},document:{body:{dataset:{result:'success'}},getElementById:id=>id==='return-help'?help:{addEventListener(_,fn){handler=fn;}}},setTimeout:fn=>{timer=fn;}});
 vm.runInContext(script,context);assert.equal(typeof handler,'function');assert.equal(typeof timer,'function');
 timer();assert.equal(attempts,2);assert.match(help.textContent,/seletor de abas/);assert.match(help.textContent,/Não recarregue/);
 handler();assert.equal(attempts,4);assert.doesNotMatch(script,/location\.|window\.open|opener|finishLogin/);
});
