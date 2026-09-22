/* ============================================================
   MODULE 20 — INIT (всегда последний)
   ============================================================ */

document.getElementById('btnConnect').addEventListener('click',connectProjectFolder);
document.getElementById('btnRegrant').addEventListener('click',regrantProjectFolder);
document.getElementById('btnScan').addEventListener('click',scanProject);
document.getElementById('btnSaveProject').addEventListener('click',saveStoreToProject);
document.getElementById('btnLoadProject').addEventListener('click',loadStoreFromProject);
document.getElementById('btnExport').addEventListener('click',exportMarkdown);

loadStore();
buildModel();
render();
tryRestoreProjectFolder();
