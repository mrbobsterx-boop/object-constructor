/* ============================================================
   MODULE 02 — ZOOM / GRID / PAN
   Building viewport: zoom steps, fit-to-view, grid toggle, wheel zoom, panning.
   ============================================================ */

/* ============================================================
   МАСШТАБ, СЕТКА И ПАНОРАМИРОВАНИЕ
   ============================================================ */
const buildingViewport=document.getElementById('buildingViewport');
const buildingCanvas=document.getElementById('buildingCanvas');
const gridOverlay=document.getElementById('gridOverlay');
let buildingZoom=1;
const ZOOM_STEPS=[0.05,0.08,0.10,0.125,0.167,0.20,0.25,0.33,0.5,0.67,0.8,1,1.25,1.5,2,2.5,3];
function setBuildingZoom(next,focusX=null,focusY=null){
  const old=buildingZoom;
  let idx=ZOOM_STEPS.findIndex(v=>Math.abs(v-next)<0.001);
  if(idx<0){
    next=Math.max(0.25,Math.min(3,next));
  } else next=ZOOM_STEPS[idx];
  if(Math.abs(next-old)<0.001){ updateZoomUI(); return; }
  // Сохраняем точку под курсором при изменении масштаба.
  const rect=buildingViewport.getBoundingClientRect();
  const fx=focusX==null ? rect.width/2 : focusX;
  const fy=focusY==null ? rect.height/2 : focusY;
  const contentX=(buildingViewport.scrollLeft+fx)/old;
  const contentY=(buildingViewport.scrollTop+fy)/old;
  buildingZoom=next;
  buildingCanvas.style.zoom=buildingZoom;
  requestAnimationFrame(()=>{
    buildingViewport.scrollLeft=Math.max(0,contentX*buildingZoom-fx);
    buildingViewport.scrollTop=Math.max(0,contentY*buildingZoom-fy);
  });
  updateZoomUI();
}
function updateZoomUI(){ document.getElementById('zoomLabel').textContent=Math.round(buildingZoom*100)+'%'; }
document.getElementById('btnZoomOut').onclick=()=>{ const i=ZOOM_STEPS.findIndex(v=>v>=buildingZoom)-1; setBuildingZoom(ZOOM_STEPS[Math.max(0,i)]); };
document.getElementById('btnZoomIn').onclick=()=>{ const i=ZOOM_STEPS.findIndex(v=>v>buildingZoom); setBuildingZoom(ZOOM_STEPS[i<0?ZOOM_STEPS.length-1:i]); };
document.getElementById('btnZoomReset').onclick=()=>setBuildingZoom(1);
function fitBuildingToViewport(){
  if(!placedRooms.length){ setBuildingZoom(1); return; }
  const rect=buildingViewport.getBoundingClientRect();
  const minX=Math.min(...placedRooms.map(p=>p.x));
  const minY=Math.min(...placedRooms.map(p=>p.y));
  const maxX=Math.max(...placedRooms.map(p=>p.x+p.w));
  const maxY=Math.max(...placedRooms.map(p=>p.y+p.h));
  const padding=40;
  const zx=(rect.width-padding*2)/Math.max(1,maxX-minX);
  const zy=(rect.height-padding*2)/Math.max(1,maxY-minY);
  const target=Math.max(0.05,Math.min(3,Math.min(zx,zy)));
  setBuildingZoom(target);
  requestAnimationFrame(()=>{
    buildingViewport.scrollLeft=Math.max(0,minX*buildingZoom-padding);
    buildingViewport.scrollTop=Math.max(0,minY*buildingZoom-padding);
  });
}
document.getElementById('btnZoomFit').onclick=fitBuildingToViewport;
document.getElementById('gridToggle').onchange=e=>gridOverlay.classList.toggle('hidden',!e.target.checked);
buildingViewport.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=buildingViewport.getBoundingClientRect();
  const fx=e.clientX-r.left, fy=e.clientY-r.top;
  const dir=e.deltaY<0?1:-1;
  const i=ZOOM_STEPS.findIndex(v=>v>=buildingZoom);
  const ni=Math.max(0,Math.min(ZOOM_STEPS.length-1,(i<0?ZOOM_STEPS.length-1:i)+dir));
  setBuildingZoom(ZOOM_STEPS[ni],fx,fy);
},{passive:false});
let panState=null;
buildingViewport.addEventListener('contextmenu',e=>e.preventDefault());
buildingViewport.addEventListener('pointerdown',e=>{
  if(e.button!==2)return;
  e.preventDefault();
  panState={x:e.clientX,y:e.clientY,scrollLeft:buildingViewport.scrollLeft,scrollTop:buildingViewport.scrollTop};
  buildingViewport.setPointerCapture?.(e.pointerId);
  buildingViewport.style.cursor='grabbing';
});
buildingViewport.addEventListener('pointermove',e=>{
  if(!panState)return;
  buildingViewport.scrollLeft=panState.scrollLeft-(e.clientX-panState.x);
  buildingViewport.scrollTop=panState.scrollTop-(e.clientY-panState.y);
});
function endPan(){ if(!panState)return; panState=null; buildingViewport.style.cursor=''; }
buildingViewport.addEventListener('pointerup',endPan);
buildingViewport.addEventListener('pointercancel',endPan);
updateZoomUI();
