/* ============================================================
   MODULE 02 — CATALOG / PROJECT SETTINGS
   Object catalog from the project folder, project_settings.json, list of existing rooms.
   ============================================================ */

/* ============================================================
   CATALOG: читает data/objects/*.json + картинки из assets/sprites/
   — то же самое, что видит библиотека крафта в Object Constructor.
   ============================================================ */
let projectCatalog=[]; // {id,category,name,image(object URL / data URL / null),imageIssue,json}
let existingRoomIds=[]; // список id уже сохранённых комнат — для выбора двери "куда ведёт"
let existingRoomsList=[]; // {id,name}[] — для выпадашки "Открыть"

/* ---- картинки объектов каталога ----
   Порядок поиска: основная → статичное состояние → первый кадр анимации (idle, иначе первая).
   Файл проверяется на «декодируемость»: пустой/битый PNG даёт заглушку, а не битую иконку браузера. */
async function readSpriteFile(spritesDir,rel){
  if(!spritesDir||!rel) return null;
  try{
    const clean=String(rel).replace(/^assets\/sprites\//,'').replace(/^\//,'');
    const parts=clean.split('/'); const fileName=parts.pop();
    const subDir=parts.length? await getSubdir(spritesDir,parts.join('/'),false) : spritesDir;
    return await (await subDir.getFileHandle(fileName)).getFile();
  }catch(e){ return null; }
}
function decodeOk(url){ return new Promise(res=>{ const im=new Image(); im.onload=()=>res(true); im.onerror=()=>res(false); im.src=url; }); }
async function spriteUrl(spritesDir,rel,issue){
  const f=await readSpriteFile(spritesDir,rel);
  if(!f){ if(issue&&!issue.kind) issue.kind='missing'; return null; }
  const url=URL.createObjectURL(f);
  if(await decodeOk(url)) return url;
  URL.revokeObjectURL(url); if(issue) issue.kind='invalid'; return null;
}
async function firstFrameDataUrl(file,frameCount){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=url; });
    const n=frameCount>0 ? frameCount : Math.max(1,Math.round(img.naturalWidth/Math.max(1,img.naturalHeight))); // лист — полоска кадров одной ширины
    const fw=Math.max(1,Math.floor(img.naturalWidth/n)), fh=Math.max(1,img.naturalHeight);
    const c=document.createElement('canvas'); c.width=fw; c.height=fh; // кадр в полном размере — он же рисуется на холсте комнаты
    const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.drawImage(img,0,0,fw,fh,0,0,fw,fh);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
async function loadCatalogThumb(spritesDir,obj){
  const out={image:null,imageIssue:null};
  if(!spritesDir) return out;
  const assetRel=obj.appearance&&obj.appearance.asset, vis=obj.visuals||{};
  const issue={kind:null,path:assetRel||''};
  if(assetRel){ const u=await spriteUrl(spritesDir,assetRel,issue); if(u){ out.image=u; return out; } }
  for(const s of (vis.images||[])){ const u=await spriteUrl(spritesDir,s&&s.asset,null); if(u){ out.image=u; return out; } }
  const anims=(vis.animations||[]).slice().sort((a,b)=>(b.name===vis.idle)-(a.name===vis.idle));
  for(const a of anims){
    const f=await readSpriteFile(spritesDir,a.asset); if(!f)continue;
    try{ out.image=await firstFrameDataUrl(f,a.frame_count); return out; }catch(e){}
  }
  if(assetRel && issue.kind) out.imageIssue=issue;
  return out;
}
// Превью в библиотеке: нет картинки → заглушка с подсказкой (а не «битая» иконка)
function catalogThumbHtml(e,size){
  const s=size||40;
  if(e&&e.image) return `<img src="${e.image}">`;
  const iss=e&&e.imageIssue;
  const why=iss ? (iss.kind==='invalid'?'Файл картинки повреждён (пустой или не PNG): ':'Основная картинка не найдена на диске: ')+'assets/sprites/'+iss.path
                : 'У объекта нет картинки: не задана основная картинка и нет кадров анимации';
  return `<span class="thumb-empty" title="${esc(why)}" style="width:${s}px;height:${s}px">${iss?'⚠':''}</span>`;
}
// Объект без картинки на холсте комнаты: пунктирная рамка его реального размера (иначе он был бы невидим и не выделялся)
const MISSING_IMG_URL='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" fill="rgba(231,198,91,0.10)" stroke="#e7c65b" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/><path d="M0 0L100 100M100 0L0 100" stroke="#e7c65b" stroke-opacity="0.45" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>');
// Общие загрузчики картинок с диска (раньше в Room Editor не были определены — генератор комнат не мог подгрузить фон)
async function loadImageDataUrl(spritesDir, relPath){
  const clean=String(relPath||'').replace(/^assets\/sprites\//,'').replace(/^\//,'');
  const parts=clean.split('/'); const fileName=parts.pop();
  const subDir=parts.length? await getSubdir(spritesDir,parts.join('/'),false) : spritesDir;
  const file=await (await subDir.getFileHandle(fileName)).getFile();
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error||new Error('не удалось прочитать файл')); r.readAsDataURL(file); });
}
// Битая картинка → исключение (а не вечное ожидание, из-за которого комната переставала открываться)
function getImageDims(dataUrl){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight}); im.onerror=()=>rej(new Error('файл повреждён или это не картинка')); im.src=dataUrl; }); }

/* ---- категории объектов ----
   Источник истины — Object Constructor: он пишет data/categories.json ([{id,name}] в порядке ОС) при подключении
   папки и при сохранении. Здесь список читается из файла и дополняется категориями, которые реально встречаются
   у объектов (category / category_name в их JSON) — так библиотека совпадает с ОС даже если файла ещё нет. */
let projectCategories=[]; // [{id,name}]
async function loadProjectCategories(){
  projectCategories=[];
  if(!projectDirHandle) return;
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const data=JSON.parse(await (await (await dir.getFileHandle('categories.json')).getFile()).text());
    (data.categories||[]).forEach(c=>{ if(c&&c.id&&!projectCategories.some(x=>x.id===String(c.id))) projectCategories.push({id:String(c.id),name:String(c.name||c.id)}); });
  }catch(e){ /* файла ещё нет — возьмём категории из самих объектов */ }
}
function categoryLabel(id){
  const c=projectCategories.find(x=>x.id===id); if(c) return c.name;
  const o=projectCatalog.find(e=>e.category===id); if(o&&o.json&&o.json.category_name) return o.json.category_name;
  return id||'';
}
function rebuildLibCategoryOptions(){
  const sel=document.getElementById('libCategory'); if(!sel) return;
  const prev=sel.value, counts={};
  projectCatalog.forEach(e=>{ const k=e.category||''; counts[k]=(counts[k]||0)+1; });
  const list=projectCategories.slice();
  Object.keys(counts).forEach(k=>{ if(k&&!list.some(c=>c.id===k)) list.push({id:k,name:categoryLabel(k)}); }); // есть у объектов, но не описана в файле
  sel.innerHTML=`<option value="">Все категории (${projectCatalog.length})</option>`+list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} (${counts[c.id]||0})</option>`).join('');
  sel.value=list.some(c=>c.id===prev)?prev:'';
}

async function scanProjectFolderCatalog(){
  if(!projectDirHandle)return;
  projectCatalog.forEach(e=>{ if(e.image) URL.revokeObjectURL(e.image); });
  const result=[];
  try{
    const objectsDir=await getSubdir(projectDirHandle,'data/objects',false);
    let spritesDir=null;
    try{ spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false); }catch(e){}
    for await (const [name,handle] of objectsDir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{
        const file=await handle.getFile();
        const obj=JSON.parse(await file.text());
        const thumb=await loadCatalogThumb(spritesDir,obj); // основная картинка → состояние → кадр анимации; иначе заглушка
        result.push({ id:obj.id, category:obj.category, name:obj.name||obj.id, image:thumb.image, imageIssue:thumb.imageIssue, json:obj });
      }catch(e){ console.warn('Пропущен повреждённый объект:',name,e); }
    }
  }catch(e){ /* data/objects ещё не существует */ }
  projectCatalog=result;
  await loadProjectCategories();   // список категорий — из data/categories.json (его пишет ОС) + категории самих объектов
  rebuildLibCategoryOptions();
  renderLibrary();
}
let blockBevelPx=4; // срез внешних углов блоков, px (1 px = 1 см) — общий для проекта, читается из data/project_settings.json (block_bevel_px); материал может переопределить (block.bevel_px)
async function loadProjectSettings(){
  if(!projectDirHandle)return;
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    const fileHandle=await dir.getFileHandle('project_settings.json');
    const file=await fileHandle.getFile();
    const data=JSON.parse(await file.text());
    if(typeof data.walk_line_bottom_m==='number') walkLineBottomM=data.walk_line_bottom_m;
    if(typeof data.block_bevel_px==='number') blockBevelPx=Math.max(0,Math.min(10,data.block_bevel_px));
  }catch(e){ /* файла ещё нет — используем дефолт 0.9 */ }
  document.getElementById('walkLineBottomM').value=walkLineBottomM;
  const bevelInput=document.getElementById('blockBevelInput'); if(bevelInput) bevelInput.value=blockBevelPx;
  renderZoneGridOverlay();
}
async function saveProjectSettings(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  walkLineBottomM=+document.getElementById('walkLineBottomM').value||0.9;
  const bevelInput=document.getElementById('blockBevelInput');
  if(bevelInput){ const v=parseFloat(bevelInput.value); blockBevelPx=Number.isFinite(v)?Math.max(0,Math.min(10,v)):4; bevelInput.value=blockBevelPx; }
  // читаем текущий файл, чтобы не потерять чужие ключи настроек
  let settings={};
  try{
    const dir=await getSubdir(projectDirHandle,'data',false);
    settings=JSON.parse(await (await (await dir.getFileHandle('project_settings.json')).getFile()).text())||{};
  }catch(e){ settings={}; }
  settings.walk_line_bottom_m=walkLineBottomM;
  settings.block_bevel_px=blockBevelPx;
  await writeFileToProject('data/project_settings.json', new TextEncoder().encode(JSON.stringify(settings,null,2)));
  renderRoom(); renderZoneGridOverlay();
  document.getElementById('folderStatus').textContent='Настройки проекта сохранены — применяется сразу ко всем комнатам.';
}
document.getElementById('btnSaveProjectSettings').onclick=saveProjectSettings;

async function scanExistingRooms(){
  if(!projectDirHandle){ existingRoomIds=[]; existingRoomsList=[]; return; }
  const result=[]; const listResult=[];
  try{
    const roomsDir=await getSubdir(projectDirHandle,'data/rooms',false);
    for await (const [name,handle] of roomsDir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      const id=name.replace(/\.json$/,'');
      result.push(id);
      try{ const file=await handle.getFile(); const data=JSON.parse(await file.text()); listResult.push({id, name:data.name||id}); }
      catch(e){ listResult.push({id, name:id}); }
    }
  }catch(e){}
  existingRoomIds=result;
  existingRoomsList=listResult;
  renderDoorRoomOptions();
  populateOpenRoomSelect();
}
function populateOpenRoomSelect(){
  const sel=document.getElementById('openRoomSelect'); if(!sel)return;
  sel.innerHTML='<option value="">— выбери комнату —</option>'+existingRoomsList.map(r=>`<option value="${r.id}">${esc(r.name)} (${r.id})</option>`).join('');
}
