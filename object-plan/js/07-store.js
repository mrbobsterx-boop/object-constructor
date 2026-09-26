/* ============================================================
   MODULE 07 — STORE + СВЕРКА С ПРОЕКТОМ
   Отметки хранятся в localStorage (ключ object_plan_v1) и по кнопке — в data/object_plan.json.
   Статус объекта: задан вручную (store.status) или вычисляется по шагам. Шаг считается выполненным,
   если отмечен вручную ИЛИ определён автоматически по проекту (объект найден в data/objects, у него есть
   картинка, размер, действия…).
   Проект читается только на чтение: data/objects, data/rooms, assets/sprites.
   ============================================================ */

const STORE_KEY='object_plan_v1';
function loadStore(){
  try{
    const s=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    store={status:s.status||{},steps:s.steps||{},notes:s.notes||{},custom:Array.isArray(s.custom)?s.custom:[],customGroups:Array.isArray(s.customGroups)?s.customGroups:[],variationOverrides:(s.variationOverrides&&typeof s.variationOverrides==='object')?s.variationOverrides:{}};
  }catch(e){ console.warn('Не удалось прочитать отметки:',e); }
}
function saveStore(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(store)); }catch(e){ console.warn(e); } }
async function saveStoreToProject(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  try{
    const data={schema_version:1,saved_at:new Date().toISOString(),status:store.status,steps:store.steps,notes:store.notes,custom:store.custom,customGroups:store.customGroups,variationOverrides:store.variationOverrides};
    await writeFileToProject('data/object_plan.json',new TextEncoder().encode(JSON.stringify(data,null,2)));
    setFolderStatus('Прогресс записан в data/object_plan.json · '+new Date().toLocaleTimeString());
  }catch(e){ console.error(e); alert('Не удалось записать: '+e.message); }
}
async function loadStoreFromProject(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const r=await readJsonFile(dir,'object_plan.json');
    if(!r.data){ alert('Файл data/object_plan.json не найден или повреждён.'); return; }
    if(!confirm('Заменить текущие отметки в браузере отметками из data/object_plan.json?')) return;
    store={status:r.data.status||{},steps:r.data.steps||{},notes:r.data.notes||{},custom:Array.isArray(r.data.custom)?r.data.custom:[],customGroups:Array.isArray(r.data.customGroups)?r.data.customGroups:[],variationOverrides:(r.data.variationOverrides&&typeof r.data.variationOverrides==='object')?r.data.variationOverrides:{}};
    saveStore(); buildModel(); render();
    setFolderStatus('Отметки загружены из проекта.');
  }catch(e){ console.error(e); alert('Не удалось прочитать: '+e.message); }
}

/* ---------- сверка с проектом ---------- */
// refs — превью-кропы из image-prep-tool (assets/refs/<id>_<вариация-en>.*): имя → object URL для миниатюры
// рядом с вариацией на карточке объекта.
let PROJECT={scanned:false,at:null,found:new Map(),sprites:new Set(),refs:new Map(),usage:new Map(),extra:[],missingObjects:false};
async function scanProjectObjects(){
  if(!projectDirHandle) return;
  const el=document.getElementById('scanStatus'); if(el) el.textContent='Сверка с проектом…';
  const P={scanned:true,at:new Date(),found:new Map(),sprites:new Set(),refs:new Map(),usage:new Map(),extra:[],missingObjects:false};
  const use=(id,n)=>{ if(id) P.usage.set(id,(P.usage.get(id)||0)+(n||1)); };
  const objs=await listJsonDir('data/objects'); P.missingObjects=objs.missing;
  const sp=await listFilesRecursive('assets/sprites',SPRITE_EXT); sp.files.forEach(f=>P.sprites.add(f));
  for(const [oldPath,oldUrl] of PROJECT.refs) URL.revokeObjectURL(oldUrl);
  const rf=await listFilesRecursive('assets/refs',SPRITE_EXT);
  for(const relPath of rf.files){
    try{
      const dir=await getSubdir(projectDirHandle,'assets/refs/'+relPath.split('/').slice(0,-1).join('/'),false);
      const file=await (await dir.getFileHandle(relPath.split('/').pop())).getFile();
      P.refs.set(relPath,URL.createObjectURL(file));
    }catch(e){ /* пропускаем нечитаемый файл превью */ }
  }
  objs.items.forEach(f=>{
    if(!f.data||typeof f.data!=='object') return;
    const d=f.data, b=d.behavior||{}, id=String(d.id||f.name.replace(/\.json$/i,''));
    const vis=d.visuals||{}, bk=d.block||null;
    P.found.set(id,{ id, name:d.name||id, category:d.category||'', w:num(b.real_width_cm), h:num(b.real_height_cm), asset:normPath(d.appearance&&d.appearance.asset),
      actionsN:Array.isArray(d.actions)?d.actions.length:0, visualsN:((vis.animations||[]).length+(vis.images||[]).length),
      hasRecipe:!!(d.crafting&&d.crafting.recipe), material:bk?{hardness:num(bk.hardness),dropN:(bk.drop_table||[]).length}:null });
    // ссылки одних объектов на другие
    Object.keys(d.action_settings||{}).forEach(a=>{ const s=d.action_settings[a]||{}; use(s.tool); use(s.consume&&s.consume.item); use(s.produce&&s.produce.item); });
    const pat=d.crafting&&d.crafting.recipe&&d.crafting.recipe.pattern; if(Array.isArray(pat)) pat.flat().forEach(c=>{ if(c&&c.id) use(c.id); });
    if(bk){ use(bk.tool); (bk.drop_table||[]).forEach(x=>{ if(x) use(x.item); }); }
  });
  const rooms=await listJsonDir('data/rooms');
  rooms.items.forEach(f=>{
    if(!f.data) return;
    (Array.isArray(f.data.instances)?f.data.instances:[]).forEach(i=>{ if(i&&i.objectId) use(i.objectId); });
    ((f.data.world&&Array.isArray(f.data.world.blocks))?f.data.world.blocks:[]).forEach(b=>{ if(b&&b.type) use(b.type); });
  });
  const sets=await listJsonDir('data/sets');
  sets.items.forEach(f=>{ if(f.data) (f.data.objects||[]).forEach(o=>{ if(o&&o.objectId) use(o.objectId); }); });
  PROJECT=P;
  P.extra=[...P.found.values()].filter(o=>!BY_ID.has(o.id));
  if(el) el.textContent='Сверка: '+P.at.toLocaleTimeString();
  render();
}
function found(item){ return PROJECT.found.get(item.id)||null; }
// Превью вариации: первый файл assets/refs/, чьё имя начинается с <id>_<английская вариация> — так их
// сохраняет image-prep-tool. Без подключённой папки/скана — ничего.
function refThumbFor(item,v){
  const prefix=(item.id+'_'+variationEn(v)).toLowerCase();
  for(const [relPath,url] of PROJECT.refs){
    const base=relPath.split('/').pop().replace(/\.[a-z0-9]+$/i,'').toLowerCase();
    if(base.indexOf(prefix)===0) return url;
  }
  return null;
}
// Состояния превью по суффиксу (их проставляет Asset Renamer при переносе файлов в assets/refs):
// <id>_<вариация>_idle — обычный вид, _broken — повреждённый, _icon — иконка для инвентаря.
// Файл без суффикса (старые превью, сохранённые до появления Asset Renamer) считается idle.
function refStateThumbs(item,v){
  const prefix=(item.id+'_'+variationEn(v)).toLowerCase();
  const out={idle:null,broken:null,icon:null,any:null};
  for(const [relPath,url] of PROJECT.refs){
    const base=relPath.split('/').pop().replace(/\.[a-z0-9]+$/i,'').toLowerCase();
    if(base.indexOf(prefix)!==0) continue;
    if(!out.any) out.any=url;
    const rest=base.slice(prefix.length);
    if(/^_idle(_\d+)?$/.test(rest)){ if(!out.idle) out.idle=url; }
    else if(/^_broken(_\d+)?$/.test(rest)){ if(!out.broken) out.broken=url; }
    else if(/^_icon(_\d+)?$/.test(rest)){ if(!out.icon) out.icon=url; }
    else if(rest===''&&!out.idle) out.idle=url;
  }
  return out;
}

/* ---------- шаги и статусы ---------- */
function stepList(item){ return STEP_DEFS.filter(s=>s.when(item)); }
function autoStepDone(item,stepId){
  const f=found(item); if(!f) return false;
  if(stepId==='saved') return true;
  if(stepId==='image') return !!f.asset&&PROJECT.sprites.has(f.asset);
  if(stepId==='params') return f.w>0&&f.h>0;
  if(stepId==='actions') return f.actionsN>0;
  if(stepId==='visuals') return f.visualsN>0;
  if(stepId==='recipe') return f.hasRecipe;
  if(stepId==='material') return !!(f.material&&f.material.hardness>0&&f.material.dropN>0);
  if(stepId==='used') return (PROJECT.usage.get(item.id)||0)>0;
  return false;
}
function stepManual(item,stepId){ return !!(store.steps[item.id]&&store.steps[item.id][stepId]); }
function stepDone(item,stepId){ return stepManual(item,stepId)||autoStepDone(item,stepId); }
function stepStats(item){ const list=stepList(item); const done=list.filter(s=>stepDone(item,s.id)).length; return {done,total:list.length}; }
function statusOf(item){
  const m=store.status[item.id]; if(m) return m;
  const st=stepStats(item);
  return (st.total&&st.done===st.total)?'done':(st.done>0?'wip':'todo');
}
function statusIsAuto(item){ return !store.status[item.id]; }
function isDone(item){ return statusOf(item)==='done'; }
// Чего не хватает для начала: требования (req), которые ещё не готовы
function blockedBy(item){ return item.req.filter(r=>BY_ID.has(r)&&!['done','skip'].includes(statusOf(BY_ID.get(r)))); }
function setStatus(id,status){ if(status) store.status[id]=status; else delete store.status[id]; saveStore(); }
function setStep(id,stepId,on){
  if(!store.steps[id]) store.steps[id]={};
  if(on) store.steps[id][stepId]=true; else delete store.steps[id][stepId];
  if(!Object.keys(store.steps[id]).length) delete store.steps[id];
  saveStore();
}
function setNote(id,text){ if(text&&text.trim()) store.notes[id]=text; else delete store.notes[id]; saveStore(); }

function exportMarkdown(){
  const out=['# Object Plan — чек-лист объектов','',`Сформировано: ${new Date().toLocaleString('ru-RU')}`,''];
  effectiveGroups().forEach(g=>{
    const list=ITEMS.filter(i=>i.g===g.id).sort((a,b)=>a.p-b.p);
    if(!list.length) return;
    const done=list.filter(isDone).length;
    out.push(`## ${g.name} (${done}/${list.length})`,'');
    list.forEach(i=>{
      const st=statusOf(i), mark=st==='done'?'x':' ';
      out.push(`- [${mark}] **${i.n}** (\`${i.id}\`, ${(CAT_BY_ID().get(i.c)||{}).name||i.c}) — P${i.p}${st==='wip'?' — в работе':''}${st==='skip'?' — отложено':''}`);
      if(i.fn) out.push(`  - ${i.fn}`);
    });
    out.push('');
  });
  downloadText('object-plan-checklist.md',out.join('\n'),'text/markdown');
}
