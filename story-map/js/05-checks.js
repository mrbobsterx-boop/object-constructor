/* ============================================================
   MODULE 05 — ПРОВЕРКИ ГРАФА
   Тот же принцип, что в Project Registry/Object Plan: список проблем с уровнем (err/warn/info).
   Каждая проблема, где это применимо, несёт nodeId — клик по ней в панели выделяет и центрирует
   этот узел на холсте, чтобы список проверок был инструментом навигации, а не просто текстом.
   ============================================================ */

// «Структурно достижим» — есть путь по choices от стартового или фонового узла. Это НЕ то же самое,
// что «может ли вообще сработать условие узла» (это была бы задача о выполнимости условий — сюда не
// входит): узел с trigger.kind==='conditions' технически может сработать и без единого входящего
// перехода, если его условие завязано только на мировые переменные, которые меняются откуда-то ещё.
// Поэтому это отдельная, более узкая проверка, и формулировка ниже это прямо оговаривает.
function computeReachable(){
  const reachable=new Set(nodes.filter(n=>n.trigger.kind!=='conditions').map(n=>n.id));
  let grown=true;
  while(grown){
    grown=false;
    nodes.forEach(n=>{ if(reachable.has(n.id)) n.choices.forEach(c=>{ if(c.target&&!reachable.has(c.target)){ reachable.add(c.target); grown=true; } }); });
  }
  return reachable;
}

function runChecks(){
  const out=[];
  const varIds=new Set(variables.map(v=>v.id));
  const nodeIds=new Set(nodes.map(n=>n.id));

  const startNodes=nodes.filter(n=>n.trigger.kind==='start');
  if(!startNodes.length) out.push({level:'err',text:'Нет ни одного узла со стартовым триггером «▶ Старт» — с чего игра вообще начинается?'});
  if(startNodes.length>1) startNodes.forEach(n=>out.push({level:'err',text:`«${n.title}»: стартовых узлов несколько (${startNodes.length}) — игра не может начинаться сразу из двух точек.`,nodeId:n.id}));

  const usedVars=new Set();
  nodes.forEach(n=>{
    const checkVar=(id,where)=>{ if(!id) return; usedVars.add(id); if(!varIds.has(id)) out.push({level:'err',text:`«${n.title}»: ${where} ссылается на несуществующую переменную.`,nodeId:n.id}); };
    (n.trigger.kind==='conditions'?n.trigger.all:[]).forEach(c=>checkVar(c.var,'условие доступности'));
    n.effects.forEach(e=>checkVar(e.var,'эффект узла'));
    if(n.trigger.kind==='scheduled'&&n.trigger.sinceNode&&!nodeIds.has(n.trigger.sinceNode)) out.push({level:'err',text:`«${n.title}»: отсчёт таймера ведётся от несуществующего узла.`,nodeId:n.id});
    if(n.sim&&(num(n.sim.dangerChance,0)<0||num(n.sim.dangerChance,0)>1)) out.push({level:'warn',text:`«${n.title}»: шанс опасности должен быть от 0 до 1, сейчас ${n.sim.dangerChance}.`,nodeId:n.id});
    if(!n.text||!n.text.trim()) out.push({level:'info',text:`«${n.title}»: нет текста — игрок ничего не увидит на этом узле.`,nodeId:n.id});

    n.choices.forEach(c=>{
      if(!c.target||!nodeIds.has(c.target)) out.push({level:'err',text:`«${n.title}» → «${c.label||'?'}»: переход ведёт в несуществующий узел.`,nodeId:n.id});
      c.requires.forEach(r=>checkVar(r.var,`условие перехода «${c.label||'?'}»`));
      c.effects.forEach(e=>checkVar(e.var,`эффект перехода «${c.label||'?'}»`));
    });

    if(!n.choices.length&&!n.ending) out.push({level:'info',text:`«${n.title}»: нет ни переходов, ни отметки концовки — тупик без развития.`,nodeId:n.id});
  });

  variables.forEach(v=>{
    if(!usedVars.has(v.id)) out.push({level:'warn',text:`«${v.name}»: переменная нигде не используется — ни в условиях, ни в эффектах.`});
    if(num(v.min,0)>num(v.max,100)) out.push({level:'warn',text:`«${v.name}»: минимум (${v.min}) больше максимума (${v.max}).`});
  });

  const reachable=computeReachable();
  nodes.forEach(n=>{ if(n.trigger.kind==='conditions'&&!reachable.has(n.id)) out.push({level:'info',text:`«${n.title}»: нет входящих переходов и это не старт/фоновое — либо забыт, либо специально задуман как активируемый только условием (зависит лишь от мировых переменных).`,nodeId:n.id}); });

  const endingCount=nodes.filter(n=>n.ending).length;
  const unreachableCount=nodes.filter(n=>n.trigger.kind==='conditions'&&!reachable.has(n.id)).length;

  // Слой мира: сущности/связи — отдельный граф, но проверяем его тем же списком, чтобы дырки
  // (сущность удалили вручную из JSON, тип связи переименовали) не оставались незамеченными.
  const entityIds=new Set(entities.map(e=>e.id));
  const relationTypeIds=new Set(relationTypes.map(t=>t.id));
  entities.forEach(e=>{
    const kind=entityKindDef(e.kind);
    if(kind.catalog&&e.ref&&e.ref.refId&&!catalogOptionsFor(kind.catalog).some(o=>o.id===e.ref.refId)){
      out.push({level:'warn',text:`Сущность «${entityDisplayName(e)}»: ссылка на «${e.ref.refId}» в каталоге ${kind.catalog} больше не найдена (переименовано/удалено в Object Plan?).`});
    }
  });
  relations.forEach(r=>{
    const fromOk=entityIds.has(r.from), toOk=entityIds.has(r.to);
    if(!fromOk) out.push({level:'err',text:`Связь «${relationTypeLabel(r.type)}»: сторона «от» ссылается на несуществующую сущность.`});
    if(!toOk) out.push({level:'err',text:`Связь «${relationTypeLabel(r.type)}»: сторона «к» ссылается на несуществующую сущность.`});
    if(!relationTypeIds.has(r.type)) out.push({level:'err',text:`Связь (${fromOk?entityDisplayName(findEntity(r.from)):'?'} → ${toOk?entityDisplayName(findEntity(r.to)):'?'}): неизвестный тип связи.`});
  });
  // Story ↔ World: узел ссылается (node.refs) на сущность, которую с тех пор удалили из "Мира".
  nodes.forEach(n=>{
    (n.refs||[]).forEach(rid=>{
      if(rid&&!entityIds.has(rid)) out.push({level:'warn',text:`«${n.title}»: ссылается на сущность мира, которой больше нет (удалена в режиме «Мир»?).`,nodeId:n.id});
    });
  });

  out.unshift({level:'summary',text:`Узлов: ${nodes.length} · переменных: ${variables.length} · концовок: ${endingCount} · без входящих переходов: ${unreachableCount} · сущностей: ${entities.length} · связей: ${relations.length}`});

  return out;
}
function renderChecks(){
  const el=document.getElementById('checksList');
  const problems=runChecks();
  el.innerHTML=problems.map(p=>{
    if(p.level==='summary') return `<div class="check-summary">${esc(p.text)}</div>`;
    return `<div class="check-item ${p.level} ${p.nodeId?'clickable':''}" ${p.nodeId?`data-checknode="${esc(p.nodeId)}"`:''}>${esc(p.text)}</div>`;
  }).join('') || '<div class="hint">Проблем не найдено.</div>';
}
document.getElementById('checksList').addEventListener('click',e=>{
  const item=e.target.closest('[data-checknode]'); if(!item) return;
  selectNode(item.dataset.checknode); focusNode(item.dataset.checknode);
});
