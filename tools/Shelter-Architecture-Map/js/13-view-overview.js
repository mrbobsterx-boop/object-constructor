/* ============================================================
   MODULE 13 — VIEW: ОБЗОР
   ============================================================ */

function allAuthored(){ return [...SYSTEMS,...COMPONENTS,...GAMEOBJECTS,...DOMAINS]; }
function nextItems(n){
  return allAuthored().filter(i=>!['done','skip'].includes(statusOf(i))&&blockedBy(i).length===0)
    .sort((a,b)=>a.p-b.p||a.wave-b.wave).slice(0,n);
}
function nextScenes(n){
  return SCENES.filter(i=>!['done','skip'].includes(statusOf(i))).sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id)).slice(0,n);
}
function progressByLayer(){
  const rows=[];
  for(let l=1;l<=8;l++){
    const groups=SYS_GROUPS.filter(g=>g.layer===l);
    const items=SYSTEMS.filter(i=>groups.some(g=>g.id===i.g));
    if(!items.length) continue;
    const c=totals(items);
    rows.push({l,name:LAYERS[l],c,total:items.length});
  }
  return rows;
}

VIEW_RENDERERS.overview=function(){
  const blockers=blockingSystems();
  const banner=blockers.length?`<div class="blockedbanner">⛔ Рано собирать сцены и объекты «по-настоящему»: не готов фундамент — ${blockers.map(b=>lnk(b.key)).join(', ')}. Сначала мост данных и фундамент движка (слой 1).</div>`:'';

  const catCards=['system','component','gameobject','data'].map(kind=>{
    const meta=CATALOGS[kind], list=catalogList(kind), c=totals(list);
    return `<div class="stat click" data-act="view" data-view="${kind==='system'?'systems':kind==='gameobject'?'gameobjects':kind==='component'?'components':'data'}">
      <div class="n">${c.done}/${list.length}</div><div class="t">${esc(meta.label)}</div>
    </div>`;
  }).join('');

  const layerRows=progressByLayer().map(r=>`
    <div class="grouphead click" data-act="view" data-view="systems">
      <b>Слой ${r.l} · ${esc(r.name)}</b>
      <span class="muted">${r.c.done}/${r.total} готово</span>
      ${progressBar(r.c.done,r.total-r.c.skip)}
    </div>`).join('');

  const nextRows=nextItems(8).map(i=>`
    <div class="reqrow"><span class="nm">${kindTag(i.kind)}${lnk(i.key)}</span>${prioBadge(i.p)}${statusBadge(i)}</div>`).join('')||'<div class="empty">Всё доступное уже готово или отложено.</div>';

  const nextScnRows=blockers.length?'':(nextScenes(8).map(i=>`
    <div class="reqrow"><span class="nm">${kindTag(i.kind)}${lnk(i.key,i.name)}</span>${statusBadge(i)}</div>`).join('')||'<div class="empty">Все сцены готовы (или проект не подключён).</div>');

  return `
    <div class="toolbar"><h2>Обзор</h2></div>
    ${banner}
    <div class="statgrid wide" style="margin-bottom:14px">${catCards}</div>
    <div class="two">
      <div class="card"><div class="cardhead"><b>Что делать дальше — чертёж</b></div><div class="cardbody">${nextRows}</div></div>
      <div class="card"><div class="cardhead"><b>Что делать дальше — сцены</b></div><div class="cardbody">${blockers.length?'<div class="muted">Сначала закрой блокирующие системы выше.</div>':nextScnRows}</div></div>
    </div>
    <div class="card"><div class="cardhead"><b>Слои разработки (системы)</b></div><div class="cardbody">${layerRows}</div></div>
  `;
};
