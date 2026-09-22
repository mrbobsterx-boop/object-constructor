/* ============================================================
   MODULE 10 — VIEWS: ASSEMBLER, FILES, DICTIONARIES, UNUSED, PROBLEMS
   ============================================================ */

/* ---------- Character Assembler ---------- */
VIEW_RENDERERS.assembler=function(){
  const R=registry, st=vstate('assembler');
  const chars=listView({ view:'assembler', title:'Персонажи (Assembler)', desc:'Персонажи из data/characters, риги из data/rigs и части из data/parts (Character Assembler). ОС берёт у них картинки и анимации.', kind:'character',
    items:()=>R.characters,
    columns:[
      {h:'Персонаж',c:c=>`<b>${esc(c.name)}</b><div class="muted">${esc(c.id)}</div>`},
      {h:'Риг',c:c=>c.rig?lnk('rig',c.rig):'—'},
      {h:'Слоёв',c:c=>fmt(c.layers.length)},
      {h:'Объекты ОС',c:c=>{ const n=R.objects.filter(o=>o.raw.character_ref&&o.raw.character_ref.id===c.id); return n.length?n.map(o=>lnk('object',o.id,o.name)).join(', '):'<span class="muted">не связан</span>'; }},
      {h:'Проблемы',c:c=>probBadge('character',c.id)||'<span class="ok">✓</span>'}
    ]});
  const rigRows=R.rigs.map(g=>{
    const slots=Object.keys(R.parts).filter(k=>k.startsWith(g.id+'/')), parts=slots.reduce((s,k)=>s+R.parts[k].length,0);
    return `<tr class="click" data-k="rig" data-id="${esc(g.id)}"><td><b>${esc(g.name)}</b><div class="muted">${esc(g.id)}</div></td><td>${slots.length}</td><td>${parts}</td><td>${R.characters.filter(c=>c.rig===g.id).length}</td></tr>`;
  });
  return chars+card('Риги ('+R.rigs.length+')',table(['Риг','Слотов','Частей','Персонажей'],rigRows,'Ригов нет.'));
};
ENTITY_RENDERERS.character=function(id){
  const c=idx.chr.get(id), R=registry;
  const layers=c.layers.map(l=>{ const list=R.parts[c.rig+'/'+l.slot]; const ok=l.part&&list&&list.includes(l.part); return `<tr><td>${esc(l.slot)}</td><td>${esc(l.part||'—')}</td><td>${!l.part?'<span class="muted">пусто</span>':(ok?'<span class="ok">есть</span>':'<span class="err">не найдена</span>')}</td></tr>`; });
  const objs=R.objects.filter(o=>o.raw.character_ref&&o.raw.character_ref.id===c.id);
  return entityShell(esc(c.name),probBadge('character',c.id),
    card('Основное',kv([['ID',esc(c.id)],['Файл','data/characters/'+esc(c.file)],['Риг',c.rig?lnk('rig',c.rig):'—'],['Слоёв',fmt(c.layers.length)]]))
    +card('Слои ('+c.layers.length+')',table(['Слот','Часть','Статус'],layers,'Слоёв нет.'))
    +card('Объекты ОС, связанные с персонажем ('+objs.length+')',table(['Объект'],objs.map(o=>`<tr><td>${lnk('object',o.id,o.name)}</td></tr>`),'Ни один объект не ссылается на этого персонажа.'))
    +problemsCard('character',c.id));
};
ENTITY_RENDERERS.rig=function(id){
  const g=idx.rig.get(id), R=registry;
  const slots=Object.keys(R.parts).filter(k=>k.startsWith(g.id+'/')).map(k=>[k.slice(g.id.length+1),R.parts[k]]);
  const chars=R.characters.filter(c=>c.rig===g.id);
  return entityShell(esc(g.name),'',
    card('Основное',kv([['ID',esc(g.id)],['Файл','data/rigs/'+esc(g.file)],['Слотов с частями',fmt(slots.length)]]))
    +card('Части по слотам',table(['Слот','Частей','Части'],slots.map(([s,l])=>`<tr><td>${esc(s)}</td><td>${l.length}</td><td class="muted">${esc(l.join(', '))}</td></tr>`),'Частей нет.'))
    +card('Персонажи на этом риге ('+chars.length+')',table(['Персонаж'],chars.map(c=>`<tr><td>${lnk('character',c.id,c.name)}</td></tr>`),'Нет.')));
};

/* ---------- Файлы ---------- */
function fileRows(){
  const R=registry, rows=[];
  R.sprites.forEach(p=>rows.push({id:p,type:'sprite',rel:p,refs:fileRefs.get('sprite:'+p)||[],orphan:!R.refs.has(p)}));
  R.sounds.forEach(p=>rows.push({id:p,type:'sound',rel:p,refs:fileRefs.get('sound:'+p)||[],orphan:!R.refs.has(p)}));
  rows.forEach(r=>{ r.search=(r.type+' '+r.rel).toLowerCase(); });
  return rows;
}
VIEW_RENDERERS.files=function(){
  const R=registry, rows=fileRows(), o=orphanFiles();
  return `<div class="statgrid wide" style="margin-bottom:10px">
    <div class="stat"><div class="n">${fmt(R.sprites.length)}</div><div class="t">картинок в assets/sprites</div></div>
    <div class="stat"><div class="n">${fmt(R.sounds.length)}</div><div class="t">звуков в assets/sounds</div></div>
    <div class="stat"><div class="n">${fmt(o.sprites.length+o.sounds.length)}</div><div class="t">файлов без ссылок из JSON</div></div></div>`
  +listView({ view:'files', title:'Файлы', desc:'Картинки и звуки проекта и кто на них ссылается. «Без ссылок» — путь не найден ни в одном JSON проекта (для частей Assembler список может быть неполным).',
    items:()=>rows,
    filters:[{key:'type',label:'Тип',options:()=>[['','Все'],['sprite','Картинки'],['sound','Звуки']]},{key:'flag',label:'Показать',options:()=>[['','Все'],['orphan','Без ссылок'],['used','Со ссылками']]}],
    filterFn:(r,f)=>(!f.type||r.type===f.type)&&(f.flag==='orphan'?r.orphan:f.flag==='used'?!r.orphan:true),
    columns:[
      {h:'Файл',c:r=>esc((r.type==='sprite'?'assets/sprites/':'assets/sounds/')+r.rel)},
      {h:'Тип',c:r=>r.type==='sprite'?'картинка':'звук'},
      {h:'Кто ссылается',c:r=>r.refs.length?r.refs.slice(0,4).map(x=>(x.kind==='object'||x.kind==='room'||x.kind==='building')?lnk(x.kind,x.id)+` <span class="muted">(${esc(x.ctx)})</span>`:esc(x.id)).join('<br>')+(r.refs.length>4?`<div class="muted">…и ещё ${r.refs.length-4}</div>`:''):(r.orphan?'<span class="muted">не упоминается в JSON</span>':'<span class="muted">упоминается в JSON (Assembler или наборах)</span>')}
    ]});
};

/* ---------- Справочники ---------- */
VIEW_RENDERERS.dictionaries=function(){
  const cats=[...dict.categories.values()].map(c=>`<tr class="click" data-act="filter" data-view="objects" data-fk="category" data-fv="${esc(c.id)}"><td>${esc(c.name)}</td><td class="muted">${esc(c.id)}</td><td>${fmt(c.count)}</td><td>${c.inFile?'<span class="ok">есть</span>':'<span class="warn">нет в categories.json</span>'}</td></tr>`);
  const types=[...dict.roomTypes.values()].map(t=>`<tr class="click" data-act="filter" data-view="rooms" data-fk="type" data-fv="${esc(t.type)}"><td>${esc(t.type)}</td><td>${fmt(t.rooms.length)}</td><td>${fmt(t.allowedBy.length)}</td><td>${t.recipeRows?fmt(t.recipeRows):'—'}</td></tr>`);
  const groups=[...dict.groups.values()].map(g=>`<tr class="click" data-act="filter" data-view="objects" data-fk="group" data-fv="${esc(g.id)}"><td>${esc(g.id)}</td><td>${g.objects.length?fmt(g.objects.length):'<span class="warn">нет объектов</span>'}</td><td class="muted">${esc(g.recipeTypes.join(', '))||'—'}</td></tr>`);
  const tags=[...dict.tags.entries()].sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<tr><td>${esc(t)}</td><td>${fmt(n)}</td></tr>`);
  return `<div class="toolbar"><div><h2>Справочники</h2><div class="muted">Словари, из которых собираются редакторы: категории ОС, типы комнат, группы взаимозаменяемости, теги. Клик по строке — список с этим фильтром.</div></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start">
    ${card('Категории объектов',table(['Название','ID','Объектов','data/categories.json'],cats,'Нет.'))}
    ${card('Типы комнат',table(['Тип','Комнат','Объектов разрешают','Строк рецепта'],types,'Нет.'))}
    ${card('Группы взаимозаменяемости',table(['Группа','Объектов','Рецепты комнат'],groups,'Нет.'))}
    ${card('Теги',table(['Тег','Объектов'],tags,'Нет.'))}
  </div>`;
};

/* ---------- Неиспользуемое ---------- */
VIEW_RENDERERS.unused=function(){
  const R=registry, o=orphanFiles();
  const objs=R.objects.filter(x=>!objectIsUsed(x)), rooms=R.rooms.filter(r=>!roomIsUsed(r));
  const objRows=objs.map(x=>`<tr><td><div class="namecell">${thumbHtml(x)}<div>${lnk('object',x.id,x.name)}<div class="muted">${esc(x.id)}</div></div></div></td><td>${esc(x.categoryName||x.category||'—')}</td><td>${x.widthCm&&x.heightCm?x.widthCm+' × '+x.heightCm+' см':'—'}</td></tr>`);
  const roomRows=rooms.map(r=>`<tr><td>${lnk('room',r.id,r.name)}<div class="muted">${esc(r.id)}</div></td><td>${esc(r.type||'—')}</td><td>${fmtM(r.widthM)} × ${fmtM(r.heightM)}</td></tr>`);
  return `<div class="toolbar"><div><h2>Неиспользуемое</h2><div class="muted">Что сейчас нигде не встречается. Объект «используется», если он стоит в комнате или наборе, лежит как тип блока, либо на него ссылается другой объект (инструмент, расходник, ингредиент, добыча). Комната — если она стоит в здании, является целью двери или может быть выбрана слотом. Игровая логика (спавн персонажей, предметы из добычи) сюда не попадает — часть объектов может быть нужна игре.</div></div></div>
  ${card('Объекты ('+objs.length+')',table(['Объект','Категория','Размер'],objRows,'Все объекты используются ✓'))}
  ${card('Комнаты ('+rooms.length+')',table(['Комната','Тип','Размер'],roomRows,'Все комнаты используются ✓'))}
  ${card('Файлы без ссылок',`Картинок: <b>${o.sprites.length}</b>, звуков: <b>${o.sounds.length}</b> — ${chipLink('files','flag','orphan','показать список')}`)}`;
};

/* ---------- Проблемы ---------- */
VIEW_RENDERERS.problems=function(){
  const R=registry;
  const kinds=[...new Set(R.problems.map(p=>p.kind))], codes=[...new Set(R.problems.map(p=>p.code))].sort();
  const kindName={object:'Объекты',room:'Комнаты',building:'Здания',set:'Наборы',character:'Персонажи',file:'Файлы JSON',project:'Проект'};
  return listView({ view:'problems', title:'Проблемы', desc:'Результат автоматических проверок: битые ссылки, отсутствующие файлы, нарушения правил редакторов.',
    items:()=>R.problems.slice().sort((a,b)=>({err:0,warn:1,info:2}[a.level]-{err:0,warn:1,info:2}[b.level])||a.kind.localeCompare(b.kind)),
    filters:[
      {key:'level',label:'Уровень',options:()=>[['','Все'],['err','Ошибки'],['warn','Предупреждения'],['info','К сведению']]},
      {key:'kind',label:'Где',options:()=>[['','Везде']].concat(kinds.map(k=>[k,kindName[k]||k]))},
      {key:'code',label:'Код',options:()=>[['','Все коды']].concat(codes.map(c=>[c,c]))}],
    filterFn:(p,f)=>(!f.level||p.level===f.level)&&(!f.kind||p.kind===f.kind)&&(!f.code||p.code===f.code),
    columns:[
      {h:'',c:p=>badge({err:'ошибка',warn:'предупр.',info:'инфо'}[p.level],p.level)},
      {h:'Код',c:p=>`<span class="muted">${esc(p.code)}</span>`},
      {h:'Где',c:p=>entityExists(p.kind,p.id)?`${KIND_LABEL[p.kind]}: ${lnk(p.kind,p.id,entityName(p.kind,p.id))}`:esc((KIND_LABEL[p.kind]||p.kind)+': '+p.id)},
      {h:'Что не так',c:p=>esc(p.msg)}
    ], limit:300 });
};
