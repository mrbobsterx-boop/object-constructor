/* ============================================================
   MODULE 04 — INSPECTOR
   Форма размеров/физики/характеристик выбранного объекта (плюс универсальный
   редактор остальных полей JSON — "всё, что есть в json" целиком, по
   просьбе). Любое изменение сразу правит рабочую копию в objectsById и
   перерисовывает сцену (живое превью); "Сохранить" пишет
   data/objects/<id>.json целиком. Фото без привязанного id — пустая панель
   (нечего редактировать, пока у него нет JSON).
   ============================================================ */
/* ============================================================
   "Сохранить пропорции" — тот же механизм, что в Object Constructor
   (см. tools/os/js/07-object-io.js fitSizeFrom/updateAspectUI): игра
   растягивает картинку ровно под real_width_cm×real_height_cm (не наоборот),
   так что размер, не совпадающий с реальными пропорциями PNG, даёт видимое
   сплющивание/растяжение. Пропорции берутся из КОНКРЕТНОГО выбранного фото
   (selectedPath), а не обязательно из официально привязанной картинки —
   так видно каждый скин по отдельности.
   ============================================================ */
let keepAspectEnabled=(function(){ try{ const v=localStorage.getItem('size_calibrator_keep_aspect'); return v===null?true:v==='1'; }catch(e){ return true; } })();

// changed: 'w' — только что поправили ширину (пересчитать высоту), 'h' — наоборот. force — игнорировать тумблер (кнопка "Подогнать").
function fitSizeFrom(o,path,changed,force){
  if(!force && !keepAspectEnabled){ updateAspectUI(o,path); return; }
  const dims=refImageDimsCache[path];
  if(!dims||!dims.w||!dims.h){ updateAspectUI(o,path); return; }
  if(changed==='w'){ const w=o.behavior.real_width_cm||0; if(w) o.behavior.real_height_cm=Math.max(0,Math.round(w*dims.h/dims.w)); }
  else if(changed==='h'){ const h=o.behavior.real_height_cm||0; if(h) o.behavior.real_width_cm=Math.max(0,Math.round(h*dims.w/dims.h)); }
  const wEl=document.getElementById('fRealWidth'), hEl=document.getElementById('fRealHeight');
  if(wEl) wEl.value=o.behavior.real_width_cm; if(hEl) hEl.value=o.behavior.real_height_cm;
  updateAspectUI(o,path);
}
// "📐 Пересчитать размер всех объектов" (кнопка в тулбаре сцены, не привязана к выбору) — для КАЖДОГО
// объекта пересчитывает высоту из текущей ширины по реальным пропорциям ОДНОГО его фото (предпочитая
// не _broken/_icon — тот же выбор, что генератор делает для официального спрайта). Та же формула, что
// fitSizeFrom(changed='w'), просто сразу для всех id, а не только для выбранного. Правки живут в
// памяти, как обычное редактирование — ничего не пишет на диск само по себе, "Сохранить" отдельно.
function pickRepresentativePhotoForId(id){
  const candidates=allRefFiles.filter(p=>refFileMatch[p]===id);
  if(!candidates.length) return null;
  const clean=candidates.filter(p=>!/_(broken|icon)(_\d+)?\.png$/i.test(p));
  return clean[0]||candidates[0];
}
async function recalcAllObjectSizes(){
  const ids=Object.keys(objectsById);
  if(!ids.length) return;
  if(!confirm(`Пересчитать высоту из ширины для всех ${ids.length} объектов по реальным пропорциям их фото?\nПравки не сохранятся сами — после этого нужно нажать "Сохранить" (или массово) отдельно.`)) return;
  const btn=document.getElementById('btnRecalcAllSizes');
  const oldText=btn.textContent; btn.disabled=true; btn.textContent='Пересчитываю…';
  let changed=0, skipped=0;
  await ghMapLimit(ids,8,async id=>{
    const o=objectsById[id];
    const w=o.behavior.real_width_cm||0;
    if(!w){ skipped++; return; }
    const path=pickRepresentativePhotoForId(id);
    if(!path){ skipped++; return; }
    const dims=await getRefImageNaturalDims(path);
    if(!dims||!dims.w||!dims.h){ skipped++; return; }
    const newH=Math.max(0,Math.round(w*dims.h/dims.w));
    if(newH!==o.behavior.real_height_cm){ o.behavior.real_height_cm=newH; changed++; }
  });
  btn.disabled=false; btn.textContent=oldText;
  renderObjectList();
  if(selectedId&&objectsById[selectedId]){
    renderInspector(objectsById[selectedId],selectedPath);
    renderScene(objectsById[selectedId],false,selectedPath?await getRefImageUrl(selectedPath):null);
  }
  alert(`Готово: пересчитано ${changed}, пропущено (нет фото/ширины) ${skipped}.`);
}
document.getElementById('btnRecalcAllSizes').onclick=recalcAllObjectSizes;

function updateAspectUI(o,path){
  const btn=document.getElementById('btnKeepAspect'); if(!btn) return;
  btn.classList.toggle('armed',keepAspectEnabled);
  const statusEl=document.getElementById('aspectStatus'), fitBtn=document.getElementById('btnFitAspect');
  const dims=refImageDimsCache[path];
  if(!dims||!dims.w||!dims.h){
    statusEl.textContent=(path in refImageDimsCache)?'У этого фото не удалось прочитать картинку — пропорции сверить не с чем.':'Загрузка картинки…';
    fitBtn.style.display='none';
    return;
  }
  const imgRatio=dims.w/dims.h;
  let txt=`Пропорции этого фото: ${dims.w}×${dims.h} px`;
  const w=o.behavior.real_width_cm||0, h=o.behavior.real_height_cm||0;
  if(w&&h){
    const mismatch=Math.abs((w/h)-imgRatio)/imgRatio>0.02;
    fitBtn.style.display=mismatch?'':'none';
    if(mismatch) txt+=' · ⚠ текущий размер не совпадает с пропорциями картинки (растянуто/сплющено)';
  } else fitBtn.style.display='none';
  statusEl.textContent=txt;
}

const PHYSICS_OPTS=['STATIC','DYNAMIC','CHARACTER'];
const PLACEMENT_OPTS=[['ANYWHERE','Где угодно'],['FLOOR_ONLY','Только пол (нужна опора под всей шириной)']];
const COLLISION_OPTS=['NONE','RECT','HULL_PIXELS','CIRCLE'];

function fieldChanged(){
  const o=objectsById[selectedId];
  if(!o) return;
  updateListRowBadge(o.id); // обновить бейджи размера/точку "есть правки" у всех строк этого id — без перестройки всего списка
  renderScene(o,true,refImageUrlCache[selectedPath]); // keepView — не дёргать зум/пан на каждый ввод
  updateSaveStatus();
}

function updateSaveStatus(){
  const el=document.getElementById('saveStatus');
  if(!el) return;
  if(isDirty(selectedId)){ el.textContent='Есть несохранённые правки'; el.className='save-status dirty'; }
  else { el.textContent=''; el.className='save-status'; }
}

function cfRowHtml(key,val,idx){
  const type=typeof val;
  let valInput;
  if(type==='boolean') valInput=`<input type="checkbox" data-cf-idx="${idx}" data-cf-kind="bool" ${val?'checked':''}>`;
  else if(type==='number') valInput=`<input type="number" data-cf-idx="${idx}" data-cf-kind="num" value="${val}">`;
  else valInput=`<input type="text" data-cf-idx="${idx}" data-cf-kind="str" value="${esc(val==null?'':String(val))}">`;
  return `<div class="cf-row">
    <input type="text" data-cf-key-idx="${idx}" value="${esc(key)}" placeholder="ключ">
    ${valInput}
    <button type="button" data-cf-del="${idx}" title="Удалить поле">✕</button>
  </div>`;
}

/* ============================================================
   УНИВЕРСАЛЬНЫЙ РЕДАКТОР ОСТАЛЬНЫХ ПОЛЕЙ JSON
   Всё, что не попало в специальные секции выше (Размер/Физика/custom) —
   description, tags, actions, action_settings, combat, inventory,
   destruction, crafting, visuals и т.д. — рендерится рекурсивно по
   значению (строка/число/булево/массив/объект), без ручного перечисления
   полей, поэтому новые поля схемы тоже сразу становятся видимыми и
   редактируемыми здесь.
   ============================================================ */
const GENERIC_SKIP_TOP=new Set(['id','name','category','category_name','appearance','custom','behavior','schema_version']);
const GENERIC_SKIP_BEHAVIOR=new Set(['real_width_cm','real_height_cm','physics','collision','placement_mode','carryable','weight','hasWeight']);

function pathSet(obj,path,val){
  let cur=obj;
  for(let i=0;i<path.length-1;i++) cur=cur[path[i]];
  cur[path[path.length-1]]=val;
}
function renderGenericValue(path,value){
  const keyPath=path.join('.');
  const label=String(path[path.length-1]);
  if(value===null||value===undefined){
    return `<div class="gfield"><label>${esc(label)}</label><div class="muted hint">null</div></div>`;
  }
  const t=typeof value;
  if(t==='string'){
    return `<div class="gfield"><label>${esc(label)}</label><input type="text" data-gpath="${esc(keyPath)}" data-gkind="str" value="${esc(value)}"></div>`;
  }
  if(t==='number'){
    return `<div class="gfield"><label>${esc(label)}</label><input type="number" data-gpath="${esc(keyPath)}" data-gkind="num" value="${value}"></div>`;
  }
  if(t==='boolean'){
    return `<label class="check gfield"><input type="checkbox" data-gpath="${esc(keyPath)}" data-gkind="bool" ${value?'checked':''}> ${esc(label)}</label>`;
  }
  if(Array.isArray(value)){
    const allScalar=value.every(v=>v===null||typeof v!=='object');
    if(allScalar){
      return `<div class="gfield"><label>${esc(label)} (через запятую)</label><input type="text" data-gpath="${esc(keyPath)}" data-gkind="arr" value="${esc(value.join(', '))}"></div>`;
    }
    let html=`<div class="gfield"><label>${esc(label)} [${value.length}]</label>`;
    value.forEach((item,i)=>{ html+=`<div class="gnest"><div class="gnest-head">#${i}</div>${renderGenericObjectFields([...path,i],item)}</div>`; });
    html+='</div>';
    return html;
  }
  // объект
  return `<div class="gfield"><label>${esc(label)}</label><div class="gnest">${renderGenericObjectFields(path,value)}</div></div>`;
}
function renderGenericObjectFields(path,obj){
  if(!obj||typeof obj!=='object') return '';
  return Object.entries(obj).map(([k,v])=>renderGenericValue([...path,k],v)).join('');
}
function isComplexValue(v){
  // Простой массив скаляров — это ОДНО поле ввода (через запятую), прятать его за клик незачем —
  // раскрывать стоит только настоящую вложенность (объект или массив объектов).
  if(v===null||typeof v!=='object') return false;
  if(Array.isArray(v)) return !v.every(x=>x===null||typeof x!=='object');
  return true;
}
function renderGenericSection(o){
  let html='';
  Object.entries(o).forEach(([k,v])=>{
    if(GENERIC_SKIP_TOP.has(k)) return;
    if(isComplexValue(v)){
      html+=`<details class="gtop"><summary>${esc(k)}</summary>${renderGenericValue([k],v)}</details>`;
    } else {
      html+=renderGenericValue([k],v);
    }
  });
  const beh=o.behavior||{};
  let behHtml='';
  Object.entries(beh).forEach(([k,v])=>{
    if(GENERIC_SKIP_BEHAVIOR.has(k)) return;
    behHtml+=renderGenericValue(['behavior',k],v);
  });
  if(behHtml) html=`<details class="gtop"><summary>behavior — остальное</summary>${behHtml}</details>`+html;
  return html;
}
function wireGenericFields(o){
  document.querySelectorAll('[data-gpath]').forEach(inp=>{
    const handler=e=>{
      const gpath=e.target.dataset.gpath.split('.');
      const kind=e.target.dataset.gkind;
      let v;
      if(kind==='bool') v=e.target.checked;
      else if(kind==='num') v=Number(e.target.value)||0;
      else if(kind==='arr') v=e.target.value.split(',').map(s=>s.trim()).filter(s=>s!=='');
      else v=e.target.value;
      pathSet(o,gpath,v);
      fieldChanged();
    };
    inp.addEventListener(inp.type==='checkbox'?'change':'input',handler);
  });
}

function renderInspector(o,path){
  const root=document.getElementById('inspector');
  const b=o.behavior||{};
  const cfEntries=Object.entries(o.custom||{});
  const variationCurrent=path?variationLabel(path,o.id):'';
  root.innerHTML=`
    <div class="insp-head">
      <div class="id">${esc(o.id)} · ${esc(o.category_name||o.category||'')}</div>
      <div class="name">${esc(o.name||o.id)}</div>
      ${path?`<div class="muted hint" style="margin-top:4px">Показано фото: ${esc(path)}</div>`:''}
    </div>
    <div class="section">
      <h3>Название объекта <span class="muted hint">(общее для ВСЕХ фото этого id)</span></h3>
      <div class="row">
        <input id="fObjectName" type="text" value="${esc(o.name||'')}" style="flex:1">
      </div>
      <div class="muted hint">id (${esc(o.id)}) не меняется — только отображаемое имя. Правка здесь затронет все фото этого объекта, не только текущее.</div>
    </div>
    ${path?`
    <div class="section">
      <h3>Название ЭТОГО фото <span class="muted hint">(только оно, id и остальные фото объекта не трогает)</span></h3>
      <div class="row">
        <input id="fVariationName" type="text" value="${esc(variationCurrent==='основная'?'':variationCurrent)}" placeholder="основная (без суффикса)" style="flex:1">
        <button type="button" id="btnRenameVariation">Переименовать файл</button>
      </div>
      <div class="muted hint" id="renameStatus">Можно писать по-русски — сохранится в имени файла английским слагом (как и у остальных картинок).</div>
    </div>`:''}
    <div class="section">
      <h3>Размер (игровой, см)</h3>
      <div class="row">
        <div class="field" style="flex:1"><label>Ширина</label><input id="fRealWidth" type="number" min="0" step="1" value="${Math.round(b.real_width_cm||0)}"></div>
        <div class="field" style="flex:1"><label>Высота</label><input id="fRealHeight" type="number" min="0" step="1" value="${Math.round(b.real_height_cm||0)}"></div>
      </div>
      <div class="field">
        <div class="row">
          <button type="button" id="btnKeepAspect" class="toggle-btn">🔗 Сохранить пропорции</button>
          <button type="button" id="btnFitAspect" style="display:none">Подогнать высоту по ширине</button>
        </div>
        <div class="muted hint" id="aspectStatus" style="margin-top:4px"></div>
      </div>
      <div class="muted hint">Картинка растягивается под этот размер (не наоборот) — пиксели PNG на игровой размер не влияют. Но если размер не совпадает с пропорциями картинки, она выглядит сплющенной/вытянутой — включи "Сохранить пропорции", чтобы высота/ширина сами подстраивались под реальную картинку.</div>
    </div>
    <div class="section">
      <h3>Физика и вес</h3>
      <div class="field"><label>Физика</label><select id="fPhysics">${PHYSICS_OPTS.map(p=>`<option ${p===b.physics?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>Столкновение</label><select id="fCollision">${COLLISION_OPTS.map(c=>`<option ${c===b.collision?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Расположение в мире</label><select id="fPlacement">${PLACEMENT_OPTS.map(([v,l])=>`<option value="${v}" ${v===b.placement_mode?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
      <label class="check"><input type="checkbox" id="fCarryable" ${b.carryable?'checked':''}> Можно поднять и нести</label>
      <div class="field" style="margin-top:8px"><label>Вес (кг)</label><input id="fWeight" type="number" min="0" step="0.1" value="${b.weight||0}"></div>
    </div>
    <div class="section">
      <h3>Остальные поля JSON</h3>
      <div class="muted hint" style="margin-bottom:6px">Всё, что есть в объекте, кроме уже показанного выше — названия/описание, действия, крафт, бой, инвентарь и т.д. Разворачивай нужный раздел и редактируй прямо здесь.</div>
      ${renderGenericSection(o)}
    </div>
    <div class="section">
      <h3>Доп. характеристики (custom)</h3>
      <div id="cfList">${cfEntries.map(([k,v],i)=>cfRowHtml(k,v,i)).join('')}</div>
      <button type="button" id="btnCfAdd" style="margin-top:4px">+ добавить поле</button>
    </div>
    <div class="section">
      <div class="row">
        <button type="button" id="btnSave" class="primary">💾 Сохранить в JSON</button>
        <button type="button" id="btnRevert">Отменить правки</button>
      </div>
      <div class="save-status" id="saveStatus"></div>
    </div>
  `;

  document.getElementById('fObjectName').oninput=e=>{ o.name=e.target.value; fieldChanged(); };
  if(path){
    document.getElementById('btnRenameVariation').onclick=async()=>{
      const statusEl=document.getElementById('renameStatus');
      const raw=document.getElementById('fVariationName').value.trim();
      const slug=raw?sanitizeSlug(translit(raw)):'';
      statusEl.textContent='Переименование…'; statusEl.className='muted hint';
      const res=await renamePhotoVariation(path,slug);
      if(res.ok){
        await selectPhoto(res.path);
      } else {
        statusEl.textContent='Ошибка: '+res.error; statusEl.className='save-status err';
      }
    };
  }
  document.getElementById('fRealWidth').oninput=e=>{ o.behavior.real_width_cm=Number(e.target.value)||0; fitSizeFrom(o,path,'w'); fieldChanged(); };
  document.getElementById('fRealHeight').oninput=e=>{ o.behavior.real_height_cm=Number(e.target.value)||0; fitSizeFrom(o,path,'h'); fieldChanged(); };
  document.getElementById('btnKeepAspect').onclick=()=>{
    keepAspectEnabled=!keepAspectEnabled;
    try{ localStorage.setItem('size_calibrator_keep_aspect',keepAspectEnabled?'1':'0'); }catch(e){}
    updateAspectUI(o,path);
  };
  document.getElementById('btnFitAspect').onclick=()=>{ fitSizeFrom(o,path,'w',true); fieldChanged(); };
  updateAspectUI(o,path);
  if(path) getRefImageNaturalDims(path).then(()=>{ if(selectedPath===path) updateAspectUI(o,path); });
  document.getElementById('fPhysics').onchange=e=>{ o.behavior.physics=e.target.value; fieldChanged(); };
  document.getElementById('fCollision').onchange=e=>{ o.behavior.collision=e.target.value; fieldChanged(); };
  document.getElementById('fPlacement').onchange=e=>{ o.behavior.placement_mode=e.target.value; fieldChanged(); };
  document.getElementById('fCarryable').onchange=e=>{ o.behavior.carryable=e.target.checked; fieldChanged(); };
  document.getElementById('fWeight').oninput=e=>{ const v=Number(e.target.value)||0; o.behavior.weight=v; o.behavior.hasWeight=v>0; fieldChanged(); };

  wireGenericFields(o);

  wireCfRows(o);
  document.getElementById('btnCfAdd').onclick=()=>{ o.custom=o.custom||{}; let k='new_field',n=1; while(k in o.custom) k='new_field_'+(++n); o.custom[k]=''; renderInspector(o,path); fieldChanged(); };
  document.getElementById('btnSave').onclick=()=>saveObject(o.id);
  document.getElementById('btnRevert').onclick=()=>revertObject(o.id);
  updateSaveStatus();
}

// Фото без привязанного объекта — нечего редактировать, пока у него нет JSON.
function renderNoJsonInspector(path){
  const root=document.getElementById('inspector');
  if(!path){ root.innerHTML='<div class="empty-hint">Выбери фото слева, чтобы задать его объекту реальный размер и характеристики.</div>'; return; }
  root.innerHTML=`<div class="empty-hint">Файл <code>${esc(path)}</code> не привязан ни к одному объекту — для него нет data/objects/*.json. Переименуй файл так, чтобы он начинался с id существующего объекта (как в Image Prep Tool/Asset Renamer), чтобы он здесь привязался.</div>`;
}

function wireCfRows(o){
  const entries=Object.entries(o.custom||{});
  document.querySelectorAll('[data-cf-key-idx]').forEach(inp=>{
    inp.onchange=e=>{
      const idx=Number(e.target.dataset.cfKeyIdx);
      const [oldKey,val]=entries[idx];
      const newKey=e.target.value.trim();
      if(!newKey||newKey===oldKey) { e.target.value=oldKey; return; }
      delete o.custom[oldKey]; o.custom[newKey]=val;
      renderInspector(o,selectedPath); fieldChanged();
    };
  });
  document.querySelectorAll('[data-cf-idx]').forEach(inp=>{
    inp.oninput=inp.onchange=e=>{
      const idx=Number(e.target.dataset.cfIdx), kind=e.target.dataset.cfKind;
      const [key]=entries[idx];
      let v;
      if(kind==='bool') v=e.target.checked;
      else if(kind==='num') v=Number(e.target.value)||0;
      else v=e.target.value;
      o.custom[key]=v;
      fieldChanged();
    };
  });
  document.querySelectorAll('[data-cf-del]').forEach(btn=>{
    btn.onclick=e=>{
      const idx=Number(e.target.dataset.cfDel);
      const [key]=entries[idx];
      delete o.custom[key];
      renderInspector(o,selectedPath); fieldChanged();
    };
  });
}

// Пишет один объект на диск/GitHub — без побочных эффектов на DOM, чтобы одинаково годиться
// и для одиночного "Сохранить", и для цикла при массовом сохранении (saveBulk).
async function saveObjectCore(id){
  const o=objectsById[id];
  if(!o) throw new Error('объект не найден');
  const bytes=new TextEncoder().encode(JSON.stringify(o,null,2)+'\n');
  const ok=await writeFileToProject('data/objects/'+id+'.json',bytes);
  if(!ok) throw new Error('не подключена ни папка, ни GitHub');
  objectsSavedJSON[id]=JSON.stringify(o);
  markReviewedId(id);
}
async function saveObject(id){
  const statusEl=document.getElementById('saveStatus');
  statusEl.textContent='Сохранение…'; statusEl.className='save-status';
  try{
    await saveObjectCore(id);
    statusEl.textContent='Сохранено ✓'; statusEl.className='save-status ok';
    renderObjectList();
  }catch(e){
    statusEl.textContent='Ошибка сохранения: '+e.message; statusEl.className='save-status err';
  }
}

function revertObjectSilent(id){
  const saved=objectsSavedJSON[id];
  if(!saved) return;
  objectsById[id]=JSON.parse(saved);
}
function revertObject(id){
  revertObjectSilent(id);
  renderObjectList();
  selectPhoto(selectedPath);
}

/* ============================================================
   МАССОВОЕ РЕДАКТИРОВАНИЕ — несколько объектов выбраны в списке слева
   (Shift/Ctrl+клик по фото, см. 02-state.js). Один и тот же размер ставится
   сразу всем выбранным — без привязки к пропорциям конкретной картинки (это
   противоречило бы самой цели: сделать несколько РАЗНЫХ картинок одного
   игрового размера, напр. несколько скинов верстака).
   ============================================================ */
function renderBulkInspector(){
  const root=document.getElementById('inspector');
  const ids=[...multiSelectedIds].sort((a,b)=>((objectsById[a]&&objectsById[a].name)||a).localeCompare((objectsById[b]&&objectsById[b].name)||b,'ru'));
  const names=ids.map(id=>(objectsById[id]&&objectsById[id].name)||id);
  root.innerHTML=`
    <div class="insp-head">
      <div class="id">Массовое редактирование</div>
      <div class="name">${ids.length} объектов выбрано</div>
      <div class="muted hint" style="margin-top:6px">${names.map(esc).join(', ')}</div>
    </div>
    <div class="section">
      <h3>Размер для всех выбранных (см)</h3>
      <div class="row">
        <div class="field" style="flex:1"><label>Ширина</label><input id="fBulkWidth" type="number" min="0" step="1" placeholder="не менять"></div>
        <div class="field" style="flex:1"><label>Высота</label><input id="fBulkHeight" type="number" min="0" step="1" placeholder="не менять"></div>
      </div>
      <div class="muted hint">Значение ставится ОДИНАКОВЫМ сразу всем выбранным объектам (пропорции картинок разных скинов тут ни при чём — это для случаев вроде "эти 4 верстака должны быть одного размера"). Для подгонки под пропорции конкретной картинки открой объект по одному — X/Y.</div>
    </div>
    <div class="section">
      <div class="row">
        <button type="button" id="btnBulkSave" class="primary">💾 Сохранить все в JSON</button>
        <button type="button" id="btnBulkRevert">Отменить правки</button>
        <button type="button" id="btnBulkClear">Снять выделение</button>
      </div>
      <div class="save-status" id="saveStatus"></div>
    </div>
  `;
  document.getElementById('fBulkWidth').oninput=e=>{
    if(e.target.value==='') return;
    const v=Math.max(0,Number(e.target.value)||0);
    ids.forEach(id=>{ const o=objectsById[id]; if(o){ o.behavior.real_width_cm=v; updateListRowBadge(id); } });
    renderSceneMulti(ids,true); updateBulkSaveStatus(ids);
  };
  document.getElementById('fBulkHeight').oninput=e=>{
    if(e.target.value==='') return;
    const v=Math.max(0,Number(e.target.value)||0);
    ids.forEach(id=>{ const o=objectsById[id]; if(o){ o.behavior.real_height_cm=v; updateListRowBadge(id); } });
    renderSceneMulti(ids,true); updateBulkSaveStatus(ids);
  };
  document.getElementById('btnBulkSave').onclick=()=>saveBulk(ids);
  document.getElementById('btnBulkRevert').onclick=()=>{
    ids.forEach(revertObjectSilent);
    renderObjectList(); renderBulkInspector(); renderSceneMulti(ids);
  };
  document.getElementById('btnBulkClear').onclick=()=>{
    multiSelectedPaths=new Set(); multiSelectedIds=new Set(); selectedId=null; selectedPath=null;
    renderObjectList(); clearInspectorAndScene();
  };
  updateBulkSaveStatus(ids);
  renderSceneMulti(ids);
}
function updateBulkSaveStatus(ids){
  const el=document.getElementById('saveStatus'); if(!el) return;
  const dirtyCount=ids.filter(isDirty).length;
  if(dirtyCount){ el.textContent=dirtyCount+' из '+ids.length+' изменены, не сохранены'; el.className='save-status dirty'; }
  else { el.textContent=''; el.className='save-status'; }
}
// statusElId по умолчанию 'saveStatus' (панель массового редактирования слева) — но та панель видна,
// только когда выбрано несколько фото. Глобальная "Сохранить все" (кнопка в тулбаре сцены, не привязана
// к выбору — см. ниже) пишет статус в свой собственный элемент тулбара, 'allSaveStatus'.
async function saveBulk(ids,statusElId){
  const el=document.getElementById(statusElId||'saveStatus');
  if(el){ el.textContent='Сохранение…'; el.className='save-status'; }
  let ok=0, fail=0;
  for(const id of ids){ try{ await saveObjectCore(id); ok++; }catch(e){ fail++; } }
  renderObjectList();
  if(selectedId&&objectsById[selectedId]) renderInspector(objectsById[selectedId],selectedPath);
  if(el){
    el.textContent = fail? `Сохранено ${ok}, ошибок ${fail}` : `Сохранено ${ok} объект(ов) ✓`;
    el.className='save-status '+(fail?'err':'ok');
  }
}
// "💾 Сохранить все" (тулбар сцены) — сохраняет ВСЕ объекты с несохранёнными правками, откуда бы они
// ни взялись: после "Пересчитать размер всех объектов", после ручной правки в инспекторе одного
// объекта, после массового редактирования — isDirty() одинаково ловит все три случая (сравнение с
// objectsSavedJSON). Пишет через ту же очередь (writeFileToProject -> ghQueueWrite), так что хоть
// сотня изменённых объектов уйдёт одним GitHub-коммитом, а не одним на файл.
async function saveAllDirty(){
  const allIds=Object.keys(objectsById);
  const dirtyIds=allIds.filter(isDirty);
  const statusEl=document.getElementById('allSaveStatus');
  if(!dirtyIds.length){ if(statusEl){ statusEl.textContent='Нет несохранённых изменений'; statusEl.className='save-status'; } return; }
  if(!confirm(`Сохранить ${dirtyIds.length} изменённых объект(ов) в их data/objects/*.json?`)) return;
  const btn=document.getElementById('btnSaveAllDirty');
  const oldText=btn.textContent; btn.disabled=true; btn.textContent='Сохраняю…';
  await saveBulk(dirtyIds,'allSaveStatus');
  btn.disabled=false; btn.textContent=oldText;
}
document.getElementById('btnSaveAllDirty').onclick=saveAllDirty;
