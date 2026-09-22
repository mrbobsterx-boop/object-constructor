/* ============================================================
   MODULE 13 — VIEW: PROJECT (сверка с проектом)
   Что из плана уже есть в data/objects, где расходятся категория и размер, какие объекты в проекте не входят в план.
   Кнопка «Добавить в план» превращает объект проекта в «свой объект» плана.
   ============================================================ */

const GROUP_BY_CATEGORY={furniture:'home',decor:'home',container:'storage',workbench:'production',machine:'energy',tool:'tools',weapon:'weapons',clothing:'clothes',item:'materials',
  block:'blocks',door:'structures',building:'structures',plant:'farm',resource:'world',character:'people',creature:'people',corpse:'death',special:'special'};
function adoptFromProject(id){
  const f=PROJECT.found.get(id); if(!f||BY_ID.has(id)) return;
  store.custom.push({id:f.id,n:f.name,c:CATEGORIES.some(c=>c.id===f.category)?f.category:'special',g:GROUP_BY_CATEGORY[f.category]||'special',p:1,sz:(f.w&&f.h)?[f.w,f.h]:null,
    why:'Добавлено из проекта: объект уже создан в ОС, но его не было в плане.',fn:'',use:'',note:'Заполни описание, вариации и связи.'});
  saveStore(); buildModel(); PROJECT.extra=[...PROJECT.found.values()].filter(o=>!BY_ID.has(o.id)); render();
}
document.addEventListener('click',e=>{ const a=e.target.closest('[data-act="adopt"]'); if(a){ adoptFromProject(a.dataset.id); } });

VIEW_RENDERERS.project=function(){
  if(!PROJECT.scanned) return `<div class="toolbar"><div><h2>Сверка с проектом</h2></div></div>
    <div class="card"><div class="cardbody">Папка проекта не подключена или ещё не просканирована.<br><br><button class="primary" id="btnConnect2" onclick="connectProjectFolder()">📁 Подключить папку проекта</button></div></div>`;
  const inPlan=ITEMS.filter(found), missing=ITEMS.filter(i=>!found(i));
  const missingP0=missing.filter(i=>i.p===0);
  const rows=inPlan.map(i=>{
    const f=found(i), st=stepStats(i), catOk=f.category===i.c;
    return `<tr class="click" data-item="${esc(i.id)}"><td><b>${esc(i.n)}</b> <span class="muted small">${esc(i.id)}</span></td><td>${catOk?esc(f.category):`<span class="warn">${esc(f.category||'—')}</span> <span class="muted small">план: ${esc(i.c)}</span>`}</td>
      <td>${f.w&&f.h?`${f.w}×${f.h}`:'<span class="warn">нет</span>'}${i.sz?` <span class="muted small">реком. ${i.sz[0]}×${i.sz[1]}</span>`:''}</td>
      <td>${f.asset?(PROJECT.sprites.has(f.asset)?'<span class="ok">✓</span>':'<span class="err">файла нет</span>'):'<span class="warn">нет</span>'}</td>
      <td>${PROJECT.usage.get(i.id)||0}</td><td>${st.done}/${st.total}</td><td>${statusBadge(i)}</td></tr>`;
  });
  const missRows=missing.sort((a,b)=>(a.p-b.p)||(a.wave-b.wave)).slice(0,80).map(i=>`<tr class="click" data-item="${esc(i.id)}"><td><b>${esc(i.n)}</b> <span class="muted small">${esc(i.id)}</span></td><td>${esc(catName(i.c))}</td><td>${prioBadge(i.p)}</td><td>${blockedBy(i).length?`<span class="tag warn">ждёт: ${blockedBy(i).length}</span>`:'<span class="tag ok">можно</span>'}</td></tr>`);
  const extraRows=PROJECT.extra.map(o=>`<tr><td><b>${esc(o.name)}</b> <span class="muted small">${esc(o.id)}</span></td><td>${esc(o.category||'—')}</td><td>${o.w&&o.h?`${o.w}×${o.h}`:'—'}</td><td>${PROJECT.usage.get(o.id)||0}</td><td><button data-act="adopt" data-id="${esc(o.id)}">➕ Добавить в план</button></td></tr>`);
  const doneAuto=inPlan.filter(i=>statusIsAuto(i)&&isDone(i)).length;
  return `<div class="toolbar"><div><h2>Сверка с проектом</h2><div class="muted">Папка: ${esc(projectDirHandle?projectDirHandle.name:'')} · ${PROJECT.at?PROJECT.at.toLocaleString('ru-RU'):''}</div></div><div class="spacer"></div><button data-act="scan">🔄 Пересканировать</button></div>
  ${PROJECT.missingObjects?'<div class="problem warn">В папке проекта нет data/objects.</div>':''}
  ${card('Итог',`<div class="statgrid wide"><div class="stat"><div class="n">${PROJECT.found.size}</div><div class="t">объектов в проекте</div></div><div class="stat"><div class="n">${inPlan.length}</div><div class="t">из плана уже созданы</div></div><div class="stat"><div class="n">${missing.length}</div><div class="t">из плана ещё нет</div></div><div class="stat"><div class="n">${missingP0.length}</div><div class="t">P0 ещё нет</div></div><div class="stat"><div class="n">${PROJECT.extra.length}</div><div class="t">вне плана</div></div><div class="stat"><div class="n">${doneAuto}</div><div class="t">готовы автоматически</div></div></div>`)}
  ${card('Из плана — уже в проекте ('+inPlan.length+')',table(['Объект','Категория','Размер, см','Картинка','Использований','Шаги','Статус'],rows,'Пока ни один объект плана не найден в data/objects.'))}
  ${card('Из плана — ещё не создано ('+missing.length+(missing.length>80?', показаны первые 80':'')+')',table(['Объект','Категория','Приоритет','Можно начинать'],missRows,'Все объекты плана уже есть в проекте.'))}
  ${card('В проекте, но не в плане ('+PROJECT.extra.length+')',table(['Объект','Категория','Размер, см','Использований',''],extraRows,'Все объекты проекта есть в плане.'))}`;
};
