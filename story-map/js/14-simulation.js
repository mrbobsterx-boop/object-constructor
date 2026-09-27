/* ============================================================
   MODULE 14 — СИМУЛЯЦИЯ (лёгкий inline-прогон)
   Это НЕ story-bot (отдельный полноценный бот-симулятор, `10-Story-Bot.md`) — здесь нет ни ИИ, ни
   полноценного игрового цикла, только прямой прогон той же логики, что уже описана в графе: старт →
   доступные выборы (по requires) → применение эффектов → следующий узел, плюс параллельно тикающие
   фоновые узлы по таймеру. Ничего не мутирует сам граф (nodes/variables не трогаются) — только
   локальное состояние прогона, поэтому доступно и в режиме "только чтение" (это навигация/просмотр,
   а не правка, как и остальные read-only-safe действия — Dependency Explorer, Проверки, клик по узлу).
   ============================================================ */

const SIM_STEP_CAP=200;

function simInitialVars(){
  const v={}; variables.forEach(x=>{ v[x.id]=num(x.start); }); return v;
}
function simEvalCond(cond,vars){
  if(!(cond.var in vars)) return false;
  return opTest(vars[cond.var],cond.op,cond.value);
}
// Клэмп к min/max переменной при применении эффекта — то же ограничение диапазона, что уже
// подразумевается в "Проверках" (conditionRangeImpossible, §5), просто применённое по-настоящему
// к значению, а не только к статическому анализу возможных условий.
function simApplyEffects(effects,vars){
  (effects||[]).forEach(e=>{
    if(!(e.var in vars)) return;
    if(e.op==='set') vars[e.var]=num(e.value);
    else if(e.op==='add') vars[e.var]+=num(e.value);
    else if(e.op==='subtract') vars[e.var]-=num(e.value);
    const v=findVariable(e.var);
    if(v){
      if(v.min!==undefined&&v.min!=='') vars[e.var]=Math.max(vars[e.var],num(v.min));
      if(v.max!==undefined&&v.max!=='') vars[e.var]=Math.min(vars[e.var],num(v.max));
    }
  });
}

let simState=null;

// Фоновые узлы тикают параллельно основной ветке, независимо от того, куда идёт игрок — тот же
// расчётный час, что и в "Таймлайне" (resolveScheduledHour, §17), только здесь он реально что-то
// делает (применяет effects), а не просто раскладывает узлы по ленте. Условные узлы (trigger.kind
// === 'conditions') сознательно НЕ активируются сами по себе без явного перехода — см. §18: их
// собственная активация вне графа рёбер choices — отдельный, неоднозначный вопрос, которым эта лёгкая
// симуляция не занимается (см. пояснение в документации).
function simFireDueScheduled(){
  if(simState.ended) return;
  let progressed=true;
  while(progressed){
    progressed=false;
    for(const n of nodes){
      if(n.trigger.kind!=='scheduled') continue;
      if(!(n.id in simState.nextDue)){
        const hour=resolveScheduledHour(n,new Set());
        simState.nextDue[n.id]=hour; // null — цепочка не резолвится, никогда не сработает (честно, как в Таймлайне)
      }
      const due=simState.nextDue[n.id];
      if(due===null||due===undefined) continue;
      if(simState.hours>=due){
        simApplyEffects(n.effects,simState.vars);
        simState.log.push({type:'scheduled',title:n.title,hour:due});
        simState.nextDue[n.id]=n.trigger.repeat?due+Math.max(1,num(n.trigger.afterHours)):null;
        progressed=true;
        if(n.ending){ simState.ended={type:'ending',label:n.ending}; return; }
      }
    }
  }
}
function simArriveAtNode(nodeId){
  const n=findNode(nodeId); if(!n) return;
  simState.nodeId=nodeId;
  simApplyEffects(n.effects,simState.vars);
  simState.hours+=num(n.sim&&n.sim.durationHours);
  simState.log.push({type:'visit',title:n.title,text:n.text});
  // Явный визит через переход "гасит" собственное фоновое расписание узла на этот раз (иначе он же
  // мог бы тут же "сработать" ещё раз сам по себе в simFireDueScheduled ниже и задвоить эффекты).
  if(n.trigger.kind==='scheduled'){
    const resolved=n.id in simState.nextDue?simState.nextDue[n.id]:resolveScheduledHour(n,new Set());
    simState.nextDue[n.id]=n.trigger.repeat&&resolved!==null?resolved+Math.max(1,num(n.trigger.afterHours)):null;
  }
  if(n.ending){ simState.ended={type:'ending',label:n.ending}; return; }
  simFireDueScheduled();
  if(!simState.ended&&!n.choices.length) simState.ended={type:'deadend'};
}
function simStart(){
  const startNode=nodes.find(n=>n.trigger.kind==='start');
  if(!startNode){ alert('Нет стартового узла — «Проверки» слева должны на это указывать.'); return; }
  simState={nodeId:null,vars:simInitialVars(),hours:0,nextDue:{},log:[],steps:0,ended:null};
  simArriveAtNode(startNode.id);
  document.getElementById('simModal').style.display='flex';
  renderSimulation();
}
function simPickChoice(choiceId){
  if(!simState||simState.ended) return;
  const n=findNode(simState.nodeId); if(!n) return;
  const c=n.choices.find(x=>x.id===choiceId); if(!c) return;
  if(!(c.requires||[]).every(r=>simEvalCond(r,simState.vars))) return;
  simApplyEffects(c.effects,simState.vars);
  simState.log.push({type:'choice',label:c.label||'(без текста)'});
  simState.steps++;
  if(simState.steps>=SIM_STEP_CAP){ simState.ended={type:'cap'}; renderSimulation(); return; }
  simArriveAtNode(c.target);
  renderSimulation();
}

function renderSimulation(){
  if(!simState) return;
  const n=findNode(simState.nodeId);
  const choicesHtml=(n?n.choices:[]).map(c=>{
    const failing=(c.requires||[]).filter(r=>!simEvalCond(r,simState.vars));
    const ok=!failing.length;
    const why=failing.map(r=>{ const v=findVariable(r.var); return `${v?v.name:r.var} ${opSymbol(r.op)} ${r.value}`; }).join(', ');
    return `<button class="full" style="margin-bottom:4px" data-simchoice="${esc(c.id)}" ${ok?'':'disabled'} title="${ok?'':esc('Недоступно: требуется '+why)}">${esc(c.label||'(без текста)')}</button>`;
  }).join('')||'<div class="hint">Нет переходов.</div>';
  const varsHtml=variables.map(v=>`<div class="row" style="justify-content:space-between;margin:0"><span>${esc(v.name)}</span><span>${esc(String(simState.vars[v.id]))}</span></div>`).join('')||'<div class="hint">Нет переменных.</div>';
  const logHtml=simState.log.slice().reverse().slice(0,60).map(entry=>{
    if(entry.type==='visit') return `<div class="idea-entry">📍 ${esc(entry.title)}</div>`;
    if(entry.type==='choice') return `<div class="idea-entry muted">→ ${esc(entry.label)}</div>`;
    if(entry.type==='scheduled') return `<div class="idea-entry">⏱ ${esc(entry.title)} (час ${entry.hour})</div>`;
    return '';
  }).join('');
  let endedHtml='';
  if(simState.ended){
    const e=simState.ended;
    if(e.type==='ending') endedHtml=`<div class="hint">🏁 Конец: <b>${esc(e.label)}</b></div>`;
    else if(e.type==='deadend') endedHtml=`<div class="hint">⛔ Тупик — у узла нет переходов и это не отмечено как концовка.</div>`;
    else if(e.type==='cap') endedHtml=`<div class="hint">⚠ Остановлено — превышен лимит в ${SIM_STEP_CAP} шагов (похоже на цикл без концовки).</div>`;
  }
  document.getElementById('simBody').innerHTML=`
    <div class="row" style="align-items:flex-start;gap:16px">
      <div style="flex:1.4;min-width:0">
        <h3 style="margin:0">${esc(n?n.title:'(?)')} <span class="muted small">· ${simState.hours} ч</span></h3>
        <div class="hint" style="margin:6px 0 10px;white-space:pre-wrap">${esc(n?n.text:'')||'<span class="muted">(нет текста)</span>'}</div>
        ${endedHtml}
        ${!simState.ended?choicesHtml:''}
      </div>
      <div style="flex:1;min-width:0">
        <h3 style="margin:0 0 6px">Переменные</h3>
        ${varsHtml}
      </div>
    </div>
    <h3 style="margin:12px 0 6px">Журнал</h3>
    <div style="max-height:160px;overflow-y:auto">${logHtml||'<div class="hint">Пусто.</div>'}</div>
  `;
}

document.getElementById('btnSimPlay').onclick=simStart;
document.getElementById('btnSimRestart').onclick=simStart;
document.getElementById('btnSimClose').onclick=()=>{ document.getElementById('simModal').style.display='none'; simState=null; };
document.getElementById('simBody').addEventListener('click',e=>{
  const btn=e.target.closest('[data-simchoice]');
  if(btn) simPickChoice(btn.dataset.simchoice);
});
