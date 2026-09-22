/* ============================================================
   MODULE 15 — DESTRUCTIBLE BLOCKS (куски 20×20 см)
   Разрушаемые блоки: сетка 1×1 м = 100×100 px, в каждом блоке 5×5 кусков по 20×20 px.
   Куски ломаются по одному (в игре), поэтому у блока есть маска: 25 бит,
   бит (py*5+px) = 1 — кусок на месте (px, py = 0..4, слева направо и сверху вниз внутри блока).
   В редакторе блоки ставятся ЦЕЛЫМИ (рамкой по сетке 1 м) и всегда встык, без зазоров.

   Модуль подключается БЕЗ правок остальных JS-файлов: он оборачивает существующие
   функции (zoneColorAt, renderRoom, collectRoomJSON, loadRoomFromJSON,
   scanProjectFolderCatalog). Состояние живёт в room.world, поэтому undo/redo из
   MODULE 12 работает для блоков автоматически.

   Твёрдость: клетка, лежащая внутри существующего куска, считается КРАСНОЙ зоной
   (обёртка над zoneColorAt) — на блоки встают FLOOR_ONLY-объекты, внутрь блока
   объект поставить нельзя.

   Тип блока = объект каталога ОС категории «Блок / материал» (block). Картинка блока —
   его основная картинка; каждый кусок берёт свою 1/5 × 1/5 часть текстуры.
   Палитра справа показывает картинки типов блоков (клик — выбрать тип для рисования).
   Срез углов: у каждого куска внешние (торчащие) углы срезаются фаской block.bevel_px
   материала либо block_bevel_px из data/project_settings.json (по умолчанию 4 px).
   Угол торчит, если оба соседних по стороне куска отсутствуют. Внутренние углы прямые.
   За границей комнаты считаем «твёрдое» — на стыке комнат срез не рисуется.
   Срез — только визуальный, collision остаётся квадратной.

   JSON комнаты (добавляется ключ world, только если есть блоки):
   "world": {
     "blockSizeM": 1, "pieceSizeM": 0.2,
     "blocks": [ { "cx":0, "cy":2, "type":"dirt" },                       // целый блок
                 { "cx":1, "cy":2, "type":"dirt", "mask":33553407 } ]     // неполный блок
   }
   cx, cy — индексы клетки (1 клетка = blockSizeM метров, начало — левый верхний угол комнаты).
   mask не записывается у целого блока (= 33554431). Старые файлы читаются: у блока со
   state INTACT/DAMAGED — целый блок, DESTROYED/ABSENT — блока нет. Старый ключ
   world.neighbors (окружение 3×3) больше не используется: читается и отбрасывается.
   ============================================================ */

/* ---------- константы и состояние ---------- */
const WORLD_UI=!!document.getElementById('worldToolbar'); // без разметки в index.html модуль молча ничего не делает
const BLOCK_SIZE_M=1;
const PIECES_PER_SIDE=5;                                        // блок 1×1 м = 5×5 кусков
const PIECE_PX=PIXELS_PER_METER*BLOCK_SIZE_M/PIECES_PER_SIDE;   // 20 px = 20 см
const FULL_MASK=(1<<(PIECES_PER_SIDE*PIECES_PER_SIDE))-1;       // 25 бит = 33554431
let blockTool='off';          // off | paint | erase
let blockPaintType='';        // id объекта-блока из каталога
let pendingWorld=null;        // world открываемой комнаты: нужен ДО создания объектов, иначе они «провалятся» сквозь блоки
let blockLayerCache=null;     // {sig, cv} — готовый холст со всеми блоками (перерисовывается только при изменении)
const blockTexCache=new Map(); // id типа → {img, ready, failed}

function blockPx(){ return PIXELS_PER_METER*BLOCK_SIZE_M; }
function worldState(){
  if(!room.world) room.world={blocks:{}};
  if(!room.world.blocks) room.world.blocks={};
  return room.world;
}
function worldForLookup(){ return room.world||pendingWorld; }
function blockGridSize(){ const B=blockPx(); return {cols:Math.ceil(room.width/B-1e-9), rows:Math.ceil(room.height/B-1e-9)}; }
function setWorldStatus(text){ const el=document.getElementById('worldStatus'); if(el) el.textContent=text||''; }

/* ---------- куски и твёрдость ---------- */
function maskOf(b){ return (b&&b.mask!==undefined)?b.mask:FULL_MASK; }
function popcount(m){ let n=0; while(m){ n+=m&1; m>>>=1; } return n; }
function blockAt(cx,cy){ const ws=worldForLookup(); return (ws&&ws.blocks&&ws.blocks[cx+','+cy])||null; }
// gx, gy — глобальные индексы кусков от левого верхнего угла комнаты
function pieceSolidGlobal(gx,gy){
  const N=PIECES_PER_SIDE, cx=Math.floor(gx/N), cy=Math.floor(gy/N);
  const b=blockAt(cx,cy); if(!b) return false;
  return ((maskOf(b)>>>((gy-cy*N)*N+(gx-cx*N)))&1)===1;
}
function blockSolidAt(x,y){ return pieceSolidGlobal(Math.floor(x/PIECE_PX),Math.floor(y/PIECE_PX)); }

// Твёрдый кусок блока = красная зона. Так опора, проверка размещения и оверлей зон учитывают блоки без правок других модулей.
const __zoneColorAt=zoneColorAt;
zoneColorAt=function(x,y){ return blockSolidAt(x,y)?'RED':__zoneColorAt(x,y); };

// Пересчёт «корректности» объектов после правки блоков. Объекты не двигаем — только подсвечиваем (гравитацию считает игра).
function revalidateInstances(){
  (room.instances||[]).forEach(inst=>{ if(inst.isDecor){ inst.placementValid=true; return; } try{ inst.placementValid=isInstancePlacementValid(inst); }catch(e){} });
  if(typeof gridVisible!=='undefined'&&gridVisible&&typeof renderZoneGridOverlay==='function') renderZoneGridOverlay();
  if(typeof renderPropertiesPanel==='function') renderPropertiesPanel();
}

/* ---------- типы блоков из каталога ---------- */
function blockCatalogItem(id){ return projectCatalog.find(c=>c.id===id)||null; }
function blockTypeItems(all){ return projectCatalog.filter(c=>all||c.category==='block'); }
function blockTypeColor(id){ let h=0; for(const ch of String(id)) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h} 35% 30%)`; }
// Срез угла: свой у материала (block.bevel_px) или общий проектный; не больше половины куска
function bevelFor(typeId){
  const c=blockCatalogItem(typeId), v=c&&c.json&&c.json.block&&c.json.block.bevel_px;
  const px=(typeof v==='number'&&v>=0)?v:blockBevelPx;
  return Math.max(0,Math.min(PIECE_PX/2,px));
}
// Текстура блока (основная картинка объекта) для холста; готовность входит в подпись кэша слоя
function blockTexture(typeId){
  let rec=blockTexCache.get(typeId); if(rec) return rec;
  rec={img:null,ready:false,failed:false}; blockTexCache.set(typeId,rec);
  const c=blockCatalogItem(typeId), url=c&&c.image;
  if(!url){ rec.failed=true; return rec; }
  const im=new Image();
  im.onload=()=>{ rec.img=im; rec.ready=true; renderRoom(); };
  im.onerror=()=>{ rec.failed=true; };
  im.src=url;
  return rec;
}

/* ---------- отрисовка блоков на холсте ---------- */
// Контур куска со срезанными углами (tl, tr, br, bl — срезать ли соответствующий угол)
function piecePath(ctx,x,y,s,c,tl,tr,br,bl){
  ctx.beginPath();
  ctx.moveTo(x+(tl?c:0),y);
  ctx.lineTo(x+s-(tr?c:0),y);
  if(tr) ctx.lineTo(x+s,y+c);
  ctx.lineTo(x+s,y+s-(br?c:0));
  if(br) ctx.lineTo(x+s-c,y+s);
  ctx.lineTo(x+(bl?c:0),y+s);
  if(bl) ctx.lineTo(x,y+s-c);
  ctx.lineTo(x,y+(tl?c:0));
  if(tl) ctx.lineTo(x+c,y);
  ctx.closePath();
}
function paintBlockLayer(ctx,items,minX,minY,g){
  const N=PIECES_PER_SIDE, S=PIECE_PX, maxGX=g.cols*N, maxGY=g.rows*N;
  ctx.imageSmoothingEnabled=false;
  // за границей комнаты считаем «твёрдое»: на стыке комнат срез не рисуем
  const solid=(gx,gy)=>(gx<0||gy<0||gx>=maxGX||gy>=maxGY)?true:pieceSolidGlobal(gx,gy);
  for(const it of items){
    const tex=blockTexture(it.b.type), known=!!blockCatalogItem(it.b.type), c=bevelFor(it.b.type);
    const fill=known?blockTypeColor(it.b.type):'#3a2a2a';
    for(let py=0;py<N;py++) for(let px=0;px<N;px++){
      if(!((it.m>>>(py*N+px))&1)) continue;
      const gx=it.cx*N+px, gy=it.cy*N+py;
      const dx=(gx-minX*N)*S, dy=(gy-minY*N)*S;
      let tl=false,tr=false,br=false,bl=false;
      if(c>0){
        const up=solid(gx,gy-1), dn=solid(gx,gy+1), lf=solid(gx-1,gy), rt=solid(gx+1,gy);
        tl=!up&&!lf; tr=!up&&!rt; br=!dn&&!rt; bl=!dn&&!lf;
      }
      const cut=tl||tr||br||bl;
      if(cut){ ctx.save(); piecePath(ctx,dx,dy,S,c,tl,tr,br,bl); ctx.clip(); }
      if(tex.ready){ const iw=tex.img.naturalWidth, ih=tex.img.naturalHeight; ctx.drawImage(tex.img,px*iw/N,py*ih/N,iw/N,ih/N,dx,dy,S,S); }
      else { ctx.fillStyle=fill; ctx.fillRect(dx,dy,S,S); }
      if(cut) ctx.restore();
    }
  }
}
function renderBlocks(){
  const stage=document.getElementById('stage'), B=blockPx(), ws=worldForLookup();
  if(blockTool!=='off'){
    const g=document.createElement('div'); g.className='blk-grid dynamic-el';
    g.style.cssText=`width:${room.width}px;height:${room.height}px;background-size:${B}px ${B}px`;
    stage.appendChild(g);
  }
  if(!ws||!ws.blocks) return;
  const keys=Object.keys(ws.blocks); if(!keys.length) return;
  const g=blockGridSize(), items=[], types=new Set();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  let sig=(keys.length*31+g.cols*7+g.rows*13)|0;
  for(const k of keys){
    const p=k.split(','), cx=+p[0], cy=+p[1], b=ws.blocks[k], m=maskOf(b);
    if(!m||!Number.isInteger(cx)||!Number.isInteger(cy)) continue;
    items.push({cx,cy,b,m}); types.add(b.type);
    if(cx<minX)minX=cx; if(cy<minY)minY=cy; if(cx>maxX)maxX=cx; if(cy>maxY)maxY=cy;
    let th=0; for(const ch of String(b.type)) th=(Math.imul(th,31)+ch.charCodeAt(0))|0;
    sig=(Math.imul(sig,16777619)^Math.imul(cx,73856093)^Math.imul(cy,19349663)^m^th)|0;
  }
  if(!items.length) return;
  types.forEach(t=>{ const tx=blockTexture(t); sig=(Math.imul(sig,31)+(tx.ready?1:(tx.failed?2:3))+bevelFor(t)*7+(blockCatalogItem(t)?11:0))|0; });
  const W=(maxX-minX+1)*B, H=(maxY-minY+1)*B;
  if(!blockLayerCache||blockLayerCache.sig!==sig){
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    paintBlockLayer(cv.getContext('2d'),items,minX,minY,g);
    blockLayerCache={sig,cv};
  }
  const cv=blockLayerCache.cv;
  cv.className='blk-canvas dynamic-el';
  cv.style.cssText=`position:absolute;left:${minX*B}px;top:${minY*B}px;width:${W}px;height:${H}px;pointer-events:none;z-index:-500;image-rendering:pixelated`;
  stage.appendChild(cv);
}

/* ---------- инструменты: рамка по сетке 1 м ---------- */
function setBlockTool(t){
  if(t!=='off'&&t!=='paint'&&t!=='erase') t='off';
  blockTool=t;
  if(t!=='off'&&typeof setPaintMode==='function') setPaintMode(null); // не мешаем разметке зон
  canvasWrap.classList.toggle('blk-tool-on',t!=='off');
  document.querySelectorAll('[data-blk-tool]').forEach(b=>b.classList.toggle('active',b.dataset.blkTool===t));
  renderRoom();
}
function afterBlocksChanged(){
  blockLayerCache=null;
  revalidateInstances();
  scheduleHistoryPush();
  renderRoom();
}
function applyBlockRect(a,b){
  const ws=worldState(), g=blockGridSize();
  const x1=Math.max(0,Math.min(a.cx,b.cx)), x2=Math.min(g.cols-1,Math.max(a.cx,b.cx));
  const y1=Math.max(0,Math.min(a.cy,b.cy)), y2=Math.min(g.rows-1,Math.max(a.cy,b.cy));
  if(x2<x1||y2<y1) return 0;
  if(blockTool==='paint'&&!blockPaintType){ setWorldStatus('Сначала выбери тип блока — объект категории «Блок / материал» из Object Constructor.'); return 0; }
  let n=0;
  for(let cy=y1;cy<=y2;cy++) for(let cx=x1;cx<=x2;cx++){
    const k=cx+','+cy;
    if(blockTool==='paint'){ ws.blocks[k]={type:blockPaintType,mask:FULL_MASK}; n++; }
    else if(blockTool==='erase'){ if(ws.blocks[k]){ delete ws.blocks[k]; n++; } }
  }
  if(n) afterBlocksChanged(); else renderRoom();
  return n;
}
function startBlockRect(e){
  const stage=document.getElementById('stage'), B=blockPx();
  const cellAt=ev=>{ const p=clientToRoom(ev); return {cx:Math.floor(p.x/B), cy:Math.floor(p.y/B)}; };
  const a=cellAt(e); let b=a;
  const el=document.createElement('div'); el.className='blk-sel'; stage.appendChild(el);
  const draw=()=>{
    const x1=Math.min(a.cx,b.cx), y1=Math.min(a.cy,b.cy), x2=Math.max(a.cx,b.cx), y2=Math.max(a.cy,b.cy);
    el.style.cssText=`left:${x1*B}px;top:${y1*B}px;width:${(x2-x1+1)*B}px;height:${(y2-y1+1)*B}px`;
  };
  const move=ev=>{ b=cellAt(ev); draw(); };
  const up=()=>{ window.removeEventListener('pointermove',move); el.remove(); applyBlockRect(a,b); };
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up,{once:true});
  draw();
}
function fillBlocks(){
  if(!blockPaintType){ setWorldStatus('Сначала выбери тип блока.'); return; }
  const ws=worldState(), g=blockGridSize();
  if(Object.keys(ws.blocks).length&&!confirm('Заменить все существующие блоки выбранным типом?')) return;
  ws.blocks={};
  for(let cy=0;cy<g.rows;cy++) for(let cx=0;cx<g.cols;cx++) ws.blocks[cx+','+cy]={type:blockPaintType,mask:FULL_MASK};
  afterBlocksChanged();
}
function clearBlocks(){
  const ws=worldState();
  if(!Object.keys(ws.blocks).length) return;
  if(!confirm('Удалить все разрушаемые блоки этой комнаты?')) return;
  ws.blocks={}; afterBlocksChanged();
}

/* ---------- панель ---------- */
function refreshBlockPalette(){
  const sel=document.getElementById('blockTypeSelect'); if(!sel) return;
  const all=document.getElementById('blockShowAllTypes').checked;
  const items=blockTypeItems(all), prev=blockPaintType;
  if(!projectDirHandle) sel.innerHTML='<option value="">— подключи папку проекта —</option>';
  else if(!items.length) sel.innerHTML='<option value="">— нет объектов категории «Блок / материал» —</option>';
  else sel.innerHTML=items.map(c=>`<option value="${esc(c.id)}">${esc(c.name||c.id)}${c.category==='block'?'':' ('+esc(categoryLabel(c.category))+')'}</option>`).join('');
  sel.value=items.some(c=>c.id===prev)?prev:(items[0]?items[0].id:'');
  blockPaintType=sel.value;
  renderBlockPalette();
}
// Палитра с картинками типов блоков — те же объекты, что и в списке blockTypeSelect
function renderBlockPalette(){
  const box=document.getElementById('blockPalette'); if(!box) return;
  const all=document.getElementById('blockShowAllTypes').checked;
  const items=blockTypeItems(all);
  if(!projectDirHandle){ box.innerHTML='<div class="status">Подключи папку проекта — здесь появятся типы блоков.</div>'; return; }
  if(!items.length){ box.innerHTML='<div class="status">Нет объектов категории «Блок / материал». Создай их в Object Constructor.</div>'; return; }
  box.innerHTML='';
  items.forEach(c=>{
    const el=document.createElement('div');
    el.className='blk-pal-item'+(c.id===blockPaintType?' active':'');
    el.title=(c.name||c.id)+' · '+c.id;
    el.innerHTML=`<div class="blk-pal-thumb">${catalogThumbHtml(c,48)}</div><div class="blk-pal-name">${esc(c.name||c.id)}</div>`;
    el.onclick=()=>{
      blockPaintType=c.id;
      const sel=document.getElementById('blockTypeSelect'); if(sel) sel.value=c.id;
      renderBlockPalette();
    };
    box.appendChild(el);
  });
}
function updateWorldPanel(){
  if(!WORLD_UI) return;
  const ws=room.world||{blocks:{}}, g=blockGridSize();
  let total=0, partial=0, unknown=0, outside=0;
  Object.keys(ws.blocks||{}).forEach(k=>{
    const b=ws.blocks[k], p=k.split(','), cx=+p[0], cy=+p[1];
    total++; if(maskOf(b)!==FULL_MASK) partial++;
    if(!blockCatalogItem(b.type)) unknown++;
    if(cx<0||cy<0||cx>=g.cols||cy>=g.rows) outside++;
  });
  const B=blockPx(), notWhole=(room.width%B!==0)||(room.height%B!==0);
  let txt=total?`Блоков: ${total}`+(partial?` (неполных: ${partial})`:''):'Блоков пока нет.';
  txt+=` · сетка ${g.cols}×${g.rows} по ${BLOCK_SIZE_M} м, кусков ${PIECES_PER_SIDE}×${PIECES_PER_SIDE} по ${PIECE_PX} см`;
  if(notWhole) txt+=' · размер комнаты не кратен 1 м — крайние блоки выступают за границу';
  if(unknown) txt+=` · ⚠ типов нет в каталоге: ${unknown}`;
  if(outside) txt+=` · ⚠ вне комнаты: ${outside} (сохранятся; сотри их или увеличь комнату)`;
  const sum=document.getElementById('blockSummary'); if(sum) sum.textContent=txt;
  const shortEl=document.getElementById('blockSummaryShort'); if(shortEl) shortEl.textContent=total?`· блоков: ${total}`:'';
}
// Вписать комнату в экран
function fitWorldView(){
  const W=canvasWrap.clientWidth||900, H=canvasWrap.clientHeight||500;
  const z=Math.max(0.1,Math.min(6,Math.min((W-40)/room.width,(H-40)/room.height)));
  zoom=z; panX=-(room.width/2)*z; panY=-(room.height/2)*z;
  applyStageTransform();
}

/* ---------- JSON ---------- */
function worldToJSON(){
  const ws=room.world; if(!ws) return null;
  const blocks=[];
  Object.keys(ws.blocks||{}).forEach(k=>{
    const p=k.split(','), b=ws.blocks[k], m=maskOf(b);
    if(!m) return; // пустой блок не храним
    const o={cx:+p[0],cy:+p[1],type:b.type};
    if(m!==FULL_MASK) o.mask=m;
    blocks.push(o);
  });
  if(!blocks.length) return null; // комната без блоков — ключ world не пишем
  blocks.sort((a,b)=>a.cy-b.cy||a.cx-b.cx);
  return {blockSizeM:BLOCK_SIZE_M,pieceSizeM:BLOCK_SIZE_M/PIECES_PER_SIDE,blocks};
}
function worldFromJSON(w){
  const out={blocks:{}};
  if(w){
    (w.blocks||[]).forEach(b=>{
      if(!Number.isInteger(b.cx)||!Number.isInteger(b.cy)) return;
      let mask;
      if(Number.isInteger(b.mask)) mask=b.mask&FULL_MASK;
      else mask=(b.state==='DESTROYED'||b.state==='ABSENT')?0:FULL_MASK; // старый формат со state
      if(mask) out.blocks[b.cx+','+b.cy]={type:b.type,mask};
    });
    // w.neighbors (окружение 3×3) больше не поддерживается: не читаем и при сохранении не пишем
  }
  return out;
}

/* ---------- подключение к существующему коду (обёртки) ---------- */
const __collectRoomJSON=collectRoomJSON;
collectRoomJSON=function(){ const j=__collectRoomJSON(); const w=worldToJSON(); if(w) j.world=w; return j; };

const __loadRoomFromJSON=loadRoomFromJSON;
loadRoomFromJSON=async function(data){
  const w=worldFromJSON(data&&data.world);
  pendingWorld=w; // блоки должны быть известны уже при привязке объектов к полу внутри оригинала
  try{ await __loadRoomFromJSON(data); } finally { pendingWorld=null; }
  room.world=w;
  blockLayerCache=null;
  renderRoom();
};

const __renderRoom=renderRoom;
renderRoom=function(){
  __renderRoom();
  if(!WORLD_UI) return;
  try{ renderBlocks(); updateWorldPanel(); }catch(e){ console.warn('MODULE 15 (блоки):',e); }
};

const __scanProjectFolderCatalog=scanProjectFolderCatalog;
scanProjectFolderCatalog=async function(){
  blockTexCache.clear(); blockLayerCache=null;
  await __scanProjectFolderCatalog();
  refreshBlockPalette(); renderRoom();
};

/* ---------- события интерфейса ---------- */
if(WORLD_UI){
  // рамка по сетке: перехватываем нажатие раньше обычного выделения/перетаскивания
  canvasWrap.addEventListener('pointerdown',e=>{
    if(blockTool==='off'||e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    startBlockRect(e);
  },true);
  document.querySelectorAll('[data-blk-tool]').forEach(b=>b.onclick=()=>setBlockTool(b.dataset.blkTool));
  ['paintNone','paintRed','paintGreen','paintOrange','paintEraser'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.addEventListener('click',()=>{ if(blockTool!=='off') setBlockTool('off'); }); // разметка зон и блоки не работают одновременно
  });
  document.getElementById('blockTypeSelect').onchange=()=>{ blockPaintType=document.getElementById('blockTypeSelect').value; renderBlockPalette(); };
  document.getElementById('blockShowAllTypes').onchange=refreshBlockPalette;
  document.getElementById('btnBlocksFill').onclick=fillBlocks;
  document.getElementById('btnBlocksClear').onclick=clearBlocks;
  document.getElementById('btnWorldFit').onclick=fitWorldView;
  refreshBlockPalette();
  updateWorldPanel();
}
