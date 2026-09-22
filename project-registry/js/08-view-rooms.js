/* ============================================================
   MODULE 08 — VIEW: ROOMS (+ карточка комнаты)
   Все data/rooms/*.json: тип, размер, объекты, двери, блоки, где комната используется.
   ============================================================ */

function roomTypeOptions(){
  return [['','Все типы']].concat([...dict.roomTypes.values()].filter(t=>t.rooms.length).map(t=>[t.type,`${t.type} (${t.rooms.length})`]));
}
function roomSizeCell(r){
  const bad=r.hasBlocks&&(!isWholeMeter(r.widthM)||!isWholeMeter(r.heightM));
  return `${fmtM(r.widthM)} × ${fmtM(r.heightM)}`+(bad?' <span class="warn" title="В комнате есть блоки, а размер не кратен 1 м">⚠</span>':'');
}
VIEW_RENDERERS.rooms=function(){
  return listView({ view:'rooms', title:'Комнаты', desc:'Все комнаты из data/rooms (Room Editor). Клик по строке — состав комнаты, двери, блоки и где она используется.', kind:'room',
    items:()=>registry.rooms,
    filters:[{key:'type',label:'Тип',options:roomTypeOptions},{key:'flag',label:'Показать',options:()=>[['','Все'],['problems','С проблемами'],['unused','Нигде не используются'],['blocks','С блоками']]}],
    filterFn:(r,f)=>(!f.type||r.type===f.type)&&(f.flag==='problems'?(problemCounts('room',r.id).err+problemCounts('room',r.id).warn>0):f.flag==='unused'?!roomIsUsed(r):f.flag==='blocks'?r.hasBlocks:true),
    columns:[
      {h:'Комната',c:r=>`<b>${esc(r.name)}</b><div class="muted">${esc(r.id)}</div>`},
      {h:'Тип',c:r=>esc(r.type||'—')},
      {h:'Размер',c:r=>roomSizeCell(r)},
      {h:'Роль / лестницы',c:r=>esc(r.role)+(r.stairs.length?`<div class="muted">${esc(r.stairs.join(', '))}</div>`:'')},
      {h:'Объектов',c:r=>fmt(r.instCount)+` <span class="muted">(${r.usedObjects.size} разн.)</span>`},
      {h:'Блоков',c:r=>r.blockCount?fmt(r.blockCount):'—'},
      {h:'Дверей',c:r=>r.doors.length?fmt(r.doors.length):'—'},
      {h:'В зданиях',c:r=>r.usedBy.buildings.length?fmt(r.usedBy.buildings.length):(r.usedBy.slots.length?'<span class="muted">слоты: '+r.usedBy.slots.length+'</span>':'—')},
      {h:'Проблемы',c:r=>probBadge('room',r.id)||'<span class="ok">✓</span>'}
    ]});
};

ENTITY_RENDERERS.room=function(id){
  const r=idx.room.get(id);
  const badges=badge(r.type||'без типа')+(r.hasBlocks?badge('блоки: '+r.blockCount,'ok'):'')+probBadge('room',r.id);
  const main=card('Основное',kv([
    ['ID',esc(r.id)],['Файл','data/rooms/'+esc(r.file)],['Тип',r.type?chipLink('rooms','type',r.type,r.type):''],
    ['Размер',roomSizeCell(r)],['Роль в здании',esc(r.role)],['Лестницы',esc(r.stairs.join(', '))],
    ['Экземпляров',fmt(r.instCount)+` (разных объектов: ${r.usedObjects.size})`],['Слоёв фона',fmt(r.bgLayers.length)],
    ['Формат',r.schema?'schema_version '+r.schema:'—']]));

  const objRows=[...r.usedObjects.entries()].sort((a,b)=>b[1]-a[1]).map(([oid,n])=>{
    const o=idx.obj.get(oid);
    return `<tr><td><div class="namecell">${thumbHtml(o)}<div>${lnk('object',oid,o?o.name:oid)}<div class="muted">${esc(oid)}</div></div></div></td><td>${esc(o?(o.categoryName||o.category):'—')}</td><td>${n}</td></tr>`;
  });
  const objects=card('Объекты ('+r.usedObjects.size+')',table(['Объект','Категория','Штук'],objRows,'В комнате нет объектов.'));

  const doors=card('Двери ('+r.doors.length+')',table(['№','Объект','Ведёт в'],r.doors.map(dr=>`<tr><td>${dr.idx+1}</td><td>${lnk('object',dr.objectId)}</td><td>${dr.toRoom?lnk('room',dr.toRoom,(idx.room.get(dr.toRoom)||{}).name||dr.toRoom):'<span class="warn">никуда</span>'}</td></tr>`),'Дверей нет.'));

  const blockRows=[...r.blockTypes.entries()].map(([t,n])=>{ const o=idx.obj.get(t); return `<tr><td><div class="namecell">${thumbHtml(o)}<div>${lnk('object',t,o?o.name:t)}</div></div></td><td>${n}</td><td>${o?(o.category==='block'?'<span class="ok">материал</span>':`<span class="warn">${esc(o.category)}</span>`):'<span class="err">не найден</span>'}</td></tr>`; });
  const blocks=r.hasBlocks?card('Блоки ('+r.blockCount+')',table(['Тип блока','Блоков 1×1 м','Категория'],blockRows,'—')):'';

  const usedRows=r.usedBy.buildings.map(b=>`<tr><td>${lnk('building',b.id,(idx.bld.get(b.id)||{}).name||b.id)}</td><td class="muted">стоит в здании</td></tr>`)
    .concat(r.usedBy.slots.filter(b=>!r.usedBy.buildings.some(x=>x.id===b)).map(b=>`<tr><td>${lnk('building',b,(idx.bld.get(b)||{}).name||b)}</td><td class="muted">может быть выбрана случайным слотом</td></tr>`))
    .concat(r.usedBy.doors.map(d=>`<tr><td>${lnk('room',d.room,(idx.room.get(d.room)||{}).name||d.room)}</td><td class="muted">дверь ведёт сюда</td></tr>`));
  const used=card('Где используется ('+usedRows.length+')',table(['Где','Как'],usedRows,'Комната нигде не используется.'));

  return entityShell(esc(r.name),badges,main+objects+doors+blocks+used+problemsCard('room',r.id));
};
