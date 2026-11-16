/* Purely local adapter: no passwords, OAuth, Google or real user records. */
window.StudentAPI=(()=>{
  const backend=createDemoBackend();
  function checked(action,data,key){const r=backend.api({action,data,requestId:key});if(!r.ok)throw Error(r.error.code);return r.data;}
  function populate(){
    backend.reset();backend.switchUser('hom-coach');
    const examples=[
      ['Aquecimento geral',{position:1,quantity:10,quantityUnit:'minutes',rpeApplicable:false},'Mobilizar ombros, punhos e quadril. Aumentar a intensidade progressivamente.'],
      ['Suspensão em borda 20 mm',{position:2,sets:4,quantity:6,quantityUnit:'hang_seconds',restSeconds:120,intensityMin:7,intensityMax:8,intensityUnit:'RPE',rpeApplicable:true},'Manter a escápula ativa e o corpo estável. Usar carga adicional se necessário para atingir a intensidade.'],
      ['Bote no Campus Board',{position:3,sets:3,quantity:4,quantityUnit:'moves',restSeconds:180,intensityMin:80,intensityMax:85,intensityUnit:'%1RM',rpeApplicable:true},'Executar com precisão. Manter o controle na recepção e respeitar a progressão definida pelo treinador.'],
      ['Mobilidade e desaquecimento',{position:4,sets:2,quantity:30,quantityUnit:'seconds',restSeconds:30,rpeApplicable:false},'Respirar de forma tranquila. Não forçar amplitude com dor.']
    ];
    ['2026-09-02','2026-09-04','2026-09-06','2026-09-08'].forEach((date,day)=>{
      const w=checked('createWorkout',{studentId:'hom-student-a',date,goal:day===1?'Potência de membros superiores e controle de pegada.':['Técnica de movimento e precisão dos pés.','Potência de membros superiores e controle de pegada.','Resistência e ritmo de escalada.','Recuperação ativa e mobilidade.'][day],instructions:['Aquecer 10 min.','Executar os exercícios na ordem.','Respeitar os intervalos.','Registrar o feedback ao final de cada exercício.']},'student-demo-w-'+day);
      examples.forEach(([exercise,prescription,notes],index)=>checked('addItem',{workoutId:w.id,block:index?'Força':'Aquecimento',category:index?'Finger strength':'Mobility',exercise,metric:prescription.quantityUnit,quantity:prescription.quantity,minutes:index?5:10,notes,prescription},'student-demo-i-'+day+'-'+index));
    });
    // The original two fixtures remain visible only to their respective owner.
    backend.switchUser('hom-student-a');
  }
  populate();
  return {isDemo:true,initialDate:'2026-09-04',call:async(action,data,key)=>{await new Promise(resolve=>setTimeout(resolve,80));return checked(action,data,key);},switchUser:id=>backend.switchUser(id),reset:populate};
})();
