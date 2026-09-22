/* ============================================================
   MODULE 11 — ROOM SAVE / LOAD
   Room JSON assembly, saving, export and opening a room.
   ============================================================ */

/* ============================================================
   СБОР JSON / СОХРАНЕНИЕ / ЭКСПОРТ / ОТКРЫТИЕ КОМНАТЫ
   ============================================================ */
function collectRoomJSON(){
  return {
    schema_version:4, // 4 = все длины в игровых метрах (суффикс M в имени поля)
    id: room.id || 'room_'+Date.now(),
    name: room.name||'',
    type: room.type||'',
    widthM: pxToM(room.width), heightM: pxToM(room.height),
    playerWalkZ: room.playerWalkZ,
    walkLineThicknessCm: room.walkLineThicknessCm||20,
    zoneCells: room.zoneCells,
    compositionRole: room.compositionRole||'CENTER_CENTER',
    stairConnections: (room.stairConnections||[]).map(position=>({
      type:'STAIR',
      position,
      direction:(getCompositionSocketPosition(position)||{}).direction||null
    })),
    backgroundLayers: room.backgroundLayers.map((l,idx)=>({ image:'rooms/'+(l.path||('bg'+idx+'.png')), opacity:l.opacity, parallax:l.parallax,
      xM:pxToM(l.x!==undefined?l.x:room.width/2), yM:pxToM(l.y!==undefined?l.y:room.height/2), widthM:pxToM(l.nativeWidth*(l.scale||1),3), heightM:pxToM(l.nativeHeight*(l.scale||1),3),
      rotation:l.rotation||0, flipH:!!l.flipH, flipV:!!l.flipV })),
    instances: room.instances.map(i=>({
      instanceId:i.instanceId, objectId:i.objectId, xM:pxToM(i.x), yM:pxToM(i.y),
      scale:i.scale||1, rotation:i.rotation, flipH:i.flipH, flipV:i.flipV, zIndex:i.zIndex, collisionMode:i.collisionMode||'ZLEVEL', light:lightToJSON(i.light), shadow:i.shadow||null,
      isDecor: !!i.isDecor, placementMode: i.placementMode||'ANYWHERE', realWidthCm: i.realWidthCm||0, realHeightCm: i.realHeightCm||0,
      door: doorToJSON(i.door)
    }))
  };
}
document.getElementById('btnExportJSON').onclick=()=>{
  const base=sanitizeSlug(room.id||document.getElementById('roomId').value)||'room';
  const blob=new Blob([JSON.stringify(collectRoomJSON(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=base+'.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.getElementById('btnSaveRoom').onclick=async ()=>{
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  const base=sanitizeSlug(room.id||document.getElementById('roomId').value)||'room';

  // Перед сохранением проверяем ВСЕ объекты. Ошибка не блокирует редактирование,
  // но пользователь должен явно подтвердить сохранение проблемного состояния.
  room.instances.forEach(inst=>{ if(!inst.isDecor) updatePlacementValidity(inst); });
  const invalidInstances=room.instances.filter(inst=>!inst.isDecor && !isInstancePlacementValid(inst));
  if(invalidInstances.length){
    const lines=invalidInstances.slice(0,12).map((inst,i)=>{
      const issues=getPlacementIssues(inst);
      return `${i+1}. ${inst.objectId||inst.instanceId}: ${issues.map(x=>x.message).join('; ')}`;
    });
    const more=invalidInstances.length>12?`\n... и ещё ${invalidInstances.length-12}.`:'';
    const proceed=confirm(`Перед сохранением найдены проблемные объекты: ${invalidInstances.length}\n\n${lines.join('\n')}${more}\n\nКрасная подсветка означает недопустимую зону, выход за границы, коллизию или отсутствие требуемой опоры.\n\nСохранить комнату всё равно?`);
    if(!proceed) return;
  }
  const existing=existingRoomsList.find(r=>r.id===base);
  if(existing && existing.name && existing.name!==room.name){
    const proceed=confirm(`Внимание: комната с id "${base}" уже есть и называется «${existing.name}», а у тебя сейчас «${room.name||'без названия'}».\n\nЭто разные комнаты со случайно совпавшим id? Если продолжишь — файл той, старой комнаты будет ПЕРЕЗАПИСАН.\n\nПродолжить и перезаписать?`);
    if(!proceed) return;
  }
  room.id=base; document.getElementById('roomId').value=base;
  try{
    for(const layer of room.backgroundLayers){
      await writeFileToProject('assets/sprites/rooms/'+layer.path, await dataURLToBytes(layer.dataUrl));
    }
    await writeFileToProject('data/rooms/'+base+'.json', new TextEncoder().encode(JSON.stringify(collectRoomJSON(),null,2)));
    await scanExistingRooms(); await scanExistingSets();
    document.getElementById('folderStatus').textContent='Папка: '+projectDirHandle.name+' ✓ · сохранено '+new Date().toLocaleTimeString();
  }catch(e){ console.error(e); alert('Не удалось сохранить: '+e.message); }
};
document.getElementById('btnDuplicateRoom').onclick=()=>{
  // Полная копия текущей комнаты остаётся в памяти, но это уже новый будущий файл:
  // ID и имя очищаем, чтобы случайно не перезаписать исходную комнату.
  room.id=''; room.name='';
  document.getElementById('roomId').value='';
  document.getElementById('roomId').dataset.auto='1';
  document.getElementById('roomName').value='';
  document.getElementById('folderStatus').textContent='Скопировано — содержимое комнаты сохранено. Задай новое название/id и сохрани отдельным файлом.';
  scheduleHistoryPush();
};
async function loadRoomFromJSON(data){
  data=roomFromJSON(data); // числа → px редактора (старые файлы пересчитываются)
  room={ id:data.id||'', name:data.name||'', type:data.type||'', width:data.width||640, height:data.height||220, playerWalkZ:(data.playerWalkZ!==undefined?data.playerWalkZ:10), backgroundLayers:[], instances:[],
    walkLineThicknessCm:(data.walkLineThicknessCm!==undefined?data.walkLineThicknessCm:20),
    zoneCells: data.zoneCells ? {...data.zoneCells} : legacyZonesToCache(data.zones),
    compositionRole: data.compositionRole||'CENTER_CENTER',
    stairConnections: Array.isArray(data.stairConnections) ? data.stairConnections.map(x=>typeof x==='string'?x:x&&x.position).filter(x=>['TOP_LEFT','TOP_CENTER','TOP_RIGHT','BOTTOM_LEFT','BOTTOM_CENTER','BOTTOM_RIGHT'].includes(x)) : [] };
  document.getElementById('walkLineThickness').value=room.walkLineThicknessCm;
  document.getElementById('roomId').value=room.id; document.getElementById('roomId').dataset.auto='0'; document.getElementById('roomName').value=room.name; ensureRoomTypeOption(room.type); document.getElementById('roomType').value=room.type;
  setRoomSizeInputs(room.width,room.height);
  document.getElementById('playerWalkZ').value=room.playerWalkZ;
  const layerDefs = data.backgroundLayers || (data.background ? [data.background] : []); // старый формат — один фон
  if(layerDefs.length && projectDirHandle){
    try{
      const spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false);
      for(const ld of layerDefs){
        if(!ld || !ld.image) continue;
        try{
          const parts=ld.image.split('/'); const fileName=parts.pop();
          const subDir=parts.length? await getSubdir(spritesDir,parts.join('/'),false):spritesDir;
          const imgFile=await (await subDir.getFileHandle(fileName)).getFile();
          const dataUrl=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(imgFile); });
          const dims=await getImageDims(dataUrl); // битый файл → исключение → слой пропускается, комната всё равно открывается
          room.backgroundLayers.push({ dataUrl, path:fileName, nativeWidth:dims.w, nativeHeight:dims.h, opacity:(ld.opacity!==undefined?ld.opacity:1), parallax:(ld.parallax!==undefined?ld.parallax:1),
            id:'bg_'+Date.now()+Math.random().toString(36).slice(2),
            x:(ld.x!==undefined?ld.x:room.width/2), y:(ld.y!==undefined?ld.y:room.height/2),
            scale:bgScaleFromJSON(ld,dims.w), rotation:(ld.rotation!==undefined?ld.rotation:0),
            flipH:!!ld.flipH, flipV:!!ld.flipV });
        }catch(e){ console.warn('Слой фона не найден на диске:',ld.image,e); }
      }
    }catch(e){ console.warn('Папка assets/sprites не найдена:',e); }
  }
  renderBgLayerList();
  let sizeUpdated=0; // сколько экземпляров получили новый размер из ОС
  room.instances=(data.instances||[]).map(inst=>{
    const cat=projectCatalog.find(c=>c.id===inst.objectId);
    const obj=cat?cat.json:{};
    const worldSize=getObjectWorldSize(obj);
    // Размер берём у объекта в ОС (актуальный). Сохранённый в комнате размер — только если объекта нет в каталоге
    // или в ОС размер не задан.
    const fromObject=!!cat&&worldSize.source==='REAL_SIZE';
    const realW=fromObject?worldSize.widthCm:(inst.realWidthCm>0?inst.realWidthCm:worldSize.widthCm);
    const realH=fromObject?worldSize.heightCm:(inst.realHeightCm>0?inst.realHeightCm:worldSize.heightCm);
    if(fromObject&&inst.realWidthCm>0&&inst.realHeightCm>0&&(Math.abs(inst.realWidthCm-realW)>0.5||Math.abs(inst.realHeightCm-realH)>0.5)) sizeUpdated++;
    const worldW=realW*PIXELS_PER_METER/100;
    const worldH=realH*PIXELS_PER_METER/100;
    const restored={ instanceId:inst.instanceId||('inst_'+Date.now()+Math.random().toString(36).slice(2)),
      objectId:inst.objectId, name:cat?cat.name:inst.objectId, image:cat?cat.image:null,
      x:inst.x, y:inst.y, scale:inst.scale||1, rotation:inst.rotation||0, flipH:!!inst.flipH, flipV:!!inst.flipV, zIndex:inst.zIndex||0, collisionMode:inst.collisionMode||'ZLEVEL', light:inst.light||null, shadow:inst.shadow||null,
      w:worldW, h:worldH,
      isDecor: !!inst.isDecor, placementMode: inst.placementMode||(obj.behavior&&obj.behavior.placement_mode)||'ANYWHERE',
      realWidthCm:realW, realHeightCm:realH, placementValid:true,
      door: inst.door||null };
    if(restored.placementMode==='FLOOR_ONLY'&&!restored.isDecor) snapInstanceToFloor(restored);
    updatePlacementValidity(restored);
    return restored;
  });
  selectedInstanceId=null;
  renderRoom(); renderPropertiesPanel(); renderZoneGridOverlay(); scheduleHistoryPush();
  if(sizeUpdated) document.getElementById('folderStatus').textContent=`Размеры обновлены по ОС у экземпляров: ${sizeUpdated} — сохрани комнату, чтобы записать новые размеры.`;
}
document.getElementById('btnOpenRoom').onclick=async ()=>{
  if(!projectDirHandle){ document.getElementById('fileOpenRoom').click(); return; }
  const id=document.getElementById('openRoomSelect').value;
  if(!id){ alert('Выбери комнату из списка слева.'); return; }
  try{
    const roomsDir=await getSubdir(projectDirHandle,'data/rooms',false);
    const fileHandle=await roomsDir.getFileHandle(id+'.json');
    const file=await fileHandle.getFile();
    await loadRoomFromJSON(JSON.parse(await file.text()));
  }catch(e){ alert('Не удалось открыть комнату: '+e.message); }
};
document.getElementById('fileOpenRoom').onchange=async e=>{
  const file=e.target.files[0]; if(!file)return;
  await loadRoomFromJSON(JSON.parse(await file.text()));
  e.target.value='';
};
document.getElementById('btnNewRoom').onclick=()=>{
  if(room.instances.length && !confirm('Начать новую комнату? Несохранённые изменения текущей будут потеряны.'))return;
  room={id:'',name:'',type:'',width:640,height:220,playerWalkZ:10,backgroundLayers:[],instances:[],walkLineThicknessCm:20,zoneCells:{},compositionRole:'CENTER_CENTER',stairConnections:[]};
  selectedInstanceId=null;
  document.getElementById('roomId').value=''; document.getElementById('roomName').value=''; document.getElementById('roomType').value='';
  document.getElementById('roomId').dataset.auto='1';
  setRoomSizeInputs(640,220);
  document.getElementById('playerWalkZ').value=10;
  renderBgLayerList();
  renderRoom(); renderPropertiesPanel(); scheduleHistoryPush();
};

/* ============================================================
   РАЗМЕРЫ ИЗ ОС ВО ВСЕХ КОМНАТАХ
   В файле комнаты у каждого экземпляра записан размер (realWidthCm / realHeightCm) — его читает игра. Если размер
   объекта изменили в ОС, в уже сохранённых комнатах он остаётся старым. Кнопка пробегает все комнаты папки и
   записывает актуальный размер объекта. У FLOOR_ONLY-объектов сохраняется нижняя грань (они стоят на опоре),
   у остальных — центр. Комнаты старого формата (schema_version < 4) не трогаются — открой и пересохрани их.
   ============================================================ */
async function syncAllRoomSizes(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  const btn=document.getElementById('btnSyncSizes'), status=document.getElementById('folderStatus');
  if(btn){ btn.disabled=true; btn.textContent='Проверяю…'; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/rooms',false);
    const plan=[]; let skippedLegacy=0, total=0;
    for await(const [name,h] of dir.entries()){
      if(h.kind!=='file'||!name.endsWith('.json')) continue;
      try{
        const data=JSON.parse(await (await h.getFile()).text());
        if(!Array.isArray(data.instances)||!data.instances.length) continue;
        if(!(data.schema_version>=4)){ skippedLegacy++; continue; }
        let changed=0;
        data.instances.forEach(inst=>{
          const cat=projectCatalog.find(c=>c.id===inst.objectId); if(!cat) return;
          const sz=getObjectWorldSize(cat.json); if(sz.source!=='REAL_SIZE') return;
          const ow=Number(inst.realWidthCm)||0, oh=Number(inst.realHeightCm)||0;
          if(Math.abs(ow-sz.widthCm)<=0.5&&Math.abs(oh-sz.heightCm)<=0.5) return;
          if(ow>0&&oh>0&&inst.placementMode==='FLOOR_ONLY'&&!inst.isDecor) inst.yM=Math.round((inst.yM+(oh-sz.heightCm)*(inst.scale||1)/200)*1000)/1000; // нижняя грань остаётся на месте
          inst.realWidthCm=sz.widthCm; inst.realHeightCm=sz.heightCm; changed++;
        });
        if(changed){ plan.push({name,id:data.id||name.replace(/\.json$/,''),data,changed}); total+=changed; }
      }catch(e){ console.warn('Комната пропущена:',name,e); }
    }
    if(!plan.length){ alert('Все размеры в комнатах уже совпадают с ОС.'+(skippedLegacy?`\n\nКомнат старого формата пропущено: ${skippedLegacy} (открой и пересохрани их).`:'')); return; }
    const list=plan.slice(0,12).map(p=>`• ${p.id}: ${p.changed}`).join('\n')+(plan.length>12?`\n… и ещё ${plan.length-12}`:'');
    if(!confirm(`Размер объектов в ОС отличается от записанного в комнатах.\nКомнат: ${plan.length}, экземпляров: ${total}.\n\n${list}\n\nЗаписать актуальные размеры в файлы этих комнат?`+(skippedLegacy?`\n\nКомнат старого формата пропущено: ${skippedLegacy}.`:''))) return;
    for(const p of plan) await writeFileToProject('data/rooms/'+p.name, new TextEncoder().encode(JSON.stringify(p.data,null,2)));
    const openId=room&&room.id;
    status.textContent=`Размеры обновлены: комнат ${plan.length}, экземпляров ${total}.`+(openId&&plan.some(p=>p.id===openId)?' Открытая комната изменилась на диске — открой её заново.':'');
  }catch(e){ console.error(e); alert('Не удалось обновить размеры: '+e.message); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='📐 Размеры из ОС во всех комнатах'; } }
}
document.getElementById('btnSyncSizes').onclick=syncAllRoomSizes;
