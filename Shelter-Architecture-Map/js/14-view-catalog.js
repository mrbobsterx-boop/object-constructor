/* ============================================================
   MODULE 14 — VIEW: АВТОРСКИЕ КАТАЛОГИ (Системы / Компоненты / Игровые объекты / Данные)
   Одна форма на все четыре — регистрируется четыре раза (внизу файла) вместо четырёх
   копий одного и того же кода. Карточка тоже общая — renderAuthoredCard.
   ============================================================ */

function filteredCatalog(kind){
  const f=ui.f[kind], q=(f.search||'').trim().toLowerCase(), list=catalogList(kind);
  return list.filter(i=>
    (!f.g||i.g===f.g) && (f.p===''||f.p===undefined||i.p===Number(f.p)) &&
    (!f.status||statusOf(i)===f.status) && (!q||i.search.indexOf(q)!==-1)
  );
}
function catalogRow(kind,i){
  const st=stepStats(i), blocked=blockedBy(i);
  return `<tr class="click" data-item="${esc(i.key)}">
    <td><input type="checkbox" class="chk" data-check="${esc(i.key)}" ${isDone(i)?'checked':''} onclick="event.stopPropagation()"></td>
    <td>${prioBadge(i.p)}</td>
    <td class="namecell"><b>${esc(i.n)}</b>${i.custom?badge('свой','new'):''}</td>
    <td>${esc(groupName(kind,i.g))}</td>
    <td>${blocked.length?`<span class="warn small">ждёт: ${blocked.length}</span>`:'<span class="ok small">можно</span>'}</td>
    <td>${st.done}/${st.total}${progressBar(st.done,st.total)}</td>
    <td>${statusBadge(i)}</td>
  </tr>`;
}
function groupHeading(kind,g){ return kind==='system'?`Слой ${g.layer} · ${g.name}`:g.name; }
function renderCatalogBody(kind){
  const list=filteredCatalog(kind);
  const groups=groupsOf(kind).filter(g=>list.some(i=>i.g===g.id));
  if(!groups.length) return '<div class="empty">Ничего не найдено под текущие фильтры.</div>';
  return groups.map(g=>{
    const items=list.filter(i=>i.g===g.id).sort((a,b)=>a.p-b.p||a.n.localeCompare(b.n));
    const done=items.filter(isDone).length;
    return `<div class="card">
      <div class="grouphead"><b>${esc(groupHeading(kind,g))}</b><span class="muted">${done}/${items.length}</span>${progressBar(done,items.length)}</div>
      <div class="cardbody" style="padding:0">${table(['','P',CATALOGS[kind].labelOne,'Раздел','Готовность к старту','Шаги','Статус'],items.map(i=>catalogRow(kind,i)))}</div>
    </div>`;
  }).join('');
}
function catalogFilterBar(kind){
  const f=ui.f[kind];
  const opt=(v,label,cur)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(label)}</option>`;
  return `<div class="filters">
    <div><label>Раздел</label><select data-f="g" data-which="${kind}">
      ${opt('','Все разделы',f.g)}${groupsOf(kind).map(g=>opt(g.id,groupHeading(kind,g),f.g)).join('')}
    </select></div>
    <div><label>Приоритет</label><select data-f="p" data-which="${kind}">
      ${opt('','Все',f.p)}${PRIORITIES.map(p=>opt(String(p.id),p.label,f.p)).join('')}
    </select></div>
    <div><label>Статус</label><select data-f="status" data-which="${kind}">
      ${opt('','Все',f.status)}${STATUSES.map(s=>opt(s.id,s.name,f.status)).join('')}
    </select></div>
    <div><label>Поиск</label><input class="search" data-f="search" data-which="${kind}" value="${esc(f.search)}" placeholder="имя, id, путь…"></div>
  </div>`;
}

function renderAuthoredCard(i){
  const meta=CATALOGS[i.kind];
  const usedBy=(REL.neededBy.get(i.key)||[]);
  const blocked=blockedBy(i);
  const rows=[['Зачем нужен',esc(i.why)],['Что делает / показывает',esc(i.fn)],['Раздел',esc(groupName(i.kind,i.g))],
    ['Путь файла',i.path?`<code>${esc(i.path)}</code>`:'—']];
  if(meta.hasAutoload) rows.push(['Autoload',i.autoload?`<code>${esc(i.autoload)}</code>`:'не синглтон']);
  if(i.reads&&i.reads.length) rows.push(['Читает',tags(i.reads)]);
  rows.push(['Открытый вопрос',i.note?esc(i.note):'—']);
  return `${backBtn()}
    <div class="toolbar"><h2>${kindTag(i.kind)}${esc(i.n)}</h2>${prioBadge(i.p)}${statusBadge(i)}${i.blocksScenes?badge('блокирует сцены','warn'):''}${i.custom?badge('свой','new'):''}</div>
    <div class="two">
      <div class="card"><div class="cardhead"><b>Что и зачем</b></div><div class="cardbody">${kv(rows)}</div></div>
      <div class="card"><div class="cardhead"><b>Отметка и статус</b></div><div class="cardbody">${statusSelect(i)}<div style="margin-top:10px">${noteBlock(i)}</div></div></div>
    </div>
    <div class="two">
      <div class="card"><div class="cardhead"><b>Сначала сделай (${i.req.length})</b></div><div class="cardbody">${i.req.length?i.req.map(r=>{
        const q=itemByKey(r); if(!q) return `<div class="reqrow err">req: «${esc(r)}» не найден ни в одном каталоге</div>`;
        return `<div class="reqrow"><span class="nm">${kindTag(q.kind)}${lnk(q.key)}</span>${statusBadge(q)}</div>`;
      }).join(''):'<div class="muted">Ни от чего не зависит — можно начинать в первую очередь.</div>'}</div></div>
      <div class="card"><div class="cardhead"><b>От него зависят (${usedBy.length})</b></div><div class="cardbody">${usedBy.length?usedBy.map(key=>{
        const q=itemByKey(key); return `<div class="reqrow"><span class="nm">${kindTag(q.kind)}${lnk(q.key)}</span>${statusBadge(q)}</div>`;
      }).join(''):'<div class="muted">Пока никто не требует.</div>'}</div></div>
    </div>
    ${blocked.length?`<div class="blockedbanner">Не готовы требования: ${blocked.map(r=>lnk(r)).join(', ')}</div>`:''}
    <div class="card"><div class="cardhead"><b>Шаги готовности</b></div><div class="cardbody">${stepsBlock(i)}</div></div>
    ${i.custom?`<button data-act="remove-custom" data-kind="${esc(i.kind)}" data-id="${esc(i.id)}">🗑 Удалить свой элемент</button>`:''}
  `;
}

['system','component','gameobject','data'].forEach(kind=>{
  const view=kind==='system'?'systems':kind==='gameobject'?'gameobjects':kind==='component'?'components':'data';
  VIEW_RENDERERS[view]=function(){
    return `<div class="toolbar"><h2>${esc(CATALOGS[kind].label)}</h2></div>
      ${catalogFilterBar(kind)}
      <div id="catBody_${view}" style="margin-top:12px">${renderCatalogBody(kind)}</div>`;
  };
  REFRESH[view]=function(){ const el=document.getElementById('catBody_'+view); if(el) el.innerHTML=renderCatalogBody(kind); updateSidebar(); };
});
