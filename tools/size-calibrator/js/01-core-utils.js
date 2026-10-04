/* ============================================================
   MODULE 01 — GLOBAL UTILS / UNITS / PROJECT FOLDER
   Тот же принцип, что в Room Editor/Object Constructor: отдельный HTML-файл,
   код продублирован, но подключается к ТОЙ ЖЕ папке на диске или тому же
   репозиторию GitHub (shared/js/github-sync.js).
   ============================================================ */
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ============================================================
   ЕДИНИЦЫ: 100 px = 1 игровой метр = та же конвенция, что Object Constructor
   и Room Editor используют для real_width_cm/real_height_cm. 1 см = 1 px —
   сцена ниже рисует объекты в их НАСТОЯЩЕМ игровом размере при zoom=100%.
   ============================================================ */
const PIXELS_PER_METER=100;

/* ============================================================
   File System Access API + GitHub — чтение/запись data/objects/*.json
   и картинок из assets/sprites/.
   ============================================================ */
let projectDirHandle=null;

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('size_calibrator_fs',1);
    req.onupgradeneeded=()=>{ req.result.createObjectStore('handles'); };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function idbSet(key,val){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('handles','readwrite');
    tx.objectStore('handles').put(val,key);
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });
}
async function idbGet(key){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('handles','readonly');
    const req=tx.objectStore('handles').get(key);
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function getSubdir(root,pathStr,create){
  let dir=root;
  for(const p of pathStr.split('/').filter(Boolean)) dir=await dir.getDirectoryHandle(p,{create:!!create});
  return dir;
}
// Пишет во ВСЕ подключённые места сразу (и в папку, и в GitHub) — не either/or.
async function writeFileToProject(relPath,bytes){
  let ok=false;
  if(projectDirHandle){
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length ? await getSubdir(projectDirHandle,parts.join('/'),true) : projectDirHandle;
    const fileHandle=await dir.getFileHandle(fileName,{create:true});
    const writable=await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
    ok=true;
  }
  if(ghIsConnected()){ await writeFileToGithub(relPath,bytes,'Size Calibrator: '+relPath); ok=true; }
  return ok;
}
// GitHub в приоритете при чтении, если подключён — иначе папка проекта.
async function listJsonDir(path){
  if(ghIsConnected()) return listJsonDirGithub(path);
  const out={items:[],missing:false};
  try{
    const dir=await getSubdir(projectDirHandle,path,false);
    for await(const [name,h] of dir.entries()){
      if(h.kind!=='file'||!/\.json$/i.test(name)) continue;
      try{ const f=await h.getFile(); out.items.push({name,data:JSON.parse(await f.text()),broken:false}); }
      catch(e){ out.items.push({name,data:null,broken:true}); }
    }
  }catch(e){ out.missing=true; }
  return out;
}
// Один файл (обычно картинка) по пути от корня проекта, как Blob — GitHub или папка.
async function readProjectFileBlob(relPath){
  if(ghIsConnected()){
    try{ const r=await ghReadFileRaw(relPath); return r?new Blob([r.bytes]):null; }catch(e){ return null; }
  }
  try{
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    return await (await dir.getFileHandle(fileName)).getFile();
  }catch(e){ return null; }
}
function updateFolderStatus(needsRegrant){
  const el=document.getElementById('folderStatus');
  if(!projectDirHandle){ el.textContent='Папка не подключена'; document.getElementById('btnRegrantFolder').style.display='none'; return; }
  el.textContent = needsRegrant ? ('Папка: '+projectDirHandle.name+' (нужно разрешение)') : ('Папка: '+projectDirHandle.name+' ✓');
  document.getElementById('btnRegrantFolder').style.display = needsRegrant?'':'none';
}
async function connectProjectFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    const handle=await window.showDirectoryPicker({mode:'readwrite'});
    projectDirHandle=handle;
    await idbSet('projectDir',handle);
    updateFolderStatus();
    await loadAllObjects();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const handle=await idbGet('projectDir');
    if(!handle)return;
    const perm=await handle.queryPermission({mode:'readwrite'});
    projectDirHandle=handle;
    updateFolderStatus(perm!=='granted');
    if(perm==='granted') await loadAllObjects();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle)return;
  try{ const perm=await projectDirHandle.requestPermission({mode:'readwrite'}); if(perm==='granted'){ updateFolderStatus(); await loadAllObjects(); } }
  catch(e){ console.warn(e); }
}
document.getElementById('btnConnectFolder').onclick=connectProjectFolder;
document.getElementById('btnRegrantFolder').onclick=regrantProjectFolder;
// Вызывается shared/js/github-sync.js после успешного подключения GitHub.
async function onGithubConnected(){ await loadAllObjects(); }
