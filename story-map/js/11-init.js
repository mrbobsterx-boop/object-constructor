/* ============================================================
   MODULE 07 — INIT (всегда последний)
   ============================================================ */

document.getElementById('btnConnect').onclick=connectProjectFolder;
document.getElementById('btnRegrant').onclick=regrantProjectFolder;
document.getElementById('btnSave').onclick=saveStoryToProject;

document.getElementById('btnAddVar').onclick=addVariable;
document.getElementById('btnAddEvent').onclick=()=>addNode('event');
document.getElementById('btnAddChoice').onclick=()=>addNode('choice');
document.getElementById('btnAddBackground').onclick=()=>addNode('background');
document.getElementById('btnAddNote').onclick=()=>{
  const rect=canvasOuter.getBoundingClientRect();
  const center=screenToWorld(rect.left+rect.width/2,rect.top+rect.height/2);
  addStickyNote(center.x-STICKY_W/2,center.y-STICKY_H/2);
};

document.getElementById('btnZoomIn').onclick=()=>setZoom(zoom*1.15);
document.getElementById('btnZoomOut').onclick=()=>setZoom(zoom*0.87);
document.getElementById('btnZoomReset').onclick=()=>{ zoom=1; pan={x:60,y:60}; applyWorldTransform(); };
document.getElementById('btnFitAll').onclick=fitAll;
document.getElementById('btnFocusMode').onclick=()=>{
  focusMode=!focusMode;
  document.getElementById('btnFocusMode').classList.toggle('active',focusMode);
  renderCanvas();
};

window.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyS'){ e.preventDefault(); saveStoryToProject(); return; }
  if(tag==='input'||tag==='textarea'||tag==='select') return;
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){ e.preventDefault(); redo(); return; }
  // мультивыбор/копирование/удаление клавишами — только для сюжетного графа на холсте, чтобы
  // случайная клавиша в режиме "Мир" не трогала узлы сюжета через устаревшее выделение.
  if(typeof viewMode!=='undefined'&&viewMode!=='story') return;
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyA'){ e.preventDefault(); selectAll(); return; }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyC'){ e.preventDefault(); copySelection(); return; }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyV'){ e.preventDefault(); pasteClipboard(); return; }
  if((e.code==='Delete'||e.code==='Backspace')&&(multiSelected.size||selectedNodeId)){ e.preventDefault(); deleteSelectedNodes(); return; }
});
window.addEventListener('beforeunload',e=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } });

seedRelationTypesIfEmpty();
resetHistory();
renderAll();
renderDirtyStatus();
tryRestoreProjectFolder();
