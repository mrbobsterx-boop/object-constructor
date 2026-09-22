/* ============================================================
   MODULE 16 — INIT
   First-render calls. MUST be loaded LAST: everything above has to be defined
   before these run (tryRestoreProjectFolder awaits functions from modules 11-15).
   ============================================================ */

/* ============================================================
   INIT
   ============================================================ */
applyStageTransform();
updateRoomSizeMetersHint();
renderLibrary();
renderBgLayerList();
renderRoom();
renderPropertiesPanel();
tryRestoreProjectFolder();
pushHistory();
