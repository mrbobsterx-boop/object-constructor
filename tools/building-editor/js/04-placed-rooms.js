/* ============================================================
   MODULE 04 — PLACED ROOMS + BUILDING STATE
   Building state variables, slot role / stair filters, mode switch,
   adding, shuffling and deleting placed rooms.
   ============================================================ */

/* ============================================================
   РАЗМЕЩЁННЫЕ КОМНАТЫ
   ============================================================ */
let placedRooms=[]; // {instanceId, mode, roomId, typeFilter, requiredRole, requiredStairs[], floor, x,y,w,h,name}
let selectedPlacedId=null;
let selectedSlotRole='CENTER_CENTER';
let selectedSlotStairs=new Set();
let placementIssuesCache=new Map();
let buildingMode='BUILDING'; // 'BUILDING' | 'STREET'
let buildingBackgrounds=[]; // {id,path,dataUrl,w,h,x,y,scale,opacity,rotation,flipH,flipV,z}
let buildingBackgroundCatalog=[];
let selectedBuildingBgId=null;
const GRID_SNAP=PIXELS_PER_METER/10; // 10 см — шаг привязки (только в режиме "Здание")
document.querySelectorAll('#slotRoleGrid .slot-role-cell').forEach(btn=>btn.onclick=()=>{
  selectedSlotRole=btn.dataset.role;
  document.querySelectorAll('#slotRoleGrid .slot-role-cell').forEach(b=>b.classList.toggle('active',b.dataset.role===selectedSlotRole));
});
document.querySelectorAll('#slotStairControls .stair-filter-btn').forEach(btn=>btn.onclick=()=>{
  const key=btn.dataset.stair;
  if(selectedSlotStairs.has(key)) selectedSlotStairs.delete(key); else selectedSlotStairs.add(key);
  btn.classList.toggle('active',selectedSlotStairs.has(key));
});
document.querySelector('#slotRoleGrid .slot-role-cell[data-role="CENTER_CENTER"]').classList.add('active');
document.getElementById('modeSelect').addEventListener('change', e=>{
  buildingMode=e.target.value;
  document.getElementById('shuffleRow').style.display = buildingMode==='STREET' ? '' : 'none';
  recomputeAndRender();
});
document.getElementById('btnShuffleAll').onclick=()=>{
  // тасуем только RANDOM-сегменты (Fisher-Yates), FIXED остаются на своих индексах-якорях
  const randomIdxs=[]; placedRooms.forEach((p,i)=>{ if(p.mode==='RANDOM') randomIdxs.push(i); });
  const picks=randomIdxs.map(i=>placedRooms[i]);
  for(let i=picks.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [picks[i],picks[j]]=[picks[j],picks[i]]; }
  randomIdxs.forEach((idx,k)=>{ placedRooms[idx]=picks[k]; });
  // и перевыбираем содержимое каждого случайного слота заново, для более наглядного превью
  randomIdxs.forEach(idx=>rerollRandomSlot(placedRooms[idx]));
  recomputeAndRender();
};

function addPlacedRoom(roomId){
  const room=roomCatalog.find(r=>r.id===roomId); if(!room)return;
  const start=room.hasBlocks?PIXELS_PER_METER:20; // комната с блоками сразу встаёт на целый метр
  const id='place_'+Date.now()+Math.random().toString(36).slice(2);
  placedRooms.push({ instanceId:id, mode:'FIXED', roomId, typeFilter:null, requiredRole:null, requiredStairs:[], floor:0, crop:{left:0,right:0,top:0,bottom:0}, x:start, y:start, w:room.width, h:room.height, name:room.name });
  selectedPlacedId=id;
  recomputeAndRender();
}
document.getElementById('btnAddRandomSlot').onclick=()=>{
  const type=document.getElementById('slotTypeSelect').value; if(!type)return;
  const id='place_'+Date.now()+Math.random().toString(36).slice(2);
  const entry={ instanceId:id, mode:'RANDOM', roomId:null, typeFilter:type,
    requiredRole:selectedSlotRole, requiredStairs:[...selectedSlotStairs], floor:+document.getElementById('slotFloor').value||0, crop:{left:0,right:0,top:0,bottom:0},
    x:20, y:20, w:640*PIXELS_PER_METER/100, h:220*PIXELS_PER_METER/100, name:'Слот: '+type };
  placedRooms.push(entry);
  rerollRandomSlot(entry);
  { const m=getRoomMeta(entry.roomId); if(m&&m.hasBlocks){ entry.x=PIXELS_PER_METER; entry.y=PIXELS_PER_METER; } } // комната с блоками — на целый метр
  selectedPlacedId=id;
  recomputeAndRender();
};
function roomMatchesRandomSlot(r,entry){
  if(!r || r.type!==entry.typeFilter) return false;
  if(entry.requiredRole && r.compositionRole!==entry.requiredRole) return false;
  const have=new Set(r.stairConnections||[]);
  return (entry.requiredStairs||[]).every(x=>have.has(x));
}
function rerollRandomSlot(entry){
  const candidates=roomCatalog.filter(r=>roomMatchesRandomSlot(r,entry));
  if(!candidates.length){ entry.roomId=null; entry.w=6.4*PIXELS_PER_METER; entry.h=2.2*PIXELS_PER_METER; entry.name='Слот: '+entry.typeFilter+' (нет подходящих комнат)'; return; }
  const pick=candidates[Math.floor(Math.random()*candidates.length)];
  entry.roomId=pick.id; entry.w=pick.width; entry.h=pick.height; entry.crop={left:0,right:0,top:0,bottom:0}; entry.name='🎲 '+pick.name+' ('+entry.typeFilter+', '+(entry.requiredRole||'CENTER_CENTER')+')';
}
document.getElementById('btnApplyFloor').onclick=()=>{
  const p=placedRooms.find(x=>x.instanceId===selectedPlacedId); if(!p)return;
  p.floor=Number(document.getElementById('selectedFloor').value)||0;
  recomputeAndRender();
};
document.getElementById('btnDeleteSelected').onclick=()=>{
  if(!selectedPlacedId)return;
  placedRooms=placedRooms.filter(p=>p.instanceId!==selectedPlacedId);
  selectedPlacedId=null;
  recomputeAndRender();
};
