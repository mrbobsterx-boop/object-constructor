/* ============================================================
   MODULE 09 — VIEWS: BUILDINGS + SETS (+ карточки)
   Здания и улицы из data/buildings/*.json и служебные наборы data/sets/*.json.
   ============================================================ */

function buildingSize(b){
  if(b.mode==='STREET') return b.entries.reduce((s,e)=>s+(e.type==='POOL'?e.count:1),0);
  return b.entries.length;
}
VIEW_RENDERERS.buildings=function(){
  return listView({ view:'buildings', title:'Здания', desc:'Здания и улицы из data/buildings (Building Editor). Клик по строке — состав, слоты и проверки размещения.', kind:'building',
    items:()=>registry.buildings,
    filters:[{key:'mode',label:'Режим',options:()=>[['','Все'],['BUILDING','Здание'],['STREET','Улица']]},{key:'flag',label:'Показать',options:()=>[['','Все'],['problems','С проблемами']]}],
    filterFn:(b,f)=>(!f.mode||b.mode===f.mode)&&(f.flag==='problems'?(problemCounts('building',b.id).err+problemCounts('building',b.id).warn>0):true),
    columns:[
      {h:'Здание',c:b=>`<b>${esc(b.name)}</b><div class="muted">${esc(b.id)}</div>`},
      {h:'Режим',c:b=>b.mode==='STREET'?'Улица':'Здание'},
      {h:'Комнат / элементов',c:b=>fmt(buildingSize(b))},
      {h:'Этажи',c:b=>b.mode==='STREET'?'—':esc(b.floors.join(', ')||'—')},
      {h:'Случайных слотов',c:b=>b.randomCount?fmt(b.randomCount):'—'},
      {h:'Фонов',c:b=>b.bgLayers.length?fmt(b.bgLayers.length):'—'},
      {h:'Файл',c:b=>`<span class="muted">${esc(b.file)}</span>`},
      {h:'Проблемы',c:b=>probBadge('building',b.id)||'<span class="ok">✓</span>'}
    ]});
};

ENTITY_RENDERERS.building=function(id){
  const b=idx.bld.get(id);
  const badges=badge(b.mode==='STREET'?'Улица':'Здание')+probBadge('building',b.id);
  const main=card('Основное',kv([
    ['ID',esc(b.id)],['Файл','data/buildings/'+esc(b.file)],['Режим',b.mode==='STREET'?'Улица (комнаты встык по порядку)':'Здание (план с этажами и дверями)'],
    ['Комнат / элементов',fmt(buildingSize(b))],['Этажи',b.mode==='STREET'?'':esc(b.floors.join(', '))],
    ['Связей дверей',b.mode==='STREET'?'':fmt(b.doorLinks.length)],['Слоёв фона',fmt(b.bgLayers.length)],['Формат',b.schema?'schema_version '+b.schema:'—']]));

  let entries;
  if(b.mode==='STREET'){
    entries=card('Последовательность ('+b.entries.length+')',table(['№','Тип','Комната / фильтр','Штук'],b.entries.map((e,i)=>{
      if(e.type==='POOL'){ const n=roomsMatchingSlot(e.typeFilter,'',[]).length; return `<tr><td>${i+1}</td><td>случайные (пул)</td><td>тип «${esc(e.typeFilter)}» <span class="muted">— подходящих комнат: ${n}</span></td><td>${e.count}</td></tr>`; }
      const r=idx.room.get(e.roomId); return `<tr><td>${i+1}</td><td>фиксированная</td><td>${lnk('room',e.roomId,r?r.name:e.roomId)}</td><td>1</td></tr>`;
    }),'Пусто.'));
  } else {
    entries=card('Комнаты ('+b.entries.length+')',table(['№','Комната','Режим','Этаж','Позиция','Обрезка (л/п/в/н)','Размер','Блоки'],b.entries.map((e,i)=>{
      const dm=entryDims(e), r=idx.room.get(e.roomId);
      const who=e.mode==='RANDOM'?`🎲 тип «${esc(e.typeFilter)}»${e.role?', '+esc(e.role):''}${e.stairs.length?', лестницы '+esc(e.stairs.join(' ')):''}${r?'<div class="muted">выбрана: '+lnk('room',e.roomId,r.name)+'</div>':''}`:lnk('room',e.roomId,r?r.name:e.roomId);
      const c=e.crop, crop=(c.l||c.r||c.t||c.b)?[c.l,c.r,c.t,c.b].map(v=>Math.round(v*100)/100).join(' / '):'—';
      let blocks='—';
      if(r&&r.hasBlocks){ const ox=e.x-c.l, oy=e.y-c.t; blocks=(isWholeMeter(ox)&&isWholeMeter(oy))?'<span class="ok">на сетке 1 м</span>':'<span class="warn">не на целом метре</span>'; }
      return `<tr><td>${i+1}</td><td>${who}</td><td>${e.mode==='RANDOM'?'случайная':'фиксированная'}</td><td>${e.floor}</td><td>${fmtM(e.x)}; ${fmtM(e.y)}</td><td>${crop}</td><td>${dm?fmtM(dm.w)+' × '+fmtM(dm.h):'—'}</td><td>${blocks}</td></tr>`;
    }),'Пусто.'));
  }
  const bg=card('Фоны здания ('+b.bgLayers.length+')',table(['Файл','Статус'],b.bgLayers.map(p=>`<tr><td>${esc(normPath(p))}</td><td>${registry.missing.sprites?'<span class="muted">папки нет</span>':(idx.sprites.has(normPath(p))?'<span class="ok">есть</span>':'<span class="err">не найден</span>')}</td></tr>`),'Фонов нет.'));
  return entityShell(esc(b.name),badges,main+entries+bg+problemsCard('building',b.id));
};

VIEW_RENDERERS.sets=function(){
  return listView({ view:'sets', title:'Наборы', desc:'Служебные заготовки из data/sets (Room Editor): группы объектов и фонов, которые вставляют в комнату.', kind:'set',
    items:()=>registry.sets,
    columns:[
      {h:'Набор',c:s=>`<b>${esc(s.name)}</b><div class="muted">${esc(s.id)}</div>`},
      {h:'Объектов',c:s=>fmt(s.objects.length)},
      {h:'Разных',c:s=>fmt(new Set(s.objects).size)},
      {h:'Фонов',c:s=>s.bgCount?fmt(s.bgCount):'—'},
      {h:'Не найдено объектов',c:s=>{ const n=new Set(s.objects.filter(o=>!idx.obj.has(o))).size; return n?`<span class="err">${n}</span>`:'—'; }},
      {h:'Проблемы',c:s=>probBadge('set',s.id)||'<span class="ok">✓</span>'}
    ]});
};
ENTITY_RENDERERS.set=function(id){
  const s=idx.set.get(id), counts=new Map(); s.objects.forEach(o=>counts.set(o,(counts.get(o)||0)+1));
  const rows=[...counts.entries()].map(([oid,n])=>{ const o=idx.obj.get(oid); return `<tr><td><div class="namecell">${thumbHtml(o)}<div>${lnk('object',oid,o?o.name:oid)}<div class="muted">${esc(oid)}</div></div></div></td><td>${n}</td></tr>`; });
  return entityShell(esc(s.name),probBadge('set',s.id),
    card('Основное',kv([['ID',esc(s.id)],['Файл','data/sets/'+esc(s.file)],['Объектов',fmt(s.objects.length)],['Фонов',fmt(s.bgCount)],['Формат',s.schema?'schema_version '+s.schema:'—']]))
    +card('Объекты ('+counts.size+')',table(['Объект','Штук'],rows,'В наборе нет объектов.'))+problemsCard('set',s.id));
};
