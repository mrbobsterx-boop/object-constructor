/* ============================================================
   MODULE 04 — INSPECTOR
   Форма размеров/физики/характеристик выбранного объекта. Любое изменение
   сразу правит рабочую копию в objectsById и перерисовывает сцену (живое
   превью); "Сохранить" пишет data/objects/<id>.json целиком (остальные поля
   объекта — actions, crafting, combat и т.п. — не трогаются).
   ============================================================ */
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
      <div class="muted hint">Картинка растягивается под этот размер (не наоборот) — пиксели PNG на игровой размер не влияют.</div>
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

  document.getElementById('fRealWidth').oninput=e=>{ o.behavior.real_width_cm=Number(e.target.value)||0; fieldChanged(); };
  document.getElementById('fRealHeight').oninput=e=>{ o.behavior.real_height_cm=Number(e.target.value)||0; fieldChanged(); };
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

async function saveObject(id){
  const o=objectsById[id];
  if(!o) return;
  const statusEl=document.getElementById('saveStatus');
  statusEl.textContent='Сохранение…'; statusEl.className='save-status';
  try{
    const bytes=new TextEncoder().encode(JSON.stringify(o,null,2)+'\n');
    const ok=await writeFileToProject('data/objects/'+id+'.json',bytes);
    if(!ok) throw new Error('не подключена ни папка, ни GitHub');
    objectsSavedJSON[id]=JSON.stringify(o);
    statusEl.textContent='Сохранено ✓'; statusEl.className='save-status ok';
    renderObjectList();
  }catch(e){
    statusEl.textContent='Ошибка сохранения: '+e.message; statusEl.className='save-status err';
  }
}

function revertObject(id){
  const saved=objectsSavedJSON[id];
  if(!saved) return;
  objectsById[id]=JSON.parse(saved);
  renderObjectList();
  selectObject(id);
}
