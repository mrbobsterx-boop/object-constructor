/* ============================================================
   MODULE 05 — ПРОВЕРКИ ГРАФА
   Тот же принцип, что в Project Registry/Object Plan: список проблем с уровнем (err/warn/info).
   Каждая проблема, где это применимо, несёт nodeId/entityId/varId — клик по ней в панели выделяет и
   центрирует узел, открывает сущность в «Мире» или раскрывает Dependency Explorer переменной, чтобы
   список проверок был инструментом навигации, а не просто текстом.
   ============================================================ */

// «Структурно достижим» (Graph Reachability) — есть путь по choices от стартового/фонового узла.
// Это НЕ то же самое, что «может ли вообще сработать условие узла» (Runtime Availability, см. ниже
// checkConditionRuntimeAvailability) — узел с trigger.kind==='conditions' технически может сработать
// и без единого входящего перехода, если его условие завязано только на мировые переменные, которые
// меняются откуда-то ещё. Поэтому это отдельная, более узкая проверка.
function computeReachable(){
  const reachable=new Set(nodes.filter(n=>n.trigger.kind!=='conditions').map(n=>n.id));
  let grown=true;
  while(grown){
    grown=false;
    nodes.forEach(n=>{ if(reachable.has(n.id)) n.choices.forEach(c=>{ if(c.target&&!reachable.has(c.target)){ reachable.add(c.target); grown=true; } }); });
  }
  return reachable;
}

// Есть ли у переменной ЗАДАННЫЙ диапазон, внутри которого условие в принципе может быть истинным —
// не зависит от того, что где-то происходит в графе, чисто по объявленным min/max самой переменной.
function conditionRangeImpossible(cond,variable){
  const val=num(cond.value); const min=num(variable.min,0), max=num(variable.max,100);
  if(cond.op==='>=') return val>max;
  if(cond.op==='<=') return val<min;
  if(cond.op==='>') return val>=max;
  if(cond.op==='<') return val<=min;
  if(cond.op==='==') return val>max||val<min;
  return false;
}
// Грубый, но честный интервальный анализ: сводим каждое условие к допустимому диапазону значений
// (">="/"<="/">"/"<"/"==") и пересекаем все условия на ОДНУ переменную внутри ОДНОГО списка "и все
// должны выполняться" — если пересечение пусто, список логически невыполним ни при каком значении.
// "!=" сознательно не сужает интервал (не даёт ложных срабатываний) — это не панацея от всех
// противоречий, а достаточно надёжное покрытие частых случаев (x>=50 И x<30 и т.п.).
function intervalFromCond(op,value){
  const v=num(value), EPS=1e-9;
  if(op==='>=') return [v,Infinity];
  if(op==='<=') return [-Infinity,v];
  if(op==='>') return [v+EPS,Infinity];
  if(op==='<') return [-Infinity,v-EPS];
  if(op==='==') return [v,v];
  return null;
}
function contradictingVarsIn(list){
  const byVar={};
  (list||[]).forEach(c=>{ if(c.var) (byVar[c.var]=byVar[c.var]||[]).push(c); });
  const bad=[];
  Object.keys(byVar).forEach(varId=>{
    if(byVar[varId].length<2) return;
    let lo=-Infinity,hi=Infinity;
    byVar[varId].forEach(c=>{ const iv=intervalFromCond(c.op,c.value); if(iv){ lo=Math.max(lo,iv[0]); hi=Math.min(hi,iv[1]); } });
    if(lo>hi) bad.push(varId);
  });
  return bad;
}

function runChecks(){
  const out=[];
  const varIds=new Set(variables.map(v=>v.id));
  const nodeIds=new Set(nodes.map(n=>n.id));

  // --- Целостность: дубликаты id (структурно не должно случаться в самом приложении — uid()
  // всегда уникален, — но JSON мог быть отредактирован руками или собран из нескольких файлов) ---
  const nodeIdCounts={}; nodes.forEach(n=>{ nodeIdCounts[n.id]=(nodeIdCounts[n.id]||0)+1; });
  Object.entries(nodeIdCounts).forEach(([id,count])=>{ if(count>1) out.push({level:'err',text:`Найдено ${count} узла с одинаковым id «${id}» — ссылки на него станут неоднозначными, оставь только один.`}); });
  const varIdCounts={}; variables.forEach(v=>{ varIdCounts[v.id]=(varIdCounts[v.id]||0)+1; });
  Object.entries(varIdCounts).forEach(([id,count])=>{ if(count>1) out.push({level:'err',text:`Найдено ${count} переменных с одинаковым id «${id}» — условия/эффекты не смогут однозначно понять, какую из них имели в виду.`}); });

  const startNodes=nodes.filter(n=>n.trigger.kind==='start');
  if(!startNodes.length) out.push({level:'err',text:'Нет ни одного узла со стартовым триггером «▶ Старт» — с чего игра вообще начинается?'});
  if(startNodes.length>1) startNodes.forEach(n=>out.push({level:'err',text:`«${n.title}»: стартовых узлов несколько (${startNodes.length}) — игра не может начинаться сразу из двух точек.`,nodeId:n.id}));

  // Кто вообще пишет каждую переменную (для Runtime Availability ниже) — нужен ПОЛНЫЙ проход по
  // эффектам заранее, поэтому это отдельный первый проход, до проверки условий.
  const writtenVars=new Set();
  nodes.forEach(n=>{
    n.effects.forEach(e=>{ if(e.var) writtenVars.add(e.var); });
    n.choices.forEach(c=>c.effects.forEach(e=>{ if(e.var) writtenVars.add(e.var); }));
  });
  relations.forEach(r=>(r.effects||[]).forEach(e=>{ if(e.var) writtenVars.add(e.var); }));

  // Runtime Availability — не «есть ли путь до узла», а «может ли САМО условие когда-нибудь стать
  // истинным». Два независимых, доказуемых случая (без полного перебора всех состояний игры):
  //  1) значение вне объявленного диапазона переменной — невозможно ни при каких эффектах;
  //  2) ничто в графе эту переменную не меняет, а стартовое значение условию не удовлетворяет.
  function checkConditionAvailability(cond,whereLabel,nodeId){
    const v=findVariable(cond.var); if(!v) return; // несуществующая переменная — уже поймано ниже
    if(conditionRangeImpossible(cond,v)){
      out.push({level:'err',text:`${whereLabel}: условие «${v.name} ${opSymbol(cond.op)} ${cond.value}» невозможно в принципе — переменная ограничена диапазоном [${v.min}…${v.max}].`,nodeId,varId:v.id});
    } else if(!writtenVars.has(cond.var)&&!opTest(num(v.start,0),cond.op,num(cond.value))){
      out.push({level:'err',text:`${whereLabel}: условие «${v.name} ${opSymbol(cond.op)} ${cond.value}» никогда не станет истинным — ничто в графе не меняет эту переменную, а начальное значение (${v.start}) ему не удовлетворяет.`,nodeId,varId:v.id});
    }
  }
  function checkContradictions(list,whereLabel,nodeId){
    contradictingVarsIn(list).forEach(varId=>{
      const v=findVariable(varId);
      out.push({level:'err',text:`${whereLabel}: несколько условий на «${v?v.name:varId}» одновременно невыполнимы (в списке действуют все сразу).`,nodeId,varId});
    });
  }

  const hasIncoming=new Set();
  nodes.forEach(n=>n.choices.forEach(c=>{ if(c.target) hasIncoming.add(c.target); }));

  nodes.forEach(n=>{
    const checkVar=(id,where)=>{ if(!id) return; if(!varIds.has(id)) out.push({level:'err',text:`«${n.title}»: ${where} ссылается на несуществующую переменную.`,nodeId:n.id}); };
    const triggerConds=n.trigger.kind==='conditions'?n.trigger.all:[];
    triggerConds.forEach(c=>checkVar(c.var,'условие доступности'));
    n.effects.forEach(e=>checkVar(e.var,'эффект узла'));
    if(triggerConds.length) checkContradictions(triggerConds,`«${n.title}»: условие доступности`,n.id);
    triggerConds.forEach(c=>checkConditionAvailability(c,`«${n.title}»: условие доступности`,n.id));
    if(n.trigger.kind==='scheduled'&&n.trigger.sinceNode&&!nodeIds.has(n.trigger.sinceNode)) out.push({level:'err',text:`«${n.title}»: отсчёт таймера ведётся от несуществующего узла.`,nodeId:n.id});
    if(n.sim&&(num(n.sim.dangerChance,0)<0||num(n.sim.dangerChance,0)>1)) out.push({level:'warn',text:`«${n.title}»: шанс опасности должен быть от 0 до 1, сейчас ${n.sim.dangerChance}.`,nodeId:n.id});
    if(!n.text||!n.text.trim()) out.push({level:'info',text:`«${n.title}»: нет текста — игрок ничего не увидит на этом узле.`,nodeId:n.id});

    const targetCounts={};
    n.choices.forEach(c=>{
      if(!c.target||!nodeIds.has(c.target)) out.push({level:'err',text:`«${n.title}» → «${c.label||'?'}»: переход ведёт в несуществующий узел.`,nodeId:n.id});
      else targetCounts[c.target]=(targetCounts[c.target]||0)+1;
      c.requires.forEach(r=>checkVar(r.var,`условие перехода «${c.label||'?'}»`));
      c.effects.forEach(e=>checkVar(e.var,`эффект перехода «${c.label||'?'}»`));
      if(c.requires.length) checkContradictions(c.requires,`«${n.title}» → «${c.label||'?'}»: условие`,n.id);
      c.requires.forEach(r=>checkConditionAvailability(r,`«${n.title}» → «${c.label||'?'}»: условие`,n.id));
    });
    Object.entries(targetCounts).forEach(([tid,count])=>{
      if(count>1){ const t=findNode(tid); out.push({level:'info',text:`«${n.title}»: ${count} перехода ведут в один и тот же узел «${t?t.title:'?'}» — возможно, задвоение (или это намеренно — например, разные варианты одной и той же встречи).`,nodeId:n.id}); }
    });

    const noOut=!n.choices.length, noEnd=!n.ending, noIn=!hasIncoming.has(n.id);
    const isolated=noOut&&noEnd&&noIn&&n.trigger.kind==='conditions';
    if(isolated) out.push({level:'info',text:`«${n.title}»: полностью изолирован — нет ни входящих, ни исходящих переходов, ни отметки концовки.`,nodeId:n.id});
    // warn, не info: если у узла нет ни переходов, ни отметки концовки — почти всегда забытая ветка
    // (в отличие от "изолирован" выше, где узел без единого входящего перехода вполне может быть
    // намеренным заделом на будущее). Явно отмеченная концовка (n.ending) исключает узел отсюда
    // совсем — "тупик+концовка" всегда OK, это и есть нормальный конец истории.
    else if(noOut&&noEnd) out.push({level:'warn',text:`«${n.title}»: нет ни переходов, ни отметки концовки — тупик без развития. Если это финал, впиши что-нибудь в поле «Концовка».`,nodeId:n.id});
  });

  variables.forEach(v=>{
    const isRead=nodes.some(n=>(n.trigger.kind==='conditions'?n.trigger.all:[]).some(c=>c.var===v.id)||n.choices.some(c=>c.requires.some(r=>r.var===v.id)))
      ||relations.some(r=>(r.conditions||[]).some(c=>c.var===v.id));
    const isWritten=writtenVars.has(v.id);
    if(!isRead&&!isWritten) out.push({level:'warn',text:`«${v.name}»: переменная нигде не используется — ни в условиях, ни в эффектах.`,varId:v.id});
    else if(isWritten&&!isRead) out.push({level:'info',text:`«${v.name}»: меняется, но нигде не проверяется условием — возможно, задел на будущее.`,varId:v.id});
    else if(isRead&&!isWritten) out.push({level:'warn',text:`«${v.name}»: проверяется условием, но ничто её не меняет — если стартовое значение (${v.start}) не устраивает само по себе, условие никогда не сработает иначе.`,varId:v.id});
    if(num(v.min,0)>num(v.max,100)) out.push({level:'warn',text:`«${v.name}»: минимум (${v.min}) больше максимума (${v.max}).`,varId:v.id});
  });

  const reachable=computeReachable();
  nodes.forEach(n=>{
    const noOut=!n.choices.length, noEnd=!n.ending, noIn=!hasIncoming.has(n.id);
    const isolated=noOut&&noEnd&&noIn&&n.trigger.kind==='conditions';
    if(n.trigger.kind==='conditions'&&!reachable.has(n.id)&&!isolated) out.push({level:'info',text:`«${n.title}»: нет входящих переходов и это не старт/фоновое — либо забыт, либо специально задуман как активируемый только условием (зависит лишь от мировых переменных).`,nodeId:n.id});
  });

  // Циклы — DFS с раскраской, каждое обратное ребро сообщается один раз. Не ошибка сама по себе
  // (в survival-сюжете нормально сходить к колодцу и вернуться) — только info, для осознанности.
  (function reportCycles(){
    const color={};
    function dfs(id){
      color[id]=1;
      const n=findNode(id);
      if(n) n.choices.forEach(c=>{
        if(!c.target||!nodeIds.has(c.target)) return;
        if(color[c.target]===1){
          const from=findNode(id), to=findNode(c.target);
          out.push({level:'info',text:`Цикл: из «${from.title}» через «${c.label||'?'}» есть путь обратно к «${to.title}» — не обязательно ошибка (например, «сходить к колодцу» и вернуться), просто чтобы знать.`,nodeId:id});
          return;
        }
        if(!color[c.target]) dfs(c.target);
      });
      color[id]=2;
    }
    nodes.forEach(n=>{ if(!color[n.id]) dfs(n.id); });
  })();

  const endingCount=nodes.filter(n=>n.ending).length;
  const unreachableCount=nodes.filter(n=>n.trigger.kind==='conditions'&&!reachable.has(n.id)).length;

  // Слой мира: сущности/связи — отдельный граф, но проверяем его тем же списком, чтобы дырки
  // (сущность удалили вручную из JSON, тип связи переименовали) не оставались незамеченными.
  const entityIds=new Set(entities.map(e=>e.id));
  const relationTypeIds=new Set(relationTypes.map(t=>t.id));
  entities.forEach(e=>{
    const kind=entityKindDef(e.kind);
    if(kind.catalog&&e.ref&&e.ref.refId&&!catalogOptionsFor(kind.catalog).some(o=>o.id===e.ref.refId)){
      out.push({level:'warn',text:`Сущность «${entityDisplayName(e)}»: ссылка на «${e.ref.refId}» в каталоге ${kind.catalog} больше не найдена (переименовано/удалено в Object Plan?).`,entityId:e.id});
    }
  });
  // Orphan detection (§22) — сущность, на которую вообще ничто не смотрит: ни узел сюжета (прямая
  // ссылка или каталожное использование), ни связь мира, ни идея-предложение. info, не warn — это
  // может быть и забытым мусором, и осознанным заделом на будущее (как "изолирован" у узлов, §5).
  entities.forEach(e=>{
    if(e.status==='deprecated') return; // уже отдельно помечена — не дублируем сигнал
    const kind=entityKindDef(e.kind);
    const usedInRefs=nodes.some(n=>(n.refs||[]).includes(e.id));
    const usedInAction=nodes.some(n=>n.actionRef&&(n.actionRef.action===e.id||n.actionRef.target===e.id));
    const usedInRelations=relations.some(r=>r.from===e.id||r.to===e.id);
    const usedViaCatalog=kind.catalog&&typeof nodesUsingCatalogEntity==='function'?nodesUsingCatalogEntity(e).length>0:false;
    const usedInProposals=proposals.some(p=>(p.relatedEntities||[]).includes(e.id));
    if(!usedInRefs&&!usedInAction&&!usedInRelations&&!usedViaCatalog&&!usedInProposals){
      out.push({level:'info',text:`Сущность «${entityDisplayName(e)}»: нигде не используется — ни в узлах сюжета, ни в связях, ни в идеях-предложениях.`,entityId:e.id});
    }
  });
  relations.forEach(r=>{
    const fromOk=entityIds.has(r.from), toOk=entityIds.has(r.to);
    const anchorEntity=fromOk?r.from:(toOk?r.to:undefined);
    if(!fromOk) out.push({level:'err',text:`Связь «${relationTypeLabel(r.type)}»: сторона «от» ссылается на несуществующую сущность.`,entityId:anchorEntity});
    if(!toOk) out.push({level:'err',text:`Связь «${relationTypeLabel(r.type)}»: сторона «к» ссылается на несуществующую сущность.`,entityId:anchorEntity});
    if(!relationTypeIds.has(r.type)) out.push({level:'err',text:`Связь (${fromOk?entityDisplayName(findEntity(r.from)):'?'} → ${toOk?entityDisplayName(findEntity(r.to)):'?'}): неизвестный тип связи.`,entityId:anchorEntity});
  });
  // Story ↔ World: узел ссылается (node.refs) на сущность, которую с тех пор удалили из "Мира".
  nodes.forEach(n=>{
    (n.refs||[]).forEach(rid=>{
      if(rid&&!entityIds.has(rid)) out.push({level:'warn',text:`«${n.title}»: ссылается на сущность мира, которой больше нет (удалена в режиме «Мир»?).`,nodeId:n.id});
    });
    // Действие → Цель (§21) — та же дырка, что и у node.refs выше, только для отдельной пары полей.
    const ar=n.actionRef;
    if(ar&&ar.action&&!entityIds.has(ar.action)) out.push({level:'warn',text:`«${n.title}»: «Действие» ссылается на сущность мира, которой больше нет.`,nodeId:n.id});
    if(ar&&ar.target&&!entityIds.has(ar.target)) out.push({level:'warn',text:`«${n.title}»: «Цель» действия ссылается на сущность мира, которой больше нет.`,nodeId:n.id});
  });

  const errCount=out.filter(p=>p.level==='err').length;
  const warnCount=out.filter(p=>p.level==='warn').length;
  const infoCount=out.filter(p=>p.level==='info').length;
  out.unshift({level:'summary',text:`Ошибок: ${errCount} · Предупреждений: ${warnCount} · Инфо: ${infoCount}  —  Узлов: ${nodes.length} · переменных: ${variables.length} · концовок: ${endingCount} · без входящих переходов: ${unreachableCount} · сущностей: ${entities.length} · связей: ${relations.length}`});

  return out;
}
function renderChecks(){
  const el=document.getElementById('checksList');
  const problems=runChecks();
  el.innerHTML=problems.map(p=>{
    if(p.level==='summary') return `<div class="check-summary">${esc(p.text)}</div>`;
    const clickable=p.nodeId||p.entityId||p.varId;
    return `<div class="check-item ${p.level} ${clickable?'clickable':''}"${p.nodeId?` data-checknode="${esc(p.nodeId)}"`:''}${p.entityId?` data-checkentity="${esc(p.entityId)}"`:''}${p.varId?` data-checkvar="${esc(p.varId)}"`:''}>${esc(p.text)}</div>`;
  }).join('') || '<div class="hint">Проблем не найдено.</div>';
}
document.getElementById('checksList').addEventListener('click',e=>{
  const item=e.target.closest('[data-checknode],[data-checkentity],[data-checkvar]'); if(!item) return;
  if(item.dataset.checknode){ selectNode(item.dataset.checknode); focusNode(item.dataset.checknode); return; }
  if(item.dataset.checkentity){ if(typeof jumpToWorldEntity==='function') jumpToWorldEntity(item.dataset.checkentity); return; }
  if(item.dataset.checkvar&&typeof focusVariableDependencies==='function') focusVariableDependencies(item.dataset.checkvar);
});
