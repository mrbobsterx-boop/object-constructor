/* ============================================================
   MODULE 05 — ПРОВЕРКИ ГРАФА
   Тот же принцип, что в Project Registry/Object Plan: список проблем с уровнем (err/warn/info).
   ============================================================ */

function runChecks(){
  const out=[];
  const varIds=new Set(variables.map(v=>v.id));
  const nodeIds=new Set(nodes.map(n=>n.id));

  if(!nodes.some(n=>n.trigger.kind==='start')) out.push({level:'err',text:'Нет ни одного узла со стартовым триггером «▶ Старт» — с чего игра вообще начинается?'});

  nodes.forEach(n=>{
    const checkVar=(id,where)=>{ if(id&&!varIds.has(id)) out.push({level:'err',text:`«${n.title}»: ${where} ссылается на несуществующую переменную.`}); };
    (n.trigger.kind==='conditions'?n.trigger.all:[]).forEach(c=>checkVar(c.var,'условие доступности'));
    n.effects.forEach(e=>checkVar(e.var,'эффект узла'));
    if(n.trigger.kind==='scheduled'&&n.trigger.sinceNode&&!nodeIds.has(n.trigger.sinceNode)) out.push({level:'err',text:`«${n.title}»: отсчёт таймера ведётся от несуществующего узла.`});

    n.choices.forEach(c=>{
      if(!c.target||!nodeIds.has(c.target)) out.push({level:'err',text:`«${n.title}» → «${c.label||'?'}»: переход ведёт в несуществующий узел.`});
      c.requires.forEach(r=>checkVar(r.var,`условие перехода «${c.label||'?'}»`));
      c.effects.forEach(e=>checkVar(e.var,`эффект перехода «${c.label||'?'}»`));
    });

    if(!n.choices.length&&!n.ending) out.push({level:'info',text:`«${n.title}»: нет ни переходов, ни отметки концовки — тупик без развития.`});
  });

  const reachable=new Set(nodes.filter(n=>n.trigger.kind!=='conditions').map(n=>n.id));
  let grown=true;
  while(grown){
    grown=false;
    nodes.forEach(n=>{ if(reachable.has(n.id)) n.choices.forEach(c=>{ if(c.target&&!reachable.has(c.target)){ reachable.add(c.target); grown=true; } }); });
  }
  nodes.forEach(n=>{ if(n.trigger.kind==='conditions'&&!reachable.has(n.id)) out.push({level:'info',text:`«${n.title}»: недостижим — ни один переход и ни одно фоновое/стартовое событие на него не ведёт.`}); });

  return out;
}
function renderChecks(){
  const el=document.getElementById('checksList');
  const problems=runChecks();
  el.innerHTML=problems.length?problems.map(p=>`<div class="check-item ${p.level}">${esc(p.text)}</div>`).join(''):'<div class="hint">Проблем не найдено.</div>';
}
