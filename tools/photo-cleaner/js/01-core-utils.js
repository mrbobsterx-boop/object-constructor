/* ============================================================
   MODULE 01 — GLOBAL UTILS / PROJECT FOLDER
   Тот же принцип подключения, что в Size Calibrator/Asset Renamer: папка на диске (File System
   Access API) или GitHub (shared/js/github-sync.js) — независимо или оба сразу.
   ============================================================ */
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

let projectDirHandle=null;

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('photo_cleaner_fs',1);
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
async function listFilesRecursive(path,re){
  if(ghIsConnected()) return listFilesRecursiveGithub(path,re);
  const out={files:[],missing:false};
  let root; try{ root=await getSubdir(projectDirHandle,path,false); }catch(e){ out.missing=true; return out; }
  async function walk(dir,prefix){
    for await(const [name,h] of dir.entries()){
      if(name.startsWith('.')) continue;
      if(h.kind==='directory') await walk(h,prefix+name+'/');
      else if(re.test(name)) out.files.push(prefix+name);
    }
  }
  try{ await walk(root,''); }catch(e){}
  return out;
}
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
async function readSingleJson(relPath){
  if(ghIsConnected()) return readJsonFromGithub(relPath);
  try{
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    const f=await (await dir.getFileHandle(fileName)).getFile();
    return {data:JSON.parse(await f.text()),broken:false};
  }catch(e){ return {data:null,broken:false,missing:true}; }
}
// Пишет локально в папку (если подключена) — запись в GitHub для массового удаления идёт ОДНИМ
// батч-коммитом через ghBatchCommit (см. 05-actions.js), не по одному файлу, иначе быстро упираемся
// в дневной лимит деплоев Vercel (ровно это уже случалось).
async function writeFileToProjectLocal(relPath,bytes){
  if(!projectDirHandle) return false;
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length ? await getSubdir(projectDirHandle,parts.join('/'),true) : projectDirHandle;
  const fileHandle=await dir.getFileHandle(fileName,{create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
  return true;
}
async function deleteProjectFileLocal(relPath){
  if(!projectDirHandle) return false;
  try{
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    await dir.removeEntry(fileName);
    return true;
  }catch(e){ return false; }
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
    await loadAll();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const handle=await idbGet('projectDir');
    if(!handle)return;
    const perm=await handle.queryPermission({mode:'readwrite'});
    projectDirHandle=handle;
    updateFolderStatus(perm!=='granted');
    if(perm==='granted') await loadAll();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle)return;
  try{ const perm=await projectDirHandle.requestPermission({mode:'readwrite'}); if(perm==='granted'){ updateFolderStatus(); await loadAll(); } }
  catch(e){ console.warn(e); }
}
document.getElementById('btnConnectFolder').onclick=connectProjectFolder;
document.getElementById('btnRegrantFolder').onclick=regrantProjectFolder;
async function onGithubConnected(){ await loadAll(); }
