/* ============================================================
   MODULE 16 — VIEW: СВЯЗИ («кто что использует»)
   Единый граф req поверх четырёх авторских каталогов (Системы/Компоненты/Игровые объекты/
   Данные) — считается в 10-model.js (REL.neededBy). Сцены в граф не входят: у них нет req,
   для них есть отдельный сигнал «ждёт фундамент» (blockingSystems) на карточке и в чек-листе.
   ============================================================ */

function relationsList(){
  const f=ui.f.relations, q=(f.search||'').trim().toLowerCase();
  return [...BY_KEY.values()].filter(i=>
    (!f.kind||i.kind===f.kind) && (!q||i.search.indexOf(q)!==-1)
  );
}
function orphans(){
  return [...BY_KEY.values()].filter(i=>i.req.length===0 && (REL.neededBy.get(i.key)||[]).length===0);
}
function relRow(i){
  const usedBy=(REL.neededBy.get(i.key)||[]).length;
  return `<tr class="click" data-item="${esc(i.key)}">
    <td>${kindTag(i.kind)}</td>
    <td class="namecell"><b>${esc(i.n)}</b>${i.custom?badge('свой','new'):''}</td>
    <td>${esc(groupName(i.kind,i.g))}</td>
    <td>${i.req.length}</td>
    <td>${usedBy}</td>
    <td>${statusBadge(i)}</td>
  </tr>`;
}
function renderRelationsBody(){
  const list=relationsList().sort((a,b)=>(REL.neededBy.get(b.key)||[]).length-(REL.neededBy.get(a.key)||[]).length);
  const orph=orphans();
  const totalLinks=[...BY_KEY.values()].reduce((s,i)=>s+i.req.length,0);
  return `
    <div class="statgrid wide" style="margin-bottom:14px">
      <div class="stat"><div class="n">${fmt(BY_KEY.size)}</div><div class="t">Элементов в чертеже</div></div>
      <div class="stat"><div class="n">${fmt(totalLinks)}</div><div class="t">Связей (req) между ними</div></div>
      <div class="stat"><div class="n">${fmt(orph.length)}</div><div class="t">Изолированных (ни от чего не зависят и от них никто)</div></div>
    </div>
    ${orph.length?`<div class="card"><div class="cardhead"><b>Изолированные элементы</b></div><div class="cardbody">
      <p class="muted" style="margin-top:0">Ничего не требуют и ничего от них не требует — проверь, не забыт ли элемент при проектировании связей.</p>
      ${orph.map(i=>`<div class="reqrow"><span class="nm">${kindTag(i.kind)}${lnk(i.key)}</span>${statusBadge(i)}</div>`).join('')}
    </div></div>`:''}
    <div class="card"><div class="cardhead"><b>Все связи</b></div><div class="cardbody" style="padding:0">
      ${table(['Тип','Название','Раздел','Сначала (req)','От него зависят','Статус'],list.map(relRow),'Ничего не найдено под текущие фильтры.')}
    </div></div>
  `;
}
function relationsFilterBar(){
  const f=ui.f.relations;
  const opt=(v,label,cur)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(label)}</option>`;
  return `<div class="filters">
    <div><label>Каталог</label><select data-f="kind" data-which="relations">
      ${opt('','Все каталоги',f.kind)}${Object.keys(CATALOGS).map(k=>opt(k,CATALOGS[k].label,f.kind)).join('')}
    </select></div>
    <div><label>Поиск</label><input class="search" data-f="search" data-which="relations" value="${esc(f.search)}" placeholder="имя, id, путь…"></div>
  </div>`;
}
VIEW_RENDERERS.relations=function(){
  return `<div class="toolbar"><h2>Связи — кто что использует</h2></div>
    <p class="muted">Граф считается по полю <code>req</code> каждого элемента любого из четырёх каталогов — ключ может ссылаться на элемент из другого каталога (например, компонент <code>ItemSlot</code> требует игровой объект <code>Item</code>).</p>
    ${relationsFilterBar()}
    <div id="relationsBody" style="margin-top:12px">${renderRelationsBody()}</div>`;
};
REFRESH.relations=function(){ const el=document.getElementById('relationsBody'); if(el) el.innerHTML=renderRelationsBody(); updateSidebar(); };
