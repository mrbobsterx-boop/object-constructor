/* ============================================================
   MODULE 03 — ROOM CATALOG
   Rooms read from data/rooms/*.json, catalog list, slot-type select.
   ============================================================ */

/* ============================================================
   КАТАЛОГ КОМНАТ
   ============================================================ */
let roomCatalog=[]; // {id,name,type,width,height,doors:[{x,y}],hasBlocks} — из data/rooms/*.json; в JSON метры, здесь — px редактора (100px = 1м)
async function scanRoomCatalog(){
  roomCatalog=[];
  roomVisualCache={};
  objectIndexCache=null; // индекс объектов перечитается при следующем превью
  if(!projectDirHandle){ renderRoomCatalogList(); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/rooms',false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{
        const file=await handle.getFile();
        const data=roomFromJSON(JSON.parse(await file.text())); // метры → px (старые файлы пересчитываются)
        const doors=(data.instances||[]).filter(i=>i.door).map(i=>({x:i.x,y:i.y}));
        const stairConnections=Array.isArray(data.stairConnections)
          ? data.stairConnections.map(x=>typeof x==='string'?x:(x&&x.position)).filter(Boolean)
          : [];
        const hasBlocks=!!(data.world&&Array.isArray(data.world.blocks)&&data.world.blocks.length); // в комнате есть разрушаемые блоки (сетка 1 м)
        roomCatalog.push({ id:data.id, name:data.name||data.id, type:data.type||'', width:data.width, height:data.height, doors, compositionRole:data.compositionRole||'CENTER_CENTER', stairConnections, hasBlocks });
      }catch(e){ console.warn('Битая комната:',name,e); }
    }
  }catch(e){}
  renderRoomCatalogList();
  populateSlotTypeSelect();
}
function renderRoomCatalogList(){
  const box=document.getElementById('roomCatalogList');
  if(!roomCatalog.length){ box.innerHTML='<span class="muted">Нет сохранённых комнат в подключённой папке.</span>'; return; }
  box.innerHTML=roomCatalog.map(r=>{
    const stairs=(r.stairConnections||[]).map(x=>({TOP_LEFT:'↖',TOP_CENTER:'↑',TOP_RIGHT:'↗',BOTTOM_LEFT:'↙',BOTTOM_CENTER:'↓',BOTTOM_RIGHT:'↘'}[x]||x)).join(' ');
    const meta=[(r.width/PIXELS_PER_METER).toFixed(1)+'×'+(r.height/PIXELS_PER_METER).toFixed(1)+'м',r.type||'',r.compositionRole||'CENTER_CENTER',stairs?'лестницы: '+stairs:'без лестниц',
      r.hasBlocks?('блоки (сетка 1 м)'+((Math.abs(r.width-Math.round(r.width/PIXELS_PER_METER)*PIXELS_PER_METER)>0.5||Math.abs(r.height-Math.round(r.height/PIXELS_PER_METER)*PIXELS_PER_METER)>0.5)?' ⚠ размер не кратен 1 м':'')):''].filter(Boolean).join(' · ');
    return `<div class="room-catalog-item" data-id="${r.id}"><div>${esc(r.name)}</div><span class="muted">${esc(meta)}</span></div>`;
  }).join('');
  box.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>addPlacedRoom(el.dataset.id));
}
function populateSlotTypeSelect(){
  const types=[...new Set(roomCatalog.map(r=>r.type).filter(Boolean))];
  const sel=document.getElementById('slotTypeSelect');
  sel.innerHTML = types.length ? types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('') : '<option value="">— нет типов в каталоге —</option>';
}
