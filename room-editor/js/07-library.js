/* ============================================================
   MODULE 07 — LIBRARY
   Object library panel, composition and stair-socket controls.
   ============================================================ */

/* ---- библиотека ---- */
function renderLibrary(){
  const grid=document.getElementById('libGrid'); grid.innerHTML='';
  const search=document.getElementById('libSearch').value.trim().toLowerCase();
  const cat=document.getElementById('libCategory').value;
  const items=projectCatalog.filter(e=>(!cat||e.category===cat) && (!search||(e.name||'').toLowerCase().includes(search)||(e.id||'').toLowerCase().includes(search)));
  if(!items.length){ grid.innerHTML='<div class="status" style="padding:10px">'+(projectDirHandle?'Ничего не найдено.':'Сначала подключи папку проекта.')+'</div>'; return; }
  items.forEach(e=>{
    const el=document.createElement('div'); el.className='lib-item'; el.draggable=true;
    el.innerHTML=`${catalogThumbHtml(e,40)}<div class="n">${esc(e.name||e.id)}</div><div class="c">${esc(categoryLabel(e.category))}</div>`;
    el.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', JSON.stringify(e)); ev.dataTransfer.effectAllowed='copy'; });
    grid.appendChild(el);
  });
}
document.querySelectorAll('#compositionGrid .composition-cell').forEach(btn=>{
  btn.onclick=()=>{
    room.compositionRole=btn.dataset.role;
    renderCompositionUI();
    scheduleHistoryPush();
  };
});
document.querySelectorAll('#stairSocketControls [data-stair]').forEach(btn=>{
  btn.onclick=()=>{
    const position=btn.dataset.stair;
    const list=new Set(room.stairConnections||[]);
    if(list.has(position)) list.delete(position); else list.add(position);
    const order=['TOP_LEFT','TOP_CENTER','TOP_RIGHT','BOTTOM_LEFT','BOTTOM_CENTER','BOTTOM_RIGHT'];
    room.stairConnections=order.filter(x=>list.has(x));
    renderCompositionUI();
    renderStairSocketMarkers();
    scheduleHistoryPush();
  };
});
renderCompositionUI();
document.getElementById('libSearch').addEventListener('input', renderLibrary);
document.getElementById('libCategory').addEventListener('change', renderLibrary);
document.getElementById('btnRefreshLibrary').onclick=async ()=>{
  if(!projectDirHandle){ renderLibrary(); return; }
  const btn=document.getElementById('btnRefreshLibrary');
  btn.textContent='Обновляю...'; btn.disabled=true;
  await scanProjectFolderCatalog();
  btn.textContent='🔄 Обновить библиотеку'; btn.disabled=false;
};
