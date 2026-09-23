/* ============================================================
   MODULE 10 — VIEW: CHECKLIST
   Основной список: разделы → объекты, с галочкой «готово», приоритетом, статусом, шагами и признаком «найден в проекте».
   Фильтры: раздел, приоритет, статус, категория ОС, система, тип комнаты, «доступные сейчас», поиск.
   ============================================================ */

function checklistFilter(i){
  const f=ui.f, q=(f.q||'').trim().toLowerCase();
  if(f.group&&i.g!==f.group) return false;
  if(f.prio!==''&&String(i.p)!==String(f.prio)) return false;
  if(f.status&&statusOf(i)!==f.status) return false;
  if(f.cat&&i.c!==f.cat) return false;
  if(f.sys&&!i.sys.includes(f.sys)) return false;
  if(f.room&&!i.rooms.includes(f.room)) return false;
  if(f.avail==='1'&&(['done','skip'].includes(statusOf(i))||blockedBy(i).length)) return false;
  if(q&&!i.search.includes(q)) return false;
  return true;
}
function checklistRow(i){
  const st=stepStats(i), blocked=blockedBy(i), f=found(i), s=statusOf(i);
  const foundCell=PROJECT.scanned?(f?`<span class="tag ok" title="Найден в data/objects">в проекте${f.category&&f.category!==i.c?` · категория ${esc(f.category)}`:''}</span>`:'<span class="muted small">нет</span>'):'<span class="muted small">—</span>';
  return `<tr class="click${s==='skip'?' dim':''}" data-item="${esc(i.id)}">
    <td style="width:26px"><input type="checkbox" class="chk" data-check="${esc(i.id)}" ${s==='done'?'checked':''} title="Отметить готовым"></td>
    <td><b>${esc(i.n)}</b> <span class="muted small">${esc(i.id)}</span><div class="muted small">${esc(catName(i.c))}${i.s?' · '+esc(i.s):''}</div></td>
    <td>${prioBadge(i.p)}</td>
    <td class="muted" style="max-width:340px">${esc(i.fn.slice(0,120))}${i.fn.length>120?'…':''}</td>
    <td>${blocked.length?`<span class="tag warn" title="Сначала создай: ${esc(blocked.join(', '))}">ждёт: ${blocked.length}</span>`:(i.req.length?'<span class="tag ok">можно</span>':'<span class="muted small">—</span>')}</td>
    <td style="width:110px">${st.done}/${st.total}${progressBar(st.done,st.total,s==='wip'?'wip':'')}</td>
    <td>${statusBadge(i)}</td><td>${foundCell}</td></tr>`;
}
function checklistBody(){
  const parts=[]; let shown=0;
  effectiveGroups().forEach(g=>{
    const all=ITEMS.filter(i=>i.g===g.id); if(!all.length) return;
    const list=all.filter(checklistFilter).sort((a,b)=>(a.p-b.p)||a.n.localeCompare(b.n,'ru')); if(!list.length) return;
    shown+=list.length;
    const done=all.filter(isDone).length;
    parts.push(`<div class="card"><div class="grouphead"><b>${esc(g.name)}</b><span class="muted">слой ${g.layer}</span><span class="muted">${done} / ${all.length} готово</span>${progressBar(done,all.length)}<span class="muted small" style="margin-left:auto">${esc(g.desc)}</span></div>
      <table><thead><tr><th></th><th>Объект</th><th>Пр.</th><th>Функциональная способность</th><th>Требования</th><th>Шаги</th><th>Статус</th><th>Проект</th></tr></thead><tbody>${list.map(checklistRow).join('')}</tbody></table></div>`);
  });
  return {html:parts.join('')||'<div class="empty">Ничего не найдено — измени фильтры.</div>',shown};
}
VIEW_RENDERERS.checklist=function(){
  const f=ui.f, sel=(key,label,opts)=>`<div><label>${label}</label><select data-f="${key}">${opts.map(([v,l])=>`<option value="${esc(v)}"${String(f[key])===String(v)?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
  const body=checklistBody();
  return `<div class="toolbar"><div><h2>Чек-лист объектов</h2><div class="muted" id="clCount">Показано ${body.shown} из ${ITEMS.length}</div></div><div class="spacer"></div></div>
  <div class="filters" style="margin-bottom:12px">
    ${sel('group','Раздел',[['','Все']].concat(effectiveGroups().map(g=>[g.id,g.name])))}
    ${sel('prio','Приоритет',[['','Все']].concat(PRIORITIES.map(p=>[String(p.id),'P'+p.id])))}
    ${sel('status','Статус',[['','Все']].concat(STATUSES.map(s=>[s.id,s.name])))}
    ${sel('cat','Категория ОС',[['','Все']].concat(CATEGORIES.map(c=>[c.id,c.name])))}
    ${sel('sys','Система',[['','Все']].concat(SYSTEMS.map(s=>[s.id,s.name])))}
    ${sel('room','Тип комнаты',[['','Все']].concat(ROOM_TYPES.map(r=>[r.id,r.name])))}
    <div><label>Доступные сейчас</label><label style="display:flex;gap:6px;align-items:center;margin:0;padding:7px 0"><input type="checkbox" data-f="avail" value="1" ${f.avail==='1'?'checked':''}> все требования готовы</label></div>
    <div><label>Поиск</label><input class="search" data-f="q" value="${esc(f.q)}" placeholder="Название, функция, система…"></div>
  </div><div id="clBody">${body.html}</div>`;
};
REFRESH.checklist=function(){
  const b=checklistBody(), el=document.getElementById('clBody'), cnt=document.getElementById('clCount');
  if(el) el.innerHTML=b.html; if(cnt) cnt.textContent=`Показано ${b.shown} из ${ITEMS.length}`;
};
