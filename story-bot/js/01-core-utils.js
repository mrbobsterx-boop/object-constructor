/* ============================================================
   MODULE 01 — CORE UTILS / ПАПКА ПРОЕКТА
   Читает data/story.json (пишет Story Map); пишет только свой отчёт data/story_playtest.json.
   ============================================================ */

function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function num(v,def){ const n=Number(v); return Number.isFinite(n)?n:(def===undefined?0:def); }
function parseCsvList(s){ return String(s||'').split(',').map(x=>x.trim()).filter(Boolean); }
function opTest(a,op,b){
  a=Number(a)||0; b=Number(b)||0;
  if(op==='>=')return a>=b; if(op==='<=')return a<=b; if(op==='==')return a===b;
  if(op==='!=')return a!==b; if(op==='>')return a>b; if(op==='<')return a<b;
  return false;
}

const DB_NAME='story_bot_fs', DB_STORE='handles';
let projectDirHandle=null;
let storyData=null;

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
// Пишет во ВСЕ подключённые места сразу (и в папку, и в GitHub) — не either/or.
async function writeFileToProject(relPath,text){
  let ok=false;
  if(projectDirHandle){
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),true):projectDirHandle;
    const fh=await dir.getFileHandle(fileName,{create:true});
    const w=await fh.createWritable(); await w.write(text); await w.close();
    ok=true;
  }
  if(ghIsConnected()){ await writeFileToGithub(relPath,text,'Story Bot: '+relPath); ok=true; }
  return ok;
}
// GitHub в приоритете при чтении, если подключён — иначе папка проекта.
async function readJsonFromProject(relPath){
  if(ghIsConnected()) return (await readJsonFromGithub(relPath)).data;
  if(!projectDirHandle) return null;
  try{
    const parts=relPath.split('/'); const fileName=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    const f=await (await dir.getFileHandle(fileName)).getFile();
    return JSON.parse(await f.text());
  }catch(e){ return null; }
}
function setFolderStatus(t){ document.getElementById('folderStatus').textContent=t; }
function setStoryStatus(t){ document.getElementById('storyStatus').textContent=t; }
function updateFolderStatus(needsPermission){
  setFolderStatus(projectDirHandle?('Папка: '+projectDirHandle.name+(needsPermission?' (нужно разрешение)':' ✓')):'Папка не подключена');
  document.getElementById('btnRegrant').style.display=needsPermission?'':'none';
}
async function loadStory(){
  storyData=await readJsonFromProject('data/story.json');
  if(!storyData||!Array.isArray(storyData.nodes)){ setStoryStatus('data/story.json не найден — сначала собери сюжет в Story Map.'); storyData=null; return; }
  setStoryStatus('Сюжет: '+storyData.nodes.length+' узлов, '+storyData.variables.length+' переменных');
}
async function connectProjectFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    projectDirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet('projectDir',projectDirHandle);
    updateFolderStatus(false);
    await loadStory();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const h=await idbGet('projectDir'); if(!h) return;
    projectDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await loadStory();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle) return;
  try{
    const p=await projectDirHandle.requestPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await loadStory();
  }catch(e){ console.warn(e); }
}
// Вызывается shared/js/github-sync.js после успешного подключения GitHub.
async function onGithubConnected(){ await loadStory(); }
