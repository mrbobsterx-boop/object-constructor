/* ============================================================
   MODULE 06 — INSTANCES + SETS
   Adding/deleting instances, saving and inserting sets of objects.
   ============================================================ */

function addInstance(item,x,y){
  const obj=item.json||{};
  const worldSize=getObjectWorldSize(obj);
  const w=worldSize.widthPx;
  const h=worldSize.heightPx;
  const maxZ=room.instances.reduce((m,i)=>Math.max(m,i.zIndex),0);
  const objLight=lightFromJSON(obj.behavior&&obj.behavior.light);
  const objShadow=(obj.behavior&&obj.behavior.shadow)?{...obj.behavior.shadow}:null;
  const placementMode=(obj.behavior&&obj.behavior.placement_mode)||'ANYWHERE';
  const inst={ instanceId:'inst_'+Date.now()+Math.random().toString(36).slice(2), objectId:item.id, name:item.name, image:item.image,
    x:Math.round(x), y:Math.round(y), rotation:0, flipH:false, flipV:false, zIndex:maxZ+1, w, h, scale:1, collisionMode:'ZLEVEL', light:objLight, shadow:objShadow,
    isDecor:false, placementMode, realWidthCm:worldSize.widthCm, realHeightCm:worldSize.heightCm,
    placementValid:true,
    door:(obj.category==='door')?{toRoom:'',spawnX:0,spawnY:0}:null };
  if(placementMode==='FLOOR_ONLY') snapInstanceToFloor(inst);
  updatePlacementValidity(inst);
  room.instances.push(inst);
  selectedInstanceId=inst.instanceId;
  renderRoom(); renderPropertiesPanel(); scheduleHistoryPush();
}

function deleteMultiSelected(){
  if(!confirm(`Удалить ${multiSelectedIds.size} объект(ов)${multiSelectedBgIds.size?` и ${multiSelectedBgIds.size} фоновый слой(и)`:''}?`))return;
  room.instances=room.instances.filter(i=>!multiSelectedIds.has(i.instanceId));
  room.backgroundLayers=room.backgroundLayers.filter(l=>!multiSelectedBgIds.has(l.id));
  multiSelectedIds.clear(); multiSelectedBgIds.clear();
  renderRoom(); renderBgLayerList(); renderPropertiesPanel(); scheduleHistoryPush();
}

function collectSetJSON(){
  const items=[...multiSelectedIds].map(id=>room.instances.find(i=>i.instanceId===id)).filter(Boolean);
  const bgItems=[...multiSelectedBgIds].map(id=>room.backgroundLayers.find(l=>l.id===id)).filter(Boolean);
  const xs=[], ys=[];
  items.forEach(i=>{ const w=i.w*(i.scale||1), h=i.h*(i.scale||1); xs.push(i.x-w/2, i.x+w/2); ys.push(i.y-h/2, i.y+h/2); });
  bgItems.forEach(l=>{ const sw=l.nativeWidth*(l.scale||1), sh=l.nativeHeight*(l.scale||1); const lx=(l.x!==undefined?l.x:room.width/2), ly=(l.y!==undefined?l.y:room.height/2); xs.push(lx-sw/2, lx+sw/2); ys.push(ly-sh/2, ly+sh/2); });
  const originX=xs.length?Math.min(...xs):0, originY=ys.length?Math.min(...ys):0;
  const base=sanitizeSlug(document.getElementById('setId').value)||'set';
  return {
    schema_version:2, id:base, name:document.getElementById('setName').value||base,
    objects: items.map(i=>({ objectId:i.objectId, name:i.name, xM:pxToM(i.x-originX), yM:pxToM(i.y-originY), rotation:i.rotation, flipH:i.flipH, flipV:i.flipV, zIndex:i.zIndex, scale:i.scale, collisionMode:i.collisionMode, light:lightToJSON(i.light), shadow:i.shadow, door:doorToJSON(i.door) })),
    background_layers: bgItems.map(l=>({ path:l.path, dataUrl:l.dataUrl, nativeWidth:l.nativeWidth, nativeHeight:l.nativeHeight, opacity:l.opacity, parallax:l.parallax, xM:pxToM((l.x!==undefined?l.x:room.width/2)-originX), yM:pxToM((l.y!==undefined?l.y:room.height/2)-originY), widthM:pxToM(l.nativeWidth*(l.scale||1),3), heightM:pxToM(l.nativeHeight*(l.scale||1),3), rotation:l.rotation, flipH:l.flipH, flipV:l.flipV }))
  };
}
async function saveCurrentSelectionAsSet(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  if(!document.getElementById('setId').value.trim()){ alert('Впиши название сета.'); return; }
  const base=sanitizeSlug(document.getElementById('setId').value)||'set';
  const nameCheck=document.getElementById('setName').value.trim();
  try{
    const dir=await getSubdir(projectDirHandle,'data/sets',false);
    const fileHandle=await dir.getFileHandle(base+'.json');
    const file=await fileHandle.getFile();
    const existing=JSON.parse(await file.text());
    if(existing.name && existing.name!==nameCheck){
      const proceed=confirm(`Внимание: сет с id "${base}" уже есть и называется «${existing.name}», а у тебя сейчас «${nameCheck||'без названия'}».\n\nПродолжить и перезаписать?`);
      if(!proceed) return;
    }
  }catch(e){ /* файла ещё нет */ }
  try{
    const json=collectSetJSON();
    await writeFileToProject('data/sets/'+base+'.json', new TextEncoder().encode(JSON.stringify(json,null,2)));
    await scanExistingSets();
    document.getElementById('folderStatus').textContent='Сет «'+(json.name)+'» сохранён.';
    multiSelectedIds.clear(); multiSelectedBgIds.clear();
    renderRoom(); renderPropertiesPanel();
  }catch(e){ console.error(e); alert('Не удалось сохранить сет: '+e.message); }
}

let existingSets=[]; // {id,name,objectCount}[]
async function scanExistingSets(){
  existingSets=[];
  if(!projectDirHandle){ renderSetsList(); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/sets',false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{ const file=await handle.getFile(); const data=JSON.parse(await file.text());
        existingSets.push({id:data.id, name:data.name||data.id, objectCount:(data.objects||[]).length}); }
      catch(e){}
    }
  }catch(e){}
  renderSetsList();
}
function renderSetsList(){
  const box=document.getElementById('setsList'); if(!box)return;
  if(!existingSets.length){ box.innerHTML='<span class="muted">Пока нет сохранённых сетов.</span>'; return; }
  box.innerHTML=existingSets.map(s=>`<div class="lib-item" data-id="${s.id}" style="cursor:pointer;padding:5px 6px" title="Кликни, чтобы вставить в центр комнаты">${esc(s.name)} <span class="status">(${s.objectCount} объект.)</span></div>`).join('');
  box.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>insertSet(el.dataset.id));
}
async function insertSet(setId){
  if(!projectDirHandle)return;
  try{
    const dir=await getSubdir(projectDirHandle,'data/sets',false);
    const fileHandle=await dir.getFileHandle(setId+'.json');
    const file=await fileHandle.getFile();
    const data=JSON.parse(await file.text());
    const dropX=room.width/2, dropY=room.height/2;
    const maxZ=room.instances.reduce((m,i)=>Math.max(m,i.zIndex),0);
    const newIds=[];
    (data.objects||[]).forEach(o=>{
      const cat=projectCatalog.find(c=>c.id===o.objectId);
      const obj=cat?cat.json:{};
      const worldSize=getObjectWorldSize(obj);
      const {xM:_xM,yM:_yM,w:_w,h:_h,...oRest}=o;
      const inst={ ...oRest, instanceId:'inst_'+Date.now()+Math.random().toString(36).slice(2), x:Math.round(dropX+lenPx(o,'xM','x',0)), y:Math.round(dropY+lenPx(o,'yM','y',0)), zIndex:maxZ+1+(o.zIndex||0),
        light:lightFromJSON(o.light), door:doorFromJSON(o.door),
        image:cat?cat.image:null, w:worldSize.widthPx, h:worldSize.heightPx, realWidthCm:worldSize.widthCm, realHeightCm:worldSize.heightCm,
        placementMode:o.placementMode||(obj.behavior&&obj.behavior.placement_mode)||'ANYWHERE', placementValid:true };
      if(inst.placementMode==='FLOOR_ONLY'&&!inst.isDecor) snapInstanceToFloor(inst);
      updatePlacementValidity(inst);
      room.instances.push(inst); newIds.push(inst.instanceId);
    });
    (data.background_layers||[]).forEach(l=>{
      const {xM:_lx,yM:_ly,widthM:_lw,heightM:_lh,...lRest}=l;
      const layer={ ...lRest, id:'bg_'+Date.now()+Math.random().toString(36).slice(2), x:Math.round(dropX+lenPx(l,'xM','x',0)), y:Math.round(dropY+lenPx(l,'yM','y',0)), scale:bgScaleFromJSON(l,l.nativeWidth) };
      room.backgroundLayers.push(layer);
    });
    renderRoom(); renderBgLayerList(); scheduleHistoryPush();
    document.getElementById('folderStatus').textContent='Сет «'+(data.name||setId)+'» вставлен в центр комнаты — подвинь на место.';
  }catch(e){ console.error(e); alert('Не удалось вставить сет: '+e.message); }
}
