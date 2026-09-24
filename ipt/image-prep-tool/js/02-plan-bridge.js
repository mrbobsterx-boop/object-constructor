/* ============================================================
   MODULE 02 — PLAN BRIDGE
   Живой доступ к каталогу Object Plan: index.html подключает его же js/02-vocab.js + 03/04/05-data-*.js
   напрямую, так что GROUPS/CATEGORIES/PLAN_ITEMS здесь — ровно те же объекты, что видит сам Object Plan
   (никакого дублирования данных). «Свои» разделы/объекты/вариации читаются и пишутся в тот же файл,
   который читает и пишет сам Object Plan — data/object_plan.json (поля custom/customGroups/variationOverrides) —
   поэтому что бы ни добавили здесь, при следующем «📂 Из проекта» в Object Plan это появится там.

   Вариация к УЖЕ существующему объекту добавляется двумя разными путями в зависимости от того,
   свой это объект или встроенный (из каталога Object Plan):
     - свой объект (есть в planCustomItems) — пишем прямо в его item.v, он и так весь целиком
       сохраняется в data/object_plan.json → custom;
     - встроенный объект (из PLAN_ITEMS) — его самого менять нельзя (он не сохраняется этим
       инструментом), поэтому добавка складывается в variationOverrides[id] — отдельный список
       «довесков» по id объекта, который Object Plan подмешивает к встроенному v при сборке модели
       (см. object-plan/js/06-model.js, buildModel). item.v при этом тоже сразу дополняется —
       только для мгновенного отображения в этой сессии.
   ============================================================ */

let planCustomItems=[], planCustomGroups=[], planVariationOverrides={};

function planEffectiveGroups(){ return GROUPS.concat(planCustomGroups); }
function planAllItems(){ return PLAN_ITEMS.concat(planCustomItems); }
function planItemById(id){ return planAllItems().find(i=>i.id===id)||null; }
function normName(s){ return String(s||'').trim().toLowerCase(); }
function findPlanItemByGroupAndName(groupId,name){
  const n=normName(name);
  return planAllItems().find(i=>i.g===groupId&&normName(i.n)===n)||null;
}
function uniquePlanId(base){
  const all=new Set(planAllItems().map(i=>i.id));
  let id=base||'object', n=2;
  while(all.has(id)) id=base+'_'+(n++);
  return id;
}

/* ---------- вариации существующего объекта ---------- */
function variationExists(item,variationRuText){
  const en=sanitizeSlug(variationRuText), ru=normName(variationRuText);
  return (item.v||[]).some(v=>variationEn(v)===en||normName(variationRu(v))===ru);
}
// Бросает исключение с понятным текстом, если добавить нельзя. Ничего не сохраняет сама —
// вызывающий код (addOrUpdatePlanItem / панель именования) сам решает, когда звать savePlanCustomToProject().
function appendVariationToItem(item,variationRuText){
  const vr=(variationRuText||'').trim();
  if(!vr) throw new Error('Пустой текст вариации.');
  if(!Array.isArray(item.v)) item.v=[];
  if(variationExists(item,vr)) throw new Error('Такая вариация уже есть у этого объекта.');
  if(planCustomItems.includes(item)){
    item.v.push(vr);
  } else {
    if(!planVariationOverrides[item.id]) planVariationOverrides[item.id]=[];
    planVariationOverrides[item.id].push(vr);
    item.v.push(vr); // мгновенно видно в этой сессии, не дожидаясь перезагрузки
  }
  return true;
}
function applyVariationOverrides(){
  Object.keys(planVariationOverrides).forEach(id=>{
    const item=planItemById(id); if(!item) return;
    if(!Array.isArray(item.v)) item.v=[];
    (planVariationOverrides[id]||[]).forEach(vr=>{ if(!variationExists(item,vr)) item.v.push(vr); });
  });
}

/* ---------- чтение/запись data/object_plan.json (общий с Object Plan файл) ---------- */
async function loadPlanCustomFromProject(){
  if(!projectDirHandle) return;
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const r=await readJsonFile(dir,'object_plan.json');
    if(r.data){
      planCustomItems=Array.isArray(r.data.custom)?r.data.custom:[];
      planCustomGroups=Array.isArray(r.data.customGroups)?r.data.customGroups:[];
      planVariationOverrides=(r.data.variationOverrides&&typeof r.data.variationOverrides==='object')?r.data.variationOverrides:{};
      applyVariationOverrides();
    }
  }catch(e){ console.warn('Не удалось прочитать data/object_plan.json:',e); }
  if(typeof refreshNamingPanel==='function') refreshNamingPanel();
}
async function savePlanCustomToProject(){
  if(!projectDirHandle) return false;
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const r=await readJsonFile(dir,'object_plan.json');
    const base=r.data||{schema_version:1,status:{},steps:{},notes:{}};
    const data=Object.assign({},base,{schema_version:1,saved_at:new Date().toISOString(),custom:planCustomItems,customGroups:planCustomGroups,variationOverrides:planVariationOverrides});
    await writeFileToProject('data/object_plan.json',new TextEncoder().encode(JSON.stringify(data,null,2)));
    return true;
  }catch(e){ console.error(e); alert('Не удалось записать data/object_plan.json: '+e.message); return false; }
}

/* ---------- добавить/обновить объект плана (своя категория/объект/вариация) ---------- */
// Возвращает {item, groupId, created:{group,item,variation}} — что именно было создано, для статус-сообщения.
async function addOrUpdatePlanItem({groupId,newGroupName,name,categoryId,variationRu}){
  const created={group:false,item:false,variation:false};
  if(groupId==='__new__'){
    const gName=(newGroupName||'').trim(); if(!gName) throw new Error('Укажи название нового раздела.');
    const gId=uniqueGroupId(sanitizeSlug(gName)||'group');
    planCustomGroups.push({id:gId,name:gName,layer:0,desc:'Свой раздел (добавлен из image-prep-tool)'});
    groupId=gId; created.group=true;
  }
  if(!groupId) throw new Error('Выбери раздел.');
  const nm=(name||'').trim(); if(!nm) throw new Error('Укажи название объекта.');
  let item=findPlanItemByGroupAndName(groupId,nm);
  if(!item){
    item={id:uniquePlanId(sanitizeSlug(nm)),n:nm,c:categoryId||'special',g:groupId,p:1,v:[],why:'',fn:'',use:'',note:''};
    planCustomItems.push(item); created.item=true;
  }
  const vr=(variationRu||'').trim();
  if(vr&&!variationExists(item,vr)){ appendVariationToItem(item,vr); created.variation=true; }
  await savePlanCustomToProject();
  return {item,groupId,created};
}
function uniqueGroupId(base){
  const all=new Set(planEffectiveGroups().map(g=>g.id));
  let id=base||'group', n=2;
  while(all.has(id)) id=base+'_'+(n++);
  return id;
}
