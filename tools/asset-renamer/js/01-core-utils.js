/* ============================================================
   MODULE 01 — GLOBAL UTILS / PROJECT FOLDER
   ОДНО подключение (папка или GitHub) — источник и назначение совпадают: читаем и пишем
   assets/refs/ и data/objects/ в том же репозитории. Тот же принцип, что в Калибровщике
   размеров (tools/size-calibrator/js/01-core-utils.js) — код продублирован намеренно.
   ============================================================ */
const SPRITE_EXT=/\.(png|jpe?g|webp|gif)$/i;
function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Та же транслитерация, что в остальных приложениях — переименование фото пишет английский слаг,
// даже если имя ввели по-русски (см. reassignPhoto в 05-actions.js).
function translit(str){
  const map={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return (str||'').toLowerCase().split('').map(c=>map[c]!==undefined?map[c]:(/[a-z0-9]/.test(c)?c:'_')).join('').replace(/_+/g,'_').replace(/^_|_$/g,'');
}
function sanitizeSlug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9_\-]+/g,'_').replace(/^_+|_+$/g,''); }

let projectDirHandle=null;
function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('asset_renamer_fs',1);
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
  if(ghIsConnected()){ ghQueueWrite(relPath,bytes,'Asset Renamer'); ok=true; }
  return ok;
}
async function deleteProjectFile(relPath){
  let ok=false;
  if(projectDirHandle){
    try{
      const parts=relPath.split('/'); const fileName=parts.pop();
      const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
      await dir.removeEntry(fileName);
      ok=true;
    }catch(e){}
  }
  if(ghIsConnected()){ ghQueueDelete(relPath,'Asset Renamer'); ok=true; }
  return ok;
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
// Один JSON-файл целиком (data/objects/<id>.json) — для чтения/правки текущего имени объекта.
async function readSingleJson(relPath){
  if(ghIsConnected()) return readJsonFromGithub(relPath);
  try{
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    const f=await (await dir.getFileHandle(fileName)).getFile();
    return {data:JSON.parse(await f.text()),broken:false};
  }catch(e){ return {data:null,broken:false,missing:true}; }
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
// Вызывается shared/js/github-sync.js после успешного подключения GitHub.
async function onGithubConnected(){ await loadAll(); }
