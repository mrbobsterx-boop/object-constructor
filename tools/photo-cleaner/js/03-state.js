/* ============================================================
   MODULE 03 — STATE
   Три колонки — это не три отдельных списка фото, а три состояния ОДНОГО и того же набора путей:
   'active' (всё ещё в проекте) → 'staged' (временно удалено, можно вернуть) → 'pending' (удалится
   навсегда по кнопке "Сохранить"). fileMatch вычисляется один раз при загрузке и не меняется —
   он нужен и для подписи карточки, и для логики удаления JSON при коммите (05-actions.js).
   ============================================================ */
let allPaths=[];          // полный список relPath (от assets/refs/), неизменный после загрузки
let fileMatch={};         // relPath -> id каталога или null
let imageUrlCache={};     // relPath -> object URL

let colActive=[];         // порядок колонки 1
let colStaged=[];         // порядок колонки 2 (стек: новые — в конец)
let colPending=[];        // порядок колонки 3 (стек: новые — в конец)

let activeColumn='active';  // какая колонка сейчас "в фокусе" клавиатуры: 'active'|'staged'|'pending'
let selectedPath=null;      // выбранный путь внутри activeColumn

async function loadAll(){
  document.getElementById('colAll').innerHTML='<div class="hint">Загрузка assets/refs…</div>';
  await loadPlanCustomItems();
  const r=await listFilesRecursive('assets/refs',/\.png$/i);
  allPaths=(r.files||[]).slice().sort();
  fileMatch=computeFileMatches(allPaths);
  colActive=allPaths.slice();
  colStaged=[];
  colPending=[];
  activeColumn='active';
  selectedPath=colActive[0]||null;
  render();
}
async function loadPlanCustomItems(){
  try{
    const r=await readSingleJson('data/object_plan.json');
    planCustomItems=(r&&r.data&&Array.isArray(r.data.custom))?r.data.custom:[];
  }catch(e){ planCustomItems=[]; }
}

async function getImageUrl(relPath){
  if(relPath in imageUrlCache) return imageUrlCache[relPath];
  const file=await readProjectFileBlob('assets/refs/'+relPath);
  if(!file){ imageUrlCache[relPath]=null; return null; }
  const url=URL.createObjectURL(file);
  imageUrlCache[relPath]=url;
  return url;
}

function cardTitle(relPath){
  const id=fileMatch[relPath];
  const item=id?planItemById(id):null;
  return item?item.n:relPath.split('/').pop();
}
function cardSub(relPath){
  const id=fileMatch[relPath];
  if(!id) return '⚠ нет JSON';
  return humanizeSuffix(variationSuffix(relPath,id));
}

function selectIn(column,path){
  activeColumn=column;
  selectedPath=path;
  render();
}
// Следующий/предыдущий путь в ТЕКУЩЕЙ активной колонке, по кругу.
function navigate(delta){
  const list=columnList(activeColumn);
  if(!list.length){ selectedPath=null; render(); return; }
  const idx=list.indexOf(selectedPath);
  const next=idx===-1?0:(idx+delta+list.length)%list.length;
  selectedPath=list[next];
  render();
}
function columnList(name){
  return name==='active'?colActive:name==='staged'?colStaged:colPending;
}
