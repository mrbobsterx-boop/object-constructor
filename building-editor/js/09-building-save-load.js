/* ============================================================
   MODULE 09 — BUILDING SAVE / LOAD
   Building id/name, list of saved buildings, open, JSON assembly and saving.
   ============================================================ */

/* ============================================================
   СОХРАНЕНИЕ ЗДАНИЯ
   ============================================================ */
document.getElementById('buildingId').dataset.auto='1';
document.getElementById('buildingId').addEventListener('input', ()=>{ document.getElementById('buildingId').dataset.auto='0'; });
document.getElementById('buildingName').addEventListener('input', e=>{
  const idEl=document.getElementById('buildingId');
  if(idEl.dataset.auto!=='0') idEl.value=translit(e.target.value)||'';
});
let existingBuildingsList=[]; // {id,name}[]
async function scanExistingBuildings(){
  existingBuildingsList=[];
  if(!projectDirHandle){ populateOpenBuildingSelect(); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/buildings',false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      const bId=name.replace(/\.json$/,'');
      try{ const file=await handle.getFile(); const data=JSON.parse(await file.text()); existingBuildingsList.push({id:bId, name:data.name||bId}); }
      catch(e){ existingBuildingsList.push({id:bId, name:bId}); }
    }
  }catch(e){}
  populateOpenBuildingSelect();
}
function populateOpenBuildingSelect(){
  const sel=document.getElementById('openBuildingSelect'); if(!sel)return;
  sel.innerHTML='<option value="">— выбери здание —</option>'+existingBuildingsList.map(b=>`<option value="${esc(b.id)}">${esc(b.name)} (${b.id})</option>`).join('');
}
async function loadBuildingFromJSON(data){
  document.getElementById('buildingId').value=data.id||''; document.getElementById('buildingId').dataset.auto='0';
  document.getElementById('buildingName').value=data.name||'';
  buildingMode = data.layout_mode==='STREET' ? 'STREET' : 'BUILDING';
  document.getElementById('modeSelect').value=buildingMode;
  document.getElementById('shuffleRow').style.display = buildingMode==='STREET' ? '' : 'none';

  placedRooms=[]; selectedPlacedId=null;
  if(buildingMode==='STREET'){
    (data.sequence||[]).forEach(item=>{
      if(item.type==='FIXED'){
        const room=roomCatalog.find(r=>r.id===item.room);
        placedRooms.push({ instanceId:'place_'+Date.now()+Math.random().toString(36).slice(2), mode:'FIXED', roomId:item.room, typeFilter:null,
          requiredRole:null, requiredStairs:[], floor:0, crop:{left:0,right:0,top:0,bottom:0}, x:20, y:20,
          w:room?room.width:6.4*PIXELS_PER_METER, h:room?room.height:2.2*PIXELS_PER_METER, name:room?room.name:('⚠ '+item.room) });
      } else if(item.type==='POOL'){
        const count=item.count||0;
        for(let i=0;i<count;i++){
          const entry={ instanceId:'place_'+Date.now()+Math.random().toString(36).slice(2), mode:'RANDOM', roomId:null, typeFilter:item.type_filter,
            requiredRole:null, requiredStairs:[], floor:0, crop:{left:0,right:0,top:0,bottom:0},
            x:20, y:20, w:640*PIXELS_PER_METER/100, h:220*PIXELS_PER_METER/100, name:'Слот: '+item.type_filter };
          placedRooms.push(entry);
          rerollRandomSlot(entry); // конкретные комнаты пула не хранятся (для реиграбельности) — перевыбираем заново
        }
      }
    });
  } else {
    (data.rooms||[]).forEach(item=>{
      const room=roomCatalog.find(r=>r.id===item.room);
      const entry={ instanceId:item.instance_id||('place_'+Date.now()+Math.random().toString(36).slice(2)), mode:item.mode||'FIXED', roomId:item.room,
        typeFilter:item.type_filter||null, requiredRole:item.required_role||null, requiredStairs:item.required_stairs||[], floor:item.floor||0,
        crop:cropFromJSON(item), x:lenPx(item,'x_m','x',0), y:lenPx(item,'y_m','y',0),
        w:room?room.width:6.4*PIXELS_PER_METER, h:room?room.height:2.2*PIXELS_PER_METER, name:room?room.name:('⚠ '+item.room) };
      placedRooms.push(entry);
      if(entry.mode==='RANDOM') rerollRandomSlot(entry); // сохранённый room — не выбор, а условие; перевыбираем заново, как POOL в «Улице»
    });
  }

  buildingBackgrounds=[]; const bgFailed=[];
  if(projectDirHandle && Array.isArray(data.backgroundLayers) && data.backgroundLayers.length){
    try{
      const spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false);
      for(const l of data.backgroundLayers){
        try{
          const dataUrl=await loadImageDataUrl(spritesDir,l.image);
          const dims=await getImageDims(dataUrl);
          buildingBackgrounds.push({ id:'bg_'+Date.now()+Math.random().toString(36).slice(2), path:l.image, dataUrl, w:dims.w, h:dims.h,
            x:lenPx(l,'x_m','x',0), y:lenPx(l,'y_m','y',0), scale:bgScaleFromJSON(l,dims.w,'width_m'), opacity:(l.opacity!==undefined?l.opacity:1), rotation:l.rotation||0, flipH:!!l.flipH, flipV:!!l.flipV, z:l.z||0 });
        }catch(e){ console.warn('Не удалось загрузить фон здания:',l.image,e); bgFailed.push(String(l.image||'').split('/').pop()); }
      }
    }catch(e){}
  }

  selectedPlacedId=null;
  recomputeAndRender(); renderBuildingBackgrounds();
  document.getElementById('folderStatus').textContent='Открыто «'+(data.name||data.id)+'».'+(bgFailed.length?' ⚠ Не загрузились фоны: '+bgFailed.join(', '):'');
}
document.getElementById('btnOpenBuilding').onclick=async ()=>{
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  const bId=document.getElementById('openBuildingSelect').value;
  if(!bId){ alert('Выбери здание из списка слева.'); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/buildings',false);
    const file=await (await dir.getFileHandle(bId+'.json')).getFile();
    const data=JSON.parse(await file.text());
    await loadBuildingFromJSON(data);
  }catch(e){ console.error(e); alert('Не удалось открыть здание: '+e.message); }
};

// Обрезка комнаты: в JSON метры (crop_m), в редакторе px. Старый ключ crop — px при 640/м.
function cropFromJSON(item){
  const c=item.crop_m||null, old=item.crop||null;
  const g=k=>c?lenPx(c,k,null,0):lenPx(old,[],k,0);
  return {left:g('left'),right:g('right'),top:g('top'),bottom:g('bottom')};
}
function cropToJSON(c){ c=c||{}; return {left:pxToM(c.left||0),right:pxToM(c.right||0),top:pxToM(c.top||0),bottom:pxToM(c.bottom||0)}; }
function bgLayerToJSON(b){
  return {image:b.path,x_m:pxToM(b.x),y_m:pxToM(b.y),width_m:pxToM(b.w*b.scale,3),height_m:pxToM(b.h*b.scale,3),opacity:b.opacity,rotation:b.rotation,flipH:!!b.flipH,flipV:!!b.flipV,z:b.z||0};
}
function collectBuildingJSON(){
  const base=sanitizeSlug(document.getElementById('buildingId').value)||'building';
  if(buildingMode==='STREET'){
    // сворачиваем подряд идущие RANDOM-слоты одного типа в один "пул" с количеством —
    // Godot тянет из пула случайный набор и порядок заново при каждом прохождении,
    // а не использует то, что один раз разложено в редакторе.
    const sequence=[];
    let i=0;
    while(i<placedRooms.length){
      const p=placedRooms[i];
      if(p.mode==='FIXED'){
        sequence.push({ type:'FIXED', room:p.roomId });
        i++;
      } else {
        const filter=p.typeFilter; let count=0;
        while(i<placedRooms.length && placedRooms[i].mode==='RANDOM' && placedRooms[i].typeFilter===filter){ count++; i++; }
        sequence.push({ type:'POOL', type_filter:filter, count, randomize_each_playthrough:true });
      }
    }
    return { schema_version:4, id:base, name:document.getElementById('buildingName').value||base, layout_mode:'STREET', sequence, backgroundLayers:buildingBackgrounds.map(bgLayerToJSON) };
  }
  return {
    schema_version:4, // 4 = все длины в игровых метрах (суффикс _m в имени поля)
    id:base, name:document.getElementById('buildingName').value||base,
    layout_mode: buildingMode,
    // RANDOM-слот сохраняется как условие (type_filter/required_role/required_stairs), а не как уже выбранная комната —
    // конкретный room переигрывается заново при каждой загрузке (см. loadBuildingFromJSON), как POOL в «Улице».
    rooms: placedRooms.map((p,idx)=>({ instance_id:p.instanceId, order:idx, room:p.mode==='RANDOM'?null:p.roomId, x_m:pxToM(p.x), y_m:pxToM(p.y), floor:p.floor||0, mode:p.mode, type_filter:p.typeFilter||null, required_role:p.requiredRole||null, required_stairs:Array.isArray(p.requiredStairs)?p.requiredStairs:[], crop_m:cropToJSON(p.crop) })),
    backgroundLayers: buildingBackgrounds.map(bgLayerToJSON),
    door_links: doorLinks.map(l=>({ a:{room_instance:l.a.instanceId, door_index:l.a.doorIdx}, b:{room_instance:l.b.instanceId, door_index:l.b.doorIdx} }))
  };
}
document.getElementById('btnSaveBuilding').onclick=async ()=>{
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  if(!placedRooms.length){ alert('Сначала размести хотя бы одну комнату.'); return; }
  if(buildingMode==='BUILDING'){
    const invalid=placedRooms.map(p=>({p,issues:getBuildingPlacementIssues(p)})).filter(x=>x.issues.length);
    if(invalid.length){
      const lines=invalid.slice(0,12).map((x,i)=>`${i+1}. ${x.p.name||x.p.roomId}: ${x.issues.map(y=>y.message).join('; ')}`);
      const more=invalid.length>12?`\n... и ещё ${invalid.length-12}.`:'';
      const proceed=confirm(`Перед сохранением найдены проблемные комнаты: ${invalid.length}\n\n${lines.join('\n')}${more}\n\nКрасная рамка означает пересечение/неподобранную RANDOM-комнату/выход за рабочую область.\n\nСохранить всё равно?`);
      if(!proceed) return;
    }
  }
  const base=sanitizeSlug(document.getElementById('buildingId').value)||'building';
  const nameCheck=document.getElementById('buildingName').value.trim();
  try{
    const dir=await getSubdir(projectDirHandle,'data/buildings',false);
    const fileHandle=await dir.getFileHandle(base+'.json');
    const file=await fileHandle.getFile();
    const existing=JSON.parse(await file.text());
    if(existing.name && existing.name!==nameCheck){
      const proceed=confirm(`Внимание: здание с id "${base}" уже есть и называется «${existing.name}», а у тебя сейчас «${nameCheck||'без названия'}».\n\nЭто разные здания со случайно совпавшим id? Если продолжишь — файл того, старого здания будет ПЕРЕЗАПИСАН.\n\nПродолжить и перезаписать?`);
      if(!proceed) return;
    }
  }catch(e){ /* файла ещё нет — всё в порядке */ }
  try{
    await writeFileToProject('data/buildings/'+base+'.json', new TextEncoder().encode(JSON.stringify(collectBuildingJSON(),null,2)));
    document.getElementById('folderStatus').textContent='Папка: '+projectDirHandle.name+' ✓ · сохранено '+new Date().toLocaleTimeString();
    await scanExistingBuildings();
  }catch(e){ console.error(e); alert('Не удалось сохранить: '+e.message); }
};
