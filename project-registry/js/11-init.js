/* ============================================================
   MODULE 11 — INIT
   Первая отрисовка и восстановление папки проекта. ДОЛЖЕН ЗАГРУЖАТЬСЯ ПОСЛЕДНИМ:
   всё, что ниже вызывается, должно быть определено в модулях 01–10.
   ============================================================ */
document.getElementById('btnConnect').onclick=connectProjectFolder;
document.getElementById('btnRegrant').onclick=regrantProjectFolder;
document.getElementById('btnScan').onclick=scanProject;
render();
tryRestoreProjectFolder();
