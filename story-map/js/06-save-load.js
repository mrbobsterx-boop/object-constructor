/* ============================================================
   MODULE 06 — ЧТЕНИЕ/ЗАПИСЬ data/story.json
   Единственный файл, который пишет это приложение. Читают его story-bot (симулятор) и в будущем —
   код игры/ИИ.
   ============================================================ */

function collectStoryJSON(){
  return {
    schema_version:1,
    saved_at:new Date().toISOString(),
    variables:variables.map(v=>({id:v.id,name:v.name,type:v.type,start:num(v.start),min:num(v.min),max:num(v.max,undefined)})),
    nodes:nodes.map(n=>({
      id:n.id,title:n.title,text:n.text,type:n.type,category:n.category||'story',tags:n.tags||[],samSystem:n.samSystem||'',
      x:num(n.x),y:num(n.y),
      trigger:n.trigger,effects:n.effects,sim:n.sim,
      choices:n.choices.map(c=>({id:c.id,label:c.label,target:c.target,requires:c.requires,effects:c.effects,sim:c.sim||{}})),
      ending:n.ending||''
    })),
    stickyNotes:stickyNotes.map(s=>({id:s.id,x:num(s.x),y:num(s.y),text:s.text||'',color:s.color||STICKY_COLORS[0]})),
    entities:entities.map(e=>({id:e.id,kind:e.kind,name:e.name||'',ref:e.ref?{catalog:e.ref.catalog,refId:e.ref.refId||''}:null,note:e.note||''})),
    relationTypes:relationTypes.map(t=>({id:t.id,name:t.name})),
    relations:relations.map(r=>({id:r.id,type:r.type,from:r.from,to:r.to,status:r.status||'confirmed',source:r.source||'',comment:r.comment||'',conditions:r.conditions||[],effects:r.effects||[]})),
    proposals:proposals.map(p=>({id:p.id,title:p.title,text:p.text||'',status:p.status||'idea',relatedEntities:p.relatedEntities||[],relatedSystems:p.relatedSystems||[]}))
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
    // Перед перезаписью — снимок ТЕКУЩЕГО содержимого файла (как он есть на диске прямо сейчас,
    // ДО этого сохранения) в data/story.backup.json. Один "прошлый снимок" за раз (не журнал версий),
    // но этого достаточно, чтобы случайное сохранение поверх нужных данных не было необратимым —
    // на первом сохранении файла ещё нет, тогда бэкапить нечего. Сама запись каждого файла атомарна
    // "бесплатно": File System Access API пишет во временный файл и подменяет им целевой только при
    // закрытии потока, так что сбой посреди записи не может оставить сюжет наполовину переписанным.
    const previous=await readJsonFromProject('data/story.json');
    if(previous) await writeFileToProject('data/story.backup.json',JSON.stringify(previous,null,2));
    await writeFileToProject('data/story.json',JSON.stringify(collectStoryJSON(),null,2));
    setFolderStatus('Сохранено в data/story.json · '+new Date().toLocaleTimeString());
    markClean();
  }catch(e){ console.error(e); alert('Не удалось сохранить: '+e.message); }
}
async function loadStoryFromProject(){
  const data=await readJsonFromProject('data/story.json');
  if(data&&Array.isArray(data.nodes)){
    variables=Array.isArray(data.variables)?data.variables:[];
    nodes=data.nodes.map(n=>{
      const sim=Object.assign(defaultSim(),n.sim||{});
      sim.requiresItems=coerceStringList(sim.requiresItems);
      sim.requiresSkills=coerceStringList(sim.requiresSkills);
      return {
        id:n.id,title:n.title||'',text:n.text||'',type:n.type||'event',
        category:n.category||'story',tags:Array.isArray(n.tags)?n.tags:[],samSystem:n.samSystem||'',
        x:num(n.x,120),y:num(n.y,120),
        trigger:n.trigger||{kind:'conditions',all:[]},
        effects:Array.isArray(n.effects)?n.effects:[],
        sim,
        choices:Array.isArray(n.choices)?n.choices.map(c=>({id:c.id||uid('c'),label:c.label||'',target:c.target||'',requires:Array.isArray(c.requires)?c.requires:[],effects:Array.isArray(c.effects)?c.effects:[],sim:c.sim||{}})):[],
        ending:n.ending||''
      };
    });
    stickyNotes=Array.isArray(data.stickyNotes)?data.stickyNotes.map(s=>({id:s.id||uid('note'),x:num(s.x,0),y:num(s.y,0),text:s.text||'',color:STICKY_COLORS.includes(s.color)?s.color:STICKY_COLORS[0]})):[];
    entities=Array.isArray(data.entities)?data.entities.map(e=>({id:e.id||uid('e'),kind:e.kind||'concept',name:e.name||'',ref:e.ref?{catalog:e.ref.catalog||'',refId:e.ref.refId||''}:null,note:e.note||''})):[];
    relationTypes=Array.isArray(data.relationTypes)?data.relationTypes.map(t=>({id:t.id||uid('rt'),name:t.name||''})):[];
    seedRelationTypesIfEmpty();
    relations=Array.isArray(data.relations)?data.relations.map(r=>({id:r.id||uid('rel'),type:r.type||'',from:r.from||'',to:r.to||'',status:r.status||'confirmed',source:r.source||'',comment:r.comment||'',conditions:Array.isArray(r.conditions)?r.conditions:[],effects:Array.isArray(r.effects)?r.effects:[]})):[];
    proposals=Array.isArray(data.proposals)?data.proposals.map(p=>({id:p.id||uid('pr'),title:p.title||'',text:p.text||'',status:p.status||'idea',relatedEntities:Array.isArray(p.relatedEntities)?p.relatedEntities:[],relatedSystems:Array.isArray(p.relatedSystems)?p.relatedSystems:[]})):[];
  }
  selectedNodeId=null; selectedEntityId=null; selectedRelationId=null;
  resetHistory();
  markClean();
  renderAll();
}
