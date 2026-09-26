/* ============================================================
   MODULE 07 — ИМПОРТ ИДЕЙ (универсальный JSON-шаблон)
   Одна идея — самостоятельный кусок сюжета: свои узлы (с локальными "ref" вместо настоящих id),
   свои новые переменные и явные "links" — с какими УЖЕ существующими узлами (по разделу/тегу)
   его новые узлы должны связаться. Импорт только ДОБАВЛЯЕТ: существующие переменные по тому же id
   не трогает, узлы не удаляет, "links" всегда ищутся по ТЕКУЩЕМУ (уже пополненному) списку узлов —
   поэтому вторая импортированная идея сама подключится к тому, что добавила первая, если у них
   совпадает раздел/тег. Это не "ИИ понимает смысл" — это детерминированное совпадение по тому,
   что сам автор идеи указал в match_category/match_tag.
   ============================================================ */

let ideaLog=[];

function nextIdeaY(){ return nodes.length?Math.max(...nodes.map(n=>n.y))+150:80; }

// Раскладка по «слоям»: глубина узла = длина кратчайшего пути от узла-корня бандла (без входящих
// target_ref внутри самого бандла) по target_ref-связям. Слева направо, по глубине — почти всегда
// вперёд, поэтому edgePath не приходится огибать петлёй большинство связей сразу после импорта.
function layoutIdeaEntries(entries){
  const idxByRef={};
  entries.forEach((e,i)=>{ if(e.ref) idxByRef[e.ref]=i; });
  const indeg=new Array(entries.length).fill(0);
  entries.forEach(e=>(e.choices||[]).forEach(c=>{
    if(c.target_ref&&idxByRef[c.target_ref]!==undefined) indeg[idxByRef[c.target_ref]]++;
  }));
  const depth=new Array(entries.length).fill(-1);
  const queue=[];
  entries.forEach((e,i)=>{ if(indeg[i]===0){ depth[i]=0; queue.push(i); } });
  let qi=0;
  while(qi<queue.length){
    const i=queue[qi++];
    (entries[i].choices||[]).forEach(c=>{
      const j=c.target_ref?idxByRef[c.target_ref]:undefined;
      if(j!==undefined&&depth[j]<depth[i]+1){ depth[j]=depth[i]+1; queue.push(j); }
    });
  }
  const colCount=[];
  return entries.map((e,i)=>{
    const d=depth[i]<0?0:depth[i];
    const row=colCount[d]=(colCount[d]||0);
    colCount[d]++;
    return {col:d,row};
  });
}

// Сопоставление "не дублировать": авторская сущность считается той же при совпадении kind+name
// (без учёта регистра), каталожная — при совпадении kind+ref.refId. mutate=false — для превью
// (analyzeIdea), mutate=true — для реального слияния (importIdea). entry.ref (если есть) — локальный
// id внутри бандла идеи, тот же приём, что и node.ref/target_ref у узлов.
function resolveOrCreateEntity(entry,refMap,mutate){
  const kind=entityKindDef(entry.kind);
  let existing=null;
  if(kind.catalog&&entry.refId) existing=entities.find(e=>e.kind===kind.id&&e.ref&&e.ref.refId===entry.refId);
  else if(!kind.catalog&&entry.name) existing=entities.find(e=>e.kind===kind.id&&(e.name||'').trim().toLowerCase()===entry.name.trim().toLowerCase());
  if(existing){ if(entry.ref) refMap[entry.ref]=existing.id; return {entity:existing,isNew:false}; }
  const e={id:uid('e'),kind:kind.id,name:kind.catalog?'':(entry.name||'Без имени'),ref:kind.catalog?{catalog:kind.catalog,refId:entry.refId||''}:null,note:entry.note||''};
  if(mutate) entities.push(e);
  if(entry.ref) refMap[entry.ref]=e.id;
  return {entity:e,isNew:true};
}

// Не мутирующий разбор — считает "что будет добавлено / что совпадёт с уже существующим", чтобы
// показать это пользователю ДО реального importIdea(). Логика сопоставления та же самая
// (resolveOrCreateEntity с mutate=false), поэтому цифры превью гарантированно совпадают с реальным
// слиянием — не отдельная, потенциально расходящаяся оценка "на глаз".
function analyzeIdea(data){
  data=data||{};
  const existingVarIds=new Set(variables.map(v=>v.id));
  const varList=data.variables||[];
  const newVarCount=varList.filter(v=>v&&v.id&&!existingVarIds.has(v.id)).length;

  const refMap={};
  let newEntityCount=0, existingEntityCount=0;
  (data.entities||[]).forEach(entry=>{
    const {isNew}=resolveOrCreateEntity(entry,refMap,false);
    if(isNew) newEntityCount++; else existingEntityCount++;
  });

  const existingTypeNames=new Set(relationTypes.map(t=>t.name));
  const typeNamesInBundle=new Set((data.relations||[]).map(r=>r&&r.type).filter(Boolean));
  const newRelationTypeNames=[...typeNamesInBundle].filter(n=>!existingTypeNames.has(n));

  return {
    title:data.title||data.idea_id||'(без названия)',
    nodeCount:Array.isArray(data.nodes)?data.nodes.length:0,
    newVarCount, existingVarCount:varList.length-newVarCount,
    newEntityCount, existingEntityCount,
    relationCount:Array.isArray(data.relations)?data.relations.length:0,
    newRelationTypeCount:newRelationTypeNames.length, newRelationTypeNames,
    proposalCount:Array.isArray(data.proposals)?data.proposals.length:0
  };
}

function importIdea(data){
  if(!data||!Array.isArray(data.nodes)) throw new Error('Файл не похож на шаблон идеи: нет массива "nodes".');
  const refMap={};
  const startY=nextIdeaY();
  const positions=layoutIdeaEntries(data.nodes);

  (data.variables||[]).forEach(v=>{
    if(v&&v.id&&!findVariable(v.id)) variables.push({id:v.id,name:v.name||v.id,type:v.type||'counter',start:num(v.start,0),min:num(v.min,0),max:num(v.max,100)});
  });

  data.nodes.forEach(entry=>{ if(entry.ref) refMap[entry.ref]=uid('n'); });
  const newNodes=data.nodes.map((entry,i)=>{
    const sim=Object.assign(defaultSim(),entry.sim||{});
    sim.requiresItems=coerceStringList(sim.requiresItems);
    sim.requiresSkills=coerceStringList(sim.requiresSkills);
    return {
      id:refMap[entry.ref]||uid('n'),
      title:entry.title||'(из идеи)',text:entry.text||'',
      type:entry.type||'event',category:entry.category||'story',tags:Array.isArray(entry.tags)?entry.tags:[],samSystem:entry.samSystem||'',
      x:120+positions[i].col*240,y:startY+positions[i].row*140,
      trigger:entry.trigger||{kind:'conditions',all:[]},
      effects:Array.isArray(entry.effects)?entry.effects:[],
      sim,
      choices:[],
      ending:entry.ending||''
    };
  });
  data.nodes.forEach((entry,i)=>{
    (entry.choices||[]).forEach(ch=>{
      const target=ch.target_ref?refMap[ch.target_ref]:ch.target;
      if(!target) return;
      newNodes[i].choices.push({id:uid('c'),label:ch.label||'',target,requires:Array.isArray(ch.requires)?ch.requires:[],effects:Array.isArray(ch.effects)?ch.effects:[],sim:ch.sim||{}});
    });
  });
  nodes.push(...newNodes);

  // Ограничение веера: по умолчанию "all" (все совпадения) — но с защитой от дублей (одна и та же
  // пара from→target не создаётся дважды, даже при повторном импорте того же файла) и жёстким
  // потолком LINK_FANOUT_CAP на один link — если тег общий для полусотни узлов, один импорт не
  // должен молча породить полсотни новых переходов. mode:"first" — только первое совпадение.
  const LINK_FANOUT_CAP=30;
  let linkCount=0;
  (data.links||[]).forEach(link=>{
    const fromId=link.from_ref?refMap[link.from_ref]:link.from;
    const from=findNode(fromId); if(!from) return;
    const mode=link.mode==='first'?'first':'all';
    const existingTargets=new Set(from.choices.map(c=>c.target));
    for(const target of nodes){
      if(target.id===from.id||existingTargets.has(target.id)) continue;
      const catMatch=link.match_category&&target.category===link.match_category;
      const tagMatch=link.match_tag&&(target.tags||[]).includes(link.match_tag);
      if(!catMatch&&!tagMatch) continue;
      from.choices.push({id:uid('c'),label:link.label||'(связано по тегу)',target:target.id,requires:[],effects:[],sim:{}});
      existingTargets.add(target.id);
      linkCount++;
      if(mode==='first') break;
      if(linkCount>=LINK_FANOUT_CAP){ console.warn('Story Map: авто-связей по "'+(link.match_tag||link.match_category)+'" больше '+LINK_FANOUT_CAP+', остальные пропущены — сузь тег или используй mode:"first".'); break; }
    }
  });

  // Сущности/связи/идеи-предложения — тот же принцип "только добавляем", что и у узлов/переменных:
  // resolveOrCreateEntity сам решает "это уже есть" vs "это новое" (см. analyzeIdea выше — числа
  // в превью и то, что реально будет добавлено здесь, посчитаны одной и той же функцией).
  const entityRefMap={};
  (data.entities||[]).forEach(entry=>{ resolveOrCreateEntity(entry,entityRefMap,true); });

  let addedRelationCount=0;
  (data.relations||[]).forEach(rel=>{
    if(!rel) return;
    let typeObj=relationTypes.find(t=>t.name===rel.type);
    if(!typeObj&&rel.type){ typeObj={id:uid('rt'),name:rel.type}; relationTypes.push(typeObj); }
    const fromId=rel.from_ref?entityRefMap[rel.from_ref]:rel.from;
    const toId=rel.to_ref?entityRefMap[rel.to_ref]:rel.to;
    if(!fromId||!toId||!typeObj) return;
    relations.push({id:uid('rel'),type:typeObj.id,from:fromId,to:toId,status:rel.status||'confirmed',source:rel.source||('idea:'+(data.idea_id||data.title||'')),comment:rel.comment||'',conditions:Array.isArray(rel.conditions)?rel.conditions:[],effects:Array.isArray(rel.effects)?rel.effects:[]});
    addedRelationCount++;
  });

  let addedProposalCount=0;
  (data.proposals||[]).forEach(p=>{
    if(!p||!p.title) return;
    proposals.push({id:uid('pr'),title:p.title,text:p.text||'',status:'idea',relatedEntities:[],relatedSystems:[]});
    addedProposalCount++;
  });

  ideaLog.unshift({title:data.title||data.idea_id||'(без названия)',at:new Date(),nodeCount:newNodes.length,varCount:(data.variables||[]).length,linkCount,entityCount:(data.entities||[]).length,relationCount:addedRelationCount,proposalCount:addedProposalCount});
  pushHistory(); renderAll(); renderIdeaLog();
  return {nodeCount:newNodes.length,linkCount,entityCount:(data.entities||[]).length,relationCount:addedRelationCount,proposalCount:addedProposalCount};
}

function renderIdeaLog(){
  const el=document.getElementById('ideaLogList');
  el.innerHTML=ideaLog.length?ideaLog.map(l=>`<div class="idea-entry">«${esc(l.title)}» — ${l.nodeCount} узлов, ${l.varCount} переменных, ${l.linkCount} автосвязей${l.entityCount?`, ${l.entityCount} сущностей`:''}${l.relationCount?`, ${l.relationCount} связей`:''}${l.proposalCount?`, ${l.proposalCount} идей`:''} <span class="muted small">(${l.at.toLocaleTimeString()})</span></div>`).join(''):'Импортированных идей пока нет.';
}

const IDEA_TEMPLATE={
  idea_id:'npc_self_hint_example',
  title:'Пример: NPC сам подсказывает, чего не хватает',
  variables:[
    {id:'v_electricity_home',name:'Электричество в доме',type:'flag',start:0,min:0,max:1}
  ],
  nodes:[
    {
      ref:'n1',title:'NPC: намёк про свет',text:'«Темновато тут. Если бы был аккумулятор — я бы свет наладил.»',
      type:'background',category:'ai',tags:['energy','story'],
      trigger:{kind:'scheduled',afterHours:24,sinceNode:'',repeat:true},
      effects:[],sim:{durationHours:0,dangerChance:0,foodCost:0,waterCost:0,requiresItems:[],requiresSkills:[]},
      ending:'',
      choices:[
        {label:'Занести аккумулятор',target_ref:'n2',requires:[],effects:[{var:'v_electricity_home',op:'set',value:1}],sim:{requiresItems:['battery_cell']}}
      ]
    },
    {
      ref:'n2',title:'Свет в доме включён',text:'NPC радуется — теперь можно работать и ночью.',
      type:'event',category:'energy',tags:['ai'],
      trigger:{kind:'conditions',all:[]},effects:[],sim:{durationHours:1,dangerChance:0,foodCost:0,waterCost:0},
      ending:'',choices:[]
    }
  ],
  links:[
    {from_ref:'n2',match_tag:'energy',label:'(связано: тоже про энергию)'}
  ],
  // Сущности мира + типизированные связи между ними — отдельный слой, показывает пример из
  // обсуждения: DRINK (действие из Object Plan) → производит эффект → тот утоляет жажду, которая
  // тратит воду. ref — локальный id внутри бандла, как и у узлов выше; refId — реальный id/строка
  // из каталога Object Plan (для kind без каталога — просто free-typed name).
  entities:[
    {ref:'e_ivan',kind:'character',name:'Иван'},
    {ref:'e_drink',kind:'action',refId:'DRINK'},
    {ref:'e_thirstfix',kind:'effect',name:'Восстановление жажды'}
  ],
  relations:[
    {from_ref:'e_ivan',type:'can_perform',to_ref:'e_drink',status:'confirmed',comment:'Иван может пить'},
    {from_ref:'e_drink',type:'produces',to_ref:'e_thirstfix',status:'confirmed'}
  ],
  proposals:[
    {title:'Завести Need-сущность "Голод" по аналогии с жаждой',text:'Симметрично текущей связке DRINK→восстановление жажды — стоит явно завести сущность-потребность и связать её с EAT.'}
  ]
};

document.getElementById('btnDownloadTemplate').onclick=()=>{
  downloadText('story-map-idea-template.json',JSON.stringify(IDEA_TEMPLATE,null,2));
};
document.getElementById('btnImportIdea').onclick=()=>document.getElementById('ideaFileInput').click();

// Импорт → Анализ (не мутирует граф) → Превью (эта карточка) → Слияние (только по кнопке
// "Добавить в граф") — чтобы файл с идеей нельзя было случайно "впаять" в граф одним кликом мимо.
let pendingIdeaData=null;
document.getElementById('ideaFileInput').addEventListener('change',async e=>{
  const file=e.target.files[0]; e.target.value='';
  if(!file) return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.nodes)) throw new Error('Файл не похож на шаблон идеи: нет массива "nodes".');
    pendingIdeaData=data;
    showImportPreview(analyzeIdea(data));
  }catch(err){ alert('Не удалось прочитать идею: '+err.message); }
});
function showImportPreview(summary){
  document.getElementById('importPreviewBody').innerHTML=`
    <div class="hint">«${esc(summary.title)}»</div>
    <ul style="margin:8px 0;padding-left:18px;font-size:12.5px;line-height:1.6">
      <li>Узлов: ${summary.nodeCount}</li>
      <li>Переменных: новых ${summary.newVarCount}, уже существующих ${summary.existingVarCount}</li>
      <li>Сущностей: новых ${summary.newEntityCount}, совпало с существующими ${summary.existingEntityCount}</li>
      <li>Связей: ${summary.relationCount}${summary.newRelationTypeCount?` (новых типов связи: ${summary.newRelationTypeCount} — ${esc(summary.newRelationTypeNames.join(', '))})`:''}</li>
      <li>Идей/предложений: ${summary.proposalCount}</li>
    </ul>`;
  document.getElementById('importPreviewModal').style.display='flex';
}
document.getElementById('btnImportCancel').onclick=()=>{
  pendingIdeaData=null;
  document.getElementById('importPreviewModal').style.display='none';
};
document.getElementById('btnImportConfirm').onclick=()=>{
  const data=pendingIdeaData; pendingIdeaData=null;
  document.getElementById('importPreviewModal').style.display='none';
  if(!data) return;
  try{
    const r=importIdea(data);
    alert(`Готово: добавлено ${r.nodeCount} узлов, ${r.linkCount} автосвязей, ${r.entityCount} сущностей, ${r.relationCount} связей, ${r.proposalCount} идей.`);
  }catch(err){ alert('Не удалось импортировать идею: '+err.message); }
};
