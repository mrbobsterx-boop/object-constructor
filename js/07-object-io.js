/* ============================================================
   MODULE 07 — CRAFTING
   Crafting modal, recipe editor and crafting library.
   ============================================================ */

/* ============================================================
   CRAFT MODAL
   ============================================================ */
let craftGrid=Array(15).fill(null), craftSelectedLibItem=null, craftRecipe=null, craftRecipeImageDataUrl=null, craftLibCategoryPopulated=false;

async function openCraftModal(){
  document.getElementById('craftModal').classList.add('open');
  if(!craftLibCategoryPopulated){
    const sel=document.getElementById('craftLibCategory');
    Object.keys(CAT_LABELS).forEach(k=>{ const opt=document.createElement('option'); opt.value=k; opt.textContent=CAT_LABELS[k]; sel.appendChild(opt); });
    craftLibCategoryPopulated=true;
  }
  if(projectDirHandle) await scanProjectFolderCatalog();
  renderCraftLib(); renderCraftGrid(); renderCraftResult(); updateCraftCode();
}
function closeCraftModal(){ document.getElementById('craftModal').classList.remove('open'); }
document.getElementById('btnOpenCraft').onclick=openCraftModal;
document.getElementById('craftLibSearch').addEventListener('input', renderCraftLib);
document.getElementById('craftLibCategory').addEventListener('change', renderCraftLib);
function renderCraftLib(){
  const grid=document.getElementById('craftLibGrid'); grid.innerHTML='';
  const search=document.getElementById('craftLibSearch').value.trim().toLowerCase();
  const cat=document.getElementById('craftLibCategory').value;
  const source=projectDirHandle?projectCatalog:loadCatalog();
  const items=source.filter(e=>(!cat||e.category===cat) && (!search||(e.name||'').toLowerCase().includes(search)||(e.id||'').toLowerCase().includes(search)));
  if(!items.length){ grid.innerHTML='<div class="muted" style="grid-column:1/-1">Ничего не найдено. Сохрани подходящий объект (кнопка «Сохранить в папку проекта» или «Экспорт JSON»), он появится здесь.</div>'; return; }
  items.forEach(e=>{
    const el=document.createElement('div'); el.className='modal-item'+(craftSelectedLibItem&&craftSelectedLibItem.id===e.id?' selected':'');
    el.innerHTML=`${catalogThumbHtml(e,32)}<div class="n">${esc(e.name||e.id)}</div>`;
    el.draggable=true;
    el.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', JSON.stringify({id:e.id,name:e.name,image:e.image})); ev.dataTransfer.effectAllowed='copy'; });
    el.onclick=()=>{ craftSelectedLibItem=(craftSelectedLibItem&&craftSelectedLibItem.id===e.id)?null:e; renderCraftLib(); };
    grid.appendChild(el);
  });
}
function renderCraftGrid(){
  const g=document.getElementById('craftGrid3'); g.innerHTML='';
  for(let i=0;i<15;i++){
    const cell=document.createElement('div'); cell.className='craft-cell'+(craftGrid[i]?' filled':'');
    if(craftGrid[i]){
      cell.innerHTML=craftGrid[i].image ? `<img src="${craftGrid[i].image}" title="${esc(craftGrid[i].name||craftGrid[i].id||'')}">` : `<span class="thumb-empty" title="${esc(craftGrid[i].name||craftGrid[i].id||'')}" style="width:40px;height:40px"></span>`;
      cell.draggable=true;
      cell.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', JSON.stringify(craftGrid[i])); ev.dataTransfer.effectAllowed='copyMove'; });
      cell.addEventListener('dragend', ev=>{
        const rect=g.getBoundingClientRect();
        if(ev.clientX<rect.left||ev.clientX>rect.right||ev.clientY<rect.top||ev.clientY>rect.bottom){
          craftGrid[i]=null; renderCraftGrid(); updateCraftCode();
        }
      });
      cell.addEventListener('dblclick', ()=>{ craftGrid[i]=null; renderCraftGrid(); updateCraftCode(); });
    }
    cell.addEventListener('dragover', ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect='copy'; });
    cell.addEventListener('drop', ev=>{
      ev.preventDefault();
      const data=ev.dataTransfer.getData('text/plain'); if(!data)return;
      try{ const item=JSON.parse(data); craftGrid[i]={id:item.id,name:item.name,image:item.image}; renderCraftGrid(); updateCraftCode(); }catch(err){}
    });
    cell.onclick=()=>{ craftGrid[i]=craftSelectedLibItem?{id:craftSelectedLibItem.id,name:craftSelectedLibItem.name,image:craftSelectedLibItem.image}:null; renderCraftGrid(); updateCraftCode(); };
    g.appendChild(cell);
  }
}
function renderCraftResult(){
  const el=document.getElementById('craftResultPreview');
  const flat=mainDoc.docW?mainDoc.flatten():null;
  el.innerHTML = flat? `<img src="${flat.toDataURL()}">` : '<span class="muted" style="font-size:10px">нет картинки</span>';
}
function getCraftBoundingBox(){
  let minR=3,maxR=-1,minC=5,maxC=-1;
  for(let r=0;r<3;r++)for(let c=0;c<5;c++){ if(craftGrid[r*5+c]){ if(r<minR)minR=r; if(r>maxR)maxR=r; if(c<minC)minC=c; if(c>maxC)maxC=c; } }
  return maxR<0 ? null : {minR,maxR,minC,maxC};
}
function craftPattern(){
  const bb=getCraftBoundingBox();
  if(!bb) return [[]];
  const rows=[];
  for(let r=bb.minR;r<=bb.maxR;r++){
    const row=[];
    for(let c=bb.minC;c<=bb.maxC;c++){ const cell=craftGrid[r*5+c]; row.push(cell?cell.id:null); }
    rows.push(row);
  }
  return rows;
}
function updateCraftCode(){
  const recipe={ id:(id()||'new_item').toUpperCase(), pattern:craftPattern(), result:{id:id(),amount:+document.getElementById('craftAmount').value||1,label:val('name'),category:currentCategory} };
  if(document.getElementById('craftAllowMirror').checked){ const m=craftPattern().map(row=>[...row].reverse()); if(JSON.stringify(m)!==JSON.stringify(craftPattern())) recipe.mirrored_pattern=m; }
  document.getElementById('craftCodePreview').textContent=JSON.stringify(recipe,null,2);
  return recipe;
}
document.getElementById('craftAmount').addEventListener('input',updateCraftCode);
document.getElementById('craftAllowMirror').addEventListener('change',updateCraftCode);
document.getElementById('btnCraftClear').onclick=()=>{ craftGrid=Array(15).fill(null); renderCraftGrid(); updateCraftCode(); };
function loadImageEl(src){ return new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=src; }); }
function recipeImagePath(){
  const sub=val('subtype');
  return `${currentCategory}/${sub?sub+'/':''}${sanitizeFilenamePreserve(val('name'))}_recipe.png`;
}
async function buildRecipeImageCanvas(){
  const bb=getCraftBoundingBox();
  const cell=36, gap=4, pad=6;
  const cols=bb?(bb.maxC-bb.minC+1):1, rows=bb?(bb.maxR-bb.minR+1):1;
  const gridW=pad*2+cols*cell+(cols-1)*gap, gridH=pad*2+rows*cell+(rows-1)*gap;
  const canvas=document.createElement('canvas'); canvas.width=gridW; canvas.height=gridH;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#12161c'; ctx.fillRect(0,0,gridW,gridH);
  if(bb){
    const cellsToLoad=[];
    for(let r=bb.minR;r<=bb.maxR;r++)for(let c=bb.minC;c<=bb.maxC;c++) cellsToLoad.push(craftGrid[r*5+c]);
    const imgs=await Promise.all(cellsToLoad.map(cItem=>cItem?loadImageEl(cItem.image):Promise.resolve(null)));
    let idx=0;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=pad+c*(cell+gap), y=pad+r*(cell+gap);
      ctx.strokeStyle='#2a2f37'; ctx.strokeRect(x,y,cell,cell);
      if(imgs[idx]) ctx.drawImage(imgs[idx],x+3,y+3,cell-6,cell-6);
      idx++;
    }
  }
  return canvas;
}
document.getElementById('btnCraftSave').onclick=async ()=>{
  craftRecipe=updateCraftCode();
  const canvas=await buildRecipeImageCanvas();
  craftRecipeImageDataUrl=canvas.toDataURL('image/png');
  craftRecipe.recipeImage=recipeImagePath();
  closeCraftModal();
  if(window.update)window.update();
};

/* ============================================================
   CORE APP: categories, tabs, actions list, JSON assembly
   ============================================================ */
const CAT_LABELS={character:'Персонаж',creature:'Существо',item:'Предмет',tool:'Инструмент',weapon:'Оружие',clothing:'Одежда',furniture:'Мебель',decor:'Декор',container:'Контейнер',workbench:'Верстак',machine:'Машина',building:'Строительный объект',door:'Дверь',plant:'Растение',resource:'Точка ресурса',special:'Специальный'};

const actionList=[['USE','Использовать'],['TAKE','Взять'],['DROP','Положить'],['OPEN','Открыть'],['CLOSE','Закрыть'],['SLEEP','Спать'],['EAT','Есть'],['DRINK','Пить'],['CRAFT','Крафтить'],['REPAIR','Ремонтировать'],['BUILD','Строить'],['DISMANTLE','Разобрать'],['HARVEST','Собирать'],['ATTACK','Атаковать'],['EQUIP','Экипировать'],['UNEQUIP','Снять'],['TALK','Говорить'],['SEARCH','Осмотреть'],['STORE','Положить внутрь'],['TAKE_FROM','Взять из']];

const STANDARD_ANIMATIONS={
  character:[['idle','Простой'],['walk','Ходьба'],['run','Бег'],['sit','Сидеть'],['lie','Лежать'],['lie_down','Лечь'],['wake_up','Проснуться'],['stand_from_sit','Встать из сидя'],
    ['crouch','Присесть'],['sneak','Красться'],['crawl','Ползти'],['hide_crouch','Прятаться сидя'],['hide_stand','Прятаться стоя'],
    ['climb_up','Лезть вверх'],['climb_down','Лезть вниз'],['climb_wall','Лезть по стене'],['climb_object','Лезть на объект'],['get_down_object','Слезть с объекта'],
    ['jump','Прыжок'],['fall','Падение'],['land','Приземление'],
    ['drive','Вождение'],['enter_vehicle','Сесть в транспорт'],['exit_vehicle','Выйти из транспорта'],
    ['open_door','Открыть дверь'],['close_door','Закрыть дверь'],['look_through_peephole','Смотреть в глазок'],['break_door','Взломать дверь'],['force_door','Выбить дверь'],
    ['interact','Взаимодействие'],['search','Обыскивать'],['take','Взять'],['put','Положить'],['use','Использовать'],
    ['repair','Ремонтировать'],['build','Строить'],['destroy','Разрушать'],['craft','Крафтить'],
    ['eat','Есть'],['drink','Пить'],['cook','Готовить'],['sleep','Спать'],['heal','Лечить'],['treat','Обрабатывать раны'],
    ['attack','Атака'],['aim','Прицеливание'],['reload','Перезарядка'],['hurt','Получение урона'],['death','Смерть']],
  creature:[['idle','Простой'],['walk','Ходьба'],['run','Бег'],['attack','Атака'],['hurt','Получение урона'],['death','Смерть'],
    ['sleep','Спать'],['eat','Есть'],['threaten','Угрожать/рычать'],['sniff','Нюхать/искать'],['take_off','Взлёт'],['fly','Полёт'],['land','Приземление']],
  item:[['idle','Простой'],['use','Использование'],['spawn','Появление']],
  tool:[['idle','Простой'],['use','Использование'],['break','Поломка']],
  weapon:[['idle','Простой'],['aim','Прицеливание'],['fire','Выстрел/удар'],['reload','Перезарядка'],['break','Поломка']],
  clothing:[['idle','Простой'],['wear_tear','Износ/разрыв']],
  furniture:[['idle','Простой'],['use','Использование'],['destroy','Разрушение']],
  decor:[['idle','Простой']],
  container:[['closed','Закрыт'],['opening','Открытие'],['open','Открыт'],['closing','Закрытие']],
  workbench:[['idle','Простой'],['craft','Крафт']],
  machine:[['idle_off','Простой/выключен'],['working','Работа'],['break','Поломка'],['explode','Взрыв']],
  building:[['idle','Простой'],['building_process','Строительство'],['destroy','Разрушение']],
  door:[['closed','Закрыта'],['opening','Открытие'],['open','Открыта'],['closing','Закрытие'],['breaking','Взлом'],['broken','Выбита']],
  plant:[['idle','Простой'],['growing','Рост'],['ripe','Созревание'],['harvest','Сбор урожая'],['withered','Увядание']],
  resource:[['idle','Простой'],['harvesting','Добыча'],['depleted','Истощён'],['respawning','Восстановление']],
  special:[['idle','Простой']]
};
let currentCategory='character', currentActions=[], currentComponents=[];
let actionSettings={}; // { ACTION_ID: {requirements,time,consumeItem,consumeAmount,tool} }

// Пустой id генерируем ОДИН раз и запоминаем в поле — иначе каждый вызов выдавал бы новую метку времени
// (имя файла, внутренний id и путь картинки у безымянного объекта расходились, а каждое сохранение создавало новый файл).
function id(){
  const el=document.getElementById('id');
  if(!el.value) el.value='object_'+Date.now();
  return el.value;
}
function val(x){ return document.getElementById(x).value; }
function bool(x){ const el=document.getElementById(x); if(el && el.type==='checkbox') return el.checked; return val(x)==='YES'; }

/* ============================================================
   УНИВЕРСАЛЬНЫЙ СЛАЙДЕР — превращает существующий <input type="number">
   в полосу-регулятор + кликабельное число (клик — точный ввод).
   Исходное поле остаётся в DOM с тем же id, ничего в collect()/reset()
   менять не нужно — слайдер просто пишет в тот же элемент.
   ============================================================ */
window.__sliderRegistry={};
window.syncAllSliders=function(){ Object.values(window.__sliderRegistry).forEach(fn=>fn()); };
function makeSlider(id, opts){
  const orig=document.getElementById(id); if(!orig)return;
  const min=opts.min, max=opts.max, step=opts.step!==undefined?opts.step:1, unit=opts.unit||'';
  const wrap=document.createElement('div'); wrap.className='slider-wrap';
  const range=document.createElement('input');
  range.type='range'; range.min=min; range.max=max; range.step=step;
  range.value=Math.max(min,Math.min(max,+orig.value||0));
  range.className='slider-range';
  const display=document.createElement('span');
  display.className='slider-value'; display.title='Клик — ввести точное значение';
  function fmt(v){ return (step<1? (+v).toFixed(1) : Math.round(v)) + (unit?(' '+unit):''); }
  display.textContent=fmt(orig.value||0);
  orig.parentNode.insertBefore(wrap, orig);
  wrap.appendChild(range); wrap.appendChild(display);
  orig.style.display='none';
  wrap.appendChild(orig);
  function syncFromOrig(){
    const v=Math.max(min,Math.min(max,+orig.value||0));
    range.value=v; display.textContent=fmt(v);
  }
  range.addEventListener('input', ()=>{ orig.value=range.value; display.textContent=fmt(range.value); orig.dispatchEvent(new Event('input',{bubbles:true})); });
  display.addEventListener('click', ()=>{
    const edit=document.createElement('input');
    edit.type='number'; edit.value=orig.value; edit.min=min; edit.max=max; edit.step=step;
    edit.className='slider-value-edit';
    wrap.replaceChild(edit, display); edit.focus(); edit.select();
    const commit=()=>{
      let num=+edit.value; if(isNaN(num)) num=+orig.value;
      num=Math.max(min,Math.min(max,num));
      orig.value=num; orig.dispatchEvent(new Event('input',{bubbles:true}));
      syncFromOrig();
      wrap.replaceChild(display, edit);
    };
    edit.addEventListener('blur', commit);
    edit.addEventListener('keydown', e=>{ if(e.key==='Enter') edit.blur(); });
  });
  window.__sliderRegistry[id]=syncFromOrig;
}
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  document.querySelectorAll('.tabpanel').forEach(x=>x.classList.add('hidden'));
  document.getElementById('panel-'+b.dataset.tab).classList.remove('hidden');
  syncPreview();
});
document.querySelectorAll('.cat').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.cat').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  if(b.dataset.cat!==currentCategory){ currentCategory=b.dataset.cat; resetAllToDefaults(); document.getElementById('category').value=CAT_LABELS[currentCategory]; renderStdAnimSelect(); }
  update();
});
document.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',()=>{ if(window.update) window.update(); }));

function renderActions(){
  document.getElementById('actionsBox').innerHTML=actionList.map(([aid,n])=>{
    const on=currentActions.includes(aid);
    const s=actionSettings[aid]||{};
    let html=`<label class="check"><input type="checkbox" ${on?'checked':''} onchange="toggleAction('${aid}',this.checked)"> ${n} <span class="muted">${aid}</span></label>`;
    if(on){
      html+=`<div class="action-settings" style="margin:4px 0 10px 24px;padding:10px;background:#12161c;border:1px solid #262c35;border-radius:6px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="field full"><label>Требования <span class="muted">(свободный текст — что нужно для выполнения)</span></label><input data-aid="${aid}" data-field="requirements" value="${esc(s.requirements||'')}" oninput="setActionSetting('${aid}','requirements',this.value)"></div>
        <div class="field"><label>Время выполнения (сек)</label><input type="number" min="0" data-aid="${aid}" data-field="time" value="${s.time||0}" oninput="setActionSetting('${aid}','time',+this.value||0)"></div>
        <div class="field"><label>Нужен инструмент <span class="muted">(id объекта, необязательно)</span></label><input data-aid="${aid}" data-field="tool" list="objectCatalogList" value="${esc(s.tool||'')}" oninput="setActionSetting('${aid}','tool',this.value)"></div>
        <div class="field"><label>Расходует предмет <span class="muted">(id предмета)</span></label><input data-aid="${aid}" data-field="consumeItem" list="objectCatalogList" value="${esc(s.consumeItem||'')}" oninput="setActionSetting('${aid}','consumeItem',this.value)"></div>
        <div class="field"><label>Количество расхода</label><input type="number" min="0" data-aid="${aid}" data-field="consumeAmount" value="${s.consumeAmount||0}" oninput="setActionSetting('${aid}','consumeAmount',+this.value||0)"></div>
        <div class="field"><label>Выдаёт предмет <span class="muted">(id предмета — для HARVEST/SEARCH и т.п.)</span></label><input data-aid="${aid}" data-field="produceItem" list="objectCatalogList" value="${esc(s.produceItem||'')}" oninput="setActionSetting('${aid}','produceItem',this.value)"></div>
        <div class="field"><label>Количество выдачи</label><input type="number" min="0" data-aid="${aid}" data-field="produceAmount" value="${s.produceAmount||0}" oninput="setActionSetting('${aid}','produceAmount',+this.value||0)"></div>
        <div class="field"><label>Требует навык <span class="muted">(необязательно — напр. взлом замка)</span></label>
          <select data-aid="${aid}" data-field="requiredSkill" onchange="setActionSetting('${aid}','requiredSkill',this.value)">
            <option value="">— не требуется —</option>
            ${allSkills().map(([k,l])=>`<option value="${k}" ${s.requiredSkill===k?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Мин. уровень навыка</label><input type="number" min="0" data-aid="${aid}" data-field="requiredSkillLevel" value="${s.requiredSkillLevel||0}" oninput="setActionSetting('${aid}','requiredSkillLevel',+this.value||0)"></div>
        <div class="field full" style="margin-top:6px;padding-top:8px;border-top:1px dashed #303844">
          <label>Эффекты <span class="muted">(что происходит при успешном выполнении — общая система, не своя логика на каждое действие)</span></label>
          <div id="effects-${aid}"></div>
          <button type="button" onclick="addActionEffect('${aid}')" style="margin-top:4px">+ Добавить эффект</button>
        </div>
      </div>`;
    }
    return html;
  }).join('');
  currentActions.forEach(aid=>renderActionEffects(aid));
}
function renderActionEffects(aid){
  const box=document.getElementById('effects-'+aid); if(!box)return;
  const s=actionSettings[aid]||(actionSettings[aid]={});
  const list=s.effects||(s.effects=[]);
  const effects=allEffects();
  if(!list.length){ box.innerHTML='<span class="muted">Пока пусто.</span>'; return; }
  box.innerHTML=list.map((row,i)=>`
    <div class="row" style="margin:4px 0" data-idx="${i}">
      <select class="effect-select">${effects.map(([k,l])=>`<option value="${k}" ${row.effect===k?'selected':''}>${esc(l)}</option>`).join('')}</select>
      <input type="number" class="effect-value" value="${row.value||0}" style="width:70px" placeholder="значение">
      <input type="number" class="effect-duration" value="${row.duration||0}" style="width:70px" placeholder="сек., 0=мгнов.">
      <button type="button" class="effect-del">✕</button>
    </div>`).join('');
  box.querySelectorAll('[data-idx]').forEach(rowEl=>{
    const i=+rowEl.dataset.idx;
    rowEl.querySelector('.effect-select').onchange=e=>{ list[i].effect=e.target.value; update(); };
    rowEl.querySelector('.effect-value').oninput=e=>{ list[i].value=+e.target.value||0; update(); };
    rowEl.querySelector('.effect-duration').oninput=e=>{ list[i].duration=+e.target.value||0; update(); };
    rowEl.querySelector('.effect-del').onclick=()=>{ list.splice(i,1); renderActionEffects(aid); update(); };
  });
}
function addActionEffect(aid){
  const s=actionSettings[aid]||(actionSettings[aid]={});
  const list=s.effects||(s.effects=[]);
  const effects=allEffects(); if(!effects.length)return;
  list.push({effect:effects[0][0], value:10, duration:0});
  renderActionEffects(aid);
  update();
}
document.getElementById('btnAddCustomEffect').onclick=()=>{
  const input=document.getElementById('newEffectName');
  const label=input.value.trim(); if(!label)return;
  const key=translit(label)||('effect_'+Date.now());
  if(!allEffects().find(([k])=>k===key)){ const custom=loadCustomEffects(); custom.push([key,label]); saveCustomEffects(custom); }
  input.value='';
  currentActions.forEach(aid=>renderActionEffects(aid));
};
function setActionSetting(aid,field,value){
  if(!actionSettings[aid]) actionSettings[aid]={};
  actionSettings[aid][field]=value;
  update();
}
function toggleAction(aid,on){ currentActions=on?[...new Set([...currentActions,aid])]:currentActions.filter(x=>x!==aid); renderActions(); update(); }
function renderComponents(){
  const defaults=['Visual','Transform','Interaction'];
  document.getElementById('components').innerHTML=[...new Set([...defaults,...currentComponents])].map(x=>'<span class="tag">'+x+'</span>').join('');
}
function updateCombatFieldsVisibility(){
  document.getElementById('damageAmountField').style.display=bool('dealsDamage')?'':'none';
  document.getElementById('defenseAmountField').style.display=bool('providesDefense')?'':'none';
  const w=bool('wearsOut');
  document.getElementById('wearAmountField').style.display=w?'':'none';
  document.getElementById('wearLifetimeField').style.display=w?'':'none';
  document.getElementById('weightField').style.display=bool('hasWeight')?'':'none';
  const lightOn=bool('emitsLight');
  document.getElementById('lightRadiusField').style.display=lightOn?'':'none';
  document.getElementById('lightColorField').style.display=lightOn?'':'none';
  document.getElementById('lightIntensityField').style.display=lightOn?'':'none';
  document.getElementById('lightShapeField').style.display=lightOn?'':'none';
  const isCone=lightOn && val('lightShape')==='CONE';
  document.getElementById('lightAngleField').style.display=isCone?'':'none';
  document.getElementById('lightSpreadField').style.display=isCone?'':'none';
  document.getElementById('lightSoftnessField').style.display=isCone?'':'none';
  document.getElementById('shadowAbsorptionField').style.display=bool('castsShadow')?'':'none';

  document.getElementById('waterNeedSection').style.display=bool('needWater')?'':'none';
  const thirstRand=bool('thirstRandomInit');
  document.getElementById('thirstInitialField').style.display=thirstRand?'none':'';
  document.getElementById('thirstMinField').style.display=thirstRand?'':'none';
  document.getElementById('thirstMaxField').style.display=thirstRand?'':'none';

  const autoOn=bool('autonomyEnabled');
  ['autonomySatisfyField','autonomySearchWaterField','autonomySearchFoodField','autonomySleepField'].forEach(id=>{
    document.getElementById(id).style.display=autoOn?'':'none';
  });

  document.getElementById('visionRangeField').style.display=bool('visionEnabled')?'':'none';
  document.getElementById('hearingRangeField').style.display=bool('hearingEnabled')?'':'none';
  document.getElementById('moveSpeedField').style.display=bool('canMove')?'':'none';

  const dangerOn=bool('dangerReacts');
  document.getElementById('dangerFleeField').style.display=dangerOn?'':'none';
  document.getElementById('dangerHideField').style.display=dangerOn?'':'none';

  document.getElementById('charOnlyBehaviorBlock').style.display=(currentCategory==='character'||currentCategory==='creature')?'':'none';
  document.getElementById('animSourceField').style.display=(currentCategory==='character'||currentCategory==='creature')?'':'none';
  document.getElementById('resourceBlock').style.display=(currentCategory==='resource'||currentCategory==='container')?'':'none';
}
function collectDestroyList(){ return ['REMOVE','REMAINS','DROP_ITEMS','LOOTABLE','MOVABLE','DECAYS','DROP_EQUIPPED','REPLACE_OBJECT'].filter(k=>document.getElementById('onDestroy_'+k).checked); }
function buildCollisionExport(doc){
  if(!doc.docW) return null;
  if(doc.collision.mode==='NONE') return {type:'NONE'};
  const r=doc.getCollisionRect();
  return { type:doc.collision.mode, padding:doc.collision.padding||0, rect:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.w),h:Math.round(r.h)}:null };
}
function autofillPaths(){
  const base=`${currentCategory}/${val('subtype')?val('subtype')+'/':''}${id()}_${translit(val('name'))||'object'}`;
  const asset=document.getElementById('asset');
  if(asset.dataset.auto!=='0') asset.value=base+'.png';
  const bp=document.getElementById('brokenPath'), dp=document.getElementById('destroySheetPath'), damp=document.getElementById('damagedPath');
  if(!bp.value.trim() || bp.dataset.auto!=='0'){ bp.value=base+'_broken.png'; bp.dataset.auto='1'; }
  if(!dp.value.trim() || dp.dataset.auto!=='0'){ dp.value=base+'_broken_anim.png'; dp.dataset.auto='1'; }
  if(!damp.value.trim() || damp.dataset.auto!=='0'){ damp.value=base+'_damaged.png'; damp.dataset.auto='1'; }
}
function animSheetPathFor(animId){
  return `${currentCategory}/${val('subtype')?val('subtype')+'/':''}${sanitizeSlug(id())}_${sanitizeSlug(animId)}.png`;
}
function animSoundPathFor(animId, idx, origName){
  const ext=((origName||'').split('.').pop()||'mp3').toLowerCase();
  const suffix=idx>0 ? '_'+(idx+1) : '';
  return `${currentCategory}/${val('subtype')?val('subtype')+'/':''}${sanitizeSlug(id())}_${sanitizeSlug(animId)}${suffix}.${ext}`;
}
document.getElementById('asset').addEventListener('input',()=>{document.getElementById('asset').dataset.auto='0';});
['brokenPath','destroySheetPath','damagedPath'].forEach(fid=>document.getElementById(fid).addEventListener('input',()=>{document.getElementById(fid).dataset.auto='0';}));

function collect(){
  let custom={}; try{ custom=JSON.parse(val('custom')||'{}'); }catch(e){ custom={_error:'invalid_json'}; }
  customFields.forEach(f=>{ if(f.name) custom[f.name]=parseCustomFieldValue(f.value); });
  return {
    schema_version:4, // 4 = длины в метрах (radius_m, range_m, speed_mps), размер объекта — в см
    id:id(), name:val('name'), category:currentCategory, category_name:CAT_LABELS[currentCategory],
    subtype:val('subtype'), description:val('description'),
    transform:{ layer:+val('layer')||0 },
    appearance:{ mode:val('visualMode'), asset:val('asset'), imageWidth:mainDoc.docW||0, imageHeight:mainDoc.docH||0, collision:buildCollisionExport(mainDoc) },
    behavior:{ carryable:bool('carryable'), placeable:bool('placeable'), collision:val('collision'), physics:val('physics'), interactive:bool('interactive'), hasWeight:bool('hasWeight'), weight:bool('hasWeight')?+val('weight')||0:0,
      real_width_cm: Math.round((+val('realWidthCm')||0)/10)*10,
      real_height_cm: Math.round((+val('realHeightCm')||0)/10)*10,
      placement_mode: val('placementMode')||'ANYWHERE',
      variant_group: val('variantGroup').trim()||null,
      allowed_room_types: [...document.getElementById('allowedRoomTypes').selectedOptions].map(o=>o.value),
      light: bool('emitsLight') ? { radius_m:+val('lightRadius')||0, color:val('lightColor'), intensity:(+val('lightIntensity')||100)/100,
        shape: val('lightShape'),
        angle: val('lightShape')==='CONE' ? (+val('lightAngle')||90) : null,
        spread: val('lightShape')==='CONE' ? (+val('lightSpread')||60) : null,
        softness: val('lightShape')==='CONE' ? (+val('lightSoftness')||40)/100 : null
      } : null,
      shadow: bool('castsShadow') ? { absorption:(+val('shadowAbsorption')||70)/100 } : null,
      needs:{
        food:bool('needFood'), water:bool('needWater'), sleep:bool('needSleep'), health:bool('needHealth'), stress:bool('needStress'),
        water_params: bool('needWater') ? {
          random_initial: bool('thirstRandomInit'),
          initial: bool('thirstRandomInit') ? null : (+val('thirstInitial')||0),
          min_initial: bool('thirstRandomInit') ? (+val('thirstMin')||0) : null,
          max_initial: bool('thirstRandomInit') ? (+val('thirstMax')||0) : null,
          decay_rate_per_hour: +val('thirstDecayRate')||0,
          want_threshold: +val('thirstWantThreshold')||0,
          critical_threshold: +val('thirstCriticalThreshold')||0,
          drink_amount: +val('thirstDrinkAmount')||0,
          drink_time: +val('thirstDrinkTime')||0
        } : null
      },
      autonomy:{
        enabled:bool('autonomyEnabled'),
        satisfy_needs:bool('autonomyEnabled')&&bool('autonomySatisfyNeeds'),
        search_water:bool('autonomyEnabled')&&bool('autonomySearchWater'),
        search_food:bool('autonomyEnabled')&&bool('autonomySearchFood'),
        sleep:bool('autonomyEnabled')&&bool('autonomySleep')
      },
      perception:{
        vision: bool('visionEnabled') ? { range_m:+val('visionRange')||0 } : null,
        hearing: bool('hearingEnabled') ? { range_m:+val('hearingRange')||0 } : null
      },
      movement:{ enabled:bool('canMove'), speed_mps: bool('canMove') ? (+val('moveSpeed')||0) : 0 },
      danger:{
        reacts:bool('dangerReacts'),
        can_flee:bool('dangerReacts')&&bool('dangerCanFlee'),
        can_hide:bool('dangerReacts')&&bool('dangerCanHide')
      },
      makes_sounds:bool('makesSounds')
    },
    actions:currentActions,
    action_settings: Object.fromEntries(currentActions.map(aid=>{
      const s=actionSettings[aid]||{};
      return [aid, { requirements:s.requirements||'', time:s.time||0, tool:s.tool||'',
        consume:{item:s.consumeItem||'', amount:s.consumeAmount||0},
        produce:{item:s.produceItem||'', amount:s.produceAmount||0},
        required_skill: s.requiredSkill ? {skill:s.requiredSkill, level:s.requiredSkillLevel||0} : null,
        effects:(s.effects||[]).map(e=>({effect:e.effect, value:e.value||0, duration:e.duration||0})) }];
    })),
    combat:{
      dealsDamage:bool('dealsDamage'), damageAmount:bool('dealsDamage')?+val('damageAmount')||0:0,
      providesDefense:bool('providesDefense'), defenseAmount:bool('providesDefense')?+val('defenseAmount')||0:0,
      wearsOut:bool('wearsOut'), wearAmount:bool('wearsOut')?+val('wearAmount')||0:0, wearLifetimeDays:bool('wearsOut')?+val('wearLifetimeDays')||0:0
    },
    inventory:{ enabled:bool('hasInventory'), slots:+val('slots')||0, maxWeight:+val('maxWeight')||0, storage:val('storage') },
    resource: (currentCategory==='resource'||currentCategory==='container') && val('resourceType').trim() ? {
      type: val('resourceType').trim(),
      max_amount: +val('resourceMax')||0,
      initial_amount: +val('resourceInitial')||0,
      initial_state: val('resourceState').trim()||'чистая',
      source: val('resourceSource').trim()||'без пополнения',
      self_recovery_hours: +val('resourceRecoveryHours')||0
    } : null,
    destruction:{ enabled:bool('destructible'), hp:+val('hp')||0, damaged_threshold_percent:+val('damagedThreshold')||50, onDestroy:collectDestroyList(),
      damaged: damagedW?{nativeWidth:damagedW,nativeHeight:damagedH,image:val('damagedPath')||'damaged.png'}:null,
      broken: brokenW?{nativeWidth:brokenW,nativeHeight:brokenH,image:val('brokenPath')||'broken.png'}:null,
      destroyAnimation: destroyFrames.length?{frameCount:destroyFrames.length,fps:+val('destroyFps')||8,frameNativeWidth:destroyFrameW,frameNativeHeight:destroyFrameH,sheet:val('destroySheetPath')||'broken_anim.png'}:null
    },
    crafting:{ enabled:bool('crafting'), recipe:craftRecipe },
    visuals: buildVisualsExport(),
    character_ref: linkedCharacter ? { id:linkedCharacter.id, rig:linkedCharacter.rig||null } : null,
    animation_enabled: bool('animated'),
    tags: val('tags').split(',').map(x=>x.trim()).filter(Boolean),
    components: currentComponents,
    custom
  };
}
function update(){
  scheduleHistoryPush();
  autofillPaths();
  if(window.syncAllSliders) window.syncAllSliders();
  const o=collect();
  document.getElementById('json').textContent=JSON.stringify(o,null,2);
  document.getElementById('titleMini').textContent=o.name||'Новый объект';
  document.getElementById('tagsView').innerHTML=o.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  renderComponents();
  updateCombatFieldsVisibility();
  document.getElementById('craftOpenSection').style.display=bool('crafting')?'':'none';
  document.getElementById('craftStatus').textContent=craftRecipe?'Рецепт задан.':'Рецепт не задан.';
  syncPreview();
}
window.update=update;

/* ============================================================
   RESET / NEW / CATEGORY-SWITCH
   ============================================================ */
function resetIdentityAndImages(){
  customFields=[]; renderCustomFieldList();
  ['id','name','subtype','description'].forEach(f=>document.getElementById(f).value='');
  document.getElementById('id').dataset.auto='1';
  animSourceMode='MANUAL'; linkedCharacter=null;
  document.getElementById('animSource').value='MANUAL';
  document.getElementById('assemblerPickerField').style.display='none';
  document.getElementById('assemblerCharSelect').value=''; document.getElementById('assemblerCharCard').innerHTML='';
  const asset=document.getElementById('asset'); asset.value=''; asset.dataset.auto='1';
  ['brokenPath','destroySheetPath','damagedPath'].forEach(f=>{ const el=document.getElementById(f); el.value=''; el.dataset.auto='1'; });
  animations=[]; imageStates=[]; currentVisual=null; currentAnimIndex=-1; frames=[]; currentFrameIndex=-1; idleCreated=false; animSoundFiles=[];
  mainDoc.clear(); animDoc.clear();
  document.getElementById('visualEditor').style.display='none';
  renderVisualList();
  brokenW=0;brokenH=0; brokenCanvas.width=0;brokenCanvas.height=0; document.getElementById('brokenStatus').textContent='Не задан.'; document.getElementById('btnDownloadBroken').disabled=true;
  damagedW=0;damagedH=0; damagedCanvas.width=0;damagedCanvas.height=0; document.getElementById('damagedStatus').textContent='Не задан.'; document.getElementById('btnDownloadDamaged').disabled=true; document.getElementById('damagedThreshold').value=50;
  destroyFrames=[]; destroyFrameW=0;destroyFrameH=0; renderDestroyThumbs();
  craftRecipe=null; craftRecipeImageDataUrl=null; craftGrid=Array(15).fill(null);
  if(window.update) window.update();
}
function resetAllToDefaults(){
  resetIdentityAndImages();
  document.getElementById('realWidthCm').value=0; document.getElementById('realHeightCm').value=0;
  document.getElementById('placementMode').value='ANYWHERE'; document.getElementById('variantGroup').value='';
  [...document.getElementById('allowedRoomTypes').options].forEach(o=>o.selected=false);
  ['resourceType','resourceState','resourceSource'].forEach(f=>document.getElementById(f).value='');
  document.getElementById('resourceMax').value=100; document.getElementById('resourceInitial').value=100; document.getElementById('resourceRecoveryHours').value=0;
  document.getElementById('layer').value=0;
  document.getElementById('visualMode').value='IMAGE';
  document.getElementById('carryable').checked=false; document.getElementById('placeable').checked=false;
  document.getElementById('collision').value='NONE'; document.getElementById('physics').value='STATIC'; document.getElementById('interactive').checked=false;
  document.getElementById('hasWeight').checked=false; document.getElementById('weight').value=1;
  document.getElementById('emitsLight').checked=false; document.getElementById('lightRadius').value=1.5; document.getElementById('lightColor').value='#ffcc66'; document.getElementById('lightIntensity').value=100;
  document.getElementById('lightShape').value='CIRCLE'; document.getElementById('lightAngle').value=90; document.getElementById('lightSpread').value=60; document.getElementById('lightSoftness').value=40;
  document.getElementById('castsShadow').checked=false; document.getElementById('shadowAbsorption').value=70;
  document.getElementById('needFood').checked=false; document.getElementById('needWater').checked=false; document.getElementById('needSleep').checked=false; document.getElementById('needHealth').checked=false; document.getElementById('needStress').checked=false;
  document.getElementById('thirstRandomInit').checked=false; document.getElementById('thirstInitial').value=100; document.getElementById('thirstMin').value=40; document.getElementById('thirstMax').value=100;
  document.getElementById('thirstDecayRate').value=2; document.getElementById('thirstWantThreshold').value=40; document.getElementById('thirstCriticalThreshold').value=15; document.getElementById('thirstDrinkAmount').value=30; document.getElementById('thirstDrinkTime').value=4;
  document.getElementById('autonomyEnabled').checked=false; document.getElementById('autonomySatisfyNeeds').checked=false; document.getElementById('autonomySearchWater').checked=false; document.getElementById('autonomySearchFood').checked=false; document.getElementById('autonomySleep').checked=false;
  document.getElementById('visionEnabled').checked=false; document.getElementById('visionRange').value=4;
  document.getElementById('hearingEnabled').checked=false; document.getElementById('hearingRange').value=3;
  document.getElementById('canMove').checked=false; document.getElementById('moveSpeed').value=1;
  document.getElementById('dangerReacts').checked=false; document.getElementById('dangerCanFlee').checked=false; document.getElementById('dangerCanHide').checked=false;
  document.getElementById('makesSounds').checked=false;
  currentActions=[]; actionSettings={}; renderActions();
  document.getElementById('dealsDamage').checked=false; document.getElementById('providesDefense').checked=false; document.getElementById('wearsOut').checked=false;
  document.getElementById('hasInventory').checked=false; document.getElementById('slots').value=0; document.getElementById('maxWeight').value=0; document.getElementById('storage').value='GENERAL';
  document.getElementById('destructible').checked=true; document.getElementById('hp').value=100;
  ['REMOVE','REMAINS','DROP_ITEMS','LOOTABLE','MOVABLE','DECAYS','DROP_EQUIPPED','REPLACE_OBJECT'].forEach(k=>document.getElementById('onDestroy_'+k).checked=(k==='REMOVE'));
  document.getElementById('crafting').checked=false;
  document.getElementById('animated').checked=true;
  document.getElementById('tags').value=''; document.getElementById('custom').value='';
  document.getElementById('collisionMode').value='AUTO'; document.getElementById('collisionPadding').value=0;
  mainDoc.collision={mode:'AUTO',padding:0,rect:null}; animDoc.collision={mode:'AUTO',padding:0,rect:null};
  updateCombatFieldsVisibility();
}
function newObject(){ resetIdentityAndImages(); }
function duplicateObject(){
  const nameEl=document.getElementById('name');
  const original=(nameEl.value||'Объект').trim()||'Объект';
  const m=original.match(/^(.*?)(?:[ _-](\d+))?$/);
  const base=(m&&m[1]?m[1]:original).trim()||'Объект';
  const currentNum=m&&m[2]?parseInt(m[2],10):1;
  let max=currentNum;
  existingObjectsList.forEach(o=>{
    const n=String(o.name||o.id||'').trim();
    const x=n.match(/^(.*?)(?:[ _-](\d+))?$/);
    if(!x)return;
    if(x[1].trim().toLowerCase()===base.toLowerCase())max=Math.max(max,x[2]?parseInt(x[2],10):1);
  });
  nameEl.value=base+' '+String(max+1).padStart(2,'0');
  document.getElementById('id').dataset.auto='1';
  syncIdFromName();
  document.getElementById('titleMini').textContent=nameEl.value+' — дубликат с новым порядковым номером';
  if(window.update)window.update();
}

/* ============================================================
   CATALOG (shared library, auto-populated on export/save)
   ============================================================ */
async function addCurrentToCatalog(){
  const flat = mainDoc.docW ? mainDoc.flatten().toDataURL() : null;
  addToCatalog({ id:id(), category:currentCategory, name:val('name')||id(), image:flat, json:collect() });
}
function exportCatalog(){ downloadBlob(new Blob([JSON.stringify(loadCatalog(),null,2)],{type:'application/json'}), 'catalog.json'); }
function importCatalogFile(e){
  const file=e.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const incoming=JSON.parse(reader.result);
      const map={}; loadCatalog().forEach(x=>map[x.id]=x); incoming.forEach(x=>map[x.id]=x);
      saveCatalogList(Object.values(map)); renderCatalogSidebar();
      alert('Каталог обновлён: '+Object.keys(map).length+' объектов.');
    }catch(err){ alert('Ошибка чтения каталога: '+err.message); }
  };
  reader.readAsText(file); e.target.value='';
}

/* ============================================================
   PRESETS (named settings templates, no images)
   ============================================================ */
function collectFieldValues(){
  const ids=['id','name','subtype','description','layer','asset','visualMode','carryable','placeable','collision','physics','interactive','hasWeight','weight','emitsLight','lightRadius','lightColor','lightIntensity','lightShape','lightAngle','lightSpread','lightSoftness','castsShadow','shadowAbsorption',
    'dealsDamage','damageAmount','providesDefense','defenseAmount','wearsOut','wearAmount','wearLifetimeDays',
    'hasInventory','slots','maxWeight','storage','destructible','hp','brokenPath','destroySheetPath','destroyFps',
    'crafting','animated','fps','animLoop','tags','custom','collisionMode','collisionPadding','animCollisionMode','animCollisionPadding',
    'needFood','needWater','needSleep','needHealth','needStress',
    'thirstRandomInit','thirstInitial','thirstMin','thirstMax','thirstDecayRate','thirstWantThreshold','thirstCriticalThreshold','thirstDrinkAmount','thirstDrinkTime',
    'autonomyEnabled','autonomySatisfyNeeds','autonomySearchWater','autonomySearchFood','autonomySleep',
    'visionEnabled','visionRange','hearingEnabled','hearingRange','canMove','moveSpeed',
    'dangerReacts','dangerCanFlee','dangerCanHide','makesSounds','realWidthCm','realHeightCm','placementMode','variantGroup','damagedThreshold','allowedRoomTypes',
    'resourceType','resourceMax','resourceInitial','resourceState','resourceSource','resourceRecoveryHours'];
  const out={}; ids.forEach(i=>{ const el=document.getElementById(i); if(!el)return; if(el.multiple) out[i]=[...el.selectedOptions].map(o=>o.value); else out[i]=(el.type==='checkbox')?el.checked:el.value; });
  ['REMOVE','REMAINS','DROP_ITEMS','LOOTABLE','MOVABLE','DECAYS','DROP_EQUIPPED','REPLACE_OBJECT'].forEach(k=>{ out['onDestroy_'+k]=document.getElementById('onDestroy_'+k).checked; });
  return out;
}
function applyFieldValues(f){ Object.keys(f).forEach(k=>{ const el=document.getElementById(k); if(!el)return; if(el.multiple){ const vals=Array.isArray(f[k])?f[k]:[]; [...el.options].forEach(o=>{ o.selected=vals.includes(o.value); }); } else if(el.type==='checkbox') el.checked=f[k]; else el.value=f[k]; }); }
function savePreset(){
  const name=document.getElementById('presetName').value.trim(); if(!name)return alert('Введи имя пресета.');
  const presets=loadPresets(); presets[name]={category:currentCategory, fields:collectFieldValues(), actions:currentActions, actionSettings:JSON.parse(JSON.stringify(actionSettings)), units:'m'};
  savePresetsAll(presets); renderPresetSelect(); document.getElementById('presetSelect').value=name;
}
function loadPreset(){
  const name=document.getElementById('presetSelect').value; if(!name)return;
  const p=loadPresets()[name]; if(!p)return;
  currentCategory=p.category; document.querySelectorAll('.cat').forEach(b=>b.classList.toggle('active',b.dataset.cat===currentCategory)); renderStdAnimSelect();
  document.getElementById('category').value=CAT_LABELS[currentCategory];
  applyFieldValues(p.units==='m'?p.fields:migrateLegacyFieldUnits(p.fields)); currentActions=p.actions||[]; actionSettings=p.actionSettings||{}; renderActions();
  updateCombatFieldsVisibility(); if(window.update)window.update();
}
function deletePreset(){ const name=document.getElementById('presetSelect').value; if(!name)return; const presets=loadPresets(); delete presets[name]; savePresetsAll(presets); renderPresetSelect(); }

/* ============================================================
   EXPORT JSON / ZIP, IMPORT SESSION ZIP
   ============================================================ */
async function exportJSON(){ await addCurrentToCatalog(); downloadBlob(new Blob([JSON.stringify(collect(),null,2)],{type:'application/json'}), (sanitizeSlug(id())||'object')+'.json'); }

async function exportZip(){
  await addCurrentToCatalog();
  autofillPaths();
  const base=sanitizeSlug(id())||'object';
  const files=[];
  const spritePrefix='assets/sprites/';
  const assetRel=val('asset')||(base+'.png');
  const brokenRel=val('brokenPath')||(base+'_broken.png');
  const destroyRel=val('destroySheetPath')||(base+'_broken_anim.png');
  const damagedRel=val('damagedPath')||(base+'_damaged.png');
  if(mainDoc.docW) files.push({name:spritePrefix+assetRel, data: await dataURLToBytes(mainDoc.flatten().toDataURL('image/png'))});
  if(brokenW) files.push({name:spritePrefix+brokenRel, data: await dataURLToBytes(brokenCanvas.toDataURL('image/png'))});
  if(damagedW) files.push({name:spritePrefix+damagedRel, data: await dataURLToBytes(damagedCanvas.toDataURL('image/png'))});
  await commitCurrentFrame();
  for(const a of animations){
    if(a.source==='assembled' || !a.frames.length)continue;
    const sheet=await buildAnimSheetCanvas(a.frames);
    files.push({name:spritePrefix+animSheetPathFor(a.id), data: await dataURLToBytes(sheet.toDataURL('image/png'))});
  }
  for(const s of imageStates){
    if(!s.doc)continue;
    await scratchDoc.restore(s.doc);
    const flat=scratchDoc.flatten();
    files.push({name:spritePrefix+imageStateAssetPath(s.id), data: await dataURLToBytes(flat.toDataURL('image/png'))});
  }
  for(const a of animations){
    if(!a.sound || a.sound.source==='EXISTING' || !a.sound.files || !a.sound.files.length)continue;
    for(let idx=0; idx<a.sound.files.length; idx++){
      const f=a.sound.files[idx];
      files.push({name:'assets/sounds/'+animSoundPathFor(a.id,idx,f.name), data: await dataURLToBytes(f.dataUrl)});
    }
  }
  if(destroyFrames.length){ const dsheet=await buildDestroySheetCanvas(); files.push({name:spritePrefix+destroyRel, data: await dataURLToBytes(dsheet.toDataURL('image/png'))}); }
  files.push({name:'data/objects/'+base+'.json', data:new TextEncoder().encode(JSON.stringify(collect(),null,2))});
  if(craftRecipe && craftRecipe.recipeImage && craftRecipeImageDataUrl) files.push({name:spritePrefix+craftRecipe.recipeImage, data: await dataURLToBytes(craftRecipeImageDataUrl)});
  const session=await buildSessionState();
  files.push({name:'_session.json', data:new TextEncoder().encode(JSON.stringify(session))});
  downloadBlob(makeZip(files), base+'.zip');
}
async function buildSessionState(){
  await commitCurrentFrame();
  return {
    units:'m', fields:collectFieldValues(), category:currentCategory, actions:currentActions, actionSettings:JSON.parse(JSON.stringify(actionSettings)),
    customFields:JSON.parse(JSON.stringify(customFields)),
    mainDoc: mainDoc.docW? await mainDoc.serialize() : null,
    animations:JSON.parse(JSON.stringify(animations)), imageStates:JSON.parse(JSON.stringify(imageStates)),
    currentVisual:currentVisual?{...currentVisual}:null, idleCreated,
    damaged: damagedW? {w:damagedW,h:damagedH,data:damagedCanvas.toDataURL()} : null,
    broken: brokenW? {w:brokenW,h:brokenH,data:brokenCanvas.toDataURL()} : null,
    destroyFrames, destroyFrameW, destroyFrameH,
    craftRecipe, craftRecipeImageDataUrl
  };
}
async function restoreSessionState(state){
  currentCategory=state.category; document.querySelectorAll('.cat').forEach(b=>b.classList.toggle('active',b.dataset.cat===currentCategory));
  document.getElementById('category').value=CAT_LABELS[currentCategory];
  applyFieldValues(state.units==='m'?state.fields:migrateLegacyFieldUnits(state.fields)); currentActions=state.actions||[]; actionSettings=state.actionSettings||{}; renderActions();
  customFields=state.customFields?JSON.parse(JSON.stringify(state.customFields)):[]; renderCustomFieldList();
  if(state.mainDoc) await mainDoc.restore(state.mainDoc); else mainDoc.clear();
  animations=state.animations?JSON.parse(JSON.stringify(state.units==='m'?state.animations:migrateLegacyAnimUnits(state.animations))):[];
  imageStates=state.imageStates?JSON.parse(JSON.stringify(state.imageStates)):[];
  idleCreated=!!state.idleCreated;
  currentVisual=null; currentAnimIndex=-1; frames=[]; currentFrameIndex=-1; animDoc.clear();
  document.getElementById('visualEditor').style.display='none';
  if(state.currentVisual && getVisualEntries().some(v=>v.type===state.currentVisual.type && v.id===state.currentVisual.id)){
    await selectVisual(state.currentVisual.type, state.currentVisual.id);
  } else { renderVisualList(); }
  if(state.broken){
    brokenW=state.broken.w; brokenH=state.broken.h; brokenCanvas.width=brokenW; brokenCanvas.height=brokenH;
    const dispW=Math.min(220,brokenW); brokenCanvas.style.width=dispW+'px'; brokenCanvas.style.height=(brokenH*dispW/brokenW)+'px';
    const im=await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=state.broken.data; });
    bctx.drawImage(im,0,0); document.getElementById('btnDownloadBroken').disabled=false; document.getElementById('brokenStatus').textContent=`Задан: ${brokenW}×${brokenH}px`;
  } else { brokenW=0;brokenH=0; brokenCanvas.width=0;brokenCanvas.height=0; document.getElementById('btnDownloadBroken').disabled=true; document.getElementById('brokenStatus').textContent='Не задан.'; }
  if(state.damaged){
    damagedW=state.damaged.w; damagedH=state.damaged.h; damagedCanvas.width=damagedW; damagedCanvas.height=damagedH;
    const dispWd=Math.min(220,damagedW); damagedCanvas.style.width=dispWd+'px'; damagedCanvas.style.height=(damagedH*dispWd/damagedW)+'px';
    const imd=await new Promise(res=>{ const im2=new Image(); im2.onload=()=>res(im2); im2.src=state.damaged.data; });
    dactx.drawImage(imd,0,0); document.getElementById('btnDownloadDamaged').disabled=false; document.getElementById('damagedStatus').textContent=`Задан: ${damagedW}×${damagedH}px`;
  } else { damagedW=0;damagedH=0; damagedCanvas.width=0;damagedCanvas.height=0; document.getElementById('btnDownloadDamaged').disabled=true; document.getElementById('damagedStatus').textContent='Не задан.'; }
  destroyFrames=state.destroyFrames||[]; destroyFrameW=state.destroyFrameW||0; destroyFrameH=state.destroyFrameH||0; renderDestroyThumbs();
  craftRecipe=state.craftRecipe||null;
  craftRecipeImageDataUrl=state.craftRecipeImageDataUrl||null;
  updateCombatFieldsVisibility(); if(window.update)window.update();
}
async function importSessionZip(e){
  const file=e.target.files[0]; if(!file)return;
  const buf=await file.arrayBuffer();
  const zfiles=await readZip(buf);
  const sessionBytes=zfiles['_session.json'];
  if(!sessionBytes){ alert('В этом ZIP нет файла сессии (_session.json) — это не полный сессионный архив, а готовые файлы для игры. Импортировать редактирование из него нельзя.'); return; }
  const state=JSON.parse(new TextDecoder().decode(sessionBytes));
  await restoreSessionState(state);
  e.target.value='';
}

/* ============================================================
   GLOBAL UNDO/REDO — snapshots the whole object (fields, main image
   with layers, animation frames, broken image, destroy frames, craft
   recipe) via the same buildSessionState/restoreSessionState used for
   ZIP session import. Debounced so a brush stroke or typing burst
   becomes ONE history entry, not one per pixel/keystroke.
   ============================================================ */
let historyStack=[], historyIndex=-1, historyPushTimer=null, suppressHistoryPush=false, historyBusy=false;
function scheduleHistoryPush(){
  if(suppressHistoryPush||historyBusy)return;
  clearTimeout(historyPushTimer);
  historyPushTimer=setTimeout(doPushHistory,500);
}
async function doPushHistory(){
  if(suppressHistoryPush)return;
  historyBusy=true;
  const snap=await buildSessionState();
  historyBusy=false;
  historyStack=historyStack.slice(0,historyIndex+1);
  historyStack.push(snap);
  if(historyStack.length>25)historyStack.shift();
  historyIndex=historyStack.length-1;
  updateHistoryButtons();
}
function updateHistoryButtons(){
  document.getElementById('btnGlobalUndo').disabled=historyIndex<=0;
  document.getElementById('btnGlobalRedo').disabled=historyIndex>=historyStack.length-1;
}
async function undoAction(){
  if(historyIndex<=0)return;
  clearTimeout(historyPushTimer);
  historyIndex--; suppressHistoryPush=true;
  await restoreSessionState(historyStack[historyIndex]);
  suppressHistoryPush=false; updateHistoryButtons();
}
async function redoAction(){
  if(historyIndex>=historyStack.length-1)return;
  clearTimeout(historyPushTimer);
  historyIndex++; suppressHistoryPush=true;
  await restoreSessionState(historyStack[historyIndex]);
  suppressHistoryPush=false; updateHistoryButtons();
}
document.getElementById('btnGlobalUndo').onclick=undoAction;
document.getElementById('btnGlobalRedo').onclick=redoAction;
document.addEventListener('keydown', e=>{
  if(!e.ctrlKey)return;
  if(e.code==='KeyZ'){ e.preventDefault(); e.shiftKey?redoAction():undoAction(); }
  else if(e.code==='KeyY'){ e.preventDefault(); redoAction(); }
});
document.addEventListener('keydown', e=>{
  const tag=(document.activeElement && document.activeElement.tagName || '').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(document.activeElement && document.activeElement.isContentEditable))return;
  const tab=activeTabId();
  if(e.key==='Delete'||e.key==='Backspace'){
    if(tab==='basic' && mainDoc.activeLayer){ e.preventDefault(); mainDoc.deleteActiveLayer(); }
    else if(tab==='animation' && animDoc.activeLayer){ e.preventDefault(); animDoc.deleteActiveLayer(); }
    return;
  }
  if((e.key==='ArrowLeft'||e.key==='ArrowRight') && tab==='animation' && frames.length){
    e.preventDefault();
    const dir=e.key==='ArrowRight'?1:-1;
    const next=Math.max(0,Math.min(frames.length-1,currentFrameIndex+dir));
    if(next!==currentFrameIndex) switchToFrame(next);
  }
});
mainDoc.onCommit=()=>scheduleHistoryPush();
animDoc.onCommit=()=>scheduleHistoryPush();

/* ============================================================
   PROJECT FOLDER (File System Access API) — реальная папка на диске.
   Chrome/Edge only. Та же папка потом будет использоваться редактором
   комнат — оба инструмента читают/пишут одни и те же настоящие файлы,
   а не общий localStorage.
   ============================================================ */
let projectDirHandle=null;
let projectCatalog=[]; // {id,category,name,image(object URL),json} — читается напрямую из подключённой папки

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('uoc_fs',1);
    req.onupgradeneeded=()=>{ req.result.createObjectStore('handles'); };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function idbSet(key,val){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('handles','readwrite');
    tx.objectStore('handles').put(val,key);
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });
}
async function idbGet(key){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('handles','readonly');
    const req=tx.objectStore('handles').get(key);
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}

/* Сканирует data/objects + соответствующие картинки прямо из подключённой папки.
   Вызывается после подключения папки и после каждого сохранения в неё —
   так каталог слева и библиотека в крафте всегда показывают то, что реально на диске. */
/* ============================================================
   СВЯЗЬ С CHARACTER ASSEMBLER — импорт готовых анимаций персонажа
   ============================================================ */
let animSourceMode='MANUAL'; // 'MANUAL' | 'ASSEMBLER'
let linkedCharacter=null; // содержимое data/characters/<id>.json
let availableAssemblerChars=[];
async function scanAssemblerCharacters(){
  availableAssemblerChars=[];
  if(!projectDirHandle){ populateAssemblerCharSelect(); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/characters',false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{ const file=await handle.getFile(); availableAssemblerChars.push(JSON.parse(await file.text())); }catch(e){}
    }
  }catch(e){}
  populateAssemblerCharSelect();
}
function populateAssemblerCharSelect(){
  const sel=document.getElementById('assemblerCharSelect');
  const cur=sel.value;
  sel.innerHTML='<option value="">Выбери персонажа...</option>'+availableAssemblerChars.map(c=>`<option value="${esc(c.id)}">${esc(c.name||c.id)}</option>`).join('');
  if(availableAssemblerChars.find(c=>c.id===cur)) sel.value=cur;
}
async function loadImageFromProjectPath(relPathUnderSprites){
  const spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false);
  const parts=relPathUnderSprites.split('/'); const fileName=parts.pop();
  const subDir=parts.length? await getSubdir(spritesDir,parts.join('/'),false) : spritesDir;
  const fileHandle=await subDir.getFileHandle(fileName);
  const file=await fileHandle.getFile();
  return new Promise((res,reject)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=reject; r.readAsDataURL(file); });
}
async function applyLinkedCharacter(){
  const card=document.getElementById('assemblerCharCard');
  if(!linkedCharacter){ card.innerHTML=''; return; }
  let previewImg='';
  if(linkedCharacter.preview && projectDirHandle){
    try{
      const dataUrl=await loadImageFromProjectPath(linkedCharacter.preview);
      previewImg=`<img src="${dataUrl}" style="width:40px;height:40px;object-fit:contain;image-rendering:pixelated;background:#0d1116;border-radius:4px;vertical-align:middle;margin-right:8px">`;
      if(document.getElementById('asset').dataset.auto!=='0'){
        const im=await new Promise(res=>{ const im2=new Image(); im2.onload=()=>res(im2); im2.src=dataUrl; });
        mainDoc.clear(); mainDoc.addLayerFromImage(im);
      }
    }catch(e){ console.warn('Превью персонажа не найдено на диске:',e); }
  }
  card.innerHTML = previewImg + `<b>${esc(linkedCharacter.name||linkedCharacter.id)}</b> <span class="muted">(id: ${esc(linkedCharacter.id)}, риг: ${esc(linkedCharacter.rig||'—')}, анимаций: ${(linkedCharacter.animations||[]).length})</span>`;
  animations=(linkedCharacter.animations||[]).map(a=>({
    id:a.name, source:'assembled', sourceSheet:a.sheet, sourceCollision:a.collision||null,
    fps:a.fps||8, loop:a.loop!==false, frames:[], refFrameW:a.frame_width||0, refFrameH:a.frame_height||0,
    frameCountMeta:a.frame_count||0
  }));
  currentAnimIndex=-1; frames=[]; currentFrameIndex=-1; currentVisual=null;
  animDoc.clear(); document.getElementById('visualEditor').style.display='none';
  renderVisualList();
  if(window.update)window.update();
}
document.getElementById('animSource').addEventListener('change', async e=>{
  animSourceMode=e.target.value;
  document.getElementById('assemblerPickerField').style.display=animSourceMode==='ASSEMBLER'?'':'none';
  if(animSourceMode==='MANUAL'){
    linkedCharacter=null;
    document.getElementById('assemblerCharSelect').value='';
    document.getElementById('assemblerCharCard').innerHTML='';
    animations=[]; currentAnimIndex=-1; frames=[]; currentFrameIndex=-1; currentVisual=null;
    animDoc.clear(); document.getElementById('visualEditor').style.display='none';
    renderVisualList();
    if(window.update)window.update();
  } else {
    await scanAssemblerCharacters();
  }
});
document.getElementById('btnRefreshAssemblerChars').onclick=()=>scanAssemblerCharacters();
document.getElementById('assemblerCharSelect').addEventListener('change', async e=>{
  linkedCharacter=availableAssemblerChars.find(c=>c.id===e.target.value)||null;
  await applyLinkedCharacter();
});

/* ============================================================
   ПРОВЕРКА ССЫЛОК ПО ВСЕМУ ПРОЕКТУ
   ============================================================ */
async function scanJsonDirRaw(path){
  const out=[];
  try{
    const dir=await getSubdir(projectDirHandle, path, false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{ const file=await handle.getFile(); out.push({name, data:JSON.parse(await file.text())}); }
      catch(e){ out.push({name, data:null, broken:true}); }
    }
  }catch(e){}
  return out;
}
async function runProjectLinkCheck(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  document.getElementById('linkCheckSummary').textContent='Сканирую...';
  document.getElementById('linkCheckList').innerHTML='';
  document.getElementById('linkCheckModal').style.display='flex';

  const problems=[];
  const objList=await scanJsonDirRaw('data/objects');
  const roomList=await scanJsonDirRaw('data/rooms');
  const rigList=await scanJsonDirRaw('data/rigs');
  const charList=await scanJsonDirRaw('data/characters');
  const objects={}; objList.forEach(({name,data,broken})=>{ if(broken){ problems.push(`⚠ Битый JSON: data/objects/${name}`); return; } objects[data.id]=data; });
  const rooms={}; roomList.forEach(({name,data,broken})=>{ if(broken){ problems.push(`⚠ Битый JSON: data/rooms/${name}`); return; } rooms[data.id]=data; });
  const rigs={}; rigList.forEach(({name,data,broken})=>{ if(broken){ problems.push(`⚠ Битый JSON: data/rigs/${name}`); return; } rigs[data.id]=data; });
  const characters={}; charList.forEach(({name,data,broken})=>{ if(broken){ problems.push(`⚠ Битый JSON: data/characters/${name}`); return; } characters[data.id]=data; });

  const partsByRigSlot={};
  try{
    const partsRoot=await getSubdir(projectDirHandle,'data/parts',false);
    for await (const [rigName,rigHandle] of partsRoot.entries()){
      if(rigHandle.kind!=='directory')continue;
      for await (const [slotName,slotHandle] of rigHandle.entries()){
        if(slotHandle.kind!=='directory')continue;
        const key=rigName+'/'+slotName;
        const set=new Set();
        for await (const [fname,fhandle] of slotHandle.entries()){
          if(fhandle.kind==='file' && fname.endsWith('.json')) set.add(fname.replace(/\.json$/,''));
        }
        partsByRigSlot[key]=set;
      }
    }
  }catch(e){}

  objList.forEach(({name,data})=>{
    if(!data)return;
    const who=`Объект «${data.name||data.id}» (${name})`;
    const settings=data.action_settings||{};
    Object.entries(settings).forEach(([aid,s])=>{
      if(s.tool && !objects[s.tool]) problems.push(`${who}: действие ${aid} → инструмент «${s.tool}» не найден`);
      if(s.consume && s.consume.item && !objects[s.consume.item]) problems.push(`${who}: действие ${aid} → расходуемый предмет «${s.consume.item}» не найден`);
      if(s.produce && s.produce.item && !objects[s.produce.item]) problems.push(`${who}: действие ${aid} → выдаваемый предмет «${s.produce.item}» не найден`);
    });
    const pattern=data.crafting && data.crafting.recipe && data.crafting.recipe.pattern;
    if(Array.isArray(pattern)) pattern.flat().forEach(cell=>{ if(cell && cell.id && !objects[cell.id]) problems.push(`${who}: рецепт крафта → ингредиент «${cell.id}» не найден`); });
    if(data.character_ref && data.character_ref.id && !characters[data.character_ref.id]) problems.push(`${who}: ссылается на персонажа Assembler «${data.character_ref.id}», а его нет`);
  });
  roomList.forEach(({name,data})=>{
    if(!data)return;
    const who=`Комната «${data.name||data.id}» (${name})`;
    (data.instances||[]).forEach(inst=>{
      if(inst.objectId && !objects[inst.objectId]) problems.push(`${who}: объект «${inst.objectId}» не найден`);
      if(inst.door && inst.door.toRoom && !rooms[inst.door.toRoom]) problems.push(`${who}: дверь ведёт в несуществующую комнату «${inst.door.toRoom}»`);
    });
  });
  charList.forEach(({name,data})=>{
    if(!data)return;
    const who=`Персонаж Assembler «${data.name||data.id}» (${name})`;
    if(data.rig && !rigs[data.rig]) problems.push(`${who}: риг «${data.rig}» не найден`);
    (data.layers||[]).forEach(l=>{
      const key=(data.rig||'')+'/'+l.slot;
      if(l.part && !(partsByRigSlot[key] && partsByRigSlot[key].has(l.part))) problems.push(`${who}: часть «${l.part}» в слоте «${l.slot}» не найдена`);
    });
  });

  document.getElementById('linkCheckSummary').textContent=`Проверено: объектов ${objList.length}, комнат ${roomList.length}, ригов ${rigList.length}, персонажей ${charList.length}. Найдено проблем: ${problems.length}.`;
  const list=document.getElementById('linkCheckList');
  list.innerHTML = problems.length
    ? ('<ul style="margin:0;padding-left:18px">'+problems.map(p=>`<li style="margin-bottom:4px">${esc(p)}</li>`).join('')+'</ul>')
    : '<div style="color:#7fe9a0">Битых ссылок не найдено ✓</div>';
}
document.getElementById('btnCheckLinks').onclick=runProjectLinkCheck;
document.getElementById('btnCloseLinkCheck').onclick=()=>{ document.getElementById('linkCheckModal').style.display='none'; };

let existingObjectsList=[];
async function refreshAllowedRoomTypesOptions(){
  const sel=document.getElementById('allowedRoomTypes');
  const wasSelected=new Set([...sel.selectedOptions].map(o=>o.value));
  if(!projectDirHandle){ alert('Сначала подключи папку проекта — список берётся из уже сохранённых комнат.'); return; }
  const found=new Set();
  try{
    const dir=await getSubdir(projectDirHandle,'data/rooms',false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{ const file=await handle.getFile(); const data=JSON.parse(await file.text()); if(data.type) found.add(data.type); }catch(e){}
    }
  }catch(e){}
  const existingValues=new Set([...sel.options].map(o=>o.value));
  found.forEach(t=>{ if(!existingValues.has(t)){ const opt=document.createElement('option'); opt.value=t; opt.textContent=t; sel.appendChild(opt); } });
  [...sel.options].forEach(o=>{ o.selected=wasSelected.has(o.value); });
  document.getElementById('folderStatus').textContent='Список типов комнат обновлён — найдено в проекте: '+(found.size||0)+'.';
}
document.getElementById('btnRefreshAllowedRoomTypes').onclick=refreshAllowedRoomTypesOptions;

async function scanExistingObjects(){
  existingObjectsList=[];
  if(!projectDirHandle){ populateOpenObjectSelect(); return; }
  try{
    const dir=await getSubdir(projectDirHandle,'data/objects',false);
    for await(const [name,handle] of dir.entries()){
      if(handle.kind!=='file'||!name.endsWith('.json'))continue;
      const objId=name.replace(/\.json$/,'');
      try{ const data=JSON.parse(await (await handle.getFile()).text()); existingObjectsList.push({id:objId,name:data.name||objId}); }
      catch(e){ existingObjectsList.push({id:objId,name:objId}); }
    }
  }catch(e){}
  populateOpenObjectSelect();
}
function populateOpenObjectSelect(){
  const sel=document.getElementById('openObjectSelect'); if(!sel)return;
  sel.innerHTML='<option value="">— выбери объект —</option>'+existingObjectsList.map(o=>`<option value="${esc(o.id)}">${esc(o.name)} (${esc(o.id)})</option>`).join('');
}
function restoreJsonFields(data){
  const set=(id,v)=>{const e=document.getElementById(id);if(e&&v!==undefined&&v!==null)e.value=v;};
  const check=(id,v)=>{const e=document.getElementById(id);if(e&&v!==undefined)e.checked=!!v;};
  set('id',data.id||''); document.getElementById('id').dataset.auto='0';
  set('name',data.name||''); set('subtype',data.subtype||''); set('description',data.description||''); set('layer',data.transform?.layer??0);
  set('asset',data.appearance?.asset||''); set('visualMode',data.appearance?.mode||'IMAGE');
  if(data.category){currentCategory=data.category;document.querySelectorAll('.cat').forEach(b=>b.classList.toggle('active',b.dataset.cat===currentCategory));set('category',CAT_LABELS[currentCategory]||data.category_name||currentCategory);}
  const b=data.behavior||{};
  check('carryable',b.carryable);check('placeable',b.placeable);set('collision',b.collision||'NONE');set('physics',b.physics||'STATIC');check('interactive',b.interactive);check('hasWeight',b.hasWeight);set('weight',b.weight??1);
  set('realWidthCm',b.real_width_cm??0);set('realHeightCm',b.real_height_cm??0);set('placementMode',b.placement_mode||'ANYWHERE');set('variantGroup',b.variant_group||'');
  const ar=b.allowed_room_types||[]; const sel=document.getElementById('allowedRoomTypes'); if(sel)[...sel.options].forEach(o=>o.selected=ar.includes(o.value));
  const l=b.light;check('emitsLight',!!l);if(l){set('lightRadius',metersFromJSON(l,'radius_m','radius',1.5));set('lightColor',l.color);set('lightIntensity',Math.round((l.intensity??1)*100));set('lightShape',l.shape||'CIRCLE');set('lightAngle',l.angle??90);set('lightSpread',l.spread??60);set('lightSoftness',Math.round((l.softness??.4)*100));}
  const sh=b.shadow;check('castsShadow',!!sh);if(sh)set('shadowAbsorption',Math.round((sh.absorption??.7)*100));
  const n=b.needs||{};check('needFood',n.food);check('needWater',n.water);check('needSleep',n.sleep);check('needHealth',n.health);check('needStress',n.stress);
  const wp=n.water_params||{};check('thirstRandomInit',wp.random_initial);set('thirstInitial',wp.initial??100);set('thirstMin',wp.min_initial??40);set('thirstMax',wp.max_initial??100);set('thirstDecayRate',wp.decay_rate_per_hour??2);set('thirstWantThreshold',wp.want_threshold??40);set('thirstCriticalThreshold',wp.critical_threshold??15);set('thirstDrinkAmount',wp.drink_amount??30);set('thirstDrinkTime',wp.drink_time??4);
  const au=b.autonomy||{};check('autonomyEnabled',au.enabled);check('autonomySatisfyNeeds',au.satisfy_needs);check('autonomySearchWater',au.search_water);check('autonomySearchFood',au.search_food);check('autonomySleep',au.sleep);
  const p=b.perception||{};check('visionEnabled',!!p.vision);if(p.vision)set('visionRange',metersFromJSON(p.vision,'range_m','range',4));check('hearingEnabled',!!p.hearing);if(p.hearing)set('hearingRange',metersFromJSON(p.hearing,'range_m','range',3));
  const mv=b.movement||{};check('canMove',mv.enabled);set('moveSpeed',metersFromJSON(mv,'speed_mps','speed',1));const dg=b.danger||{};check('dangerReacts',dg.reacts);check('dangerCanFlee',dg.can_flee);check('dangerCanHide',dg.can_hide);check('makesSounds',b.makes_sounds);
  const co=data.combat||{};check('dealsDamage',co.dealsDamage);set('damageAmount',co.damageAmount??10);check('providesDefense',co.providesDefense);set('defenseAmount',co.defenseAmount??10);check('wearsOut',co.wearsOut);set('wearAmount',co.wearAmount??1);set('wearLifetimeDays',co.wearLifetimeDays??30);
  const iv=data.inventory||{};check('hasInventory',iv.enabled);set('slots',iv.slots??0);set('maxWeight',iv.maxWeight??0);set('storage',iv.storage||'GENERAL');
  const r=data.resource||{};set('resourceType',r.type||'');set('resourceMax',r.max_amount??100);set('resourceInitial',r.initial_amount??100);set('resourceState',r.initial_state||'чистая');set('resourceSource',r.source||'без пополнения');set('resourceRecoveryHours',r.self_recovery_hours??0);
  const d=data.destruction||{};check('destructible',d.enabled);set('hp',d.hp??100);set('damagedThreshold',d.damaged_threshold_percent??50);set('brokenPath',d.broken?.image||'');set('damagedPath',d.damaged?.image||'');set('destroySheetPath',d.destroyAnimation?.sheet||'');set('destroyFps',d.destroyAnimation?.fps??8);
  check('crafting',data.crafting?.enabled);check('animated',data.animation_enabled!==false);set('tags',(data.tags||[]).join(', '));
  currentActions=data.actions||[]; actionSettings={}; Object.entries(data.action_settings||{}).forEach(([aid,s])=>{actionSettings[aid]={requirements:s.requirements||'',time:s.time||0,tool:s.tool||'',consumeItem:s.consume?.item||'',consumeAmount:s.consume?.amount||0,produceItem:s.produce?.item||'',produceAmount:s.produce?.amount||0,requiredSkill:s.required_skill?.skill||'',requiredSkillLevel:s.required_skill?.level||0,effects:s.effects||[]};}); renderActions();
  currentComponents=Array.isArray(data.components)?JSON.parse(JSON.stringify(data.components)):[];
  customFields=[]; renderCustomFieldList(); set('custom',data.custom&&typeof data.custom==='object'?JSON.stringify(data.custom,null,2):'');
  animations=[];imageStates=[];currentVisual=null;frames=[];currentFrameIndex=-1;idleCreated=!!data.visuals?.idle;
  const vis=data.visuals||{};
  (vis.animations||[]).forEach(a=>animations.push({id:a.name||'animation',fps:a.fps||8,loop:a.loop!==false,frames:[],collisionMode:a.collision||'FULL',collisionPadding:0,sound:{enabled:false,source:'NEW',files:[],mode:'single',volume:80,radius:3},skillProgress:a.skill_progress||[],source:a.source,sourceSheet:a.asset,frameCountMeta:a.frame_count||0}));
  (vis.images||[]).forEach(s=>imageStates.push({id:s.name||'image',doc:null,previewDataUrl:null,width:s.width||0,height:s.height||0,collisionMode:s.collision||'FULL',sourceFrame:s.source_frame||null,asset:s.asset||''}));
  animDoc.clear();
}
async function loadProjectImage(relPath,targetDoc){
  if(!projectDirHandle||!relPath)return false;
  try{
    const root=await getSubdir(projectDirHandle,'assets/sprites',false);const parts=String(relPath).split('/');const fn=parts.pop();const dir=parts.length?await getSubdir(root,parts.join('/'),false):root;
    const file=await(await dir.getFileHandle(fn)).getFile();const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    const im=await new Promise((res,rej)=>{const x=new Image();x.onload=()=>res(x);x.onerror=rej;x.src=url;});targetDoc.clear();targetDoc.addLayerFromImage(im);return true;
  }catch(e){console.warn('Не удалось загрузить asset:',relPath,e);return false;}
}
async function restoreObjectProjectData(data,objId){
  resetIdentityAndImages(); restoreJsonFields(data);
  await loadProjectImage(data.appearance?.asset,mainDoc);
  const vis=data.visuals||{};
  for(const s of imageStates){
    const path=s.asset||imageStateAssetPath(s.id);
    if(!path)continue;
    try{
      const ok=await loadProjectImage(path,scratchDoc);
      if(ok){
        s.doc=await scratchDoc.serialize();
        s.width=s.doc.docW||0;s.height=s.doc.docH||0;
        s.previewDataUrl=scratchDoc.flatten()?.toDataURL()||null;
      }
    }catch(e){console.warn('Не удалось загрузить visual image:',path,e);}
  }
  for(const a of animations){
    if(!a.sourceSheet||!a.frameCountMeta)continue;
    const ok=await loadProjectImage(a.sourceSheet,animDoc); if(!ok)continue;
    const flat=animDoc.flatten();const count=Math.max(1,a.frameCountMeta);const fw=Math.floor(flat.width/count);if(fw<1)continue;
    const out=[];for(let i=0;i<count;i++){const piece=document.createElement('canvas');piece.width=fw;piece.height=flat.height;piece.getContext('2d').drawImage(flat,i*fw,0,fw,flat.height,0,0,fw,flat.height);scratchDoc.clear();const im=await new Promise(res=>{const x=new Image();x.onload=()=>res(x);x.src=piece.toDataURL();});scratchDoc.addLayerFromImage(im);out.push(await scratchDoc.serialize());}a.frames=out;
  }
  renderVisualList();if(animations.length)await selectVisual('animation',animations[0].id);else if(imageStates.length)await selectVisual('image',imageStates[0].id);
}
async function openObjectFromProject(objId){
  if(!projectDirHandle)return;
  try{
    const sessDir=await getSubdir(projectDirHandle,'data/objects/.sessions',false).catch(()=>null);
    if(sessDir){
      try{
        const file=await (await sessDir.getFileHandle(objId+'.json')).getFile();
        const state=JSON.parse(await file.text()); await restoreSessionState(state);
        document.getElementById('folderStatus').textContent='Открыт «'+val('name')+'» — рабочий снимок восстановлен.';
        return;
      }catch(e){}
    }
    const objDir=await getSubdir(projectDirHandle,'data/objects',false);
    const file=await (await objDir.getFileHandle(objId+'.json')).getFile();
    const data=JSON.parse(await file.text());
    await restoreObjectProjectData(data,objId);
    if(window.update)window.update();
    document.getElementById('folderStatus').textContent='Открыт «'+(data.name||objId)+'» — JSON восстановлен в редактор.';
  }catch(e){console.error(e);alert('Не удалось открыть объект: '+e.message);}
}
document.getElementById('btnOpenObject').onclick=()=>{
  const objId=document.getElementById('openObjectSelect').value;
  if(!objId)return alert('Выбери объект из списка.');
  openObjectFromProject(objId);
};

/* ---- превью объектов каталога ----
   Порядок поиска картинки: основная → статичное состояние → первый кадр анимации (idle, иначе первая).
   Файл читается и проверяется на «декодируемость» — пустой/битый PNG даёт заглушку, а не битую иконку. */
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
    const k=Math.min(1,96/Math.max(fw,fh));
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(fw*k)); c.height=Math.max(1,Math.round(fh*k));
    const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.drawImage(img,0,0,fw,fh,0,0,c.width,c.height);
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
      }catch(e){ console.warn('Пропущен повреждённый файл каталога:',name,e); }
    }
  }catch(e){ /* data/objects ещё не существует — каталог пуст, это нормально для новой папки */ }
  projectCatalog=result;
  renderCatalogSidebar();
}

function updateFolderStatus(needsRegrant){
  const el=document.getElementById('folderStatus');
  if(!projectDirHandle){ el.textContent='Папка не подключена'; document.getElementById('btnRegrantFolder').style.display='none'; return; }
  el.textContent = needsRegrant ? ('Папка: '+projectDirHandle.name+' (нужно разрешение)') : ('Папка: '+projectDirHandle.name+' ✓');
  document.getElementById('btnRegrantFolder').style.display = needsRegrant?'':'none';
}
async function connectProjectFolder(){
  if(!('showDirectoryPicker' in window)){ alert('Эта функция работает только в Chrome/Edge.'); return; }
  try{
    const handle=await window.showDirectoryPicker({mode:'readwrite'});
    projectDirHandle=handle;
    await idbSet('projectDir',handle);
    updateFolderStatus();
    await scanProjectFolderCatalog();
  }catch(e){ if(e.name!=='AbortError') console.warn(e); }
}
async function tryRestoreProjectFolder(){
  try{
    const handle=await idbGet('projectDir');
    if(!handle)return;
    const perm=await handle.queryPermission({mode:'readwrite'});
    projectDirHandle=handle;
    updateFolderStatus(perm!=='granted');
    if(perm==='granted') await scanProjectFolderCatalog();
  }catch(e){ console.warn('Не удалось восстановить папку проекта:',e); }
}
async function regrantProjectFolder(){
  if(!projectDirHandle)return;
  try{ const perm=await projectDirHandle.requestPermission({mode:'readwrite'}); if(perm==='granted'){ updateFolderStatus(); await scanProjectFolderCatalog(); } }
  catch(e){ console.warn(e); }
}
async function getSubdir(root,pathStr,create){
  let dir=root;
  for(const p of pathStr.split('/').filter(Boolean)) dir=await dir.getDirectoryHandle(p,{create:!!create});
  return dir;
}
async function writeFileToProject(relPath,bytes){
  if(!projectDirHandle)return false;
  const parts=relPath.split('/'); const fileName=parts.pop();
  const dir=parts.length ? await getSubdir(projectDirHandle,parts.join('/'),true) : projectDirHandle;
  const fileHandle=await dir.getFileHandle(fileName,{create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
  return true;
}
async function saveToProjectFolder(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта (кнопка слева от этой).'); return; }
  const base=sanitizeSlug(id())||'object';
  const existing=projectCatalog.find(e=>e.id===base);
  if(existing && existing.name && existing.name!==val('name')){
    const proceed=confirm(`Внимание: объект с id "${base}" уже есть в каталоге и называется «${existing.name}», а у тебя сейчас «${val('name')||'без названия'}».\n\nЭто разные объекты со случайно совпавшим id? Если продолжишь — файл того, старого объекта будет ПЕРЕЗАПИСАН.\n\nПродолжить и перезаписать?`);
    if(!proceed) return;
  }
  await addCurrentToCatalog();
  autofillPaths();
  const assetRel=val('asset')||(base+'.png');
  const brokenRel=val('brokenPath')||(base+'_broken.png');
  const destroyRel=val('destroySheetPath')||(base+'_broken_anim.png');
  const damagedRel=val('damagedPath')||(base+'_damaged.png');
  try{
    if(mainDoc.docW) await writeFileToProject('assets/sprites/'+assetRel, await dataURLToBytes(mainDoc.flatten().toDataURL('image/png')));
    if(brokenW) await writeFileToProject('assets/sprites/'+brokenRel, await dataURLToBytes(brokenCanvas.toDataURL('image/png')));
    if(damagedW) await writeFileToProject('assets/sprites/'+damagedRel, await dataURLToBytes(damagedCanvas.toDataURL('image/png')));
    await commitCurrentFrame();
    for(const a of animations){
      if(a.source==='assembled' || !a.frames.length)continue;
      const sheet=await buildAnimSheetCanvas(a.frames);
      await writeFileToProject('assets/sprites/'+animSheetPathFor(a.id), await dataURLToBytes(sheet.toDataURL('image/png')));
    }
    for(const s of imageStates){
      if(!s.doc)continue;
      await scratchDoc.restore(s.doc);
      const flat=scratchDoc.flatten();
      await writeFileToProject('assets/sprites/'+imageStateAssetPath(s.id), await dataURLToBytes(flat.toDataURL('image/png')));
    }
    for(const a of animations){
      if(!a.sound || a.sound.source==='EXISTING' || !a.sound.files || !a.sound.files.length)continue;
      for(let idx=0; idx<a.sound.files.length; idx++){
        const f=a.sound.files[idx];
        await writeFileToProject('assets/sounds/'+animSoundPathFor(a.id,idx,f.name), await dataURLToBytes(f.dataUrl));
      }
    }
    if(destroyFrames.length){ const dsheet=await buildDestroySheetCanvas(); await writeFileToProject('assets/sprites/'+destroyRel, await dataURLToBytes(dsheet.toDataURL('image/png'))); }
    await writeFileToProject('data/objects/'+base+'.json', new TextEncoder().encode(JSON.stringify(collect(),null,2)));
    if(craftRecipe && craftRecipe.recipeImage && craftRecipeImageDataUrl) await writeFileToProject('assets/sprites/'+craftRecipe.recipeImage, await dataURLToBytes(craftRecipeImageDataUrl));
    await scanProjectFolderCatalog();
    document.getElementById('folderStatus').textContent='Папка: '+projectDirHandle.name+' ✓ · сохранено '+new Date().toLocaleTimeString();
  }catch(e){
    console.error(e);
    alert('Не удалось сохранить в папку: '+e.message+'\nПопробуй «Разрешить доступ» и повтори.');
  }
}
document.getElementById('btnConnectFolder').onclick=connectProjectFolder;
document.getElementById('btnRegrantFolder').onclick=regrantProjectFolder;
document.getElementById('btnSaveToFolder').onclick=saveToProjectFolder;
document.getElementById('btnRefreshCatalog').onclick=()=>{ if(projectDirHandle) scanProjectFolderCatalog(); else renderCatalogSidebar(); };
const __scanProjectFolderCatalog=scanProjectFolderCatalog;
scanProjectFolderCatalog=async function(){
  await __scanProjectFolderCatalog();
  await scanPreviewBackgrounds();
  await scanExistingObjects();
  if(typeof scanProjectVisualNames==='function') await scanProjectVisualNames();
};

tryRestoreProjectFolder();

/* ============================================================
   INIT
   ============================================================ */
makeSlider('hp',{min:0,max:500,step:1});
makeSlider('damageAmount',{min:0,max:100,step:1});
makeSlider('defenseAmount',{min:0,max:100,step:1});
makeSlider('wearAmount',{min:0,max:20,step:1});
makeSlider('wearLifetimeDays',{min:0,max:100,step:1,unit:'дн.'});
makeSlider('weight',{min:0,max:100,step:0.5,unit:'кг'});
makeSlider('slots',{min:0,max:100,step:1});
makeSlider('maxWeight',{min:0,max:1000,step:1,unit:'кг'});
makeSlider('lightRadius',{min:0,max:20,step:0.1,unit:'м'});
makeSlider('lightIntensity',{min:0,max:200,step:1,unit:'%'});
makeSlider('lightAngle',{min:-180,max:180,step:1,unit:'°'});
makeSlider('lightSpread',{min:1,max:180,step:1,unit:'°'});
makeSlider('lightSoftness',{min:0,max:100,step:1,unit:'%'});
makeSlider('shadowAbsorption',{min:0,max:100,step:1,unit:'%'});
makeSlider('thirstInitial',{min:0,max:100,step:1});
makeSlider('thirstMin',{min:0,max:100,step:1});
makeSlider('thirstMax',{min:0,max:100,step:1});
makeSlider('thirstDecayRate',{min:0,max:20,step:0.5});
makeSlider('thirstWantThreshold',{min:0,max:100,step:1});
makeSlider('thirstCriticalThreshold',{min:0,max:100,step:1});
makeSlider('thirstDrinkAmount',{min:0,max:100,step:1});
makeSlider('thirstDrinkTime',{min:0,max:60,step:1,unit:'сек'});
makeSlider('visionRange',{min:0,max:20,step:0.1,unit:'м'});
makeSlider('hearingRange',{min:0,max:20,step:0.1,unit:'м'});
makeSlider('moveSpeed',{min:0,max:5,step:0.1,unit:'м/с'});
['realWidthCm','realHeightCm'].forEach(id=>{
  document.getElementById(id).addEventListener('change', e=>{ e.target.value=Math.round((+e.target.value||0)/10)*10; if(window.update)window.update(); });
});
makeSlider('animSoundVolume',{min:0,max:100,step:1,unit:'%'});
makeSlider('animSoundRadius',{min:0,max:20,step:0.1,unit:'м'});
document.getElementById('category').value=CAT_LABELS[currentCategory];
renderStdAnimSelect();
renderActions();
resetAllToDefaults();
renderPresetSelect();
renderCatalogSidebar();
update();
doPushHistory();
