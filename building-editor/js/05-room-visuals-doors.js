/* ============================================================
   MODULE 05 — DOOR LINKS + ROOM VISUALS
   Automatic door linking ("Building" mode) and room preview visuals
   loaded from disk once per room.
   ============================================================ */

/* ============================================================
   АВТОСВЯЗЬ ДВЕРЕЙ ПО РАСПОЛОЖЕНИЮ — только режим "Здание"
   ============================================================ */
const DOOR_LINK_THRESHOLD=0.3*PIXELS_PER_METER; // 30 см — если двери двух разных комнат ближе этого — считаем, что они соединены
let doorLinks=[]; // {a:{instanceId,doorIdx}, b:{instanceId,doorIdx}}
function getRoomMeta(roomId){ return roomCatalog.find(r=>r.id===roomId); }

/* ============================================================
   ВИЗУАЛЬНЫЙ ПРЕВЬЮ — реальные фоны/объекты комнаты, читаем с диска один раз на комнату
   ============================================================ */
let roomVisualCache={}; // roomId -> {backgroundLayers:[...], instances:[...]} | 'loading' | null(ошибка)
/* ---- загрузка картинок с диска ----
   Любая ошибка (нет файла, файл пустой/повреждён, не картинка) даёт исключение, а не вечное ожидание:
   раньше один битый PNG оставлял комнату в «загрузка…», а здание — неоткрытым. */
async function loadImageDataUrl(spritesDir, relPath){
  // путь — от assets/sprites; префикс «assets/sprites/» (так пишутся фоны здания) допустим
  const clean=String(relPath||'').replace(/^assets\/sprites\//,'').replace(/^\//,'');
  const parts=clean.split('/'); const fileName=parts.pop();
  const subDir=parts.length? await getSubdir(spritesDir,parts.join('/'),false) : spritesDir;
  const file=await (await subDir.getFileHandle(fileName)).getFile();
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error||new Error('не удалось прочитать файл')); r.readAsDataURL(file); });
}
function getImageDims(dataUrl){
  return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight}); im.onerror=()=>rej(new Error('файл повреждён или это не картинка')); im.src=dataUrl; });
}
// Результат: {url, kind}; kind: ok | missing (нет файла) | invalid (файл есть, но это не картинка)
async function tryLoadImage(spritesDir,rel){
  let url; try{ url=await loadImageDataUrl(spritesDir,rel); }catch(e){ return {url:null,kind:'missing'}; }
  try{ await getImageDims(url); return {url,kind:'ok'}; }catch(e){ return {url:null,kind:'invalid'}; }
}
// Объект без картинки в превью здания: пунктирная рамка его размера (как в Room Editor), а не пустота
const MISSING_IMG_URL='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" fill="rgba(231,198,91,0.10)" stroke="#e7c65b" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/><path d="M0 0L100 100M100 0L0 100" stroke="#e7c65b" stroke-opacity="0.45" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>');
function firstFrameFromSheet(dataUrl,frameCount){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      const n=frameCount>0 ? frameCount : Math.max(1,Math.round(im.naturalWidth/Math.max(1,im.naturalHeight))); // лист — полоска кадров одной ширины
      const fw=Math.max(1,Math.floor(im.naturalWidth/n)), fh=Math.max(1,im.naturalHeight);
      const c=document.createElement('canvas'); c.width=fw; c.height=fh;
      const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.drawImage(im,0,0,fw,fh,0,0,fw,fh);
      res(c.toDataURL('image/png'));
    };
    im.onerror=()=>rej(new Error('файл повреждён или это не картинка'));
    im.src=dataUrl;
  });
}
// Картинка объекта: основная → статичное состояние → первый кадр анимации (idle, иначе первая)
async function loadObjectImage(spritesDir,obj){
  const asset=obj.appearance&&obj.appearance.asset, vis=obj.visuals||{};
  let problem=null;
  if(asset){ const r=await tryLoadImage(spritesDir,asset); if(r.kind==='ok') return {url:r.url,problem:null,path:asset}; problem=r.kind; }
  for(const st of (vis.images||[])){ if(!st||!st.asset)continue; const r=await tryLoadImage(spritesDir,st.asset); if(r.kind==='ok') return {url:r.url,problem:null,path:asset}; }
  const anims=(vis.animations||[]).slice().sort((x,y)=>(y.name===vis.idle)-(x.name===vis.idle));
  for(const an of anims){
    if(!an||!an.asset)continue;
    const r=await tryLoadImage(spritesDir,an.asset); if(r.kind!=='ok')continue;
    try{ return {url:await firstFrameFromSheet(r.url,an.frame_count),problem:null,path:asset}; }catch(e){}
  }
  return {url:null,problem,path:asset||''};
}
// Каталог объектов: data/objects/*.json по id объекта. Имя файла может не совпадать с id
// (у безымянных объектов так бывало) — поэтому ищем по id внутри файла, имя файла — запасной вариант.
let objectIndexCache=null;
async function getObjectIndex(){
  if(objectIndexCache) return objectIndexCache;
  const byId=new Map();
  try{
    const dir=await getSubdir(projectDirHandle,'data/objects',false);
    for await(const [name,h] of dir.entries()){
      if(h.kind!=='file'||!name.endsWith('.json'))continue;
      try{
        const obj=JSON.parse(await (await h.getFile()).text()), base=name.replace(/\.json$/,'');
        byId.set(obj.id||base,obj); if(!byId.has(base)) byId.set(base,obj);
      }catch(e){}
    }
  }catch(e){}
  objectIndexCache={byId};
  return objectIndexCache;
}
async function loadRoomVisual(roomId){
  if(roomVisualCache[roomId]!==undefined)return;
  roomVisualCache[roomId]='loading';
  try{
    const roomsDir=await getSubdir(projectDirHandle,'data/rooms',false);
    const file=await (await roomsDir.getFileHandle(roomId+'.json')).getFile();
    const data=roomFromJSON(JSON.parse(await file.text())); // метры → px
    const spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false);
    const issues=[]; // что не удалось показать — выводится значком ⚠ на комнате
    const backgroundLayers=[];
    for(const l of (data.backgroundLayers||[])){
      const r=await tryLoadImage(spritesDir,l.image);
      if(r.kind!=='ok'){ issues.push(`Фон «${l.image}»: ${r.kind==='invalid'?'файл повреждён':'файл не найден'}`); continue; }
      const dims=await getImageDims(r.url);
      backgroundLayers.push({ dataUrl:r.url, w:dims.w, h:dims.h, x:(l.x!==undefined?l.x:data.width/2), y:(l.y!==undefined?l.y:data.height/2),
        scale:bgScaleFromJSON(l,dims.w), rotation:l.rotation||0, flipH:!!l.flipH, flipV:!!l.flipV, opacity:(l.opacity!==undefined?l.opacity:1) });
    }
    const instances=[];
    const objIndex=await getObjectIndex();
    for(const inst of (data.instances||[])){
      try{
        const obj=objIndex.byId.get(inst.objectId)||null;
        let img={url:null,problem:null,path:''};
        if(obj) img=await loadObjectImage(spritesDir,obj);
        else issues.push(`Объект «${inst.objectId}» не найден в data/objects`);
        if(obj&&!img.url&&img.problem) issues.push(`Объект «${obj.name||obj.id}»: картинка ${img.problem==='invalid'?'повреждена':'не найдена'} (${img.path})`);

        // Текущая геометрия проекта:
        // Object Constructor -> behavior.real_width_cm / real_height_cm
        // Room Editor -> в JSON метры; в редакторе 100px = 1м.
        // PNG imageWidth/imageHeight НЕ являются игровым размером.
        const behavior=(obj&&obj.behavior)||{};
        const appearance=(obj&&obj.appearance)||{};
        const objRealW=Number(behavior.real_width_cm);
        const objRealH=Number(behavior.real_height_cm);
        const imageW=Number(appearance.imageWidth);
        const imageH=Number(appearance.imageHeight);

        // Приоритет: актуальный размер объекта из ОС → размер, записанный в комнате → размер картинки (1 px = 1 см) → 10 см.
        // Так превью здания не расходится с ОС, даже если комнату ещё не пересохраняли после смены размера объекта.
        let widthCm = Number.isFinite(objRealW) && objRealW>0
          ? objRealW
          : (Number.isFinite(Number(inst.realWidthCm)) && Number(inst.realWidthCm)>0
              ? Number(inst.realWidthCm)
              : (Number.isFinite(imageW) && imageW>0 ? imageW*100/PIXELS_PER_METER : 10));

        let heightCm = Number.isFinite(objRealH) && objRealH>0
          ? objRealH
          : (Number.isFinite(Number(inst.realHeightCm)) && Number(inst.realHeightCm)>0
              ? Number(inst.realHeightCm)
              : (Number.isFinite(imageH) && imageH>0 ? imageH*100/PIXELS_PER_METER : 10));

        const iw=widthCm*PIXELS_PER_METER/100*(inst.scale||1);
        const ih=heightCm*PIXELS_PER_METER/100*(inst.scale||1);

        instances.push({
          dataUrl:img.url||MISSING_IMG_URL, name:obj?(obj.name||obj.id):inst.objectId,
          x:inst.x, y:inst.y, w:iw, h:ih,
          rotation:inst.rotation||0, flipH:!!inst.flipH, flipV:!!inst.flipV,
          zIndex:inst.zIndex||0
        });
      }catch(e){ issues.push(`Объект «${inst.objectId}»: ${e.message}`); }
    }
    instances.sort((a,b)=>a.zIndex-b.zIndex);
    roomVisualCache[roomId]={backgroundLayers, instances, issues};
  }catch(e){ console.warn('Не удалось загрузить превью комнаты',roomId,e); roomVisualCache[roomId]=null; }
  renderBuildingCanvas();
}
function recomputeDoorLinks(){
  doorLinks=[];
  if(buildingMode==='STREET')return; // в улице двери не используются — стыковка впритык по порядку
  const allDoors=[]; // {instanceId, doorIdx, x,y (абсолютные px на холсте здания)}
  placedRooms.forEach(p=>{
    const meta=getRoomMeta(p.roomId); if(!meta)return;
    meta.doors.forEach((d,idx)=>{ allDoors.push({instanceId:p.instanceId, doorIdx:idx, x:p.x+d.x, y:p.y+d.y}); });
  });
  const used=new Set();
  for(let i=0;i<allDoors.length;i++){
    if(used.has(i))continue;
    for(let j=i+1;j<allDoors.length;j++){
      if(used.has(j))continue;
      if(allDoors[i].instanceId===allDoors[j].instanceId)continue; // не соединяем двери одной и той же комнаты
      const dx=allDoors[i].x-allDoors[j].x, dy=allDoors[i].y-allDoors[j].y;
      if(Math.sqrt(dx*dx+dy*dy)<=DOOR_LINK_THRESHOLD){
        doorLinks.push({ a:{instanceId:allDoors[i].instanceId,doorIdx:allDoors[i].doorIdx}, b:{instanceId:allDoors[j].instanceId,doorIdx:allDoors[j].doorIdx} });
        used.add(i); used.add(j);
        break;
      }
    }
  }
}
function isDoorLinked(instanceId,doorIdx){
  return doorLinks.some(l=>(l.a.instanceId===instanceId&&l.a.doorIdx===doorIdx)||(l.b.instanceId===instanceId&&l.b.doorIdx===doorIdx));
}
