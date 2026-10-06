/* ============================================================
   MODULE 02 — КАТАЛОГ (та же логика, что в Asset Renamer/Size Calibrator)
   Самый длинный id каталога, под который подходит имя файла целиком или как префикс до "_",
   побеждает — та же конвенция, что генератор и все редакторы используют для сопоставления
   assets/refs/<категория>/<файл>.png объекту data/objects/<id>.json.
   ============================================================ */
const CATEGORY_NAME_BY_ID={};
CATEGORIES.forEach(c=>{ CATEGORY_NAME_BY_ID[c.id]=c.name; });

let planCustomItems=[];
function planAllItems(){ return PLAN_ITEMS.concat(planCustomItems); }
function planItemById(id){ return planAllItems().find(i=>i.id===id); }

function computeFileMatches(files){
  const idsDesc=planAllItems().map(i=>i.id).sort((a,b)=>b.length-a.length);
  const out={};
  files.forEach(relPath=>{
    const base=relPath.split('/').pop().replace(/\.png$/i,'');
    const match=idsDesc.find(id=>base===id||base.startsWith(id+'_'));
    out[relPath]=match||null;
  });
  return out;
}
function variationSuffix(relPath,id){
  const stem=relPath.split('/').pop().replace(/\.png$/i,'');
  if(!id||stem===id) return '';
  return stem.startsWith(id+'_') ? stem.slice(id.length+1) : stem;
}
function humanizeSuffix(suffix){ return suffix?suffix.replace(/_/g,' '):'основная'; }
