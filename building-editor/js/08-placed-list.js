/* ============================================================
   MODULE 08 — RECOMPUTE + PLACED LIST
   recomputeAndRender() (main refresh entry point) and the placed-rooms list.
   ============================================================ */

function recomputeAndRender(){
  if(buildingMode==='STREET') recomputeLinearPositions();
  updateBuildingCanvasSize();
  recomputeDoorLinks();
  renderBuildingCanvas();
  renderPlacedList();
}
function renderPlacedList(){
  const box=document.getElementById('placedList'); box.innerHTML='';
  const selected=placedRooms.find(p=>p.instanceId===selectedPlacedId);
  document.getElementById('selectedFloor').value=selected ? (selected.floor||0) : 0;
  syncCropUI();
  if(!placedRooms.length){ box.innerHTML='<span class="muted">Пока пусто — добавь комнату слева.</span>'; return; }
  placedRooms.forEach((p,i)=>{
    const row=document.createElement('div'); row.className='instance-row'+(p.instanceId===selectedPlacedId?' selected':'');
    let btns=(p.mode==='RANDOM'?'<button class="reroll">🎲</button>':'');
    if(buildingMode==='STREET') btns+='<button class="mv-up">▲</button><button class="mv-down">▼</button>';
    const issues=getBuildingPlacementIssues(p);
    const issueBadge=issues.length?`<span title="${esc(issues.map(x=>x.message).join('; '))}" style="color:#ff8066">⚠</span>`:'';
    row.innerHTML=issueBadge+`<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>`+btns;
    row.onclick=()=>{ selectedPlacedId=p.instanceId; recomputeAndRender(); };
    const rerollBtn=row.querySelector('.reroll');
    if(rerollBtn) rerollBtn.onclick=(e)=>{ e.stopPropagation(); rerollRandomSlot(p); recomputeAndRender(); };
    const upBtn=row.querySelector('.mv-up'), downBtn=row.querySelector('.mv-down');
    if(upBtn) upBtn.onclick=(e)=>{ e.stopPropagation(); if(i>0){ [placedRooms[i-1],placedRooms[i]]=[placedRooms[i],placedRooms[i-1]]; recomputeAndRender(); } };
    if(downBtn) downBtn.onclick=(e)=>{ e.stopPropagation(); if(i<placedRooms.length-1){ [placedRooms[i+1],placedRooms[i]]=[placedRooms[i],placedRooms[i+1]]; recomputeAndRender(); } };
    box.appendChild(row);
  });
}
