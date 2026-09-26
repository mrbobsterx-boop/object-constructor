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
    }))
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
    await writeFileToProject('data/story.json',JSON.stringify(collectStoryJSON(),null,2));
    setFolderStatus('Сохранено в data/story.json · '+new Date().toLocaleTimeString());
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
  }
  selectedNodeId=null;
  resetHistory();
  renderAll();
}
