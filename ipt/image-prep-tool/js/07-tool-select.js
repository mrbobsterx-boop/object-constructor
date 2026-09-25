/* ============================================================
 *  MODULE 07 — ИНСТРУМЕНТ «ВЫДЕЛЕНИЕ»: рамка мышкой → Space → новый слой
 *  При захвате вырезаем прямоугольник и обрезаем вокруг него пустое пространство — ровно то же,
 *  что делает кнопка «Обрезать пустое пространство» (btnTrim, см. 04-canvas-core.js: trimCanvas).
 *  Пиксели внутри рамки не трогаем: если у листа непрозрачный фон, его убирают ластиком отдельно,
 *  уже на самом слое. Рамку не обязательно вести точно по контуру — она обрежется по контенту сама,
 *  но только там, где действительно пусто (прозрачно), а не по цвету.
 *  ============================================================ */

let selDrag=null;
let pendingSelection=null;
const selectionBoxEl=document.getElementById('selectionBox');

function updateSelectionBoxFromCanvasRect(cx0,cy0,cx1,cy1){
  const x0=Math.min(cx0,cx1), y0=Math.min(cy0,cy1), x1=Math.max(cx0,cx1), y1=Math.max(cy0,cy1);
  const r=canvas.getBoundingClientRect();
  const scaleX=r.width/canvas.width, scaleY=r.height/canvas.height;
  selectionBoxEl.style.display='block';
  selectionBoxEl.style.left=(x0*scaleX)+'px'; selectionBoxEl.style.top=(y0*scaleY)+'px';
  selectionBoxEl.style.width=((x1-x0)*scaleX)+'px'; selectionBoxEl.style.height=((y1-y0)*scaleY)+'px';
}
function cancelSelection(){ selDrag=null; pendingSelection=null; selectionBoxEl.style.display='none'; }

function selectPointerDown(pt,e){
  if(activeTargetKey!=='sheet') return; // выделять новые объекты можно только на листе, не внутри уже вырезанного слоя
  selDrag={x0:pt.x,y0:pt.y};
  pendingSelection=null;
  updateSelectionBoxFromCanvasRect(pt.x,pt.y,pt.x,pt.y);
  canvas.setPointerCapture(e.pointerId);
}
function selectPointerMove(pt){
  if(!selDrag) return;
  updateSelectionBoxFromCanvasRect(selDrag.x0,selDrag.y0,pt.x,pt.y);
}
function selectPointerUp(pt){
  if(!selDrag) return;
  const x0=Math.min(selDrag.x0,pt.x), y0=Math.min(selDrag.y0,pt.y);
  const x1=Math.max(selDrag.x0,pt.x), y1=Math.max(selDrag.y0,pt.y);
  selDrag=null;
  if(x1-x0<3||y1-y0<3){ cancelSelection(); return; }
  pendingSelection={x0,y0,w:x1-x0,h:y1-y0};
}
function tryCaptureSelection(){
  if(tool!=='select'||!pendingSelection||activeTargetKey!=='sheet') return false;
  const {x0,y0,w,h}=pendingSelection;
  const layer=createLayerFromSheetRegion(x0,y0,w,h);
  cancelSelection();
  if(layer&&typeof onLayerCreated==='function') onLayerCreated(layer);
  return !!layer;
}

function trimOffscreen(srcCanvas,pad){
  pad=pad===undefined?4:pad;
  const w=srcCanvas.width,h=srcCanvas.height;
  const data=srcCanvas.getContext('2d').getImageData(0,0,w,h).data;
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const a=data[(y*w+x)*4+3]; if(a>ALPHA_THRESHOLD){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } }
  if(maxX<0) return null;
  const x0=Math.max(0,minX-pad), y0=Math.max(0,minY-pad), x1=Math.min(w-1,maxX+pad), y1=Math.min(h-1,maxY+pad);
  const nw=x1-x0+1, nh=y1-y0+1;
  const out=makeOffscreen(nw,nh);
  out.getContext('2d').drawImage(srcCanvas,x0,y0,nw,nh,0,0,nw,nh);
  return out;
}
