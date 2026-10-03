/* ============================================================
   MODULE 06 — INIT (всегда последний)
   ============================================================ */

document.getElementById('btnConnect').onclick=connectProjectFolder;
document.getElementById('btnRegrant').onclick=regrantProjectFolder;

document.getElementById('btnRunOne').onclick=async ()=>{ runSingle(); await saveReport(); };
document.getElementById('btnRunBatch').onclick=async ()=>{ runBatchAndRender(); await saveReport(); };

const tabSingleBtn=document.getElementById('tabSingleBtn'), tabBatchBtn=document.getElementById('tabBatchBtn');
const viewSingle=document.getElementById('viewSingle'), viewBatch=document.getElementById('viewBatch');
tabSingleBtn.onclick=()=>{ tabSingleBtn.classList.add('active'); tabBatchBtn.classList.remove('active'); viewSingle.style.display=''; viewBatch.style.display='none'; };
tabBatchBtn.onclick=()=>{ tabBatchBtn.classList.add('active'); tabSingleBtn.classList.remove('active'); viewBatch.style.display=''; viewSingle.style.display='none'; };

tryRestoreProjectFolder();
wireGithubButtons();
if(ghIsConnected()) onGithubConnected();
