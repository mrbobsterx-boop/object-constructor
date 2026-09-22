/* ============================================================
   MODULE 01 — GLOBAL UTILS / UNITS / PROJECT FOLDER
   Slug/escape/translit helpers, game-meter units (px <-> m), File System Access API,
   IndexedDB handle storage.
   Keep this block before modules that consume these definitions.
   ============================================================ */

/* ============================================================
   GLOBAL UTILS: File System Access API (тот же принцип, что и в
   Object Constructor — отдельный HTML-файл, поэтому код продублирован,
   но подключается к ТОЙ ЖЕ папке на диске).
   ============================================================ */
function sanitizeSlug(s){ return (s||"").toLowerCase().replace(/[^a-z0-9_\-]+/g,"_").replace(/^_+|_+$/g,""); }
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function translit(str){
  const map={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return (str||"").toLowerCase().split("").map(c=>map[c]!==undefined?map[c]:(/[a-z0-9]/.test(c)?c:"_")).join("").replace(/_+/g,"_").replace(/^_|_$/g,"");
}
async function dataURLToBytes(dataURL){ const r=await fetch(dataURL); return new Uint8Array(await r.arrayBuffer()); }

/* ============================================================
   UNITS — ИГРОВЫЕ МЕТРЫ
   Все данные (JSON комнат, сетов, объектов) хранятся в МЕТРАХ.
   Пиксели существуют только внутри редактора, для отображения:
   100 px = 1 игровой метр (1 px = 1 см).
   Внутри редактора координаты держим в px; на границе (сохранение,
   загрузка, поля ввода) значения переводятся в метры и обратно.
   Старые файлы (px при 640 px/м) читаются и пересчитываются сами.
   ============================================================ */
const PIXELS_PER_METER=100;
const LEGACY_GEOMETRY_PPM=640; // старые файлы (schema_version<4) хранили координаты в px при 640 px/м
const LEGACY_VALUE_PPM=100;    // старые радиусы света/зрения/слуха были «px» без привязки к сцене
function pxToM(px,digits){ const k=Math.pow(10,digits===undefined?2:digits); return Math.round(px/PIXELS_PER_METER*k)/k; } // метры, по умолчанию с точностью до 1 см
function mToPx(m){ return Math.round(m*PIXELS_PER_METER*1000)/1000; } // округление убирает шум вида 6.4*100=640.0000000000001
// Длина из JSON → px. mKeys: ключ(и) в метрах; legacyKey: старый ключ в px; иначе fallbackPx.
function lenPx(o,mKeys,legacyKey,fallbackPx,legacyPPM){
  if(!o) return fallbackPx;
  for(const k of [].concat(mKeys)){ const v=o[k]; if(v!==undefined&&v!==null&&Number.isFinite(+v)) return mToPx(+v); }
  if(legacyKey){ const v=o[legacyKey]; if(v!==undefined&&v!==null&&Number.isFinite(+v)) return Math.round(+v*PIXELS_PER_METER/(legacyPPM||LEGACY_GEOMETRY_PPM)*1000)/1000; }
  return fallbackPx;
}
function lightFromJSON(l){ // JSON объекта/комнаты/сета → внутренний формат (radius в px)
  if(!l) return null;
  const {radiusM,radius_m,radius,...rest}=l;
  return {...rest, radius:lenPx(l,['radiusM','radius_m'],'radius',1.5*PIXELS_PER_METER,LEGACY_VALUE_PPM)};
}
function lightToJSON(l){ if(!l) return null; const {radius,...rest}=l; return {...rest, radiusM:pxToM(radius||0)}; }
function doorFromJSON(d){ if(!d) return null; return {toRoom:d.toRoom||'', spawnX:lenPx(d,'spawnXM','spawnX',0), spawnY:lenPx(d,'spawnYM','spawnY',0)}; }
function doorToJSON(d){ if(!d) return null; return {toRoom:d.toRoom, spawnXM:pxToM(d.spawnX||0), spawnYM:pxToM(d.spawnY||0)}; }
// Масштаб фона: в JSON хранится реальная ширина в метрах (widthM), масштаб считаем от размера картинки.
function bgScaleFromJSON(l,nativeW){
  const wm=l&&l.widthM;
  if(wm!==undefined&&wm!==null&&nativeW>0) return mToPx(wm)/nativeW;
  return ((l&&l.scale!==undefined)?l.scale:1)*PIXELS_PER_METER/LEGACY_GEOMETRY_PPM;
}
// JSON комнаты (новый или старый) → тот же объект, но с числами в px (внутренний формат редактора)
function roomFromJSON(d){
  const width=lenPx(d,'widthM','width',6.4*PIXELS_PER_METER), height=lenPx(d,'heightM','height',2.2*PIXELS_PER_METER);
  const bgList=d.backgroundLayers||(d.background?[d.background]:[]); // самый старый формат — один фон
  return {...d, width, height,
    backgroundLayers:bgList.map(l=>({...l, x:lenPx(l,'xM','x',width/2), y:lenPx(l,'yM','y',height/2)})),
    instances:(d.instances||[]).map(i=>({...i, x:lenPx(i,'xM','x',0), y:lenPx(i,'yM','y',0), light:lightFromJSON(i.light), door:doorFromJSON(i.door)}))
  };
}

let projectDirHandle=null;

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('room_editor_fs',1);
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
  if(!projectDirHandle)return false;
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length ? await getSubdir(projectDirHandle,parts.join('/'),true) : projectDirHandle;
  const fileHandle=await dir.getFileHandle(fileName,{create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
  return true;
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
    await loadProjectSettings(); await loadRoomRecipes();
    await scanProjectFolderCatalog();
    await scanExistingRooms(); await scanExistingSets();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const handle=await idbGet('projectDir');
    if(!handle)return;
    const perm=await handle.queryPermission({mode:'readwrite'});
    projectDirHandle=handle;
    updateFolderStatus(perm!=='granted');
    if(perm==='granted'){ await loadProjectSettings(); await loadRoomRecipes(); await scanProjectFolderCatalog(); await scanExistingRooms(); await scanExistingSets(); }
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle)return;
  try{ const perm=await projectDirHandle.requestPermission({mode:'readwrite'}); if(perm==='granted'){ updateFolderStatus(); await loadProjectSettings(); await loadRoomRecipes(); await scanProjectFolderCatalog(); await scanExistingRooms(); await scanExistingSets(); } }
  catch(e){ console.warn(e); }
}
document.getElementById('btnConnectFolder').onclick=connectProjectFolder;
document.getElementById('btnRegrantFolder').onclick=regrantProjectFolder;
