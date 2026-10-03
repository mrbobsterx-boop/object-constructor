/* ============================================================
   MODULE 17 — КОМАНДНАЯ ПАЛИТРА (Command Palette, Ctrl+K, §24)
   Быстрый доступ к разбросанным по разным кнопкам шапки действиям одним текстовым поиском, плюс
   переход к любому узлу сюжета по названию/тексту — без похода в список слева и ручной прокрутки.
   Снимок-на-открытие (тот же принцип, что у Триггеров/Обзора) — список статичных действий фильтруется
   по вводу, узлы подмешиваются в тот же список только когда есть запрос (иначе список из сотен узлов
   захлестнул бы полезные действия).
   ============================================================ */

const PALETTE_ACTIONS=[
  {label:'+ Добавить событие',hint:'N',run:()=>addNode('event')},
  {label:'+ Добавить выбор',run:()=>addNode('choice')},
  {label:'+ Добавить фоновое событие',run:()=>addNode('background')},
  {label:'+ Заметка на холсте (в центр экрана)',run:()=>{ const rect=canvasOuter.getBoundingClientRect(); const c=screenToWorld(rect.left+rect.width/2,rect.top+rect.height/2); addStickyNote(c.x-STICKY_W/2,c.y-STICKY_H/2); }},
  {label:'💾 Сохранить',hint:'Ctrl+S',run:()=>saveStoryToProject()},
  {label:'📁 Подключить папку проекта',run:()=>connectProjectFolder()},
  {label:'👁 Переключить «Только чтение»',run:()=>document.getElementById('btnReadOnly').click()},
  {label:'▶ Играть (симуляция)',run:()=>document.getElementById('btnSimPlay').click()},
  {label:'🔔 Обозреватель триггеров',run:()=>document.getElementById('btnTriggerExplorer').click()},
  {label:'📊 Обзор проекта',run:()=>document.getElementById('btnProjectOverview').click()},
  {label:'⛶ Fit all',hint:'F',run:()=>{ if(typeof viewMode==='undefined'||viewMode==='story') fitAll(); }},
  {label:'1:1 Сбросить масштаб',run:()=>document.getElementById('btnZoomReset').click()},
  {label:'🔦 Переключить фокус-режим',run:()=>document.getElementById('btnFocusMode').click()},
  {label:'📖 Режим: Сюжет',run:()=>setViewMode('story')},
  {label:'🌍 Режим: Мир',run:()=>setViewMode('world')},
  {label:'🕐 Режим: Таймлайн',run:()=>setViewMode('timeline')}
];
let paletteSelIdx=0;
function paletteMatches(){
  const q=(document.getElementById('commandPaletteInput').value||'').trim().toLowerCase();
  const actions=PALETTE_ACTIONS.filter(a=>!q||a.label.toLowerCase().includes(q)).map(a=>({label:a.label,hint:a.hint||'',run:a.run}));
  const nodeMatches=q?nodes.filter(n=>(n.title||'').toLowerCase().includes(q)||(n.text||'').toLowerCase().includes(q)).slice(0,12)
    .map(n=>({label:'→ '+(n.title||'(без названия)'),hint:n.type,run:()=>{ setViewMode('story'); selectNode(n.id); focusNode(n.id); }})):[];
  return actions.concat(nodeMatches);
}
function renderCommandPalette(){
  const items=paletteMatches();
  if(items.length) paletteSelIdx=Math.max(0,Math.min(paletteSelIdx,items.length-1)); else paletteSelIdx=0;
  document.getElementById('commandPaletteList').innerHTML=items.map((it,i)=>`<div class="noderow palette-row ${i===paletteSelIdx?'active':''}" data-paletteidx="${i}">
    <span class="nm">${esc(it.label)}</span>${it.hint?`<span class="muted small">${esc(it.hint)}</span>`:''}
  </div>`).join('')||'<div class="hint">Ничего не найдено.</div>';
  return items;
}
function openCommandPalette(){
  document.getElementById('commandPaletteModal').style.display='flex';
  const input=document.getElementById('commandPaletteInput');
  input.value=''; paletteSelIdx=0;
  renderCommandPalette();
  setTimeout(()=>input.focus(),0);
}
function toggleCommandPalette(){
  const modal=document.getElementById('commandPaletteModal');
  const isOpen=modal.style.display==='flex';
  if(isOpen) modal.style.display='none'; else openCommandPalette();
}
document.getElementById('btnCommandPalette').onclick=openCommandPalette;
document.getElementById('commandPaletteInput').addEventListener('input',()=>{ paletteSelIdx=0; renderCommandPalette(); });
document.getElementById('commandPaletteInput').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){ e.preventDefault(); paletteSelIdx++; renderCommandPalette(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); paletteSelIdx--; renderCommandPalette(); }
  else if(e.key==='Enter'){
    e.preventDefault();
    const items=paletteMatches();
    const item=items[paletteSelIdx]; if(!item) return;
    document.getElementById('commandPaletteModal').style.display='none';
    item.run();
  }
});
document.getElementById('commandPaletteList').addEventListener('click',e=>{
  const row=e.target.closest('[data-paletteidx]'); if(!row) return;
  const items=paletteMatches();
  const item=items[Number(row.dataset.paletteidx)]; if(!item) return;
  document.getElementById('commandPaletteModal').style.display='none';
  item.run();
});
