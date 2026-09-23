/* ============================================================
   MODULE 07 — ИНСТРУМЕНТ «ВЫДЕЛЕНИЕ»: рамка мышкой → Space → новый слой
   При захвате: вырезаем прямоугольник → (если включено) убираем фон заливкой от краёв рамки
   внутрь по схожести цвета с углами → обрезаем пустое пространство. Рамку не обязательно
   вести точно по контуру — операции ниже сами уберут лишнее вокруг объекта.
   ============================================================ */

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

/* ---------------- убрать фон заливкой от границ рамки (по схожести с цветом углов) ---------------- */
function floodRemoveBackground(cctx,w,h,tolerance){
  const img=cctx.getImageData(0,0,w,h);
  const d=img.data;
  const sample=(x,y)=>{ const i=(y*w+x)*4; return [d[i],d[i+1],d[i+2]]; };
  const corners=[sample(0,0),sample(w-1,0),sample(0,h-1),sample(w-1,h-1)];
  const bg=[0,1,2].map(c=>Math.round(corners.reduce((s,p)=>s+p[c],0)/4));
  const tol2=tolerance*tolerance*3;
  const visited=new Uint8Array(w*h);
  const stack=[];
  const closeToBg=i=>{ const dr=d[i]-bg[0],dg=d[i+1]-bg[1],db=d[i+2]-bg[2]; return dr*dr+dg*dg+db*db<=tol2; };
  const seed=(x,y)=>{ const idx=y*w+x; if(!visited[idx]&&closeToBg(idx*4)){ visited[idx]=1; stack.push(idx); } };
  for(let x=0;x<w;x++){ seed(x,0); seed(x,h-1); }
  for(let y=0;y<h;y++){ seed(0,y); seed(w-1,y); }
  while(stack.length){
    const idx=stack.pop(), x=idx%w, y=(idx/w)|0, i=idx*4;
    d[i+3]=0;
    const neigh=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    for(const [nx,ny] of neigh){
      if(nx<0||ny<0||nx>=w||ny>=h) continue;
      const nidx=ny*w+nx; if(visited[nidx]) continue;
      if(closeToBg(nidx*4)){ visited[nidx]=1; stack.push(nidx); }
    }
  }
  cctx.putImageData(img,0,0);
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
