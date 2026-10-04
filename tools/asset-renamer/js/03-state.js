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

async function loadAll(){
  document.getElementById('sourceList').innerHTML='<div class="hint">Загрузка assets/refs/…</div>';
  await loadPlanCustomItems();
  const r=await listFilesRecursive('assets/refs',SPRITE_EXT);
  allFiles=(r.files||[]).slice().sort();
  fileMatch=computeFileMatches(allFiles);
  jsonCache={};
  render();
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
  document.querySelectorAll('.file-row').forEach(el=>el.classList.toggle('active',el.dataset.path===path));
  renderCenter();
}

function logEvent(e){ eventLog=[{...e,at:new Date()},...eventLog].slice(0,300); renderRight(); }

document.getElementById('searchBox').addEventListener('input',e=>{ searchQuery=e.target.value; renderLeft(); });
