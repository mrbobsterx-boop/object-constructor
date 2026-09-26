/* ============================================================
   MODULE 02 — ДВИЖОК СИМУЛЯЦИИ (чистые функции, без DOM)
   Читает граф из storyData (nodes/variables, как их пишет Story Map). Игрок — не настоящий человек,
   а простая жадная стратегия: на каждом переходе считает очки риска/выгоды по sim-полям (см.
   scoreChoice) и берёт лучший вариант с небольшим случайным шумом для разброса между прогонами.
   Голод/жажда/здоровье — встроенные ресурсы движка (0…100), не путать с авторскими `variables`
   (репутация фракций и т.п.) — те меняются только через effects узлов/переходов.
   ============================================================ */

function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function opApply(cur,op,value){
  if(op==='set')return value; if(op==='add')return cur+value; if(op==='subtract')return cur-value; return cur;
}
function conditionsPass(ws,list){ return (list||[]).every(c=>opTest(ws.vars[c.var],c.op,num(c.value))); }

function urgencyOf(level,critical){ return level<=critical?3:(level<=45?1:0.25); }
function scoreChoice(ws,choice,params,rng){
  let score=rng()*1.5;
  const danger=num(choice.sim&&choice.sim.dangerChance,0)*params.dangerMul;
  score-=danger*12;
  const foodCost=num(choice.sim&&choice.sim.foodCost,0), waterCost=num(choice.sim&&choice.sim.waterCost,0);
  score-=Math.max(0,foodCost)*urgencyOf(ws.hunger,params.critical)*0.8;
  score-=Math.max(0,waterCost)*urgencyOf(ws.thirst,params.critical)*0.8;
  score+=Math.max(0,-foodCost)*urgencyOf(ws.hunger,params.critical)*1.2;
  score+=Math.max(0,-waterCost)*urgencyOf(ws.thirst,params.critical)*1.2;
  return score;
}
function reasonFor(choice,params,ws){
  const parts=[];
  if(num(choice.sim&&choice.sim.dangerChance,0)>0) parts.push('риск '+Math.round(num(choice.sim.dangerChance,0)*100)+'%');
  const fc=num(choice.sim&&choice.sim.foodCost,0), wc=num(choice.sim&&choice.sim.waterCost,0);
  if(fc<0) parts.push('восполняет еду'); else if(fc>0) parts.push('стоит еды '+fc);
  if(wc<0) parts.push('восполняет воду'); else if(wc>0) parts.push('стоит воды '+wc);
  if(ws.hunger<=params.critical) parts.push('голод критический');
  if(ws.thirst<=params.critical) parts.push('жажда критическая');
  return parts.length?parts.join(', '):'нейтральный вариант, выбран случайно среди равных';
}

function initWorldState(story){
  const vars={};
  (story.variables||[]).forEach(v=>{ vars[v.id]=num(v.start,0); });
  return {vars,hunger:100,thirst:100,health:100,hour:0};
}
function applyEffects(ws,list){
  const deltas=[];
  (list||[]).forEach(e=>{
    const before=ws.vars[e.var];
    if(before===undefined) return;
    ws.vars[e.var]=opApply(before,e.op,num(e.value));
    deltas.push({var:e.var,from:before,to:ws.vars[e.var]});
  });
  return deltas;
}

function runOnce(story,params,seed){
  const rng=mulberry32(seed);
  const ws=initWorldState(story);
  const startNode=story.nodes.find(n=>n.trigger&&n.trigger.kind==='start');
  const log=[]; const fired={}, lastFired={};
  if(!startNode) return {outcome:'no_start',log,hours:0};

  function checkBackground(){
    story.nodes.forEach(n=>{
      if(!n.trigger||n.trigger.kind!=='scheduled') return;
      const anchor=n.trigger.sinceNode?lastFired[n.trigger.sinceNode]:0;
      if(anchor===undefined) return; // ждём узел-отсчёт, который ещё не сработал
      const due=anchor+num(n.trigger.afterHours,0);
      const already=lastFired[n.id];
      const shouldFire=ws.hour>=due&&(already===undefined||(n.trigger.repeat&&ws.hour>=already+num(n.trigger.afterHours,0)));
      if(!shouldFire) return;
      const deltas=applyEffects(ws,n.effects);
      lastFired[n.id]=ws.hour; fired[n.id]=true;
      log.push({hour:ws.hour,day:Math.floor(ws.hour/24),kind:'background',nodeId:n.id,title:n.title,why:'фоновое событие сработало само по таймеру',deltas,ending:n.ending||null});
    });
  }

  let current=startNode, steps=0;
  while(steps++<params.maxSteps){
    checkBackground();
    lastFired[current.id]=ws.hour; fired[current.id]=true;
    const deltas=applyEffects(ws,current.effects);
    log.push({hour:ws.hour,day:Math.floor(ws.hour/24),kind:'node',nodeId:current.id,title:current.title,why:current.trigger.kind==='start'?'старт':'пришёл сюда по выбору',deltas,ending:current.ending||null});

    if(current.ending) return finish(current.ending);
    if(ws.health<=0) return finish('death');

    const dur=num(current.sim&&current.sim.durationHours,1);
    ws.hunger=Math.max(0,ws.hunger-num(current.sim&&current.sim.foodCost,0)-dur*params.foodRate*0.1);
    ws.thirst=Math.max(0,ws.thirst-num(current.sim&&current.sim.waterCost,0)-dur*params.waterRate*0.1);
    if(ws.hunger<=0||ws.thirst<=0) ws.health=Math.max(0,ws.health-8*dur/24-4);
    if(rng()<num(current.sim&&current.sim.dangerChance,0)*params.dangerMul) ws.health=Math.max(0,ws.health-(15+rng()*20));
    ws.hour+=dur;

    if(ws.health<=0){ log[log.length-1].warnings=['здоровье упало до нуля']; return finish('death'); }

    const options=(current.choices||[]).filter(c=>c.target&&conditionsPass(ws,c.requires));
    if(!options.length) return finish('stuck');
    let best=options[0], bestScore=-Infinity;
    options.forEach(c=>{ const s=scoreChoice(ws,c,params,rng); if(s>bestScore){ bestScore=s; best=c; } });
    const choiceDeltas=applyEffects(ws,best.effects);
    log.push({hour:ws.hour,day:Math.floor(ws.hour/24),kind:'choice',nodeId:current.id,choiceLabel:best.label,why:reasonFor(best,params,ws),deltas:choiceDeltas});
    const next=story.nodes.find(n=>n.id===best.target);
    if(!next) return finish('broken_link');
    current=next;
  }
  return finish('timeout');

  function finish(outcome){ return {outcome,log,hours:ws.hour,finalVars:{...ws.vars},hunger:ws.hunger,thirst:ws.thirst,health:ws.health}; }
}

function runBatch(story,params,n){
  const results=[];
  for(let i=0;i<n;i++) results.push(runOnce(story,params,params.seed*1000+i));
  return results;
}
