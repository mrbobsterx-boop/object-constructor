/* ============================================================
   MODULE 11 — STORE + СВЕРКА С ПРОЕКТОМ
   Отметки хранятся в localStorage (ключ sam_v1) и по кнопке — в data/scene_plan.json.
   Четыре авторских каталога (Системы/Компоненты/Игровые объекты/Данные) — фиксированный
   список + свои элементы. Сцен своего каталога нет: список комнат и зданий целиком приходит
   из data/rooms и data/buildings при сканировании проекта.
   Статус элемента — задан вручную (store.status) или вычисляется по шагам. Шаг — отмечен
   вручную ИЛИ определён автоматически по проекту (файл по указанному пути; автозагрузка —
   только у систем; .tscn сцены — у комнат/зданий).
   ============================================================ */

const STORE_KEY='sam_v1';
function loadStore(){
  try{
    const s=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    store={
      status:s.status||{}, steps:s.steps||{}, notes:s.notes||{},
      custom:{system:(s.custom&&s.custom.system)||{}, component:(s.custom&&s.custom.component)||{}, gameobject:(s.custom&&s.custom.gameobject)||{}, data:(s.custom&&s.custom.data)||{}},
      settings:Object.assign({scenesRoot:'scenes'},s.settings||{})
    };
  }catch(e){ console.warn('Не удалось прочитать отметки:',e); }
}
function saveStore(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(store)); }catch(e){ console.warn(e); } }
async function saveStoreToProject(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  try{
    const data={schema_version:2,saved_at:new Date().toISOString(),status:store.status,steps:store.steps,notes:store.notes,custom:store.custom,settings:store.settings};
    await writeFileToProject('data/scene_plan.json',new TextEncoder().encode(JSON.stringify(data,null,2)));
    setFolderStatus('Прогресс записан в data/scene_plan.json · '+new Date().toLocaleTimeString());
  }catch(e){ console.error(e); alert('Не удалось записать: '+e.message); }
}
async function loadStoreFromProject(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const r=await readJsonFile(dir,'scene_plan.json');
    if(!r.data){ alert('Файл data/scene_plan.json не найден или повреждён.'); return; }
    if(!confirm('Заменить текущие отметки в браузере отметками из data/scene_plan.json?')) return;
    const d=r.data;
    store={
      status:d.status||{}, steps:d.steps||{}, notes:d.notes||{},
      custom:{system:(d.custom&&d.custom.system)||{}, component:(d.custom&&d.custom.component)||{}, gameobject:(d.custom&&d.custom.gameobject)||{}, data:(d.custom&&d.custom.data)||{}},
      settings:Object.assign({scenesRoot:'scenes'},d.settings||{})
    };
    saveStore(); buildModel(); render();
    setFolderStatus('Отметки загружены из проекта.');
  }catch(e){ console.error(e); alert('Не удалось прочитать: '+e.message); }
}

/* ---------- сверка с проектом ---------- */
let PROJECT={scanned:false,at:null,autoloads:new Map(),pathsOk:new Map(),tscnById:new Map(),tscnExtra:[],roomsMissing:false,buildingsMissing:false,godotMissing:false};
let SCENES=[], SCENE_BY_KEY=new Map();

function roomToScene(f){
  const d=f.data||{}; const id=String(d.id||f.name.replace(/\.json$/i,''));
  const instances=Array.isArray(d.instances)?d.instances:[];
  const world=d.world||{}; const blocks=Array.isArray(world.blocks)?world.blocks:[];
  const bg=Array.isArray(d.backgroundLayers)?d.backgroundLayers:[];
  return {
    kind:'room', key:'room:'+id, id, name:d.name||id, type:d.type||'',
    widthM:num(d.widthM), heightM:num(d.heightM),
    instCount:instances.length, doorCount:instances.filter(i=>i&&i.door).length,
    hasLight:instances.some(i=>i&&i.light), hasBlocks:blocks.length>0, bgCount:bg.length,
    compositionRole:d.compositionRole||'', stairCount:Array.isArray(d.stairConnections)?d.stairConnections.length:0,
    sourceFile:'data/rooms/'+f.name, broken:!!f.broken
  };
}
function buildingToScene(f){
  const d=f.data||{}; const id=String(d.id||f.name.replace(/\.json$/i,''));
  const mode=d.layout_mode||'BUILDING';
  const rooms=Array.isArray(d.rooms)?d.rooms:[]; const seq=Array.isArray(d.sequence)?d.sequence:[];
  const bg=Array.isArray(d.backgroundLayers)?d.backgroundLayers:[];
  const doorLinks=Array.isArray(d.door_links)?d.door_links:[];
  const slotCount=mode==='BUILDING'?rooms.filter(r=>r&&r.mode==='RANDOM').length:seq.filter(s=>s&&s.type==='POOL').length;
  const floors=mode==='BUILDING'?new Set(rooms.map(r=>num(r&&r.floor,0))):new Set([0]);
  return {
    kind:'building', key:'bld:'+id, id, name:d.name||id, layoutMode:mode,
    roomsCount:mode==='BUILDING'?rooms.length:seq.length, doorLinkCount:doorLinks.length,
    slotCount, floorCount:floors.size, bgCount:bg.length,
    sourceFile:'data/buildings/'+f.name, broken:!!f.broken
  };
}

async function scanProject(){
  if(!projectDirHandle) return;
  const el=document.getElementById('scanStatus'); if(el) el.textContent='Сверка с проектом…';
  const P={scanned:true,at:new Date(),autoloads:new Map(),pathsOk:new Map(),tscnById:new Map(),tscnExtra:[],roomsMissing:false,buildingsMissing:false,godotMissing:false};

  const godotText=await readTextFile('project.godot');
  P.godotMissing=(godotText===null);
  P.autoloads=parseAutoloads(godotText);

  const authored=[...SYSTEMS,...COMPONENTS,...GAMEOBJECTS,...DOMAINS].filter(it=>it.path);
  await Promise.all(authored.map(async it=>{ P.pathsOk.set(it.key, await fileExistsAtResPath(it.path)); }));

  const scenesRoot=(store.settings.scenesRoot||'scenes').replace(/^\/+|\/+$/g,'');
  const tscn=await listFilesRecursive(scenesRoot,/\.tscn$/i);
  const knownIds=new Set();
  const roomsRaw=await listJsonDir('data/rooms'); P.roomsMissing=roomsRaw.missing;
  const buildingsRaw=await listJsonDir('data/buildings'); P.buildingsMissing=buildingsRaw.missing;
  roomsRaw.items.forEach(f=>{ if(f.data) knownIds.add(String(f.data.id||f.name.replace(/\.json$/i,''))); });
  buildingsRaw.items.forEach(f=>{ if(f.data) knownIds.add(String(f.data.id||f.name.replace(/\.json$/i,''))); });
  tscn.files.forEach(rel=>{
    const base=rel.split('/').pop().replace(/\.tscn$/i,'');
    if(!P.tscnById.has(base)) P.tscnById.set(base, scenesRoot+'/'+rel);
    if(!knownIds.has(base)) P.tscnExtra.push(scenesRoot+'/'+rel);
  });

  SCENES=[]; SCENE_BY_KEY=new Map();
  roomsRaw.items.forEach(f=>{ if(!f.data) return; const s=roomToScene(f); SCENES.push(s); SCENE_BY_KEY.set(s.key,s); });
  buildingsRaw.items.forEach(f=>{ if(!f.data) return; const s=buildingToScene(f); SCENES.push(s); SCENE_BY_KEY.set(s.key,s); });

  PROJECT=P;
  if(el) el.textContent='Сверка: '+P.at.toLocaleTimeString();
  render();
}

/* ---------- шаги и статусы (общие для всех 5 видов элементов) ---------- */
function stepDefsFor(item){
  if(item.kind==='room') return ROOM_STEP_DEFS;
  if(item.kind==='building') return BUILDING_STEP_DEFS;
  return CATALOGS[item.kind].steps;
}
function stepList(item){ return stepDefsFor(item).filter(s=>s.when(item)); }
function autoStepDone(item,stepId){
  if(item.kind==='room'||item.kind==='building') return stepId==='tscn' ? PROJECT.tscnById.has(item.id) : false;
  const meta=CATALOGS[item.kind];
  if(stepId===meta.autoStepId) return !!(item.path && PROJECT.pathsOk.get(item.key)===true);
  if(stepId==='autoload'&&meta.hasAutoload&&item.autoload){
    if(PROJECT.autoloads.has(item.autoload)) return true;
    const want=String(item.path||'').replace(/^res:\/\//,'');
    for(const v of PROJECT.autoloads.values()) if(v.replace(/^res:\/\//,'')===want) return true;
    return false;
  }
  return false;
}
function stepManual(item,stepId){ return !!(store.steps[item.key]&&store.steps[item.key][stepId]); }
function stepDone(item,stepId){ return stepManual(item,stepId)||autoStepDone(item,stepId); }
function stepStats(item){ const list=stepList(item); const done=list.filter(s=>stepDone(item,s.id)).length; return {done,total:list.length}; }
function statusOf(item){
  const m=store.status[item.key]; if(m) return m;
  const st=stepStats(item);
  return (st.total&&st.done===st.total)?'done':(st.done>0?'wip':'todo');
}
function statusIsAuto(item){ return !store.status[item.key]; }
function isDone(item){ return statusOf(item)==='done'; }
function blockedBy(item){ return (item.req||[]).filter(r=>BY_KEY.has(r)&&!['done','skip'].includes(statusOf(BY_KEY.get(r)))); }
function blockingSystems(){ return SYSTEMS.filter(s=>s.blocksScenes&&!['done','skip'].includes(statusOf(s))); }
function setStatus(key,status){ if(status) store.status[key]=status; else delete store.status[key]; saveStore(); }
function setStep(key,stepId,on){
  if(!store.steps[key]) store.steps[key]={};
  if(on) store.steps[key][stepId]=true; else delete store.steps[key][stepId];
  if(!Object.keys(store.steps[key]).length) delete store.steps[key];
  saveStore();
}
function setNote(key,text){ if(text&&text.trim()) store.notes[key]=text; else delete store.notes[key]; saveStore(); }

/* ---------- свои элементы (в любом из 4 авторских каталогов) ---------- */
function addCustomItem(kind,obj){ store.custom[kind][obj.id]=obj; saveStore(); buildModel(); }
function removeCustomItem(kind,id){
  delete store.custom[kind][id];
  const key=CATALOGS[kind].prefix+id;
  delete store.status[key]; delete store.steps[key]; delete store.notes[key];
  saveStore(); buildModel();
}

/* ---------- экспорт ---------- */
function exportMarkdown(){
  const out=['# Shelter Architecture Map — чертёж Godot-проекта','',`Сформировано: ${new Date().toLocaleString('ru-RU')}`,''];
  ['system','component','gameobject','data'].forEach(kind=>{
    const meta=CATALOGS[kind], all=(kind==='system'?SYSTEMS:kind==='component'?COMPONENTS:kind==='gameobject'?GAMEOBJECTS:DOMAINS);
    out.push(`## ${meta.label}`,'');
    meta.groups.forEach(g=>{
      const list=all.filter(i=>i.g===g.id).sort((a,b)=>a.p-b.p);
      if(!list.length) return;
      const done=list.filter(isDone).length;
      out.push(`### ${esc0(g.name)} (${done}/${list.length})`,'');
      list.forEach(i=>{
        const st=statusOf(i), mark=st==='done'?'x':' ';
        out.push(`- [${mark}] **${i.n}** (\`${i.id}\`) — P${i.p}${st==='wip'?' — в работе':''}${st==='skip'?' — отложено':''}`);
        if(i.fn) out.push(`  - ${i.fn}`);
      });
      out.push('');
    });
  });
  out.push('## Сцены (комнаты и здания из проекта)','');
  if(!SCENES.length) out.push('_Папка проекта не подключена или в ней нет data/rooms / data/buildings._','');
  else{
    ['room','building'].forEach(kind=>{
      const list=SCENES.filter(s=>s.kind===kind).sort((a,b)=>a.id.localeCompare(b.id));
      if(!list.length) return;
      const done=list.filter(isDone).length;
      out.push(`### ${kind==='room'?'Комнаты':'Здания и улицы'} (${done}/${list.length})`,'');
      list.forEach(i=>{
        const st=statusOf(i), mark=st==='done'?'x':' ';
        out.push(`- [${mark}] **${i.name}** (\`${i.id}\`, ${i.sourceFile})${st==='wip'?' — в работе':''}`);
      });
      out.push('');
    });
  }
  downloadText('shelter-architecture-map.md',out.join('\n'),'text/markdown');
}
function esc0(s){ return String(s||''); } // markdown, экранировать HTML не нужно
