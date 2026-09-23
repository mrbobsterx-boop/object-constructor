/* ============================================================
   MODULE 01 — CORE UTILS / PROJECT FOLDER
   Хелперы, File System Access API + IndexedDB, чтение/запись файлов проекта.
   Object Plan ЧИТАЕТ data/objects, data/rooms, assets/sprites (для автоматических отметок) и пишет
   только один свой файл — data/object_plan.json (по кнопке «💾 Прогресс в проект»).
   ============================================================ */

const SPRITE_EXT=/\.(png|jpe?g|webp|gif)$/i;
function esc(s){ return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmt(n){ return Number(n||0).toLocaleString('ru-RU'); }
function num(v,def){ const n=Number(v); return Number.isFinite(n)?n:(def===undefined?0:def); }
function normPath(p){ return String(p||'').replace(/\\/g,'/').replace(/^\.?\//,'').replace(/^assets\/(sprites|sounds)\//,''); }
function pct(a,b){ return b?Math.round(a/b*100):0; }

// Транслитерация и вариации: вариация (поле v объекта) — либо просто русская строка (английский слаг
// получается транслитерацией), либо {ru,en} с явным английским именем. Используется картинками-превью
// (assets/refs/<id>_<en>.*) и image-prep-tool при автоматическом наименовании слоёв.
const TRANSLIT_MAP={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function translit(str){ return String(str||'').toLowerCase().split('').map(ch=>TRANSLIT_MAP[ch]!==undefined?TRANSLIT_MAP[ch]:ch).join(''); }
function sanitizeSlug(s){ return translit(String(s||'')).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60); }
function variationRu(v){ return typeof v==='string'?v:String((v&&v.ru)||''); }
function variationEn(v){ if(typeof v==='string') return sanitizeSlug(v); return String((v&&v.en)||sanitizeSlug((v&&v.ru)||'')); }

const DB_NAME='object_plan_fs', DB_STORE='handles';
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
    await scanProjectObjects();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const h=await idbGet('projectDir'); if(!h) return;
    projectDirHandle=h;
    const p=await h.queryPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await scanProjectObjects();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle) return;
  try{
    const p=await projectDirHandle.requestPermission({mode:'readwrite'});
    updateFolderStatus(p!=='granted');
    if(p==='granted') await scanProjectObjects();
  }catch(e){ console.warn(e); }
}
function downloadText(name,text,mime){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime||'text/plain'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}
