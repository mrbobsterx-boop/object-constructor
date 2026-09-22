/* ============================================================
   MODULE 18 — VIEW: СВЕРКА С ПРОЕКТОМ
   Настройки (папка сцен Godot) и сводка последнего скана: что нашлось, чего не хватает —
   по всем четырём авторским каталогам и по сценам.
   ============================================================ */

function renderProjectBody(){
  if(!PROJECT.scanned){
    return `<div class="empty">Подключи папку проекта и нажми «🔄 Сверить с проектом».<br>Читаются: <code>data/rooms</code>, <code>data/buildings</code>, <code>project.godot</code> (автозагрузки) и файлы <code>*.tscn</code> в папке сцен, плюс существование файла по <code>path</code> у каждого элемента Систем/Компонентов/Игровых объектов/Данных.</div>`;
  }
  const warns=[];
  if(PROJECT.godotMissing) warns.push('Файл <code>project.godot</code> не найден в корне подключённой папки — шаг «Autoload» ни у одной системы не определится автоматически.');
  if(PROJECT.roomsMissing) warns.push('Папки <code>data/rooms</code> нет — комнаты не читаются.');
  if(PROJECT.buildingsMissing) warns.push('Папки <code>data/buildings</code> нет — здания не читаются.');

  const catStats=['system','component','gameobject','data'].map(kind=>{
    const list=catalogList(kind).filter(i=>i.path);
    const found=list.filter(i=>PROJECT.pathsOk.get(i.key)===true).length;
    return {kind,label:CATALOGS[kind].label,found,total:list.length};
  });
  const autoloadWanted=SYSTEMS.filter(s=>s.autoload);
  const autoloadFound=autoloadWanted.filter(s=>autoStepDone(s,'autoload')).length;

  const roomsFound=SCENES.filter(s=>s.kind==='room'&&PROJECT.tscnById.has(s.id)).length;
  const roomsTotal=SCENES.filter(s=>s.kind==='room').length;
  const bldFound=SCENES.filter(s=>s.kind==='building'&&PROJECT.tscnById.has(s.id)).length;
  const bldTotal=SCENES.filter(s=>s.kind==='building').length;

  const statCards=catStats.map(s=>`<div class="stat"><div class="n">${s.found}/${s.total}</div><div class="t">${esc(s.label)}: файл найден</div></div>`).join('');

  const missingRoomRows=SCENES.filter(s=>s.kind==='room'&&!PROJECT.tscnById.has(s.id)).map(s=>`<div class="reqrow"><span class="nm">${lnk(s.key)}</span><span class="muted small">${esc(s.sourceFile)}</span></div>`).join('')||'<div class="muted">Все найдены.</div>';
  const missingBldRows=SCENES.filter(s=>s.kind==='building'&&!PROJECT.tscnById.has(s.id)).map(s=>`<div class="reqrow"><span class="nm">${lnk(s.key)}</span><span class="muted small">${esc(s.sourceFile)}</span></div>`).join('')||'<div class="muted">Все найдены.</div>';
  const extraRows=PROJECT.tscnExtra.map(p=>`<div class="reqrow"><span class="nm"><code>${esc(p)}</code></span></div>`).join('')||'<div class="muted">Нет лишних .tscn (без совпадения по id).</div>';
  const missingPathRows=['system','component','gameobject','data'].flatMap(kind=>
    catalogList(kind).filter(i=>i.path&&!PROJECT.pathsOk.get(i.key)).map(i=>`<div class="reqrow"><span class="nm">${kindTag(i.kind)}${lnk(i.key)}</span><span class="muted small"><code>${esc(i.path)}</code></span></div>`)
  ).join('')||'<div class="muted">У всех элементов файл на месте.</div>';
  const missingAutoloadRows=autoloadWanted.filter(s=>!autoStepDone(s,'autoload')).map(s=>`<div class="reqrow"><span class="nm">${lnk(s.key)}</span><span class="muted small">ожидался autoload «${esc(s.autoload)}»</span></div>`).join('')||'<div class="muted">Все ожидаемые автозагрузки на месте.</div>';

  return `
    ${warns.length?warns.map(w=>`<div class="problem warn">${w}</div>`).join(''):''}
    <div class="statgrid wide">
      ${statCards}
      <div class="stat"><div class="n">${autoloadFound}/${autoloadWanted.length}</div><div class="t">Автозагрузки Godot найдены</div></div>
      <div class="stat"><div class="n">${roomsFound}/${roomsTotal}</div><div class="t">.tscn комнат найдены</div></div>
      <div class="stat"><div class="n">${bldFound}/${bldTotal}</div><div class="t">.tscn зданий найдены</div></div>
    </div>
    <div class="two" style="margin-top:12px">
      <div class="card"><div class="cardhead"><b>Комнаты без .tscn</b></div><div class="cardbody">${missingRoomRows}</div></div>
      <div class="card"><div class="cardhead"><b>Здания без .tscn</b></div><div class="cardbody">${missingBldRows}</div></div>
    </div>
    <div class="two">
      <div class="card"><div class="cardhead"><b>Элементы чертежа без файла по указанному пути</b></div><div class="cardbody">${missingPathRows}</div></div>
      <div class="card"><div class="cardhead"><b>Системы без ожидаемой автозагрузки</b></div><div class="cardbody">${missingAutoloadRows}</div></div>
    </div>
    <div class="card"><div class="cardhead"><b>.tscn в папке сцен без совпадения по id (не room/building)</b></div><div class="cardbody">${extraRows}</div></div>
  `;
}
VIEW_RENDERERS.project=function(){
  return `<div class="toolbar"><h2>Сверка с проектом</h2><button data-act="scan">🔄 Пересканировать</button></div>
    <div class="card"><div class="cardhead"><b>Настройки</b></div><div class="cardbody">
      <label>Папка сцен Godot (внутри той же папки проекта; ищется рекурсивно по имени файла)</label>
      <input data-settings="scenesRoot" value="${esc(store.settings.scenesRoot||'scenes')}" placeholder="scenes" style="width:260px">
      <p class="muted" style="margin-top:8px">Сцена комнаты <code>kitchen_01</code> считается найденной, если где-то в этой папке есть файл <code>kitchen_01.tscn</code> — так же, как Object Plan ищет <code>data/objects/&lt;id&gt;.json</code>.</p>
    </div></div>
    <div id="projectBody">${renderProjectBody()}</div>`;
};
