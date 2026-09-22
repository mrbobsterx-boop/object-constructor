/* ============================================================
   MODULE 12 — UI CORE
   Разделы, карточка (любой из 5 видов элементов), «Назад», общие блоки разметки,
   делегирование событий. Разделы регистрируются в модулях 13–19: VIEW_RENDERERS[id] = () => html.
   Ключ элемента: 'sys:<id>' / 'comp:<id>' / 'obj:<id>' / 'dat:<id>' — авторские каталоги (BY_KEY);
   'room:<id>' / 'bld:<id>' — сцены из проекта (SCENE_BY_KEY).
   Клики: data-item (открыть карточку по ключу), data-view (раздел), data-act (действие).
   ============================================================ */

const VIEWS=[
  {id:'overview',title:'Обзор'},
  {id:'systems',title:'Системы'},{id:'scenes',title:'Сцены'},
  {id:'components',title:'Компоненты'},{id:'gameobjects',title:'Игровые объекты'},{id:'data',title:'Данные'},
  {id:'relations',title:'Связи'},{id:'roadmap',title:'Roadmap'},
  {id:'project',title:'Проект'},{id:'reference',title:'Справочники'}
];
const VIEW_KIND={systems:'system',components:'component',gameobjects:'gameobject',data:'data'};
const VIEW_RENDERERS={};
const REFRESH={};
const ui={
  view:'overview', item:null, stack:[],
  f:{system:{g:'',p:'',status:'',search:''},component:{g:'',p:'',status:'',search:''},gameobject:{g:'',p:'',status:'',search:''},data:{g:'',p:'',status:'',search:''},scene:{kind:'',status:'',search:''},relations:{kind:'',search:''}},
  rhide:'1', rprio:''
};

function catalogList(kind){ return kind==='system'?SYSTEMS:kind==='component'?COMPONENTS:kind==='gameobject'?GAMEOBJECTS:DOMAINS; }
function itemByKey(key){ if(!key) return null; return BY_KEY.get(key)||SCENE_BY_KEY.get(key)||null; }

/* ---------- разметка ---------- */
function lnk(key,label){
  const it=itemByKey(key), text=esc(label===undefined?(it?(it.n||it.name):key):label);
  return it?`<a class="lnk" data-item="${esc(key)}" title="${esc(key)}">${text}</a>`:`<span class="lnk bad" title="Нет в плане">${text}</span>`;
}
function badge(text,cls){ return `<span class="badge ${cls||''}">${esc(text)}</span>`; }
function prioBadge(p){ return `<span class="prio p${p}" title="${esc((PRIORITIES.find(x=>x.id===p)||{}).name||'')}">P${p}</span>`; }
function groupName(kind,id){ const g=groupById(kind,id); return g?g.name:id; }
const KIND_LABEL={system:'система',component:'компонент',gameobject:'объект',data:'данные',room:'комната',building:'здание'};
function kindTag(kind){ return `<span class="kindtag ${kind}">${esc(KIND_LABEL[kind]||kind)}</span>`; }
function statusBadge(item){
  const st=statusOf(item), name=(STATUSES.find(s=>s.id===st)||{}).name||st;
  return `<span class="st ${st}">${esc(name)}</span>`+(statusIsAuto(item)&&st!=='todo'?' <span class="muted small" title="Определено автоматически по шагам и проекту">авто</span>':'');
}
function progressBar(done,total,cls){ return `<div class="bar"><i class="${cls||''}" style="width:${pct(done,total)}%"></i></div>`; }
function card(title,body,head){ return `<div class="card"><div class="cardhead"><b>${title}</b>${head||''}</div><div class="cardbody">${body}</div></div>`; }
function kv(rows){ return '<div class="kv">'+rows.map(([k,v])=>`<div>${esc(k)}</div><div>${(v===undefined||v===null||v==='')?'—':v}</div>`).join('')+'</div>'; }
function table(head,rows,empty){ return `<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${head.length}" class="empty">${empty||'Ничего нет.'}</td></tr>`}</tbody></table>`; }
function chipLink(view,fk,fv,which,label){ return `<span class="chip" data-act="filter" data-view="${esc(view)}" data-which="${esc(which)}" data-fk="${esc(fk)}" data-fv="${esc(fv)}">${esc(label)}</span>`; }
function tags(list,cls){ return (list||[]).map(t=>`<span class="tag ${cls||''}">${esc(t)}</span>`).join(''); }

/* ---------- навигация ---------- */
function openItem(key){ ui.stack.push({view:ui.view,item:ui.item}); ui.item=key; render(); document.getElementById('content').scrollTop=0; }
function goBack(){ const p=ui.stack.pop(); if(p){ ui.view=p.view; ui.item=p.item; } else ui.item=null; render(); }
const FILTER_DEFAULTS={system:{g:'',p:'',status:'',search:''},component:{g:'',p:'',status:'',search:''},gameobject:{g:'',p:'',status:'',search:''},data:{g:'',p:'',status:'',search:''},scene:{kind:'',status:'',search:''},relations:{kind:'',search:''}};
function gotoView(view,filters,which){
  ui.stack=[]; ui.item=null; ui.view=view;
  if(which&&ui.f[which]) ui.f[which]=Object.assign({},FILTER_DEFAULTS[which],filters||{});
  render(); document.getElementById('content').scrollTop=0;
}
function totals(list){ const c={done:0,wip:0,todo:0,skip:0}; list.forEach(i=>c[statusOf(i)]++); return c; }
function renderNav(){
  const bad=PLAN_PROBLEMS.filter(p=>p.level==='err').length;
  const cnt={overview:'',systems:SYSTEMS.length,scenes:SCENES.length,components:COMPONENTS.length,gameobjects:GAMEOBJECTS.length,data:DOMAINS.length,
    relations:'',roadmap:WAVES.length,project:PROJECT.scanned?SCENES.length:'',reference:PLAN_PROBLEMS.filter(p=>p.level!=='info').length};
  document.getElementById('navList').innerHTML=VIEWS.map(v=>{
    const n=cnt[v.id]; const err=(v.id==='reference'&&bad);
    return `<button class="navbtn${(!ui.item&&ui.view===v.id)?' active':''}" data-view="${v.id}">${esc(v.title)}<span class="cnt${err?' err':''}">${n===undefined||n===''?'':fmt(n)}</span></button>`;
  }).join('');
}
function renderProgressPanel(){
  const rows=[
    ['systems','Системы',SYSTEMS],['components','Компоненты',COMPONENTS],['gameobjects','Игровые объекты',GAMEOBJECTS],
    ['data','Данные',DOMAINS],['scenes','Сцены',SCENES]
  ];
  document.getElementById('progressPanel').innerHTML=rows.map(([view,label,list])=>{
    const c=totals(list), total=list.length, active=total-c.skip;
    return `<div class="progrow click" data-act="view" data-view="${view}">
      <div class="progrow-top"><span>${esc(label)}</span><span class="muted small">${c.done}/${total}</span></div>
      ${progressBar(c.done,active)}
    </div>`;
  }).join('');
}
function updateSidebar(){
  renderProgressPanel();
  const ps=document.getElementById('projSummary');
  if(ps) ps.innerHTML=PROJECT.scanned?`Комнат: <b>${fmt(SCENES.filter(s=>s.kind==='room').length)}</b>, зданий: <b>${fmt(SCENES.filter(s=>s.kind==='building').length)}</b>. Автозагрузок Godot найдено: <b>${fmt(PROJECT.autoloads.size)}</b>.<br><span class="small">Сверка: ${PROJECT.at.toLocaleTimeString()}</span>`:'Папка не подключена. Комнаты и здания читаются из data/rooms и data/buildings, .tscn ищутся в папке сцен Godot.';
}
function render(){
  renderNav(); updateSidebar();
  const c=document.getElementById('content');
  try{ c.innerHTML=ui.item?(VIEW_RENDERERS.card?VIEW_RENDERERS.card(ui.item):''):((VIEW_RENDERERS[ui.view]||(()=>''))()); }
  catch(e){ console.error(e); c.innerHTML=`<div class="problem err">Ошибка отрисовки: ${esc(e.message)}</div>`; }
}
function rerender(){ const c=document.getElementById('content'), y=c.scrollTop; render(); c.scrollTop=y; }

/* ---------- события (делегирование) ---------- */
document.addEventListener('click',e=>{
  const it=e.target.closest('[data-item]');
  if(it&&!e.target.closest('input,select,textarea')){ openItem(it.dataset.item); return; }
  const nav=e.target.closest('.navbtn'); if(nav){ gotoView(nav.dataset.view); return; }
  const act=e.target.closest('[data-act]'); if(!act) return;
  const a=act.dataset.act;
  if(a==='back') goBack();
  else if(a==='view') gotoView(act.dataset.view);
  else if(a==='filter'){ const f={}; f[act.dataset.fk]=act.dataset.fv; gotoView(act.dataset.view,f,act.dataset.which); }
  else if(a==='mark-done'){ setStatus(act.dataset.key,'done'); rerender(); }
  else if(a==='scan') scanProject();
  else if(a==='remove-custom'){ if(confirm('Удалить свой элемент?')){ removeCustomItem(act.dataset.kind,act.dataset.id); rerender(); } }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('[data-check]')){ setStatus(t.dataset.check,t.checked?'done':'todo'); rerender(); return; }
  if(t.matches('[data-status]')){ setStatus(t.dataset.status,t.value==='auto'?null:t.value); rerender(); return; }
  if(t.matches('[data-step]')){ setStep(t.dataset.item,t.dataset.step,t.checked); rerender(); return; }
  if(t.matches('[data-settings]')){ store.settings[t.dataset.settings]=t.value; saveStore(); return; }
  if(t.matches('[data-f]')){
    if(t.tagName==='INPUT'&&t.type==='text') return;
    const which=t.dataset.which, f=ui.f[which];
    if(f) f[t.dataset.f]=(t.type==='checkbox')?(t.checked?'1':''):t.value;
    else if(t.dataset.f==='rhide'||t.dataset.f==='rprio') ui[t.dataset.f]=t.checked?'1':'';
    (REFRESH[ui.view]||rerender)(); return; }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.matches('[data-note]')){ setNote(t.dataset.note,t.value); return; }
  if(t.matches('[data-f="search"]')){ const f=ui.f[t.dataset.which]; if(f) f.search=t.value; (REFRESH[ui.view]||rerender)(); }
});

/* ---------- общие блоки карточки (используются авторскими карточками и карточкой сцены) ---------- */
function backBtn(){ return `<button data-act="back">← Назад</button>`; }
function statusSelect(item){
  const cur=store.status[item.key]||'auto';
  const opt=(v,label)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(label)}</option>`;
  return `<select data-status="${esc(item.key)}">${opt('auto','Авто (по шагам)')}${STATUSES.map(s=>opt(s.id,s.name)).join('')}</select>`;
}
function stepsBlock(item){
  const list=stepList(item);
  return `<div class="steps">${list.map(s=>{
    const auto=autoStepDone(item,s.id), man=stepManual(item,s.id), done=auto||man;
    return `<label><input type="checkbox" class="chk" data-item="${esc(item.key)}" data-step="${esc(s.id)}" ${done?'checked':''} ${auto?'disabled':''}>${esc(s.label)}${auto?' <span class="auto">✓ найдено в проекте</span>':''}</label>`;
  }).join('')}</div>`;
}
function noteBlock(item){
  return `<label>Заметка</label><textarea data-note="${esc(item.key)}" placeholder="свободный текст…">${esc(store.notes[item.key]||'')}</textarea>`;
}
