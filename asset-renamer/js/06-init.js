/* ============================================================
   MODULE 06 — INIT (всегда последний)
   Подключение кнопок, клики по спискам, горячие клавиши.
   ============================================================ */

document.getElementById('btnConnectSource').onclick=connectSourceFolder;
document.getElementById('btnRegrantSource').onclick=regrantSourceFolder;
document.getElementById('btnConnectDest').onclick=connectDestFolder;
document.getElementById('btnRegrantDest').onclick=regrantDestFolder;

document.getElementById('sourceList').addEventListener('click',e=>{
  const chip=e.target.closest('.file-chip'); if(!chip) return;
  const fileName=chip.dataset.file;
  const parsed=parseFileName(fileName);
  if(e.ctrlKey||e.metaKey){
    if(!activeFamilyKey){ selectFamily(fileName); return; }
    if(parsed.stem!==activeFamilyKey){ flashReject(fileName); return; }
    toggleSelectionMember(fileName);
  } else {
    if(activeFamilyKey&&parsed.stem===activeFamilyKey) applyBrushToFile(fileName);
    else selectFamily(fileName);
  }
});

document.getElementById('editPanel').addEventListener('click',e=>{
  const editBtn=e.target.closest('[data-edit-field]');
  if(editBtn){ startEditField(editBtn.dataset.editField); return; }
  if(e.target.closest('#sliderBroken')){ toggleBrush('broken'); return; }
  if(e.target.closest('#sliderIcon')){ toggleBrush('icon'); return; }
  if(e.target.closest('#btnAppendVar')){
    const inp=document.getElementById('quickAddVarText'); const t=inp.value.trim();
    if(t){ appendToVariation(t); }
    return;
  }
  if(e.target.closest('#btnConfirm')){ confirmMove(); return; }
});

window.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  const inField=tag==='input'||tag==='textarea'||tag==='select';

  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){ e.preventDefault(); redo(); return; }

  if(e.code==='Enter'||e.code==='NumpadEnter'){
    if(inField&&e.target.classList.contains('field-edit-input')) return; // тот же Enter уже коммитит поле (см. 04-render.js)
    if(inField) return;
    e.preventDefault(); confirmMove(); return;
  }
  if(inField) return;

  if(e.code==='Numpad7'){ e.preventDefault(); startEditField('razdel'); return; }
  if(e.code==='Numpad4'){ e.preventDefault(); startEditField('obj'); return; }
  if(e.code==='Numpad1'){ e.preventDefault(); startEditField('variation'); return; }
  if(e.code==='Numpad0'){ e.preventDefault(); toggleBrush('broken'); return; }
  if(e.code==='Numpad3'){ e.preventDefault(); toggleBrush('icon'); return; }
});

tryRestoreSourceFolder();
tryRestoreDestFolder();
render();
