/* ============================================================
   MODULE 02 — STATE
   Загружает все data/objects/*.json, хранит рабочую копию каждого (правки живут
   в памяти до нажатия "Сохранить"), строит список слева, подгружает картинки
   из assets/sprites/ по appearance.asset лениво (по выбору объекта).
   ============================================================ */
let objectsById={};      // id -> рабочая (редактируемая) копия JSON
let objectsSavedJSON={};  // id -> JSON.stringify последней сохранённой/загруженной версии (для revert + badge "есть правки")
let imageUrlCache={};    // id -> object URL картинки (или null, если не найдена/битая)
let imageDimsCache={};   // id -> {w,h} реальные пиксели картинки (или null) — для "сохранить пропорции"
let selectedId=null;
let multiSelectedIds=new Set(); // текущее выделение в списке (для одиночного режима совпадает с {selectedId})
let lastClickedIndex=null;      // якорь для Shift+клик (индекс в getVisibleOrderedIds())
let searchQuery='';

async function loadAllObjects(){
  document.getElementById('objectList').innerHTML='<div class="empty-hint">Загрузка data/objects/…</div>';
  const r=await listJsonDir('data/objects');
  objectsById={}; objectsSavedJSON={};
  (r.items||[]).forEach(({name,data,broken})=>{
    if(broken||!data||!data.id) return;
    objectsById[data.id]=data;
    objectsSavedJSON[data.id]=JSON.stringify(data);
  });
  renderObjectList();
  const ids=Object.keys(objectsById);
  if(selectedId&&objectsById[selectedId]) selectObject(selectedId);
  else if(ids.length) selectObject(ids.find(id=>id!=='survivor_base')||ids[0]);
}

function isDirty(id){ const o=objectsById[id]; return !!o && JSON.stringify(o)!==objectsSavedJSON[id]; }

function matchesSearch(o,q){
  if(!q) return true;
  const hay=(o.id+' '+(o.name||'')+' '+(o.category_name||'')).toLowerCase();
  return hay.includes(q);
}

// Тот же порядок, что рисует список (группы по алфавиту, внутри группы — по имени) — используется
// и рендером, и Tab-навигацией (чтобы "следующий" в клавиатуре совпадал с тем, что "следующий" на экране).
function getVisibleOrderedIds(){
  const q=searchQuery.trim().toLowerCase();
  const all=Object.values(objectsById).filter(o=>matchesSearch(o,q));
  const groups={};
  all.forEach(o=>{ const g=o.category_name||o.category||'—'; (groups[g]=groups[g]||[]).push(o); });
  const groupNames=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'ru'));
  const out=[];
  for(const g of groupNames) groups[g].sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id,'ru')).forEach(o=>out.push(o.id));
  return out;
}

function renderObjectList(){
  const root=document.getElementById('objectList');
  const q=searchQuery.trim().toLowerCase();
  const all=Object.values(objectsById).filter(o=>matchesSearch(o,q));
  const groups={};
  all.forEach(o=>{ const g=o.category_name||o.category||'—'; (groups[g]=groups[g]||[]).push(o); });
  const groupNames=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'ru'));
  if(!groupNames.length){ root.innerHTML='<div class="empty-hint">Ничего не найдено.</div>'; return; }
  let html='';
  for(const g of groupNames){
    const items=groups[g].sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id,'ru'));
    html+=`<div class="obj-group">${esc(g)} (${items.length})</div>`;
    for(const o of items){
      const b=o.behavior||{};
      const w=Math.round(b.real_width_cm||0), h=Math.round(b.real_height_cm||0);
      const warn=!w||!h;
      const dirty=isDirty(o.id);
      html+=`<div class="obj-row${multiSelectedIds.has(o.id)?' active':''}" data-id="${esc(o.id)}">
        <span class="thumb" id="thumb_${esc(o.id)}"><span class="thumb-empty">${o.appearance&&o.appearance.asset?'…':'∅'}</span></span>
        <span class="n"><span class="t">${dirty?'● ':''}${esc(o.name||o.id)}</span><span class="sz${warn?' warn':''}">${w}×${h} см</span></span>
      </div>`;
    }
  }
  root.innerHTML=html;
  const total=Object.keys(objectsById).length;
  const withImg=Object.values(objectsById).filter(o=>o.appearance&&o.appearance.asset).length;
  const cov=document.getElementById('coverageLabel');
  if(cov) cov.textContent=total?`${withImg}/${total} объектов с картинкой`:'';
  root.querySelectorAll('.obj-row').forEach(el=>{ el.addEventListener('click',e=>onObjectRowClick(el.dataset.id,e)); });
  // Миниатюры подгружаем лениво и только для видимых категорий — не дожидаясь выбора объекта.
  Object.values(objectsById).filter(o=>matchesSearch(o,q)).forEach(o=>loadThumb(o.id));
}

async function loadThumb(id){
  const el=document.getElementById('thumb_'+id);
  if(!el) return;
  const url=await getObjectImageUrl(id);
  const cur=document.getElementById('thumb_'+id); // список мог перерисоваться, пока грузили
  if(!cur) return;
  cur.innerHTML = url ? `<img src="${url}">` : '<span class="thumb-empty">∅</span>';
}

async function getObjectImageUrl(id){
  if(id in imageUrlCache) return imageUrlCache[id];
  const o=objectsById[id];
  const rel=o&&o.appearance&&o.appearance.asset;
  if(!rel){ imageUrlCache[id]=null; return null; }
  const clean=String(rel).replace(/^assets\/sprites\//,'').replace(/^\//,'');
  const file=await readProjectFileBlob('assets/sprites/'+clean);
  if(!file){ imageUrlCache[id]=null; return null; }
  const url=URL.createObjectURL(file);
  const ok=await new Promise(res=>{ const im=new Image(); im.onload=()=>res(true); im.onerror=()=>res(false); im.src=url; });
  if(!ok){ URL.revokeObjectURL(url); imageUrlCache[id]=null; return null; }
  imageUrlCache[id]=url;
  return url;
}

// Лёгкое обновление одной строки списка (размер/точка "есть правки") — вызывается на каждый ввод
// в инспекторе, чтобы не перестраивать весь список (и не дёргать повторную загрузку миниатюр).
function updateListRowBadge(id){
  const row=document.querySelector(`.obj-row[data-id="${CSS.escape(id)}"]`);
  if(!row) return;
  const o=objectsById[id]; if(!o) return;
  const b=o.behavior||{};
  const w=Math.round(b.real_width_cm||0), h=Math.round(b.real_height_cm||0);
  const szEl=row.querySelector('.sz');
  if(szEl){ szEl.textContent=w+'×'+h+' см'; szEl.className='sz'+((!w||!h)?' warn':''); }
  const tEl=row.querySelector('.t');
  if(tEl) tEl.textContent=(isDirty(id)?'● ':'')+(o.name||o.id);
}

// Реальные пиксельные пропорции картинки объекта (не то же самое, что appearance.imageWidth/Height
// в JSON — те могли быть записаны неточно раньше; здесь читаем их заново с самого файла).
async function getObjectImageNaturalDims(id){
  if(id in imageDimsCache) return imageDimsCache[id];
  const url=await getObjectImageUrl(id);
  if(!url){ imageDimsCache[id]=null; return null; }
  const dims=await new Promise(res=>{ const im=new Image(); im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight}); im.onerror=()=>res(null); im.src=url; });
  imageDimsCache[id]=dims;
  return dims;
}

// Обычный клик (без модификаторов) — всегда одиночный выбор, сбрасывает любое множественное выделение.
async function selectObject(id){
  multiSelectedIds=new Set(id?[id]:[]);
  selectedId=id;
  lastClickedIndex=getVisibleOrderedIds().indexOf(id);
  renderObjectList();
  const o=objectsById[id];
  if(!o) return;
  document.getElementById('selectedHint').textContent=o.name+' ('+o.id+')';
  renderInspector(o);
  await renderScene(o);
  const row=document.querySelector(`.obj-row[data-id="${CSS.escape(id)}"]`);
  if(row) row.scrollIntoView({block:'nearest'});
}

// Shift+клик — диапазон от последнего клика до этого (как в проводнике). Ctrl/Cmd+клик — добавить/
// убрать именно этот объект, не трогая остальное выделение. Обычный клик — см. selectObject() выше.
function onObjectRowClick(id,e){
  const ids=getVisibleOrderedIds();
  const idx=ids.indexOf(id);
  if(e.shiftKey && lastClickedIndex!=null){
    const [a,b]=[lastClickedIndex,idx].sort((x,y)=>x-y);
    multiSelectedIds=new Set(ids.slice(a,b+1));
    renderObjectList();
    onSelectionChanged();
    return;
  }
  if(e.ctrlKey||e.metaKey){
    if(multiSelectedIds.size===0 && selectedId) multiSelectedIds=new Set([selectedId]);
    if(multiSelectedIds.has(id)) multiSelectedIds.delete(id); else multiSelectedIds.add(id);
    lastClickedIndex=idx;
    renderObjectList();
    onSelectionChanged();
    return;
  }
  lastClickedIndex=idx;
  selectObject(id);
}

// После Shift/Ctrl-клика решает: 0/1 объект — обычная одиночная панель, 2+ — массовое редактирование.
function onSelectionChanged(){
  if(multiSelectedIds.size<=1){
    const id=[...multiSelectedIds][0]||null;
    selectedId=id;
    if(id){
      const o=objectsById[id];
      if(o){ document.getElementById('selectedHint').textContent=o.name+' ('+o.id+')'; renderInspector(o); renderScene(o); }
    } else clearInspectorAndScene();
    return;
  }
  selectedId=null;
  document.getElementById('selectedHint').textContent=multiSelectedIds.size+' объектов выбрано';
  renderBulkInspector();
}

function clearInspectorAndScene(){
  document.getElementById('inspector').innerHTML='<div class="empty-hint">Выбери объект слева, чтобы задать его реальный размер и характеристики.</div>';
  document.getElementById('selectedHint').textContent='Выбери объект слева — он появится рядом с персонажем в реальном масштабе (1см = 1px при 100%)';
  renderScene(null);
}

// Tab/Shift+Tab — следующий/предыдущий объект в текущем (отфильтрованном) списке, по кругу.
// Всегда возвращает к одиночному выбору (см. selectObject) — быстрый просмотр по одному после
// массового редактирования начинается заново от текущего объекта.
function navigateObjectList(delta){
  const ids=getVisibleOrderedIds();
  if(!ids.length) return;
  const curIdx=ids.indexOf(selectedId);
  const nextIdx=curIdx===-1 ? 0 : (curIdx+delta+ids.length)%ids.length;
  selectObject(ids[nextIdx]);
}

document.getElementById('searchBox').addEventListener('input',e=>{ searchQuery=e.target.value; renderObjectList(); });
