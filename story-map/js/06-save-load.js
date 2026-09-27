/* ============================================================
   MODULE 06 — ЧТЕНИЕ/ЗАПИСЬ data/story.json
   Единственный файл, который пишет это приложение. Читают его story-bot (симулятор) и в будущем —
   код игры/ИИ.
   ============================================================ */

// Версия формата data/story.json (§9/§23). Пока каждое изменение формата было additive (новое поле —
// с ||-фоллбэком на чтении и явным бэкфиллом в loadStoryFromProject, как actionRef/implementationStatus
// в группах Q/R) — миграций ниже нет и не нужно. Список заведён заранее, а не в момент, когда впервые
// понадобится несовместимая смена формата: тогда цена ошибки — тихо неверно прочитанный старый файл.
const STORY_SCHEMA_VERSION=1;
const STORY_SCHEMA_MIGRATIONS=[]; // [{from:1,migrate(data){...; return data;}}, ...]
function migrateStoryData(data){
  let v=num(data.schema_version,1);
  while(v<STORY_SCHEMA_VERSION){
    const m=STORY_SCHEMA_MIGRATIONS.find(x=>x.from===v);
    if(!m) break; // старше, чем мы умеем мигрировать — оставляем как есть, дальше сработают обычные ||-фоллбэки
    data=m.migrate(data); v++;
  }
  data.schema_version=v;
  return data;
}
let lastLoadedSchemaVersion=null, lastLoadedSavedAt=''; // для панели «Обзор проекта» (§23) — что именно сейчас загружено

// Бэкапы храним НЕ одним файлом, а роллингом из STORY_BACKUP_SLOTS снимков (data/story.backup.01.json —
// самый свежий, .05 — самый старый) — раньше был один слот (data/story.backup.json), которого хватало на
// «отменить последнее сохранение», но не на «а что было пять сохранений назад». rotateStoryBackups сдвигает
// существующие снимки на один слот и кладёт новый в 01 — вызывается и перед обычным сохранением (бэкапится
// то, что СЕЙЧАС на диске, т.е. до этого сохранения), и перед слиянием идеи (07-idea-import.js — бэкапится
// то, что СЕЙЧАС в памяти, т.е. до слияния, отдельно от бэкапа-перед-сохранением: слияние само на диск не
// пишет, поэтому без этого его нельзя было бы отличить на диске от предыдущего сохранения).
const STORY_BACKUP_SLOTS=5;
function backupSlotPath(i){ return `data/story.backup.${String(i).padStart(2,'0')}.json`; }
async function rotateStoryBackups(snapshotObj){
  if(!projectDirHandle) return;
  for(let i=STORY_BACKUP_SLOTS;i>1;i--){
    const prev=await readJsonFromProject(backupSlotPath(i-1));
    if(prev) await writeFileToProject(backupSlotPath(i),JSON.stringify(prev,null,2));
  }
  await writeFileToProject(backupSlotPath(1),JSON.stringify(snapshotObj,null,2));
}
async function backupCurrentStateBeforeImport(){
  if(!projectDirHandle) return;
  try{ await rotateStoryBackups(collectStoryJSON()); }catch(e){ console.warn('Не удалось сделать бэкап перед импортом:',e); }
}

// Как readJsonFromProject (01-core-utils.js), но не проглатывает ошибку ПАРСИНГА — иначе «файла нет»
// (обычный первый запуск) и «файл есть, но повреждён» выглядят для вызывающего кода одинаково: null.
// Различие важно только для data/story.json — там «повреждён» должен вести к восстановлению из бэкапа,
// а не к молчаливому пустому графу (см. readStoryJsonWithRecovery/loadStoryFromProject ниже).
async function readStoryFileRaw(relPath){
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
  const f=await (await dir.getFileHandle(fileName)).getFile();
  return f.text();
}
async function readStoryJsonWithRecovery(relPath){
  if(!projectDirHandle) return {data:null,corrupted:false,recoveredFrom:''};
  let text;
  try{ text=await readStoryFileRaw(relPath); }
  catch(e){ return {data:null,corrupted:false,recoveredFrom:''}; } // файла нет вовсе — не ошибка, обычный первый запуск
  try{ return {data:JSON.parse(text),corrupted:false,recoveredFrom:''}; }
  catch(parseErr){
    // Файл есть, но не парсится — пробуем бэкапы от самого свежего; data/story.backup.json — старый
    // однослотовый формат (до этой группы), проверяем последним, чтобы не подменять свежий роллинг-бэкап.
    const slots=Array.from({length:STORY_BACKUP_SLOTS},(_,i)=>backupSlotPath(i+1)).concat(['data/story.backup.json']);
    for(const slot of slots){
      const d=await readJsonFromProject(slot);
      if(d&&Array.isArray(d.nodes)) return {data:d,corrupted:true,recoveredFrom:slot};
    }
    return {data:null,corrupted:true,recoveredFrom:''};
  }
}

function collectStoryJSON(){
  return {
    schema_version:STORY_SCHEMA_VERSION,
    saved_at:new Date().toISOString(),
    variables:variables.map(v=>({id:v.id,name:v.name,type:v.type,start:num(v.start),min:num(v.min),max:num(v.max,undefined)})),
    nodes:nodes.map(n=>({
      id:n.id,title:n.title,text:n.text,type:n.type,category:n.category||'story',tags:n.tags||[],samSystem:n.samSystem||'',
      arc:n.arc||'',chapter:n.chapter||'',eventSource:n.eventSource||'',
      actionRef:{action:(n.actionRef&&n.actionRef.action)||'',target:(n.actionRef&&n.actionRef.target)||''},
      implementationStatus:Object.assign({},n.implementationStatus),
      refs:n.refs||[],
      x:num(n.x),y:num(n.y),
      trigger:n.trigger,effects:n.effects,sim:n.sim,
      choices:n.choices.map(c=>({id:c.id,label:c.label,target:c.target,requires:c.requires,effects:c.effects,sim:c.sim||{}})),
      ending:n.ending||''
    })),
    stickyNotes:stickyNotes.map(s=>({id:s.id,x:num(s.x),y:num(s.y),text:s.text||'',color:s.color||STICKY_COLORS[0]})),
    entities:entities.map(e=>({id:e.id,kind:e.kind,name:e.name||'',ref:e.ref?{catalog:e.ref.catalog,refId:e.ref.refId||''}:null,note:e.note||'',status:e.status||'active',lifecycle:e.lifecycle||''})),
    relationTypes:relationTypes.map(t=>({id:t.id,name:t.name,inverseName:t.inverseName||'',symmetric:!!t.symmetric})),
    relations:relations.map(r=>({id:r.id,type:r.type,from:r.from,to:r.to,status:r.status||'confirmed',source:r.source||'',comment:r.comment||'',conditions:r.conditions||[],effects:r.effects||[]})),
    proposals:proposals.map(p=>({id:p.id,title:p.title,text:p.text||'',status:p.status||'idea',priority:p.priority||'normal',source:p.source||'',createdAt:p.createdAt||'',relatedEntities:p.relatedEntities||[],relatedSystems:p.relatedSystems||[],relatedNodes:p.relatedNodes||[]})),
    worldEvents:worldEvents.map(ev=>({id:ev.id,title:ev.title||'',actor:ev.actor||'',action:ev.action||'',target:ev.target||'',resultLifecycle:ev.resultLifecycle||'',effects:ev.effects||[],comment:ev.comment||''}))
  };
}
// Разбор старого свободного текста ("предмет1, предмет2") в массив — ничего не теряем при переходе
// со старого формата sim.requiresItems/requiresSkills (строка) на новый (массив id).
function coerceStringList(v){
  if(Array.isArray(v)) return v;
  if(typeof v==='string') return v.split(',').map(s=>s.trim()).filter(Boolean);
  return [];
}
async function saveStoryToProject(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  try{
    // Перед перезаписью — снимок ТЕКУЩЕГО содержимого файла (как он есть на диске прямо сейчас, ДО
    // этого сохранения) в роллинг-бэкап (§23, STORY_BACKUP_SLOTS выше) — на первом сохранении файла
    // ещё нет, тогда бэкапить нечего. Сама запись каждого файла атомарна "бесплатно": File System
    // Access API пишет во временный файл и подменяет им целевой только при закрытии потока, так что
    // сбой посреди записи не может оставить сюжет наполовину переписанным.
    const previous=await readJsonFromProject('data/story.json');
    if(previous) await rotateStoryBackups(previous);
    await writeFileToProject('data/story.json',JSON.stringify(collectStoryJSON(),null,2));
    setFolderStatus('Сохранено в data/story.json · '+new Date().toLocaleTimeString());
    markClean();
  }catch(e){ console.error(e); alert('Не удалось сохранить: '+e.message); }
}
async function loadStoryFromProject(){
  const rec=await readStoryJsonWithRecovery('data/story.json');
  if(rec.corrupted){
    alert(rec.recoveredFrom
      ? `data/story.json повреждён (не читается как JSON) — граф восстановлен из бэкапа «${rec.recoveredFrom}». Пересохрани (Ctrl+S), чтобы зафиксировать восстановленную версию поверх повреждённого файла.`
      : 'data/story.json повреждён (не читается как JSON), и ни один бэкап не читается тоже — граф будет пустым. Проверь файлы в data/ вручную, автоматика здесь бессильна.');
  }
  const data=rec.data?migrateStoryData(rec.data):null;
  lastLoadedSchemaVersion=data?data.schema_version:null;
  lastLoadedSavedAt=data?(data.saved_at||''):'';
  if(data&&Array.isArray(data.nodes)){
    variables=Array.isArray(data.variables)?data.variables:[];
    nodes=data.nodes.map(n=>{
      const sim=Object.assign(defaultSim(),n.sim||{});
      sim.requiresItems=coerceStringList(sim.requiresItems);
      sim.requiresSkills=coerceStringList(sim.requiresSkills);
      sim.resourceEffects=Array.isArray(sim.resourceEffects)?sim.resourceEffects:[];
      return {
        id:n.id,title:n.title||'',text:n.text||'',type:n.type||'event',
        category:n.category||'story',tags:Array.isArray(n.tags)?n.tags:[],samSystem:n.samSystem||'',
        arc:n.arc||'',chapter:n.chapter||'',eventSource:n.eventSource||'',
        actionRef:{action:(n.actionRef&&n.actionRef.action)||'',target:(n.actionRef&&n.actionRef.target)||''},
        implementationStatus:(n.implementationStatus&&typeof n.implementationStatus==='object')?Object.assign({},n.implementationStatus):{},
        refs:Array.isArray(n.refs)?n.refs:[],
        x:num(n.x,120),y:num(n.y,120),
        trigger:n.trigger||{kind:'conditions',all:[]},
        effects:Array.isArray(n.effects)?n.effects:[],
        sim,
        choices:Array.isArray(n.choices)?n.choices.map(c=>({id:c.id||uid('c'),label:c.label||'',target:c.target||'',requires:Array.isArray(c.requires)?c.requires:[],effects:Array.isArray(c.effects)?c.effects:[],sim:c.sim||{}})):[],
        ending:n.ending||''
      };
    });
    stickyNotes=Array.isArray(data.stickyNotes)?data.stickyNotes.map(s=>({id:s.id||uid('note'),x:num(s.x,0),y:num(s.y,0),text:s.text||'',color:STICKY_COLORS.includes(s.color)?s.color:STICKY_COLORS[0]})):[];
    entities=Array.isArray(data.entities)?data.entities.map(e=>({id:e.id||uid('e'),kind:e.kind||'concept',name:e.name||'',ref:e.ref?{catalog:e.ref.catalog||'',refId:e.ref.refId||''}:null,note:e.note||'',status:e.status==='deprecated'?'deprecated':'active',lifecycle:e.lifecycle||''})):[];
    relationTypes=Array.isArray(data.relationTypes)?data.relationTypes.map(t=>({id:t.id||uid('rt'),name:t.name||'',inverseName:t.inverseName||'',symmetric:!!t.symmetric})):[];
    seedRelationTypesIfEmpty();
    relations=Array.isArray(data.relations)?data.relations.map(r=>({id:r.id||uid('rel'),type:r.type||'',from:r.from||'',to:r.to||'',status:r.status||'confirmed',source:r.source||'',comment:r.comment||'',conditions:Array.isArray(r.conditions)?r.conditions:[],effects:Array.isArray(r.effects)?r.effects:[]})):[];
    proposals=Array.isArray(data.proposals)?data.proposals.map(p=>({id:p.id||uid('pr'),title:p.title||'',text:p.text||'',status:p.status||'idea',priority:p.priority||'normal',source:p.source||'',createdAt:p.createdAt||'',relatedEntities:Array.isArray(p.relatedEntities)?p.relatedEntities:[],relatedSystems:Array.isArray(p.relatedSystems)?p.relatedSystems:[],relatedNodes:Array.isArray(p.relatedNodes)?p.relatedNodes:[]})):[];
    worldEvents=Array.isArray(data.worldEvents)?data.worldEvents.map(ev=>({id:ev.id||uid('we'),title:ev.title||'',actor:ev.actor||'',action:ev.action||'',target:ev.target||'',resultLifecycle:ev.resultLifecycle||'',effects:Array.isArray(ev.effects)?ev.effects:[],comment:ev.comment||''})):[];
  }
  selectedNodeId=null; selectedEntityId=null; selectedRelationId=null; selectedProposalId=null; selectedWorldEventId=null;
  resetHistory();
  markClean();
  // Object Plan's own статус реализации (data/object_plan.json, §21/§22) — read-only best-effort:
  // тот же connect-flow, что и у story.json, но ошибка/отсутствие файла не должны мешать загрузке
  // самого сюжета (readJsonFromProject уже сама возвращает null на любую ошибку).
  if(typeof loadObjectPlanStatus==='function') await loadObjectPlanStatus();
  renderAll();
}
