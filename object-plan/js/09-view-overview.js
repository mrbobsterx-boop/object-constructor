/* ============================================================
   MODULE 09 — VIEW: OVERVIEW
   Прогресс по приоритетам и разделам, «следующие шаги» (что можно делать прямо сейчас).
   ============================================================ */

function nextSteps(limit){
  return ITEMS.filter(i=>!['done','skip'].includes(statusOf(i))&&blockedBy(i).length===0)
    .sort((a,b)=>(a.p-b.p)||(a.wave-b.wave)||(a.layer-b.layer)||a.n.localeCompare(b.n,'ru')).slice(0,limit||12);
}
VIEW_RENDERERS.overview=function(){
  const c=planTotals(), total=ITEMS.length, active=total-c.skip;
  const blocked=ITEMS.filter(i=>!['done','skip'].includes(statusOf(i))&&blockedBy(i).length>0).length;
  const stat=(n,t,fk,fv)=>`<div class="stat${fk?' click':''}"${fk?` data-act="filter" data-view="checklist" data-fk="${fk}" data-fv="${fv}"`:''}><div class="n">${fmt(n)}</div><div class="t">${t}</div></div>`;

  const prioRows=PRIORITIES.map(p=>{
    const list=ITEMS.filter(i=>i.p===p.id), done=list.filter(isDone).length;
    return `<tr class="click" data-act="filter" data-view="checklist" data-fk="prio" data-fv="${p.id}"><td>${prioBadge(p.id)} <span class="muted">${esc(p.name.replace(/^P\d — /,''))}</span></td><td>${done} / ${list.length}</td><td style="width:35%">${progressBar(done,list.length)}</td></tr>`;
  });
  const groupRows=GROUPS.map(g=>{
    const list=ITEMS.filter(i=>i.g===g.id); if(!list.length) return '';
    const done=list.filter(isDone).length, wip=list.filter(i=>statusOf(i)==='wip').length;
    return `<tr class="click" data-act="filter" data-view="checklist" data-fk="group" data-fv="${g.id}"><td><b>${esc(g.name)}</b><div class="muted small">слой ${g.layer}: ${esc(LAYERS[g.layer]||'')}</div></td><td>${done} / ${list.length}${wip?` <span class="muted">(в работе ${wip})</span>`:''}</td><td style="width:35%">${progressBar(done,list.length)}</td></tr>`;
  }).filter(Boolean);

  const next=nextSteps(12);
  const nextRows=next.map(i=>`<div class="reqrow"><input type="checkbox" class="chk" data-check="${esc(i.id)}" title="Отметить готовым"><div class="nm">${lnk(i.id)} <span class="muted small">${esc(catName(i.c))}</span><div class="muted small">${esc(i.fn.slice(0,120))}${i.fn.length>120?'…':''}</div></div>${prioBadge(i.p)}<span class="muted small">волна ${i.wave}</span></div>`).join('');

  return `<div class="toolbar"><div><h2>Обзор</h2><div class="muted">План объектов: что создать в ОС, зачем, как они связаны — и что уже сделано</div></div></div>
  ${card('Прогресс',`<div class="statgrid wide">${stat(total,'объектов в плане')}${stat(c.done,'готово','status','done')}${stat(c.wip,'в работе','status','wip')}${stat(c.todo,'не начато','status','todo')}${stat(c.skip,'отложено','status','skip')}${stat(blocked,'ждут других объектов')}</div>
    <div class="bar big" style="margin-top:10px"><i style="width:${pct(c.done,active)}%"></i></div><div class="muted" style="margin-top:4px">${pct(c.done,active)} % (${c.done} из ${active}, без отложенных)</div>`)}
  <div class="two">
    ${card('Что делать дальше ('+next.length+')',nextRows||'<span class="ok">Всё, что доступно, уже сделано ✓</span>','<span class="muted small" style="margin-left:auto">P0 → P1 → P2, все требования выполнены</span>')}
    ${card('По приоритетам',table(['Приоритет','Готово',''],prioRows))}
  </div>
  ${card('По разделам (клик — открыть чек-лист раздела)',table(['Раздел','Готово',''],groupRows))}
  ${card('Как пользоваться',`<ul class="clean">
    <li><b>Чек-лист</b> — основной список: отмечай объекты готовыми галочкой; в карточке — зачем нужен, функция, вариации, параметры для ОС, связи и шаги.</li>
    <li><b>Порядок создания</b> — «волны»: сначала то, что ни от чего не зависит (материалы, инструменты), затем то, что из них делается.</li>
    <li><b>Сверка с проектом</b> — подключи папку: объекты, найденные в data/objects, отмечаются автоматически (картинка, размер, действия, рецепт, «используется»). Ручные отметки не пропадают.</li>
    <li>Отметки хранятся в браузере; кнопка «💾 Прогресс в проект» сохраняет их в data/object_plan.json.</li>
    <li>Не хватает объекта — добавь во вкладке «Свои объекты» или командой «Добавить в план» в сверке.</li></ul>`)}`;
};
