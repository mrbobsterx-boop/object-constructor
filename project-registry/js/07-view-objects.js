/* ============================================================
   MODULE 07 — VIEWS: OBJECTS + MATERIALS (+ карточка объекта)
   «Объекты» — все data/objects/*.json. «Блоки и материалы» — объекты категории block
   (твёрдость, инструмент, срез угла, таблица добычи, где блоки стоят в комнатах).
   ============================================================ */

function categoryOptions(){
  return [['','Все категории']].concat([...dict.categories.values()].map(c=>[c.id,`${c.name} (${c.count})`]));
}
function groupOptions(){
  return [['','Все группы']].concat([...dict.groups.values()].filter(g=>g.objects.length).map(g=>[g.id,`${g.id} (${g.objects.length})`]));
}
function dropsShort(o){
  const d=(o.block&&Array.isArray(o.block.drop_table))?o.block.drop_table:[];
  return d.length?d.map(x=>`${esc(x.item)} ${Math.round(num(x.chance)*100)}%`).join('<br>'):'<span class="muted">—</span>';
}
function objectFlagOk(o,flag){
  if(flag==='problems') return problemCounts('object',o.id).err+problemCounts('object',o.id).warn>0;
  if(flag==='unused') return !objectIsUsed(o);
  if(flag==='used') return objectIsUsed(o);
  if(flag==='destructible') return o.destructible;
  if(flag==='crafting') return o.crafting;
  if(flag==='nosize') return !o.widthCm||!o.heightCm;
  return true;
}
const OBJECT_FLAGS=[['','Все'],['problems','С проблемами'],['unused','Нигде не используются'],['used','Используются'],['destructible','Разрушаемые'],['crafting','Участвуют в крафте'],['nosize','Без размера']];

VIEW_RENDERERS.objects=function(){
  return listView({ view:'objects', title:'Объекты', desc:'Все объекты из data/objects (Object Constructor). Клик по строке — карточка со связями.', kind:'object',
    items:()=>registry.objects,
    filters:[{key:'category',label:'Категория',options:categoryOptions},{key:'group',label:'Группа',options:groupOptions},{key:'flag',label:'Показать',options:()=>OBJECT_FLAGS}],
    filterFn:(o,f)=>(!f.category||o.category===f.category)&&(!f.group||o.variantGroup===f.group)&&objectFlagOk(o,f.flag),
    columns:[
      {h:'Объект',c:o=>`<div class="namecell">${thumbHtml(o)}<div><b>${esc(o.name)}</b><div class="muted">${esc(o.id)}</div></div></div>`},
      {h:'Категория',c:o=>esc(o.categoryName||o.category||'—')},
      {h:'Игровой размер',c:o=>o.widthCm&&o.heightCm?`${o.widthCm} × ${o.heightCm} см`:'<span class="warn">не задан</span>'},
      {h:'Размещение / физика',c:o=>esc([o.placement,o.physics].filter(Boolean).join(' · ')||'—')},
      {h:'Группа',c:o=>esc(o.variantGroup||'—')},
      {h:'В комнатах',c:o=>{ const n=objectUsageCount(o); return n?fmt(n)+' <span class="muted">в '+o.usedBy.rooms.size+' комн.</span>':'—'; }},
      {h:'Ссылок из других',c:o=>fmt(o.usedBy.objects.length+o.usedBy.sets.size+o.usedBy.blocks.size)},
      {h:'Проблемы',c:o=>probBadge('object',o.id)||'<span class="ok">✓</span>'}
    ]});
};

VIEW_RENDERERS.materials=function(){
  return listView({ view:'materials', title:'Блоки и материалы', desc:'Объекты категории «Блок / материал». Блок 1×1 м = 5×5 кусков по 20 см; куски ломаются по одному и дают предметы по таблице добычи.', kind:'object',
    items:()=>registry.objects.filter(o=>o.category==='block'),
    filters:[{key:'flag',label:'Показать',options:()=>[['','Все'],['problems','С проблемами'],['unused','Нигде не используются']]}],
    filterFn:(o,f)=>objectFlagOk(o,f.flag),
    columns:[
      {h:'Материал',c:o=>`<div class="namecell">${thumbHtml(o)}<div><b>${esc(o.name)}</b><div class="muted">${esc(o.id)}</div></div></div>`},
      {h:'Твёрдость',c:o=>o.block?fmt(num(o.block.hardness)):'—'},
      {h:'Инструмент',c:o=>o.block&&o.block.tool?lnk('object',o.block.tool):'<span class="muted">без инструмента</span>'},
      {h:'Срез угла',c:o=>o.block&&o.block.bevel_px!==null&&o.block.bevel_px!==undefined?o.block.bevel_px+' px':'<span class="muted">как в проекте</span>'},
      {h:'Что даёт кусок',c:o=>dropsShort(o)},
      {h:'В комнатах',c:o=>{ let n=0; o.usedBy.blocks.forEach(v=>n+=v); return n?fmt(n)+' бл. <span class="muted">в '+o.usedBy.blocks.size+' комн.</span>':'—'; }},
      {h:'Проблемы',c:o=>probBadge('object',o.id)||'<span class="ok">✓</span>'}
    ]});
};

ENTITY_RENDERERS.object=function(id){
  const o=idx.obj.get(id), d=o.raw, b=d.behavior||{};
  const badges=badge(o.categoryName||o.category||'без категории')+(o.category==='block'?badge('материал блока','ok'):'')+probBadge('object',o.id);
  const main=`<div class="row" style="align-items:flex-start;gap:14px">${thumbHtml(o,true)}<div style="flex:1;min-width:280px">${kv([
    ['ID',esc(o.id)],['Файл','data/objects/'+esc(o.file)],
    ['Категория',o.category?chipLink('objects','category',o.category,(o.categoryName||o.category)+' ('+o.category+')'):'—'],
    ['Подтип',esc(o.subtype)],['Игровой размер',o.widthCm&&o.heightCm?`${o.widthCm} × ${o.heightCm} см`:'не задан'],
    ['Размещение',esc(o.placement)],['Физика / столкновение',esc([o.physics,o.collision].filter(Boolean).join(' / '))],
    ['Группа взаимозаменяемости',o.variantGroup?chipLink('objects','group',o.variantGroup,o.variantGroup):''],
    ['Разрешённые типы комнат',o.allowedRoomTypes.map(t=>chipLink('rooms','type',t,t)).join(' ')],
    ['Вес',o.weight?o.weight+' кг':''],
    ['Разрушение',o.destructible?`включено, HP ${o.hp}`:'выключено'],['Крафт',o.crafting?'участвует':'—'],
    ['Действия',esc(Array.isArray(d.actions)?d.actions.join(', '):'')],
    ['Теги',o.tags.map(esc).join(', ')],['Формат',o.schema?'schema_version '+o.schema:'—']])}</div></div>`;

  let material='';
  if(o.block){
    const bk=o.block, drops=Array.isArray(bk.drop_table)?bk.drop_table:[], mod=bk.drop_chance_modifiers||{};
    material=card('Материал блока',kv([
      ['Твёрдость',fmt(num(bk.hardness))],['Нужный инструмент',bk.tool?lnk('object',bk.tool):'без инструмента'],
      ['Срез внешних углов',bk.bevel_px===null||bk.bevel_px===undefined?'как в проекте':bk.bevel_px+' px'],
      ['Кусок',`${bk.piece_size_cm||20} см, ${bk.pieces_per_side||5}×${bk.pieces_per_side||5} в блоке`],
      ['Бонус шанса',`навык: ${esc(mod.skill||'—')}${mod.skill?`, +${Math.round(num(mod.skill_bonus_per_level)*1000)/10}% за уровень`:''}; инструмент: +${Math.round(num(mod.tool_bonus)*1000)/10}%`]
    ])+'<div style="margin-top:8px"></div>'+table(['Предмет','Шанс','Количество'],drops.map(x=>`<tr><td>${lnk('object',x.item)}</td><td>${Math.round(num(x.chance)*10000)/100}%</td><td>${num(x.min)}–${num(x.max)}</td></tr>`),'Таблица добычи пуста.'));
  }

  const uses=card('Использует ('+o.uses.length+')',table(['Что','Где'],o.uses.map(u=>`<tr><td>${lnk(u.kind,u.id)}</td><td class="muted">${esc(u.ctx)}</td></tr>`),'Ни на что не ссылается.'));

  const roomRows=[...o.usedBy.rooms.entries()].map(([rid,n])=>`<tr><td>${lnk('room',rid,(idx.room.get(rid)||{}).name||rid)}</td><td>${n} шт.</td><td class="muted">экземпляры</td></tr>`)
    .concat([...o.usedBy.blocks.entries()].map(([rid,n])=>`<tr><td>${lnk('room',rid,(idx.room.get(rid)||{}).name||rid)}</td><td>${n} бл.</td><td class="muted">блоки</td></tr>`))
    .concat([...o.usedBy.sets.entries()].map(([sid,n])=>`<tr><td>${lnk('set',sid,(idx.set.get(sid)||{}).name||sid)}</td><td>${n} шт.</td><td class="muted">набор</td></tr>`))
    .concat(o.usedBy.objects.map(u=>`<tr><td>${lnk('object',u.id,(idx.obj.get(u.id)||{}).name||u.id)}</td><td></td><td class="muted">${esc(u.ctx)}</td></tr>`));
  const used=card('Где используется ('+roomRows.length+')',table(['Где','Сколько','Как'],roomRows,'Нигде не используется.'));

  const refs=objectAssetRefs(d);
  const files=card('Файлы ('+refs.length+')',table(['Файл','Что','Статус'],refs.map(r=>{
    const ok=r.type==='sprite'?idx.sprites.has(r.rel):idx.sounds.has(r.rel);
    return `<tr><td>${esc(r.rel)}</td><td class="muted">${esc(r.ctx)}</td><td>${ok?'<span class="ok">есть</span>':(registry.missing[r.type==='sprite'?'sprites':'sounds']?'<span class="muted">папки нет</span>':'<span class="err">не найден</span>')}</td></tr>`;
  }),'У объекта нет файлов.'));

  return entityShell(esc(o.name),badges,'<div class="card"><div class="cardbody">'+main+'</div></div>'+material+uses+used+files+problemsCard('object',o.id));
};
