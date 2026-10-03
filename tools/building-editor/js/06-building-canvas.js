/* ============================================================
   MODULE 06 — BUILDING CANVAS
   Linear layout ("Street" mode), canvas rendering, dragging, edge snapping,
   placement validity, canvas size.
   ============================================================ */

/* ============================================================
   ЛИНЕЙНАЯ РАССТАНОВКА (режим "Улица") — комнаты встык по порядку массива,
   выравнивание по низу (общий "уровень земли"), без свободного перетаскивания.
   ============================================================ */
function recomputeLinearPositions(){
  const maxH=placedRooms.reduce((m,p)=>Math.max(m,p.h),0);
  let cursorX=0;
  placedRooms.forEach(p=>{ p.x=cursorX; p.y=maxH-p.h; cursorX+=p.w; });
}

/* ============================================================
   ХОЛСТ — отрисовка, перетаскивание
   ============================================================ */
function renderBuildingCanvas(){
  const canvas=document.getElementById('buildingCanvas');
  canvas.innerHTML='';
  buildingBackgrounds.slice().sort((a,b)=>(a.z||0)-(b.z||0)).forEach(b=>{
    const wrap=document.createElement('div');
    const dw=b.w*b.scale, dh=b.h*b.scale;
    wrap.className='building-bg-wrap'+(b.id===selectedBuildingBgId?' selected':'');
    wrap.dataset.bgId=b.id;
    wrap.style.cssText=`left:${b.x-dw/2}px;top:${b.y-dh/2}px;width:${dw}px;height:${dh}px;opacity:${b.opacity};z-index:${b.z||0};transform:rotate(${b.rotation||0}deg)`;
    const img=document.createElement('img'); img.src=b.dataUrl;
    img.style.transform=`scaleX(${b.flipH?-1:1}) scaleY(${b.flipV?-1:1})`;
    wrap.appendChild(img);
    wrap.onpointerdown=e=>{
      if(e.button!==0)return;
      e.preventDefault(); e.stopPropagation();
      selectedBuildingBgId=b.id; renderBuildingBackgrounds(); renderBuildingCanvas();
      startDragBuildingBackground(e,b);
    };
    if(b.id===selectedBuildingBgId){
      ['nw','ne','sw','se'].forEach(pos=>{
        const h=document.createElement('div'); h.className='bg-resize-handle '+pos;
        h.onpointerdown=e=>{ e.preventDefault(); e.stopPropagation(); startResizeBuildingBackground(e,b,pos); };
        wrap.appendChild(h);
      });
    }
    canvas.appendChild(wrap);
  });
  placedRooms.forEach(p=>{
    const meta=getRoomMeta(p.roomId);
    const el=document.createElement('div');
    const invalid=!getBuildingPlacementValid(p);
    el.className='building-room-visual'+(p.mode==='RANDOM'?' random':'')+(p.instanceId===selectedPlacedId?' selected':'')+(invalid?' invalid':'');
    el.style.left=p.x+'px'; el.style.top=p.y+'px'; el.style.width=p.w+'px'; el.style.height=p.h+'px';
    el.onclick=e=>{ e.preventDefault(); e.stopPropagation(); selectedPlacedId=p.instanceId; renderPlacedList(); };
    if(buildingMode==='BUILDING') el.onpointerdown=e=>startDragPlacedRoom(e,p);
    else el.onpointerdown=e=>{ e.preventDefault(); selectedPlacedId=p.instanceId; recomputeAndRender(); };
    canvas.appendChild(el);
    const badge=document.createElement('div'); badge.className='room-name-badge'; badge.textContent=p.name+(p.floor!==0?' · этаж '+p.floor:''); el.appendChild(badge);
    if(!meta){ el.appendChild(Object.assign(document.createElement('div'),{textContent:'⚠ комната не найдена',style:'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff8a65;font-size:11px;text-align:center;padding:6px'})); return; }
    const visual=roomVisualCache[meta.id];
    if(visual===undefined){ loadRoomVisual(meta.id); }
    if(visual && visual!=='loading'){
      if(visual.issues&&visual.issues.length){
        const warn=document.createElement('div'); warn.className='room-issue-badge'; warn.textContent='⚠ '+visual.issues.length;
        warn.title='Не всё удалось показать:\n'+visual.issues.join('\n'); el.appendChild(warn);
      }
      visual.backgroundLayers.forEach(l=>{
        const img=document.createElement('img');
        img.src=l.dataUrl;
        const dw=l.w*l.scale, dh=l.h*l.scale;
        img.style.cssText=`position:absolute;left:${l.x-(p.crop?.left||0)-dw/2}px;top:${l.y-(p.crop?.top||0)-dh/2}px;width:${dw}px;height:${dh}px;opacity:${l.opacity};transform:rotate(${l.rotation}deg) scaleX(${l.flipH?-1:1}) scaleY(${l.flipV?-1:1});pointer-events:none;image-rendering:pixelated`;
        el.appendChild(img);
      });
      visual.instances.forEach(inst=>{
        const img=document.createElement('img');
        img.src=inst.dataUrl;
        if(inst.name) img.title=inst.name;
        img.style.cssText=`position:absolute;left:${inst.x-(p.crop?.left||0)-inst.w/2}px;top:${inst.y-(p.crop?.top||0)-inst.h/2}px;width:${inst.w}px;height:${inst.h}px;transform:rotate(${inst.rotation}deg) scaleX(${inst.flipH?-1:1}) scaleY(${inst.flipV?-1:1});pointer-events:none;image-rendering:pixelated`;
        el.appendChild(img);
      });
    } else {
      const status=document.createElement('div');
      status.className='muted'; status.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px';
      status.textContent = visual===null ? 'нет превью' : 'загрузка...';
      el.appendChild(status);
    }
    if(buildingMode==='BUILDING'){
      meta.doors.forEach((d,idx)=>{
        const dot=document.createElement('div');
        dot.className='door-dot '+(isDoorLinked(p.instanceId,idx)?'linked':'unlinked');
        dot.style.left=(p.x+d.x-(p.crop?.left||0))+'px'; dot.style.top=(p.y+d.y-(p.crop?.top||0))+'px';
        dot.title=isDoorLinked(p.instanceId,idx)?'Дверь соединена с соседней комнатой':'Дверь ни с чем не соединена (край здания или далеко от соседа)';
        canvas.appendChild(dot);
      });
    }
  });
}
const EDGE_SNAP=0.5*PIXELS_PER_METER; // 50 см — расстояние, на котором края комнат притягиваются друг к другу
function snapRoomToEdges(p,nx,ny){
  let bestX=nx, bestY=ny, dx=EDGE_SNAP+1, dy=EDGE_SNAP+1;
  for(const other of placedRooms){
    if(other===p || !other.roomId || (other.floor||0)!==(p.floor||0)) continue;

    // Горизонтальное стыкование: левый край к правому и правый край к левому.
    const candidatesX=[
      {value:other.x+other.w,dist:Math.abs(nx-(other.x+other.w))},
      {value:other.x-p.w,dist:Math.abs((nx+p.w)-other.x)}
    ];
    for(const c of candidatesX){
      if(c.dist<dx){ bestX=c.value; dx=c.dist; }
    }

    // Вертикальное стыкование: верхний край к нижнему и нижний к верхнему.
    const candidatesY=[
      {value:other.y+other.h,dist:Math.abs(ny-(other.y+other.h))},
      {value:other.y-p.h,dist:Math.abs((ny+p.h)-other.y)}
    ];
    for(const c of candidatesY){
      if(c.dist<dy){ bestY=c.value; dy=c.dist; }
    }

    // Дополнительно выравниваем параллельные края, чтобы комнаты можно было
    // поставить ровно рядом и получить аккуратную стену/этаж.
    const alignY=[
      {value:other.y,dist:Math.abs(ny-other.y)},
      {value:other.y+other.h-p.h,dist:Math.abs(ny-(other.y+other.h-p.h))}
    ];
    for(const c of alignY){
      if(c.dist<dy){ bestY=c.value; dy=c.dist; }
    }
    const alignX=[
      {value:other.x,dist:Math.abs(nx-other.x)},
      {value:other.x+other.w-p.w,dist:Math.abs(nx-(other.x+other.w-p.w))}
    ];
    for(const c of alignX){
      if(c.dist<dx){ bestX=c.value; dx=c.dist; }
    }
  }
  return {x:dx<=EDGE_SNAP?bestX:nx,y:dy<=EDGE_SNAP?bestY:ny};
}
/* ============================================================
   КОМНАТЫ С БЛОКАМИ — сетка блоков 1 м
   Блоки лежат на сетке 1×1 м от левого верхнего угла комнаты. Чтобы сетки соседних комнат
   совпали (ямы и грунт стыкуются без сдвига), комната с блоками стоит на целом метре.
   Начало сетки = позиция комнаты минус обрезка слева/сверху.
   ============================================================ */
const BLOCK_GRID=PIXELS_PER_METER; // 1 м
function roomHasBlocks(p){ const m=getRoomMeta(p.roomId); return !!(m&&m.hasBlocks); }
function snapBlockRoomToMeter(p,nx,ny){
  const cl=(p.crop&&p.crop.left)||0, ct=(p.crop&&p.crop.top)||0;
  // не левее/выше нуля, но и сетка блоков остаётся на целом метре
  const kx=Math.max(Math.ceil(-cl/BLOCK_GRID),Math.round((nx-cl)/BLOCK_GRID));
  const ky=Math.max(Math.ceil(-ct/BLOCK_GRID),Math.round((ny-ct)/BLOCK_GRID));
  return {x:cl+kx*BLOCK_GRID, y:ct+ky*BLOCK_GRID};
}
function isBlockGridAligned(p){
  const ox=p.x-((p.crop&&p.crop.left)||0), oy=p.y-((p.crop&&p.crop.top)||0);
  return Math.abs(ox-Math.round(ox/BLOCK_GRID)*BLOCK_GRID)<=0.5 && Math.abs(oy-Math.round(oy/BLOCK_GRID)*BLOCK_GRID)<=0.5;
}
function startDragPlacedRoom(e,p){
  e.preventDefault();
  selectedPlacedId=p.instanceId;
  const startX=e.clientX, startY=e.clientY, origX=p.x, origY=p.y;
  const move=ev=>{
    let nx=origX+(ev.clientX-startX)/buildingZoom, ny=origY+(ev.clientY-startY)/buildingZoom;
    nx=Math.round(nx/GRID_SNAP)*GRID_SNAP; ny=Math.round(ny/GRID_SNAP)*GRID_SNAP;
    let snapped=snapRoomToEdges(p,nx,ny);
    if(roomHasBlocks(p)) snapped=snapBlockRoomToMeter(p,snapped.x,snapped.y); // блоки: только целые метры
    p.x=Math.max(0,snapped.x); p.y=Math.max(0,snapped.y);
    recomputeAndRender();
  };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function rectsOverlap(a,b){
  return a.x < b.x+b.w-1 && a.x+a.w > b.x+1 && a.y < b.y+b.h-1 && a.y+a.h > b.y+1;
}
function getBuildingPlacementIssues(p){
  const issues=[];
  if(!p.roomId) issues.push({code:'MISSING_ROOM',message:'слот не смог подобрать комнату'});
  if(p.x<0 || p.y<0) issues.push({code:'OUTSIDE',message:'комната выходит за границы холста'});
  if(p.roomId && roomHasBlocks(p) && !isBlockGridAligned(p)) issues.push({code:'BLOCK_GRID',message:'комната с блоками стоит не на целом метре — сетка блоков не совпадёт с соседями (размер комнаты лучше делать кратным 1 м)'});
  for(const other of placedRooms){
    if(other===p || !other.roomId) continue;
    if((other.floor||0)===(p.floor||0) && rectsOverlap(p,other)) issues.push({code:'OVERLAP',message:'пересекается с «'+(other.name||other.roomId)+'»'});
  }
  return issues;
}
function getBuildingPlacementValid(p){ return getBuildingPlacementIssues(p).length===0; }
function updateBuildingCanvasSize(){
  const maxX=Math.max(20*PIXELS_PER_METER,...placedRooms.map(p=>p.x+p.w+4*PIXELS_PER_METER));
  const maxY=Math.max(12*PIXELS_PER_METER,...placedRooms.map(p=>p.y+p.h+4*PIXELS_PER_METER));
  buildingCanvas.style.width=maxX+'px'; buildingCanvas.style.height=maxY+'px';
}
