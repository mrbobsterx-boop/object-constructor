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
let selectedNodeId=null;
let multiSelected=new Set(); // всегда синхронизирован с selectedNodeId для одиночного выбора — это цель для групповых операций
let clipboard=null;
let pan={x:60,y:60}, zoom=1;

function defaultSim(){ return {durationHours:1,dangerChance:0,foodCost:0,waterCost:0,requiresItems:[],requiresSkills:[]}; }
function defaultTrigger(type){
  if(type==='background') return {kind:'scheduled',afterHours:24,sinceNode:'',repeat:false};
  return {kind:'conditions',all:[]};
}

function findNode(id){ return nodes.find(n=>n.id===id); }
function findVariable(id){ return variables.find(v=>v.id===id); }

function addVariable(){
  const v={id:uid('v'),name:'Новая переменная',type:'counter',start:0,min:0,max:100};
  variables.push(v);
  pushHistory(); renderAll();
  return v;
}
function updateVariable(id,patch){
  const v=findVariable(id); if(!v) return;
  Object.assign(v,patch);
  pushHistory(); renderAll();
}
function deleteVariable(id){
  variables=variables.filter(v=>v.id!==id);
  pushHistory(); renderAll();
}

function addNode(type,x,y){
  const isFirst=nodes.length===0;
  const n={
    id:uid('n'),title:type==='background'?'Новое фоновое событие':(type==='choice'?'Новый выбор':'Новое событие'),
    text:'',type:type||'event',category:'story',tags:[],samSystem:'',
    x:x!==undefined?x:120+Math.random()*40, y:y!==undefined?y:120+Math.random()*40,
    trigger:isFirst?{kind:'start'}:defaultTrigger(type),
    effects:[], sim:defaultSim(), choices:[], ending:''
  };
  nodes.push(n);
  selectedNodeId=n.id; multiSelected=new Set([n.id]);
  pushHistory(); renderAll();
  return n;
}
function updateNode(id,patch){
  const n=findNode(id); if(!n) return;
  Object.assign(n,patch);
  pushHistory(); renderAll();
}
function moveNode(id,x,y){
  const n=findNode(id); if(!n) return;
  n.x=x; n.y=y;
  renderCanvas(); // движение мышкой не должно засорять историю на каждый пиксель
}
function commitMove(){ pushHistory(); }
function deleteNode(id){
  nodes=nodes.filter(n=>n.id!==id);
  nodes.forEach(n=>{ n.choices=n.choices.filter(c=>c.target!==id); });
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
  const n=findNode(nodeId); if(!n) return;
  n.choices.push({id:uid('c'),label:'Вариант',target:targetId||'',requires:[],effects:[],sim:{}});
  pushHistory(); renderAll();
}
function updateChoice(nodeId,choiceId,patch){
  const n=findNode(nodeId); if(!n) return;
  const c=n.choices.find(x=>x.id===choiceId); if(!c) return;
  Object.assign(c,patch);
  pushHistory(); renderAll();
}
function deleteChoice(nodeId,choiceId){
  const n=findNode(nodeId); if(!n) return;
  n.choices=n.choices.filter(c=>c.id!==choiceId);
  pushHistory(); renderAll();
}

function addCondRow(list){ list.push({var:(variables[0]&&variables[0].id)||'',op:'>=',value:0}); }
function addEffRow(list){ list.push({var:(variables[0]&&variables[0].id)||'',op:'add',value:0}); }

/* ---------- история ---------- */
let dirty=false;
function markDirty(){ dirty=true; if(typeof renderDirtyStatus==='function') renderDirtyStatus(); }
function markClean(){ dirty=false; if(typeof renderDirtyStatus==='function') renderDirtyStatus(); }

let history=[], historyIndex=-1;
// entities/relationTypes/relations/proposals — слой мира (модуль 09), но переиспользуют ту же
// историю отмены/возврата, что и сюжетный граф: пользователю не нужны два разных Ctrl+Z.
function snapshot(){ return JSON.stringify({variables,nodes,selectedNodeId,entities,relationTypes,relations,proposals,selectedEntityId}); }
function restoreSnapshot(s){
  const d=JSON.parse(s);
  variables=d.variables; nodes=d.nodes; selectedNodeId=d.selectedNodeId;
  entities=d.entities||[]; relationTypes=d.relationTypes||[]; relations=d.relations||[]; proposals=d.proposals||[];
  selectedEntityId=d.selectedEntityId||null;
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
  if(typeof viewMode!=='undefined'&&viewMode==='world'&&typeof renderWorldInspector==='function') renderWorldInspector();
  else renderInspector();
}
