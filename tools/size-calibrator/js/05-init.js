/* ============================================================
   MODULE 05 — INIT
   ============================================================ */
applyStageTransform();
tryRestoreProjectFolder();
wireGithubButtons();
if(ghIsConnected()) onGithubConnected();
window.addEventListener('resize',()=>{ if(objectsById[selectedId]) renderScene(objectsById[selectedId]); });
