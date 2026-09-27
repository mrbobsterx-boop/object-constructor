/* ============================================================
   MODULE 03 — ХОЛСТ: узлы, связи, панорама/масштаб, перетаскивание, соединение
   Узлы — обычные позиционированные div'ы внутри #world; #world сдвигается/масштабируется через
   transform, поэтому связи рисуются в той же системе координат (#edgeLayer — SVG той же ширины/высоты
   с тем же transform) и НЕ нужно пересчитывать экранные координаты самим — только координаты узлов.
   ============================================================ */

const NODE_W=220, NODE_H=58;
const STICKY_W=180, STICKY_H=140;
const canvasOuter=document.getElementById('canvasOuter');
const worldEl=document.getElementById('world');
const edgeLayer=document.getElementById('edgeLayer');

function applyWorldTransform(){
  worldEl.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  edgeLayer.style.transform=worldEl.style.transform;
  document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%';
  renderMinimap();
}
function setZoom(z){ zoom=Math.max(0.25,Math.min(2.5,z)); applyWorldTransform(); }
function renderDirtyStatus(){
  const el=document.getElementById('dirtyStatus'); if(!el) return;
  el.textContent=dirty?'● Есть несохранённые изменения':'✓ Сохранено';
  el.className='status '+(dirty?'dirty':'clean');
}

/* ---------- левая панель: переменные (+ Dependency Explorer) и список узлов ---------- */
// Dependency Explorer переменной — кто её меняет (effects узлов/переходов/связей мира) и кто читает
// (условия узлов/переходов/связей). Раскрыта не более одной переменной за раз — это же множество
// узлов подсвечивается на холсте (см. computeVarHighlightSet), поэтому один активный фокус проще
// читать, чем несколько одновременно наложенных подсветок.
let expandedVarId=null;
function effectLabel(e){ const sym={set:'=',add:'+',subtract:'−'}[e.op]||e.op; return `${sym}${e.value}`; }
function variableDependents(varId){
  const writers=[], readers=[];
  nodes.forEach(n=>{
    n.effects.forEach(e=>{ if(e.var===varId) writers.push({nodeId:n.id,label:n.title,detail:effectLabel(e)}); });
    (n.trigger.kind==='conditions'?n.trigger.all:[]).forEach(c=>{ if(c.var===varId) readers.push({nodeId:n.id,label:n.title,detail:`${opSymbol(c.op)} ${c.value}`}); });
    n.choices.forEach(c=>{
      c.effects.forEach(e=>{ if(e.var===varId) writers.push({nodeId:n.id,label:`${n.title} → ${c.label||'?'}`,detail:effectLabel(e)}); });
      c.requires.forEach(r=>{ if(r.var===varId) readers.push({nodeId:n.id,label:`${n.title} → ${c.label||'?'}`,detail:`${opSymbol(r.op)} ${r.value}`}); });
    });
  });
  (typeof relations!=='undefined'?relations:[]).forEach(r=>{
    (r.effects||[]).forEach(e=>{ if(e.var===varId) writers.push({relationId:r.id,fromEntity:r.from,label:`Связь: ${relationTypeLabel(r.type)}`,detail:effectLabel(e)}); });
    (r.conditions||[]).forEach(c=>{ if(c.var===varId) readers.push({relationId:r.id,fromEntity:r.from,label:`Связь: ${relationTypeLabel(r.type)}`,detail:`${opSymbol(c.op)} ${c.value}`}); });
  });
  return {writers,readers};
}
function varDepRowHtml(d){
  const attr=d.nodeId?`data-jumpnode="${esc(d.nodeId)}"`:(d.relationId?`data-jumprel="${esc(d.relationId)}" data-jumprelentity="${esc(d.fromEntity)}"`:'');
  return `<div class="var-dep-row" ${attr}><span class="nm">${esc(d.label)}</span><span class="val">${esc(d.detail)}</span></div>`;
}
function varDepsHtml(v){
  const {writers,readers}=variableDependents(v.id);
  return `<div class="var-deps">
    <div class="var-deps-col"><div class="var-deps-h">Меняют (${writers.length})</div>${writers.map(varDepRowHtml).join('')||'<div class="hint small">нигде</div>'}</div>
    <div class="var-deps-col"><div class="var-deps-h">Читают (${readers.length})</div>${readers.map(varDepRowHtml).join('')||'<div class="hint small">нигде</div>'}</div>
  </div>`;
}
// Клик по проблеме в "Проверках" (§5) с varId — раскрывает Dependency Explorer этой переменной и
// прокручивает её в поле зрения, вместо того чтобы молча выделять что-то за кадром.
function focusVariableDependencies(varId){
  expandedVarId=varId;
  renderLeft(); renderCanvas();
  const row=document.querySelector(`.varrow[data-var="${CSS.escape(varId)}"]`);
  if(row) row.scrollIntoView({block:'center',behavior:'smooth'});
}
function renderLeft(){
  const varEl=document.getElementById('varList');
  varEl.innerHTML=variables.map(v=>{
    const expanded=expandedVarId===v.id;
    return `
    <div class="varrow" data-var="${esc(v.id)}">
      <div class="row" style="margin:0">
        <input type="text" value="${esc(v.name)}" data-vfield="name" placeholder="Название переменной" style="flex:1">
        <button class="dep-toggle ${expanded?'active':''}" data-depvar="${esc(v.id)}" title="Кто читает/меняет эту переменную">🔗</button>
      </div>
      <div class="row">
        <select data-vfield="type">
          <option value="counter" ${v.type==='counter'?'selected':''}>число</option>
          <option value="flag" ${v.type==='flag'?'selected':''}>флаг</option>
        </select>
        <input type="number" value="${v.start}" data-vfield="start" title="начальное значение" style="width:64px">
        <button class="del-x" data-delvar="${esc(v.id)}">✕</button>
      </div>
      ${expanded?varDepsHtml(v):''}
    </div>`;
  }).join('') || '<div class="hint">Нет переменных — добавь репутацию фракции, уровень опасности, счётчик дней и т.п.</div>';

  const nodeEl=document.getElementById('nodeList');
  document.getElementById('nodeCount').textContent=nodes.length;
  nodeEl.innerHTML=renderNodesByCategory();
}
// Множество узлов, которые пишут/читают текущую раскрытую (Dependency Explorer) переменную — холст
// подсвечивает их отдельным классом (не путать с .dimmed из режима фокуса — это активная подсветка,
// не приглушение остального).
function computeVarHighlightSet(){
  if(!expandedVarId) return null;
  const {writers,readers}=variableDependents(expandedVarId);
  const set=new Set();
  writers.concat(readers).forEach(d=>{ if(d.nodeId) set.add(d.nodeId); });
  return set;
}
// Группировка левой панели по разделу (SYSTEMS из Object Plan) — «раздел + ветки с тем, на что они
// влияют», чтобы список не превращался в кашу по мере роста графа.
function categoryName(id){
  const list=(typeof SYSTEMS!=='undefined')?SYSTEMS:[];
  const s=list.find(x=>x.id===id);
  return s?s.name:(id||'(без раздела)');
}
function nodeAffectsSummary(n){
  const ids=new Set();
  (n.effects||[]).forEach(e=>{ if(e.var) ids.add(e.var); });
  (n.choices||[]).forEach(c=>(c.effects||[]).forEach(e=>{ if(e.var) ids.add(e.var); }));
  const names=[...ids].map(id=>{ const v=findVariable(id); return v?v.name:id; });
  return names.join(', ');
}
// Поиск ищет не только название, но и текст, id, раздел/теги и имена переменных, которые узел трогает.
function nodeMatchesSearch(n,q){
  if(!q) return true;
  q=q.toLowerCase();
  if((n.title||'').toLowerCase().includes(q)) return true;
  if((n.text||'').toLowerCase().includes(q)) return true;
  if((n.id||'').toLowerCase().includes(q)) return true;
  if(categoryName(n.category).toLowerCase().includes(q)) return true;
  if((n.tags||[]).some(t=>categoryName(t).toLowerCase().includes(q)||t.toLowerCase().includes(q))) return true;
  const varIds=new Set();
  (n.effects||[]).forEach(e=>{ if(e.var) varIds.add(e.var); });
  (n.choices||[]).forEach(c=>(c.effects||[]).forEach(e=>{ if(e.var) varIds.add(e.var); }));
  for(const vid of varIds){ const v=findVariable(vid); if(v&&v.name.toLowerCase().includes(q)) return true; }
  return false;
}
function nodeMatchesStatus(n,status,reachable){
  if(!status) return true;
  if(status==='deadend') return !n.choices.length&&!n.ending;
  if(status==='ending') return !!n.ending;
  if(status==='unreachable') return n.trigger.kind==='conditions'&&!reachable.has(n.id);
  return true;
}
let collapsedCats=new Set();
function renderNodesByCategory(){
  if(!nodes.length) return '<div class="hint">Пока нет узлов.</div>';
  const q=(document.getElementById('nodeSearch')||{}).value||'';
  const typeFilter=(document.getElementById('filterType')||{}).value||'';
  const statusFilter=(document.getElementById('filterStatus')||{}).value||'';
  const reachable=computeReachable();
  const filtered=nodes.filter(n=>(!typeFilter||n.type===typeFilter)&&nodeMatchesSearch(n,q)&&nodeMatchesStatus(n,statusFilter,reachable));
  if(!filtered.length) return '<div class="hint">Ничего не найдено по этому запросу/фильтру.</div>';
  const byCat=new Map();
  filtered.forEach(n=>{ const cat=n.category||'story'; if(!byCat.has(cat)) byCat.set(cat,[]); byCat.get(cat).push(n); });
  const catOrder=[...byCat.keys()].sort((a,b)=>categoryName(a).localeCompare(categoryName(b),'ru'));
  return catOrder.map(cat=>{
    const list=byCat.get(cat);
    const isCollapsed=collapsedCats.has(cat);
    const rows=isCollapsed?'':list.map(n=>{
      const summary=nodeAffectsSummary(n);
      return `<div class="noderow ${multiSelected.has(n.id)?'active':''}" data-node="${esc(n.id)}">
        <span class="tag ${n.type}">${n.type}</span>
        <div class="nm-wrap"><span class="nm">${esc(n.title||'(без названия)')}</span>${summary?`<span class="affects muted small">→ ${esc(summary)}</span>`:''}</div>
        <button class="del-x" data-delnode="${esc(n.id)}">✕</button>
      </div>`;
    }).join('');
    return `<div class="cat-header ${isCollapsed?'collapsed':''}" data-cat="${esc(cat)}"><span class="arrow">▾</span>${esc(categoryName(cat))} <span class="muted small">(${list.length})</span></div>${rows}`;
  }).join('');
}
document.getElementById('nodeSearch').addEventListener('input',()=>{ document.getElementById('nodeList').innerHTML=renderNodesByCategory(); });
document.getElementById('filterType').addEventListener('change',()=>{ document.getElementById('nodeList').innerHTML=renderNodesByCategory(); });
document.getElementById('filterStatus').addEventListener('change',()=>{ document.getElementById('nodeList').innerHTML=renderNodesByCategory(); });

// Центрирует узел на текущем масштабе (не сбрасывает zoom) — резкий скачок при переходе между узлами
// на большой карте раздражает сильнее, чем сохранённый масштаб.
function focusNode(id){
  const n=findNode(id); if(!n) return;
  const rect=canvasOuter.getBoundingClientRect();
  pan.x=rect.width/2-(n.x+NODE_W/2)*zoom;
  pan.y=rect.height/2-(n.y+NODE_H/2)*zoom;
  applyWorldTransform();
}
function fitAll(){
  if(!nodes.length&&!stickyNotes.length) return;
  const xs=[...nodes.map(n=>n.x),...stickyNotes.map(s=>s.x)];
  const xe=[...nodes.map(n=>n.x+NODE_W),...stickyNotes.map(s=>s.x+STICKY_W)];
  const ys=[...nodes.map(n=>n.y),...stickyNotes.map(s=>s.y)];
  const ye=[...nodes.map(n=>n.y+NODE_H),...stickyNotes.map(s=>s.y+STICKY_H)];
  const minX=Math.min(...xs), maxX=Math.max(...xe);
  const minY=Math.min(...ys), maxY=Math.max(...ye);
  const rect=canvasOuter.getBoundingClientRect();
  const pad=60;
  const scaleX=(rect.width-pad*2)/Math.max(1,maxX-minX), scaleY=(rect.height-pad*2)/Math.max(1,maxY-minY);
  zoom=Math.max(0.25,Math.min(2.5,Math.min(scaleX,scaleY)));
  pan.x=rect.width/2-(minX+maxX)/2*zoom;
  pan.y=rect.height/2-(minY+maxY)/2*zoom;
  applyWorldTransform();
}

document.getElementById('varList').addEventListener('input',e=>{
  const row=e.target.closest('[data-var]'); if(!row) return;
  const field=e.target.dataset.vfield; if(!field) return;
  const v=findVariable(row.dataset.var); if(!v) return;
  v[field]=field==='start'?num(e.target.value):e.target.value;
});
document.getElementById('varList').addEventListener('change',e=>{
  const row=e.target.closest('[data-var]'); if(!row) return;
  if(e.target.dataset.vfield){ pushHistory(); renderChecks(); }
});
document.getElementById('varList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delvar]');
  if(del){ if(expandedVarId===del.dataset.delvar) expandedVarId=null; deleteVariable(del.dataset.delvar); return; }
  const dep=e.target.closest('[data-depvar]');
  if(dep){ expandedVarId=expandedVarId===dep.dataset.depvar?null:dep.dataset.depvar; renderLeft(); renderCanvas(); return; }
  const jumpNode=e.target.closest('[data-jumpnode]');
  if(jumpNode){ selectNode(jumpNode.dataset.jumpnode); focusNode(jumpNode.dataset.jumpnode); return; }
  const jumpRel=e.target.closest('[data-jumprel]');
  if(jumpRel&&typeof setViewMode==='function'){ selectedEntityId=jumpRel.dataset.jumprelentity; selectedRelationId=jumpRel.dataset.jumprel; setViewMode('world'); }
});
document.getElementById('nodeList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delnode]');
  if(del){ if(confirm('Удалить узел? Ссылки на него из других переходов тоже уберутся.')) deleteNode(del.dataset.delnode); return; }
  const catHeader=e.target.closest('[data-cat]');
  if(catHeader){
    const cat=catHeader.dataset.cat;
    if(collapsedCats.has(cat)) collapsedCats.delete(cat); else collapsedCats.add(cat);
    document.getElementById('nodeList').innerHTML=renderNodesByCategory();
    return;
  }
  const row=e.target.closest('[data-node]');
  if(row){
    if(e.ctrlKey||e.metaKey||e.shiftKey) toggleMultiSelect(row.dataset.node);
    else selectNode(row.dataset.node);
    focusNode(row.dataset.node);
  }
});

/* ---------- холст: узлы + связи ---------- */
function nodeAnchorOut(n){ return {x:n.x+NODE_W,y:n.y+NODE_H/2}; }
function nodeAnchorIn(n){ return {x:n.x,y:n.y+NODE_H/2}; }
// Порты фиксированы (выход — справа, вход — слева), поэтому у обычного перехода вперёд плавная
// S-кривая; а если цель левее источника (перехлёст колонок при импорте, обратная ссылка/цикл в
// сюжете), горизонтальные контрольные точки дали бы уродливую петлю через весь холст — вместо
// этого выгибаем кривую по вертикали, в сторону, где для неё есть место.
function edgePath(a,b){
  const forward=b.x>=a.x+30;
  if(forward){
    const dx=Math.max(40,Math.abs(b.x-a.x)/2);
    return `M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`;
  }
  const dir=(b.y>=a.y)?1:-1;
  const bow=Math.max(50,Math.min(160,Math.abs(b.y-a.y)/2+50));
  const c1x=a.x+70, c1y=a.y+dir*bow;
  const c2x=b.x-70, c2y=b.y-dir*bow;
  return `M${a.x},${a.y} C${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
}

let tempConnectFrom=null, tempConnectPt=null, connectHoverId=null;
let focusMode=false;

// "Режим фокуса": подсвечивает ветку, растущую ВПЕРЁД от выбранного узла (обычный BFS по choices),
// остальное на холсте притушивается — чтобы глазами проследить один путь в разросшемся графе, не
// отвлекаясь на остальные ветки. Не трогает список узлов слева и не меняет данные — чисто холст.
function computeFocusSet(){
  if(!focusMode||!selectedNodeId) return null;
  const set=new Set([selectedNodeId]);
  const queue=[selectedNodeId];
  while(queue.length){
    const cur=findNode(queue.shift()); if(!cur) continue;
    cur.choices.forEach(c=>{ if(c.target&&!set.has(c.target)){ set.add(c.target); queue.push(c.target); } });
  }
  return set;
}

// Заметки рендерятся в том же проходе и в том же контейнере (#world), что и узлы — тот же
// pan/zoom-transform, никакого отдельного слоя/пересчёта координат заводить не нужно.
function stickyNoteHtml(s){
  return `<div class="sticky-note ${esc(s.color)}" data-note="${esc(s.id)}" style="left:${s.x}px;top:${s.y}px;width:${STICKY_W}px;min-height:${STICKY_H}px">
    <div class="sticky-toolbar">
      <button class="sticky-btn" data-cyclecolor="${esc(s.id)}" title="Сменить цвет">🎨</button>
      <button class="sticky-btn" data-delnote="${esc(s.id)}" title="Удалить заметку">✕</button>
    </div>
    <textarea class="sticky-text" data-notetext="${esc(s.id)}" placeholder="Заметка…">${esc(s.text)}</textarea>
  </div>`;
}
function renderCanvas(){
  const focusSet=computeFocusSet();
  const varHighlightSet=computeVarHighlightSet();
  worldEl.innerHTML=`<div id="boxSelectOverlay"></div>`+nodes.map(n=>{
    const outCount=n.choices.length;
    const shown=n.choices.slice(0,3).map(c=>`<div class="nb-choice">${esc(c.label||'(без текста)')}</div>`).join('');
    const more=outCount>3?`<div class="nb-choice muted">+${outCount-3} ещё</div>`:'';
    const choicesHtml=outCount?`<div class="nb-choices">${shown}${more}</div>`:'';
    const dimmed=focusSet&&!focusSet.has(n.id);
    const connectHover=connectHoverId===n.id;
    const varHit=varHighlightSet&&varHighlightSet.has(n.id);
    return `<div class="node-box ${n.type} ${multiSelected.has(n.id)?'selected':''} ${dimmed?'dimmed':''} ${connectHover?'connect-hover':''} ${varHit?'var-dep-highlight':''}" data-node="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;width:${NODE_W}px;min-height:${NODE_H}px">
      <div class="nb-title">${esc(n.title||'(без названия)')}</div>
      <div class="nb-meta"><span>${triggerLabel(n.trigger)}</span><span>→ ${outCount}</span></div>
      ${choicesHtml}
      <div class="node-handle" data-handle="${esc(n.id)}" title="Тяни на другой узел (или на пустое место — создаст новый) — переход"></div>
    </div>`;
  }).join('')+stickyNotes.map(stickyNoteHtml).join('');

  let svg=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>`;
  nodes.forEach(n=>{
    const a=nodeAnchorOut(n);
    n.choices.forEach(c=>{
      const target=findNode(c.target); if(!target) return;
      const b=nodeAnchorIn(target);
      const dimmed=focusSet&&(!focusSet.has(n.id)||!focusSet.has(target.id));
      svg+=`<path class="${dimmed?'dimmed':''}" d="${edgePath(a,b)}" marker-end="url(#arrow)"></path>`;
    });
  });
  if(tempConnectFrom&&tempConnectPt){
    const src=findNode(tempConnectFrom);
    if(src) svg+=`<path class="temp" d="${edgePath(nodeAnchorOut(src),tempConnectPt)}"></path>`;
  }
  edgeLayer.innerHTML=svg;
  const bbox={w:Math.max(1200,...nodes.map(n=>n.x+400)),h:Math.max(800,...nodes.map(n=>n.y+300))};
  edgeLayer.setAttribute('width',bbox.w); edgeLayer.setAttribute('height',bbox.h);
  edgeLayer.setAttribute('viewBox',`0 0 ${bbox.w} ${bbox.h}`);
  applyWorldTransform();
}
function triggerLabel(t){
  if(!t) return '?';
  if(t.kind==='start') return '▶ старт';
  if(t.kind==='scheduled') return '⏱ через '+num(t.afterHours)+'ч';
  return '⚑ условие';
}

/* ---------- взаимодействие: клик/мультивыбор, перетаскивание (в т.ч. группой), панорама, зум,
   соединение (с быстрым созданием узла, если отпустить на пустом месте), рамка выделения ---------- */
let dragIds=null, dragStart=null, panDrag=null, boxSelectStart=null, boxSelectRect=null, stickyDrag=null;

// Общий поиск цели соединения — один и тот же во время наведения (подсветка) и при отпускании
// (собственно создание перехода), чтобы то, что подсвечено, и то, что реально свяжется, никогда не
// расходились. Сам источник соединения никогда не считается своей же целью; если под точкой
// оказалось несколько перекрывающихся узлов — берём последний (визуально верхний, т.к. .node-box
// рисуются в порядке nodes[] без z-index и более поздний перекрывает более ранний).
function connectTargetIdAt(worldPt){
  const candidates=[...worldEl.querySelectorAll('.node-box')].filter(b=>{
    if(b.dataset.node===tempConnectFrom) return false;
    const n=findNode(b.dataset.node);
    return n&&worldPt.x>=n.x&&worldPt.x<=n.x+NODE_W&&worldPt.y>=n.y&&worldPt.y<=n.y+NODE_H;
  });
  const box=candidates[candidates.length-1];
  return box?box.dataset.node:null;
}

worldEl.addEventListener('pointerdown',e=>{
  const stickyEl=e.target.closest('.sticky-note');
  // Перетаскивание заметки — но не когда целятся в её текст (иначе клик по textarea двигал бы
  // заметку вместо того, чтобы поставить туда курсор) и не по кнопкам её мини-панели.
  if(stickyEl&&!e.target.closest('textarea')&&!e.target.closest('button')){
    const id=stickyEl.dataset.note;
    const n=stickyNotes.find(s=>s.id===id); if(!n) return;
    stickyDrag={id,startPt:screenToWorld(e.clientX,e.clientY),baseX:n.x,baseY:n.y};
    e.stopPropagation(); canvasOuter.setPointerCapture(e.pointerId);
    return;
  }
  const handle=e.target.closest('[data-handle]');
  const box=e.target.closest('.node-box');
  const worldPt=screenToWorld(e.clientX,e.clientY);
  if(handle){
    tempConnectFrom=handle.dataset.handle; tempConnectPt=worldPt; connectHoverId=null;
    e.stopPropagation(); canvasOuter.setPointerCapture(e.pointerId);
    return;
  }
  if(box){
    const id=box.dataset.node;
    const additive=e.ctrlKey||e.metaKey||e.shiftKey;
    if(additive){ toggleMultiSelect(id); e.stopPropagation(); return; }
    if(!multiSelected.has(id)) selectNode(id); // клик по узлу вне текущего выделения — начать выделение заново
    const ids=multiSelected.size?[...multiSelected]:[id];
    dragIds=ids;
    dragStart={pt:worldPt,positions:new Map(ids.map(nid=>{ const nn=findNode(nid); return [nid,{x:nn.x,y:nn.y}]; }))};
    e.stopPropagation(); canvasOuter.setPointerCapture(e.pointerId);
  }
});
canvasOuter.addEventListener('pointerdown',e=>{
  if(e.target!==canvasOuter&&e.target!==worldEl&&e.target.id!=='edgeLayer') return;
  if(e.shiftKey){
    boxSelectStart=screenToWorld(e.clientX,e.clientY);
    boxSelectRect={x0:boxSelectStart.x,y0:boxSelectStart.y,x1:boxSelectStart.x,y1:boxSelectStart.y};
    canvasOuter.setPointerCapture(e.pointerId);
    return;
  }
  panDrag={x0:e.clientX,y0:e.clientY,px0:pan.x,py0:pan.y};
  canvasOuter.classList.add('panning');
  canvasOuter.setPointerCapture(e.pointerId);
});
canvasOuter.addEventListener('pointermove',e=>{
  if(stickyDrag){
    const p=screenToWorld(e.clientX,e.clientY);
    moveStickyNote(stickyDrag.id,stickyDrag.baseX+(p.x-stickyDrag.startPt.x),stickyDrag.baseY+(p.y-stickyDrag.startPt.y));
    return;
  }
  if(tempConnectFrom){
    tempConnectPt=screenToWorld(e.clientX,e.clientY);
    connectHoverId=connectTargetIdAt(tempConnectPt);
    renderCanvas();
    return;
  }
  if(boxSelectStart){
    const p=screenToWorld(e.clientX,e.clientY);
    boxSelectRect={x0:Math.min(boxSelectStart.x,p.x),y0:Math.min(boxSelectStart.y,p.y),x1:Math.max(boxSelectStart.x,p.x),y1:Math.max(boxSelectStart.y,p.y)};
    updateBoxSelectOverlay();
    return;
  }
  if(dragIds){
    const p=screenToWorld(e.clientX,e.clientY);
    const dx=p.x-dragStart.pt.x, dy=p.y-dragStart.pt.y;
    dragIds.forEach(id=>{ const n=findNode(id); const base=dragStart.positions.get(id); if(n&&base){ n.x=base.x+dx; n.y=base.y+dy; } });
    renderCanvas();
    return;
  }
  if(panDrag){ pan.x=panDrag.px0+(e.clientX-panDrag.x0); pan.y=panDrag.py0+(e.clientY-panDrag.y0); applyWorldTransform(); }
});
canvasOuter.addEventListener('pointerup',e=>{
  if(tempConnectFrom){
    const worldPt=screenToWorld(e.clientX,e.clientY);
    const targetId=connectTargetIdAt(worldPt);
    if(targetId) addChoice(tempConnectFrom,targetId);
    else { const created=addNode('event',worldPt.x,worldPt.y); addChoice(tempConnectFrom,created.id); }
    tempConnectFrom=null; tempConnectPt=null; connectHoverId=null; renderCanvas();
  }
  if(boxSelectStart){
    const r=boxSelectRect;
    const ids=nodes.filter(n=>n.x<r.x1&&n.x+NODE_W>r.x0&&n.y<r.y1&&n.y+NODE_H>r.y0).map(n=>n.id);
    multiSelected=new Set(ids);
    selectedNodeId=ids.length===1?ids[0]:null;
    boxSelectStart=null; boxSelectRect=null;
    hideBoxSelectOverlay();
    renderAll();
  }
  if(dragIds){ dragIds=null; dragStart=null; commitMove(); }
  if(stickyDrag){ stickyDrag=null; commitStickyMove(); }
  if(panDrag){ panDrag=null; canvasOuter.classList.remove('panning'); }
});
// Двойной клик по пустому месту холста (не по узлу и не по заметке) — быстро поставить заметку
// прямо там, как в Miro: N/click там нет модальных тулов, здесь роль такого "инструмента" играет
// сам жест двойного клика по пустоте.
canvasOuter.addEventListener('dblclick',e=>{
  if(e.target!==canvasOuter&&e.target!==worldEl&&e.target.id!=='edgeLayer') return;
  // Верхний левый угол в точку клика (как и быстрое создание узла при отпускании соединения на
  // пустом месте) — а не центрирование по клику: у центрирования заметка сдвигается вверх-влево на
  // половину своего размера, и клик у самого края холста мог бы увести её кнопки за видимую область.
  const p=screenToWorld(e.clientX,e.clientY);
  addStickyNote(p.x,p.y);
});

worldEl.addEventListener('input',e=>{
  const ta=e.target.closest('[data-notetext]'); if(!ta) return;
  const n=stickyNotes.find(s=>s.id===ta.dataset.notetext); if(!n) return;
  n.text=ta.value; // не грузим историю на каждую букву — коммит на blur (см. 'change' ниже)
});
worldEl.addEventListener('change',e=>{
  if(e.target.closest('[data-notetext]')) pushHistory();
});
worldEl.addEventListener('click',e=>{
  const del=e.target.closest('[data-delnote]');
  if(del){ deleteStickyNote(del.dataset.delnote); return; }
  const cyc=e.target.closest('[data-cyclecolor]');
  if(cyc){
    const n=stickyNotes.find(s=>s.id===cyc.dataset.cyclecolor); if(!n) return;
    const i=STICKY_COLORS.indexOf(n.color);
    updateStickyNote(n.id,{color:STICKY_COLORS[(i+1)%STICKY_COLORS.length]});
  }
});
canvasOuter.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(zoom*(e.deltaY<0?1.1:0.9)); },{passive:false});

function screenToWorld(clientX,clientY){
  const r=canvasOuter.getBoundingClientRect();
  return { x:(clientX-r.left-pan.x)/zoom, y:(clientY-r.top-pan.y)/zoom };
}
function updateBoxSelectOverlay(){
  const el=document.getElementById('boxSelectOverlay'); if(!el) return;
  const r=boxSelectRect;
  el.style.display='block';
  el.style.left=r.x0+'px'; el.style.top=r.y0+'px';
  el.style.width=(r.x1-r.x0)+'px'; el.style.height=(r.y1-r.y0)+'px';
}
function hideBoxSelectOverlay(){ const el=document.getElementById('boxSelectOverlay'); if(el) el.style.display='none'; }

/* ---------- миникарта ---------- */
let minimapView=null;
function renderMinimap(){
  const canvas=document.getElementById('minimapCanvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!nodes.length){ minimapView=null; return; }
  const minX=Math.min(...nodes.map(n=>n.x)), maxX=Math.max(...nodes.map(n=>n.x+NODE_W));
  const minY=Math.min(...nodes.map(n=>n.y)), maxY=Math.max(...nodes.map(n=>n.y+NODE_H));
  const pad=8;
  const scale=Math.min((canvas.width-pad*2)/Math.max(1,maxX-minX),(canvas.height-pad*2)/Math.max(1,maxY-minY));
  const ox=pad-minX*scale, oy=pad-minY*scale;
  nodes.forEach(n=>{
    ctx.fillStyle=multiSelected.has(n.id)?'#6bbf90':(n.type==='choice'?'#4f7fbf':n.type==='background'?'#c9834a':'#7c8794');
    ctx.fillRect(ox+n.x*scale,oy+n.y*scale,Math.max(2,NODE_W*scale),Math.max(2,NODE_H*scale));
  });
  const rect=canvasOuter.getBoundingClientRect();
  const vx0=-pan.x/zoom, vy0=-pan.y/zoom, vx1=vx0+rect.width/zoom, vy1=vy0+rect.height/zoom;
  ctx.strokeStyle='#e8edf3'; ctx.lineWidth=1;
  ctx.strokeRect(ox+vx0*scale,oy+vy0*scale,(vx1-vx0)*scale,(vy1-vy0)*scale);
  minimapView={scale,ox,oy};
}
document.getElementById('minimapCanvas').addEventListener('pointerdown',e=>{
  if(!minimapView) return;
  const r=e.target.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  const worldX=(mx-minimapView.ox)/minimapView.scale, worldY=(my-minimapView.oy)/minimapView.scale;
  const outerRect=canvasOuter.getBoundingClientRect();
  pan.x=outerRect.width/2-worldX*zoom; pan.y=outerRect.height/2-worldY*zoom;
  applyWorldTransform();
});

/* ---------- сужаемая левая панель ---------- */
(function initLeftResizer(){
  const resizer=document.getElementById('leftResizer');
  let dragging=false, startX=0, startW=0;
  resizer.addEventListener('pointerdown',e=>{
    dragging=true; startX=e.clientX; startW=document.getElementById('sideLeft').getBoundingClientRect().width;
    resizer.classList.add('dragging'); resizer.setPointerCapture(e.pointerId);
  });
  resizer.addEventListener('pointermove',e=>{
    if(!dragging) return;
    const w=Math.max(200,Math.min(560,startW+(e.clientX-startX)));
    document.documentElement.style.setProperty('--left-w',w+'px');
  });
  resizer.addEventListener('pointerup',e=>{ dragging=false; resizer.classList.remove('dragging'); resizer.releasePointerCapture(e.pointerId); });
})();
