/* ============================================================
   MODULE 04 — INSPECTOR
   Форма размеров/физики/характеристик выбранного объекта. Любое изменение
   сразу правит рабочую копию в objectsById и перерисовывает сцену (живое
   превью); "Сохранить" пишет data/objects/<id>.json целиком (остальные поля
   объекта — actions, crafting, combat и т.п. — не трогаются).
   ============================================================ */
/* ============================================================
   "Сохранить пропорции" — тот же механизм, что в Object Constructor
   (см. tools/os/js/07-object-io.js fitSizeFrom/updateAspectUI): игра
   растягивает картинку ровно под real_width_cm×real_height_cm (не наоборот),
   так что размер, не совпадающий с реальными пропорциями PNG, даёт видимое
   сплющивание/растяжение — как у кирки/кувалды/топора на скриншотах.
   ============================================================ */
let keepAspectEnabled=(function(){ try{ const v=localStorage.getItem('size_calibrator_keep_aspect'); return v===null?true:v==='1'; }catch(e){ return true; } })();

// changed: 'w' — только что поправили ширину (пересчитать высоту), 'h' — наоборот. force — игнорировать тумблер (кнопка "Подогнать").
function fitSizeFrom(o,changed,force){
  if(!force && !keepAspectEnabled){ updateAspectUI(o); return; }
  const dims=imageDimsCache[o.id];
  if(!dims||!dims.w||!dims.h){ updateAspectUI(o); return; }
  if(changed==='w'){ const w=o.behavior.real_width_cm||0; if(w) o.behavior.real_height_cm=Math.max(0,Math.round(w*dims.h/dims.w)); }
  else if(changed==='h'){ const h=o.behavior.real_height_cm||0; if(h) o.behavior.real_width_cm=Math.max(0,Math.round(h*dims.w/dims.h)); }
  const wEl=document.getElementById('fRealWidth'), hEl=document.getElementById('fRealHeight');
  if(wEl) wEl.value=o.behavior.real_width_cm; if(hEl) hEl.value=o.behavior.real_height_cm;
  updateAspectUI(o);
}
function updateAspectUI(o){
  const btn=document.getElementById('btnKeepAspect'); if(!btn) return;
  btn.classList.toggle('armed',keepAspectEnabled);
  const statusEl=document.getElementById('aspectStatus'), fitBtn=document.getElementById('btnFitAspect');
  const dims=imageDimsCache[o.id];
  if(!dims||!dims.w||!dims.h){
    statusEl.textContent=(o.id in imageDimsCache)?'У объекта нет картинки — пропорции сверить не с чем.':'Загрузка картинки…';
    fitBtn.style.display='none';
    return;
  }
  const imgRatio=dims.w/dims.h;
  let txt=`Пропорции картинки: ${dims.w}×${dims.h} px`;
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
  updateListRowBadge(o.id); // обновить бейдж размера/точку "есть правки" — без перестройки всего списка
  renderScene(o,true); // keepView — не дёргать зум/пан на каждый ввод
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

function renderInspector(o){
  const root=document.getElementById('inspector');
  const b=o.behavior||{};
  const cfEntries=Object.entries(o.custom||{});
  root.innerHTML=`
    <div class="insp-head">
      <div class="id">${esc(o.id)} · ${esc(o.category_name||o.category||'')}</div>
      <div class="name">${esc(o.name||o.id)}</div>
    </div>
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

  document.getElementById('fRealWidth').oninput=e=>{ o.behavior.real_width_cm=Number(e.target.value)||0; fitSizeFrom(o,'w'); fieldChanged(); };
  document.getElementById('fRealHeight').oninput=e=>{ o.behavior.real_height_cm=Number(e.target.value)||0; fitSizeFrom(o,'h'); fieldChanged(); };
  document.getElementById('btnKeepAspect').onclick=()=>{
    keepAspectEnabled=!keepAspectEnabled;
    try{ localStorage.setItem('size_calibrator_keep_aspect',keepAspectEnabled?'1':'0'); }catch(e){}
    updateAspectUI(o);
  };
  document.getElementById('btnFitAspect').onclick=()=>{ fitSizeFrom(o,'w',true); fieldChanged(); };
  updateAspectUI(o);
  getObjectImageNaturalDims(o.id).then(()=>{ if(selectedId===o.id) updateAspectUI(o); });
  document.getElementById('fPhysics').onchange=e=>{ o.behavior.physics=e.target.value; fieldChanged(); };
  document.getElementById('fCollision').onchange=e=>{ o.behavior.collision=e.target.value; fieldChanged(); };
  document.getElementById('fPlacement').onchange=e=>{ o.behavior.placement_mode=e.target.value; fieldChanged(); };
  document.getElementById('fCarryable').onchange=e=>{ o.behavior.carryable=e.target.checked; fieldChanged(); };
  document.getElementById('fWeight').oninput=e=>{ const v=Number(e.target.value)||0; o.behavior.weight=v; o.behavior.hasWeight=v>0; fieldChanged(); };

  wireCfRows(o);
  document.getElementById('btnCfAdd').onclick=()=>{ o.custom=o.custom||{}; let k='new_field',n=1; while(k in o.custom) k='new_field_'+(++n); o.custom[k]=''; renderInspector(o); fieldChanged(); };
  document.getElementById('btnSave').onclick=()=>saveObject(o.id);
  document.getElementById('btnRevert').onclick=()=>revertObject(o.id);
  updateSaveStatus();
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
      renderInspector(o); fieldChanged();
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
      renderInspector(o); fieldChanged();
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
  selectObject(id);
}

/* ============================================================
   МАССОВОЕ РЕДАКТИРОВАНИЕ — несколько объектов выбраны в списке слева
   (Shift/Ctrl+клик, см. 02-state.js). Один и тот же размер ставится сразу
   всем выбранным — без привязки к пропорциям конкретной картинки (это
   противоречило бы самой цели: сделать несколько РАЗНЫХ картинок одного
   игрового размера, напр. несколько скинов верстака).
   ============================================================ */
function renderBulkInspector(){
  const root=document.getElementById('inspector');
  const ids=getVisibleOrderedIds().filter(id=>multiSelectedIds.has(id));
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
    multiSelectedIds=new Set(); selectedId=null; renderObjectList(); clearInspectorAndScene();
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
async function saveBulk(ids){
  const el=document.getElementById('saveStatus');
  el.textContent='Сохранение…'; el.className='save-status';
  let ok=0, fail=0;
  for(const id of ids){ try{ await saveObjectCore(id); ok++; }catch(e){ fail++; } }
  renderObjectList();
  el.textContent = fail? `Сохранено ${ok}, ошибок ${fail}` : `Сохранено ${ok} объект(ов) ✓`;
  el.className='save-status '+(fail?'err':'ok');
}
