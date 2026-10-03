/* ============================================================
   GITHUB SYNC — общий модуль для всех редакторов (подключается <script src="…/shared/js/github-sync.js">
   ПЕРЕД собственным 01-core-utils.js приложения).
   Второй источник/приёмник данных наравне с File System Access API ("подключить папку"): чтение и
   запись файлов репозитория напрямую через GitHub REST API (Contents API + Git Trees API), авторизация
   personal access token'ом, который пользователь один раз вставляет в приложении — токен хранится
   ТОЛЬКО в localStorage этого браузера (ключ ниже), в репозиторий не попадает и никуда не отправляется,
   кроме самого api.github.com.

   Как это сочетается с папкой проекта: оба источника независимы и могут быть подключены одновременно.
   ЧТЕНИЕ — GitHub в приоритете, если подключён (пользователь работает через GitHub, а не через папку);
   иначе как раньше — папка. ЗАПИСЬ — пишется во ВСЕ подключённые места сразу (и в папку, и в GitHub),
   это not either/or. Эту логику добавляет каждое приложение само, обычно прямо в своих
   listJsonDir/listFilesRecursive/writeFileToProject — см. комментарии в их 01-core-utils.js.
   ============================================================ */

const GH_LS_KEY='gh_sync_settings_v1';
let ghSettings=undefined; // undefined = ещё не читали localStorage; false/null = не подключено; {owner,repo,branch,token}
let ghTreeCache=null;     // Git Trees API (recursive) — одно дерево путей на всё подключение, сбрасывается после записи

function ghLoad(){
  if(ghSettings!==undefined) return ghSettings;
  try{ const raw=localStorage.getItem(GH_LS_KEY); ghSettings=raw?JSON.parse(raw):null; }
  catch(e){ ghSettings=null; }
  return ghSettings;
}
function ghIsConnected(){ const s=ghLoad(); return !!(s&&s.owner&&s.repo&&s.branch&&s.token); }
function ghApiUrl(path){ const s=ghLoad(); return `https://api.github.com/repos/${s.owner}/${s.repo}/${path}`; }
function ghHeaders(extra){
  const s=ghLoad();
  return Object.assign({'Authorization':'Bearer '+s.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},extra||{});
}
function ghEncPath(p){ return String(p).split('/').map(encodeURIComponent).join('/'); }

// ---- base64 (UTF-8-safe для текста, побайтово для бинарников) ----
function ghBytesToBase64(bytesLike){
  const arr=bytesLike instanceof Uint8Array?bytesLike:new Uint8Array(bytesLike);
  let binary=''; const CHUNK=0x8000;
  for(let i=0;i<arr.length;i+=CHUNK) binary+=String.fromCharCode.apply(null,arr.subarray(i,i+CHUNK));
  return btoa(binary);
}
function ghBase64ToBytes(b64){
  const binary=atob(String(b64).replace(/\n/g,''));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function ghTextToBase64(text){ return btoa(unescape(encodeURIComponent(text))); }

// ---- подключение ----
function updateGithubStatus(){
  const el=document.getElementById('githubStatus'); if(!el) return;
  const s=ghLoad();
  el.textContent=ghIsConnected()?`GitHub: ${s.owner}/${s.repo}@${s.branch} ✓`:'GitHub не подключён';
  const btnDisconnect=document.getElementById('btnGithubDisconnect');
  if(btnDisconnect) btnDisconnect.style.display=ghIsConnected()?'':'none';
}
async function ghTestConnection(){
  try{
    const res=await fetch(ghApiUrl(''),{headers:ghHeaders()});
    if(!res.ok) throw new Error('HTTP '+res.status+(res.status===404?' (репозиторий/владелец не найден)':res.status===401?' (неверный токен)':''));
    return true;
  }catch(e){ alert('Не удалось подключиться к GitHub: '+e.message+'\nПроверь владельца/репозиторий/ветку/токен.'); return false; }
}
async function connectGithub(){
  const s=ghLoad()||{};
  const owner=prompt('GitHub: владелец репозитория',s.owner||'mrbobsterx-boop'); if(owner===null) return;
  const repo=prompt('GitHub: имя репозитория',s.repo||'object-constructor'); if(repo===null) return;
  const branch=prompt('GitHub: ветка',s.branch||'main'); if(branch===null) return;
  const token=prompt('GitHub: personal access token (Settings → Developer settings → Fine-grained tokens, доступ Contents: Read and write к этому репозиторию). Хранится только в этом браузере.',s.token||''); if(token===null) return;
  const next={owner:owner.trim(),repo:repo.trim(),branch:(branch.trim()||'main'),token:token.trim()};
  if(!next.owner||!next.repo||!next.token){ alert('Нужны все поля: владелец, репозиторий и токен.'); return; }
  localStorage.setItem(GH_LS_KEY,JSON.stringify(next));
  ghSettings=next; ghTreeCache=null;
  const ok=await ghTestConnection();
  if(!ok){ disconnectGithub(); return; }
  updateGithubStatus();
  if(typeof onGithubConnected==='function') await onGithubConnected();
}
function tryRestoreGithub(){ ghLoad(); updateGithubStatus(); }
function disconnectGithub(){
  localStorage.removeItem(GH_LS_KEY); ghSettings=null; ghTreeCache=null; updateGithubStatus();
}

// ---- чтение ----
// Дерево всего репозитория одним запросом (Git Trees API, recursive=1) вместо похода в каждую папку —
// критично для assets/refs с ~1000 файлов. Кэш живёт до следующего connect/дисконнекта или successful
// записи (см. writeFileToGithub).
async function ghFetchTree(force){
  if(ghTreeCache&&!force) return ghTreeCache;
  const s=ghLoad();
  const res=await fetch(ghApiUrl(`git/trees/${encodeURIComponent(s.branch)}?recursive=1`),{headers:ghHeaders()});
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data=await res.json();
  ghTreeCache=data.tree||[];
  return ghTreeCache;
}
async function ghReadFileRaw(path){
  const s=ghLoad();
  const res=await fetch(ghApiUrl(`contents/${ghEncPath(path)}?ref=${encodeURIComponent(s.branch)}`),{headers:ghHeaders()});
  if(res.status===404) return null;
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data=await res.json();
  if(Array.isArray(data)) throw new Error(path+' — это папка, не файл');
  return {sha:data.sha,bytes:ghBase64ToBytes(data.content)};
}
async function readJsonFromGithub(path){
  try{
    const r=await ghReadFileRaw(path);
    if(!r) return {data:null,broken:false,missing:true};
    return {data:JSON.parse(new TextDecoder('utf-8').decode(r.bytes)),broken:false};
  }catch(e){ return {data:null,broken:true}; }
}
async function listJsonDirGithub(path){
  const out={items:[],missing:false};
  try{
    const tree=await ghFetchTree();
    const prefix=path.replace(/\/$/,'')+'/';
    const entries=tree.filter(t=>t.type==='blob'&&t.path.startsWith(prefix)&&t.path.slice(prefix.length).indexOf('/')===-1&&/\.json$/i.test(t.path));
    if(!entries.length){ out.missing=true; return out; }
    for(const entry of entries){
      const name=entry.path.slice(prefix.length);
      const r=await readJsonFromGithub(entry.path);
      out.items.push({name,data:r.data,broken:r.broken});
    }
  }catch(e){ out.missing=true; }
  return out;
}
async function listFilesRecursiveGithub(path,re){
  const out={files:[],missing:false};
  try{
    const tree=await ghFetchTree();
    const prefix=path.replace(/\/$/,'')+'/';
    tree.forEach(t=>{
      if(t.type!=='blob'||!t.path.startsWith(prefix)) return;
      const rel=t.path.slice(prefix.length);
      if(re.test(rel)) out.files.push(rel);
    });
  }catch(e){ out.missing=true; }
  return out;
}
async function readBinaryObjectUrlFromGithub(path,mime){
  const r=await ghReadFileRaw(path);
  if(!r) return null;
  return URL.createObjectURL(new Blob([r.bytes],{type:mime||'image/png'}));
}

// ---- запись ----
// Пишет/обновляет один файл через Contents API (создаёт коммит в указанную ветку). Если файл уже
// существует — сначала читает его sha (GitHub требует sha для обновления, иначе 409 conflict).
async function writeFileToGithub(relPath,bytesOrText,message){
  if(!ghIsConnected()) return false;
  const isText=typeof bytesOrText==='string';
  const content=isText?ghTextToBase64(bytesOrText):ghBytesToBase64(bytesOrText);
  let sha;
  try{ const existing=await ghReadFileRaw(relPath); sha=existing?existing.sha:undefined; }catch(e){ sha=undefined; }
  const s=ghLoad();
  const body={message:message||('Update '+relPath),content,branch:s.branch};
  if(sha) body.sha=sha;
  const res=await fetch(ghApiUrl(`contents/${ghEncPath(relPath)}`),{
    method:'PUT',headers:Object.assign(ghHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify(body)
  });
  if(!res.ok){ const err=await res.text().catch(()=>''); throw new Error('HTTP '+res.status+' '+err.slice(0,300)); }
  ghTreeCache=null;
  return true;
}

// ---- общий UI-хелпер: кнопка "GitHub" + статус-строка (вызвать после того как в DOM уже есть
// #githubStatus/#btnConnectGithub/#btnGithubDisconnect, обычно из 11-init.js аналога приложения) ----
function wireGithubButtons(){
  const btnConnect=document.getElementById('btnConnectGithub');
  const btnDisconnect=document.getElementById('btnGithubDisconnect');
  if(btnConnect) btnConnect.onclick=connectGithub;
  if(btnDisconnect) btnDisconnect.onclick=()=>{ if(confirm('Отключить GitHub? Токен будет удалён из этого браузера.')) disconnectGithub(); };
  tryRestoreGithub();
}
