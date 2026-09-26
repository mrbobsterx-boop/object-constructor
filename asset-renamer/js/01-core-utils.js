/* ============================================================
   MODULE 01 — CORE UTILS / ДВЕ ПАПКИ (источник + назначение)
   File System Access API + IndexedDB — тот же паттерн, что в остальных приложениях репозитория
   (ОС/Room Editor/Object Plan/image-prep-tool), но здесь держим ДВА независимых handle'а одновременно:
   sourceDirHandle (откуда читаем и удаляем после переноса) и destDirHandle (куда пишем под новым именем).
   ============================================================ */

const SPRITE_EXT=/\.(png|jpe?g|webp|gif)$/i;
function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Та же транслитерация, что в Object Plan / image-prep-tool — чтобы итоговые имена файлов совпадали
// со слагами id/вариаций, которые эти приложения используют для поиска превью в assets/refs.
const TRANSLIT_MAP={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function translit(str){ return String(str||'').toLowerCase().split('').map(ch=>TRANSLIT_MAP[ch]!==undefined?TRANSLIT_MAP[ch]:ch).join(''); }
function sanitizeSlug(s){ return translit(String(s||'')).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60); }

const DB_NAME='asset_renamer_fs', DB_STORE='handles';
let sourceDirHandle=null, destDirHandle=null;
function idbOpen(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>r.result.createObjectStore(DB_STORE);
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function idbSet(k,v){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(DB_STORE,'readwrite'); tx.objectStore(DB_STORE).put(v,k); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
async function idbGet(k){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(DB_STORE,'readonly'); const r=tx.objectStore(DB_STORE).get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

async function listTopLevelFiles(dirHandle){
  const out=[];
  for await(const [name,h] of dirHandle.entries()){
    if(h.kind==='file'&&SPRITE_EXT.test(name)) out.push(name);
  }
  return out;
}

function setSourceStatus(t){ document.getElementById('sourceStatus').textContent=t; }
function setDestStatus(t){ document.getElementById('destStatus').textContent=t; }

async function connectSourceFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    sourceDirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet('sourceDir',sourceDirHandle);
    setSourceStatus('Источник: '+sourceDirHandle.name+' ✓');
    document.getElementById('btnRegrantSource').style.display='none';
    await scanSource();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreSourceFolder(){
  try{
    const h=await idbGet('sourceDir'); if(!h) return;
    sourceDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    setSourceStatus('Источник: '+h.name+(p==='granted'?' ✓':' (нужно разрешение)'));
    document.getElementById('btnRegrantSource').style.display=p==='granted'?'none':'';
    if(p==='granted') await scanSource();
  }catch(e){ console.warn('Не удалось восстановить папку-источник:',e); }
}
async function regrantSourceFolder(){
  if(!sourceDirHandle) return;
  try{
    const p=await sourceDirHandle.requestPermission({mode:'readwrite'});
    setSourceStatus('Источник: '+sourceDirHandle.name+(p==='granted'?' ✓':' (нужно разрешение)'));
    document.getElementById('btnRegrantSource').style.display=p==='granted'?'none':'';
    if(p==='granted') await scanSource();
  }catch(e){ console.warn(e); }
}

async function connectDestFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    destDirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet('destDir',destDirHandle);
    setDestStatus('Назначение: '+destDirHandle.name+' ✓');
    document.getElementById('btnRegrantDest').style.display='none';
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreDestFolder(){
  try{
    const h=await idbGet('destDir'); if(!h) return;
    destDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    setDestStatus('Назначение: '+h.name+(p==='granted'?' ✓':' (нужно разрешение)'));
    document.getElementById('btnRegrantDest').style.display=p==='granted'?'none':'';
  }catch(e){ console.warn('Не удалось восстановить папку назначения:',e); }
}
async function regrantDestFolder(){
  if(!destDirHandle) return;
  try{
    const p=await destDirHandle.requestPermission({mode:'readwrite'});
    setDestStatus('Назначение: '+destDirHandle.name+(p==='granted'?' ✓':' (нужно разрешение)'));
    document.getElementById('btnRegrantDest').style.display=p==='granted'?'none':'';
  }catch(e){ console.warn(e); }
}
