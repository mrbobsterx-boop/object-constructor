/* ============================================================
   MODULE 08 — UI CORE
   Разделы, карточка объекта, «Назад», общие блоки разметки, делегирование событий.
   Разделы регистрируются в модулях 09–14: VIEW_RENDERERS[id] = () => html.
   Клики: data-item (открыть карточку), data-view (раздел), data-act (действие).
   Отметки: чекбокс data-check (готово), select data-status, чекбоксы шагов data-step, заметка data-note.
   ============================================================ */

const VIEWS=[
  {id:'overview',title:'Обзор'},{id:'checklist',title:'Чек-лист'},{id:'roadmap',title:'Порядок создания'},
  {id:'project',title:'Сверка с проектом'},{id:'dictionaries',title:'Справочники'},{id:'checks',title:'Проверки плана'},{id:'custom',title:'Свои объекты'}
];
const VIEW_RENDERERS={};
const REFRESH={};   // частичная перерисовка раздела при смене фильтров: REFRESH[view]()
const ui={view:'overview',item:null,stack:[],f:{group:'',prio:'',status:'',cat:'',sys:'',room:'',avail:'',q:'',rprio:'',rhide:'1'}};

/* ---------- разметка ---------- */
function lnk(id,label){
  const it=BY_ID.get(id), text=esc(label===undefined?(it?it.n:id):label);
  return it?`<a class="lnk" data-item="${esc(id)}" title="${esc(id)}">${text}</a>`:`<span class="lnk bad" title="Нет в плане">${text}</span>`;
}
function badge(text,cls){ return `<span class="badge ${cls||''}">${esc(text)}</span>`; }
function prioBadge(p){ return `<span class="prio p${p}" title="${esc((PRIORITIES.find(x=>x.id===p)||{}).name||'')}">P${p}</span>`; }
function catName(id){ const c=CATEGORIES.find(x=>x.id===id); return c?c.name:id; }
function groupName(id){ const g=effectiveGroups().find(x=>x.id===id); return g?g.name:id; }
function statusBadge(item){
  const st=statusOf(item), name=(STATUSES.find(s=>s.id===st)||{}).name||st;
  return `<span class="st ${st}">${esc(name)}</span>`+(statusIsAuto(item)&&st!=='todo'?' <span class="muted small" title="Определено автоматически по шагам и проекту">авто</span>':'');
}
function progressBar(done,total,cls){ return `<div class="bar"><i class="${cls||''}" style="width:${pct(done,total)}%"></i></div>`; }
function card(title,body,head){ return `<div class="card"><div class="cardhead"><b>${title}</b>${head||''}</div><div class="cardbody">${body}</div></div>`; }
function kv(rows){ return '<div class="kv">'+rows.map(([k,v])=>`<div>${esc(k)}</div><div>${(v===undefined||v===null||v==='')?'—':v}</div>`).join('')+'</div>'; }
function table(head,rows,empty){ return `<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${head.length}" class="empty">${empty||'Ничего нет.'}</td></tr>`}</tbody></table>`; }
function chipLink(view,fk,fv,label){ return `<span class="chip" data-act="filter" data-view="${esc(view)}" data-fk="${esc(fk)}" data-fv="${esc(fv)}">${esc(label)}</span>`; }
function tags(list,cls){ return (list||[]).map(t=>`<span class="tag ${cls||''}">${esc(t)}</span>`).join(''); }

/* ---------- навигация ---------- */
function openItem(id){ ui.stack.push({view:ui.view,item:ui.item}); ui.item=id; render(); document.getElementById('content').scrollTop=0; }
function goBack(){ const p=ui.stack.pop(); if(p){ ui.view=p.view; ui.item=p.item; } else ui.item=null; render(); }
function gotoView(view,filters){
  ui.stack=[]; ui.item=null; ui.view=view;
  if(view==='checklist'){ ui.f=Object.assign({group:'',prio:'',status:'',cat:'',sys:'',room:'',avail:'',q:'',rprio:ui.f.rprio,rhide:ui.f.rhide},filters||{}); }
  render(); document.getElementById('content').scrollTop=0;
}
function renderNav(){
  const bad=PLAN_PROBLEMS.filter(p=>p.level==='err').length;
  const cnt={checklist:ITEMS.length,roadmap:WAVES.length,project:PROJECT.scanned?PROJECT.found.size:'',checks:PLAN_PROBLEMS.filter(p=>p.level!=='info').length,custom:(store.custom||[]).length};
  document.getElementById('navList').innerHTML=VIEWS.map(v=>{
    const n=cnt[v.id]; const err=(v.id==='checks'&&bad);
    return `<button class="navbtn${(!ui.item&&ui.view===v.id)?' active':''}" data-view="${v.id}">${esc(v.title)}<span class="cnt${err?' err':''}">${n===undefined||n===''?'':fmt(n)}</span></button>`;
  }).join('');
}
function planTotals(){
  const c={done:0,wip:0,todo:0,skip:0};
  ITEMS.forEach(i=>c[statusOf(i)]++);
  return c;
}
function updateSidebar(){
  const c=planTotals(), total=ITEMS.length, active=total-c.skip;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=fmt(v); };
  set('sDone',c.done); set('sWip',c.wip); set('sTodo',c.todo); set('sTotal',total);
  const bar=document.getElementById('sBar'); if(bar) bar.style.width=pct(c.done,active)+'%';
  const p=document.getElementById('sPct'); if(p) p.textContent=`${pct(c.done,active)} % готово (без отложенных: ${fmt(active)})`;
  const ps=document.getElementById('projSummary');
  if(ps) ps.innerHTML=PROJECT.scanned?`В проекте объектов: <b>${fmt(PROJECT.found.size)}</b>, из плана найдено: <b>${fmt(ITEMS.filter(found).length)}</b>, вне плана: <b>${fmt(PROJECT.extra.length)}</b>.<br><span class="small">Сверка: ${PROJECT.at.toLocaleTimeString()}</span>`:'Папка не подключена. Объекты, найденные в data/objects, отмечаются автоматически.';
}
function render(){
  renderNav(); updateSidebar();
  const c=document.getElementById('content');
  try{ c.innerHTML=ui.item?(VIEW_RENDERERS.card?VIEW_RENDERERS.card(ui.item):''):((VIEW_RENDERERS[ui.view]||(()=>''))()); }
  catch(e){ console.error(e); c.innerHTML=`<div class="problem err">Ошибка отрисовки: ${esc(e.message)}</div>`; }
}
function rerender(){ const c=document.getElementById('content'), y=c.scrollTop; render(); c.scrollTop=y; }

/* ---------- копирование значения в буфер (data-copy) ---------- */
function copyText(el){
  const t=el.dataset.copy||'', isBtn=el.tagName==='BUTTON';
  if(isBtn&&el.dataset.orig===undefined) el.dataset.orig=el.textContent;
  const ok=()=>{ el.classList.add('copied'); if(isBtn) el.textContent='✓ Скопировано'; setTimeout(()=>{ el.classList.remove('copied'); if(isBtn) el.textContent=el.dataset.orig; },900); };
  const fb=()=>{ const ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); ok(); }catch(e){} ta.remove(); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok,fb); else fb();
}

/* ---------- события (делегирование) ---------- */
document.addEventListener('click',e=>{
  const it=e.target.closest('[data-item]');
  if(it&&!e.target.closest('input,select,textarea')){ openItem(it.dataset.item); return; }
  const nav=e.target.closest('.navbtn'); if(nav){ gotoView(nav.dataset.view); return; }
  const act=e.target.closest('[data-act]'); if(!act) return;
  const a=act.dataset.act;
  if(a==='back') goBack();
  else if(a==='view') gotoView(act.dataset.view);
  else if(a==='filter'){ const f={}; f[act.dataset.fk]=act.dataset.fv; gotoView(act.dataset.view,f); }
  else if(a==='mark-done'){ setStatus(act.dataset.id,'done'); rerender(); }
  else if(a==='scan') scanProjectObjects();
  else if(a==='copy') copyText(act);
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('[data-check]')){ setStatus(t.dataset.check,t.checked?'done':'todo'); rerender(); return; }
  if(t.matches('[data-status]')){ setStatus(t.dataset.status,t.value==='auto'?null:t.value); rerender(); return; }
  if(t.matches('[data-step]')){ setStep(t.dataset.item,t.dataset.step,t.checked); rerender(); return; }
  if(t.matches('[data-f]')){
    if(t.tagName==='INPUT'&&t.type==='text') return;   // текстовое поле обрабатывается по input; change при потере фокуса перерисовал бы список между нажатием и отпусканием мыши
    ui.f[t.dataset.f]=(t.type==='checkbox')?(t.checked?'1':''):t.value; (REFRESH[ui.view]||rerender)(); return; }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.matches('[data-note]')){ setNote(t.dataset.note,t.value); return; }
  if(t.matches('[data-f="q"]')){ ui.f.q=t.value; (REFRESH[ui.view]||rerender)(); }
});
