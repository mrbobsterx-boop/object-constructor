/* ============================================================
   MODULE 13 — SIMILAR ROOM GENERATOR
   Statistics-based generator from selected sample rooms.
   ============================================================ */

/* ============================================================
   ГЕНЕРАТОР ПОХОЖЕЙ КОМНАТЫ — статистика по выбранным образцам
   (без ИИ): частота появления объекта + реальные позиции из
   образцов (в долях от размера комнаты, с лёгким случайным
   сдвигом). Результат — обычные экземпляры в текущей комнате,
   полностью редактируемые как угодно после генерации.
   ============================================================ */
async function scanRoomsByType(type){
  if(!projectDirHandle)return [];
  const result=[];
  try{
    const roomsDir=await getSubdir(projectDirHandle,'data/rooms',false);
    for await (const [name,handle] of roomsDir.entries()){
      if(handle.kind!=='file'||!name.endsWith('.json'))continue;
      try{
        const file=await handle.getFile();
        const data=JSON.parse(await file.text());
        if(!type || data.type===type) result.push(roomFromJSON(data));
      }catch(e){}
    }
  }catch(e){}
  return result;
}
function populateGenTypeSelect(){
  const sel=document.getElementById('genType');
  sel.innerHTML='<option value="">Все типы</option>'+[...document.getElementById('roomType').options].filter(o=>o.value).map(o=>`<option value="${o.value}">${o.textContent}</option>`).join('');
  sel.value=room.type||'';
}
async function renderGenRoomList(){
  const type=document.getElementById('genType').value;
  const rooms=await scanRoomsByType(type);
  window.__genRoomsCache=rooms;
  const list=document.getElementById('genRoomList');
  if(!rooms.length){ list.innerHTML='<span class="status">Нет сохранённых комнат'+(type?' этого типа':'')+' в подключённой папке.</span>'; return; }
  list.innerHTML=rooms.map((r,i)=>`<label class="gen-room-item"><input type="checkbox" class="genRoomCheck" data-idx="${i}" checked style="width:auto"> ${r.name||r.id} <span class="status">— ${(r.instances||[]).length} объектов, ${pxToM(r.width)}×${pxToM(r.height)} м</span></label>`).join('');
}
async function openGenModal(){
  document.getElementById('genModal').classList.add('open');
  document.getElementById('genWidth').value=pxToM(room.width);
  document.getElementById('genHeight').value=pxToM(room.height);
  document.getElementById('genStatus').textContent='';
  populateGenTypeSelect();
  await renderGenRoomList();
}
document.getElementById('btnOpenGen').onclick=openGenModal;
document.getElementById('btnCloseGen').onclick=()=>document.getElementById('genModal').classList.remove('open');
document.getElementById('genType').onchange=renderGenRoomList;

function buildFrequencyModel(rooms){
  const byGroup={}; // groupKey (variant_group или сам objectId) -> {count, samples:[], groupTag, objectIds:Set}
  rooms.forEach(r=>{
    (r.instances||[]).forEach(inst=>{
      const cat=projectCatalog.find(c=>c.id===inst.objectId);
      const groupTag=(cat && cat.json.behavior && cat.json.behavior.variant_group) ? cat.json.behavior.variant_group : null;
      const key=groupTag || inst.objectId;
      if(!byGroup[key]) byGroup[key]={count:0, samples:[], groupTag, objectIds:new Set()};
      byGroup[key].count++;
      byGroup[key].objectIds.add(inst.objectId);
      byGroup[key].samples.push({
        nx: r.width? inst.x/r.width : 0.5, ny: r.height? inst.y/r.height : 0.5,
        rotation: inst.rotation||0, scale: inst.scale||1, flipH:!!inst.flipH, flipV:!!inst.flipV,
        collisionMode: inst.collisionMode||'ZLEVEL', light: inst.light||null, shadow: inst.shadow||null,
        door: inst.door||null, isDecor:!!inst.isDecor
      });
    });
  });
  return {byGroup, roomCount:rooms.length};
}
async function loadRandomGeneratedBackground(selectedRooms,targetW,targetH){
  if(!projectDirHandle || !selectedRooms || !selectedRooms.length) return null;
  const candidates=selectedRooms.filter(r=>Array.isArray(r.backgroundLayers)&&r.backgroundLayers.length);
  if(!candidates.length) return null;
  const source=candidates[Math.floor(Math.random()*candidates.length)];
  const sourceW=Number(source.width)||targetW, sourceH=Number(source.height)||targetH;
  const layers=[];
  let spritesDir;
  try{ spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false); }catch(e){ return null; }
  for(const ld of source.backgroundLayers){
    if(!ld||!ld.image) continue;
    try{
      const dataUrl=await loadImageDataUrl(spritesDir,ld.image);
      const dims=await getImageDims(dataUrl);
      layers.push({
        id:'bg_'+Date.now()+Math.random().toString(36).slice(2),
        dataUrl,path:ld.image,nativeWidth:dims.w,nativeHeight:dims.h,
        opacity:ld.opacity!==undefined?ld.opacity:1,
        parallax:ld.parallax!==undefined?ld.parallax:1,
        x:(ld.x!==undefined?ld.x/sourceW:0.5)*targetW,
        y:(ld.y!==undefined?ld.y/sourceH:0.5)*targetH,
        scale:bgScaleFromJSON(ld,dims.w),
        rotation:ld.rotation!==undefined?ld.rotation:0,
        flipH:!!ld.flipH,flipV:!!ld.flipV
      });
    }catch(e){ console.warn('Не удалось загрузить случайный слой фона:',ld.image,e); }
  }
  return layers.length?{layers,sourceName:source.name||source.id||'образец'}:null;
}

function generateRoomInstances(model, targetW, targetH){
  const generated=[]; let z=0; let skippedMissing=0;
  Object.keys(model.byGroup).forEach(groupKey=>{
    const info=model.byGroup[groupKey];
    const freq=info.count/model.roomCount;
    if(Math.random()>freq)return;
    const sample=info.samples[Math.floor(Math.random()*info.samples.length)];
    const jitterX=(Math.random()-0.5)*0.06, jitterY=(Math.random()-0.5)*0.04;
    const nx=Math.min(0.98,Math.max(0.02, sample.nx+jitterX));
    const ny=Math.min(0.98,Math.max(0.02, sample.ny+jitterY));
    // если это настоящая группа взаимозаменяемости — берём случайный вариант из ВСЕГО каталога проекта,
    // не только из тех, что встретились в образцах — это и даёт настоящую комбинаторную вариативность.
    let candidateIds;
    if(info.groupTag){
      candidateIds=projectCatalog.filter(c=>c.json.behavior && c.json.behavior.variant_group===info.groupTag).map(c=>c.id);
      if(!candidateIds.length) candidateIds=[...info.objectIds];
    } else {
      candidateIds=[groupKey];
    }
    const objectId=candidateIds[Math.floor(Math.random()*candidateIds.length)];
    const cat=projectCatalog.find(c=>c.id===objectId);
    if(!cat){ skippedMissing++; return; }
    const worldSize=getObjectWorldSize(cat.json);
    const w=worldSize.widthPx;
    const h=worldSize.heightPx;
    const placementMode=(cat.json.behavior&&cat.json.behavior.placement_mode)||'ANYWHERE';
    generated.push({
      instanceId:'inst_'+Date.now()+Math.random().toString(36).slice(2),
      objectId, name:cat.name, image:cat.image, w, h,
      x:Math.round(nx*targetW), y:Math.round(ny*targetH),
      rotation:sample.rotation, scale:sample.scale, flipH:sample.flipH, flipV:sample.flipV,
      zIndex:z++, collisionMode:sample.collisionMode,
      isDecor:sample.isDecor, placementMode,
      realWidthCm:worldSize.widthCm, realHeightCm:worldSize.heightCm, placementValid:true,
      light:sample.light?{...sample.light}:null, shadow:sample.shadow?{...sample.shadow}:null,
      door:sample.door?{...sample.door}:null
    });
  });
  return {generated, skippedMissing};
}
document.getElementById('genMethod').addEventListener('change', e=>{
  const isRecipe=e.target.value==='RECIPE';
  document.getElementById('genSamplesField').style.display=isRecipe?'none':'';
  document.getElementById('genRecipeHint').style.display=isRecipe?'':'none';
  updateGenRecipeHint();
});
document.getElementById('genType').addEventListener('change', updateGenRecipeHint);
function updateGenRecipeHint(){
  if(document.getElementById('genMethod').value!=='RECIPE')return;
  const type=document.getElementById('genType').value;
  const rows=roomRecipes[type]||[];
  const hint=document.getElementById('genRecipeHint');
  hint.textContent = rows.length ? `Рецепт для «${type||'—'}»: ${rows.length} строк(и). Настроить — кнопка «📋 Рецепты комнат» в шапке.` : `Для типа «${type||'—'}» рецепта пока нет — сначала создай его в «📋 Рецепты комнат», либо выбери метод «По образцам».`;
}
