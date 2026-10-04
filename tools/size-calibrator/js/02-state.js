/* ============================================================
   MODULE 02 — STATE
   Список слева строится по КАЖДОЙ картинке в assets/refs/ (не только по 180
   уже привязанным объектам) — у каждого id может быть несколько картинок-скинов,
   плюс могут быть фото, которые ни к какому id ещё не привязаны (нет JSON).
   objectsById хранит рабочие (редактируемые) копии data/objects/*.json; правки
   живут в памяти до нажатия "Сохранить".
   ============================================================ */
let objectsById={};       // id -> рабочая (редактируемая) копия JSON
let objectsSavedJSON={};  // id -> JSON.stringify последней сохранённой/загруженной версии (для revert + "есть правки")
let allRefFiles=[];       // все relPath (от assets/refs/) с картинками .png
let refFileMatch={};      // relPath -> id (по тому же правилу, что генератор: basename===id или начинается с id+'_') или null
let refImageUrlCache={};  // relPath -> object URL (или null, если не найдена/битая) — сама картинка, как она есть в assets/refs/
let refImageDimsCache={}; // relPath -> {w,h} реальные пиксели (или null) — для "сохранить пропорции"
let imageUrlCache={};     // id -> object URL ОФИЦИАЛЬНОЙ (привязанной) картинки из assets/sprites/ — нужна только для сцены массового режима
let selectedPath=null;    // relPath выбранного сейчас фото (одиночный режим)
let selectedId=null;      // производное: refFileMatch[selectedPath], или null для фото без JSON
let multiSelectedPaths=new Set(); // текущее выделение в списке (путей)
let multiSelectedIds=new Set();   // производное: уникальные id выделенных путей (без null) — для массового режима
let lastClickedIndex=null;        // якорь для Shift+клик (индекс в getVisibleOrderedPaths())
let searchQuery='';

async function loadAllObjects(){
  document.getElementById('objectList').innerHTML='<div class="empty-hint">Загрузка data/objects/ и assets/refs/…</div>';
  const [objRes,refRes]=await Promise.all([
    listJsonDir('data/objects'),
    listFilesRecursive('assets/refs',/\.png$/i)
  ]);
  objectsById={}; objectsSavedJSON={};
  (objRes.items||[]).forEach(({name,data,broken})=>{
    if(broken||!data||!data.id) return;
    objectsById[data.id]=data;
    objectsSavedJSON[data.id]=JSON.stringify(data);
  });
  allRefFiles=(refRes.files||[]).slice().sort();
  computeRefFileMatches();
  renderObjectList();
  const paths=getVisibleOrderedPaths();
  if(selectedPath&&allRefFiles.includes(selectedPath)) selectPhoto(selectedPath);
  else if(paths.length) selectPhoto(paths[0]);
}

// Та же логика, что generate_objects.js использует при сборке data/objects/*.json: самый длинный id,
// под который подходит имя файла (целиком или как префикс до "_"), побеждает — иначе 'tank' схватил бы
// файл для 'tank_water'.
function computeRefFileMatches(){
  const idsDesc=Object.keys(objectsById).sort((a,b)=>b.length-a.length);
  refFileMatch={};
  allRefFiles.forEach(relPath=>{
    const base=relPath.split('/').pop().replace(/\.png$/i,'');
    const match=idsDesc.find(id=>base===id||base.startsWith(id+'_'));
    refFileMatch[relPath]=match||null;
  });
}

function isDirty(id){ const o=objectsById[id]; return !!o && JSON.stringify(o)!==objectsSavedJSON[id]; }

function matchesSearchPhoto(relPath,id,q){
  if(!q) return true;
  const o=id?objectsById[id]:null;
  const hay=(relPath+' '+(o?o.id+' '+(o.name||'')+' '+(o.category_name||''):'')).toLowerCase();
  return hay.includes(q);
}

// Группирует видимые (отфильтрованные поиском) фото: по category_name привязанного объекта, или
// отдельной группой "⚠ Без JSON" (всегда последней) для фото без привязки. Внутри группы — по имени
// объекта (чтобы скины одного id шли подряд), затем по имени файла.
function computeGroupedPhotoEntries(){
  const q=searchQuery.trim().toLowerCase();
  const entries=allRefFiles.filter(p=>matchesSearchPhoto(p,refFileMatch[p],q));
  const groups={};
  entries.forEach(p=>{
    const id=refFileMatch[p];
    const g=(id&&objectsById[id])?(objectsById[id].category_name||objectsById[id].category||'—'):'⚠ Без JSON';
    (groups[g]=groups[g]||[]).push(p);
  });
  const groupNames=Object.keys(groups).sort((a,b)=>{
    if(a==='⚠ Без JSON') return 1;
    if(b==='⚠ Без JSON') return -1;
    return a.localeCompare(b,'ru');
  });
  return groupNames.map(g=>{
    const paths=groups[g].slice().sort((a,b)=>{
      const idA=refFileMatch[a], idB=refFileMatch[b];
      const nameA=(idA&&objectsById[idA]&&objectsById[idA].name)||a;
      const nameB=(idB&&objectsById[idB]&&objectsById[idB].name)||b;
      return nameA.localeCompare(nameB,'ru')||a.localeCompare(b,'ru');
    });
    return {groupName:g,paths};
  });
}

// Тот же порядок, что рисует список — используется и рендером, и Tab-навигацией.
function getVisibleOrderedPaths(){
  return computeGroupedPhotoEntries().flatMap(g=>g.paths);
}

function variationLabel(relPath,id){
  const stem=relPath.split('/').pop().replace(/\.png$/i,'');
  if(!id||stem===id) return 'основная';
  return stem.startsWith(id+'_') ? stem.slice(id.length+1).replace(/_/g,' ') : stem;
}

function renderObjectList(){
  const root=document.getElementById('objectList');
  const grouped=computeGroupedPhotoEntries();
  if(!grouped.length){ root.innerHTML='<div class="empty-hint">Ничего не найдено.</div>'; return; }
  let html='';
  for(const {groupName,paths} of grouped){
    html+=`<div class="obj-group">${esc(groupName)} (${paths.length})</div>`;
    for(const p of paths){
      const id=refFileMatch[p];
      const o=id?objectsById[id]:null;
      const active=multiSelectedPaths.has(p);
      if(o){
        const b=o.behavior||{};
        const w=Math.round(b.real_width_cm||0), h=Math.round(b.real_height_cm||0);
        const warn=!w||!h;
        const dirty=isDirty(id);
        html+=`<div class="obj-row${active?' active':''}" data-path="${esc(p)}">
          <span class="thumb"><span class="thumb-empty">…</span></span>
          <span class="n"><span class="t">${dirty?'● ':''}${esc(o.name||id)}</span><span class="sub">${esc(variationLabel(p,id))}</span><span class="sz${warn?' warn':''}">${w}×${h} см</span></span>
        </div>`;
      } else {
        html+=`<div class="obj-row${active?' active':''}" data-path="${esc(p)}">
          <span class="thumb"><span class="thumb-empty">…</span></span>
          <span class="n"><span class="t">${esc(p.split('/').pop())}</span><span class="sz warn">⚠ нет JSON</span></span>
        </div>`;
      }
    }
  }
  root.innerHTML=html;

  const totalObjects=Object.keys(objectsById).length;
  const matchedPhotos=allRefFiles.filter(p=>refFileMatch[p]).length;
  const cov=document.getElementById('coverageLabel');
  if(cov) cov.textContent=`${allRefFiles.length} фото · ${matchedPhotos} с JSON · ${allRefFiles.length-matchedPhotos} без JSON · ${totalObjects} объектов в каталоге`;

  const allPaths=grouped.flatMap(g=>g.paths);
  const rowEls=root.querySelectorAll('.obj-row');
  rowEls.forEach((el,i)=>el.addEventListener('click',e=>onPhotoRowClick(allPaths[i],e)));
  // Миниатюры — лениво, с ограничением параллелизма (ghMapLimit уже используется для того же в
  // GitHub-режиме; тут файлов может быть за тысячу, без лимита это или зависание, или rate limit).
  ghMapLimit(allPaths,8,async(p,i)=>{ await loadPhotoThumb(p,rowEls[i]); });
}

async function loadPhotoThumb(p,rowEl){
  if(!rowEl) return;
  const url=await getRefImageUrl(p);
  if(!rowEl.isConnected || rowEl.dataset.path!==p) return; // список мог перестроиться, пока грузили
  const thumbEl=rowEl.querySelector('.thumb');
  if(thumbEl) thumbEl.innerHTML = url ? `<img src="${url}">` : '<span class="thumb-empty">∅</span>';
}

async function getRefImageUrl(path){
  if(path in refImageUrlCache) return refImageUrlCache[path];
  const file=await readProjectFileBlob('assets/refs/'+path);
  if(!file){ refImageUrlCache[path]=null; return null; }
  const url=URL.createObjectURL(file);
  const ok=await new Promise(res=>{ const im=new Image(); im.onload=()=>res(true); im.onerror=()=>res(false); im.src=url; });
  if(!ok){ URL.revokeObjectURL(url); refImageUrlCache[path]=null; return null; }
  refImageUrlCache[path]=url;
  return url;
}
async function getRefImageNaturalDims(path){
  if(path in refImageDimsCache) return refImageDimsCache[path];
  const url=await getRefImageUrl(path);
  if(!url){ refImageDimsCache[path]=null; return null; }
  const dims=await new Promise(res=>{ const im=new Image(); im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight}); im.onerror=()=>res(null); im.src=url; });
  refImageDimsCache[path]=dims;
  return dims;
}
// Официальная (привязанная через appearance.asset) картинка объекта из assets/sprites/ — используется
// только сценой массового режима (там объекты разные, показываем то, что реально видно в игре).
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

// Лёгкое обновление строк списка для одного id (их может быть НЕСКОЛЬКО — у id несколько фото) —
// вызывается на каждый ввод в инспекторе, чтобы не перестраивать весь список.
function updateListRowBadge(id){
  const o=objectsById[id]; if(!o) return;
  const b=o.behavior||{};
  const w=Math.round(b.real_width_cm||0), h=Math.round(b.real_height_cm||0);
  const dirty=isDirty(id);
  document.querySelectorAll('.obj-row').forEach(row=>{
    if(refFileMatch[row.dataset.path]!==id) return;
    const szEl=row.querySelector('.sz');
    if(szEl){ szEl.textContent=w+'×'+h+' см'; szEl.className='sz'+((!w||!h)?' warn':''); }
    const tEl=row.querySelector('.t');
    if(tEl) tEl.textContent=(dirty?'● ':'')+(o.name||id);
  });
}

function recomputeMultiSelectedIds(){
  multiSelectedIds=new Set([...multiSelectedPaths].map(p=>refFileMatch[p]).filter(Boolean));
}

// Переименовывает ОДНО фото (меняет только его файл в assets/refs/, оставляя id объекта как есть) —
// это то, что пользователь на самом деле хочет, когда зовёт это "сменить имя у одного": у объекта
// на всех его фото одно общее name (одна строка в data/objects/<id>.json), а вот какое из них "Полка
// двойная сломанная" и какое "Полка металлическая с крючками" — определяется именем ФАЙЛА, и это
// можно менять независимо для каждого фото. newSuffixSlug='' означает "без суффикса" (= сам id).
async function renamePhotoVariation(oldPath,newSuffixSlug){
  const id=refFileMatch[oldPath];
  if(!id) return {ok:false,error:'У этого фото нет JSON — переименование недоступно.'};
  const lastSlash=oldPath.lastIndexOf('/');
  const dir=lastSlash>=0?oldPath.slice(0,lastSlash+1):'';
  const newStem=newSuffixSlug?id+'_'+newSuffixSlug:id;
  const newPath=dir+newStem+'.png';
  if(newPath===oldPath) return {ok:true,path:oldPath};
  if(allRefFiles.includes(newPath)) return {ok:false,error:'Файл с таким именем уже есть: '+newPath};
  const file=await readProjectFileBlob('assets/refs/'+oldPath);
  if(!file) return {ok:false,error:'Не удалось прочитать файл для переименования.'};
  const bytes=new Uint8Array(await file.arrayBuffer());
  const wrote=await writeFileToProject('assets/refs/'+newPath,bytes);
  if(!wrote) return {ok:false,error:'Не удалось записать новый файл (папка/GitHub не подключены?).'};
  await deleteProjectFile('assets/refs/'+oldPath);
  const idx=allRefFiles.indexOf(oldPath);
  if(idx>=0) allRefFiles[idx]=newPath; else allRefFiles.push(newPath);
  delete refImageUrlCache[oldPath]; delete refImageDimsCache[oldPath];
  refFileMatch[newPath]=id; delete refFileMatch[oldPath];
  if(multiSelectedPaths.has(oldPath)){ multiSelectedPaths.delete(oldPath); multiSelectedPaths.add(newPath); }
  if(selectedPath===oldPath) selectedPath=newPath;
  if(lastClickedIndex!=null){ /* индекс мог сместиться вместе со списком — пересчитается на следующем клике */ }
  return {ok:true,path:newPath};
}

// Обычный клик (без модификаторов) — всегда одиночный выбор, сбрасывает любое множественное выделение.
async function selectPhoto(path){
  multiSelectedPaths=new Set(path?[path]:[]);
  recomputeMultiSelectedIds();
  selectedPath=path;
  selectedId=refFileMatch[path]||null;
  lastClickedIndex=getVisibleOrderedPaths().indexOf(path);
  renderObjectList();
  if(selectedId && objectsById[selectedId]){
    const o=objectsById[selectedId];
    document.getElementById('selectedHint').textContent=o.name+' ('+o.id+') — '+path.split('/').pop();
    renderInspector(o,path);
    await renderScene(o,false,await getRefImageUrl(path));
  } else {
    document.getElementById('selectedHint').textContent=path?path.split('/').pop()+' — нет JSON':'';
    renderNoJsonInspector(path);
    await renderScene(null);
  }
  const row=[...document.querySelectorAll('.obj-row')].find(el=>el.dataset.path===path);
  if(row) row.scrollIntoView({block:'nearest'});
}

// Shift+клик — диапазон от последнего клика до этого (как в проводнике). Ctrl/Cmd+клик — добавить/
// убрать именно этот путь, не трогая остальное выделение. Обычный клик — см. selectPhoto() выше.
function onPhotoRowClick(path,e){
  const paths=getVisibleOrderedPaths();
  const idx=paths.indexOf(path);
  if(e.shiftKey && lastClickedIndex!=null){
    const [a,b]=[lastClickedIndex,idx].sort((x,y)=>x-y);
    multiSelectedPaths=new Set(paths.slice(a,b+1));
    recomputeMultiSelectedIds();
    renderObjectList();
    onSelectionChanged();
    return;
  }
  if(e.ctrlKey||e.metaKey){
    if(multiSelectedPaths.size===0 && selectedPath) multiSelectedPaths=new Set([selectedPath]);
    if(multiSelectedPaths.has(path)) multiSelectedPaths.delete(path); else multiSelectedPaths.add(path);
    recomputeMultiSelectedIds();
    lastClickedIndex=idx;
    renderObjectList();
    onSelectionChanged();
    return;
  }
  lastClickedIndex=idx;
  selectPhoto(path);
}

// После Shift/Ctrl-клика решает: 0/1 путь — обычная одиночная панель, 2+ — массовое редактирование
// (по уникальным id выделенных путей — фото без JSON в массовое редактирование не попадают).
function onSelectionChanged(){
  if(multiSelectedPaths.size<=1){
    const path=[...multiSelectedPaths][0]||null;
    selectPhoto(path);
    return;
  }
  selectedPath=null; selectedId=null;
  document.getElementById('selectedHint').textContent=multiSelectedPaths.size+' фото выбрано ('+multiSelectedIds.size+' объектов)';
  if(multiSelectedIds.size>=2) renderBulkInspector();
  else if(multiSelectedIds.size===1){ selectedId=[...multiSelectedIds][0]; renderInspector(objectsById[selectedId],null); renderScene(objectsById[selectedId]); }
  else clearInspectorAndScene();
}

function clearInspectorAndScene(){
  document.getElementById('inspector').innerHTML='<div class="empty-hint">Выбери фото слева, чтобы задать его объекту реальный размер и характеристики.</div>';
  document.getElementById('selectedHint').textContent='Выбери фото слева — объект появится рядом с персонажем в реальном масштабе (1см = 1px при 100%)';
  renderScene(null);
}

// Tab/Shift+Tab — следующее/предыдущее фото в текущем (отфильтрованном) списке, по кругу.
// Всегда возвращает к одиночному выбору — быстрый просмотр по одному после массового
// редактирования начинается заново от текущего фото.
function navigateObjectList(delta){
  const paths=getVisibleOrderedPaths();
  if(!paths.length) return;
  const curIdx=paths.indexOf(selectedPath);
  const nextIdx=curIdx===-1 ? 0 : (curIdx+delta+paths.length)%paths.length;
  selectPhoto(paths[nextIdx]);
}

document.getElementById('searchBox').addEventListener('input',e=>{ searchQuery=e.target.value; renderObjectList(); });
