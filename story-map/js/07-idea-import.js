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
// override (необязательный, из выбора пользователя в превью — см. showImportPreview/importOverrides):
// 'new' — создать новую сущность, даже если найдено совпадение (это "не тот Иван"); 'skip' — не
// создавать и не резолвить refMap для неё вовсе (relations/refs, ссылающиеся на неё, естественно
// отвалятся — так же, как уже отваливаются ссылки на несуществующий id).
function resolveOrCreateEntity(entry,refMap,mutate,override){
  const kind=entityKindDef(entry.kind);
  if(override==='skip') return {entity:null,isNew:false,skipped:true};
  let existing=null;
  if(override!=='new'){
    if(kind.catalog&&entry.refId) existing=entities.find(e=>e.kind===kind.id&&e.ref&&e.ref.refId===entry.refId);
    else if(!kind.catalog&&entry.name) existing=entities.find(e=>e.kind===kind.id&&(e.name||'').trim().toLowerCase()===entry.name.trim().toLowerCase());
  }
  if(existing){ if(entry.ref) refMap[entry.ref]=existing.id; return {entity:existing,isNew:false}; }
  const e={id:uid('e'),kind:kind.id,name:kind.catalog?'':(entry.name||'Без имени'),ref:kind.catalog?{catalog:kind.catalog,refId:entry.refId||''}:null,note:entry.note||''};
  if(mutate) entities.push(e);
  if(entry.ref) refMap[entry.ref]=e.id;
  return {entity:e,isNew:true};
}
// Показать пользователю, с какой ИМЕННО существующей сущностью совпал бандл-элемент, а не только
// голое число в сводке — иначе "1 сущность совпала" ничего не говорит о том, тот ли это Иван.
function entityMatchLabel(entry){
  const kind=entityKindDef(entry.kind);
  if(kind.catalog&&entry.refId){
    const opt=catalogOptionsFor(kind.catalog).find(o=>o.id===entry.refId);
    return opt?opt.label:entry.refId;
  }
  return entry.name||'(без имени)';
}

// Единая логика авто-связей по тегу/разделу — используется и в реальном импорте (mutate:true,
// действительно толкает choices), и в превью (mutate:false, просто считает), одной и той же веткой
// кода — тот же приём, что и у resolveOrCreateEntity выше, чтобы число в превью и то, что реально
// создастся, не могли разойтись. resolveFrom(link) возвращает node-подобный объект {id,choices} —
// либо настоящий узел (findNode), либо "фантомный" для узла, которого ещё нет (превью нового узла
// бандла, см. analyzeIdea). candidateNodes — по чему искать совпадения (реальные nodes при импорте;
// nodes+фантомы бандла при превью, чтобы бандл мог линковаться сам на себя, как и при реальном
// импорте, где newNodes уже лежат в общем nodes к моменту этого шага).
const LINK_FANOUT_CAP=30;
function applyAutoLinks(linksData,resolveFrom,candidateNodes,mutate){
  let linkCount=0;
  // Множество "уже назначенных целей" на источник живёт ЗА ПРЕДЕЛАМИ forEach (не пересоздаётся на
  // каждый link) и обновляется независимо от mutate — иначе в режиме превью (mutate:false, куда
  // ничего реально не пишется в from.choices) второй link с тем же from не увидел бы, что первый уже
  // "занял" эту цель, и посчитал бы её дважды — расхождение с реальным импортом, где from.choices
  // физически накапливается между link-записями одного вызова.
  const assignedPerFrom=new Map();
  (linksData||[]).forEach(link=>{
    const from=resolveFrom(link); if(!from) return;
    const mode=link.mode==='first'?'first':'all';
    if(!assignedPerFrom.has(from.id)) assignedPerFrom.set(from.id,new Set(from.choices.map(c=>c.target)));
    const existingTargets=assignedPerFrom.get(from.id);
    for(const target of candidateNodes){
      if(target.id===from.id||existingTargets.has(target.id)) continue;
      const catMatch=link.match_category&&target.category===link.match_category;
      const tagMatch=link.match_tag&&(target.tags||[]).includes(link.match_tag);
      if(!catMatch&&!tagMatch) continue;
      if(mutate) from.choices.push({id:uid('c'),label:link.label||'(связано по тегу)',target:target.id,requires:[],effects:[],sim:{}});
      existingTargets.add(target.id);
      linkCount++;
      if(mode==='first') break;
      if(linkCount>=LINK_FANOUT_CAP){ if(mutate) console.warn('Story Map: авто-связей по "'+(link.match_tag||link.match_category)+'" больше '+LINK_FANOUT_CAP+', остальные пропущены — сузь тег или используй mode:"first".'); break; }
    }
  });
  return linkCount;
}
// Повторяющиеся описания связи в самом файле (одинаковые from_ref/from+match_category+match_tag+mode)
// — почти всегда copy-paste в JSON, а не намеренное дублирование; сами дубли-переходы это не создаст
// (applyAutoLinks и так не даёт двух choices на одну и ту же пару from→target), но стоит предупредить
// автора идеи, что в файле есть два одинаковых описания.
function countDuplicateLinkSpecs(linksData){
  const seen=new Set(); let dup=0;
  (linksData||[]).forEach(link=>{
    if(!link) return;
    const key=JSON.stringify([link.from_ref||'',link.from||'',link.match_category||'',link.match_tag||'',link.mode||'all']);
    if(seen.has(key)) dup++; else seen.add(key);
  });
  return dup;
}

// Не мутирующий разбор — считает "что будет добавлено / что совпадёт с уже существующим", чтобы
// показать это пользователю ДО реального importIdea(). Логика сопоставления та же самая
// (resolveOrCreateEntity/applyAutoLinks с mutate=false), поэтому цифры превью гарантированно совпадают
// с реальным слиянием — не отдельная, потенциально расходящаяся оценка "на глаз". overrides — то же,
// что попадёт в importIdea() при подтверждении (см. showImportPreview) — превью должно уметь
// пересчитаться под текущий выбор пользователя, а не только под "чистую" автоматику.
function analyzeIdea(data,overrides){
  data=data||{};
  overrides=overrides||{entities:{},variables:{}};
  const existingVarIds=new Map(variables.map(v=>[v.id,v]));
  const varList=data.variables||[];
  const newVarCount=varList.filter(v=>v&&v.id&&!existingVarIds.has(v.id)).length;
  // Конфликт — тот же id уже есть, но параметры отличаются (не просто "уже есть", а "уже есть
  // ДРУГОЕ") — единственный случай, где автоматическое "существующее побеждает" молча прячет
  // содержательную разницу от автора идеи.
  const variableConflicts=varList.filter(v=>v&&v.id&&existingVarIds.has(v.id)).map(v=>{
    const ex=existingVarIds.get(v.id);
    const differs=ex.name!==(v.name||ex.name)||ex.type!==(v.type||ex.type)||num(ex.min)!==num(v.min,ex.min)||num(ex.max)!==num(v.max,ex.max)||num(ex.start)!==num(v.start,ex.start);
    return {id:v.id,existingName:ex.name,incomingName:v.name||ex.name,differs};
  }).filter(c=>c.differs);

  const refMap={};
  let newEntityCount=0, existingEntityCount=0, skippedEntityCount=0;
  const entityDetails=(data.entities||[]).map(entry=>{
    const override=entry.ref?overrides.entities[entry.ref]:undefined;
    const {isNew,entity,skipped}=resolveOrCreateEntity(entry,refMap,false,override);
    if(skipped) skippedEntityCount++; else if(isNew) newEntityCount++; else existingEntityCount++;
    // matchedId/matchedName всегда describe что БЫ совпало автоматически (override==='new' в
    // resolveOrCreateEntity уже не искал existing) — считаем отдельно, чтобы предложить выбор в
    // превью даже когда пользователь до этого выбрал "создать новую".
    let matchedId=null,matchedName=null;
    const kind=entityKindDef(entry.kind);
    const auto=kind.catalog&&entry.refId?entities.find(e=>e.kind===kind.id&&e.ref&&e.ref.refId===entry.refId):(!kind.catalog&&entry.name?entities.find(e=>e.kind===kind.id&&(e.name||'').trim().toLowerCase()===entry.name.trim().toLowerCase()):null);
    if(auto){ matchedId=auto.id; matchedName=entityDisplayName(auto); }
    return {ref:entry.ref||'',kind:entry.kind,kindLabel:entityKindLabel(entry.kind),label:entityMatchLabel(entry),matchedId,matchedName,override:override||(auto?'match':'new'),skipped:!!skipped};
  });

  const existingTypeNames=new Set(relationTypes.map(t=>t.name));
  const typeNamesInBundle=new Set((data.relations||[]).map(r=>r&&r.type).filter(Boolean));
  const newRelationTypeNames=[...typeNamesInBundle].filter(n=>!existingTypeNames.has(n));

  // Проекция авто-связей: узлы бандла ещё не существуют, поэтому подставляем лёгкие "фантомы" с теми
  // же category/tags, что будут у настоящих узлов — этого достаточно для того же самого сопоставления
  // match_category/match_tag, что использует реальный импорт.
  const phantomRefMap={};
  const phantomNodes=(data.nodes||[]).map(entry=>{
    const ph={id:'__phantom_'+(entry.ref||Math.random()),category:entry.category||'story',tags:Array.isArray(entry.tags)?entry.tags:[],choices:[]};
    if(entry.ref) phantomRefMap[entry.ref]=ph;
    return ph;
  });
  const projectedLinkCount=applyAutoLinks(data.links,link=>link.from_ref?phantomRefMap[link.from_ref]:(link.from?findNode(link.from):undefined),nodes.concat(phantomNodes),false);
  const duplicateLinkSpecCount=countDuplicateLinkSpecs(data.links);

  return {
    title:data.title||data.idea_id||'(без названия)',
    nodeCount:Array.isArray(data.nodes)?data.nodes.length:0,
    newVarCount, existingVarCount:varList.length-newVarCount, variableConflicts,
    newEntityCount, existingEntityCount, skippedEntityCount, entityDetails,
    relationCount:Array.isArray(data.relations)?data.relations.length:0,
    newRelationTypeCount:newRelationTypeNames.length, newRelationTypeNames,
    proposalCount:Array.isArray(data.proposals)?data.proposals.length:0,
    projectedLinkCount, duplicateLinkSpecCount
  };
}

function importIdea(data,overrides){
  // Импорт — явное, высокоинтентное действие (пользователь уже прошёл превью и нажал "Добавить в
  // граф"), поэтому в отличие от тихих no-op у mutators выше — здесь честная ошибка с понятным
  // текстом, а не молчаливое "ничего не произошло".
  if(readOnlyMode) throw new Error('Включён режим «только чтение» — импорт отключён. Выключи его в шапке.');
  if(!data||!Array.isArray(data.nodes)) throw new Error('Файл не похож на шаблон идеи: нет массива "nodes".');
  overrides=overrides||{entities:{},variables:{}};
  const refMap={};
  const startY=nextIdeaY();
  const positions=layoutIdeaEntries(data.nodes);

  (data.variables||[]).forEach(v=>{
    if(!v||!v.id) return;
    const existing=findVariable(v.id);
    if(!existing){ variables.push({id:v.id,name:v.name||v.id,type:v.type||'counter',start:num(v.start,0),min:num(v.min,0),max:num(v.max,100)}); return; }
    // Конфликт (тот же id, другие параметры) — по умолчанию оставляем как в графе (старое поведение);
    // 'replace' — осознанный выбор в превью, перезаписывает ПАРАМЕТРЫ на месте (тот же id, все ссылки
    // на переменную остаются рабочими — заменяется только определение, не сама переменная как объект).
    if(overrides.variables[v.id]==='replace') Object.assign(existing,{name:v.name||existing.name,type:v.type||existing.type,start:num(v.start,existing.start),min:num(v.min,existing.min),max:num(v.max,existing.max)});
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
      refs:Array.isArray(entry.refs)?entry.refs.slice():[], // пока локальные bundle-ref'ы сущностей — резолвятся ниже, после entityRefMap
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

  // Ограничение веера + защита от дублей + подсчёт — applyAutoLinks (см. выше), та же самая ветка
  // кода, что и в превью (analyzeIdea), только mutate:true и по настоящим nodes (newNodes уже внутри).
  const linkCount=applyAutoLinks(data.links,link=>findNode(link.from_ref?refMap[link.from_ref]:link.from),nodes,true);

  // Сущности/связи/идеи-предложения — тот же принцип "только добавляем", что и у узлов/переменных:
  // resolveOrCreateEntity сам решает "это уже есть" vs "это новое" vs override пользователя из превью
  // (см. analyzeIdea выше — числа в превью и то, что реально будет добавлено здесь, посчитаны одной и
  // той же функцией).
  const entityRefMap={};
  let resolvedEntityCount=0;
  (data.entities||[]).forEach(entry=>{
    const {skipped}=resolveOrCreateEntity(entry,entityRefMap,true,entry.ref?overrides.entities[entry.ref]:undefined);
    if(!skipped) resolvedEntityCount++;
  });

  // Теперь, когда entityRefMap заполнена, можно превратить локальные bundle-ref'ы в node.refs
  // (проставленные выше как временные "сырые" значения) в настоящие id сущностей.
  newNodes.forEach(n=>{ n.refs=n.refs.map(r=>entityRefMap[r]).filter(Boolean); });

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
    proposals.push({id:uid('pr'),title:p.title,text:p.text||'',status:'idea',priority:p.priority||'normal',source:p.source||('idea:'+(data.idea_id||data.title||'')),createdAt:new Date().toISOString(),relatedEntities:[],relatedSystems:[],relatedNodes:[]});
    addedProposalCount++;
  });

  ideaLog.unshift({title:data.title||data.idea_id||'(без названия)',at:new Date(),nodeCount:newNodes.length,varCount:(data.variables||[]).length,linkCount,entityCount:resolvedEntityCount,relationCount:addedRelationCount,proposalCount:addedProposalCount});
  pushHistory(); renderAll(); renderIdeaLog();
  return {nodeCount:newNodes.length,linkCount,entityCount:resolvedEntityCount,relationCount:addedRelationCount,proposalCount:addedProposalCount};
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
      refs:['e_ivan'], // ссылка на сущность мира (см. entities ниже) — bundle-local ref, резолвится при импорте
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
    // priority/source необязательны (по умолчанию priority:"normal", source — метка этого импорта)
    {title:'Завести Need-сущность "Голод" по аналогии с жаждой',text:'Симметрично текущей связке DRINK→восстановление жажды — стоит явно завести сущность-потребность и связать её с EAT.',priority:'normal'}
  ]
};

document.getElementById('btnDownloadTemplate').onclick=()=>{
  downloadText('story-map-idea-template.json',JSON.stringify(IDEA_TEMPLATE,null,2));
};
document.getElementById('btnImportIdea').onclick=()=>document.getElementById('ideaFileInput').click();

// Импорт → Анализ (не мутирует граф) → Превью (эта карточка, теперь интерактивная — можно выбрать
// reuse/new/skip на конфликтующих сущностях и keep/replace на конфликтующих переменных, см. ниже) →
// Слияние (только по кнопке "Добавить в граф") — чтобы файл с идеей нельзя было случайно "впаять" в
// граф одним кликом мимо.
let pendingIdeaData=null;
let pendingOverrides={entities:{},variables:{}};
document.getElementById('ideaFileInput').addEventListener('change',async e=>{
  const file=e.target.files[0]; e.target.value='';
  if(!file) return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.nodes)) throw new Error('Файл не похож на шаблон идеи: нет массива "nodes".');
    pendingIdeaData=data;
    pendingOverrides={entities:{},variables:{}};
    renderImportPreview();
  }catch(err){ alert('Не удалось прочитать идею: '+err.message); }
});
// Перерисовывается на каждый выбор в списках ниже (не только один раз при открытии) — числа в
// сводке (в т.ч. спроецированный счётчик автосвязей) должны отражать ТЕКУЩИЙ выбор пользователя,
// иначе превью соврёт о том, что реально добавится после нажатия "Добавить в граф".
function renderImportPreview(){
  if(!pendingIdeaData) return;
  const summary=analyzeIdea(pendingIdeaData,pendingOverrides);
  const entityRows=summary.entityDetails.filter(d=>d.ref).map(d=>{
    const options=[];
    if(d.matchedId) options.push(`<option value="match" ${d.override==='match'?'selected':''}>Использовать существующую: ${esc(d.matchedName)}</option>`);
    options.push(`<option value="new" ${d.override==='new'?'selected':''}>Создать новую</option>`);
    options.push(`<option value="skip" ${d.override==='skip'?'selected':''}>Пропустить (не создавать)</option>`);
    return `<div class="row" style="margin-bottom:4px">
      <span class="tag entity" style="flex:none">${esc(d.kindLabel)}</span>
      <span class="nm" style="flex:1;font-size:12px">${esc(d.label)}</span>
      <select data-entityoverride="${esc(d.ref)}" style="flex:none">${options.join('')}</select>
    </div>`;
  }).join('');
  const varConflictRows=summary.variableConflicts.map(c=>{
    const choice=pendingOverrides.variables[c.id]||'keep';
    return `<div class="row" style="margin-bottom:4px">
      <span class="nm" style="flex:1;font-size:12px">${esc(c.existingName)} → ${esc(c.incomingName)}</span>
      <select data-varoverride="${esc(c.id)}" style="flex:none">
        <option value="keep" ${choice==='keep'?'selected':''}>Оставить как в графе</option>
        <option value="replace" ${choice==='replace'?'selected':''}>Заменить параметрами из идеи</option>
      </select>
    </div>`;
  }).join('');
  document.getElementById('importPreviewBody').innerHTML=`
    <div class="hint">«${esc(summary.title)}»</div>
    <ul style="margin:8px 0;padding-left:18px;font-size:12.5px;line-height:1.6">
      <li>Узлов: ${summary.nodeCount}</li>
      <li>Переменных: новых ${summary.newVarCount}, уже существующих ${summary.existingVarCount-summary.variableConflicts.length}${summary.variableConflicts.length?`, конфликтующих ${summary.variableConflicts.length}`:''}</li>
      <li>Сущностей: новых ${summary.newEntityCount}, совпало с существующими ${summary.existingEntityCount}${summary.skippedEntityCount?`, пропущено ${summary.skippedEntityCount}`:''}</li>
      <li>Связей: ${summary.relationCount}${summary.newRelationTypeCount?` (новых типов связи: ${summary.newRelationTypeCount} — ${esc(summary.newRelationTypeNames.join(', '))})`:''}</li>
      <li>Автосвязей по тегу/разделу будет создано: ${summary.projectedLinkCount}${summary.duplicateLinkSpecCount?` <span class="muted">(⚠ ${summary.duplicateLinkSpecCount} повторяющихся описаний связи в файле)</span>`:''}</li>
      <li>Идей/предложений: ${summary.proposalCount}</li>
    </ul>
    ${entityRows?`<div class="hint" style="margin-top:6px">Сущности бандла — что делать с каждой:</div>${entityRows}`:''}
    ${varConflictRows?`<div class="hint" style="margin-top:6px">⚠ Переменные с тем же id, но другими параметрами:</div>${varConflictRows}`:''}
  `;
  document.getElementById('importPreviewModal').style.display='flex';
}
document.getElementById('importPreviewBody').addEventListener('change',e=>{
  const eo=e.target.closest('[data-entityoverride]');
  if(eo){ pendingOverrides.entities[eo.dataset.entityoverride]=eo.value; renderImportPreview(); return; }
  const vo=e.target.closest('[data-varoverride]');
  if(vo){ pendingOverrides.variables[vo.dataset.varoverride]=vo.value; renderImportPreview(); }
});
document.getElementById('btnImportCancel').onclick=()=>{
  pendingIdeaData=null;
  document.getElementById('importPreviewModal').style.display='none';
};
document.getElementById('btnImportConfirm').onclick=()=>{
  const data=pendingIdeaData, overrides=pendingOverrides; pendingIdeaData=null; pendingOverrides={entities:{},variables:{}};
  document.getElementById('importPreviewModal').style.display='none';
  if(!data) return;
  try{
    const r=importIdea(data,overrides);
    alert(`Готово: добавлено ${r.nodeCount} узлов, ${r.linkCount} автосвязей, ${r.entityCount} сущностей, ${r.relationCount} связей, ${r.proposalCount} идей.`);
  }catch(err){ alert('Не удалось импортировать идею: '+err.message); }
};
