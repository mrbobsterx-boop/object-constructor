/* ============================================================
   MODULE 06 — ИНСТРУМЕНТЫ: переключение + ластик/восстановить/растянуть
   Все указательные события холста разбираются здесь одним набором обработчиков и передаются
   дальше по инструменту — так на канвасе нет нескольких независимых слушателей одного события.
   ============================================================ */

let tool='select', brushSize=40, brushSoft=35;

function setToolUI(){
  document.querySelectorAll('.toolbtn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  const rows={
    autoselect:['autoSelectHint'],
    select:['selectHint'],
    erase:['brushSizeRow','brushSizeLabelRow','brushSoftRow'],
    restore:['brushSizeRow','brushSizeLabelRow','brushSoftRow'],
    transform:['transformHint']
  };
  ['autoSelectHint','selectHint','brushSizeRow','brushSizeLabelRow','brushSoftRow','transformHint'].forEach(id=>{
    document.getElementById(id).style.display=(rows[tool]||[]).includes(id)?'':'none';
  });
  document.getElementById('resizeHandles').style.display=tool==='transform'?'block':'none';
  if(tool==='transform'){ updateCursorRing(null); if(typeof positionHandles==='function') positionHandles(); }
  else document.getElementById('resizeOutline').style.display='none';
  if(tool!=='select'&&typeof cancelSelection==='function') cancelSelection();
}
// Только кнопки, у которых указан инструмент. Например, btnShowRemnants тоже
// выглядит как toolbtn, но не должен переключать текущий инструмент.
document.querySelectorAll('[data-tool]').forEach(b=>{ b.onclick=()=>{ tool=b.dataset.tool; setToolUI(); }; });
setToolUI();

const brushSizeInput=document.getElementById('brushSize'), brushSizeLabel=document.getElementById('brushSizeLabel');
brushSizeInput.oninput=()=>{ brushSize=+brushSizeInput.value; brushSizeLabel.textContent=brushSize+' px'; updateCursorRing(); };
document.getElementById('brushSoft').oninput=e=>{ brushSoft=+e.target.value; };

let drawing=false, lastPt=null;
const cursorRing=document.getElementById('cursorRing');

function canvasPointFromEvent(e){
  const r=canvas.getBoundingClientRect();
  const sx=canvas.width/r.width, sy=canvas.height/r.height;
  return { x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy };
}
function updateCursorRing(e){
  if(!e||tool==='select'||tool==='transform'||tool==='autoselect'){ cursorRing.style.display='none'; return; }
  const r=canvas.getBoundingClientRect();
  const dispSize=brushSize*(r.width/canvas.width);
  cursorRing.style.display='block';
  cursorRing.style.width=dispSize+'px'; cursorRing.style.height=dispSize+'px';
  cursorRing.style.left=(e.clientX-r.left-dispSize/2)+'px';
  cursorRing.style.top=(e.clientY-r.top-dispSize/2)+'px';
}
function stampAt(x,y){
  const r=brushSize/2;
  ctx.save();
  ctx.globalCompositeOperation=(tool==='erase')?'destination-out':'source-over';
  if(tool==='restore'){
    const base=targets[activeTargetKey]&&targets[activeTargetKey].baseCanvas; if(!base){ ctx.restore(); return; }
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(base,0,0);
    ctx.restore(); return;
  }
  const soft=brushSoft/100;
  if(soft<=0.02){
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill();
  } else {
    const grad=ctx.createRadialGradient(x,y,r*(1-soft),x,y,r);
    grad.addColorStop(0,'rgba(0,0,0,1)'); grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
  }
  ctx.restore();
}
function strokeTo(pt){
  if(lastPt){
    const dist=Math.hypot(pt.x-lastPt.x,pt.y-lastPt.y);
    const step=Math.max(1,brushSize/4);
    const n=Math.max(1,Math.floor(dist/step));
    for(let i=1;i<=n;i++) stampAt(lastPt.x+(pt.x-lastPt.x)*i/n, lastPt.y+(pt.y-lastPt.y)*i/n);
  } else stampAt(pt.x,pt.y);
  lastPt=pt;
}

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!activeTargetKey) return;
  if(tool==='autoselect'){ handleAutoSelectClick(canvasPointFromEvent(e)); return; }
  if(tool==='select'){ selectPointerDown(canvasPointFromEvent(e),e); return; }
  if(tool==='transform') return;
  drawing=true; lastPt=null;
  canvas.setPointerCapture(e.pointerId);
  pushHistory();
  strokeTo(canvasPointFromEvent(e));
});
canvas.addEventListener('pointermove',e=>{
  if(tool==='select'){ selectPointerMove(canvasPointFromEvent(e),e); return; }
  updateCursorRing(e);
  if(!drawing) return;
  strokeTo(canvasPointFromEvent(e));
});
canvas.addEventListener('pointerup',e=>{
  if(tool==='select'){ selectPointerUp(canvasPointFromEvent(e),e); return; }
  if(!drawing) return;
  drawing=false; lastPt=null; afterCanvasMutation();
});
canvas.addEventListener('pointerleave',()=>{ updateCursorRing(null); });
canvas.addEventListener('pointerenter',e=>{ updateCursorRing(e); });
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.ctrlKey||e.metaKey){ setZoom(zoom*(e.deltaY<0?1.1:0.9)); return; }
  if(tool==='erase'||tool==='restore'){
    brushSize=Math.max(4,Math.min(260,brushSize+(e.deltaY<0?4:-4))); brushSizeInput.value=brushSize; brushSizeLabel.textContent=brushSize+' px'; updateCursorRing(e);
  }
},{passive:false});

/* ---------------- «Растянуть за края» ---------------- */
const resizeHandles=document.getElementById('resizeHandles');
const resizeOutline=document.getElementById('resizeOutline');
const resizePreview=document.getElementById('resizePreview');
function positionHandles(){
  if(tool!=='transform'||!activeTargetKey) return;
  const wrapRect=document.getElementById('canvasWrap').getBoundingClientRect();
  const w=wrapRect.width, h=wrapRect.height;
  resizeOutline.style.display='block';
  resizeOutline.style.left='0'; resizeOutline.style.top='0'; resizeOutline.style.width=w+'px'; resizeOutline.style.height=h+'px';
  const pos={nw:[0,0],n:[w/2,0],ne:[w,0],w:[0,h/2],e:[w,h/2],sw:[0,h],s:[w/2,h],se:[w,h]};
  resizeHandles.querySelectorAll('.rhandle').forEach(el=>{
    const [x,y]=pos[el.dataset.h];
    el.style.left=(x-5.5)+'px'; el.style.top=(y-5.5)+'px';
  });
}
let rDrag=null;
resizeHandles.querySelectorAll('.rhandle').forEach(el=>{
  el.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    const rect=canvas.getBoundingClientRect();
    rDrag={ handle:el.dataset.h, startW:rect.width, startH:rect.height, startX:e.clientX, startY:e.clientY };
    el.setPointerCapture(e.pointerId);
    resizePreview.style.display='block';
    updateResizePreview(rect.width,rect.height);
  });
  el.addEventListener('pointermove',e=>{
    if(!rDrag) return;
    const dx=e.clientX-rDrag.startX, dy=e.clientY-rDrag.startY;
    let w=rDrag.startW, h=rDrag.startH;
    const has=s=>rDrag.handle.includes(s);
    if(has('e')) w=rDrag.startW+dx; if(has('w')) w=rDrag.startW-dx;
    if(has('s')) h=rDrag.startH+dy; if(has('n')) h=rDrag.startH-dy;
    if(e.shiftKey && rDrag.handle.length===2){
      const scale=Math.max(w/rDrag.startW, h/rDrag.startH);
      w=rDrag.startW*scale; h=rDrag.startH*scale;
    }
    w=Math.max(8,w); h=Math.max(8,h);
    updateResizePreview(w,h,rDrag.handle);
  });
  el.addEventListener('pointerup',()=>{
    if(!rDrag) return;
    const finalW=parseFloat(resizePreview.style.width), finalH=parseFloat(resizePreview.style.height);
    resizePreview.style.display='none';
    applyStretch(finalW/zoom, finalH/zoom, rDrag.handle);
    rDrag=null;
  });
});
function updateResizePreview(cssW,cssH,handle){
  const wrapRect=document.getElementById('canvasWrap').getBoundingClientRect();
  const stageRect=document.getElementById('stage').getBoundingClientRect();
  let left=wrapRect.left-stageRect.left, top=wrapRect.top-stageRect.top;
  if(handle&&(handle.includes('w'))) left-=(cssW-wrapRect.width);
  if(handle&&(handle.includes('n'))) top-=(cssH-wrapRect.height);
  resizePreview.style.left=left+'px'; resizePreview.style.top=top+'px';
  resizePreview.style.width=cssW+'px'; resizePreview.style.height=cssH+'px';
}
function applyStretch(newW,newH,handle){
  newW=Math.max(4,Math.round(newW)); newH=Math.max(4,Math.round(newH));
  if(newW===canvas.width && newH===canvas.height) return;
  pushHistory();
  const tmp=makeOffscreen(canvas.width,canvas.height);
  tmp.getContext('2d').drawImage(canvas,0,0);
  canvas.width=newW; canvas.height=newH;
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.clearRect(0,0,newW,newH);
  ctx.drawImage(tmp,0,0,tmp.width,tmp.height,0,0,newW,newH);
  afterCanvasMutation();
}
