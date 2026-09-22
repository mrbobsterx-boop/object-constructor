/* ============================================================
   MODULE 03 — ROOM GEOMETRY
   Object sizes, walk line, zone cells, support/collision and placement-validity checks.
   ============================================================ */

/* ============================================================
   ROOM STATE + CANVAS (свободное размещение, зум/пан, drag из
   библиотеки, перетаскивание/поворот/флип/порядок экземпляров)
   ============================================================ */
// PIXELS_PER_METER объявлен в MODULE 01 (UNITS): 100 px = 1 игровой метр
const CELL_PX=PIXELS_PER_METER/10; // 10см = 10px — шаг сетки/разметки

/* ============================================================
   ЕДИНАЯ ГЕОМЕТРИЯ ОБЪЕКТОВ
   Object Constructor хранит игровой размер в сантиметрах:
   behavior.real_width_cm / real_height_cm.
   Room Editor переводит его в свои мировые пиксели.
   Размер PNG (appearance.imageWidth/imageHeight) НЕ является
   игровым размером объекта.
   ============================================================ */
function getObjectWorldSize(obj){
  const behavior=obj&&obj.behavior||{};
  const image=obj&&obj.appearance||{};
  const rw=Number(behavior.real_width_cm);
  const rh=Number(behavior.real_height_cm);
  const iw=Number(image.imageWidth);
  const ih=Number(image.imageHeight);
  const widthCm=Number.isFinite(rw)&&rw>0 ? rw : (Number.isFinite(iw)&&iw>0 ? iw*100/PIXELS_PER_METER : 10);
  const heightCm=Number.isFinite(rh)&&rh>0 ? rh : (Number.isFinite(ih)&&ih>0 ? ih*100/PIXELS_PER_METER : 10);
  return {
    widthCm,
    heightCm,
    widthPx:widthCm*PIXELS_PER_METER/100,
    heightPx:heightCm*PIXELS_PER_METER/100,
    source:(Number.isFinite(rw)&&rw>0&&Number.isFinite(rh)&&rh>0)?'REAL_SIZE':'IMAGE_FALLBACK'
  };
}
function getInstanceBaseSize(inst){
  if(inst.realWidthCm>0 && inst.realHeightCm>0){
    return {widthPx:inst.realWidthCm*PIXELS_PER_METER/100,heightPx:inst.realHeightCm*PIXELS_PER_METER/100,widthCm:inst.realWidthCm,heightCm:inst.realHeightCm};
  }
  return {widthPx:inst.w||CELL_PX,heightPx:inst.h||CELL_PX,widthCm:(inst.w||CELL_PX)*100/PIXELS_PER_METER,heightCm:(inst.h||CELL_PX)*100/PIXELS_PER_METER};
}
function syncInstanceWorldSize(inst,obj){
  const size=getObjectWorldSize(obj||{});
  inst.realWidthCm=size.widthCm;
  inst.realHeightCm=size.heightCm;
  inst.w=size.widthPx;
  inst.h=size.heightPx;
  return size;
}

/* ============================================================
   ГЕОМЕТРИЯ ПОЛОСЫ ХОДЬБЫ — всегда 0,9м от низа комнаты, толщина настраиваемая
   ============================================================ */
let walkLineBottomM=0.9; // позиция полосы ходьбы от низа комнаты, м — одна на весь проект, читается из data/project_settings.json
function walkLineGeometry(){
  const thicknessPx=(room.walkLineThicknessCm||20)*PIXELS_PER_METER/100;
  const bottomFromFloor=walkLineBottomM*PIXELS_PER_METER;
  const bottomY=room.height-bottomFromFloor;
  const topY=bottomY-thicknessPx;
  return {topY, bottomY, thicknessPx};
}
/* Цвет клетки по умолчанию + ручная разметка поверх (клеточная карта — новый мазок заменяет старый, не накладывается) */
function cellKey(x,y){ return Math.floor(x/CELL_PX)+','+Math.floor(y/CELL_PX); }
/* Совместимость со старыми комнатами, сохранёнными до перехода на клеточную карту (room.zones был массивом прямоугольников) */
function legacyZonesToCache(zonesArr){
  const cells={};
  (zonesArr||[]).forEach(z=>{
    for(let cx=z.x; cx<z.x+z.w; cx+=CELL_PX){
      for(let cy=z.y; cy<z.y+z.h; cy+=CELL_PX){
        cells[cellKey(cx+CELL_PX/2, cy+CELL_PX/2)]=z.type;
      }
    }
  });
  return cells;
}
function zoneColorAt(x,y){
  const wl=walkLineGeometry();
  const override=room.zoneCells[cellKey(x,y)];
  if(override) return override;
  return y>=wl.bottomY ? 'RED' : 'GREEN'; // граница ровно по bottomY — зелёное и красное касаются друг друга без зазора
}
/* Проверка: есть ли твёрдая (RED) опора по ВСЕЙ ширине footprint на высоте surfaceY (полоса в 1 клетку толщиной) */
function hasFullSupportAt(x1,x2,surfaceY){
  if(surfaceY<0 || surfaceY>=room.height) return false;
  for(let x=Math.floor(x1/CELL_PX)*CELL_PX; x<x2; x+=CELL_PX){
    if(zoneColorAt(Math.min(x+CELL_PX/2,x2-1), surfaceY)!=='RED') return false;
  }
  return true;
}
/* Ищет ближайшую твёрдую поверхность НИЖЕ startY, полностью поддерживающую ширину [x1,x2). Возвращает Y верхней грани опоры, либо null. */
function supportSurfaceAtCellRow(x1,x2,rowY){
  if(rowY<0 || rowY>=room.height) return null;
  const sampleY=Math.min(room.height-1,rowY+CELL_PX/2);
  if(!hasFullSupportAt(x1,x2,sampleY)) return null;

  // Если вся поддержка в этой строке — это дефолтный красный пол,
  // возвращаем его реальную границу, даже если она проходит внутри клетки.
  // Так кровать не получает лишние 1–9см погрешности из-за сетки 10см.
  const wl=walkLineGeometry();
  if(rowY < wl.bottomY && rowY+CELL_PX > wl.bottomY){
    let onlyDefaultFloor=true;
    const startX=Math.floor(x1/CELL_PX)*CELL_PX;
    for(let x=startX; x<x2; x+=CELL_PX){
      const sampleX=Math.min(x+CELL_PX/2,x2-0.001);
      const override=room.zoneCells[cellKey(sampleX,sampleY)];
      if(override){ onlyDefaultFloor=false; break; }
    }
    if(onlyDefaultFloor) return wl.bottomY;
  }
  return rowY;
}
function findFloorBelow(x1,x2,startY){
  // Ищем ближайшую RED-поверхность от верхней границы объекта вниз.
  // Красное означает твёрдую поверхность, а не просто цвет интерфейса.
  const firstY=Math.max(0,Math.floor(startY/CELL_PX)*CELL_PX);
  for(let y=firstY; y<room.height; y+=CELL_PX){
    const surface=supportSurfaceAtCellRow(x1,x2,y);
    if(surface!==null) return surface;
  }
  return null;
}
function findHighestSupport(x1,x2){
  // Запасной вариант, если объект уже оказался ниже существующего пола.
  for(let y=0; y<room.height; y+=CELL_PX){
    const surface=supportSurfaceAtCellRow(x1,x2,y);
    if(surface!==null) return surface;
  }
  return null;
}
function getCollisionBounds(inst){
  const w=(inst.w||0)*(inst.scale||1), h=(inst.h||0)*(inst.scale||1);
  const rad=(Number(inst.rotation)||0)*Math.PI/180;
  const c=Math.abs(Math.cos(rad)), s=Math.abs(Math.sin(rad));
  const aw=w*c+h*s, ah=w*s+h*c;
  return {x1:inst.x-aw/2,x2:inst.x+aw/2,y1:inst.y-ah/2,y2:inst.y+ah/2,w:aw,h:ah};
}
function isCollisionEnabled(inst){
  return !!inst && !inst.isDecor && inst.collisionMode!=='NONE';
}
function collisionOverlaps(a,b){
  if(!isCollisionEnabled(a)||!isCollisionEnabled(b)) return false;
  const A=getCollisionBounds(a), B=getCollisionBounds(b);
  return A.x1 < B.x2 && A.x2 > B.x1 && A.y1 < B.y2 && A.y2 > B.y1;
}
function hasObjectCollision(inst){
  if(!isCollisionEnabled(inst)) return false;
  return room.instances.some(other=>other.instanceId!==inst.instanceId && collisionOverlaps(inst,other));
}
function findObjectSupportBelow(inst,x1,x2,desiredBottomY){
  let bestY=null;
  for(const other of room.instances){
    if(other.instanceId===inst.instanceId || !isCollisionEnabled(other)) continue;
    const b=getCollisionBounds(other);
    // Опора должна полностью перекрывать объект по ширине.
    if(b.x1 > x1+0.01 || b.x2 < x2-0.01) continue;
    const topY=b.y1;
    // Поверхность должна быть ниже текущего низа или совпадать с ним.
    if(topY > desiredBottomY+0.01) continue;
    if(bestY===null || topY>bestY) bestY=topY;
  }
  return bestY;
}
function snapInstanceToFloor(inst){
  // Сохраняем исходную механику RED/FLOOR, но добавляем твёрдые объекты как возможную опору.
  const w=inst.w*(inst.scale||1), h=inst.h*(inst.scale||1);
  const x1=inst.x-w/2, x2=inst.x+w/2;
  let surfaceY=findObjectSupportBelow(inst,x1,x2,inst.y+h/2);
  if(surfaceY===null) surfaceY=findFloorBelow(x1,x2,inst.y-h/2);
  if(surfaceY===null) surfaceY=findHighestSupport(x1,x2);
  if(surfaceY!==null){
    inst.y=surfaceY-h/2;
    return true;
  }
  return false;
}
function getFootprintBounds(inst){
  const w=inst.w*(inst.scale||1), h=inst.h*(inst.scale||1);
  return {x1:inst.x-w/2,x2:inst.x+w/2,y1:inst.y-h/2,y2:inst.y+h/2,w,h};
}
function isFootprintGreen(inst){
  if(inst.isDecor) return true;
  const b=getFootprintBounds(inst);
  if(b.x1<0 || b.x2>room.width || b.y1<0 || b.y2>room.height) return false;
  const startX=Math.floor(b.x1/CELL_PX)*CELL_PX;
  const endX=Math.ceil(b.x2/CELL_PX)*CELL_PX;
  const startY=Math.floor(b.y1/CELL_PX)*CELL_PX;
  const endY=Math.ceil(b.y2/CELL_PX)*CELL_PX;
  for(let cy=startY; cy<endY; cy+=CELL_PX){
    for(let cx=startX; cx<endX; cx+=CELL_PX){
      const sampleX=Math.min(cx+CELL_PX/2,b.x2-0.001);
      const sampleY=Math.min(cy+CELL_PX/2,b.y2-0.001);
      if(sampleX<b.x1 || sampleY<b.y1) continue;
      if(zoneColorAt(sampleX,sampleY)!=='GREEN') return false;
    }
  }
  return true;
}
function getPlacementIssues(inst){
  if(!inst || inst.isDecor) return [];
  const issues=[];
  // ВАЖНО: исходная проверка RED/GREEN/ORANGE остаётся основной.
  if(!isFootprintGreen(inst)) issues.push({type:'zone',message:'Объект находится в недопустимой зоне разметки или выходит за границы комнаты.'});
  const b=getCollisionBounds(inst);
  if(b.x1<0 || b.x2>room.width || b.y1<0 || b.y2>room.height) issues.push({type:'bounds',message:'Объект выходит за пределы комнаты.'});
  if(hasObjectCollision(inst)){
    const count=room.instances.filter(other=>other.instanceId!==inst.instanceId && collisionOverlaps(inst,other)).length;
    issues.push({type:'collision',message:'Коллизия с '+count+' объектом(ами).'});
  }
  if(inst.placementMode==='FLOOR_ONLY'){
    const x1=b.x1,x2=b.x2;
    const objectSupport=findObjectSupportBelow(inst,x1,x2,b.y2);
    const floorSupport=findFloorBelow(x1,x2,b.y1);
    const fallback=findHighestSupport(x1,x2);
    if(objectSupport===null && floorSupport===null && fallback===null) issues.push({type:'support',message:'FLOOR_ONLY: под объектом нет твёрдой опоры на всю ширину.'});
  }
  return issues;
}
function isInstancePlacementValid(inst){
  return inst.isDecor || getPlacementIssues(inst).length===0;
}
function updatePlacementValidity(inst){
  if(inst.isDecor){ inst.placementValid=true; return true; }
  if(inst.placementMode==='FLOOR_ONLY') snapInstanceToFloor(inst);
  // Сохраняем исходную zone-разметку и только ДОБАВЛЯЕМ коллизию/вертикальную опору.
  inst.placementValid=isInstancePlacementValid(inst);
  return inst.placementValid;
}
