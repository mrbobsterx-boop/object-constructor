/* ============================================================
   MODULE 06 — VIEW: OVERVIEW
   Сводка по проекту: счётчики, здоровье проекта, объекты по категориям, типы комнат, настройки.
   ============================================================ */

VIEW_RENDERERS.overview=function(){
  const R=registry, lvl={err:0,warn:0,info:0}; R.problems.forEach(p=>lvl[p.level]++);
  const blocks=R.objects.filter(o=>o.category==='block').length;
  const blockCells=R.rooms.reduce((s,r)=>s+r.blockCount,0);
  const orph=orphanFiles();
  const unusedObj=R.objects.filter(o=>!objectIsUsed(o)).length, unusedRooms=R.rooms.filter(r=>!roomIsUsed(r)).length;
  const stat=(n,t,view)=>`<div class="stat${view?' click':''}"${view?` data-act="view" data-view="${view}"`:''}><div class="n">${fmt(n)}</div><div class="t">${t}</div></div>`;

  const health=`<div class="problem ${lvl.err?'err':''}"><span class="${lvl.err?'err':'ok'}">${lvl.err?'✕':'✓'}</span> ${lvl.err?`Ошибок, требующих внимания: <b>${lvl.err}</b> — ${chipLink('problems','level','err','показать')}`:'Битых ссылок и нечитаемых файлов нет'}</div>
    <div class="problem ${lvl.warn?'warn':''}"><span class="${lvl.warn?'warn':'ok'}">${lvl.warn?'!':'✓'}</span> ${lvl.warn?`Предупреждений: <b>${lvl.warn}</b> — ${chipLink('problems','level','warn','показать')}`:'Предупреждений нет'}</div>
    <div class="problem ${lvl.info?'info':''}"><span class="${lvl.info?'info':'ok'}">i</span> К сведению: <b>${lvl.info}</b>${lvl.info?' — '+chipLink('problems','level','info','показать'):''}</div>`;

  const cats=[...dict.categories.values()].sort((a,b)=>b.count-a.count), maxC=Math.max(1,...cats.map(c=>c.count));
  const catRows=cats.map(c=>`<tr class="click" data-act="filter" data-view="objects" data-fk="category" data-fv="${esc(c.id)}"><td>${esc(c.name)} <span class="muted">${esc(c.id)}</span></td><td style="width:60px">${fmt(c.count)}</td><td style="width:40%"><div class="bar"><i style="width:${Math.round(c.count/maxC*100)}%"></i></div></td></tr>`);

  const types=[...dict.roomTypes.values()].sort((a,b)=>b.rooms.length-a.rooms.length);
  const typeRows=types.map(t=>`<tr class="click" data-act="filter" data-view="rooms" data-fk="type" data-fv="${esc(t.type)}"><td>${esc(t.type)}</td><td>${fmt(t.rooms.length)}</td><td>${fmt(t.allowedBy.length)}</td><td>${t.recipeRows?fmt(t.recipeRows)+' строк':'—'}</td></tr>`);

  const S=R.settings||{};
  const settings=kv([
    ['data/project_settings.json',R.settings?badge('есть','ok'):badge('нет','info')],
    ['Линия ходьбы от низа',S.walk_line_bottom_m!==undefined?fmtM(S.walk_line_bottom_m):'0,9 м (по умолчанию)'],
    ['Срез угла блока',S.block_bevel_px!==undefined?S.block_bevel_px+' px':'4 px (по умолчанию)'],
    ['data/categories.json',R.categoriesFile?badge('категорий: '+((R.categoriesFile.categories)||[]).length,'ok'):badge('нет','info')],
    ['data/room_recipes.json',R.recipes?badge('типов комнат: '+Object.keys(R.recipes).length,'ok'):badge('нет','info')],
    ['Последнее сканирование',R.scannedAt?R.scannedAt.toLocaleString('ru-RU'):'—']
  ]);

  return `<div class="toolbar"><div><h2>Обзор</h2><div class="muted">Автоматический реестр проекта: что есть, что на что ссылается и что сломано</div></div></div>
  ${card('Состав проекта',`<div class="statgrid wide">
    ${stat(R.objects.length,'объектов','objects')}${stat(blocks,'типов блоков / материалов','materials')}
    ${stat(R.rooms.length,'комнат','rooms')}${stat(R.buildings.length,'зданий','buildings')}
    ${stat(R.sets.length,'наборов','sets')}${stat(R.characters.length,'персонажей Assembler','assembler')}
    ${stat(R.rooms.reduce((s,r)=>s+r.instCount,0),'экземпляров в комнатах','rooms')}${stat(blockCells,'блоков 1×1 м в комнатах','materials')}
    ${stat(R.sprites.length,'картинок','files')}${stat(R.sounds.length,'звуков','files')}
    ${stat(unusedObj,'объектов нигде не используется','unused')}${stat(unusedRooms,'комнат нигде не используется','unused')}
    ${stat(orph.sprites.length+orph.sounds.length,'файлов без ссылок','files')}
  </div>`)}
  ${card('Здоровье проекта',health)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start">
    ${card('Объекты по категориям (клик — открыть список)',table(['Категория','Объектов',''],catRows,'Объектов нет.'))}
    ${card('Типы комнат',table(['Тип','Комнат','Объектов разрешают','Рецепт'],typeRows,'Комнат нет.'))}
  </div>
  ${card('Настройки и служебные файлы',settings)}`;
};
