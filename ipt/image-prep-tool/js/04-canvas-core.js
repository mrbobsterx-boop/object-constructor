/* ============================================================
   MODULE 04 — ХОЛСТ / ЦЕЛИ (ЛИСТ + СЛОИ) / ИСТОРИЯ / ЗУМ / ЛИНЕЙКА
   Один DOM-canvas переиспользуется для просмотра/правки то листа, то одного из слоёв —
   targets[key].canvas хранит актуальные пиксели каждой цели, когда она не активна.
   commitActiveToTarget() обязательно вызывается после любой правки активного холста.
   ============================================================ */

const canvas=document.getElementById('mainCanvas');
const ctx=canvas.getContext('2d',{willReadFrequently:true});
const HISTORY_LIMIT=40;

let targets={};          // key → {canvas, baseCanvas, history:[], future:[]}
let activeTargetKey=null;

function makeOffscreen(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function cloneToOffscreen(srcCanvas){ const c=makeOffscreen(srcCanvas.width,srcCanvas.height); c.getContext('2d').drawImage(srcCanvas,0,0); return c; }

function initSheetFromImage(img){
  const c=makeOffscreen(img.naturalWidth,img.naturalHeight);
  c.getContext('2d').drawImage(img,0,0);
  targets={ sheet:{ canvas:c, baseCanvas:cloneToOffscreen(c), history:[], future:[] } };
  layers=[]; layerCounter=0;
  activeTargetKey=null;
  setActiveTarget('sheet');
  if(typeof renderLayers==='function') renderLayers();
}
function createLayerTarget(key,layerCanvas){
  targets[key]={ canvas:layerCanvas, baseCanvas:cloneToOffscreen(layerCanvas), history:[], future:[] };
}
function removeTarget(key){ delete targets[key]; }

function commitActiveToTarget(){
  if(!activeTargetKey) return;
  const t=targets[activeTargetKey]; if(!t) return;
  t.canvas.width=canvas.width; t.canvas.height=canvas.height;
  const c=t.canvas.getContext('2d'); c.clearRect(0,0,canvas.width,canvas.height); c.drawImage(canvas,0,0);
}
function setActiveTarget(key){
  if(activeTargetKey===key) return;
  commitActiveToTarget();
  const t=targets[key]; if(!t) return;
  activeTargetKey=key;
  canvas.width=t.canvas.width; canvas.height=t.canvas.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(t.canvas,0,0);
  syncRemnantSize();
  updateUndoButtons();
  smartFit();
  updateRemnantOverlay();
  if(typeof renderLayers==='function') renderLayers();
  if(typeof onActiveTargetChanged==='function') onActiveTargetChanged(key);
}

/* ---------------- история (своя на каждую цель) ---------------- */
function pushHistory(){
  const t=targets[activeTargetKey]; if(!t) return;
  t.history.push(ctx.getImageData(0,0,canvas.width,canvas.height));
  if(t.history.length>HISTORY_LIMIT) t.history.shift();
  t.future=[];
  updateUndoButtons();
}
function afterCanvasMutation(){
  syncRemnantSize(); applyZoom(); updateRemnantOverlay(); commitActiveToTarget();
  if(activeTargetKey!=='sheet'&&typeof updateLayerThumb==='function') updateLayerThumb(activeTargetKey);
}
function undo(){
  const t=targets[activeTargetKey]; if(!t||!t.history.length) return;
  t.future.push(ctx.getImageData(0,0,canvas.width,canvas.height));
  const prev=t.history.pop();
  if(prev.width!==canvas.width||prev.height!==canvas.height){ canvas.width=prev.width; canvas.height=prev.height; }
  ctx.putImageData(prev,0,0);
  updateUndoButtons(); afterCanvasMutation();
}
function redo(){
  const t=targets[activeTargetKey]; if(!t||!t.future.length) return;
  t.history.push(ctx.getImageData(0,0,canvas.width,canvas.height));
  const next=t.future.pop();
  if(next.width!==canvas.width||next.height!==canvas.height){ canvas.width=next.width; canvas.height=next.height; }
  ctx.putImageData(next,0,0);
  updateUndoButtons(); afterCanvasMutation();
}
function updateUndoButtons(){
  const t=targets[activeTargetKey];
  document.getElementById('btnUndo').disabled=!t||!t.history.length;
  document.getElementById('btnRedo').disabled=!t||!t.future.length;
}
document.getElementById('btnUndo').onclick=undo;
document.getElementById('btnRedo').onclick=redo;

/* ---------------- зум ---------------- */
let zoom=1;
function applyZoom(){
  canvas.style.width=(canvas.width*zoom)+'px';
  canvas.style.height=(canvas.height*zoom)+'px';
  document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%';
  drawRulers(); if(typeof positionHandles==='function') positionHandles();
}
function plainFit(){
  const stageEl=document.getElementById('stage');
  const maxW=stageEl.clientWidth-40, maxH=stageEl.clientHeight-40;
  let z=Math.min(1, maxW/canvas.width, maxH/canvas.height);
  if(!(z>0)||!isFinite(z)) z=1;
  zoom=z; applyZoom();
}
function smartFit(){
  const stageEl=document.getElementById('stage');
  const maxW=stageEl.clientWidth-40, maxH=stageEl.clientHeight-40;
  let z=Math.min(1, maxW/canvas.width, maxH/canvas.height);
  if(!(z>0)||!isFinite(z)) z=1;
  if(canvas.width*z<220 && canvas.height*z<220){
    let zz=Math.min(maxW/canvas.width, maxH/canvas.height, 6);
    if(zz>z&&isFinite(zz)) z=zz;
  }
  zoom=z; applyZoom();
}
function setZoom(z){ zoom=Math.max(0.1,Math.min(12,z)); applyZoom(); }
document.getElementById('btnZoomOut').onclick=()=>setZoom(zoom/1.25);
document.getElementById('btnZoomIn').onclick=()=>setZoom(zoom*1.25);
document.getElementById('btnZoomFit').onclick=()=>plainFit();
document.getElementById('btnZoom100').onclick=()=>setZoom(1);
window.addEventListener('resize', ()=>{ drawRulers(); if(typeof positionHandles==='function') positionHandles(); });

/* ---------------- линейка (1 px картинки = 1 см, как в ОС при незаданном размере) ---------------- */
const rulerTop=document.getElementById('rulerTop'), rulerLeft=document.getElementById('rulerLeft');
const rtx=rulerTop.getContext('2d'), rlx=rulerLeft.getContext('2d');
function pickStepCm(cssPxPerCm){
  const nice=[1,2,5,10,20,50,100,200,500,1000,2000];
  for(const s of nice) if(s*cssPxPerCm>=42) return s;
  return nice[nice.length-1];
}
function drawRulers(){
  const stageEl=document.getElementById('stage');
  const tW=stageEl.clientWidth, lH=stageEl.clientHeight;
  if(rulerTop.width!==tW) rulerTop.width=tW;
  if(rulerTop.height!==20) rulerTop.height=20;
  if(rulerLeft.height!==lH) rulerLeft.height=lH;
  if(rulerLeft.width!==26) rulerLeft.width=26;
  rtx.clearRect(0,0,tW,20); rlx.clearRect(0,0,26,lH);
  if(!activeTargetKey) return;
  const stageRect=stageEl.getBoundingClientRect(), canvasRect=canvas.getBoundingClientRect();
  // canvas ещё скрыт (canvasWrap display:none) — ширина 0 превратила бы шаг линейки в ±Infinity и зациклила бы цикл ниже
  if(!(canvasRect.width>0)||!(canvas.width>0)) return;
  const cssScale=canvasRect.width/canvas.width;
  const offX=canvasRect.left-stageRect.left, offY=canvasRect.top-stageRect.top;
  const step=pickStepCm(cssScale);

  rtx.strokeStyle='#3b4654'; rtx.fillStyle='#8b96a3'; rtx.font='9px -apple-system,sans-serif'; rtx.textBaseline='top';
  let x0=Math.floor((0-offX)/cssScale/step)*step, x1=Math.ceil((tW-offX)/cssScale/step)*step;
  for(let cm=x0;cm<=x1;cm+=step){
    const sx=offX+cm*cssScale; if(sx<-1||sx>tW+1) continue;
    const major=Math.round(cm/step)%5===0;
    rtx.beginPath(); rtx.moveTo(Math.round(sx)+0.5, major?2:11); rtx.lineTo(Math.round(sx)+0.5,20); rtx.stroke();
    if(major&&cm!==0) rtx.fillText(String(cm), sx+3, 2);
  }
  if(offX>=-2&&offX<=tW) { rtx.strokeStyle='#6bbf90'; rtx.beginPath(); rtx.moveTo(Math.round(offX)+0.5,0); rtx.lineTo(Math.round(offX)+0.5,20); rtx.stroke(); }

  rlx.strokeStyle='#3b4654'; rlx.fillStyle='#8b96a3'; rlx.font='9px -apple-system,sans-serif';
  let y0=Math.floor((0-offY)/cssScale/step)*step, y1=Math.ceil((lH-offY)/cssScale/step)*step;
  for(let cm=y0;cm<=y1;cm+=step){
    const sy=offY+cm*cssScale; if(sy<-1||sy>lH+1) continue;
    const major=Math.round(cm/step)%5===0;
    rlx.beginPath(); rlx.moveTo(major?2:11, Math.round(sy)+0.5); rlx.lineTo(26,Math.round(sy)+0.5); rlx.stroke();
    if(major&&cm!==0){ rlx.save(); rlx.translate(9,sy-3); rlx.rotate(-Math.PI/2); rlx.textBaseline='bottom'; rlx.fillText(String(cm),0,0); rlx.restore(); }
  }
}
document.getElementById('stage').addEventListener('scroll', drawRulers);

/* ---------------- подсветка остатков ---------------- */
const ALPHA_THRESHOLD=10;
const remnantCanvas=document.getElementById('remnantCanvas');
const rctx=remnantCanvas.getContext('2d');
let showRemnants=false;
function syncRemnantSize(){ remnantCanvas.width=canvas.width; remnantCanvas.height=canvas.height; }
function updateRemnantOverlay(){
  if(!showRemnants) return;
  const w=canvas.width,h=canvas.height;
  const src=ctx.getImageData(0,0,w,h), out=rctx.createImageData(w,h);
  const s=src.data,d=out.data;
  for(let i=0;i<s.length;i+=4){ if(s[i+3]>ALPHA_THRESHOLD){ d[i]=255; d[i+1]=30; d[i+2]=30; d[i+3]=255; } }
  rctx.putImageData(out,0,0);
}
document.getElementById('btnShowRemnants').onclick=function(){
  showRemnants=!showRemnants;
  this.classList.toggle('active',showRemnants);
  this.textContent=showRemnants?'🔴 Скрыть подсветку':'🔴 Подсветить остатки';
  remnantCanvas.style.display=showRemnants?'block':'none';
  if(showRemnants) updateRemnantOverlay();
};

/* ---------------- обрезать пустое пространство / сбросить ---------------- */
function getTrimBox(){
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
  const w=canvas.width;
  for(let y=0;y<canvas.height;y++){
    for(let x=0;x<w;x++){
      const a=data[(y*w+x)*4+3];
      if(a>ALPHA_THRESHOLD){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    }
  }
  return maxX<0 ? null : {minX,minY,maxX,maxY};
}
function trimCanvas(pad){
  pad=pad===undefined?4:pad;
  const box=getTrimBox();
  if(!box) return false;
  const x0=Math.max(0,box.minX-pad), y0=Math.max(0,box.minY-pad);
  const x1=Math.min(canvas.width-1,box.maxX+pad), y1=Math.min(canvas.height-1,box.maxY+pad);
  const w=x1-x0+1, h=y1-y0+1;
  if(w===canvas.width && h===canvas.height) return true;
  const data=ctx.getImageData(x0,y0,w,h);
  canvas.width=w; canvas.height=h;
  ctx.putImageData(data,0,0);
  afterCanvasMutation();
  return true;
}
document.getElementById('btnTrim').onclick=()=>{
  if(!activeTargetKey) return;
  pushHistory();
  const ok=trimCanvas();
  if(!ok){ undo(); alert('На активном холсте не осталось непрозрачных пикселей — нечего обрезать.'); }
};
document.getElementById('btnResetImage').onclick=()=>{
  const t=targets[activeTargetKey]; if(!t) return;
  if(!confirm('Сбросить все правки активного холста и вернуться к исходной?')) return;
  pushHistory();
  canvas.width=t.baseCanvas.width; canvas.height=t.baseCanvas.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(t.baseCanvas,0,0);
  afterCanvasMutation();
};
