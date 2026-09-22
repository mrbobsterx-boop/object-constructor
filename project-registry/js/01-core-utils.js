/* ============================================================
   MODULE 01 — CORE UTILS / UNITS / PROJECT FOLDER
   Хелперы (esc, fmt, пути), единицы (метры), File System Access API + IndexedDB,
   чтение JSON и файлов проекта. Реестр ТОЛЬКО ЧИТАЕТ папку проекта — ничего не пишет.
   Единицы те же, что во всех редакторах: в JSON — игровые метры (schema_version 4),
   размер объекта — сантиметры; старые файлы (px при 640 px/м) пересчитываются при чтении.
   ============================================================ */

const LEGACY_PPM=640;                                  // старые файлы хранили координаты комнат и зданий в px при 640 px/м
const SPRITE_EXT=/\.(png|jpe?g|webp|gif)$/i;
const SOUND_EXT=/\.(mp3|ogg|wav|flac|m4a)$/i;

function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmt(n){ return Number(n||0).toLocaleString('ru-RU'); }
function num(v,def){ const n=Number(v); return Number.isFinite(n)?n:(def===undefined?0:def); }
function fmtM(v){ return (Math.round(v*100)/100).toString().replace('.',',')+' м'; }
function slugOk(id){ return /^[a-z0-9_\-]+$/.test(String(id||'')); }
function isWholeMeter(v){ return Math.abs(v-Math.round(v))<0.005; }
// Путь картинки/звука → вид без префикса assets/sprites/ и assets/sounds/ (так его хранят объекты и комнаты)
function normPath(p){ return String(p||'').replace(/\\/g,'/').replace(/^\.?\//,'').replace(/^assets\/(sprites|sounds)\//,''); }
// Длина из JSON → метры. mKeys: ключ(и) в метрах; legacyKey: старый ключ в px при 640 px/м
function lenM(o,mKeys,legacyKey,fallback){
  if(!o) return fallback;
  for(const k of [].concat(mKeys)){ const v=o[k]; if(v!==undefined&&v!==null&&Number.isFinite(+v)) return +v; }
  if(legacyKey){ const v=o[legacyKey]; if(v!==undefined&&v!==null&&Number.isFinite(+v)) return +v/LEGACY_PPM; }
  return fallback;
}
// Все строки-пути внутри JSON → в множество (для поиска неиспользуемых файлов)
function collectStrings(v,set){
  if(typeof v==='string'){ if(v.length<300) set.add(normPath(v)); }
  else if(Array.isArray(v)) v.forEach(x=>collectStrings(x,set));
  else if(v&&typeof v==='object') Object.keys(v).forEach(k=>collectStrings(v[k],set));
}

/* ============================================================
   FILE SYSTEM ACCESS API (та же папка проекта, что у редакторов)
   ============================================================ */
const DB_NAME='project_registry_fs', DB_STORE='handles';
let projectDirHandle=null;
function idbOpen(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>r.result.createObjectStore(DB_STORE);
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function idbSet(k,v){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(DB_STORE,'readwrite'); tx.objectStore(DB_STORE).put(v,k); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
async function idbGet(k){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(DB_STORE,'readonly'); const r=tx.objectStore(DB_STORE).get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function getSubdir(root,path,create){
  let dir=root;
  for(const p of String(path).split('/').filter(Boolean)) dir=await dir.getDirectoryHandle(p,{create:!!create});
  return dir;
}
async function readJsonFile(dir,name){
  try{ const f=await (await dir.getFileHandle(name)).getFile(); return {data:JSON.parse(await f.text()),broken:false}; }
  catch(e){ return {data:null,broken:true}; }
}
// Все *.json папки: {items:[{name,data,broken}], missing:bool}
async function listJsonDir(path){
  const out={items:[],missing:false};
  try{
    const dir=await getSubdir(projectDirHandle,path,false);
    for await(const [name,h] of dir.entries()){
      if(h.kind!=='file'||!/\.json$/i.test(name)) continue;
      const r=await readJsonFile(dir,name);
      out.items.push({name,data:r.data,broken:r.broken});
    }
  }catch(e){ out.missing=true; }
  return out;
}
// Все файлы папки рекурсивно (относительные пути); скрытые (.sessions и т.п.) пропускаются
async function listFilesRecursive(path,re){
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
async function readFileBlobUrl(path){
  try{
    const parts=String(path).split('/').filter(Boolean); const name=parts.pop();
    const dir=await getSubdir(projectDirHandle,parts.join('/'),false);
    const f=await (await dir.getFileHandle(name)).getFile();
    return URL.createObjectURL(f);
  }catch(e){ return null; }
}

function updateFolderStatus(needs){
  const el=document.getElementById('folderStatus');
  el.textContent=projectDirHandle?('Папка: '+projectDirHandle.name+(needs?' (нужно разрешение)':' ✓')):'Папка не подключена';
  document.getElementById('btnRegrant').style.display=needs?'':'none';
}
async function connectProjectFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    projectDirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet('projectDir',projectDirHandle);
    updateFolderStatus(false);
    await scanProject();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const h=await idbGet('projectDir'); if(!h) return;
    projectDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await scanProject(); else render();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle) return;
  try{
    const p=await projectDirHandle.requestPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await scanProject();
  }catch(e){ console.warn(e); }
}
