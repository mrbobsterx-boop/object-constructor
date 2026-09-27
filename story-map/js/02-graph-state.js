/* ============================================================
   MODULE 02 — СОСТОЯНИЕ ГРАФА (переменные, узлы, выбор, отмена/возврат)
   variables — авторский список мировых переменных (id/name/type/start/min/max), по духу как
   CATEGORIES/SYSTEMS в Object Plan. nodes — узлы сюжета: у каждого свой trigger (когда доступен),
   effects (что меняет при срабатывании), sim (параметры для бота-симулятора) и choices (переходы —
   у каждого свои requires/effects/sim, можно переопределить узловые). Всё — простые данные (JSON-clone
   годится для истории отмены), Set/Map тут не нужны.
   ============================================================ */

let variables=[];
let nodes=[];
let stickyNotes=[]; // заметки-стикеры на холсте — чисто авторские пометки, не часть сюжетного графа
  // (не видны боту, не участвуют в проверках): "как в Miro", комментарий к месту, а не к узлу
let selectedNodeId=null;
let multiSelected=new Set(); // всегда синхронизирован с selectedNodeId для одиночного выбора — это цель для групповых операций
let clipboard=null;
let pan={x:60,y:60}, zoom=1;

// resourceEffects — обобщение foodCost/waterCost на ЛЮБОЙ ресурс из Object Plan (топливо, энергия,
// металлолом/лом — os.resourceType на предметах-контейнерах, §21), а не только на еду/воду, которые
// были захардкожены изначально. foodCost/waterCost остаются как есть (уже используются, ломать
// незачем) — resourceEffects просто покрывает всё остальное тем же принципом {resourceType,op,value},
// что и обычные effects на переменные.
function defaultSim(){ return {durationHours:1,dangerChance:0,foodCost:0,waterCost:0,requiresItems:[],requiresSkills:[],resourceEffects:[]}; }
function defaultTrigger(type){
  if(type==='background') return {kind:'scheduled',afterHours:24,sinceNode:'',repeat:false};
  return {kind:'conditions',all:[]};
}

function findNode(id){ return nodes.find(n=>n.id===id); }
function findVariable(id){ return variables.find(v=>v.id===id); }

function addVariable(){
  if(blockIfReadOnly()) return;
  const v={id:uid('v'),name:'Новая переменная',type:'counter',start:0,min:0,max:100};
  variables.push(v);
  pushHistory(); renderAll();
  return v;
}
function updateVariable(id,patch){
  if(blockIfReadOnly()) return;
  const v=findVariable(id); if(!v) return;
  Object.assign(v,patch);
  pushHistory(); renderAll();
}
function deleteVariable(id){
  if(blockIfReadOnly()) return;
  variables=variables.filter(v=>v.id!==id);
  pushHistory(); renderAll();
}

// Без явных координат (кнопки "+ Событие/Выбор/Фоновое" в левой панели, а не перетаскивание
// соединения на пустое место — там x,y уже переданы) новый узел ставится СПРАВА от текущего узла
// (выбранного, а если выбора нет — последнего добавленного), а не в фиксированную точку канваса —
// иначе при накоплении узлов они садятся друг на друга в одном месте (что вдобавок ломает попадание
// мышью при последующем соединении: см. targetBox в 03-canvas.js). Раз новый узел сам становится
// выбранным (см. ниже), повторные клики выстраиваются цепочкой вправо, а не грудой на одном месте.
function nextNodeSpawnPos(){
  const anchor=findNode(selectedNodeId)||nodes[nodes.length-1];
  if(!anchor) return {x:120,y:120};
  return {x:anchor.x+NODE_W+60,y:anchor.y};
}
function addNode(type,x,y){
  if(blockIfReadOnly()) return;
  const isFirst=nodes.length===0;
  const pos=(x===undefined||y===undefined)?nextNodeSpawnPos():{x,y};
  const n={
    id:uid('n'),title:type==='background'?'Новое фоновое событие':(type==='choice'?'Новый выбор':'Новое событие'),
    text:'',type:type||'event',category:'story',tags:[],samSystem:'',refs:[],
    actionRef:{action:'',target:''},implementationStatus:{},
    x:pos.x, y:pos.y,
    trigger:isFirst?{kind:'start'}:defaultTrigger(type),
    effects:[], sim:defaultSim(), choices:[], ending:''
  };
  nodes.push(n);
  selectedNodeId=n.id; multiSelected=new Set([n.id]);
  pushHistory(); renderAll();
  return n;
}
function updateNode(id,patch){
  if(blockIfReadOnly()) return;
  const n=findNode(id); if(!n) return;
  Object.assign(n,patch);
  pushHistory(); renderAll();
}
function moveNode(id,x,y){
  if(readOnlyMode) return;
  const n=findNode(id); if(!n) return;
  n.x=x; n.y=y;
  renderCanvas(); // движение мышкой не должно засорять историю на каждый пиксель
}
function commitMove(){ if(readOnlyMode) return; pushHistory(); }
function deleteNode(id){
  if(blockIfReadOnly()) return;
  nodes=nodes.filter(n=>n.id!==id);
  nodes.forEach(n=>{ n.choices=n.choices.filter(c=>c.target!==id); });
  if(typeof proposals!=='undefined') proposals.forEach(p=>{ if(Array.isArray(p.relatedNodes)) p.relatedNodes=p.relatedNodes.filter(x=>x!==id); });
  if(selectedNodeId===id) selectedNodeId=null;
  multiSelected.delete(id);
  pushHistory(); renderAll();
}
function selectNode(id){ selectedNodeId=id; multiSelected=id?new Set([id]):new Set(); renderAll(); }
function toggleMultiSelect(id){
  if(multiSelected.has(id)) multiSelected.delete(id); else multiSelected.add(id);
  selectedNodeId=multiSelected.size===1?[...multiSelected][0]:null;
  renderAll();
}
function selectAll(){
  if(!nodes.length) return;
  multiSelected=new Set(nodes.map(n=>n.id));
  selectedNodeId=multiSelected.size===1?[...multiSelected][0]:null;
  renderAll();
}
function clearSelection(){ selectedNodeId=null; multiSelected=new Set(); renderAll(); }
function deleteSelectedNodes(){
  if(blockIfReadOnly()) return;
  const ids=multiSelected.size?new Set(multiSelected):(selectedNodeId?new Set([selectedNodeId]):new Set());
  if(!ids.size) return;
  if(!confirm(ids.size>1?`Удалить ${ids.size} узлов? Ссылки на них из других переходов тоже уберутся.`:'Удалить узел? Ссылки на него из других переходов тоже уберутся.')) return;
  nodes=nodes.filter(n=>!ids.has(n.id));
  nodes.forEach(n=>{ n.choices=n.choices.filter(c=>!ids.has(c.target)); });
  if(ids.has(selectedNodeId)) selectedNodeId=null;
  multiSelected=new Set();
  pushHistory(); renderAll();
}
// Копирует выделенные узлы; переходы, ведущие ЗА пределы скопированного набора, при вставке
// отбрасываются (вставленная копия не должна тайно тянуть невидимые нити к оригиналу) — переходы
// между узлами ВНУТРИ набора сохраняются и переиндексируются на новые id.
function copySelection(){
  const ids=multiSelected.size?multiSelected:(selectedNodeId?new Set([selectedNodeId]):new Set());
  if(!ids.size) return;
  clipboard=[...ids].map(id=>JSON.parse(JSON.stringify(findNode(id)))).filter(Boolean);
}
function pasteClipboard(){
  if(blockIfReadOnly()) return;
  if(!clipboard||!clipboard.length) return;
  const idMap={};
  clipboard.forEach(n=>{ idMap[n.id]=uid('n'); });
  const pasted=clipboard.map(n=>({
    ...n,
    id:idMap[n.id],
    x:n.x+40,y:n.y+40,
    trigger:n.trigger.kind==='start'?{kind:'conditions',all:[]}:n.trigger,
    choices:n.choices.filter(c=>idMap[c.target]).map(c=>({...c,id:uid('c'),target:idMap[c.target]}))
  }));
  nodes.push(...pasted);
  multiSelected=new Set(pasted.map(n=>n.id));
  selectedNodeId=pasted.length===1?pasted[0].id:null;
  pushHistory(); renderAll();
}

function addChoice(nodeId,targetId){
  if(blockIfReadOnly()) return;
  const n=findNode(nodeId); if(!n) return;
  n.choices.push({id:uid('c'),label:'Вариант',target:targetId||'',requires:[],effects:[],sim:{}});
  pushHistory(); renderAll();
}
function updateChoice(nodeId,choiceId,patch){
  if(blockIfReadOnly()) return;
  const n=findNode(nodeId); if(!n) return;
  const c=n.choices.find(x=>x.id===choiceId); if(!c) return;
  Object.assign(c,patch);
  pushHistory(); renderAll();
}
function deleteChoice(nodeId,choiceId){
  if(blockIfReadOnly()) return;
  const n=findNode(nodeId); if(!n) return;
  n.choices=n.choices.filter(c=>c.id!==choiceId);
  pushHistory(); renderAll();
}

const STICKY_COLORS=['yellow','pink','blue','green'];
function addStickyNote(x,y){
  if(blockIfReadOnly()) return;
  const n={id:uid('note'),x:num(x,0),y:num(y,0),text:'',color:STICKY_COLORS[0]};
  stickyNotes.push(n);
  pushHistory(); renderAll();
  return n;
}
function updateStickyNote(id,patch){
  if(blockIfReadOnly()) return;
  const n=stickyNotes.find(s=>s.id===id); if(!n) return;
  Object.assign(n,patch);
  pushHistory(); renderAll();
}
function moveStickyNote(id,x,y){
  if(readOnlyMode) return;
  const n=stickyNotes.find(s=>s.id===id); if(!n) return;
  n.x=x; n.y=y;
  renderCanvas(); // как moveNode — перетаскивание не должно засорять историю на каждый пиксель
}
function commitStickyMove(){ if(readOnlyMode) return; pushHistory(); }
function deleteStickyNote(id){
  if(blockIfReadOnly()) return;
  stickyNotes=stickyNotes.filter(s=>s.id!==id);
  pushHistory(); renderAll();
}

function addCondRow(list){ if(blockIfReadOnly()) return; list.push({var:(variables[0]&&variables[0].id)||'',op:'>=',value:0}); }
function addEffRow(list){ if(blockIfReadOnly()) return; list.push({var:(variables[0]&&variables[0].id)||'',op:'add',value:0}); }
// getResourceTypes() определена позже (09-world-model.js, читает PLAN_ITEMS Object Plan) — вызывается
// только из обработчика клика после полной загрузки страницы, поэтому порядок файлов не важен (см.
// договорённость о классических скриптах в начале документации).
function addResourceFxRow(list){ if(blockIfReadOnly()) return; const types=(typeof getResourceTypes==='function'?getResourceTypes():[]); list.push({resourceType:(types[0]&&types[0].id)||'',op:'add',value:0}); }

/* ---------- групповые действия (выделено несколько узлов) и переименование тега/раздела по всему графу ---------- */
function bulkAddTagToSelected(tag){
  if(blockIfReadOnly()) return;
  tag=(tag||'').trim(); if(!tag||!multiSelected.size) return;
  multiSelected.forEach(id=>{ const n=findNode(id); if(n&&!n.tags.includes(tag)) n.tags.push(tag); });
  pushHistory(); renderAll();
}
function bulkSetCategoryForSelected(cat){
  if(blockIfReadOnly()) return;
  if(!cat||!multiSelected.size) return;
  multiSelected.forEach(id=>{ const n=findNode(id); if(n) n.category=cat; });
  pushHistory(); renderAll();
}
// Переименование тега/раздела СРАЗУ во всём графе (не только у выделенных) — напр. заменить "raider"
// на "raiders" везде разом, вместо того чтобы искать и править каждый узел вручную.
function renameTagEverywhere(from,to){
  if(blockIfReadOnly()) return 0;
  from=(from||'').trim(); to=(to||'').trim();
  if(!from||!to||from===to) return 0;
  let count=0;
  nodes.forEach(n=>{
    const i=n.tags.indexOf(from);
    if(i>=0){ if(n.tags.includes(to)) n.tags.splice(i,1); else n.tags[i]=to; count++; }
    if(n.category===from){ n.category=to; count++; }
  });
  if(count){ pushHistory(); renderAll(); }
  return count;
}

/* ---------- история ---------- */
let dirty=false;
function markDirty(){ dirty=true; if(typeof renderDirtyStatus==='function') renderDirtyStatus(); }
function markClean(){ dirty=false; if(typeof renderDirtyStatus==='function') renderDirtyStatus(); }

let history=[], historyIndex=-1;
// entities/relationTypes/relations/proposals — слой мира (модуль 09), но переиспользуют ту же
// историю отмены/возврата, что и сюжетный граф: пользователю не нужны два разных Ctrl+Z.
function snapshot(){ return JSON.stringify({variables,nodes,selectedNodeId,entities,relationTypes,relations,proposals,selectedEntityId,stickyNotes}); }
function restoreSnapshot(s){
  const d=JSON.parse(s);
  variables=d.variables; nodes=d.nodes; selectedNodeId=d.selectedNodeId;
  entities=d.entities||[]; relationTypes=d.relationTypes||[]; relations=d.relations||[]; proposals=d.proposals||[];
  selectedEntityId=d.selectedEntityId||null;
  stickyNotes=d.stickyNotes||[];
}
function pushHistory(){
  history=history.slice(0,historyIndex+1);
  history.push(snapshot());
  historyIndex=history.length-1;
  if(history.length>200){ history.shift(); historyIndex--; }
  markDirty();
}
function undo(){ if(historyIndex<=0) return; historyIndex--; restoreSnapshot(history[historyIndex]); markDirty(); renderAll(); }
function redo(){ if(historyIndex>=history.length-1) return; historyIndex++; restoreSnapshot(history[historyIndex]); markDirty(); renderAll(); }
function resetHistory(){ history=[snapshot()]; historyIndex=0; }

function renderAll(){
  renderLeft(); renderCanvas(); renderChecks();
  if(typeof renderWorldLeft==='function') renderWorldLeft();
  if(typeof renderWorldCanvas==='function') renderWorldCanvas();
  if(typeof renderTimeline==='function') renderTimeline();
  if(typeof viewMode!=='undefined'&&viewMode==='world'&&typeof renderWorldInspector==='function') renderWorldInspector();
  else if(typeof viewMode!=='undefined'&&viewMode==='timeline'){ const el=document.getElementById('inspector'); if(el) el.innerHTML='<div class="hint">Клик по узлу на хронологии переключит на «Сюжет» и откроет его здесь.</div>'; }
  else renderInspector();
}
