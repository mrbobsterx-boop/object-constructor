/* ============================================================
   MODULE 01 — CORE UTILS / ПАПКА ПРОЕКТА
   Тот же паттерн File System Access API + IndexedDB, что и в остальных приложениях репозитория.
   Story Map пишет только один свой файл — data/story.json.
   ============================================================ */

function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function num(v,def){ const n=Number(v); return Number.isFinite(n)?n:(def===undefined?0:def); }

const TRANSLIT_MAP={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function translit(str){ return String(str||'').toLowerCase().split('').map(ch=>TRANSLIT_MAP[ch]!==undefined?TRANSLIT_MAP[ch]:ch).join(''); }
function sanitizeSlug(s){ return translit(String(s||'')).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40); }
function uid(prefix){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

const OP_LIST=[['>=','≥'],['<=','≤'],['==','='],['!=','≠'],['>','>'],['<','<']];
function opSymbol(op){ const p=OP_LIST.find(x=>x[0]===op); return p?p[1]:op; }
function opTest(a,op,b){
  a=Number(a)||0; b=Number(b)||0;
  if(op==='>=')return a>=b; if(op==='<=')return a<=b; if(op==='==')return a===b;
  if(op==='!=')return a!==b; if(op==='>')return a>b; if(op==='<')return a<b;
  return false;
}

const DB_NAME='story_map_fs', DB_STORE='handles';
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
async function writeFileToProject(relPath,text){
  if(!projectDirHandle) return false;
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),true):projectDirHandle;
  const fh=await dir.getFileHandle(fileName,{create:true});
  const w=await fh.createWritable(); await w.write(text); await w.close();
  return true;
}
async function readJsonFromProject(relPath){
  if(!projectDirHandle) return null;
  try{
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    const f=await (await dir.getFileHandle(fileName)).getFile();
    return JSON.parse(await f.text());
  }catch(e){ return null; }
}
function setFolderStatus(t){ document.getElementById('folderStatus').textContent=t; }
function updateFolderStatus(needsPermission){
  setFolderStatus(projectDirHandle?('Папка: '+projectDirHandle.name+(needsPermission?' (нужно разрешение)':' ✓')):'Папка не подключена');
  document.getElementById('btnRegrant').style.display=needsPermission?'':'none';
}
async function connectProjectFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    projectDirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet('projectDir',projectDirHandle);
    updateFolderStatus(false);
    await loadStoryFromProject();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const h=await idbGet('projectDir'); if(!h) return;
    projectDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await loadStoryFromProject();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
function downloadText(name,text,mime){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime||'application/json'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}
async function regrantProjectFolder(){
  if(!projectDirHandle) return;
  try{
    const p=await projectDirHandle.requestPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await loadStoryFromProject();
  }catch(e){ console.warn(e); }
}
