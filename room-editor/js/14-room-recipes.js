/* ============================================================
   MODULE 14 — ROOM RECIPES
   Explicit "what and how many" recipes per room type.
   ============================================================ */

/* ============================================================
   РЕЦЕПТЫ КОМНАТ — явный список "что и сколько", без образцов
   ============================================================ */
let roomRecipes={}; // roomType -> [{group,min,max}]
async function loadRoomRecipes(){
  roomRecipes={};
  if(!projectDirHandle)return;
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const fileHandle=await dir.getFileHandle('room_recipes.json');
    const file=await fileHandle.getFile();
    roomRecipes=JSON.parse(await file.text())||{};
  }catch(e){ /* файла ещё нет */ }
}
async function saveRoomRecipesToDisk(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  await writeFileToProject('data/room_recipes.json', new TextEncoder().encode(JSON.stringify(roomRecipes,null,2)));
}
function populateRecipeTypeSelect(){
  const sel=document.getElementById('recipeType');
  const cur=sel.value;
  sel.innerHTML=[...document.getElementById('roomType').options].filter(o=>o.value).map(o=>`<option value="${o.value}">${o.textContent}</option>`).join('');
  if([...sel.options].some(o=>o.value===cur)) sel.value=cur;
}
function populateVariantGroupDatalist(){
  const dl=document.getElementById('variantGroupDatalist');
  const list=projectDirHandle ? projectCatalog : [];
  const groups=[...new Set(list.map(e=>e.json&&e.json.behavior&&e.json.behavior.variant_group).filter(Boolean))];
  dl.innerHTML=groups.map(g=>`<option value="${esc(g)}">`).join('');
}
function renderRecipeRows(){
  const type=document.getElementById('recipeType').value;
  const rows=roomRecipes[type]||[];
  const box=document.getElementById('recipeRows');
  if(!rows.length){ box.innerHTML='<span class="status">Пока пусто — добавь строку ниже.</span>'; return; }
  box.innerHTML=rows.map((r,i)=>`
    <div class="row" style="margin-bottom:4px" data-idx="${i}">
      <span style="width:220px">${r.group?esc(r.group):'<i>любой декор для этого типа</i>'}</span>
      <span class="status">от ${r.min} до ${r.max} шт.</span>
      <button class="del-recipe-row" style="margin-left:auto">✕</button>
    </div>`).join('');
  box.querySelectorAll('.del-recipe-row').forEach(btn=>{
    btn.onclick=()=>{ const i=+btn.closest('[data-idx]').dataset.idx; rows.splice(i,1); renderRecipeRows(); };
  });
}
document.getElementById('recipeType').addEventListener('change', renderRecipeRows);
document.getElementById('btnAddRecipeRow').onclick=()=>{
  const type=document.getElementById('recipeType').value; if(!type)return;
  const group=document.getElementById('recipeNewGroup').value.trim();
  const min=Math.max(0,+document.getElementById('recipeNewMin').value||0);
  const max=Math.max(min,+document.getElementById('recipeNewMax').value||min);
  if(!roomRecipes[type]) roomRecipes[type]=[];
  roomRecipes[type].push({group:group||null, min, max});
  document.getElementById('recipeNewGroup').value='';
  renderRecipeRows();
};
document.getElementById('btnSaveRecipe').onclick=async ()=>{
  await saveRoomRecipesToDisk();
  document.getElementById('recipeStatus').textContent='Сохранено — применится сразу в генераторе.';
};
document.getElementById('btnOpenRecipes').onclick=async ()=>{
  document.getElementById('recipeModal').classList.add('open');
  populateRecipeTypeSelect();
  populateVariantGroupDatalist();
  document.getElementById('recipeType').value=room.type||'';
  renderRecipeRows();
  document.getElementById('recipeStatus').textContent='';
};
document.getElementById('btnCloseRecipes').onclick=()=>document.getElementById('recipeModal').classList.remove('open');

function generateFromRecipe(rows, roomType, targetW, targetH){
  const generated=[]; let z=0; const skipped=[];
  const catalog=projectDirHandle ? projectCatalog : [];
  rows.forEach(row=>{
    const count=row.min + Math.floor(Math.random()*(row.max-row.min+1));
    for(let i=0;i<count;i++){
      let candidates;
      if(row.group){
        candidates=catalog.filter(c=>c.json.behavior && c.json.behavior.variant_group===row.group);
      } else {
        candidates=catalog.filter(c=>c.json.behavior && (c.json.behavior.allowed_room_types||[]).includes(roomType));
      }
      if(!candidates.length){ skipped.push(row.group||'(декор для '+roomType+')'); continue; }
      const cat=candidates[Math.floor(Math.random()*candidates.length)];
      const worldSize=getObjectWorldSize(cat.json);
      const w=worldSize.widthPx;
      const h=worldSize.heightPx;
      const placementMode=(cat.json.behavior&&cat.json.behavior.placement_mode)||'ANYWHERE';
      generated.push({
        instanceId:'inst_'+Date.now()+Math.random().toString(36).slice(2),
        objectId:cat.id, name:cat.name, image:cat.image, w, h,
        x:Math.round((0.1+Math.random()*0.8)*targetW), y:Math.round((0.1+Math.random()*0.8)*targetH),
        rotation:0, scale:1, flipH:Math.random()<0.5, flipV:false,
        zIndex:z++, collisionMode:'ZLEVEL',
        isDecor:false, placementMode,
        realWidthCm:worldSize.widthCm, realHeightCm:worldSize.heightCm, placementValid:true,
        light:null, shadow:null, door:null
      });
    }
  });
  return {generated, skipped};
}

document.getElementById('btnRunGen').onclick=async ()=>{
  const method=document.getElementById('genMethod').value;
  const targetW=mToPx(+document.getElementById('genWidth').value||6.4);
  const targetH=mToPx(+document.getElementById('genHeight').value||2.2);
  let generated=[], statusMsg='', selectedSampleRooms=[];
  if(method==='RECIPE'){
    const type=document.getElementById('genType').value;
    const rows=roomRecipes[type]||[];
    if(!rows.length){ document.getElementById('genStatus').textContent='У этого типа комнаты пока нет рецепта — создай его в «📋 Рецепты комнат».'; return; }
    const res=generateFromRecipe(rows, type, targetW, targetH);
    generated=res.generated;
    statusMsg=`Готово: добавлено ${generated.length} объектов по рецепту «${type}».`;
    if(res.skipped.length) statusMsg+=` (не найдено подходящих объектов для: ${[...new Set(res.skipped)].join(', ')}.)`;
  } else {
    const checks=[...document.querySelectorAll('.genRoomCheck:checked')];
    if(!checks.length){ document.getElementById('genStatus').textContent='Выбери хотя бы одну комнату-образец.'; return; }
    const rooms=window.__genRoomsCache||[];
    const selected=checks.map(c=>rooms[+c.dataset.idx]).filter(Boolean);
    selectedSampleRooms=selected;
    const model=buildFrequencyModel(selected);
    const res=generateRoomInstances(model,targetW,targetH);
    generated=res.generated;
    statusMsg=`Готово: добавлено ${generated.length} объектов из ${selected.length} образцов.`;
    if(res.skippedMissing) statusMsg+=` (${res.skippedMissing} объектов из образцов пропущено — их нет в подключённом каталоге.)`;
  }
  const append=document.getElementById('genAppend').checked;
  if(!append) room.instances=[];
  room.instances=room.instances.concat(generated);
  room.width=targetW; room.height=targetH;
  if(!append && method==='SAMPLES'){
    const bgResult=await loadRandomGeneratedBackground(selectedSampleRooms,targetW,targetH);
    if(bgResult){
      room.backgroundLayers=bgResult.layers;
      statusMsg+=` Фон выбран случайно из «${bgResult.sourceName}».`;
    }
  }
  setRoomSizeInputs(targetW,targetH);
  generated.forEach(inst=>{ if(inst.placementMode==='FLOOR_ONLY'&&!inst.isDecor) snapInstanceToFloor(inst); updatePlacementValidity(inst); });
  selectedInstanceId=null;
  renderRoom(); renderPropertiesPanel(); renderZoneGridOverlay(); scheduleHistoryPush();
  document.getElementById('genStatus').textContent=statusMsg;
};
