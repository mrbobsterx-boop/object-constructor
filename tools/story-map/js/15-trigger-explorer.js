/* ============================================================
   MODULE 15 — ОБОЗРЕВАТЕЛЬ ТРИГГЕРОВ (Event Trigger Explorer)
   Снимок-на-открытие (не подписан на renderAll(), как и модалки импорта/симуляции) — все узлы графа
   кроме стартового: их условие/расписание срабатывания (trigger), источник события (eventSource, §19)
   и что они меняют (effects) одним экраном, вместо клика по каждому узлу отдельно в инспекторе.
   ============================================================ */

function nodeTriggerSummary(n){
  if(n.trigger.kind==='scheduled'){
    const since=n.trigger.sinceNode?findNode(n.trigger.sinceNode):null;
    const base=n.trigger.sinceNode?(since?`от «${since.title}»`:'от несуществующего узла'):'от старта игры';
    return `⏱ через ${num(n.trigger.afterHours)}ч ${base}${n.trigger.repeat?' · повтор':''}`;
  }
  const conds=(n.trigger.all||[]).map(c=>{ const v=findVariable(c.var); return `${v?v.name:c.var} ${opSymbol(c.op)} ${c.value}`; }).join(' И ');
  return conds?`⚑ ${conds}`:'⚑ (без условий — доступен, если достижим по переходам)';
}
function triggerExplorerMatches(n,q){
  if(!q) return true;
  if((n.title||'').toLowerCase().includes(q)) return true;
  if(nodeTriggerSummary(n).toLowerCase().includes(q)) return true;
  if(eventSourceLabel(n.eventSource).toLowerCase().includes(q)) return true;
  return false;
}
function renderTriggerExplorerList(){
  const q=(document.getElementById('triggerExplorerSearch')||{}).value.trim().toLowerCase()||'';
  const eventNodes=nodes.filter(n=>n.trigger.kind!=='start').filter(n=>triggerExplorerMatches(n,q));
  document.getElementById('triggerExplorerList').innerHTML=eventNodes.map(n=>{
    const src=eventSourceLabel(n.eventSource);
    const summary=nodeAffectsSummary(n);
    return `<div class="noderow" data-jumptrigger="${esc(n.id)}">
      <span class="tag ${esc(n.type)}">${esc(n.type)}</span>
      <div class="nm-wrap">
        <span class="nm">${esc(n.title||'(без названия)')}${src?` <span class="muted small">(${esc(src)})</span>`:''}</span>
        <span class="affects muted small">${esc(nodeTriggerSummary(n))}</span>
        ${summary?`<span class="affects muted small">→ ${esc(summary)}</span>`:''}
      </div>
    </div>`;
  }).join('')||'<div class="hint">Ничего не найдено — либо в графе вообще нет узлов, кроме стартового.</div>';
}
document.getElementById('btnTriggerExplorer').onclick=()=>{
  document.getElementById('triggerExplorerSearch').value='';
  document.getElementById('triggerExplorerModal').style.display='flex';
  renderTriggerExplorerList();
};
document.getElementById('triggerExplorerSearch').addEventListener('input',renderTriggerExplorerList);
document.getElementById('btnTriggerExplorerClose').onclick=()=>{ document.getElementById('triggerExplorerModal').style.display='none'; };
document.getElementById('triggerExplorerList').addEventListener('click',e=>{
  const jump=e.target.closest('[data-jumptrigger]'); if(!jump) return;
  document.getElementById('triggerExplorerModal').style.display='none';
  if(typeof setViewMode==='function') setViewMode('story');
  selectNode(jump.dataset.jumptrigger);
  focusNode(jump.dataset.jumptrigger);
});
