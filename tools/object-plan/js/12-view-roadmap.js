/* ============================================================
   MODULE 12 — VIEW: ROADMAP («порядок создания»)
   Волны считаются из «сначала создай» (req): волна 0 — то, что ни от чего не зависит, дальше — то, что из него делается.
   Внутри волны — по приоритету. Можно скрыть готовое и отфильтровать по приоритету.
   ============================================================ */

function roadmapBody(){
  const f=ui.f, parts=[]; let shown=0;
  WAVES.forEach((list,n)=>{
    const rows=list.filter(i=>(f.rprio===''||String(i.p)===String(f.rprio))&&(f.rhide!=='1'||!['done','skip'].includes(statusOf(i)))).sort((a,b)=>(a.p-b.p)||(a.layer-b.layer)||a.n.localeCompare(b.n,'ru'));
    if(!rows.length) return;
    shown+=rows.length;
    const done=list.filter(isDone).length;
    parts.push(`<div class="card wave"><div class="grouphead"><b>Волна ${n}</b><span class="muted">${n===0?'ничего не требует — можно делать сразу':'нужны объекты из волн 0…'+(n-1)}</span><span class="muted">${done} / ${list.length} готово</span>${progressBar(done,list.length)}</div>
      ${rows.map(i=>{ const bl=blockedBy(i), s=statusOf(i);
        return `<div class="reqrow${s==='skip'?' dim':''}" data-item="${esc(i.id)}"><input type="checkbox" class="chk" data-check="${esc(i.id)}" ${s==='done'?'checked':''}>
          <div class="nm"><b>${esc(i.n)}</b> <span class="muted small">${esc(catName(i.c))} · ${esc(groupName(i.g))}</span>
          <div class="muted small">${i.req.length?'из: '+i.req.map(r=>esc((BY_ID.get(r)||{}).n||r)).join(', '):'без требований'}</div></div>
          ${bl.length?`<span class="tag warn" title="${esc(bl.join(', '))}">ждёт: ${bl.length}</span>`:''}${prioBadge(i.p)}${statusBadge(i)}</div>`; }).join('')}</div>`);
  });
  return {html:parts.join('')||'<div class="empty">Нечего показывать — всё готово или отфильтровано.</div>',shown};
}
VIEW_RENDERERS.roadmap=function(){
  const f=ui.f, b=roadmapBody();
  const bad=ITEMS.filter(i=>i.cyclic).length;
  return `<div class="toolbar"><div><h2>Порядок создания</h2><div class="muted">Волны по зависимостям: делай сверху вниз. Показано объектов: ${b.shown}</div></div></div>
  ${bad?`<div class="problem err">В плане есть циклические требования (${bad}) — см. «Проверки плана».</div>`:''}
  <div class="filters" style="margin-bottom:12px">
    <div><label>Приоритет</label><select data-f="rprio"><option value="">Все</option>${PRIORITIES.map(p=>`<option value="${p.id}"${String(f.rprio)===String(p.id)?' selected':''}>P${p.id}</option>`).join('')}</select></div>
    <div><label>Готовые</label><label style="display:flex;gap:6px;align-items:center;margin:0;padding:7px 0"><input type="checkbox" data-f="rhide" value="1" ${f.rhide==='1'?'checked':''}> скрыть готовые и отложенные</label></div>
  </div>${b.html}`;
};
