/* ============================================================
   MODULE 15 — INIT (всегда последним)
   Загрузка отметок, сборка модели, подключение кнопок, первая отрисовка, восстановление папки проекта.
   ============================================================ */

loadStore();
buildModel();
document.getElementById('btnConnect').onclick=connectProjectFolder;
document.getElementById('btnRegrant').onclick=regrantProjectFolder;
document.getElementById('btnScan').onclick=()=>{ if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; } scanProjectObjects(); };
document.getElementById('btnSaveProject').onclick=saveStoreToProject;
document.getElementById('btnLoadProject').onclick=loadStoreFromProject;
document.getElementById('btnExport').onclick=exportMarkdown;
render();
tryRestoreProjectFolder();
