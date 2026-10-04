/* ============================================================
   MODULE 02 — ПРИВЯЗКА ФАЙЛОВ К ОБЪЕКТАМ КАТАЛОГА
   Та же логика, что генератор (generate_objects.js) и Калибровщик размеров используют для
   сопоставления файла в assets/refs/ объекту: самый длинный id каталога, под который подходит
   имя файла целиком или как префикс до "_", побеждает — иначе короткий id вроде "tank" перехватил
   бы файл для "tank_water".
   PLAN_ITEMS/CATEGORIES уже загружены (object-plan/js/02-vocab.js + 03/04/05-data-*.js, см. index.html)
   — этого достаточно для имени/категории объекта по id, не дожидаясь отдельного запроса к его JSON.
   ============================================================ */
const CATEGORY_NAME_BY_ID={};
CATEGORIES.forEach(c=>{ CATEGORY_NAME_BY_ID[c.id]=c.name; });

// "Свои" объекты, добавленные через Image Prep Tool (панель именования → "+ новый раздел/объект")
// или Object Plan — живут в data/object_plan.json (поле custom), не в статических файлах каталога.
// Подмешиваем их сюда, иначе Asset Renamer не узнаёт о только что добавленном новом объекте: его
// фото проваливались бы в "⚠ Без JSON", а id не предлагался бы в автодополнении. См. loadAll() в
// 03-state.js (loadPlanCustomItems) и tools/ipt/image-prep-tool/js/02-plan-bridge.js (тот же файл).
let planCustomItems=[];
function planAllItems(){ return PLAN_ITEMS.concat(planCustomItems); }
function planItemById(id){ return planAllItems().find(i=>i.id===id); }

function computeFileMatches(files){
  const idsDesc=planAllItems().map(i=>i.id).sort((a,b)=>b.length-a.length);
  const out={};
  files.forEach(relPath=>{
    const base=relPath.split('/').pop().replace(SPRITE_EXT,'');
    const match=idsDesc.find(id=>base===id||base.startsWith(id+'_'));
    out[relPath]=match||null;
  });
  return out;
}
// Суффикс файла после id — то, что в списке/поле редактирования называется "вариация" (напр. для
// tank_water_stalnoy_tsilindr_idle.png при id=tank_water это "stalnoy_tsilindr_idle").
function variationSuffix(relPath,id){
  const stem=relPath.split('/').pop().replace(SPRITE_EXT,'');
  if(!id||stem===id) return '';
  return stem.startsWith(id+'_') ? stem.slice(id.length+1) : stem;
}
function humanizeSuffix(suffix){ return suffix?suffix.replace(/_/g,' '):'основная'; }

function matchesSearch(relPath,id,q){
  if(!q) return true;
  const item=id?planItemById(id):null;
  const hay=(relPath+' '+(item?item.id+' '+item.n+' '+(CATEGORY_NAME_BY_ID[item.c]||''):'')).toLowerCase();
  return hay.includes(q);
}
// Группы для списка слева: по категории найденного объекта, или "⚠ Без JSON" — последней группой.
function computeGroupedEntries(files,fileMatch,searchQuery){
  const q=(searchQuery||'').trim().toLowerCase();
  const visible=files.filter(p=>matchesSearch(p,fileMatch[p],q));
  const groups={};
  visible.forEach(p=>{
    const id=fileMatch[p];
    const item=id?planItemById(id):null;
    const g=item?(CATEGORY_NAME_BY_ID[item.c]||item.c):'⚠ Без JSON';
    (groups[g]=groups[g]||[]).push(p);
  });
  const groupNames=Object.keys(groups).sort((a,b)=>{
    if(a==='⚠ Без JSON') return 1;
    if(b==='⚠ Без JSON') return -1;
    return a.localeCompare(b,'ru');
  });
  return groupNames.map(g=>{
    const paths=groups[g].slice().sort((a,b)=>{
      const idA=fileMatch[a], idB=fileMatch[b];
      const nameA=(idA&&planItemById(idA)&&planItemById(idA).n)||a;
      const nameB=(idB&&planItemById(idB)&&planItemById(idB).n)||b;
      return nameA.localeCompare(nameB,'ru')||a.localeCompare(b,'ru');
    });
    return {groupName:g,paths};
  });
}
