/* ============================================================
   MODULE 19 — VIEW: СПРАВОЧНИКИ, ПРОВЕРКИ ЧЕРТЕЖА, СВОИ ЭЛЕМЕНТЫ
   ============================================================ */

function dictionaryGroupsTable(kind){
  const rows=groupsOf(kind).map(g=>{
    const items=catalogList(kind).filter(i=>i.g===g.id);
    return `<tr class="click" data-act="filter" data-view="${kind==='system'?'systems':kind==='gameobject'?'gameobjects':kind==='component'?'components':'data'}" data-which="${kind}" data-fk="g" data-fv="${esc(g.id)}">
      <td><b>${esc(groupHeading(kind,g))}</b></td><td>${items.length}</td><td class="muted">${esc(g.desc||'')}</td></tr>`;
  }).join('');
  return `<div class="card"><div class="cardhead"><b>${esc(CATALOGS[kind].label)} — разделы</b></div><div class="cardbody" style="padding:0">
    ${table(['Раздел','Элементов','Описание'],[rows])}
  </div></div>`;
}
function stepDefsCard(defs,label){
  return `<div class="card"><div class="cardhead"><b>${label}</b></div><div class="cardbody">
    ${defs.map(s=>`<div class="reqrow"><span class="nm"><code>${esc(s.id)}</code> — ${esc(s.label)}</span></div>`).join('')}
  </div></div>`;
}
function dictionariesBlock(){
  return `
    <div class="two">${dictionaryGroupsTable('system')}${dictionaryGroupsTable('component')}</div>
    <div class="two">${dictionaryGroupsTable('gameobject')}${dictionaryGroupsTable('data')}</div>
    <div class="two">${stepDefsCard(SYS_STEP_DEFS,'Шаги готовности: Система')}${stepDefsCard(COMP_STEP_DEFS,'Шаги готовности: Компонент')}</div>
    <div class="two">${stepDefsCard(OBJ_STEP_DEFS,'Шаги готовности: Игровой объект')}${stepDefsCard(DATA_STEP_DEFS,'Шаги готовности: Домен данных')}</div>
    <div class="two">${stepDefsCard(ROOM_STEP_DEFS,'Шаги готовности: Сцена-комната')}${stepDefsCard(BUILDING_STEP_DEFS,'Шаги готовности: Сцена-здание/улица')}</div>
  `;
}

function checksBlock(){
  const lvl={err:'Ошибки',warn:'Предупреждения',info:'К сведению'};
  const rows=['err','warn','info'].map(level=>{
    const list=PLAN_PROBLEMS.filter(p=>p.level===level);
    if(!list.length) return '';
    return `<div class="card"><div class="cardhead"><b>${lvl[level]} (${list.length})</b></div><div class="cardbody">
      ${list.map(p=>`<div class="problem ${level}"><b>${esc(p.code)}</b> — ${itemByKey(p.id)?lnk(p.id):esc(p.id)}: ${esc(p.msg)}</div>`).join('')}
    </div></div>`;
  }).join('');
  return rows||'<div class="empty">Проблем в каталогах не найдено.</div>';
}

function customItemsBlock(){
  const groupOptions=Object.keys(CATALOGS).flatMap(kind=>
    groupsOf(kind).map(g=>`<option value="${esc(kind)}|${esc(g.id)}">${esc(CATALOGS[kind].label)} — ${esc(groupHeading(kind,g))}</option>`)
  ).join('');
  const list=[...BY_KEY.values()].filter(i=>i.custom);
  const rows=list.length?list.map(i=>`<div class="reqrow"><span class="nm">${kindTag(i.kind)}${lnk(i.key)}</span>${statusBadge(i)}<button data-act="remove-custom" data-kind="${esc(i.kind)}" data-id="${esc(i.id)}">🗑</button></div>`).join(''):'<div class="muted">Своих элементов пока нет.</div>';
  return `<div class="card"><div class="cardhead"><b>Добавить свой элемент</b></div><div class="cardbody">
    <form id="customItemForm" class="row" style="align-items:flex-end">
      <div><label>id (a-z0-9_-)</label><input name="cid" required style="width:160px"></div>
      <div><label>Название</label><input name="cn" required style="width:200px"></div>
      <div><label>Каталог и раздел</label><select name="cgroup">${groupOptions}</select></div>
      <div><label>Приоритет</label><select name="cp">${PRIORITIES.map(p=>`<option value="${p.id}">${p.label}</option>`).join('')}</select></div>
      <div><label>Путь файла</label><input name="cpath" placeholder="res://…" style="width:200px"></div>
      <button type="submit" class="primary">+ Добавить</button>
    </form>
    <div style="margin-top:10px">${rows}</div>
  </div></div>`;
}

VIEW_RENDERERS.reference=function(){
  return `<div class="toolbar"><h2>Справочники и проверки</h2></div>
    ${dictionariesBlock()}
    <h3 style="margin:18px 0 8px">Проверки каталогов</h3>
    ${checksBlock()}
    <h3 style="margin:18px 0 8px">Свои элементы</h3>
    ${customItemsBlock()}`;
};
document.addEventListener('submit',e=>{
  // e.target.id не годится для проверки формы: именованный элемент формы может затенить id самой формы.
  if(!e.target.matches || !e.target.matches('#customItemForm')) return;
  e.preventDefault();
  const f=new FormData(e.target);
  const id=String(f.get('cid')||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
  if(!id) return;
  const [kind,group]=String(f.get('cgroup')||'').split('|');
  if(!kind||!CATALOGS[kind]) return;
  addCustomItem(kind,{id,n:f.get('cn')||id,g:group,p:Number(f.get('cp')||1),path:f.get('cpath')||'',why:'',fn:'',req:[],reads:[],autoload:null,blocksScenes:false});
  rerender();
});
