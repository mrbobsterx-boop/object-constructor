/* ============================================================
   MODULE 01 — CORE UTILS / PROJECT FOLDER
   File System Access API + IndexedDB, чтение/запись файлов проекта — тот же паттерн, что в
   ОС/Room Editor/Building Editor/Object Plan. Подключается к ТОЙ ЖЕ папке проекта.
   ============================================================ */

function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Транслитерация — тот же алгоритм, что в Object Plan (js/01-core-utils.js), чтобы английские
// слаги вариаций и id совпадали в обоих инструментах независимо от того, где их ввели.
const TRANSLIT_MAP={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function translit(str){ return String(str||'').toLowerCase().split('').map(ch=>TRANSLIT_MAP[ch]!==undefined?TRANSLIT_MAP[ch]:ch).join(''); }
function sanitizeSlug(s){ return translit(String(s||'')).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60); }
function variationRu(v){ return typeof v==='string'?v:String((v&&v.ru)||''); }
function variationEn(v){ if(typeof v==='string') return sanitizeSlug(v); return String((v&&v.en)||sanitizeSlug((v&&v.ru)||'')); }

const DB_NAME='img_prep_fs', DB_STORE='handles';
let projectDirHandle=null;
function idbOpen(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=()=>r.result.createObjectStore(DB_STORE); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
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
async function writeFileToProject(relPath,bytes){
  if(!projectDirHandle) return false;
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),true):projectDirHandle;
  const fh=await dir.getFileHandle(fileName,{create:true});
  const w=await fh.createWritable(); await w.write(bytes); await w.close();
  return true;
}
async function nextAvailableName(dir,base){
  const existing=new Set();
  for await(const [name,h] of dir.entries()){ if(h.kind==='file') existing.add(name.toLowerCase()); }
  const plain=base+'.png';
  if(!existing.has(plain.toLowerCase())) return plain;
  let n=2;
  while(existing.has(`${base}_${n}.png`.toLowerCase())) n++;
  return `${base}_${n}.png`;
}

function setFolderStatus(t){ document.getElementById('folderStatus').textContent=t; }
function updateFolderStatus(needsPermission){
  setFolderStatus(projectDirHandle?('Папка: '+projectDirHandle.name+(needsPermission?' (нужно разрешение)':' ✓')):'Папка не подключена');
  document.getElementById('btnRegrant').style.display=needsPermission?'':'none';
}
async function connectFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge. В других браузерах сохраняй кнопкой — файл скачается обычным способом.'); return; }
  try{
    projectDirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet('folder',projectDirHandle);
    updateFolderStatus(false);
    await loadPlanCustomFromProject();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreFolder(){
  try{
    const h=await idbGet('folder'); if(!h) return;
    projectDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await loadPlanCustomFromProject();
  }catch(e){ console.warn(e); }
}
async function regrantFolder(){
  if(!projectDirHandle) return;
  try{ const p=await projectDirHandle.requestPermission({mode:'readwrite'}); updateFolderStatus(p!=='granted'); if(p==='granted') await loadPlanCustomFromProject(); }catch(e){ console.warn(e); }
}
function downloadCanvasPng(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },400);
}
