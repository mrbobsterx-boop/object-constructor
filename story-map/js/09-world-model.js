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

const DEFAULT_RELATION_TYPES=['member_of','located_at','contains','owns','can_perform','uses','produces','satisfies_need','has_skill','has_need','is_a','supports','friend_of','enemy_of'];
const RELATION_STATUS=[['confirmed','подтверждено'],['proposed','предположение'],['deprecated','устарело']];

let entities=[], relationTypes=[], relations=[], proposals=[];
let selectedEntityId=null, selectedRelationId=null;

function findEntity(id){ return entities.find(e=>e.id===id); }
function findRelationType(id){ return relationTypes.find(t=>t.id===id); }
function findRelation(id){ return relations.find(r=>r.id===id); }
function relationTypeLabel(id){ const t=findRelationType(id); return t?t.name:'(?)'; }
function relationsForEntity(id){ return relations.filter(r=>r.from===id||r.to===id); }

function seedRelationTypesIfEmpty(){
  if(relationTypes.length) return;
  relationTypes=DEFAULT_RELATION_TYPES.map(name=>({id:uid('rt'),name}));
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
  const e={id:uid('e'),kind:kind.id,name:kind.catalog?'':'Новая сущность',ref:kind.catalog?{catalog:kind.catalog,refId:''}:null,note:'',status:'active'};
  if(kind.catalog){
    const opts=catalogOptionsFor(kind.catalog);
    const used=new Set(entities.filter(x=>x.kind===kind.id).map(x=>x.ref&&x.ref.refId));
    const free=opts.find(o=>!used.has(o.id));
    if(free) e.ref.refId=free.id;
  }
  entities.push(e);
  selectedEntityId=e.id;
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
  relationTypes.push({id:uid('rt'),name});
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
  const p={id:uid('pr'),title,text:'',status:'idea',relatedEntities:[],relatedSystems:[]};
  proposals.unshift(p);
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
  pushHistory(); renderAll();
}
function promoteProposalToEntity(id,kindId){
  if(blockIfReadOnly()) return null;
  const p=proposals.find(x=>x.id===id); if(!p) return null;
  const kind=entityKindDef(kindId||'concept');
  const e={id:uid('e'),kind:kind.id,name:kind.catalog?'':p.title,ref:kind.catalog?{catalog:kind.catalog,refId:''}:null,note:p.text||'',status:'active'};
  entities.push(e);
  p.status='accepted';
  p.relatedEntities=[...new Set([...(p.relatedEntities||[]),e.id])];
  selectedEntityId=e.id;
  pushHistory(); renderAll();
  return e;
}
