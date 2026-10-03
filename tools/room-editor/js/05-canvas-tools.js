/* ============================================================
   MODULE 05 — CANVAS TOOLS
   Pan/zoom, box select, zone painting, grid overlay, drop-to-place.
   ============================================================ */

/* ---- zoom / pan / deselect / drop-to-place ---- */
const canvasWrap=document.getElementById('canvasWrap');
let panning=false, panStart=null;
canvasWrap.addEventListener('contextmenu', e=>{ e.preventDefault(); });
canvasWrap.addEventListener('pointerdown', e=>{
  if(e.button===2){ panning=true; panStart={x:e.clientX-panX,y:e.clientY-panY}; canvasWrap.classList.add('panning'); e.preventDefault(); return; }
  if(e.target===canvasWrap || e.target.id==='stage' || e.target.id==='roomBounds' || e.target.id==='zoneGridCanvas'){
    if(paintMode){ startPaintZone(e); } else { startBoxSelect(e); }
  }
});
function startBoxSelect(e){
  const stage=document.getElementById('stage');
  const rect=stage.getBoundingClientRect();
  const start={x:(e.clientX-rect.left)/zoom, y:(e.clientY-rect.top)/zoom};
  let moved=false;
  const boxEl=document.createElement('div');
  boxEl.style.cssText='position:absolute;border:1px dashed #7fe9a0;background:#7fe9a022;pointer-events:none;z-index:80';
  stage.appendChild(boxEl);
  const move=ev=>{
    if(Math.abs(ev.clientX-e.clientX)>4 || Math.abs(ev.clientY-e.clientY)>4) moved=true;
    const cur={x:(ev.clientX-rect.left)/zoom, y:(ev.clientY-rect.top)/zoom};
    const x1=Math.min(start.x,cur.x), y1=Math.min(start.y,cur.y);
    boxEl.style.left=x1+'px'; boxEl.style.top=y1+'px';
    boxEl.style.width=Math.abs(cur.x-start.x)+'px'; boxEl.style.height=Math.abs(cur.y-start.y)+'px';
  };
  const up=ev=>{
    window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up);
    boxEl.remove();
    if(moved){
      const cur={x:(ev.clientX-rect.left)/zoom, y:(ev.clientY-rect.top)/zoom};
      finishBoxSelect(start.x,start.y,cur.x,cur.y);
    } else {
      selectedInstanceId=null; selectedBgLayerId=null;
      multiSelectedIds.clear(); multiSelectedBgIds.clear();
      renderRoom(); renderPropertiesPanel();
    }
  };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function finishBoxSelect(x1,y1,x2,y2){
  const minX=Math.min(x1,x2), maxX=Math.max(x1,x2), minY=Math.min(y1,y2), maxY=Math.max(y1,y2);
  multiSelectedIds.clear(); multiSelectedBgIds.clear();
  room.instances.forEach(inst=>{
    const w=inst.w*(inst.scale||1), h=inst.h*(inst.scale||1);
    const ix1=inst.x-w/2, ix2=inst.x+w/2, iy1=inst.y-h/2, iy2=inst.y+h/2;
    if(ix2>=minX && ix1<=maxX && iy2>=minY && iy1<=maxY) multiSelectedIds.add(inst.instanceId);
  });
  (room.backgroundLayers||[]).forEach(l=>{
    const sw=l.nativeWidth*(l.scale||1), sh=l.nativeHeight*(l.scale||1);
    const lx=(l.x!==undefined?l.x:room.width/2), ly=(l.y!==undefined?l.y:room.height/2);
    const lx1=lx-sw/2, lx2=lx+sw/2, ly1=ly-sh/2, ly2=ly+sh/2;
    if(lx2>=minX && lx1<=maxX && ly2>=minY && ly1<=maxY) multiSelectedBgIds.add(l.id);
  });
  selectedInstanceId=null; selectedBgLayerId=null;
  renderRoom(); renderPropertiesPanel();
}
function snapToCell(v){ return Math.round(v/CELL_PX)*CELL_PX; }
function startPaintZone(e){
  const stage=document.getElementById('stage');
  const rect=stage.getBoundingClientRect();
  const start={x:(e.clientX-rect.left)/zoom, y:(e.clientY-rect.top)/zoom};
  const wl=walkLineGeometry();
  const boxEl=document.createElement('div');
  const color = paintMode==='RED'?'#e7834d':paintMode==='GREEN'?'#4dbd7a':paintMode==='ORANGE'?'#e7c65b':'#ffffff';
  boxEl.style.cssText=`position:absolute;border:1px solid ${color};background:${color}55;pointer-events:none;z-index:96`;
  stage.appendChild(boxEl);
  const move=ev=>{
    const cur={x:(ev.clientX-rect.left)/zoom, y:(ev.clientY-rect.top)/zoom};
    const x1=snapToCell(Math.min(start.x,cur.x)), y1=snapToCell(Math.min(start.y,cur.y));
    const x2=snapToCell(Math.max(start.x,cur.x)), y2=snapToCell(Math.max(start.y,cur.y));
    boxEl.style.left=x1+'px'; boxEl.style.top=y1+'px'; boxEl.style.width=Math.max(CELL_PX,x2-x1)+'px'; boxEl.style.height=Math.max(CELL_PX,y2-y1)+'px';
  };
  const up=ev=>{
    window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up);
    boxEl.remove();
    const cur={x:(ev.clientX-rect.left)/zoom, y:(ev.clientY-rect.top)/zoom};
    const x1=snapToCell(Math.min(start.x,cur.x)), y1=snapToCell(Math.min(start.y,cur.y));
    const x2=snapToCell(Math.max(start.x,cur.x)), y2=snapToCell(Math.max(start.y,cur.y));
    const w=Math.max(CELL_PX,x2-x1), h=Math.max(CELL_PX,y2-y1);
    // красим/стираем каждую клетку под мазком — свободно в любом месте холста, кроме самой полосы ходьбы
    for(let cx=x1; cx<x1+w; cx+=CELL_PX){
      for(let cy=y1; cy<y1+h; cy+=CELL_PX){
        if(cy>=wl.topY && cy<wl.bottomY)continue; // защита: полоса ходьбы никогда не размечается
        const key=cellKey(cx+CELL_PX/2, cy+CELL_PX/2);
        if(paintMode==='ERASER') delete room.zoneCells[key];
        else room.zoneCells[key]=paintMode;
      }
    }
    renderZoneGridOverlay(); scheduleHistoryPush();
  };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function setPaintMode(mode){
  paintMode=mode;
  document.querySelectorAll('.paint-mode-btn').forEach(b=>b.classList.remove('active'));
  const map={null:'paintNone',RED:'paintRed',GREEN:'paintGreen',ORANGE:'paintOrange',ERASER:'paintEraser'};
  document.getElementById(map[mode]).classList.add('active');
  if(mode && !gridVisible) toggleGrid(true); // включаем сетку автоматически, чтобы было видно, что рисуешь
}
document.getElementById('paintNone').onclick=()=>setPaintMode(null);
document.getElementById('paintRed').onclick=()=>setPaintMode('RED');
document.getElementById('paintGreen').onclick=()=>setPaintMode('GREEN');
document.getElementById('paintOrange').onclick=()=>setPaintMode('ORANGE');
document.getElementById('paintEraser').onclick=()=>setPaintMode('ERASER');
document.getElementById('btnClearZones').onclick=()=>{
  if(!confirm('Убрать ВСЮ ручную разметку красного/зелёного/оранжевого в этой комнате? Останется только дефолт (пол снизу, зелёное сверху). Если нужно стереть только часть — используй ластик вместо этого.'))return;
  room.zoneCells={}; renderZoneGridOverlay(); scheduleHistoryPush();
};
document.getElementById('walkLineThickness').addEventListener('change', e=>{
  room.walkLineThicknessCm=Math.max(10,Math.round((+e.target.value||20)/10)*10);
  e.target.value=room.walkLineThicknessCm;
  renderZoneGridOverlay(); scheduleHistoryPush();
});

/* ============================================================
   ОВЕРЛЕЙ СЕТКИ/ЗОН — canvas поверх изображений, только для редактора
   ============================================================ */
function toggleGrid(force){
  gridVisible = (force!==undefined) ? force : !gridVisible;
  document.getElementById('zoneGridCanvas').style.display=gridVisible?'':'none';
  document.getElementById('btnToggleGrid').classList.toggle('active',gridVisible);
  if(gridVisible) renderZoneGridOverlay();
}
document.getElementById('btnToggleGrid').onclick=()=>toggleGrid();
window.addEventListener('keydown', e=>{
  if(e.ctrlKey && (e.code==='KeyG')){ e.preventDefault(); toggleGrid(); }
});
function renderZoneGridOverlay(){
  const canvas=document.getElementById('zoneGridCanvas');
  if(!gridVisible)return;
  canvas.width=room.width; canvas.height=room.height;
  canvas.style.width=room.width+'px'; canvas.style.height=room.height+'px';
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,room.width,room.height);
  const wl=walkLineGeometry();
  const cols=Math.ceil(room.width/CELL_PX), rows=Math.ceil(room.height/CELL_PX);
  // единый проход: цвет каждой клетки берём из zoneColorAt — того же источника, что решает коллизию.
  // рисуем каждую клетку РОВНО один раз, никакого базового слоя под разметкой — не может быть смешения.
  ctx.globalAlpha=0.35;
  for(let r=0;r<rows;r++){
    const cy=r*CELL_PX;
    for(let c=0;c<cols;c++){
      const cx=c*CELL_PX;
      const color=zoneColorAt(cx+CELL_PX/2, cy+CELL_PX/2);
      ctx.fillStyle = color==='RED'?'#e7834d':color==='GREEN'?'#4dbd7a':'#e7c65b';
      ctx.fillRect(cx,cy,CELL_PX,CELL_PX);
    }
  }
  // полоса ходьбы — всегда поверх, всегда видна
  ctx.globalAlpha=0.6;
  ctx.fillStyle='#4d9fe7';
  ctx.fillRect(0, wl.topY, room.width, wl.thicknessPx);
  // сетка линий: каждые 10см тонкая, каждый метр — толще
  ctx.globalAlpha=0.35;
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
  for(let x=0;x<=room.width;x+=CELL_PX){
    ctx.globalAlpha = (Math.round(x)%PIXELS_PER_METER===0) ? 0.7 : 0.25;
    ctx.lineWidth = (Math.round(x)%PIXELS_PER_METER===0) ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,room.height); ctx.stroke();
  }
  for(let y=0;y<=room.height;y+=CELL_PX){
    ctx.globalAlpha = (Math.round(y)%PIXELS_PER_METER===0) ? 0.7 : 0.25;
    ctx.lineWidth = (Math.round(y)%PIXELS_PER_METER===0) ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(room.width,y+0.5); ctx.stroke();
  }
  ctx.globalAlpha=1;
}
window.addEventListener('pointermove', e=>{ if(panning){ panX=e.clientX-panStart.x; panY=e.clientY-panStart.y; applyStageTransform(); } });
window.addEventListener('pointerup', ()=>{ panning=false; canvasWrap.classList.remove('panning'); });
canvasWrap.addEventListener('wheel', e=>{ if(!e.ctrlKey)return; e.preventDefault(); zoom=Math.max(0.1,Math.min(6,zoom*(e.deltaY<0?1.1:0.9))); applyStageTransform(); }, {passive:false});
canvasWrap.addEventListener('dragover', e=>e.preventDefault());
canvasWrap.addEventListener('drop', e=>{
  e.preventDefault();
  const data=e.dataTransfer.getData('text/plain'); if(!data)return;
  let item; try{ item=JSON.parse(data); }catch(err){ return; }
  const rect=document.getElementById('stage').getBoundingClientRect();
  const x=(e.clientX-rect.left)/zoom, y=(e.clientY-rect.top)/zoom;
  addInstance(item,x,y);
});
