/* ============================================================
   MODULE 01 — CORE UTILS / PROJECT FOLDER
   Хелперы, File System Access API + IndexedDB, чтение/запись файлов проекта.
   Shelter Architecture Map ЧИТАЕТ data/rooms, data/buildings, project.godot, папку сцен
   (*.tscn) и res://-пути элементов чертежа — для автоматических отметок. Пишет только
   один свой файл — data/scene_plan.json.
   ============================================================ */

function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmt(n){ return Number(n||0).toLocaleString('ru-RU'); }
function num(v,def){ const n=Number(v); return Number.isFinite(n)?n:(def===undefined?0:def); }
function pct(a,b){ return b?Math.round(a/b*100):0; }

const DB_NAME='sam_fs', DB_STORE='handles';
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
async function readTextFile(path){
  try{
    const parts=String(path).split('/').filter(Boolean); const name=parts.pop();
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    const f=await (await dir.getFileHandle(name)).getFile();
    return await f.text();
  }catch(e){ return null; }
}
async function fileExistsAtResPath(resPath){
  try{
    const rel=String(resPath||'').replace(/^res:\/\//,'');
    const parts=rel.split('/').filter(Boolean); const name=parts.pop();
    if(!name) return false;
    const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),false):projectDirHandle;
    await dir.getFileHandle(name);
    return true;
  }catch(e){ return false; }
}
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
// Разбирает project.godot: секция [autoload], строки Name="*res://путь". Возвращает Map(имя → res://путь без '*').
function parseAutoloads(text){
  const map=new Map();
  if(!text) return map;
  const lines=text.split(/\r?\n/);
  let inSection=false;
  for(const line of lines){
    const t=line.trim();
    if(/^\[.*\]$/.test(t)){ inSection=(t==='[autoload]'); continue; }
    if(!inSection||!t) continue;
    const m=t.match(/^([A-Za-z0-9_]+)\s*=\s*"(.*)"$/);
    if(m) map.set(m[1], m[2].replace(/^\*/,''));
  }
  return map;
}
async function writeFileToProject(relPath,bytes){
  if(!projectDirHandle) return false;
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length?await getSubdir(projectDirHandle,parts.join('/'),true):projectDirHandle;
  const fh=await dir.getFileHandle(fileName,{create:true});
  const w=await fh.createWritable(); await w.write(bytes); await w.close();
  return true;
}
function setFolderStatus(t){ const el=document.getElementById('folderStatus'); if(el) el.textContent=t; }
function updateFolderStatus(needs){
  setFolderStatus(projectDirHandle?('Папка: '+projectDirHandle.name+(needs?' (нужно разрешение)':' ✓')):'Папка не подключена — отметки хранятся в браузере');
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
    if(p==='granted') await scanProject();
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
function downloadText(name,text,mime){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime||'text/plain'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}
