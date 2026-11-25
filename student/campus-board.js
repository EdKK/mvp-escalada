/* Render one prescribed repetition from its stored snapshot. */
function renderCampusBoard(path){
  const figure=document.createElement('figure');
  figure.className='campus-board';
  const caption=document.createElement('figcaption');
  caption.textContent='Campus Board • trajetória de uma repetição';
  figure.append(caption);
  const svgNode=(name,attributes={},label)=>{
    const element=document.createElementNS('http://www.w3.org/2000/svg',name);
    Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,value));
    if(label!==undefined)element.textContent=label;
    return element;
  };
  const svg=svgNode('svg',{viewBox:'0 0 360 420',role:'img','aria-label':'Dez agarras numeradas e trajetórias das duas mãos. A sequência completa aparece abaixo.'});
  const height=hold=>392-(hold-1)*40;
  const colors={E:'#1459a6',D:'#a94706'};
  svg.append(svgNode('rect',{x:163,y:12,width:34,height:396,rx:9,fill:'#e5eaf3'}));
  for(let hold=1;hold<=path.holdCount;hold++){
    svg.append(svgNode('rect',{x:166,y:height(hold)-8,width:28,height:16,rx:4,fill:hold===path.start?'#294468':'#fff',stroke:'#8b9bb0'}));
    svg.append(svgNode('text',{x:180,y:height(hold)+4,'text-anchor':'middle',fill:hold===path.start?'#fff':'#253650','font-size':11},hold));
  }

  const last={E:path.start,D:path.start};
  const count={E:0,D:0},index={E:0,D:0};
  path.steps.forEach(step=>step.forEach(token=>count[token[0]]++));
  const badges=[];
  path.steps.forEach((step,order)=>step.forEach(token=>{
    const hand=token[0],hold=Number(token.slice(1)),from=last[hand];
    const side=hand==='E'?-1:1,color=colors[hand];
    const edge=180+side*16,lane=180+side*(35+128*(++index[hand]-1)/Math.max(1,count[hand]-1));
    const source=height(from),target=height(hold);
    const end=180+side*18;
    const rebound=from===hold;
    // Separate lanes preserve returns and concurrent movements over the same rungs.
    const line=rebound
      ?`M ${edge} ${source+5} C ${lane} ${source+22}, ${lane} ${source-22}, ${end} ${source-5}`
      :`M ${edge} ${source} Q ${lane} ${source} ${lane} ${(source+target)/2} Q ${lane} ${target} ${end} ${target}`;
    svg.append(svgNode('path',{d:line,fill:'none',stroke:color,'stroke-width':1.65,'stroke-dasharray':'2 4','stroke-linecap':'round','data-hand':hand,'data-from':from,'data-to':hold,'data-order':order+1}));
    const tipY=target-(rebound?5:0);
    svg.append(svgNode('path',{d:`M ${end+side*6} ${tipY-3} L ${end} ${tipY} L ${end+side*6} ${tipY+3}`,stroke:color,fill:'none','stroke-width':1.6}));
    const badgeX=rebound?(edge+lane*3)/4:lane;
    const badgeY=rebound?target-15:(source+target)/2+Math.sign(target-source)*9;
    badges.push(svgNode('circle',{cx:badgeX,cy:badgeY,r:7.5,fill:'#fff',stroke:color}));
    badges.push(svgNode('text',{x:badgeX,y:badgeY+3,'text-anchor':'middle',fill:color,'font-size':9,'font-weight':700},order+1));
    last[hand]=hold;
  }));
  svg.append(...badges);
  figure.append(svg);
  const legend=document.createElement('p');
  legend.className='campus-legend';
  for(const [hand,label] of [['E','E · mão esquerda'],['D','D · mão direita']]){
    const item=document.createElement('span');
    item.style.color=colors[hand];
    item.textContent=label;
    legend.append(item);
  }
  const notation=document.createElement('p');
  notation.className='campus-notation';
  notation.textContent='Início E'+path.start+'+D'+path.start+' · '+path.steps.map((step,index)=>(index+1)+'. '+step.join('+')).join(' · ');
  figure.append(legend,notation);
  return figure;
}
