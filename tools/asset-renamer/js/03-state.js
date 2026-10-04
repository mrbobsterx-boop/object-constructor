/* ============================================================
   MODULE 03 — STATE
   allFiles — каждый .png/.jpg/... из assets/refs/ (рекурсивно). fileMatch — его id каталога (или
   null). jsonCache — лениво подгруженные data/objects/<id>.json (нужны только когда реально правим
   имя объекта — не тянем все 180 сразу, в отличие от Калибровщика размеров: здесь это не нужно).
   ============================================================ */
let allFiles=[];
let fileMatch={};
let fileUrlCache={};
let jsonCache={};     // id -> {...} распарсенный JSON объекта (текущая сохранённая версия)
let selectedPath=null;
let searchQuery='';
let eventLog=[];

// "Просмотрено" — отметка, что с этим файлом уже разобрались (либо поправили, либо он и так
// правильный) — переживает перезагрузку страницы (localStorage), чтобы при следующем заходе было
// видно, что уже сделано, а что ещё нет. Ключ — путь файла; при переименовании/переносе файла
// (doRename, 05-actions.js) метка переезжает со старого пути на новый.
let reviewedPaths=new Set();
const REVIEWED_STORAGE_KEY='asset_renamer_reviewed_v1';
function loadReviewedFromStorage(){
  try{
    const raw=localStorage.getItem(REVIEWED_STORAGE_KEY);
    reviewedPaths=new Set(raw?JSON.parse(raw):[]);
  }catch(e){ reviewedPaths=new Set(); }
}
function saveReviewedToStorage(){
  try{ localStorage.setItem(REVIEWED_STORAGE_KEY,JSON.stringify(Array.from(reviewedPaths))); }catch(e){}
}
function isReviewed(path){ return reviewedPaths.has(path); }
function markReviewed(path){
  if(!path||reviewedPaths.has(path)) return;
  reviewedPaths.add(path);
  saveReviewedToStorage();
}

async function loadAll(){
  document.getElementById('sourceList').innerHTML='<div class="hint">Загрузка assets/refs/…</div>';
  loadReviewedFromStorage();
  await loadPlanCustomItems();
  const r=await listFilesRecursive('assets/refs',SPRITE_EXT);
  allFiles=(r.files||[]).slice().sort();
  fileMatch=computeFileMatches(allFiles);
  jsonCache={};
  render();
}

// Тот же порядок, что виден в списке слева (сгруппировано по категории, учитывает поиск) —
// используется и отрисовкой, и Tab-навигацией (06-keyboard-nav.js), чтобы они не расходились.
function getVisibleOrderedPaths(){
  return computeGroupedEntries(allFiles,fileMatch,searchQuery).flatMap(g=>g.paths);
}
function navigateList(delta){
  const paths=getVisibleOrderedPaths();
  if(!paths.length) return;
  let idx=paths.indexOf(selectedPath);
  if(idx<0) idx=delta>0?-1:0;
  idx=(idx+delta+paths.length)%paths.length;
  selectPath(paths[idx]);
}
// "Свои" объекты из data/object_plan.json (тот же файл читает/пишет Object Plan и Image Prep Tool,
// см. tools/ipt/image-prep-tool/js/02-plan-bridge.js) — чтобы новый объект, которого ещё нет в
// статическом каталоге (PLAN_ITEMS), сразу матчился тут и предлагался в автодополнении id.
async function loadPlanCustomItems(){
  try{
    const r=await readSingleJson('data/object_plan.json');
    planCustomItems=(r&&r.data&&Array.isArray(r.data.custom))?r.data.custom:[];
  }catch(e){ planCustomItems=[]; }
}

async function getFileUrl(relPath){
  if(relPath in fileUrlCache) return fileUrlCache[relPath];
  const file=await readProjectFileBlob('assets/refs/'+relPath);
  if(!file){ fileUrlCache[relPath]=null; return null; }
  const url=URL.createObjectURL(file);
  fileUrlCache[relPath]=url;
  return url;
}
// Текущий (реальный, не из каталога-заготовки) JSON объекта — тянем по требованию, когда реально
// открываем файл на редактирование, чтобы не трогать все 180 объектов при каждой загрузке страницы.
async function getObjectJson(id){
  if(jsonCache[id]!==undefined) return jsonCache[id];
  const r=await readSingleJson('data/objects/'+id+'.json');
  jsonCache[id]=(r&&r.data)?r.data:null;
  return jsonCache[id];
}

function selectPath(path){
  selectedPath=path;
  let activeEl=null;
  document.querySelectorAll('.file-row').forEach(el=>{
    const isActive=el.dataset.path===path;
    el.classList.toggle('active',isActive);
    if(isActive) activeEl=el;
  });
  if(activeEl) activeEl.scrollIntoView({block:'nearest'});
  renderCenter();
}

function logEvent(e){ eventLog=[{...e,at:new Date()},...eventLog].slice(0,300); renderRight(); }

document.getElementById('searchBox').addEventListener('input',e=>{ searchQuery=e.target.value; renderLeft(); });
