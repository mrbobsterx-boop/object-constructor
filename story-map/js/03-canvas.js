/* ============================================================
   MODULE 03 — ХОЛСТ: узлы, связи, панорама/масштаб, перетаскивание, соединение
   Узлы — обычные позиционированные div'ы внутри #world; #world сдвигается/масштабируется через
   transform, поэтому связи рисуются в той же системе координат (#edgeLayer — SVG той же ширины/высоты
   с тем же transform) и НЕ нужно пересчитывать экранные координаты самим — только координаты узлов.
   ============================================================ */

const NODE_W=190, NODE_H=58;
const canvasOuter=document.getElementById('canvasOuter');
const worldEl=document.getElementById('world');
const edgeLayer=document.getElementById('edgeLayer');

function applyWorldTransform(){
  worldEl.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  edgeLayer.style.transform=worldEl.style.transform;
  document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%';
}
function setZoom(z){ zoom=Math.max(0.25,Math.min(2.5,z)); applyWorldTransform(); }

/* ---------- левая панель: переменные и список узлов ---------- */
function renderLeft(){
  const varEl=document.getElementById('varList');
  varEl.innerHTML=variables.map(v=>`
    <div class="varrow" data-var="${esc(v.id)}">
      <input type="text" value="${esc(v.name)}" data-vfield="name" style="flex:1">
      <select data-vfield="type">
        <option value="counter" ${v.type==='counter'?'selected':''}>число</option>
        <option value="flag" ${v.type==='flag'?'selected':''}>флаг</option>
      </select>
      <input type="number" value="${v.start}" data-vfield="start" title="начальное значение" style="width:56px">
      <button class="del-x" data-delvar="${esc(v.id)}">✕</button>
    </div>`).join('') || '<div class="hint">Нет переменных — добавь репутацию фракции, уровень опасности, счётчик дней и т.п.</div>';

  const nodeEl=document.getElementById('nodeList');
  document.getElementById('nodeCount').textContent=nodes.length;
  nodeEl.innerHTML=renderNodesByCategory();
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
function renderNodesByCategory(){
  if(!nodes.length) return '<div class="hint">Пока нет узлов.</div>';
  const byCat=new Map();
  nodes.forEach(n=>{ const cat=n.category||'story'; if(!byCat.has(cat)) byCat.set(cat,[]); byCat.get(cat).push(n); });
  const catOrder=[...byCat.keys()].sort((a,b)=>categoryName(a).localeCompare(categoryName(b),'ru'));
  return catOrder.map(cat=>{
    const list=byCat.get(cat);
    const rows=list.map(n=>{
      const summary=nodeAffectsSummary(n);
      return `<div class="noderow ${n.id===selectedNodeId?'active':''}" data-node="${esc(n.id)}">
        <span class="tag ${n.type}">${n.type}</span>
        <div class="nm-wrap"><span class="nm">${esc(n.title||'(без названия)')}</span>${summary?`<span class="affects muted small">→ ${esc(summary)}</span>`:''}</div>
        <button class="del-x" data-delnode="${esc(n.id)}">✕</button>
      </div>`;
    }).join('');
    return `<div class="cat-header">${esc(categoryName(cat))} <span class="muted small">(${list.length})</span></div>${rows}`;
  }).join('');
}
function focusNode(id){
  const n=findNode(id); if(!n) return;
  const rect=canvasOuter.getBoundingClientRect();
  zoom=1;
  pan.x=rect.width/2-(n.x+NODE_W/2);
  pan.y=rect.height/2-(n.y+NODE_H/2);
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
  const del=e.target.closest('[data-delvar]'); if(del){ deleteVariable(del.dataset.delvar); }
});
document.getElementById('nodeList').addEventListener('click',e=>{
  const del=e.target.closest('[data-delnode]');
  if(del){ if(confirm('Удалить узел? Ссылки на него из других переходов тоже уберутся.')) deleteNode(del.dataset.delnode); return; }
  const row=e.target.closest('[data-node]'); if(row){ selectNode(row.dataset.node); focusNode(row.dataset.node); }
});

/* ---------- холст: узлы + связи ---------- */
function nodeAnchorOut(n){ return {x:n.x+NODE_W,y:n.y+NODE_H/2}; }
function nodeAnchorIn(n){ return {x:n.x,y:n.y+NODE_H/2}; }
function edgePath(a,b){
  const dx=Math.max(40,Math.abs(b.x-a.x)/2);
  return `M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`;
}

let tempConnectFrom=null, tempConnectPt=null;

function renderCanvas(){
  worldEl.innerHTML=nodes.map(n=>{
    const outCount=n.choices.length;
    return `<div class="node-box ${n.type} ${n.id===selectedNodeId?'selected':''}" data-node="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;width:${NODE_W}px;min-height:${NODE_H}px">
      <div class="nb-title">${esc(n.title||'(без названия)')}</div>
      <div class="nb-meta"><span>${triggerLabel(n.trigger)}</span><span>→ ${outCount}</span></div>
      <div class="node-handle" data-handle="${esc(n.id)}" title="Тяни на другой узел — создать переход"></div>
    </div>`;
  }).join('');

  let svg=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>`;
  nodes.forEach(n=>{
    const a=nodeAnchorOut(n);
    n.choices.forEach(c=>{
      const target=findNode(c.target); if(!target) return;
      const b=nodeAnchorIn(target);
      svg+=`<path d="${edgePath(a,b)}" marker-end="url(#arrow)"></path>`;
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

/* ---------- взаимодействие: клик, перетаскивание узла, панорама, зум, соединение ---------- */
let dragNode=null, dragOffset=null, panDrag=null;

worldEl.addEventListener('pointerdown',e=>{
  const handle=e.target.closest('[data-handle]');
  const box=e.target.closest('.node-box');
  const worldPt=screenToWorld(e.clientX,e.clientY);
  if(handle){
    tempConnectFrom=handle.dataset.handle; tempConnectPt=worldPt;
    e.stopPropagation(); canvasOuter.setPointerCapture(e.pointerId);
    return;
  }
  if(box){
    const id=box.dataset.node;
    selectNode(id);
    const n=findNode(id);
    dragNode=id; dragOffset={x:worldPt.x-n.x,y:worldPt.y-n.y};
    e.stopPropagation(); canvasOuter.setPointerCapture(e.pointerId);
  }
});
canvasOuter.addEventListener('pointerdown',e=>{
  if(e.target!==canvasOuter&&e.target!==worldEl&&e.target.id!=='edgeLayer') return;
  panDrag={x0:e.clientX,y0:e.clientY,px0:pan.x,py0:pan.y};
  canvasOuter.classList.add('panning');
  canvasOuter.setPointerCapture(e.pointerId);
});
canvasOuter.addEventListener('pointermove',e=>{
  if(tempConnectFrom){ tempConnectPt=screenToWorld(e.clientX,e.clientY); renderCanvas(); return; }
  if(dragNode){ const p=screenToWorld(e.clientX,e.clientY); moveNode(dragNode,p.x-dragOffset.x,p.y-dragOffset.y); return; }
  if(panDrag){ pan.x=panDrag.px0+(e.clientX-panDrag.x0); pan.y=panDrag.py0+(e.clientY-panDrag.y0); applyWorldTransform(); }
});
canvasOuter.addEventListener('pointerup',e=>{
  if(tempConnectFrom){
    const worldPt=screenToWorld(e.clientX,e.clientY);
    const targetBox=[...worldEl.querySelectorAll('.node-box')].find(b=>{
      const n=findNode(b.dataset.node);
      return n&&worldPt.x>=n.x&&worldPt.x<=n.x+NODE_W&&worldPt.y>=n.y&&worldPt.y<=n.y+NODE_H;
    });
    if(targetBox&&targetBox.dataset.node!==tempConnectFrom) addChoice(tempConnectFrom,targetBox.dataset.node);
    tempConnectFrom=null; tempConnectPt=null; renderCanvas();
  }
  if(dragNode){ dragNode=null; commitMove(); }
  if(panDrag){ panDrag=null; canvasOuter.classList.remove('panning'); }
});
canvasOuter.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(zoom*(e.deltaY<0?1.1:0.9)); },{passive:false});

function screenToWorld(clientX,clientY){
  const r=canvasOuter.getBoundingClientRect();
  return { x:(clientX-r.left-pan.x)/zoom, y:(clientY-r.top-pan.y)/zoom };
}
