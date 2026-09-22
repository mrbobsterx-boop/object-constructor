/* ============================================================
   MODULE 12 — HISTORY + HOTKEYS
   Undo/redo snapshots and keyboard shortcuts.
   ============================================================ */

/* ============================================================
   ИСТОРИЯ (Undo/Redo) + ГОРЯЧИЕ КЛАВИШИ
   ============================================================ */
let historyStack=[], historyIndex=-1, historyTimer=null, suppressHistory=false;
function scheduleHistoryPush(){ if(suppressHistory)return; clearTimeout(historyTimer); historyTimer=setTimeout(pushHistory,500); }
function snapshotRoom(){ return JSON.parse(JSON.stringify({room,selectedInstanceId})); }
function pushHistory(){
  historyStack=historyStack.slice(0,historyIndex+1);
  historyStack.push(snapshotRoom());
  if(historyStack.length>30)historyStack.shift();
  historyIndex=historyStack.length-1;
  updateHistoryButtons();
}
function restoreSnapshot(s){
  room=s.room; selectedInstanceId=s.selectedInstanceId;
  document.getElementById('roomId').value=room.id; document.getElementById('roomId').dataset.auto='0'; document.getElementById('roomName').value=room.name; ensureRoomTypeOption(room.type); document.getElementById('roomType').value=room.type||'';
  setRoomSizeInputs(room.width,room.height);
  document.getElementById('playerWalkZ').value=room.playerWalkZ!==undefined?room.playerWalkZ:10;
  renderBgLayerList();
  renderRoom(); renderPropertiesPanel();
}
function updateHistoryButtons(){
  document.getElementById('btnGlobalUndo').disabled=historyIndex<=0;
  document.getElementById('btnGlobalRedo').disabled=historyIndex>=historyStack.length-1;
}
function undoAction(){ if(historyIndex<=0)return; historyIndex--; suppressHistory=true; restoreSnapshot(historyStack[historyIndex]); suppressHistory=false; updateHistoryButtons(); }
function redoAction(){ if(historyIndex>=historyStack.length-1)return; historyIndex++; suppressHistory=true; restoreSnapshot(historyStack[historyIndex]); suppressHistory=false; updateHistoryButtons(); }
document.getElementById('btnGlobalUndo').onclick=undoAction;
document.getElementById('btnGlobalRedo').onclick=redoAction;
document.addEventListener('keydown', e=>{
  const tag=(document.activeElement&&document.activeElement.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select')return;
  if(e.ctrlKey && e.code==='KeyZ'){ e.preventDefault(); e.shiftKey?redoAction():undoAction(); return; }
  if(e.ctrlKey && e.code==='KeyY'){ e.preventDefault(); redoAction(); return; }
  if((e.key==='Delete'||e.key==='Backspace') && selectedInstanceId){ e.preventDefault(); deleteInstance(selectedInstanceId); return; }
  const inst=getSelectedInstance();
  if(inst && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();
    const step=e.shiftKey?10:1;
    if(e.key==='ArrowLeft')inst.x-=step; if(e.key==='ArrowRight')inst.x+=step;
    if(e.key==='ArrowUp')inst.y-=step; if(e.key==='ArrowDown')inst.y+=step;
    renderRoom(); renderPropertiesPanel(); scheduleHistoryPush();
  }
});
