/* ============================================================
   MODULE 13 — РЕЖИМ «ТАЙМЛАЙН»: узлы сюжета в порядке игрового времени
   Третий режим просмотра (наравне с «Сюжет»/«Мир», §12) — не заменяет граф, а показывает тот же
   набор узлов под другим углом: только те, у кого вообще есть определённый момент в игровом времени
   («▶ Старт» — час 0, «⏱ Фоновое, по таймеру» — час считается от старта или от другого узла по
   цепочке afterHours/sinceNode, §3). Узлы «⚑ По условиям» момента не имеют вообще — их время зависит
   от игрока, а не от часов, поэтому они честно показаны отдельным списком "вне хронологии", а не
   потеряны молча и не придуманы задним числом.
   ============================================================ */

// Рекурсивно резолвит час узла с фоновым триггером через цепочку sinceNode; null — момент не
// определён (цепочка ведёт в никуда, зациклена, или указывает на узел без своего момента времени).
// visiting — защита от цикла (A ждёт B, B ждёт A) точно так же, как обход циклов в "Проверках" (§5).
function resolveScheduledHour(node,visiting){
  if(!node) return null;
  if(node.trigger.kind==='start') return 0;
  if(node.trigger.kind!=='scheduled') return null;
  if(visiting.has(node.id)) return null;
  visiting.add(node.id);
  if(!node.trigger.sinceNode) return num(node.trigger.afterHours);
  const since=findNode(node.trigger.sinceNode);
  const baseHour=resolveScheduledHour(since,visiting);
  if(baseHour===null) return null;
  return baseHour+num(node.trigger.afterHours);
}
function computeTimeline(){
  const onTimeline=[], offTimeline=[];
  nodes.forEach(n=>{
    if(n.trigger.kind==='start'){ onTimeline.push({node:n,hour:0}); return; }
    if(n.trigger.kind==='scheduled'){
      const hour=resolveScheduledHour(n,new Set());
      if(hour===null) offTimeline.push(n); else onTimeline.push({node:n,hour});
      return;
    }
    offTimeline.push(n);
  });
  onTimeline.sort((a,b)=>a.hour-b.hour);
  return {onTimeline,offTimeline};
}

function renderTimeline(){
  const el=document.getElementById('timelineCanvas'); if(!el) return;
  const {onTimeline,offTimeline}=computeTimeline();
  const track=onTimeline.map((entry,i)=>`
    <div class="timeline-node" data-jumptimeline="${esc(entry.node.id)}">
      <div class="tl-hour">${entry.hour} ч</div>
      <div class="tl-title">${esc(entry.node.title||'(без названия)')}</div>
      ${entry.node.chapter?`<div class="tl-chapter muted small">${esc(entry.node.chapter)}</div>`:''}
    </div>${i<onTimeline.length-1?'<div class="timeline-arrow">→</div>':''}`).join('');
  const offRows=offTimeline.map(n=>`
    <div class="noderow" data-jumptimeline="${esc(n.id)}">
      <span class="tag ${esc(n.type)}">${esc(n.type)}</span>
      <div class="nm-wrap"><span class="nm">${esc(n.title||'(без названия)')}</span></div>
    </div>`).join('');
  el.innerHTML=`
    <div class="group">
      <h3>Хронология (${onTimeline.length})</h3>
      <div class="hint" style="margin-bottom:8px">Только узлы «▶ Старт» и «⏱ Фоновое, по таймеру» — у них есть определённый расчётный час (от старта игры или по цепочке отсчёта от другого узла). Порядок слева направо соответствует этому часу.</div>
      <div class="timeline-track">${track||'<div class="hint">Нет узлов с определённым игровым временем.</div>'}</div>
    </div>
    <div class="group">
      <h3>Вне хронологии (${offTimeline.length})</h3>
      <div class="hint" style="margin-bottom:6px">Узлы «⚑ По условиям» — момент срабатывания зависит от игрока, не от часов, поэтому места на хронологии у них нет и не может быть. Сюда же попадает фоновый узел, чья цепочка отсчёта времени сломана (ссылается на несуществующий узел, зациклена, или в итоге упирается в условный узел вместо старта).</div>
      ${offRows||'<div class="hint">Все узлы разместились на хронологии.</div>'}
    </div>
  `;
}
document.getElementById('timelineCanvas').addEventListener('click',e=>{
  const jump=e.target.closest('[data-jumptimeline]');
  if(jump){ setViewMode('story'); selectNode(jump.dataset.jumptimeline); focusNode(jump.dataset.jumptimeline); }
});
