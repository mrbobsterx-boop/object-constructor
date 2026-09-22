/* ============================================================
   MODULE 04 — ROOM STATE + CANVAS RENDER
   Room state, stage transform, renderRoom, ruler, selection handles,
   drag/rotate bindings for instances and background layers.
   ============================================================ */

let room={ id:'', name:'', type:'', width:640, height:220, backgroundLayers:[], playerWalkZ:10, instances:[], walkLineThicknessCm:20, zoneCells:{}, compositionRole:'CENTER_CENTER', stairConnections:[] };
let selectedInstanceId=null;
let selectedBgLayerId=null;
let multiSelectedIds=new Set(); // instanceId[] — для рамки выделения / сетов
let multiSelectedBgIds=new Set();
let draggingInvalidId=null; // instanceId, у которого сейчас нет опоры под ногами (подсветка во время перетаскивания)
let paintMode=null; // null | 'RED' | 'GREEN' | 'ORANGE'
let gridVisible=false;
let zoom=1, panX=0, panY=0;

function applyStageTransform(){ document.getElementById('stage').style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`; document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%'; renderRoomDimensionRuler(); }

function getCompositionSocketPosition(position){
  const onePointFiveM=1.5*PIXELS_PER_METER;
  const xLeft=Math.min(onePointFiveM,room.width/2);
  const xRight=Math.max(room.width-onePointFiveM,room.width/2);
  const xCenter=room.width/2;
  const yTop=0, yBottom=room.height;
  const map={
    TOP_LEFT:{x:xLeft,y:yTop,direction:'UP'},
    TOP_CENTER:{x:xCenter,y:yTop,direction:'UP'},
    TOP_RIGHT:{x:xRight,y:yTop,direction:'UP'},
    BOTTOM_LEFT:{x:xLeft,y:yBottom,direction:'DOWN'},
    BOTTOM_CENTER:{x:xCenter,y:yBottom,direction:'DOWN'},
    BOTTOM_RIGHT:{x:xRight,y:yBottom,direction:'DOWN'}
  };
  return map[position]||null;
}
function renderCompositionUI(){
  document.querySelectorAll('#compositionGrid .composition-cell').forEach(btn=>btn.classList.toggle('active',btn.dataset.role===room.compositionRole));
  document.querySelectorAll('#stairSocketControls [data-stair]').forEach(btn=>btn.classList.toggle('active',(room.stairConnections||[]).includes(btn.dataset.stair)));
}
function renderStairSocketMarkers(){
  const stage=document.getElementById('stage');
  stage.querySelectorAll('.stair-socket-marker').forEach(el=>el.remove());
  const sockets=room.stairConnections||[];
  sockets.forEach(position=>{
    const p=getCompositionSocketPosition(position); if(!p)return;
    const marker=document.createElement('div');
    marker.className='stair-socket-marker active dynamic-el';
    marker.textContent=p.direction==='UP'?'↑':'↓';
    marker.title=`Лестница ${p.direction==='UP'?'вверх':'вниз'} · ${position}`;
    marker.style.left=p.x+'px'; marker.style.top=p.y+'px';
    stage.appendChild(marker);
  });
}
function renderRoom(){
  const bounds=document.getElementById('roomBounds');
  bounds.style.width=room.width+'px'; bounds.style.height=room.height+'px';
  const stage=document.getElementById('stage');
  stage.querySelectorAll('.dynamic-el').forEach(el=>el.remove());
  room.backgroundLayers.forEach((layer,idx)=>{
    const bg=document.createElement('img');
    const sw=layer.nativeWidth*(layer.scale||1), sh=layer.nativeHeight*(layer.scale||1);
    bg.className='dynamic-el room-instance'+(layer.id===selectedBgLayerId?' selected':'')+(multiSelectedBgIds.has(layer.id)?' multi-selected':'');
    bg.style.position='absolute';
    bg.style.left=((layer.x!==undefined?layer.x:room.width/2)-sw/2)+'px';
    bg.style.top=((layer.y!==undefined?layer.y:room.height/2)-sh/2)+'px';
    bg.style.width=sw+'px'; bg.style.height=sh+'px'; bg.style.zIndex=-1000+idx; bg.style.cursor='grab';
    bg.style.opacity=layer.opacity;
    bg.style.transform=`rotate(${layer.rotation||0}deg) scaleX(${layer.flipH?-1:1}) scaleY(${layer.flipV?-1:1})`;
    bg.src=layer.dataUrl;
    bindBgLayerEvents(bg,layer);
    stage.appendChild(bg);
  });
  room.instances.forEach(inst=>{
    if(inst.light){
      const glow=document.createElement('div');
      glow.className='dynamic-el';
      const r=inst.light.radius*(inst.scale||1);
      const blurPx=Math.round(r*0.12);
      let bg;
      if(inst.light.shape==='CONE'){
        // наша система углов: 0=вправо,90=вниз,180=влево,270=вверх (по часовой). CSS conic-gradient: 0=вверх,по часовой.
        const cssAngle=((inst.light.angle||90)+90+360)%360;
        const half=(inst.light.spread||60)/2;
        const softFrac=inst.light.softness!==undefined&&inst.light.softness!==null?inst.light.softness:0.4;
        const soft=Math.max(1,half*softFrac);
        const start=cssAngle-half;
        bg=`conic-gradient(from ${start}deg at center, transparent 0deg, ${inst.light.color}55 ${soft}deg, ${inst.light.color}55 ${half*2-soft}deg, transparent ${half*2}deg)`;
      } else {
        bg=`radial-gradient(circle, ${inst.light.color}66 0%, ${inst.light.color}00 70%)`;
      }
      glow.style.cssText=`position:absolute;left:${inst.x-r}px;top:${inst.y-r}px;width:${r*2}px;height:${r*2}px;border-radius:50%;pointer-events:none;z-index:${inst.zIndex-0.5};opacity:${Math.min(1,inst.light.intensity)};filter:blur(${blurPx}px);background:${bg};`;
      stage.appendChild(glow);
    }
  });
  /* приближённые тени — только прикидка для превью, настоящие мягкие тени со всеми источниками света считает Godot в игре */
  const lightInstances=room.instances.filter(i=>i.light);
  room.instances.forEach(inst=>{
    if(!inst.shadow || !lightInstances.length) return;
    let best=null, bestDist=Infinity;
    lightInstances.forEach(l=>{
      if(l===inst) return;
      const dist=Math.hypot(inst.x-l.x, inst.y-l.y);
      const r=l.light.radius*(l.scale||1);
      if(dist<r && dist<bestDist){ best=l; bestDist=dist; }
    });
    if(!best) return;
    const dist=Math.max(1,bestDist);
    const r=best.light.radius*(best.scale||1);
    const falloff=Math.max(0,1-dist/r);
    const absorption=inst.shadow.absorption!==undefined?inst.shadow.absorption:0.7;
    const opacity=Math.min(0.85, absorption*falloff);
    if(opacity<=0.02) return;
    const dirX=(inst.x-best.x)/dist, dirY=(inst.y-best.y)/dist;
    const objectW=inst.w*(inst.scale||1), objectH=inst.h*(inst.scale||1);
    const shadowStretch=0.65+falloff*0.75;
    const sw=Math.max(24,objectW*0.72*shadowStretch);
    const sh=Math.max(10,Math.min(objectH*0.28,objectH*0.22+objectW*0.035));
    const offset=Math.max(sw,objectH)*0.34;
    const sx=inst.x+dirX*offset;
    const sy=inst.y+dirY*offset*0.48+(objectH*0.30);
    const angle=Math.atan2(dirY,dirX)*180/Math.PI;
    const blurPx=Math.max(7,Math.min(24,Math.round(Math.max(sw,sh)*0.055)));
    const shadow=document.createElement('div');
    shadow.className='dynamic-el';
    shadow.style.cssText=`position:absolute;left:${sx-sw/2}px;top:${sy-sh/2}px;width:${sw}px;height:${sh}px;border-radius:50%;pointer-events:none;z-index:${inst.zIndex-0.4};opacity:${opacity};filter:blur(${blurPx}px);background:radial-gradient(ellipse at center,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.46) 28%,rgba(0,0,0,0.20) 52%,rgba(0,0,0,0) 78%);transform:rotate(${angle}deg);transform-origin:center;`;
    stage.appendChild(shadow);
  });
  room.instances.forEach(inst=>{
    const img=document.createElement('img');
    const blocks = !inst.isDecor && (inst.collisionMode==='SOLID' || (inst.collisionMode!=='NONE' && inst.zIndex===room.playerWalkZ));
    img.className='room-instance dynamic-el'+(inst.instanceId===selectedInstanceId?' selected':'')+(multiSelectedIds.has(inst.instanceId)?' multi-selected':'')+(inst.door?' door':'')+(blocks?' blocking':'')+(inst.isDecor?' decor':'')+(inst.instanceId===draggingInvalidId || inst.placementValid===false?' invalid-placement':'');
    img.src=inst.image||MISSING_IMG_URL;
    if(!inst.image) img.title=(inst.name||inst.objectId||'объект')+' — у объекта нет картинки (показана рамка его размера)';
    const sw=inst.w*(inst.scale||1), sh=inst.h*(inst.scale||1);
    img.style.left=(inst.x-sw/2)+'px';
    img.style.top=(inst.y-sh/2)+'px';
    img.style.width=sw+'px'; img.style.height=sh+'px';
    img.style.zIndex=inst.zIndex;
    img.style.transform=`rotate(${inst.rotation}deg) scaleX(${inst.flipH?-1:1}) scaleY(${inst.flipV?-1:1})`;
    bindInstanceEvents(img,inst);
    stage.appendChild(img);
  });
  renderRoomDimensionRuler();
  renderCompositionUI();
  renderStairSocketMarkers();
  renderSelectionHandles();
}
function renderRoomDimensionRuler(){
  const stage=document.getElementById('stage');
  stage.querySelectorAll('.room-dim-line-v,.room-dim-line-h,.room-dim-label').forEach(el=>el.remove());
  const invScale=1/zoom;
  const offset=16*invScale;
  const heightM=(room.height/PIXELS_PER_METER).toFixed(1);
  const widthM=(room.width/PIXELS_PER_METER).toFixed(1);

  const lineV=document.createElement('div'); lineV.className='room-dim-line-v';
  lineV.style.left=(-offset)+'px'; lineV.style.top='0px'; lineV.style.height=room.height+'px';
  stage.appendChild(lineV);
  const labelV=document.createElement('div'); labelV.className='room-dim-label';
  labelV.textContent='высота: '+heightM+' м';
  labelV.style.left=(-offset)+'px'; labelV.style.top=(room.height/2)+'px';
  labelV.style.transform=`translate(-100%,-50%) scale(${invScale}) rotate(-90deg)`;
  labelV.style.transformOrigin='right center';
  stage.appendChild(labelV);

  const lineH=document.createElement('div'); lineH.className='room-dim-line-h';
  lineH.style.left='0px'; lineH.style.top=(room.height+offset)+'px'; lineH.style.width=room.width+'px';
  stage.appendChild(lineH);
  const labelH=document.createElement('div'); labelH.className='room-dim-label';
  labelH.textContent='ширина: '+widthM+' м';
  labelH.style.left=(room.width/2)+'px'; labelH.style.top=(room.height+offset)+'px';
  labelH.style.transform=`translate(-50%,10px) scale(${invScale})`;
  stage.appendChild(labelH);
}
function clientToRoom(e){
  const rect=document.getElementById('stage').getBoundingClientRect();
  return {x:(e.clientX-rect.left)/zoom, y:(e.clientY-rect.top)/zoom};
}
function computeCorners(obj){
  const baseW=obj.w!==undefined?obj.w:obj.nativeWidth, baseH=obj.h!==undefined?obj.h:obj.nativeHeight;
  const sw=baseW*(obj.scale||1), sh=baseH*(obj.scale||1);
  const hw=sw/2, hh=sh/2;
  const rad=(obj.rotation||0)*Math.PI/180;
  const cos=Math.cos(rad), sin=Math.sin(rad);
  const pts=[{x:-hw,y:-hh},{x:hw,y:-hh},{x:hw,y:hh},{x:-hw,y:hh}]; // TL,TR,BR,BL
  return pts.map(p=>({x:obj.x+p.x*cos-p.y*sin, y:obj.y+p.x*sin+p.y*cos}));
}
function getSelectedTarget(){
  const inst=getSelectedInstance(); if(inst)return {obj:inst,isBg:false};
  const bg=room.backgroundLayers.find(b=>b.id===selectedBgLayerId); if(bg)return {obj:bg,isBg:true};
  return null;
}
function renderSelectionHandles(){
  const layer=document.getElementById('roomHandleLayer'); layer.innerHTML='';
  const sel=getSelectedTarget(); if(!sel)return;
  const obj=sel.obj;
  const invScale=1/zoom;
  const corners=computeCorners(obj);
  corners.forEach(c=>{
    const h=document.createElement('div'); h.className='room-resize-handle';
    h.style.left=c.x+'px'; h.style.top=c.y+'px'; h.style.transform=`translate(-50%,-50%) scale(${invScale})`;
    layer.appendChild(h);
    bindCornerHandle(h,obj,sel.isBg);
  });
  const topMid={x:(corners[0].x+corners[1].x)/2,y:(corners[0].y+corners[1].y)/2};
  const dx=topMid.x-obj.x, dy=topMid.y-obj.y, len=Math.hypot(dx,dy)||1;
  const ex=topMid.x+(dx/len)*24*invScale, ey=topMid.y+(dy/len)*24*invScale;
  const line=document.createElement('div'); line.className='room-rotate-line';
  line.style.left=topMid.x+'px'; line.style.top=topMid.y+'px';
  line.style.height=(24*invScale)+'px';
  line.style.transform=`rotate(${obj.rotation||0}deg)`;
  layer.appendChild(line);
  const rh=document.createElement('div'); rh.className='room-rotate-handle';
  rh.style.left=ex+'px'; rh.style.top=ey+'px'; rh.style.transform=`translate(-50%,-50%) scale(${invScale})`;
  layer.appendChild(rh);
  bindRotateHandle(rh,obj,sel.isBg);
}
function afterHandleChange(isBg){
  scheduleHistoryPush();
  if(isBg) renderBgLayerList(); else renderPropertiesPanel();
}
function bindCornerHandle(el,obj,isBg){
  el.addEventListener('pointerdown', e=>{
    e.stopPropagation();
    const startScale=obj.scale||1;
    const c0=computeCorners(obj);
    let maxDist=1;
    c0.forEach(c=>{ maxDist=Math.max(maxDist, Math.hypot(c.x-obj.x,c.y-obj.y)); });
    const move=ev=>{
      const p=clientToRoom(ev);
      const dist=Math.hypot(p.x-obj.x, p.y-obj.y);
      obj.scale=Math.max(0.05, startScale*(dist/maxDist));
      renderRoom();
    };
    const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); afterHandleChange(isBg); };
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
  });
}
function bindRotateHandle(el,obj,isBg){
  el.addEventListener('pointerdown', e=>{
    e.stopPropagation();
    const move=ev=>{
      const p=clientToRoom(ev);
      const dx=p.x-obj.x, dy=p.y-obj.y;
      let deg=Math.atan2(dy,dx)*180/Math.PI+90;
      deg=((deg%360)+360)%360; if(deg>180)deg-=360;
      obj.rotation=Math.round(deg);
      renderRoom();
    };
    const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); afterHandleChange(isBg); };
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
  });
}
function bindBgLayerEvents(img,layer){
  img.addEventListener('pointerdown', e=>{
    e.stopPropagation();
    selectedBgLayerId=layer.id; selectedInstanceId=null; renderRoom(); renderPropertiesPanel();
    const startX=e.clientX,startY=e.clientY, origX=layer.x, origY=layer.y;
    let moved=false;
    const move=ev=>{
      const dx=(ev.clientX-startX)/zoom, dy=(ev.clientY-startY)/zoom;
      if(Math.abs(dx)>1||Math.abs(dy)>1) moved=true;
      layer.x=origX+dx; layer.y=origY+dy;
      renderRoom();
    };
    const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); if(moved) scheduleHistoryPush(); };
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
  });
}
function bindInstanceEvents(img,inst){
  img.addEventListener('pointerdown', e=>{
    e.stopPropagation();
    if(paintMode){ return; } // в режиме разметки клики по объектам не должны их двигать
    selectedInstanceId=inst.instanceId; selectedBgLayerId=null; renderRoom(); renderPropertiesPanel();
    const startX=e.clientX,startY=e.clientY, origX=inst.x, origY=inst.y;
    let moved=false;
    const isFloorOnly = inst.placementMode==='FLOOR_ONLY' && !inst.isDecor;
    const move=ev=>{
      const dx=(ev.clientX-startX)/zoom, dy=(ev.clientY-startY)/zoom;
      if(Math.abs(dx)>1||Math.abs(dy)>1) moved=true;
      if(isFloorOnly){
        // FLOOR_ONLY всё ещё требует твёрдой RED-опоры, но существующий объект
        // должен иметь возможность перемещаться и по X, и по Y.
        // Иначе объект, уже стоящий на полу, невозможно поднять на нарисованную
        // выше RED-поверхность. Сначала следуем за курсором, затем ищем ближайшую
        // твёрдую поверхность НИЖЕ предполагаемого положения.
        inst.x=origX+dx;
        inst.y=origY+dy;
        const snapped=snapInstanceToFloor(inst);
        updatePlacementValidity(inst);
        draggingInvalidId = (!snapped || !inst.placementValid) ? inst.instanceId : null;
      } else {
        inst.x=origX+dx; inst.y=origY+dy;
        updatePlacementValidity(inst);
        draggingInvalidId = inst.placementValid ? null : inst.instanceId;
      }
      renderRoom();
    };
    const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); draggingInvalidId=null; if(moved){ scheduleHistoryPush(); renderPropertiesPanel(); renderRoom(); } };
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
  });
}
