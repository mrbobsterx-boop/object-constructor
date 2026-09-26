/* ============================================================
   MODULE 04 — ИНСПЕКТОР ВЫБРАННОГО УЗЛА (правая панель)
   Поля редактируются по «пути» (data-path, точечная нотация типа "choices.0.effects.1.value") —
   один универсальный обработчик вместо отдельного кода на каждое поле. input — лёгкое обновление без
   истории и перерисовки (не терять фокус на каждую букву); change (blur/выбор) — коммит в историю и
   полная перерисовка (заголовки узлов и выпадающие списки могли устареть).
   ============================================================ */

function getByPath(obj,path){ return path.split('.').reduce((o,p)=>(o==null?undefined:o[p]),obj); }
function setByPath(obj,path,value){
  const parts=path.split('.'), last=parts.pop();
  const target=parts.reduce((o,p)=>o[p],obj);
  target[last]=value;
}
function changeTriggerKind(n,kind){
  if(kind==='start') n.trigger={kind:'start'};
  else if(kind==='scheduled') n.trigger={kind:'scheduled',afterHours:24,sinceNode:'',repeat:false};
  else n.trigger={kind:'conditions',all:[]};
}

function condRowsHtml(basePath,list,isEffects){
  const ops=isEffects?[['set','='],['add','+'],['subtract','−']]:OP_LIST;
  const rows=list.map((row,i)=>`
    <div class="row" style="margin-bottom:4px">
      <select data-path="${basePath}.${i}.var">${variables.map(v=>`<option value="${esc(v.id)}" ${row.var===v.id?'selected':''}>${esc(v.name)}</option>`).join('')||'<option value="">(нет переменных)</option>'}</select>
      <select data-path="${basePath}.${i}.op">${ops.map(([id,label])=>`<option value="${id}" ${row.op===id?'selected':''}>${label}</option>`).join('')}</select>
      <input type="number" data-path="${basePath}.${i}.value" value="${row.value}" style="width:64px">
      <button class="del-x" data-delrow="${basePath}.${i}">✕</button>
    </div>`).join('');
  return rows+`<button data-addrow="${basePath}">+ ${isEffects?'эффект':'условие'}</button>`;
}

function choiceCardHtml(c,i){
  return `<div class="choice-card">
    <div class="row">
      <input type="text" data-path="choices.${i}.label" value="${esc(c.label)}" style="flex:1" placeholder="Текст выбора">
      <select data-path="choices.${i}.target"><option value="">— куда —</option>${nodes.map(x=>`<option value="${esc(x.id)}" ${c.target===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select>
      <button class="del-x" data-delchoice="${i}">✕</button>
    </div>
    <div class="sub">
      <label class="small">Требуется</label>
      ${condRowsHtml('choices.'+i+'.requires',c.requires,false)}
      <label class="small" style="margin-top:6px">Меняет (в дополнение к эффектам узла)</label>
      ${condRowsHtml('choices.'+i+'.effects',c.effects,true)}
    </div>
  </div>`;
}

function renderInspector(){
  const el=document.getElementById('inspector');
  const n=findNode(selectedNodeId);
  if(!n){ el.innerHTML='<div class="hint">Выбери узел на холсте или в списке слева, чтобы редактировать его.</div>'; return; }
  el.innerHTML=`
    <div class="group">
      <h3>Узел</h3>
      <label class="small">Название</label>
      <input type="text" class="full" data-path="title" value="${esc(n.title)}">
      <label class="small" style="margin-top:6px">Текст (что видит игрок)</label>
      <textarea data-path="text">${esc(n.text)}</textarea>
      <div class="row" style="margin-top:6px">
        <div><label class="small">Тип (для цвета на холсте)</label>
          <select data-path="type">
            <option value="event" ${n.type==='event'?'selected':''}>событие</option>
            <option value="choice" ${n.type==='choice'?'selected':''}>выбор</option>
            <option value="background" ${n.type==='background'?'selected':''}>фоновое</option>
          </select>
        </div>
        <div><label class="small">Концовка (если это финал)</label>
          <input type="text" data-path="ending" value="${esc(n.ending)}" placeholder="напр. death, victory"></div>
      </div>
    </div>

    <div class="group">
      <h3>Когда доступен</h3>
      <select id="triggerKind">
        <option value="start" ${n.trigger.kind==='start'?'selected':''}>▶ Старт (доступен сразу)</option>
        <option value="conditions" ${n.trigger.kind==='conditions'?'selected':''}>⚑ По условиям</option>
        <option value="scheduled" ${n.trigger.kind==='scheduled'?'selected':''}>⏱ Фоновое, по таймеру (не зависит от игрока)</option>
      </select>
      ${n.trigger.kind==='conditions'?`<div style="margin-top:8px">${condRowsHtml('trigger.all',n.trigger.all,false)}</div>`:''}
      ${n.trigger.kind==='scheduled'?`
        <div class="row" style="margin-top:8px">
          <div><label class="small">Через часов</label><input type="number" data-path="trigger.afterHours" value="${num(n.trigger.afterHours)}" style="width:80px"></div>
          <div><label class="small">Отсчитывать от узла</label>
            <select data-path="trigger.sinceNode"><option value="">— начало игры —</option>${nodes.map(x=>`<option value="${esc(x.id)}" ${n.trigger.sinceNode===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select>
          </div>
          <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-path="trigger.repeat" data-kind="bool" ${n.trigger.repeat?'checked':''}> повторять</label>
        </div>
        <div class="hint">Срабатывает само по игровому таймеру, даже если игрок ничего не делал — так мир живёт независимо от него.</div>`:''}
    </div>

    <div class="group">
      <h3>Что меняет при срабатывании узла</h3>
      ${condRowsHtml('effects',n.effects,true)}
    </div>

    <div class="group">
      <h3>Параметры для бота-симулятора</h3>
      <div class="row">
        <div><label class="small">Длительность (игр. часы)</label><input type="number" data-path="sim.durationHours" value="${num(n.sim.durationHours)}" style="width:70px"></div>
        <div><label class="small">Шанс опасности (0…1)</label><input type="number" step="0.05" data-path="sim.dangerChance" value="${num(n.sim.dangerChance)}" style="width:70px"></div>
        <div><label class="small">Расход еды</label><input type="number" data-path="sim.foodCost" value="${num(n.sim.foodCost)}" style="width:70px"></div>
        <div><label class="small">Расход воды</label><input type="number" data-path="sim.waterCost" value="${num(n.sim.waterCost)}" style="width:70px"></div>
      </div>
      <div class="hint">Отрицательное число в расходе еды/воды — узел или переход их, наоборот, восполняет (например, «поесть» или «попить»).</div>
      <label class="small">Нужны предметы (через запятую)</label><input type="text" class="full" data-path="sim.requiresItems" value="${esc(n.sim.requiresItems)}">
      <label class="small" style="margin-top:6px">Нужны навыки (через запятую)</label><input type="text" class="full" data-path="sim.requiresSkills" value="${esc(n.sim.requiresSkills)}">
    </div>

    <div class="group">
      <h3>Переходы (${n.choices.length})</h3>
      ${n.choices.map((c,i)=>choiceCardHtml(c,i)).join('')||'<div class="hint">Нет переходов — потяни за кружок на холсте на другой узел, или добавь вручную.</div>'}
      <button class="full" id="btnAddChoiceHere" style="margin-top:6px">+ добавить переход</button>
    </div>

    <button class="full danger" id="btnDeleteNode">🗑 Удалить узел</button>
  `;
}

const inspectorEl=document.getElementById('inspector');
inspectorEl.addEventListener('input',e=>{
  const path=e.target.dataset.path; if(!path) return;
  const n=findNode(selectedNodeId); if(!n) return;
  let val=e.target.value;
  if(e.target.type==='number') val=num(val);
  setByPath(n,path,val);
});
inspectorEl.addEventListener('change',e=>{
  const n=findNode(selectedNodeId); if(!n) return;
  if(e.target.id==='triggerKind'){ changeTriggerKind(n,e.target.value); pushHistory(); renderAll(); return; }
  const path=e.target.dataset.path;
  if(path){
    if(e.target.dataset.kind==='bool') setByPath(n,path,e.target.checked);
    pushHistory(); renderAll();
  }
});
inspectorEl.addEventListener('click',e=>{
  const n=findNode(selectedNodeId); if(!n) return;
  const addRow=e.target.closest('[data-addrow]');
  if(addRow){
    const path=addRow.dataset.addrow, arr=getByPath(n,path);
    if(path.endsWith('effects')) addEffRow(arr); else addCondRow(arr);
    pushHistory(); renderAll(); return;
  }
  const delRow=e.target.closest('[data-delrow]');
  if(delRow){
    const path=delRow.dataset.delrow, idx=path.lastIndexOf('.');
    const arr=getByPath(n,path.slice(0,idx));
    arr.splice(Number(path.slice(idx+1)),1);
    pushHistory(); renderAll(); return;
  }
  const delChoice=e.target.closest('[data-delchoice]');
  if(delChoice){ deleteChoice(n.id,n.choices[Number(delChoice.dataset.delchoice)].id); return; }
  if(e.target.id==='btnAddChoiceHere'){ addChoice(n.id,''); return; }
  if(e.target.id==='btnDeleteNode'){ if(confirm('Удалить узел? Ссылки на него из других переходов тоже уберутся.')) deleteNode(n.id); return; }
});
