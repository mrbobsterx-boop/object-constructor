/* ============================================================
   MODULE 09 — МОДЕЛЬ МИРА: сущности, типы связей, связи, идеи-предложения
   Отдельный слой над графом узлов сюжета (02-graph-state.js) — связи здесь строго между
   сущностями, а не между узлами; ни узлы/переходы, ни бот это не видят и не трогают.
   Сущность бывает "авторской" (name — свободный текст, ничего не каталогизировано: персонаж,
   локация, фракция, группа, концепт, ресурс, эффект, анимация) или "каталожной" — ref.refId
   указывает на реальную запись в уже загруженном словаре Object Plan (PLAN_ITEMS/OS_SKILLS/
   ACTIONS/SYSTEMS), а не дублирует её — имя всегда читается оттуда же, где его меняют.
   ============================================================ */

const ENTITY_KINDS=[
  {id:'character',label:'Персонаж',catalog:null},
  {id:'location',label:'Локация',catalog:null},
  {id:'faction',label:'Фракция',catalog:null},
  {id:'group',label:'Группа',catalog:null},
  {id:'concept',label:'Концепт',catalog:null},
  {id:'resource',label:'Ресурс',catalog:null},
  {id:'effect',label:'Эффект',catalog:null},
  {id:'animation',label:'Анимация',catalog:null},
  {id:'item',label:'Предмет (Object Plan)',catalog:'items'},
  {id:'skill',label:'Навык (Object Plan)',catalog:'skills'},
  {id:'action',label:'Действие (Object Plan)',catalog:'actions'},
  {id:'system',label:'Система (Object Plan)',catalog:'systems'}
];
function entityKindDef(kindId){ return ENTITY_KINDS.find(k=>k.id===kindId)||ENTITY_KINDS[0]; }
function entityKindLabel(kindId){ return entityKindDef(kindId).label; }
function catalogOptionsFor(catalog){
  if(catalog==='items') return (typeof PLAN_ITEMS!=='undefined'?PLAN_ITEMS:[]).map(i=>({id:i.id,label:i.n}));
  if(catalog==='skills') return (typeof OS_SKILLS!=='undefined'?OS_SKILLS:[]).map(s=>({id:s,label:s}));
  if(catalog==='actions') return (typeof ACTIONS!=='undefined'?ACTIONS:[]).map(a=>({id:a,label:a}));
  if(catalog==='systems') return (typeof SYSTEMS!=='undefined'?SYSTEMS:[]).map(s=>({id:s.id,label:s.name}));
  return [];
}

// Object Plan не хранит отдельный каталог "ресурсов" — вода/энергия/топливо/лом это просто
// os.resourceType на предметах-контейнерах/баках (PLAN_ITEMS), без единого перечня где-либо. Вместо
// того чтобы завести свой список и рисковать разойтись с тем, что реально есть в Object Plan,
// вычисляем список типов из уже загруженного PLAN_ITEMS — появится в Object Plan новый тип, здесь он
// подхватится сам, без правки Story Map (§21).
const RESOURCE_TYPE_LABELS={water:'Вода',energy:'Энергия',fuel:'Топливо',scrap:'Металлолом'};
function getResourceTypes(){
  const seen=new Set();
  (typeof PLAN_ITEMS!=='undefined'?PLAN_ITEMS:[]).forEach(i=>{ const rt=i.os&&i.os.resourceType; if(rt) seen.add(rt); });
  return [...seen].map(id=>({id,label:RESOURCE_TYPE_LABELS[id]||id}));
}
function resourceTypeLabel(id){ return RESOURCE_TYPE_LABELS[id]||id||''; }

// Object Plan уже сам ведёт статус реализации предмета (todo/wip/done/skip, вручную или по шагам —
// object-plan/js/07-store.js), сохраняя его в data/object_plan.json того же проекта. Не изобретаем
// свой параллельный статус — читаем ЕГО файл (только на чтение, ничего не пишем и не трогаем папку
// Object Plan) и показываем как есть. Читаем только РУЧНОЙ статус (store.status[id]) — авто-статус
// по шагам (готовность картинки/размеров/анимаций и т. п.) зависит от data/objects, которую Story Map
// иначе никогда не парсит; честнее показать "не отмечено", чем гадать по чужой логике, которую здесь
// не воспроизводим.
let objectPlanStatusData=null;
async function loadObjectPlanStatus(){ objectPlanStatusData=await readJsonFromProject('data/object_plan.json'); }
const OP_STATUS_LABELS={todo:'Не начато',wip:'В работе',done:'Готово',skip:'Отложено'};
function objectPlanManualStatus(itemId){ return objectPlanStatusData&&objectPlanStatusData.status?objectPlanStatusData.status[itemId]:undefined; }
function objectPlanStatusLabel(id){ return OP_STATUS_LABELS[id]||id; }
function findPlanItem(id){ return (typeof PLAN_ITEMS!=='undefined'?PLAN_ITEMS:[]).find(i=>i.id===id); }

// inverseName — как читается ЭТА ЖЕ связь с точки зрения второй сущности (member_of → has_member),
// вместо голого "← member_of"; symmetric — связь читается одинаково с обеих сторон (friend_of), без
// направления вовсе. Оба поля — необязательные, редактируются в списке "Типы связей" (§14).
const DEFAULT_RELATION_TYPES=[
  {name:'member_of',inverseName:'has_member'},
  {name:'located_at'},
  {name:'contains',inverseName:'part_of'},
  {name:'owns',inverseName:'owned_by'},
  {name:'can_perform'},
  {name:'uses'},
  {name:'produces'},
  {name:'satisfies_need'},
  {name:'has_skill'},
  {name:'has_need'},
  {name:'is_a'},
  {name:'supports'},
  {name:'friend_of',symmetric:true},
  {name:'enemy_of',symmetric:true}
];
const RELATION_STATUS=[['confirmed','подтверждено'],['proposed','предположение'],['deprecated','устарело']];

let entities=[], relationTypes=[], relations=[], proposals=[], worldEvents=[], decisions=[];
let selectedEntityId=null, selectedRelationId=null, selectedProposalId=null, selectedWorldEventId=null, selectedDecisionId=null;
const PROPOSAL_STATUS=[['idea','идея'],['planned','запланировано'],['accepted','принято'],['implemented','реализовано'],['rejected','отклонено']];
const PROPOSAL_PRIORITY=[['low','низкий'],['normal','обычный'],['high','высокий']];
function proposalStatusLabel(status){ const e=PROPOSAL_STATUS.find(([id])=>id===status); return e?e[1]:status; }
function entityLifecycleLabel(id){ const e=ENTITY_LIFECYCLE_STATES.find(([x])=>x===id); return e?e[1]:''; }

// Автономные события мира (§26) — что происходит БЕЗ участия игрока (actor действует на target неким
// action), в отличие от узлов сюжета (Story Graph), которые всегда про то, что видит и выбирает игрок.
// Это ДЕКЛАРАТИВНЫЕ записи для дизайна/трассировки ("рейдеры периодически нападают на бункер, это
// портит запасы и может убить NPC") — они НЕ "стреляют" сами внутри lightweight-симулятора (§18/§25):
// у симулятора вообще нет модели времени/мира вне графа choices, куда это можно было бы честно
// встроить, не изобретая по сути отдельный игровой движок внутри Story Map. effects используют тот же
// формат {var,op,value}, что и везде (condRowsHtml/condListPreviewText, §25) — не новый язык эффектов.
function findWorldEvent(id){ return worldEvents.find(x=>x.id===id); }
function worldEventsForEntity(entityId){ return worldEvents.filter(ev=>ev.actor===entityId||ev.target===entityId); }
function addWorldEvent(){
  if(blockIfReadOnly()) return;
  const ev={id:uid('we'),title:'Новое событие',actor:'',action:'',target:'',resultLifecycle:'',effects:[],comment:''};
  worldEvents.push(ev);
  selectedWorldEventId=ev.id; selectedEntityId=null; selectedProposalId=null; selectedRelationId=null;
  pushHistory(); renderAll();
  return ev;
}
function updateWorldEvent(id,patch){
  if(blockIfReadOnly()) return;
  const ev=findWorldEvent(id); if(!ev) return;
  Object.assign(ev,patch);
  pushHistory(); renderAll();
}
function deleteWorldEvent(id){
  if(blockIfReadOnly()) return;
  worldEvents=worldEvents.filter(x=>x.id!==id);
  if(selectedWorldEventId===id) selectedWorldEventId=null;
  pushHistory(); renderAll();
}

// Decision Log (§28) — записи о РЕШЕНИЯХ по архитектуре/дизайну ("почему раздел работает именно так"),
// а не о содержимом сюжета (это уже proposals) и не о конкретной вещи в мире (это entities). `source` —
// откуда взялось решение (Master Design/Object Plan/сам Story Map/прототип/отдельное решение), `status`
// — насколько оно устоялось: 'unknown' — ОСОЗНАННО не решено ещё (Master Design сам оставляет это
// открытым, и Story Map не должен заставлять фиксировать раньше времени), а не "забыли заполнить".
const DECISION_STATUS=[['defined','Зафиксировано'],['tentative','Предварительно'],['unknown','Не определено (осознанно)'],['deprecated','Устарело']];
const DECISION_SOURCE=[['master-design','Master Design'],['object-plan','Object Plan'],['story','Story Map'],['prototype','Прототип'],['decision','Отдельное решение']];
function decisionStatusLabel(id){ const e=DECISION_STATUS.find(([x])=>x===id); return e?e[1]:id; }
function decisionSourceLabel(id){ const e=DECISION_SOURCE.find(([x])=>x===id); return e?e[1]:id; }
function findDecision(id){ return decisions.find(d=>d.id===id); }
function addDecision(title){
  if(blockIfReadOnly()) return;
  title=(title||'').trim(); if(!title) return;
  const d={id:uid('dec'),title,text:'',status:'tentative',source:'decision',relatedSystems:[],relatedEntities:[],comment:'',createdAt:new Date().toISOString()};
  decisions.unshift(d);
  selectedDecisionId=d.id; selectedEntityId=null; selectedProposalId=null; selectedWorldEventId=null;
  pushHistory(); renderAll();
  return d;
}
function updateDecision(id,patch){
  if(blockIfReadOnly()) return;
  const d=findDecision(id); if(!d) return;
  Object.assign(d,patch);
  pushHistory(); renderAll();
}
function deleteDecision(id){
  if(blockIfReadOnly()) return;
  decisions=decisions.filter(d=>d.id!==id);
  if(selectedDecisionId===id) selectedDecisionId=null;
  pushHistory(); renderAll();
}
// Change Impact — синтез уже существующих кросс-ссылок (§14/§26), а не отдельный расчёт с нуля:
// сколько узлов сюжета/связей/событий мира трогают сущности, связанные с этим решением, суммарно.
function decisionChangeImpact(d){
  const seenNodes=new Set();
  let relationCount=0, eventCount=0;
  (d.relatedEntities||[]).forEach(eid=>{
    const ent=findEntity(eid); if(!ent) return;
    nodesReferencingEntity(eid).forEach(n=>seenNodes.add(n.id));
    if(entityKindDef(ent.kind).catalog) nodesUsingCatalogEntity(ent).forEach(n=>seenNodes.add(n.id));
    relationCount+=relationsForEntity(eid).length;
    eventCount+=worldEventsForEntity(eid).length;
  });
  return {nodeCount:seenNodes.size,relationCount,eventCount};
}

function findEntity(id){ return entities.find(e=>e.id===id); }
function findRelationType(id){ return relationTypes.find(t=>t.id===id); }
function findRelation(id){ return relations.find(r=>r.id===id); }
function relationTypeLabel(id){ const t=findRelationType(id); return t?t.name:'(?)'; }
function relationsForEntity(id){ return relations.filter(r=>r.from===id||r.to===id); }
// Каталожная сущность (предмет/навык/система) не имеет node.refs, но её реальное использование в
// сюжете видно по совсем другим полям узла — sim.requiresItems/requiresSkills (совпадение по
// каталожному id, не по id сущности) и category/tags для систем (это те же id SYSTEMS). Отдельная
// функция, а не расширение nodesReferencingEntity(), потому что механизм связи принципиально другой
// (совпадение по каталожному значению, а не по id сущности "Мира").
function nodesUsingCatalogEntity(entity){
  const kind=entityKindDef(entity.kind);
  if(!kind.catalog||!entity.ref||!entity.ref.refId) return [];
  const refId=entity.ref.refId;
  if(kind.catalog==='items') return nodes.filter(n=>(n.sim&&n.sim.requiresItems||[]).includes(refId));
  if(kind.catalog==='skills') return nodes.filter(n=>(n.sim&&n.sim.requiresSkills||[]).includes(refId));
  if(kind.catalog==='systems') return nodes.filter(n=>n.category===refId||(n.tags||[]).includes(refId));
  return [];
}
// Focus Entity: соседи считаются БЕЗ учёта направления связи — для навигации по кластеру мира
// направление не важно, важно "с чем это связано вообще" (в отличие от Story-режима, где фокус идёт
// строго вперёд по choices — там направление и есть весь смысл, см. computeFocusSet в 03-canvas.js).
function computeEntityFocusSet(entityId,depth){
  if(!entityId) return null;
  const set=new Set([entityId]);
  if(depth==='all'){
    let grew=true;
    while(grew){
      grew=false;
      relations.forEach(r=>{
        if(set.has(r.from)&&!set.has(r.to)){ set.add(r.to); grew=true; }
        if(set.has(r.to)&&!set.has(r.from)){ set.add(r.from); grew=true; }
      });
    }
    return set;
  }
  const maxDepth=Number(depth)||1;
  let frontier=[entityId];
  for(let d=0;d<maxDepth&&frontier.length;d++){
    const next=[];
    frontier.forEach(id=>{
      relations.forEach(r=>{
        if(r.from===id&&!set.has(r.to)){ set.add(r.to); next.push(r.to); }
        if(r.to===id&&!set.has(r.from)){ set.add(r.from); next.push(r.from); }
      });
    });
    frontier=next;
  }
  return set;
}

function seedRelationTypesIfEmpty(){
  if(relationTypes.length) return;
  relationTypes=DEFAULT_RELATION_TYPES.map(d=>({id:uid('rt'),name:d.name,inverseName:d.inverseName||'',symmetric:!!d.symmetric}));
}

// Имя каталожной сущности всегда читается из самого каталога (не хранится отдельно) — если предмет
// в Object Plan переименовали, сущность здесь сразу покажет новое имя, а не устаревшую копию.
function entityDisplayName(ent){
  if(!ent) return '';
  const kind=entityKindDef(ent.kind);
  if(kind.catalog){
    const opt=catalogOptionsFor(kind.catalog).find(o=>o.id===(ent.ref&&ent.ref.refId));
    return opt?opt.label:(ent.ref&&ent.ref.refId?'(?'+ent.ref.refId+')':'(не выбрано)');
  }
  return ent.name||'(без имени)';
}

function addEntity(kindId){
  if(blockIfReadOnly()) return;
  const kind=entityKindDef(kindId);
  const e={id:uid('e'),kind:kind.id,name:kind.catalog?'':'Новая сущность',ref:kind.catalog?{catalog:kind.catalog,refId:''}:null,note:'',status:'active',lifecycle:''};
  if(kind.catalog){
    const opts=catalogOptionsFor(kind.catalog);
    const used=new Set(entities.filter(x=>x.kind===kind.id).map(x=>x.ref&&x.ref.refId));
    const free=opts.find(o=>!used.has(o.id));
    if(free) e.ref.refId=free.id;
  }
  entities.push(e);
  selectedEntityId=e.id; selectedProposalId=null;
  pushHistory(); renderAll();
  return e;
}
function updateEntity(id,patch){
  if(blockIfReadOnly()) return;
  const e=findEntity(id); if(!e) return;
  Object.assign(e,patch);
  pushHistory(); renderAll();
}
// "Устарело" вместо немедленного удаления — старые ссылки (node.refs, relations) не рвутся сразу,
// сущность просто перестаёт предлагаться для НОВЫХ ссылок (см. entityPickerOptions) и помечается
// значком там, где показывается. Настоящее удаление — отдельное явное действие (deleteEntity).
function deprecateEntity(id){
  if(blockIfReadOnly()) return;
  const e=findEntity(id); if(!e) return;
  e.status='deprecated';
  pushHistory(); renderAll();
}
function restoreEntity(id){
  if(blockIfReadOnly()) return;
  const e=findEntity(id); if(!e) return;
  e.status='active';
  pushHistory(); renderAll();
}
// Каскад — как у deleteNode со связанными choices: удалённая сущность не должна оставлять
// "висящие" связи, которые потом checks будет вечно ругать как ошибку. Это НЕ трогает node.refs
// узлов сюжета (они живут в отдельном модуле) — та дыра уже отдельно ловится проверками (§5).
function deleteEntity(id){
  if(blockIfReadOnly()) return;
  entities=entities.filter(e=>e.id!==id);
  relations=relations.filter(r=>r.from!==id&&r.to!==id);
  proposals.forEach(p=>{ if(Array.isArray(p.relatedEntities)) p.relatedEntities=p.relatedEntities.filter(x=>x!==id); });
  if(selectedEntityId===id) selectedEntityId=null;
  pushHistory(); renderAll();
}
// Миграция при задвоении/переименовании: переносит ВСЕ ссылки (node.refs узлов сюжета и relations
// слоя "Мир") с одной сущности на другую, затем архивирует исходную — а не удаляет её вслепую,
// оставляя источник восстановимым, если слияние оказалось ошибкой.
function mergeEntities(fromId,toId){
  if(blockIfReadOnly()) return 0;
  if(!fromId||!toId||fromId===toId) return 0;
  if(!findEntity(fromId)||!findEntity(toId)) return 0;
  let count=0;
  nodes.forEach(n=>{
    if(!Array.isArray(n.refs)) return;
    const i=n.refs.indexOf(fromId);
    if(i>=0){ if(n.refs.includes(toId)) n.refs.splice(i,1); else n.refs[i]=toId; count++; }
  });
  relations.forEach(r=>{
    if(r.from===fromId){ r.from=toId; count++; }
    if(r.to===fromId){ r.to=toId; count++; }
  });
  proposals.forEach(p=>{
    if(!Array.isArray(p.relatedEntities)) return;
    const i=p.relatedEntities.indexOf(fromId);
    if(i>=0){ if(p.relatedEntities.includes(toId)) p.relatedEntities.splice(i,1); else p.relatedEntities[i]=toId; count++; }
  });
  const from=findEntity(fromId);
  from.status='deprecated';
  if(selectedEntityId===fromId) selectedEntityId=toId;
  pushHistory(); renderAll();
  return count;
}

function addRelationType(name){
  if(blockIfReadOnly()) return;
  name=(name||'').trim(); if(!name) return;
  if(relationTypes.some(t=>t.name===name)) return;
  relationTypes.push({id:uid('rt'),name,inverseName:'',symmetric:false});
  pushHistory(); renderAll();
}
function deleteRelationType(id){
  if(blockIfReadOnly()) return;
  relationTypes=relationTypes.filter(t=>t.id!==id);
  pushHistory(); renderAll();
}

function addRelation(fromId,toId,typeId){
  if(blockIfReadOnly()) return;
  const r={id:uid('rel'),type:typeId||(relationTypes[0]&&relationTypes[0].id)||'',from:fromId||'',to:toId||'',status:'confirmed',source:'',comment:'',conditions:[],effects:[]};
  relations.push(r);
  pushHistory(); renderAll();
  return r;
}
function updateRelation(id,patch){
  if(blockIfReadOnly()) return;
  const r=findRelation(id); if(!r) return;
  Object.assign(r,patch);
  pushHistory(); renderAll();
}
function deleteRelation(id){
  if(blockIfReadOnly()) return;
  relations=relations.filter(r=>r.id!==id);
  if(selectedRelationId===id) selectedRelationId=null;
  pushHistory(); renderAll();
}

function addProposal(title){
  if(blockIfReadOnly()) return;
  title=(title||'').trim(); if(!title) return;
  const p={id:uid('pr'),title,text:'',status:'idea',priority:'normal',source:'',createdAt:new Date().toISOString(),relatedEntities:[],relatedSystems:[],relatedNodes:[]};
  proposals.unshift(p);
  selectedProposalId=p.id; selectedEntityId=null; selectedRelationId=null;
  pushHistory(); renderAll();
  return p;
}
function updateProposal(id,patch){
  if(blockIfReadOnly()) return;
  const p=proposals.find(x=>x.id===id); if(!p) return;
  Object.assign(p,patch);
  pushHistory(); renderAll();
}
function deleteProposal(id){
  if(blockIfReadOnly()) return;
  proposals=proposals.filter(p=>p.id!==id);
  if(selectedProposalId===id) selectedProposalId=null;
  pushHistory(); renderAll();
}
// Идея -> реальная сущность/узел сюжета — единственные два способа "построить" её (кроме простого
// изменения статуса вручную); обе помечают идею implemented (а не только accepted — задача уже
// сделана, не просто согласована) и запоминают, во что она превратилась, чтобы не терять эту нить.
function promoteProposalToEntity(id,kindId){
  if(blockIfReadOnly()) return null;
  const p=proposals.find(x=>x.id===id); if(!p) return null;
  const kind=entityKindDef(kindId||'concept');
  const e={id:uid('e'),kind:kind.id,name:kind.catalog?'':p.title,ref:kind.catalog?{catalog:kind.catalog,refId:''}:null,note:p.text||'',status:'active'};
  entities.push(e);
  p.status='implemented';
  p.relatedEntities=[...new Set([...(p.relatedEntities||[]),e.id])];
  selectedEntityId=e.id; selectedProposalId=null;
  pushHistory(); renderAll();
  return e;
}
// Черновой узел сюжета из идеи — заголовок/текст переносятся как есть, раздел берётся из первой
// связанной системы Object Plan (если есть), а дальше это обычный узел, ничем не отличающийся от
// созданного вручную. Прыгаем в "Сюжет" сразу на нём — то же ощущение "смотри, что получилось", что
// и у promoteProposalToEntity внутри "Мира".
function promoteProposalToNode(id){
  if(blockIfReadOnly()) return null;
  const p=proposals.find(x=>x.id===id); if(!p) return null;
  const n=addNode('event');
  if(!n) return null;
  n.title=p.title; n.text=p.text||'';
  if(p.relatedSystems&&p.relatedSystems[0]) n.category=p.relatedSystems[0];
  p.status='implemented';
  p.relatedNodes=[...new Set([...(p.relatedNodes||[]),n.id])];
  if(typeof setViewMode==='function') setViewMode('story');
  selectNode(n.id); if(typeof focusNode==='function') focusNode(n.id);
  pushHistory(); renderAll();
  return n;
}
function linkProposalToNode(id,nodeId){
  if(blockIfReadOnly()) return;
  const p=proposals.find(x=>x.id===id); if(!p||!nodeId) return;
  p.relatedNodes=[...new Set([...(p.relatedNodes||[]),nodeId])];
  pushHistory(); renderAll();
}
function unlinkProposalFromNode(id,nodeId){
  if(blockIfReadOnly()) return;
  const p=proposals.find(x=>x.id===id); if(!p) return;
  p.relatedNodes=(p.relatedNodes||[]).filter(x=>x!==nodeId);
  pushHistory(); renderAll();
}
