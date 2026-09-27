/* ============================================================
   MODULE 10 — РЕЖИМ «МИР»: список сущностей/идей/типов связей, карточка сущности+связей,
   редактор связи (в правой панели — переиспользует condRowsHtml/getByPath/setByPath из
   04-inspector.js), переключатель режимов Сюжет/Мир.
   ============================================================ */

let viewMode='story';

function setViewMode(mode){
  viewMode=mode;
  const isWorld=mode==='world';
  if(isWorld){ selectedNodeId=null; multiSelected=new Set(); }
  document.getElementById('viewStoryBtn').classList.toggle('active',!isWorld);
  document.getElementById('viewWorldBtn').classList.toggle('active',isWorld);
  document.getElementById('storyLeftPanels').style.display=isWorld?'none':'';
  document.getElementById('worldLeftPanels').style.display=isWorld?'':'none';
  document.getElementById('canvasOuter').style.display=isWorld?'none':'';
  document.getElementById('worldCanvas').style.display=isWorld?'':'none';
  document.getElementById('storyZoombar').style.display=isWorld?'none':'';
  document.getElementById('storyHint').style.display=isWorld?'none':'';
  renderAll();
}
document.getElementById('viewStoryBtn').onclick=()=>setViewMode('story');
document.getElementById('viewWorldBtn').onclick=()=>setViewMode('world');

// Story → World: вызывается из инспектора узла (04-inspector.js) кликом по фишке-ссылке на сущность.
function jumpToWorldEntity(id){
  selectedEntityId=id; selectedRelationId=null;
  setViewMode('world');
}
// World → Story (обратное направление той же связи): какие узлы сюжета ссылаются на эту сущность
// через node.refs — без этого связь была бы дорогой в один конец.
function nodesReferencingEntity(entityId){
  return nodes.filter(n=>(n.refs||[]).includes(entityId));
}

/* ---------- левая панель режима «Мир»: сущности / идеи-предложения / типы связей ---------- */
function renderEntityListHtml(q){
  if(!entities.length) return '<div class="hint">Пока нет сущностей — добавь персонажа, локацию, или сошлись на предмет/навык/действие из Object Plan.</div>';
  q=(q||'').toLowerCase();
  const filtered=entities.filter(e=>!q||entityDisplayName(e).toLowerCase().includes(q)||entityKindLabel(e.kind).toLowerCase().includes(q)||(e.note||'').toLowerCase().includes(q));
  if(!filtered.length) return '<div class="hint">Ничего не найдено по этому запросу.</div>';
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
        <div class="nm-wrap"><span class="nm">${esc(entityDisplayName(e))}${deprecated?' <span class="muted small">(устарело)</span>':''}</span></div>
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
    <div class="noderow" data-proposal="${esc(p.id)}">
      <span class="tag ${esc(p.status)}">${p.status==='idea'?'идея':p.status==='accepted'?'принято':'отклонено'}</span>
      <div class="nm-wrap"><span class="nm">${esc(p.title)}</span></div>
      <button class="del-x" data-delproposal="${esc(p.id)}">✕</button>
    </div>`).join(''):'<div class="hint">Пока нет идей — закинь мысль текстом, потом при желании оформи как сущность.</div>';

  const rtEl=document.getElementById('relationTypeList');
  if(rtEl) rtEl.innerHTML=relationTypes.map(t=>`
    <div class="varrow" data-reltype="${esc(t.id)}">
      <div class="row" style="margin:0">
        <input type="text" value="${esc(t.name)}" data-rtfield="name" style="flex:1">
        <button class="del-x" data-delreltype="${esc(t.id)}">✕</button>
      </div>
    </div>`).join('')||'<div class="hint">Нет типов связей.</div>';
}

document.getElementById('btnAddEntity').onclick=()=>addEntity(document.getElementById('newEntityKind').value);
document.getElementById('entitySearch').addEventListener('input',()=>{
  document.getElementById('entityList').innerHTML=renderEntityListHtml(document.getElementById('entitySearch').value);
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
  if(row){ selectedEntityId=row.dataset.entity; selectedRelationId=null; renderAll(); }
});
document.getElementById('btnAddProposal').onclick=()=>{
  const input=document.getElementById('newProposalTitle');
  addProposal(input.value); input.value='';
};
document.getElementById('proposalList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delproposal]');
  if(del){ deleteProposal(del.dataset.delproposal); return; }
  const row=e.target.closest('[data-proposal]');
  if(row){
    if(readOnlyMode) return;
    const p=proposals.find(x=>x.id===row.dataset.proposal); if(!p) return;
    const kindId=(document.getElementById('newEntityKind')||{}).value||'concept';
    if(confirm(`Сделать сущностью «${p.title}» (тип: ${entityKindLabel(kindId)})? Тип берётся из выбора над кнопкой «+ добавить» слева.`)) promoteProposalToEntity(p.id,kindId);
  }
});
document.getElementById('btnAddRelType').onclick=()=>{
  const input=document.getElementById('newRelTypeName');
  addRelationType(input.value); input.value='';
};
document.getElementById('relationTypeList').addEventListener('input',e=>{
  if(readOnlyMode) return;
  const row=e.target.closest('[data-reltype]'); if(!row) return;
  const t=findRelationType(row.dataset.reltype); if(!t) return;
  if(e.target.dataset.rtfield==='name') t.name=e.target.value;
});
document.getElementById('relationTypeList').addEventListener('change',e=>{
  if(readOnlyMode) return;
  if(e.target.closest('[data-reltype]')){ pushHistory(); renderAll(); }
});
document.getElementById('relationTypeList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delreltype]'); if(del) deleteRelationType(del.dataset.delreltype);
});

/* ---------- карточка сущности + её связей (центральная область режима «Мир») ---------- */
function relationRowHtml(r,fromPerspectiveId){
  const isOutgoing=r.from===fromPerspectiveId;
  const otherId=isOutgoing?r.to:r.from;
  const other=findEntity(otherId);
  const arrow=isOutgoing?'→':'←';
  return `<div class="noderow ${selectedRelationId===r.id?'active':''}" data-relation="${esc(r.id)}">
    <span class="tag ${other?'':'err'}">${arrow} ${esc(relationTypeLabel(r.type))}</span>
    <div class="nm-wrap"><span class="nm" data-jumpentity="${esc(otherId||'')}">${esc(other?entityDisplayName(other):'(нет сущности)')}</span></div>
    <button class="del-x" data-delrelation="${esc(r.id)}">✕</button>
  </div>`;
}
function renderWorldCanvas(){
  const el=document.getElementById('entityDetail'); if(!el) return;
  const e=findEntity(selectedEntityId);
  if(!e){ el.innerHTML='<div class="hint">Выбери сущность слева — или добавь новую.</div>'; return; }
  const kind=entityKindDef(e.kind);
  const rels=relationsForEntity(e.id);
  const refNodes=nodesReferencingEntity(e.id);
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
      ${refNodes.map(n=>`<div class="noderow" data-jumpstory="${esc(n.id)}"><span class="tag ${esc(n.type)}">${esc(n.type)}</span><div class="nm-wrap"><span class="nm">${esc(n.title||'(без названия)')}</span></div></div>`).join('')||'<div class="hint">Пока ни один узел сюжета не ссылается на эту сущность (вкладка «Ссылки» в инспекторе узла).</div>'}
    </div>
  `;
}
document.getElementById('entityDetail').addEventListener('input',e=>{
  if(readOnlyMode) return;
  const ent=findEntity(selectedEntityId); if(!ent) return;
  if(e.target.id==='entityNameInput') ent.name=e.target.value;
  if(e.target.id==='entityNoteInput') ent.note=e.target.value;
});
document.getElementById('entityDetail').addEventListener('change',e=>{
  if(readOnlyMode) return;
  const ent=findEntity(selectedEntityId); if(!ent) return;
  if(e.target.id==='entityRefSelect'){ ent.ref={catalog:ent.ref.catalog,refId:e.target.value}; pushHistory(); renderAll(); return; }
  if(e.target.id==='entityNameInput'||e.target.id==='entityNoteInput'){ pushHistory(); renderAll(); }
});
document.getElementById('entityDetail').addEventListener('click',e=>{
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
  if(jump&&jump.dataset.jumpentity){ selectedEntityId=jump.dataset.jumpentity; selectedRelationId=null; renderAll(); return; }
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
