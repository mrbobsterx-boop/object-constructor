/* ============================================================
   MODULE 17 — VIEW: ROADMAP (волны по req, поверх ВСЕХ 4 авторских каталогов сразу)
   Это и есть «чертёж, по которому создаём .tscn/.gd/.tres» — единый порядок постройки
   систем, компонентов, игровых объектов и данных, а не отдельный список на каждый каталог.
   ============================================================ */

function waveRow(i){
  return `<div class="reqrow"><span class="nm">${kindTag(i.kind)}${lnk(i.key)}${i.blocksScenes?badge('блокирует сцены','warn'):''}</span>${prioBadge(i.p)}${statusBadge(i)}</div>`;
}
function renderRoadmapBody(){
  const hidedone=ui.rhide!=='0';
  const onlyp0=ui.rprio==='1';
  return WAVES.map((items,idx)=>{
    let list=items.slice().sort((a,b)=>a.p-b.p||a.n.localeCompare(b.n));
    if(onlyp0) list=list.filter(i=>i.p===0);
    if(hidedone) list=list.filter(i=>!['done','skip'].includes(statusOf(i)));
    if(!list.length) return '';
    return `<div class="wave"><div class="wavehead">Волна ${idx} ${idx===0?'— ничего не требует (фундамент)':'— требует волну '+(idx-1)+' и ниже'}</div>${list.map(waveRow).join('')}</div>`;
  }).join('')||'<div class="empty">Под текущими фильтрами волн не осталось.</div>';
}
VIEW_RENDERERS.roadmap=function(){
  const cyc=[...BY_KEY.values()].filter(i=>i.cyclic);
  return `<div class="toolbar"><h2>Roadmap — единый порядок постройки</h2></div>
    <p class="muted">Волна 0 — элементы, которые ни от чего не зависят (мост данных, фундамент движка, атомарные UI-компоненты). Дальше — то, что из них строится, по <code>req</code> каждого элемента, независимо от каталога.</p>
    <div class="row" style="margin-bottom:10px">
      <label><input type="checkbox" data-f="rhide" ${ui.rhide==='1'?'checked':''}> скрыть готовое/отложенное</label>
      <label><input type="checkbox" data-f="rprio" ${ui.rprio==='1'?'checked':''}> только P0</label>
    </div>
    ${cyc.length?`<div class="problem err">Цикл в требованиях у: ${cyc.map(i=>lnk(i.key)).join(', ')} — волны для них не определены.</div>`:''}
    <div id="roadmapBody">${renderRoadmapBody()}</div>`;
};
REFRESH.roadmap=function(){
  ui.rhide=document.querySelector('[data-f="rhide"]')?.checked?'1':'0';
  ui.rprio=document.querySelector('[data-f="rprio"]')?.checked?'1':'0';
  const el=document.getElementById('roadmapBody'); if(el) el.innerHTML=renderRoadmapBody();
};
