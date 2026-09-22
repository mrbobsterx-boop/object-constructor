/* ============================================================
   MODULE 05 — UI CORE
   Состояние интерфейса, навигация (разделы, карточки сущностей, «Назад»), общие блоки разметки
   (ссылки, бейджи, карточки, таблицы со списком и фильтрами), миниатюры объектов.
   Разделы и карточки сущностей регистрируются в модулях 06–10:
     VIEW_RENDERERS[id]  = () => html      — раздел
     ENTITY_RENDERERS[k] = id => html      — карточка сущности (object, room, building, set, character, rig)
   Все клики — через делегирование: data-k/data-id (открыть сущность), data-view (раздел), data-act.
   ============================================================ */

const VIEWS=[
  {id:'overview',title:'Обзор'}, {id:'objects',title:'Объекты'}, {id:'materials',title:'Блоки и материалы'},
  {id:'rooms',title:'Комнаты'}, {id:'buildings',title:'Здания'}, {id:'sets',title:'Наборы'},
  {id:'assembler',title:'Персонажи (Assembler)'}, {id:'files',title:'Файлы'}, {id:'dictionaries',title:'Справочники'},
  {id:'unused',title:'Неиспользуемое'}, {id:'problems',title:'Проблемы'}
];
const VIEW_RENDERERS={}, ENTITY_RENDERERS={};
const ui={view:'overview',entity:null,stack:[],state:{},listCfg:null};
function vstate(view){ if(!ui.state[view]) ui.state[view]={q:'',f:{}}; return ui.state[view]; }

/* ---------- разметка ---------- */
function entityExists(kind,id){
  const m={object:idx.obj,room:idx.room,building:idx.bld,set:idx.set,character:idx.chr,rig:idx.rig}[kind];
  return !!(m&&m.has(id));
}
function lnk(kind,id,label){
  const text=esc(label===undefined?id:label);
  return entityExists(kind,id)?`<a class="lnk" data-k="${esc(kind)}" data-id="${esc(id)}">${text}</a>`:`<span class="lnk bad" title="Не найдено в проекте">${text}</span>`;
}
const KIND_LABEL={object:'Объект',room:'Комната',building:'Здание',set:'Набор',character:'Персонаж',rig:'Риг',file:'Файл',project:'Проект'};
function entityName(kind,id){
  const m={object:idx.obj,room:idx.room,building:idx.bld,set:idx.set,character:idx.chr,rig:idx.rig}[kind], e=m&&m.get(id);
  return e?(e.name||id):id;
}
function badge(text,cls){ return `<span class="badge ${cls||''}">${esc(text)}</span>`; }
function probBadge(kind,id){
  const c=problemCounts(kind,id);
  return (c.err?badge(c.err+' ош.','err')+' ':'')+(c.warn?badge(c.warn+' пред.','warn'):'');
}
function card(title,body,head){ return `<div class="card"><div class="cardhead"><b>${title}</b>${head||''}</div><div class="cardbody">${body}</div></div>`; }
function kv(rows){ return '<div class="kv">'+rows.map(([k,v])=>`<div>${esc(k)}</div><div>${(v===undefined||v===null||v==='')?'—':v}</div>`).join('')+'</div>'; }
function table(head,rows,empty){
  return `<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${head.length}" class="empty">${empty||'Ничего нет.'}</td></tr>`}</tbody></table>`;
}
function chipLink(view,fk,fv,label){ return `<span class="chip" data-act="filter" data-view="${esc(view)}" data-fk="${esc(fk)}" data-fv="${esc(fv)}">${esc(label)}</span>`; }
function problemHtml(p){ return `<div class="problem ${p.level}"><span class="badge ${p.level}">${esc(p.code)}</span> ${esc(p.msg)}</div>`; }
function problemsCard(kind,id){
  const list=problemsOf(kind,id);
  return card('Проблемы ('+list.length+')',list.length?list.map(problemHtml).join(''):'<span class="ok">Замечаний нет ✓</span>');
}
function entityShell(title,badges,body){
  return `<div class="toolbar"><button data-act="back">← Назад</button><div><h2>${title}</h2></div><div class="row">${badges||''}</div></div>${body}`;
}
function emptyState(){
  return `<div class="empty"><h2>Project Registry</h2><p>Подключи папку проекта — реестр прочитает data/ и assets/ и покажет все объекты, комнаты, здания,
    связи между ними и найденные проблемы. Реестр только читает: он ничего не меняет в проекте.</p></div>`;
}

/* ---------- миниатюры объектов ---------- */
function thumbHtml(o,big){
  return `<span class="thumb${big?' big':''}" data-oid="${esc(o?o.id:'')}">${o&&o.thumb?`<img src="${o.thumb}">`:'<span class="thumb-empty">—</span>'}</span>`;
}
function applyThumbs(){
  document.querySelectorAll('.thumb[data-oid]').forEach(el=>{
    const o=idx.obj.get(el.dataset.oid);
    if(o&&o.thumb&&!el.querySelector('img')) el.innerHTML=`<img src="${o.thumb}">`;
  });
}
async function loadThumbs(){
  const reg=registry, queue=registry.objects.filter(o=>o.asset&&idx.sprites.has(normPath(o.asset)));
  let done=0;
  const worker=async()=>{
    while(queue.length){
      const o=queue.shift(); if(reg!==registry) return;
      o.thumb=await readFileBlobUrl('assets/sprites/'+normPath(o.asset)); done++;
      if(done%20===0) applyThumbs();
    }
  };
  await Promise.all([worker(),worker(),worker(),worker()]);
  if(reg===registry) applyThumbs();
}

/* ---------- навигация ---------- */
function openEntity(kind,id){ ui.stack.push({view:ui.view,entity:ui.entity}); ui.entity={kind,id}; render(); document.getElementById('content').scrollTop=0; }
function goBack(){ const p=ui.stack.pop(); if(p){ ui.view=p.view; ui.entity=p.entity; } else ui.entity=null; render(); }
function gotoView(view,filters){
  ui.stack=[]; ui.entity=null; ui.view=view;
  const st=vstate(view); st.q=''; st.f=filters?Object.assign({},filters):{};   // переход из меню сбрасывает поиск и фильтры; чипы задают свой фильтр
  render(); document.getElementById('content').scrollTop=0;
}
function renderNav(){
  const R=registry, err=R.problems.filter(p=>p.level==='err').length;
  const cnt={ objects:R.objects.length, materials:R.objects.filter(o=>o.category==='block').length, rooms:R.rooms.length, buildings:R.buildings.length,
    sets:R.sets.length, assembler:R.characters.length, files:R.sprites.length+R.sounds.length, problems:R.problems.filter(p=>p.level!=='info').length };
  document.getElementById('navList').innerHTML=VIEWS.map(v=>{
    const n=cnt[v.id]; const bad=(v.id==='problems'&&err);
    return `<button class="navbtn${(!ui.entity&&ui.view===v.id)?' active':''}" data-view="${v.id}">${esc(v.title)}<span class="cnt${bad?' err':''}">${n===undefined?'':fmt(n)}</span></button>`;
  }).join('');
}
function updateSidebar(){
  const R=registry, set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=fmt(v); };
  set('sObjects',R.objects.length); set('sRooms',R.rooms.length); set('sBuildings',R.buildings.length);
  set('sInstances',R.rooms.reduce((s,r)=>s+r.instCount,0));
  const c={err:0,warn:0,info:0}; R.problems.forEach(p=>c[p.level]++);
  document.getElementById('checkSummary').innerHTML=R.scannedAt
    ?`<span class="err">${c.err} ошибок</span> · <span class="warn">${c.warn} предупреждений</span> · <span class="info">${c.info} инфо</span>`
    :'Сначала просканируй проект.';
}
function render(){
  renderNav(); updateSidebar();
  const c=document.getElementById('content');
  if(!registry.scannedAt){ c.innerHTML=emptyState(); return; }
  try{
    c.innerHTML=ui.entity?renderEntity():((VIEW_RENDERERS[ui.view]||(()=>''))());
  }catch(e){ console.error(e); c.innerHTML=`<div class="problem err">Ошибка отрисовки: ${esc(e.message)}</div>`; }
  applyThumbs();
}
function renderEntity(){
  const e=ui.entity, fn=ENTITY_RENDERERS[e.kind];
  if(!fn||!entityExists(e.kind,e.id)) return entityShell('Не найдено','',`<div class="empty">Сущность «${esc(e.id)}» (${esc(e.kind)}) не найдена — возможно, после пересканирования её уже нет.</div>`);
  return fn(e.id);
}

/* ---------- список с фильтрами и поиском ----------
   cfg: {view, title, desc, kind (для клика по строке), items():[], filters:[{key,label,options():[[value,label]]}],
         filterFn(item,f), columns:[{h, c:item=>html}], limit}
   У каждого элемента должно быть поле search (строка в нижнем регистре). */
function listState(cfg){
  const st=vstate(cfg.view), q=st.q.trim().toLowerCase(), all=cfg.items();
  let arr=cfg.filterFn?all.filter(it=>cfg.filterFn(it,st.f)):all;
  if(q) arr=arr.filter(it=>String(it.search||'').includes(q));
  return {arr,total:all.length};
}
function listBody(cfg){
  const {arr}=listState(cfg), limit=cfg.limit||500;
  const rows=arr.slice(0,limit).map(it=>`<tr${cfg.kind?` class="click" data-k="${cfg.kind}" data-id="${esc(it.id)}"`:''}>${cfg.columns.map(c=>`<td>${c.c(it)}</td>`).join('')}</tr>`);
  return `<div class="card">${table(cfg.columns.map(c=>c.h),rows,'Ничего не найдено.')}</div>`
    +(arr.length>limit?`<div class="muted" style="margin:-4px 0 10px">Показаны первые ${limit} из ${arr.length} — уточни поиск или фильтр.</div>`:'');
}
function listView(cfg){
  ui.listCfg=cfg;
  const st=vstate(cfg.view), s=listState(cfg);
  const filters=(cfg.filters||[]).map(f=>`<div><label>${esc(f.label)}</label><select data-list-f="${f.key}">${f.options().map(([v,l])=>`<option value="${esc(v)}"${(st.f[f.key]||'')===v?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`).join('');
  return `<div class="toolbar"><div><h2>${cfg.title}</h2><div class="muted" id="listCount">${s.arr.length} из ${s.total}</div><div class="muted">${cfg.desc||''}</div></div><div class="spacer"></div>
    <div class="filters">${filters}<div><label>Поиск</label><input class="search" data-list-q value="${esc(st.q)}" placeholder="Поиск…"></div></div></div>
    <div id="listWrap">${listBody(cfg)}</div>`;
}
function refreshList(){
  const cfg=ui.listCfg; if(!cfg) return;
  const s=listState(cfg), wrap=document.getElementById('listWrap'), cnt=document.getElementById('listCount');
  if(wrap) wrap.innerHTML=listBody(cfg);
  if(cnt) cnt.textContent=s.arr.length+' из '+s.total;
  applyThumbs();
}

/* ---------- события (делегирование) ---------- */
document.addEventListener('click',e=>{
  const ent=e.target.closest('[data-k]');
  if(ent&&!ent.classList.contains('bad')){ openEntity(ent.dataset.k,ent.dataset.id); return; }
  const nav=e.target.closest('.navbtn'); if(nav){ gotoView(nav.dataset.view); return; }
  const act=e.target.closest('[data-act]'); if(!act) return;
  if(act.dataset.act==='back') goBack();
  else if(act.dataset.act==='view') gotoView(act.dataset.view);
  else if(act.dataset.act==='filter'){ const f={}; f[act.dataset.fk]=act.dataset.fv; gotoView(act.dataset.view,f); }
});
document.addEventListener('input',e=>{ if(e.target.matches('[data-list-q]')&&ui.listCfg){ vstate(ui.listCfg.view).q=e.target.value; refreshList(); } });
document.addEventListener('change',e=>{ if(e.target.matches('[data-list-f]')&&ui.listCfg){ vstate(ui.listCfg.view).f[e.target.dataset.listF]=e.target.value; refreshList(); } });
