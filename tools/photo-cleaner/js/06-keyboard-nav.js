/* ============================================================
   MODULE 06 — KEYBOARD NAV
   Tab/Shift+Tab — следующая/предыдущая карточка в ТЕКУЩЕЙ активной колонке (та, где сейчас выбрана
   карточка — клик по карточке делает её колонку активной).
   Backspace в колонке 1 — переместить в "Временно удалённые".
   В колонке 2: Enter — вернуть в конец колонки 1, Backspace — переместить в "Удалённые навсегда".
   Колонка 3 не слушает Backspace/Enter — только общая кнопка "Сохранить".
   ============================================================ */
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==='Tab'){
    e.preventDefault();
    navigate(e.shiftKey?-1:1);
    return;
  }
  if(!selectedPath) return;
  if(e.key==='Backspace'){
    e.preventDefault();
    if(activeColumn==='active') moveToStaged(selectedPath);
    else if(activeColumn==='staged') moveToPending(selectedPath);
    return;
  }
  if(e.key==='Enter'){
    if(activeColumn==='staged'){ e.preventDefault(); restoreToActive(selectedPath); }
    return;
  }
});
