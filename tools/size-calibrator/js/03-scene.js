/* ============================================================
   MODULE 03 — SCENE
   Персонаж (рост берётся из behavior survivor_base, по умолчанию 180×100 см)
   стоит на линии пола; выбранный объект рисуется рядом с ним в его НАСТОЯЩЕМ
   игровом размере (real_width_cm × real_height_cm, 1 см = 1 px при zoom=100%) —
   так сразу видно, если объект в разы больше/меньше, чем должен быть.
   ============================================================ */
let zoom=1, panX=80, panY=0, panning=false, panStart={x:0,y:0,panX:0,panY:0};

// Просторная сцена с запасом — персонаж и объекты не упираются в край при любом разумном размере.
const STAGE_W=6000, STAGE_H=2400, FLOOR_Y=1900;
const GAP_CM=70; // зазор между персонажем и объектом, см

function applyStageTransform(){
  document.getElementById('stage').style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;
  document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%';
}

function characterSize(){
  const b=objectsById['survivor_base']&&objectsById['survivor_base'].behavior;
  const w=(b&&b.real_width_cm>0)?b.real_width_cm:100;
  const h=(b&&b.real_height_cm>0)?b.real_height_cm:180;
  return {w,h};
}

function humanSvg(){
  return `<svg viewBox="0 0 100 180" preserveAspectRatio="xMidYMax meet">
    <circle cx="50" cy="18" r="15" fill="#4d78c9" fill-opacity=".85"/>
    <rect x="28" y="36" width="44" height="60" rx="12" fill="#4d78c9" fill-opacity=".85"/>
    <rect x="12" y="40" width="14" height="52" rx="7" fill="#4d78c9" fill-opacity=".65"/>
    <rect x="74" y="40" width="14" height="52" rx="7" fill="#4d78c9" fill-opacity=".65"/>
    <rect x="30" y="94" width="17" height="82" rx="8" fill="#4d78c9" fill-opacity=".85"/>
    <rect x="53" y="94" width="17" height="82" rx="8" fill="#4d78c9" fill-opacity=".85"/>
  </svg>`;
}

function renderStaticSceneChrome(){
  // Пол, вертикальная сетка метров, горизонтальная линейка роста рядом с персонажем — рисуются один раз.
  let html='';
  html+=`<div class="sc-floor" style="top:${FLOOR_Y}px;width:${STAGE_W}px"></div>`;
  for(let m=0,x=0;x<=STAGE_W;m++,x=m*PIXELS_PER_METER){
    html+=`<div class="sc-grid-v" style="left:${x}px;top:0;height:${FLOOR_Y}px"></div>`;
    if(m>0) html+=`<div class="sc-m-label" style="left:${x+3}px;top:${FLOOR_Y+6}px">${m} м</div>`;
  }
  for(let cm=0;cm<=400;cm+=50){
    const y=FLOOR_Y-cm;
    html+=`<div class="sc-ruler-tick" style="top:${y}px"></div>`;
    html+=`<div class="sc-ruler-label" style="left:13px;top:${y-6}px">${(cm/100).toFixed(cm%100?1:0)} м</div>`;
  }
  return html;
}

async function renderScene(obj,keepView){
  const stage=document.getElementById('stage');
  stage.style.width=STAGE_W+'px'; stage.style.height=STAGE_H+'px';
  const ch=characterSize();
  const charX=60;
  let html=renderStaticSceneChrome();
  html+=`<div class="sc-figure" style="left:${charX}px;top:${FLOOR_Y-ch.h}px;width:${ch.w}px;height:${ch.h}px">${humanSvg()}</div>`;
  html+=`<div class="sc-cap" style="left:${charX}px;top:${FLOOR_Y-ch.h-18}px">Персонаж — ${ch.h} см</div>`;

  if(obj){
    const b=obj.behavior||{};
    const w=Math.max(1,Number(b.real_width_cm)||0), h=Math.max(1,Number(b.real_height_cm)||0);
    const objX=charX+ch.w+GAP_CM, objTop=FLOOR_Y-h;
    const url=await getObjectImageUrl(obj.id);
    if(url){
      html+=`<img class="sc-obj" src="${url}" style="left:${objX}px;top:${objTop}px;width:${w}px;height:${h}px">`;
    } else {
      html+=`<div class="sc-obj-empty" style="left:${objX}px;top:${objTop}px;width:${w}px;height:${h}px">нет картинки<br>${esc(obj.name||obj.id)}</div>`;
    }
    html+=`<div class="sc-cap" style="left:${objX}px;top:${objTop-18}px">${esc(obj.name||obj.id)} — ${w}×${h} см</div>`;
  }
  stage.innerHTML=html;
  if(keepView){ applyStageTransform(); return; }
  // Автоцентрирование при смене объекта (но не при правке полей — иначе вид дёргался бы на каждый ввод):
  // подгоняем zoom/pan так, чтобы персонаж+объект влезли целиком.
  const wrap=document.getElementById('canvasWrap');
  const rightEdge = obj ? (charX+ch.w+GAP_CM+Math.max(1,Number((obj.behavior||{}).real_width_cm)||0)) : charX+ch.w;
  const sceneW=rightEdge+120, sceneH=ch.h+140;
  const fit=Math.min(1.6, Math.max(0.08, Math.min(wrap.clientWidth/sceneW, wrap.clientHeight/sceneH)));
  zoom=fit;
  panX=40; panY=wrap.clientHeight-FLOOR_Y*zoom-40;
  applyStageTransform();
}

function setZoom(z,aroundClientX,aroundClientY){
  const wrap=document.getElementById('canvasWrap');
  const rect=wrap.getBoundingClientRect();
  const cx=aroundClientX!==undefined?aroundClientX-rect.left:wrap.clientWidth/2;
  const cy=aroundClientY!==undefined?aroundClientY-rect.top:wrap.clientHeight/2;
  const stageX=(cx-panX)/zoom, stageY=(cy-panY)/zoom;
  zoom=Math.max(0.03,Math.min(6,z));
  panX=cx-stageX*zoom; panY=cy-stageY*zoom;
  applyStageTransform();
}

const canvasWrap=document.getElementById('canvasWrap');
canvasWrap.addEventListener('wheel',e=>{
  e.preventDefault();
  setZoom(zoom*(e.deltaY<0?1.1:0.9),e.clientX,e.clientY);
},{passive:false});
canvasWrap.addEventListener('pointerdown',e=>{
  if(e.target.closest('.sc-obj,.sc-figure')) { /* клик по объекту тоже можно таскать вид, не мешает */ }
  panning=true; panStart={x:e.clientX,y:e.clientY,panX,panY};
  canvasWrap.classList.add('panning'); canvasWrap.setPointerCapture(e.pointerId);
});
window.addEventListener('pointermove',e=>{ if(!panning) return; panX=panStart.panX+(e.clientX-panStart.x); panY=panStart.panY+(e.clientY-panStart.y); applyStageTransform(); });
window.addEventListener('pointerup',()=>{ panning=false; canvasWrap.classList.remove('panning'); });

document.getElementById('btnZoomIn').onclick=()=>setZoom(zoom*1.25);
document.getElementById('btnZoomOut').onclick=()=>setZoom(zoom*0.8);
document.getElementById('btnZoomReset').onclick=()=>{ if(objectsById[selectedId]) renderScene(objectsById[selectedId]); };
