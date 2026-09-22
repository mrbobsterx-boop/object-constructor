/* ============================================================
   MODULE 08 — PROPERTIES PANEL
   Properties of the selected instance, door target options, delete instance.
   ============================================================ */

/* ============================================================
   ПАНЕЛЬ СВОЙСТВ выбранного экземпляра
   ============================================================ */
function getSelectedInstance(){ return room.instances.find(i=>i.instanceId===selectedInstanceId)||null; }
function renderPropertiesPanel(){
  const panel=document.getElementById('propertiesPanel');
  if(multiSelectedIds.size + multiSelectedBgIds.size > 0){
    panel.innerHTML=`
      <div class="section">
        <h3>Выделено: ${multiSelectedIds.size} объект(ов)${multiSelectedBgIds.size?` + ${multiSelectedBgIds.size} фон. слой(ев)`:''}</h3>
        <div class="field"><label>Название сета</label><input id="setName" placeholder="Рабочий стол с полкой..."></div>
        <div class="field"><label>id</label><input id="setId" placeholder="auto"></div>
        <div class="row" style="margin-top:8px">
          <button id="btnSaveAsSet">💾 Сохранить как сет</button>
          <button id="btnDeleteMultiSelected">🗑 Удалить выделенное</button>
          <button id="btnClearMultiSelect">✕ Снять выделение</button>
        </div>
        <div class="status" style="margin-top:8px">Ещё можно выделить: тащи рамкой по пустому месту холста (Ctrl+клик для точечного добавления пока не поддержан — рамка одна на всех).</div>
      </div>`;
    document.getElementById('setName').addEventListener('input', ()=>{ const idEl=document.getElementById('setId'); if(idEl.dataset.auto!=='0') idEl.value=translit(document.getElementById('setName').value)||''; });
    document.getElementById('setId').dataset.auto='1';
    document.getElementById('setId').addEventListener('input', ()=>{ document.getElementById('setId').dataset.auto='0'; });
    document.getElementById('btnSaveAsSet').onclick=saveCurrentSelectionAsSet;
    document.getElementById('btnDeleteMultiSelected').onclick=deleteMultiSelected;
    document.getElementById('btnClearMultiSelect').onclick=()=>{ multiSelectedIds.clear(); multiSelectedBgIds.clear(); renderRoom(); renderPropertiesPanel(); };
    return;
  }
  const inst=getSelectedInstance();
  if(!inst){ panel.innerHTML='<div class="empty-hint">Кликни по объекту в комнате, чтобы увидеть его свойства. Перетащи объект из библиотеки слева на холст, чтобы разместить. Тащи рамкой по пустому месту — выделить несколько объектов сразу (для сохранения как сет).</div>'; return; }
  panel.innerHTML=`
    <div class="section">
      <h3>${inst.name} <span class="status">(${inst.objectId})</span></h3>
      <div class="field"><label>X (м)</label><input id="instX" type="number" step="0.01" value="${pxToM(inst.x)}"></div>
      <div class="field"><label>Y (м)</label><input id="instY" type="number" step="0.01" value="${pxToM(inst.y)}"></div>
      <div class="field"><label>Размер в игре</label><div class="status">${(inst.realWidthCm||0).toFixed(0)} × ${(inst.realHeightCm||0).toFixed(0)} см</div></div>
      <div class="field"><label>Масштаб экземпляра (%)</label><input id="instScale" type="number" min="1" value="${Math.round((inst.scale||1)*100)}"></div>
      <div class="field"><label>Поворот (градусы, от -180 до 180)</label><input id="instRot" type="number" min="-180" max="180" value="${inst.rotation}"></div>
      <div class="row"><button id="instFlipH">Флип ↔</button><button id="instFlipV">Флип ↕</button></div>
      <div class="row" style="margin-top:8px"><button id="instToggleDecor" style="${inst.isDecor?'background:#3a2c59;border-color:#b78cf0':''}">🎨 ${inst.isDecor?'Декор (клик — снять)':'Сделать декором'}</button></div>
      <div class="status" style="margin-top:4px">${inst.isDecor?'Декор игнорирует зоны/пол — ставится куда угодно, Z-порядок по-прежнему решает перед/за игроком.':(inst.placementMode==='FLOOR_ONLY'?'Режим «Только пол» — падает на твёрдую опору, двигается только по горизонтали.':'')}</div>
      <div class="row" style="margin-top:8px"><button id="instFront">На передний план</button><button id="instBack">На задний план</button></div>
      <div class="field" style="margin-top:8px"><label>Z-порядок (число)</label><input id="instZ" type="number" value="${inst.zIndex}"></div>
      <div class="field"><label>Плотность <span class="status">(игрок ходит на уровне Z=${room.playerWalkZ})</span></label>
        <select id="instCollisionMode">
          <option value="ZLEVEL" ${inst.collisionMode==='ZLEVEL'?'selected':''}>По глубине — мешает только если Z=${room.playerWalkZ}, иначе можно пройти</option>
          <option value="SOLID" ${inst.collisionMode==='SOLID'?'selected':''}>Стена — мешает всегда, на любом Z</option>
          <option value="NONE" ${inst.collisionMode==='NONE'?'selected':''}>Пол/декор — никогда не мешает</option>
        </select>
      </div>
    </div>
    <div class="section">
      <label class="check"><input type="checkbox" id="instIsLight" ${inst.light?'checked':''}> Источник света</label>
      <div id="lightFields" style="display:${inst.light?'':'none'};margin-top:8px">
        <div class="field"><label>Радиус (м)</label><input id="instLightRadius" type="number" min="0" step="0.1" value="${inst.light?pxToM(inst.light.radius):1.5}"></div>
        <div class="field"><label>Цвет</label><input id="instLightColor" type="color" value="${inst.light?inst.light.color:'#ffcc66'}"></div>
        <div class="field"><label>Интенсивность (%)</label><input id="instLightIntensity" type="number" min="0" max="200" value="${inst.light?Math.round(inst.light.intensity*100):100}"></div>
        <div class="field"><label>Форма</label>
          <select id="instLightShape">
            <option value="CIRCLE" ${(!inst.light||inst.light.shape!=='CONE')?'selected':''}>Круг вокруг себя</option>
            <option value="CONE" ${(inst.light&&inst.light.shape==='CONE')?'selected':''}>Конус в одну сторону</option>
          </select>
        </div>
        <div id="lightConeFields" style="display:${(inst.light&&inst.light.shape==='CONE')?'':'none'}">
          <div class="field"><label>Направление (градусы, 90=вниз)</label><input id="instLightAngle" type="number" value="${inst.light&&inst.light.angle!==null&&inst.light.angle!==undefined?inst.light.angle:90}"></div>
          <div class="field"><label>Раскрытие (градусы)</label><input id="instLightSpread" type="number" min="1" max="180" value="${inst.light&&inst.light.spread?inst.light.spread:60}"></div>
          <div class="field"><label>Размытие краёв (%)</label><input id="instLightSoftness" type="number" min="0" max="100" value="${inst.light&&inst.light.softness!==null&&inst.light.softness!==undefined?Math.round(inst.light.softness*100):40}"></div>
        </div>
      </div>
    </div>
    <div class="section">
      <label class="check"><input type="checkbox" id="instCastsShadow" ${inst.shadow?'checked':''}> Отбрасывает тень</label>
      <div id="shadowFields" style="display:${inst.shadow?'':'none'};margin-top:8px">
        <div class="field"><label>Поглощение света (%, не обязательно 100)</label><input id="instShadowAbsorption" type="number" min="0" max="100" value="${inst.shadow?Math.round(inst.shadow.absorption*100):70}"></div>
        <div class="muted">Приблизительный превью — реальные мягкие тени с учётом всех источников света считает Godot в игре, здесь только прикидка.</div>
      </div>
    </div>
    <div class="section">
      <label class="check"><input type="checkbox" id="instIsDoor" ${inst.door?'checked':''}> Это дверь (ведёт в другую комнату)</label>
      <div id="doorFields" style="display:${inst.door?'':'none'};margin-top:8px">
        <div class="field"><label>Ведёт в комнату (id)</label><input id="doorRoomInput" list="doorRoomList" value="${inst.door?inst.door.toRoom:''}" placeholder="id комнаты"><datalist id="doorRoomList"></datalist></div>
        <div class="field"><label>Точка появления X (м)</label><input id="doorSpawnX" type="number" step="0.01" value="${inst.door?pxToM(inst.door.spawnX):0}"></div>
        <div class="field"><label>Точка появления Y (м)</label><input id="doorSpawnY" type="number" step="0.01" value="${inst.door?pxToM(inst.door.spawnY):0}"></div>
      </div>
    </div>
    <div class="section"><button id="instDelete" class="danger">Удалить объект</button></div>
  `;
  renderDoorRoomOptions();
  document.getElementById('instX').oninput=e=>{ inst.x=mToPx(+e.target.value||0); updatePlacementValidity(inst); renderRoom(); scheduleHistoryPush(); };
  document.getElementById('instY').oninput=e=>{ inst.y=mToPx(+e.target.value||0); updatePlacementValidity(inst); renderRoom(); scheduleHistoryPush(); };
  document.getElementById('instScale').oninput=e=>{ inst.scale=Math.max(0.01,(+e.target.value||100)/100); updatePlacementValidity(inst); if(inst.placementMode==='FLOOR_ONLY'&&!inst.isDecor) snapInstanceToFloor(inst); renderRoom(); scheduleHistoryPush(); };
  document.getElementById('instRot').oninput=e=>{ let v=+e.target.value||0; v=Math.max(-180,Math.min(180,v)); inst.rotation=v; renderRoom(); scheduleHistoryPush(); };
  document.getElementById('instFlipH').onclick=()=>{ inst.flipH=!inst.flipH; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instToggleDecor').onclick=()=>{ inst.isDecor=!inst.isDecor; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instFlipV').onclick=()=>{ inst.flipV=!inst.flipV; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instFront').onclick=()=>{ const maxZ=Math.max(0,...room.instances.map(i=>i.zIndex)); inst.zIndex=maxZ+1; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instBack').onclick=()=>{ const minZ=Math.min(0,...room.instances.map(i=>i.zIndex)); inst.zIndex=minZ-1; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instZ').oninput=e=>{ inst.zIndex=+e.target.value||0; renderRoom(); scheduleHistoryPush(); };
  document.getElementById('instCollisionMode').onchange=e=>{ inst.collisionMode=e.target.value; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instIsLight').onchange=e=>{ inst.light=e.target.checked?(inst.light||{radius:1.5*PIXELS_PER_METER,color:'#ffcc66',intensity:1,shape:'CIRCLE',angle:90,spread:60,softness:0.4}):null; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  const lr=document.getElementById('instLightRadius');
  if(lr){
    lr.oninput=e=>{ if(inst.light) inst.light.radius=mToPx(+e.target.value||0); renderRoom(); scheduleHistoryPush(); };
    document.getElementById('instLightColor').oninput=e=>{ if(inst.light) inst.light.color=e.target.value; renderRoom(); scheduleHistoryPush(); };
    document.getElementById('instLightIntensity').oninput=e=>{ if(inst.light) inst.light.intensity=(+e.target.value||0)/100; renderRoom(); scheduleHistoryPush(); };
    document.getElementById('instLightShape').onchange=e=>{ if(inst.light) inst.light.shape=e.target.value; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
    const angleEl=document.getElementById('instLightAngle');
    if(angleEl){
      angleEl.oninput=e=>{ if(inst.light) inst.light.angle=+e.target.value||0; renderRoom(); scheduleHistoryPush(); };
      document.getElementById('instLightSpread').oninput=e=>{ if(inst.light) inst.light.spread=+e.target.value||1; renderRoom(); scheduleHistoryPush(); };
      document.getElementById('instLightSoftness').oninput=e=>{ if(inst.light) inst.light.softness=(+e.target.value||0)/100; renderRoom(); scheduleHistoryPush(); };
    }
  }
  document.getElementById('instCastsShadow').onchange=e=>{ inst.shadow=e.target.checked?(inst.shadow||{absorption:0.7}):null; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); };
  const saEl=document.getElementById('instShadowAbsorption');
  if(saEl) saEl.oninput=e=>{ if(inst.shadow) inst.shadow.absorption=(+e.target.value||0)/100; renderRoom(); scheduleHistoryPush(); };
  document.getElementById('instIsDoor').onchange=e=>{ inst.door=e.target.checked?(inst.door||{toRoom:'',spawnX:0,spawnY:0}):null; renderPropertiesPanel(); scheduleHistoryPush(); };
  document.getElementById('instDelete').onclick=()=>deleteInstance(inst.instanceId);
  const drIn=document.getElementById('doorRoomInput');
  if(drIn){
    drIn.oninput=e=>{ if(inst.door) inst.door.toRoom=e.target.value; scheduleHistoryPush(); };
    document.getElementById('doorSpawnX').oninput=e=>{ if(inst.door) inst.door.spawnX=mToPx(+e.target.value||0); scheduleHistoryPush(); };
    document.getElementById('doorSpawnY').oninput=e=>{ if(inst.door) inst.door.spawnY=mToPx(+e.target.value||0); scheduleHistoryPush(); };
  }
}
function renderDoorRoomOptions(){ const dl=document.getElementById('doorRoomList'); if(dl) dl.innerHTML=existingRoomIds.map(id=>`<option value="${id}">`).join(''); }
function deleteInstance(instanceId){ room.instances=room.instances.filter(i=>i.instanceId!==instanceId); if(selectedInstanceId===instanceId) selectedInstanceId=null; renderRoom(); renderPropertiesPanel(); scheduleHistoryPush(); }
