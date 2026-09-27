/* ============================================================
   MODULE 10 — РЕЖИМ «МИР»: список сущностей/идей/типов связей, карточка сущности+связей,
   редактор связи (в правой панели — переиспользует condRowsHtml/getByPath/setByPath из
   04-inspector.js), переключатель режимов Сюжет/Мир.
   ============================================================ */

let viewMode='story';

function setViewMode(mode){
  viewMode=mode;
  const isStory=mode==='story', isWorld=mode==='world', isTimeline=mode==='timeline';
  if(!isStory){ selectedNodeId=null; multiSelected=new Set(); }
  document.getElementById('viewStoryBtn').classList.toggle('active',isStory);
  document.getElementById('viewWorldBtn').classList.toggle('active',isWorld);
  document.getElementById('viewTimelineBtn').classList.toggle('active',isTimeline);
  document.getElementById('storyLeftPanels').style.display=isStory?'':'none';
  document.getElementById('worldLeftPanels').style.display=isWorld?'':'none';
  document.getElementById('canvasOuter').style.display=isStory?'':'none';
  document.getElementById('worldCanvas').style.display=isWorld?'':'none';
  document.getElementById('timelineCanvas').style.display=isTimeline?'':'none';
  document.getElementById('storyZoombar').style.display=isStory?'':'none';
  document.getElementById('storyHint').style.display=isStory?'':'none';
  renderAll();
}
document.getElementById('viewStoryBtn').onclick=()=>setViewMode('story');
document.getElementById('viewWorldBtn').onclick=()=>setViewMode('world');
document.getElementById('viewTimelineBtn').onclick=()=>setViewMode('timeline');

// Story → World: вызывается из инспектора узла (04-inspector.js) кликом по фишке-ссылке на сущность.
function jumpToWorldEntity(id){
  selectedEntityId=id; selectedRelationId=null; selectedProposalId=null;
  setViewMode('world');
}
// World → Story (обратное направление той же связи): какие узлы сюжета ссылаются на эту сущность
// через node.refs — без этого связь была бы дорогой в один конец.
function nodesReferencingEntity(entityId){
  return nodes.filter(n=>(n.refs||[]).includes(entityId));
}
// Dependency Explorer для World-сущностей (группа I бэклога): та же идея, что и у переменных
// (§1) — список узлов сюжета, куда сущность "дотягивается", плюс краткая сводка её эффектов
// (nodeAffectsSummary из 03-canvas.js), чтобы видеть не только САМ факт связи, но и что она
// значит для игры, не открывая каждый узел по одному.
function entityNodesHtml(nodesList,emptyHint){
  return nodesList.map(n=>`<div class="noderow" data-jumpstory="${esc(n.id)}">
    <span class="tag ${esc(n.type)}">${esc(n.type)}</span>
    <div class="nm-wrap"><span class="nm">${esc(n.title||'(без названия)')}</span>${nodeAffectsSummary(n)?`<span class="affects muted small">→ ${esc(nodeAffectsSummary(n))}</span>`:''}</div>
  </div>`).join('')||`<div class="hint">${esc(emptyHint)}</div>`;
}

/* ---------- левая панель режима «Мир»: сущности / идеи-предложения / типы связей ---------- */
// Focus Entity (группа J бэклога) — сужает список сущностей до кластера в N связях от выбранной,
// БЕЗ учёта направления (см. пояснение у computeEntityFocusSet в 09-world-model.js). Список, а не
// подсветка на холсте — режим "Мир" сознательно без пространственного холста (карточка+список), так
// что сужение видимого множества и есть здешний эквивалент притушивания в §6/§7.
let entityFocusMode=false;
function computeEntityFocusVisibleSet(){
  if(!entityFocusMode||!selectedEntityId) return null;
  const depth=(document.getElementById('entityFocusDepth')||{}).value||'1';
  return computeEntityFocusSet(selectedEntityId,depth);
}
function renderEntityListHtml(q){
  if(!entities.length) return '<div class="hint">Пока нет сущностей — добавь персонажа, локацию, или сошлись на предмет/навык/действие из Object Plan.</div>';
  q=(q||'').toLowerCase();
  const relTypeFilter=(document.getElementById('entityRelTypeFilter')||{}).value||'';
  const focusSet=computeEntityFocusVisibleSet();
  let filtered=entities.filter(e=>!q||entityDisplayName(e).toLowerCase().includes(q)||entityKindLabel(e.kind).toLowerCase().includes(q)||(e.note||'').toLowerCase().includes(q));
  if(relTypeFilter) filtered=filtered.filter(e=>relationsForEntity(e.id).some(r=>r.type===relTypeFilter));
  if(focusSet) filtered=filtered.filter(e=>focusSet.has(e.id));
  if(!filtered.length) return '<div class="hint">Ничего не найдено по этому запросу/фильтру.</div>';
  const byKind=new Map();
  filtered.forEach(e=>{ if(!byKind.has(e.kind)) byKind.set(e.kind,[]); byKind.get(e.kind).push(e); });
  const order=[...byKind.keys()].sort((a,b)=>entityKindLabel(a).localeCompare(entityKindLabel(b),'ru'));
  return order.map(kindId=>{
    const list=byKind.get(kindId);
    const rows=list.map(e=>{
      const deprecated=e.status==='deprecated';
      return `
      <div class="noderow ${selectedEntityId===e.id?'active':''} ${deprecated?'deprecated':''}" data-entity="${esc(e.id)}">
        <span class="tag entity">${esc(kindId)}</span>
        <div class="nm-wrap"><span class="nm">${esc(entityDisplayName(e))}${e.lifecycle?` <span class="muted small">(${esc(entityLifecycleLabel(e.lifecycle))})</span>`:''}${deprecated?' <span class="muted small">(устарело)</span>':''}</span></div>
        <button class="del-x" data-delentity="${esc(e.id)}" title="${deprecated?'Удалить навсегда':'Архивировать (устарело)'}">✕</button>
      </div>`;
    }).join('');
    return `<div class="cat-header"><span class="arrow">▾</span>${esc(entityKindLabel(kindId))} <span class="muted small">(${list.length})</span></div>${rows}`;
  }).join('');
}

function renderWorldLeft(){
  const kindSelect=document.getElementById('newEntityKind');
  if(kindSelect&&!kindSelect.dataset.filled){
    kindSelect.innerHTML=ENTITY_KINDS.map(k=>`<option value="${esc(k.id)}">${esc(k.label)}</option>`).join('');
    kindSelect.dataset.filled='1';
  }
  const countEl=document.getElementById('entityCount'); if(countEl) countEl.textContent=entities.length;
  const listEl=document.getElementById('entityList');
  if(listEl) listEl.innerHTML=renderEntityListHtml((document.getElementById('entitySearch')||{}).value||'');

  const propCountEl=document.getElementById('proposalCount'); if(propCountEl) propCountEl.textContent=proposals.length;
  const propListEl=document.getElementById('proposalList');
  if(propListEl) propListEl.innerHTML=proposals.length?proposals.map(p=>`
    <div class="noderow ${selectedProposalId===p.id?'active':''}" data-proposal="${esc(p.id)}">
      <span class="tag ${esc(p.status)}">${esc(proposalStatusLabel(p.status))}</span>
      <div class="nm-wrap"><span class="nm">${esc(p.title)}${p.priority==='high'?' <span class="muted small" title="Высокий приоритет">🔺</span>':''}</span></div>
      <button class="del-x" data-delproposal="${esc(p.id)}">✕</button>
    </div>`).join(''):'<div class="hint">Пока нет идей — закинь мысль текстом, потом при желании оформи как сущность или узел сюжета.</div>';

  const weCountEl=document.getElementById('worldEventCount'); if(weCountEl) weCountEl.textContent=worldEvents.length;
  const weListEl=document.getElementById('worldEventList');
  if(weListEl) weListEl.innerHTML=worldEvents.length?worldEvents.map(ev=>{
    const actorName=ev.actor?entityDisplayName(findEntity(ev.actor)):'?', targetName=ev.target?entityDisplayName(findEntity(ev.target)):'?';
    return `<div class="noderow ${selectedWorldEventId===ev.id?'active':''}" data-worldevent="${esc(ev.id)}">
      <div class="nm-wrap"><span class="nm">${esc(ev.title||'(без названия)')}</span><span class="affects muted small">${esc(actorName)} → ${esc(ev.action||'?')} → ${esc(targetName)}</span></div>
      <button class="del-x" data-delworldevent="${esc(ev.id)}">✕</button>
    </div>`;
  }).join(''):'<div class="hint">Пока нет автономных событий мира.</div>';

  const decCountEl=document.getElementById('decisionCount'); if(decCountEl) decCountEl.textContent=decisions.length;
  const decListEl=document.getElementById('decisionList');
  if(decListEl) decListEl.innerHTML=decisions.length?decisions.map(d=>`
    <div class="noderow ${selectedDecisionId===d.id?'active':''}" data-decision="${esc(d.id)}">
      <span class="tag ${esc(d.status)}">${esc(decisionStatusLabel(d.status))}</span>
      <div class="nm-wrap"><span class="nm">${esc(d.title)}</span><span class="affects muted small">${esc(decisionSourceLabel(d.source))}</span></div>
      <button class="del-x" data-deldecision="${esc(d.id)}">✕</button>
    </div>`).join(''):'<div class="hint">Пока нет решений в Decision Log.</div>';

  const rtEl=document.getElementById('relationTypeList');
  if(rtEl) rtEl.innerHTML=relationTypes.map(t=>`
    <div class="varrow" data-reltype="${esc(t.id)}">
      <div class="row" style="margin:0">
        <input type="text" value="${esc(t.name)}" data-rtfield="name" style="flex:1" title="Имя типа">
        <button class="del-x" data-delreltype="${esc(t.id)}">✕</button>
      </div>
      <div class="row">
        <input type="text" value="${esc(t.inverseName||'')}" data-rtfield="inverseName" placeholder="обратное имя (состоит_в → включает)" style="flex:1" ${t.symmetric?'disabled':''}>
        <label class="small" title="Связь читается одинаково в обе стороны, без направления (friend_of)"><input type="checkbox" data-rtfield="symmetric" ${t.symmetric?'checked':''}> симметрична</label>
      </div>
    </div>`).join('')||'<div class="hint">Нет типов связей.</div>';

  // Опции пересобираются на каждый renderAll() (тип связи мог переименоваться/удалиться), поэтому
  // явно возвращаем текущее выбранное значение — иначе фильтр молча сбрасывался бы на "Все" при
  // любой правке где-либо в интерфейсе, а не только когда меняется сам список типов.
  const relFilterEl=document.getElementById('entityRelTypeFilter');
  if(relFilterEl){
    const cur=relFilterEl.value;
    relFilterEl.innerHTML='<option value="">Все типы связей</option>'+relationTypes.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    if(cur&&relationTypes.some(t=>t.id===cur)) relFilterEl.value=cur;
  }
}

document.getElementById('btnAddEntity').onclick=()=>addEntity(document.getElementById('newEntityKind').value);
document.getElementById('entitySearch').addEventListener('input',()=>{
  document.getElementById('entityList').innerHTML=renderEntityListHtml(document.getElementById('entitySearch').value);
});
document.getElementById('entityRelTypeFilter').addEventListener('change',()=>{
  document.getElementById('entityList').innerHTML=renderEntityListHtml(document.getElementById('entitySearch').value);
});
document.getElementById('btnEntityFocus').onclick=()=>{
  entityFocusMode=!entityFocusMode;
  document.getElementById('btnEntityFocus').classList.toggle('active',entityFocusMode);
  document.getElementById('entityList').innerHTML=renderEntityListHtml(document.getElementById('entitySearch').value);
};
document.getElementById('entityFocusDepth').addEventListener('change',()=>{
  if(entityFocusMode) document.getElementById('entityList').innerHTML=renderEntityListHtml(document.getElementById('entitySearch').value);
});
document.getElementById('entityList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delentity]');
  if(del){
    if(readOnlyMode) return;
    const ent=findEntity(del.dataset.delentity);
    if(ent&&ent.status==='deprecated'){ if(confirm('Удалить сущность НАВСЕГДА? Связи с ней тоже удалятся. Отменить будет нельзя (кроме Ctrl+Z).')) deleteEntity(del.dataset.delentity); }
    else if(confirm('Архивировать сущность («устарело»)? Существующие ссылки на неё не сломаются, но она перестанет предлагаться для новых. Удалить насовсем можно будет потом отдельной кнопкой.')) deprecateEntity(del.dataset.delentity);
    return;
  }
  const row=e.target.closest('[data-entity]');
  if(row){ selectedEntityId=row.dataset.entity; selectedRelationId=null; selectedProposalId=null; selectedWorldEventId=null; selectedDecisionId=null; renderAll(); }
});
document.getElementById('btnAddWorldEvent').onclick=()=>{ addWorldEvent(); };
document.getElementById('worldEventList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delworldevent]');
  if(del){ if(!readOnlyMode&&confirm('Удалить событие мира?')) deleteWorldEvent(del.dataset.delworldevent); return; }
  const row=e.target.closest('[data-worldevent]');
  if(row){ selectedWorldEventId=row.dataset.worldevent; selectedEntityId=null; selectedProposalId=null; selectedRelationId=null; selectedDecisionId=null; renderAll(); }
});
document.getElementById('btnAddDecision').onclick=()=>{
  const input=document.getElementById('newDecisionTitle');
  addDecision(input.value); input.value='';
};
document.getElementById('decisionList').addEventListener('click',e=>{
  const del=e.target.closest('[data-deldecision]');
  if(del){ if(!readOnlyMode&&confirm('Удалить решение из Decision Log?')) deleteDecision(del.dataset.deldecision); return; }
  const row=e.target.closest('[data-decision]');
  if(row){ selectedDecisionId=row.dataset.decision; selectedEntityId=null; selectedProposalId=null; selectedRelationId=null; selectedWorldEventId=null; renderAll(); }
});
document.getElementById('btnAddProposal').onclick=()=>{
  const input=document.getElementById('newProposalTitle');
  addProposal(input.value); input.value='';
};
// Клик по строке ТОЛЬКО открывает карточку идеи (как у сущности) — раньше сам клик сразу спрашивал
// "сделать сущностью?", и не было способа просто посмотреть/поправить текст идеи, не рискуя нажать
// не туда. Промоушен теперь — явные кнопки внутри карточки (renderProposalDetail).
document.getElementById('proposalList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delproposal]');
  if(del){ if(confirm('Удалить идею?')) deleteProposal(del.dataset.delproposal); return; }
  const row=e.target.closest('[data-proposal]');
  if(row){ selectedProposalId=row.dataset.proposal; selectedEntityId=null; selectedRelationId=null; selectedWorldEventId=null; selectedDecisionId=null; renderAll(); }
});
document.getElementById('btnAddRelType').onclick=()=>{
  const input=document.getElementById('newRelTypeName');
  addRelationType(input.value); input.value='';
};
document.getElementById('btnTranslateRelTypes').onclick=()=>{
  const n=translateRelationTypesToRussian();
  alert(n?`Переименовано типов связи: ${n}.`:'Ничего не найдено для перевода — уже на русском, или названия не совпадают со стандартными английскими.');
};
document.getElementById('relationTypeList').addEventListener('input',e=>{
  if(readOnlyMode) return;
  const row=e.target.closest('[data-reltype]'); if(!row) return;
  const t=findRelationType(row.dataset.reltype); if(!t) return;
  const field=e.target.dataset.rtfield;
  if(field==='name') t.name=e.target.value;
  else if(field==='inverseName') t.inverseName=e.target.value;
});
document.getElementById('relationTypeList').addEventListener('change',e=>{
  if(readOnlyMode) return;
  const row=e.target.closest('[data-reltype]'); if(!row) return;
  const t=findRelationType(row.dataset.reltype); if(!t) return;
  if(e.target.dataset.rtfield==='symmetric') t.symmetric=e.target.checked;
  pushHistory(); renderAll();
});
document.getElementById('relationTypeList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delreltype]'); if(del) deleteRelationType(del.dataset.delreltype);
});

/* ---------- карточка сущности + её связей (центральная область режима «Мир») ---------- */
// Направление связи на карточке ДРУГОЙ (не from) стороны читается неудобно как голое "← member_of" —
// если у типа задан inverseName (member_of ↔ has_member), показываем связь с точки зрения ЭТОЙ
// сущности как "→ has_member", а не "← member_of" (та же связь, тот же id — просто более честная для
// чтения формулировка). symmetric (friend_of) вообще не имеет направления — всегда "↔".
function relationRowHtml(r,fromPerspectiveId){
  const isOutgoing=r.from===fromPerspectiveId;
  const otherId=isOutgoing?r.to:r.from;
  const other=findEntity(otherId);
  const type=findRelationType(r.type);
  let arrow=isOutgoing?'→':'←', label=relationTypeLabel(r.type);
  if(!isOutgoing&&type){
    if(type.symmetric) arrow='↔';
    else if(type.inverseName){ arrow='→'; label=type.inverseName; }
  }
  const mechBits=[]; if((r.conditions||[]).length) mechBits.push('усл:'+r.conditions.length); if((r.effects||[]).length) mechBits.push('эфф:'+r.effects.length);
  const mech=mechBits.length?` <span class="muted small" title="Условия/эффекты этой связи">⚙ ${esc(mechBits.join(', '))}</span>`:'';
  return `<div class="noderow ${selectedRelationId===r.id?'active':''}" data-relation="${esc(r.id)}">
    <span class="tag ${other?'':'err'}">${arrow} ${esc(label)}</span>
    <div class="nm-wrap"><span class="nm" data-jumpentity="${esc(otherId||'')}">${esc(other?entityDisplayName(other):'(нет сущности)')}</span>${mech}</div>
    <button class="del-x" data-delrelation="${esc(r.id)}">✕</button>
  </div>`;
}
// Список узлов, привязанных к идее вручную (linkProposalToNode) или созданных из неё
// (promoteProposalToNode) — с переходом к узлу и отвязкой; плюс пикер, чтобы привязать уже
// существующий узел без создания нового (не каждая идея должна порождать черновик).
function proposalNodesHtml(p){
  const linked=(p.relatedNodes||[]).map(id=>findNode(id)).filter(Boolean);
  const rows=linked.map(n=>`<div class="noderow" data-jumpstory="${esc(n.id)}">
    <span class="tag ${esc(n.type)}">${esc(n.type)}</span>
    <div class="nm-wrap"><span class="nm">${esc(n.title||'(без названия)')}</span></div>
    <button class="del-x" data-delproposalnode="${esc(n.id)}" title="Отвязать (узел не удаляется)">✕</button>
  </div>`).join('')||'<div class="hint">Пока не привязано ни одного узла сюжета.</div>';
  const linkedIds=new Set(p.relatedNodes||[]);
  const available=nodes.filter(n=>!linkedIds.has(n.id));
  const picker=`<div class="row" style="margin-top:6px">
    <select id="proposalNodeLinkSelect" style="flex:1"><option value="">— выбери существующий узел —</option>${available.map(n=>`<option value="${esc(n.id)}">${esc(n.title||'(без названия)')}</option>`).join('')}</select>
    <button id="btnLinkProposalNode">Привязать</button>
  </div>`;
  return rows+picker;
}
function renderProposalDetail(){
  const el=document.getElementById('entityDetail'); if(!el) return;
  const p=proposals.find(x=>x.id===selectedProposalId);
  if(!p){ selectedProposalId=null; renderWorldCanvas(); return; }
  el.innerHTML=`
    <div class="group">
      <h3>Идея / предложение</h3>
      <label class="small">Заголовок</label>
      <input type="text" class="full" id="proposalTitleInput" value="${esc(p.title)}">
      <label class="small" style="margin-top:6px">Текст</label>
      <textarea id="proposalTextInput">${esc(p.text||'')}</textarea>
      <div class="row" style="margin-top:6px">
        <div><label class="small">Статус</label>
          <select id="proposalStatusSelect">${PROPOSAL_STATUS.map(([id,label])=>`<option value="${id}" ${p.status===id?'selected':''}>${label}</option>`).join('')}</select></div>
        <div><label class="small">Приоритет</label>
          <select id="proposalPrioritySelect">${PROPOSAL_PRIORITY.map(([id,label])=>`<option value="${id}" ${p.priority===id?'selected':''}>${label}</option>`).join('')}</select></div>
      </div>
      <label class="small" style="margin-top:6px">Источник</label>
      <input type="text" class="full" id="proposalSourceInput" value="${esc(p.source||'')}" placeholder="напр. playtest#3, design.md">
      ${p.createdAt?`<div class="hint small" style="margin-top:4px">Создано: ${esc(new Date(p.createdAt).toLocaleString())}</div>`:''}
      <button class="full danger" id="btnDeleteProposalHere" style="margin-top:8px">🗑 Удалить идею</button>
    </div>
    <div class="group">
      <h3>Сделать чем-то реальным</h3>
      <div class="hint" style="margin-bottom:6px">Идея остаётся в списке (со статусом «реализовано») и запоминает, во что она превратилась.</div>
      <div class="row">
        <select id="proposalPromoteKind">${ENTITY_KINDS.map(k=>`<option value="${esc(k.id)}">${esc(k.label)}</option>`).join('')}</select>
        <button id="btnPromoteToEntity">→ Сущностью</button>
      </div>
      <button class="full" id="btnPromoteToNode" style="margin-top:6px">→ Черновой узел сюжета</button>
    </div>
    <div class="group">
      <h3>Связанные системы (Object Plan)</h3>
      ${chipPickerHtml('relatedSystems',p.relatedSystems||[],'systems',false)}
    </div>
    <div class="group">
      <h3>Связанные сущности</h3>
      ${chipPickerHtml('relatedEntities',p.relatedEntities||[],'worldEntities',true)}
    </div>
    <div class="group">
      <h3>Связанные узлы сюжета (${(p.relatedNodes||[]).length})</h3>
      ${proposalNodesHtml(p)}
    </div>
  `;
}
// Автономное событие мира (§26) — та же центральная панель #entityDetail, что и у сущности/идеи,
// взаимоисключающе через selectedWorldEventId (тот же принцип, что уже развёл entity/proposal).
function renderWorldEventDetail(){
  const el=document.getElementById('entityDetail'); if(!el) return;
  const ev=findWorldEvent(selectedWorldEventId);
  if(!ev){ selectedWorldEventId=null; renderWorldCanvas(); return; }
  el.innerHTML=`
    <div class="group">
      <h3>Автономное событие мира</h3>
      <label class="small">Название</label>
      <input type="text" class="full" id="weTitleInput" value="${esc(ev.title)}">
      <div class="row" style="margin-top:6px">
        <div style="flex:1"><label class="small">Actor (кто действует)</label>
          <select id="weActorSelect">${entitySelectOptionsHtml(ev.actor)}</select></div>
        <div style="flex:1"><label class="small">Action (что делает)</label>
          <input type="text" class="full" id="weActionInput" value="${esc(ev.action)}" placeholder="напр. нападает на"></div>
        <div style="flex:1"><label class="small">Target (на кого)</label>
          <select id="weTargetSelect">${entitySelectOptionsHtml(ev.target)}</select></div>
      </div>
      <label class="small" style="margin-top:6px">Итог для target — справочно, НЕ применяется автоматически (задать вручную на карточке сущности, когда событие «случилось» в сюжете)</label>
      <select id="weResultLifecycleSelect"><option value="">— без итога —</option>${ENTITY_LIFECYCLE_STATES.map(([id,label])=>`<option value="${id}" ${ev.resultLifecycle===id?'selected':''}>${label}</option>`).join('')}</select>
      <label class="small" style="margin-top:6px">Комментарий</label>
      <textarea id="weCommentInput">${esc(ev.comment||'')}</textarea>
      <button class="full danger" id="btnDeleteWorldEventHere" style="margin-top:8px">🗑 Удалить событие</button>
    </div>
    <div class="group">
      <h3>Эффекты на мировые переменные (если событие случилось)</h3>
      ${condRowsHtml('effects',ev.effects,true)}
    </div>
  `;
}
// Decision Log — запись о решении по архитектуре/дизайну (§28), та же центральная панель
// #entityDetail, что и у сущности/идеи/события мира, взаимоисключающе через selectedDecisionId.
function renderDecisionDetail(){
  const el=document.getElementById('entityDetail'); if(!el) return;
  const d=findDecision(selectedDecisionId);
  if(!d){ selectedDecisionId=null; renderWorldCanvas(); return; }
  const impact=decisionChangeImpact(d);
  el.innerHTML=`
    <div class="group">
      <h3>Решение (Decision Log)</h3>
      <label class="small">Заголовок</label>
      <input type="text" class="full" id="decTitleInput" value="${esc(d.title)}">
      <label class="small" style="margin-top:6px">Текст</label>
      <textarea id="decTextInput">${esc(d.text||'')}</textarea>
      <div class="row" style="margin-top:6px">
        <div><label class="small">Статус</label>
          <select id="decStatusSelect">${DECISION_STATUS.map(([id,label])=>`<option value="${id}" ${d.status===id?'selected':''}>${label}</option>`).join('')}</select></div>
        <div><label class="small">Источник</label>
          <select id="decSourceSelect">${DECISION_SOURCE.map(([id,label])=>`<option value="${id}" ${d.source===id?'selected':''}>${label}</option>`).join('')}</select></div>
      </div>
      <label class="small" style="margin-top:6px">Комментарий</label>
      <textarea id="decCommentInput">${esc(d.comment||'')}</textarea>
      ${d.createdAt?`<div class="hint small" style="margin-top:4px">Создано: ${esc(new Date(d.createdAt).toLocaleString())}</div>`:''}
      <button class="full danger" id="btnDeleteDecisionHere" style="margin-top:8px">🗑 Удалить решение</button>
    </div>
    <div class="group">
      <h3>Change Impact</h3>
      <div class="hint">Затрагивает (по связанным сущностям ниже): узлов сюжета — ${impact.nodeCount}, связей — ${impact.relationCount}, событий мира — ${impact.eventCount}.</div>
    </div>
    <div class="group">
      <h3>Связанные системы (Object Plan)</h3>
      ${chipPickerHtml('relatedSystems',d.relatedSystems||[],'systems',false)}
    </div>
    <div class="group">
      <h3>Связанные сущности</h3>
      ${chipPickerHtml('relatedEntities',d.relatedEntities||[],'worldEntities',true)}
    </div>
  `;
}
function renderWorldCanvas(){
  const el=document.getElementById('entityDetail'); if(!el) return;
  if(selectedProposalId){ renderProposalDetail(); return; }
  if(selectedWorldEventId){ renderWorldEventDetail(); return; }
  if(selectedDecisionId){ renderDecisionDetail(); return; }
  const e=findEntity(selectedEntityId);
  if(!e){ el.innerHTML='<div class="hint">Выбери сущность или идею слева — или добавь новую.</div>'; return; }
  const kind=entityKindDef(e.kind);
  const rels=relationsForEntity(e.id);
  const refNodes=nodesReferencingEntity(e.id);
  const usedNodes=kind.catalog?nodesUsingCatalogEntity(e):[];
  const deprecated=e.status==='deprecated';
  const mergeCandidates=entities.filter(x=>x.id!==e.id&&x.kind===e.kind&&x.status!=='deprecated');
  el.innerHTML=`
    <div class="group">
      <h3>${esc(entityKindLabel(e.kind))}${deprecated?' <span class="tag deprecated">устарело</span>':''}</h3>
      ${kind.catalog?`
        <label class="small">Из каталога Object Plan (${esc(kind.catalog)})</label>
        <select id="entityRefSelect"><option value="">— выбери —</option>${catalogOptionsFor(kind.catalog).map(o=>`<option value="${esc(o.id)}" ${e.ref&&e.ref.refId===o.id?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`
      :`
        <label class="small">Название</label>
        <input type="text" class="full" id="entityNameInput" value="${esc(e.name)}">`}
      <label class="small" style="margin-top:6px">Заметка</label>
      <textarea id="entityNoteInput">${esc(e.note||'')}</textarea>
      <label class="small" style="margin-top:6px">Жизненный цикл в игровом мире (§26 — отдельно от «устарело» ниже, это про АВТОРСКИЙ архив)</label>
      <select id="entityLifecycleSelect"><option value="">— не отслеживается —</option>${ENTITY_LIFECYCLE_STATES.map(([id,label])=>`<option value="${id}" ${e.lifecycle===id?'selected':''}>${label}</option>`).join('')}</select>
      ${deprecated?`
      <div class="row" style="margin-top:8px">
        <button class="full" id="btnRestoreEntity">♻ Восстановить</button>
        <button class="full danger" id="btnDeleteEntityForever">🗑 Удалить навсегда</button>
      </div>`:`
      <button class="full danger" id="btnDeleteEntity" style="margin-top:8px">🗑 Архивировать («устарело»)</button>`}
    </div>
    ${mergeCandidates.length?`
    <div class="group">
      <h3>Слить с дубликатом</h3>
      <div class="hint" style="margin-bottom:6px">Если это дубликат другой сущности — перенести на неё все ссылки (из узлов сюжета и связей) и заархивировать эту.</div>
      <div class="row"><select id="entityMergeTarget"><option value="">— выбери сущность —</option>${mergeCandidates.map(x=>`<option value="${esc(x.id)}">${esc(entityDisplayName(x))}</option>`).join('')}</select><button id="btnMergeEntity">Слить</button></div>
    </div>`:''}
    <div class="group">
      <h3>Связи (${rels.length})</h3>
      ${rels.map(r=>relationRowHtml(r,e.id)).join('')||'<div class="hint">Пока нет связей.</div>'}
      <button class="full" id="btnAddRelationHere" style="margin-top:8px">+ добавить связь</button>
    </div>
    <div class="group">
      <h3>Упоминается в сюжете (${refNodes.length})</h3>
      ${entityNodesHtml(refNodes,'Пока ни один узел сюжета не ссылается на эту сущность (вкладка «Ссылки» в инспекторе узла).')}
    </div>
    ${(()=>{ const we=worldEventsForEntity(e.id); return `
    <div class="group">
      <h3>Автономные события мира (${we.length})</h3>
      ${we.length?we.map(ev=>`<div class="noderow" data-jumpworldevent="${esc(ev.id)}">
        <div class="nm-wrap"><span class="nm">${esc(ev.title||'(без названия)')}</span><span class="affects muted small">${ev.actor===e.id?'actor':''}${ev.actor===e.id&&ev.target===e.id?' · ':''}${ev.target===e.id?'target':''}</span></div>
      </div>`).join(''):'<div class="hint">Пока не участвует ни в одном автономном событии мира.</div>'}
    </div>`; })()}
    ${(()=>{ const decs=decisions.filter(d=>(d.relatedEntities||[]).includes(e.id)); return `
    <div class="group">
      <h3>Затронуто решениями (${decs.length})</h3>
      ${decs.length?decs.map(d=>`<div class="noderow" data-jumpdecision="${esc(d.id)}">
        <span class="tag ${esc(d.status)}">${esc(decisionStatusLabel(d.status))}</span>
        <div class="nm-wrap"><span class="nm">${esc(d.title)}</span></div>
      </div>`).join(''):'<div class="hint">Пока не упомянуто ни в одном решении Decision Log.</div>'}
    </div>`; })()}
    ${kind.catalog?`
    <div class="group">
      <h3>Используется в сюжете (${usedNodes.length})</h3>
      ${entityNodesHtml(usedNodes,'Пока не используется ни в одном узле сюжета (через «нужны предметы/навыки» — §3, или через раздел/тег узла для систем).')}
    </div>`:''}
    ${kind.id==='item'&&e.ref&&e.ref.refId?(()=>{
      const item=findPlanItem(e.ref.refId); if(!item) return '';
      const sysNames=(item.sys||[]).map(sid=>{ const s=(typeof SYSTEMS!=='undefined'?SYSTEMS:[]).find(x=>x.id===sid); return s?s.name:sid; });
      const manualStatus=objectPlanManualStatus(e.ref.refId);
      return `<div class="group">
        <h3>Данные из Object Plan</h3>
        <div class="hint">Игровые системы: ${sysNames.length?esc(sysNames.join(', ')):'не указаны'}</div>
        <div class="hint">Статус реализации: ${manualStatus?esc(objectPlanStatusLabel(manualStatus)):'не отмечено вручную в Object Plan'}</div>
      </div>`;
    })():''}
  `;
}
document.getElementById('entityDetail').addEventListener('input',e=>{
  if(readOnlyMode) return;
  if(selectedProposalId){
    const p=proposals.find(x=>x.id===selectedProposalId); if(!p) return;
    if(e.target.id==='proposalTitleInput') p.title=e.target.value;
    if(e.target.id==='proposalTextInput') p.text=e.target.value;
    if(e.target.id==='proposalSourceInput') p.source=e.target.value;
    return;
  }
  if(selectedWorldEventId){
    const ev=findWorldEvent(selectedWorldEventId); if(!ev) return;
    if(e.target.id==='weTitleInput') ev.title=e.target.value;
    if(e.target.id==='weActionInput') ev.action=e.target.value;
    if(e.target.id==='weCommentInput') ev.comment=e.target.value;
    const path=e.target.dataset.path;
    if(path) setByPath(ev,path,e.target.type==='number'?num(e.target.value):e.target.value);
    return;
  }
  if(selectedDecisionId){
    const d=findDecision(selectedDecisionId); if(!d) return;
    if(e.target.id==='decTitleInput') d.title=e.target.value;
    if(e.target.id==='decTextInput') d.text=e.target.value;
    if(e.target.id==='decCommentInput') d.comment=e.target.value;
    return;
  }
  const ent=findEntity(selectedEntityId); if(!ent) return;
  if(e.target.id==='entityNameInput') ent.name=e.target.value;
  if(e.target.id==='entityNoteInput') ent.note=e.target.value;
});
document.getElementById('entityDetail').addEventListener('change',e=>{
  if(readOnlyMode) return;
  if(selectedProposalId){
    const p=proposals.find(x=>x.id===selectedProposalId); if(!p) return;
    if(['proposalTitleInput','proposalTextInput','proposalSourceInput'].includes(e.target.id)){ pushHistory(); renderAll(); return; }
    if(e.target.id==='proposalStatusSelect'){ p.status=e.target.value; pushHistory(); renderAll(); return; }
    if(e.target.id==='proposalPrioritySelect'){ p.priority=e.target.value; pushHistory(); renderAll(); return; }
    return;
  }
  if(selectedWorldEventId){
    const ev=findWorldEvent(selectedWorldEventId); if(!ev) return;
    if(e.target.id==='weActorSelect'){ ev.actor=e.target.value; pushHistory(); renderAll(); return; }
    if(e.target.id==='weTargetSelect'){ ev.target=e.target.value; pushHistory(); renderAll(); return; }
    if(e.target.id==='weResultLifecycleSelect'){ ev.resultLifecycle=e.target.value; pushHistory(); renderAll(); return; }
    if(['weTitleInput','weActionInput','weCommentInput'].includes(e.target.id)||e.target.dataset.path){ pushHistory(); renderAll(); return; }
    return;
  }
  if(selectedDecisionId){
    const d=findDecision(selectedDecisionId); if(!d) return;
    if(e.target.id==='decStatusSelect'){ d.status=e.target.value; pushHistory(); renderAll(); return; }
    if(e.target.id==='decSourceSelect'){ d.source=e.target.value; pushHistory(); renderAll(); return; }
    if(['decTitleInput','decTextInput','decCommentInput'].includes(e.target.id)){ pushHistory(); renderAll(); return; }
    return;
  }
  const ent=findEntity(selectedEntityId); if(!ent) return;
  if(e.target.id==='entityRefSelect'){ ent.ref={catalog:ent.ref.catalog,refId:e.target.value}; pushHistory(); renderAll(); return; }
  if(e.target.id==='entityLifecycleSelect'){ ent.lifecycle=e.target.value; pushHistory(); renderAll(); return; }
  if(e.target.id==='entityNameInput'||e.target.id==='entityNoteInput'){ pushHistory(); renderAll(); }
});
document.getElementById('entityDetail').addEventListener('click',e=>{
  if(selectedProposalId){
    const p=proposals.find(x=>x.id===selectedProposalId); if(!p) return;
    if(e.target.id==='btnDeleteProposalHere'){ if(!readOnlyMode&&confirm('Удалить идею?')) deleteProposal(p.id); return; }
    if(e.target.id==='btnPromoteToEntity'){
      if(readOnlyMode) return;
      const kindId=(document.getElementById('proposalPromoteKind')||{}).value||'concept';
      promoteProposalToEntity(p.id,kindId); return;
    }
    if(e.target.id==='btnPromoteToNode'){ promoteProposalToNode(p.id); return; }
    if(e.target.id==='btnLinkProposalNode'){
      if(readOnlyMode) return;
      const sel=document.getElementById('proposalNodeLinkSelect'); const nodeId=sel&&sel.value;
      if(nodeId) linkProposalToNode(p.id,nodeId);
      return;
    }
    const delNode=e.target.closest('[data-delproposalnode]');
    if(delNode){ unlinkProposalFromNode(p.id,delNode.dataset.delproposalnode); return; }
    const jumpStory=e.target.closest('[data-jumpstory]');
    if(jumpStory){ setViewMode('story'); selectNode(jumpStory.dataset.jumpstory); focusNode(jumpStory.dataset.jumpstory); return; }
    const jumpChip=e.target.closest('[data-jumpref]');
    if(jumpChip){ selectedEntityId=jumpChip.dataset.jumpref; selectedProposalId=null; setViewMode('world'); return; }
    const addChip=e.target.closest('[data-addchip]');
    if(addChip){
      if(readOnlyMode) return;
      const fieldPath=addChip.dataset.addchip, input=document.getElementById(addChip.dataset.chipinput);
      const typed=input.value.trim(); if(!typed) return;
      const options=chipOptionsFor(fieldPath==='relatedSystems'?'systems':'worldEntities');
      const match=options.find(o=>o.label===typed||o.id===typed);
      const value=match?match.id:typed;
      const arr=p[fieldPath]||(p[fieldPath]=[]);
      if(!arr.includes(value)) arr.push(value);
      input.value='';
      pushHistory(); renderAll(); return;
    }
    const delChip=e.target.closest('[data-delchip]');
    if(delChip){
      if(readOnlyMode) return;
      const arr=p[delChip.dataset.delchip];
      if(arr) arr.splice(Number(delChip.dataset.delchipidx),1);
      pushHistory(); renderAll(); return;
    }
    return;
  }
  if(selectedWorldEventId){
    const ev=findWorldEvent(selectedWorldEventId); if(!ev) return;
    if(e.target.id==='btnDeleteWorldEventHere'){ if(!readOnlyMode&&confirm('Удалить событие мира?')) deleteWorldEvent(ev.id); return; }
    const addRow=e.target.closest('[data-addrow]');
    if(addRow){ if(readOnlyMode) return; addEffRow(getByPath(ev,addRow.dataset.addrow)); pushHistory(); renderAll(); return; }
    const delRow=e.target.closest('[data-delrow]');
    if(delRow){
      if(readOnlyMode) return;
      const path=delRow.dataset.delrow, idx=path.lastIndexOf('.');
      getByPath(ev,path.slice(0,idx)).splice(Number(path.slice(idx+1)),1);
      pushHistory(); renderAll(); return;
    }
    return;
  }
  if(selectedDecisionId){
    const d=findDecision(selectedDecisionId); if(!d) return;
    if(e.target.id==='btnDeleteDecisionHere'){ if(!readOnlyMode&&confirm('Удалить решение из Decision Log?')) deleteDecision(d.id); return; }
    const jumpChip=e.target.closest('[data-jumpref]');
    if(jumpChip){ selectedEntityId=jumpChip.dataset.jumpref; selectedDecisionId=null; setViewMode('world'); return; }
    const addChip=e.target.closest('[data-addchip]');
    if(addChip){
      if(readOnlyMode) return;
      const fieldPath=addChip.dataset.addchip, input=document.getElementById(addChip.dataset.chipinput);
      const typed=input.value.trim(); if(!typed) return;
      const options=chipOptionsFor(fieldPath==='relatedSystems'?'systems':'worldEntities');
      const match=options.find(o=>o.label===typed||o.id===typed);
      const value=match?match.id:typed;
      const arr=d[fieldPath]||(d[fieldPath]=[]);
      if(!arr.includes(value)) arr.push(value);
      input.value='';
      pushHistory(); renderAll(); return;
    }
    const delChip=e.target.closest('[data-delchip]');
    if(delChip){
      if(readOnlyMode) return;
      const arr=d[delChip.dataset.delchip];
      if(arr) arr.splice(Number(delChip.dataset.delchipidx),1);
      pushHistory(); renderAll(); return;
    }
    return;
  }
  const jumpWorldEvent=e.target.closest('[data-jumpworldevent]');
  if(jumpWorldEvent){ selectedWorldEventId=jumpWorldEvent.dataset.jumpworldevent; selectedEntityId=null; selectedProposalId=null; renderAll(); return; }
  const jumpDecision=e.target.closest('[data-jumpdecision]');
  if(jumpDecision){ selectedDecisionId=jumpDecision.dataset.jumpdecision; selectedEntityId=null; selectedProposalId=null; selectedWorldEventId=null; renderAll(); return; }
  if(e.target.id==='btnDeleteEntity'){ if(!readOnlyMode&&confirm('Архивировать сущность («устарело»)? Существующие ссылки не сломаются, но она перестанет предлагаться для новых.')) deprecateEntity(selectedEntityId); return; }
  if(e.target.id==='btnRestoreEntity'){ restoreEntity(selectedEntityId); return; }
  if(e.target.id==='btnDeleteEntityForever'){ if(!readOnlyMode&&confirm('Удалить сущность НАВСЕГДА? Связи с ней тоже удалятся. Отменить будет нельзя (кроме Ctrl+Z).')) deleteEntity(selectedEntityId); return; }
  if(e.target.id==='btnMergeEntity'){
    if(readOnlyMode) return;
    const sel=document.getElementById('entityMergeTarget'); const targetId=sel&&sel.value;
    if(!targetId) return;
    const fromName=entityDisplayName(findEntity(selectedEntityId)), toName=entityDisplayName(findEntity(targetId));
    if(confirm(`Слить «${fromName}» в «${toName}»? Все ссылки на «${fromName}» (из узлов сюжета и связей) переедут на «${toName}», а «${fromName}» станет «устарело».`)){
      const count=mergeEntities(selectedEntityId,targetId);
      alert(count?`Готово: перенесено ссылок — ${count}.`:'Готово: ссылок для переноса не нашлось.');
    }
    return;
  }
  if(e.target.id==='btnAddRelationHere'){
    const r=addRelation(selectedEntityId,'',(relationTypes[0]&&relationTypes[0].id)||'');
    if(r){ selectedRelationId=r.id; renderAll(); } return;
  }
  const del=e.target.closest('[data-delrelation]');
  if(del){ deleteRelation(del.dataset.delrelation); return; }
  const jump=e.target.closest('[data-jumpentity]');
  if(jump&&jump.dataset.jumpentity){ selectedEntityId=jump.dataset.jumpentity; selectedRelationId=null; selectedProposalId=null; renderAll(); return; }
  const row=e.target.closest('[data-relation]');
  if(row){ selectedRelationId=row.dataset.relation; renderAll(); }
  const jumpStory=e.target.closest('[data-jumpstory]');
  if(jumpStory){ setViewMode('story'); selectNode(jumpStory.dataset.jumpstory); focusNode(jumpStory.dataset.jumpstory); }
});

/* ---------- редактор связи — рендерится в общую правую панель #inspector, только когда
   viewMode==='world' (в режиме "Сюжет" эту же панель занимает renderInspector() из 04-inspector.js).
   getByPath/setByPath/condRowsHtml/addCondRow/addEffRow переиспользуются из существующих модулей. ---------- */
// Для <select>: скрывает "устаревшие" сущности из выбора для НОВОЙ связи, но никогда не прячет ту,
// что уже стоит в currentId — иначе выпадающий список молча показал бы другую сущность вместо
// реальной (сама связь при этом осталась бы прежней, просто выглядело бы как будто она изменилась).
function entitySelectOptionsHtml(currentId){
  const list=entities.filter(x=>x.status!=='deprecated'||x.id===currentId);
  return list.map(x=>`<option value="${esc(x.id)}" ${currentId===x.id?'selected':''}>${esc(entityDisplayName(x))}${x.status==='deprecated'?' (устарело)':''}</option>`).join('')||'<option value="">(нет сущностей)</option>';
}
function renderWorldInspector(){
  const el=document.getElementById('inspector');
  const r=findRelation(selectedRelationId);
  if(!r){ el.innerHTML='<div class="hint">Выбери связь на карточке сущности слева, чтобы редактировать её — или создай новую через «+ добавить связь».</div>'; return; }
  el.innerHTML=`
    <div class="group">
      <h3>Связь</h3>
      <div class="row">
        <div style="flex:1"><label class="small">От</label>
          <select data-relpath="from">${entitySelectOptionsHtml(r.from)}</select></div>
        <div style="flex:1"><label class="small">Тип</label>
          <select data-relpath="type">${relationTypes.map(t=>`<option value="${esc(t.id)}" ${r.type===t.id?'selected':''}>${esc(t.name)}</option>`).join('')||'<option value="">(нет типов)</option>'}</select></div>
        <div style="flex:1"><label class="small">К</label>
          <select data-relpath="to">${entitySelectOptionsHtml(r.to)}</select></div>
      </div>
      <div class="row" style="margin-top:6px">
        <div><label class="small">Статус</label>
          <select data-relpath="status">${RELATION_STATUS.map(([id,label])=>`<option value="${id}" ${r.status===id?'selected':''}>${label}</option>`).join('')}</select></div>
        <div style="flex:1"><label class="small">Источник</label>
          <input type="text" class="full" data-relpath="source" value="${esc(r.source)}" placeholder="напр. idea:bunker_start, design.md"></div>
      </div>
      <label class="small" style="margin-top:6px">Комментарий</label>
      <textarea data-relpath="comment">${esc(r.comment)}</textarea>
    </div>
    <div class="group">
      <h3>Условия (когда связь действует)</h3>
      ${condRowsHtml('conditions',r.conditions,false)}
    </div>
    <div class="group">
      <h3>Эффекты (что меняет, когда связь применяется)</h3>
      ${condRowsHtml('effects',r.effects,true)}
    </div>
    <button class="full danger" id="btnDeleteRelationHere">🗑 Удалить связь</button>
  `;
}
const worldInspectorEl=document.getElementById('inspector');
worldInspectorEl.addEventListener('input',e=>{
  if(viewMode!=='world'||readOnlyMode) return;
  const r=findRelation(selectedRelationId); if(!r) return;
  if(e.target.dataset.relpath){ r[e.target.dataset.relpath]=e.target.value; return; }
  const path=e.target.dataset.path; if(!path) return;
  let val=e.target.value; if(e.target.type==='number') val=num(val);
  setByPath(r,path,val);
});
worldInspectorEl.addEventListener('change',e=>{
  if(viewMode!=='world'||readOnlyMode) return;
  const r=findRelation(selectedRelationId); if(!r) return;
  if(e.target.dataset.relpath||e.target.dataset.path){ pushHistory(); renderAll(); }
});
worldInspectorEl.addEventListener('click',e=>{
  if(viewMode!=='world') return;
  const r=findRelation(selectedRelationId); if(!r) return;
  const addRow=e.target.closest('[data-addrow]');
  if(addRow){
    if(readOnlyMode) return;
    const path=addRow.dataset.addrow, arr=getByPath(r,path);
    if(path.endsWith('effects')) addEffRow(arr); else addCondRow(arr);
    pushHistory(); renderAll(); return;
  }
  const delRow=e.target.closest('[data-delrow]');
  if(delRow){
    if(readOnlyMode) return;
    const path=delRow.dataset.delrow, idx=path.lastIndexOf('.');
    const arr=getByPath(r,path.slice(0,idx));
    arr.splice(Number(path.slice(idx+1)),1);
    pushHistory(); renderAll(); return;
  }
  if(e.target.id==='btnDeleteRelationHere'){ if(!readOnlyMode&&confirm('Удалить связь?')) deleteRelation(r.id); return; }
});
