/* ============================================================
   MODULE 03 — RELATIONS
   Индексы и связи между сущностями: кто на кого ссылается («использует» / «используется в»),
   справочники (категории, типы комнат, группы взаимозаменяемости, теги), кто ссылается на какой файл.
   Ссылки — те же, что в README редакторов:
     комната.instances[].objectId → объект            комната.door.toRoom → комната
     комната.world.blocks[].type → объект (категория block)
     здание.rooms[].room / sequence[].room → комната    слот здания → комнаты по типу/роли/лестницам
     объект: action_settings (tool, consume, produce), crafting.recipe.ingredients[].item, block (tool, drop_table), character_ref
   ============================================================ */

let idx={obj:new Map(),room:new Map(),bld:new Map(),set:new Map(),chr:new Map(),rig:new Map(),sprites:new Set(),sounds:new Set()};
let dict={categories:new Map(),roomTypes:new Map(),groups:new Map(),tags:new Map()};
let fileRefs=new Map();   // 'sprite:rel' | 'sound:rel' → [{kind,id,ctx}]

// Все файлы, на которые ссылается объект
function objectAssetRefs(d){
  const out=[]; const push=(type,rel,ctx,main)=>{ if(rel) out.push({type,rel:normPath(rel),ctx,main:!!main}); };
  const a=d.appearance||{}, v=d.visuals||{}, ds=d.destruction||{}, cr=d.crafting&&d.crafting.recipe;
  push('sprite',a.asset,'основная картинка',true);
  (v.images||[]).forEach(s=>{ if(s) push('sprite',s.asset,'состояние «'+(s.name||'?')+'»'); });
  (v.animations||[]).forEach(an=>{
    if(!an) return;
    push('sprite',an.asset,'анимация «'+(an.name||'?')+'»');
    if(an.sound&&Array.isArray(an.sound.files)) an.sound.files.forEach(f=>push('sound',f,'звук анимации «'+(an.name||'?')+'»'));
  });
  if(ds.damaged) push('sprite',ds.damaged.image,'повреждённый вид');
  if(ds.broken) push('sprite',ds.broken.image,'разрушенный вид');
  if(ds.destroyAnimation) push('sprite',ds.destroyAnimation.sheet,'анимация разрушения');
  if(cr) push('sprite',cr.recipeImage,'схема рецепта');
  return out;
}
// Комнаты, которые может выбрать слот здания (как roomMatchesRandomSlot в Building Editor)
function roomsMatchingSlot(typeFilter,role,stairs){
  return registry.rooms.filter(r=>r.type===typeFilter && (!role||r.role===role) && (stairs||[]).every(s=>r.stairs.includes(s)));
}
function addFileRef(type,rel,kind,id,ctx){
  const k=type+':'+rel; if(!fileRefs.has(k)) fileRefs.set(k,[]);
  const list=fileRefs.get(k); if(!list.some(x=>x.kind===kind&&x.id===id&&x.ctx===ctx)) list.push({kind,id,ctx});
}

function buildRelations(){
  const R=registry;
  idx={obj:new Map(R.objects.map(o=>[o.id,o])), room:new Map(R.rooms.map(r=>[r.id,r])), bld:new Map(R.buildings.map(b=>[b.id,b])),
       set:new Map(R.sets.map(s=>[s.id,s])), chr:new Map(R.characters.map(c=>[c.id,c])), rig:new Map(R.rigs.map(g=>[g.id,g])),
       sprites:new Set(R.sprites), sounds:new Set(R.sounds)};
  fileRefs=new Map();

  // --- объекты: что использует объект ---
  R.objects.forEach(o=>{
    const d=o.raw;
    const use=(kind,id,ctx)=>{
      if(!id) return; o.uses.push({kind,id,ctx});
      if(kind==='object'){ const t=idx.obj.get(id); if(t) t.usedBy.objects.push({id:o.id,ctx}); }
    };
    Object.keys(d.action_settings||{}).forEach(aid=>{
      const s=d.action_settings[aid]; if(!s) return;
      use('object',s.tool,'действие '+aid+' → инструмент');
      use('object',s.consume&&s.consume.item,'действие '+aid+' → расходуется');
      use('object',s.produce&&s.produce.item,'действие '+aid+' → выдаётся');
    });
    const ingredients=d.crafting&&d.crafting.recipe&&d.crafting.recipe.ingredients;
    if(Array.isArray(ingredients)){ const seen=new Set(); ingredients.forEach(ing=>{ const iid=ing&&ing.item; if(iid&&!seen.has(iid)){ seen.add(iid); use('object',iid,'рецепт крафта → ингредиент'); } }); }
    if(o.block){ use('object',o.block.tool,'материал → инструмент'); (o.block.drop_table||[]).forEach(dr=>{ if(dr) use('object',dr.item,'материал → добыча'); }); }
    if(d.character_ref&&d.character_ref.id) use('character',d.character_ref.id,'персонаж Assembler');
    objectAssetRefs(d).forEach(a=>addFileRef(a.type,a.rel,'object',o.id,a.ctx));
  });

  // --- комнаты ---
  R.rooms.forEach(r=>{
    r.instances.forEach(i=>{
      if(!i.objectId) return;
      r.usedObjects.set(i.objectId,(r.usedObjects.get(i.objectId)||0)+1);
      const o=idx.obj.get(i.objectId); if(o) o.usedBy.rooms.set(r.id,(o.usedBy.rooms.get(r.id)||0)+1);
    });
    r.blockTypes.forEach((n,type)=>{ const o=idx.obj.get(type); if(o) o.usedBy.blocks.set(r.id,n); });
    r.doors.forEach(dr=>{ const t=idx.room.get(dr.toRoom); if(t&&t!==r&&!t.usedBy.doors.some(x=>x.room===r.id)) t.usedBy.doors.push({room:r.id}); });
    r.bgLayers.forEach(p=>addFileRef('sprite',normPath(p),'room',r.id,'фон комнаты'));
  });
  R.sets.forEach(s=>{ s.objects.forEach(oid=>{ const o=idx.obj.get(oid); if(o) o.usedBy.sets.set(s.id,(o.usedBy.sets.get(s.id)||0)+1); }); });

  // --- здания ---
  R.buildings.forEach(b=>{
    b.entries.forEach(e=>{
      if(b.mode==='STREET'){
        if(e.type==='POOL'){ roomsMatchingSlot(e.typeFilter,'',[]).forEach(r=>{ if(!r.usedBy.slots.includes(b.id)) r.usedBy.slots.push(b.id); }); }
        else { const r=idx.room.get(e.roomId); if(r&&!r.usedBy.buildings.some(x=>x.id===b.id)) r.usedBy.buildings.push({id:b.id}); }
      } else if(e.mode==='RANDOM'){
        roomsMatchingSlot(e.typeFilter,e.role,e.stairs).forEach(r=>{ if(!r.usedBy.slots.includes(b.id)) r.usedBy.slots.push(b.id); });
      } else { const r=idx.room.get(e.roomId); if(r&&!r.usedBy.buildings.some(x=>x.id===b.id)) r.usedBy.buildings.push({id:b.id}); }
    });
    b.bgLayers.forEach(p=>addFileRef('sprite',normPath(p),'building',b.id,'фон здания'));
  });

  // --- справочники ---
  dict={categories:new Map(),roomTypes:new Map(),groups:new Map(),tags:new Map()};
  ((R.categoriesFile&&R.categoriesFile.categories)||[]).forEach(c=>{ if(c&&c.id) dict.categories.set(String(c.id),{id:String(c.id),name:c.name||c.id,count:0,inFile:true}); });
  R.objects.forEach(o=>{
    const k=o.category||'';
    if(!dict.categories.has(k)) dict.categories.set(k,{id:k,name:o.categoryName||k||'(без категории)',count:0,inFile:false});
    dict.categories.get(k).count++;
    if(o.variantGroup){ if(!dict.groups.has(o.variantGroup)) dict.groups.set(o.variantGroup,{id:o.variantGroup,objects:[],recipeTypes:[]}); dict.groups.get(o.variantGroup).objects.push(o.id); }
    o.tags.forEach(t=>dict.tags.set(t,(dict.tags.get(t)||0)+1));
    o.allowedRoomTypes.forEach(t=>{ const rt=roomTypeRec(t); rt.allowedBy.push(o.id); });
  });
  R.rooms.forEach(r=>{ if(r.type) roomTypeRec(r.type).rooms.push(r.id); });
  const rec=R.recipes&&typeof R.recipes==='object'?R.recipes:{};
  Object.keys(rec).forEach(type=>{
    const rt=roomTypeRec(type); rt.recipeRows=Array.isArray(rec[type])?rec[type].length:0;
    (Array.isArray(rec[type])?rec[type]:[]).forEach(row=>{
      if(!row||!row.group) return;
      if(!dict.groups.has(row.group)) dict.groups.set(row.group,{id:row.group,objects:[],recipeTypes:[]});
      const g=dict.groups.get(row.group); if(!g.recipeTypes.includes(type)) g.recipeTypes.push(type);
    });
  });
}
function roomTypeRec(t){
  if(!dict.roomTypes.has(t)) dict.roomTypes.set(t,{type:t,rooms:[],allowedBy:[],recipeRows:0});
  return dict.roomTypes.get(t);
}
// Сколько раз объект стоит в комнатах / сколько всего ссылок на него
function objectUsageCount(o){ let n=0; o.usedBy.rooms.forEach(v=>n+=v); return n; }
function objectIsUsed(o){ return o.usedBy.rooms.size>0||o.usedBy.blocks.size>0||o.usedBy.sets.size>0||o.usedBy.objects.length>0; }
function roomIsUsed(r){ return r.usedBy.buildings.length>0||r.usedBy.doors.length>0||r.usedBy.slots.length>0; }
