/* ============================================================
   MODULE 10 — ROOM SETTINGS
   Room size / ID / name and custom room types.
   ============================================================ */

/* ============================================================
   РАЗМЕР КОМНАТЫ / ID / НАЗВАНИЕ
   ============================================================ */
// Поля размера комнаты — в игровых метрах (ширина × высота); внутри room.width/height — px редактора.
function updateRoomSizeMetersHint(){
  document.getElementById('roomSizeMetersHint').textContent='метры: ширина × высота';
}
function setRoomSizeInputs(wPx,hPx){
  document.getElementById('roomWidth').value=pxToM(wPx); document.getElementById('roomHeight').value=pxToM(hPx);
  updateRoomSizeMetersHint();
}
document.getElementById('roomWidth').addEventListener('input', updateRoomSizeMetersHint);
document.getElementById('roomHeight').addEventListener('input', updateRoomSizeMetersHint);
document.getElementById('btnApplyRoomSize').onclick=()=>{
  room.width=mToPx(+document.getElementById('roomWidth').value||6.4);
  room.height=mToPx(+document.getElementById('roomHeight').value||2.2);
  updateRoomSizeMetersHint();
  renderRoom(); renderPropertiesPanel(); renderZoneGridOverlay(); scheduleHistoryPush();
};
document.getElementById('btnApplyPlayerZ').onclick=()=>{
  room.playerWalkZ=+document.getElementById('playerWalkZ').value||10;
  renderRoom(); renderPropertiesPanel(); scheduleHistoryPush();
};
document.getElementById('roomId').addEventListener('input', ()=>{ document.getElementById('roomId').dataset.auto='0'; });
document.getElementById('roomId').dataset.auto='1';
document.getElementById('roomId').oninput=e=>{ room.id=e.target.value; scheduleHistoryPush(); };
document.getElementById('roomName').oninput=e=>{
  room.name=e.target.value; scheduleHistoryPush();
  const idEl=document.getElementById('roomId');
  if(idEl.dataset.auto!=='0'){ idEl.value=translit(e.target.value)||''; room.id=idEl.value; }
};
document.getElementById('roomType').onchange=e=>{ room.type=e.target.value; scheduleHistoryPush(); };

const ROOM_TYPE_KEY='room_editor_custom_types_v1';
function loadCustomRoomTypes(){ try{ return JSON.parse(localStorage.getItem(ROOM_TYPE_KEY)||'[]'); }catch(e){ return []; } }
function saveCustomRoomTypes(list){ try{ localStorage.setItem(ROOM_TYPE_KEY, JSON.stringify(list)); }catch(e){} }
function renderCustomRoomTypeOptions(){
  const sel=document.getElementById('roomType');
  const cur=sel.value;
  document.querySelectorAll('#roomType option[data-custom]').forEach(o=>o.remove());
  loadCustomRoomTypes().forEach(t=>{
    const opt=document.createElement('option');
    opt.value=t.value; opt.textContent=t.label; opt.dataset.custom='1';
    sel.appendChild(opt);
  });
  sel.value=cur;
}
document.getElementById('btnAddRoomType').onclick=()=>{
  const label=document.getElementById('roomTypeCustom').value.trim();
  if(!label)return;
  const value=sanitizeSlug(label)||('custom_'+Date.now());
  const list=loadCustomRoomTypes();
  if(!list.find(t=>t.value===value)){ list.push({value,label}); saveCustomRoomTypes(list); }
  renderCustomRoomTypeOptions();
  document.getElementById('roomType').value=value;
  room.type=value; document.getElementById('roomTypeCustom').value='';
  scheduleHistoryPush();
};
renderCustomRoomTypeOptions();
function ensureRoomTypeOption(value){
  if(!value)return;
  const sel=document.getElementById('roomType');
  if([...sel.options].some(o=>o.value===value))return;
  const list=loadCustomRoomTypes();
  if(!list.find(t=>t.value===value)){ list.push({value,label:value}); saveCustomRoomTypes(list); }
  renderCustomRoomTypeOptions();
}
