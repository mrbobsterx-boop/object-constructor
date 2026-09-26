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
let pan={x:60,y:60}, zoom=1;

function defaultSim(){ return {durationHours:1,dangerChance:0,foodCost:0,waterCost:0,requiresItems:'',requiresSkills:''}; }
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
    text:'',type:type||'event',
    x:x!==undefined?x:120+Math.random()*40, y:y!==undefined?y:120+Math.random()*40,
    trigger:isFirst?{kind:'start'}:defaultTrigger(type),
    effects:[], sim:defaultSim(), choices:[], ending:''
  };
  nodes.push(n);
  selectedNodeId=n.id;
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
  pushHistory(); renderAll();
}
function selectNode(id){ selectedNodeId=id; renderAll(); }

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
let history=[], historyIndex=-1;
function snapshot(){ return JSON.stringify({variables,nodes,selectedNodeId}); }
function restoreSnapshot(s){
  const d=JSON.parse(s);
  variables=d.variables; nodes=d.nodes; selectedNodeId=d.selectedNodeId;
}
function pushHistory(){
  history=history.slice(0,historyIndex+1);
  history.push(snapshot());
  historyIndex=history.length-1;
  if(history.length>200){ history.shift(); historyIndex--; }
}
function undo(){ if(historyIndex<=0) return; historyIndex--; restoreSnapshot(history[historyIndex]); renderAll(); }
function redo(){ if(historyIndex>=history.length-1) return; historyIndex++; restoreSnapshot(history[historyIndex]); renderAll(); }
function resetHistory(){ history=[snapshot()]; historyIndex=0; }

function renderAll(){ renderLeft(); renderCanvas(); renderInspector(); renderChecks(); }
