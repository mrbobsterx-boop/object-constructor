/* ============================================================
   MODULE 04 — CHECKS
   Автоматические проверки. Каждая находка: {level:'err'|'warn'|'info', code, kind, id, msg}.
     err  — сломанная ссылка / нечитаемый файл: игра или редактор споткнутся
     warn — вероятная ошибка данных (нет размера, не кратно метру, слот без комнат)
     info — к сведению (старый формат, неиспользуемые файлы)
   Правила берутся из редакторов: размеры объектов кратны 10 см; блоки лежат на сетке 1 м, поэтому
   комната с блоками должна иметь целые размеры и стоять в здании на целом метре
   (с учётом обрезки слева/сверху); материалы блоков — категория block, 100×100 см.
   ============================================================ */

let problemIndex=new Map(); // 'kind:id' → {err,warn,info}
function problemsOf(kind,id){ return registry.problems.filter(p=>p.kind===kind&&p.id===id); }
function problemCounts(kind,id){ return problemIndex.get(kind+':'+id)||{err:0,warn:0,info:0}; }

function runChecks(){
  const R=registry;
  const add=(level,code,kind,id,msg)=>R.problems.push(mkProblem(level,code,kind,id,msg));
  checkProject(add); checkObjects(add); checkRooms(add); checkBuildings(add); checkSets(add); checkAssembler(add); checkRecipes(add); checkFiles(add);
  problemIndex=new Map();
  R.problems.forEach(p=>{
    p.search=(p.code+' '+p.kind+' '+p.id+' '+p.msg).toLowerCase();
    const k=p.kind+':'+p.id; if(!problemIndex.has(k)) problemIndex.set(k,{err:0,warn:0,info:0});
    problemIndex.get(k)[p.level]++;
  });
}

function checkProject(add){
  const R=registry;
  if(R.missing.data) add('err','DIR_MISSING','project','data','Папка data не найдена — подключи корневую папку проекта.');
  if(R.missing.objects) add('err','DIR_MISSING','project','data/objects','Папка data/objects не найдена.');
  if(R.missing.rooms) add('warn','DIR_MISSING','project','data/rooms','Папка data/rooms не найдена.');
  if(R.missing.buildings) add('info','DIR_MISSING','project','data/buildings','Папка data/buildings не найдена (зданий ещё нет).');
  if(R.missing.sprites) add('warn','DIR_MISSING','project','assets/sprites','Папка assets/sprites не найдена — проверка картинок пропущена.');
  if(!R.missing.data&&!R.categoriesFile) add('info','NO_CATEGORIES_FILE','project','data/categories.json','Нет data/categories.json. Его пишет ОС при подключении папки: открой ОС с этой папкой, и список категорий в Room Editor совпадёт с ОС.');
  if(!R.missing.data&&!R.settings) add('info','NO_SETTINGS','project','data/project_settings.json','Нет data/project_settings.json (линия ходьбы и срез угла блока берутся по умолчанию: 0,9 м и 4 px). Файл создаёт Room Editor кнопкой «Сохранить настройки проекта».');
}

function checkObjects(add){
  const R=registry, roomTypes=new Set(R.rooms.map(r=>r.type).filter(Boolean));
  const byId=new Map(); R.objects.forEach(o=>{ if(!byId.has(o.id)) byId.set(o.id,[]); byId.get(o.id).push(o); });
  byId.forEach((list,id)=>{ if(list.length>1) list.forEach(o=>add('err','ID_DUP','object',o.id,`Одинаковый id «${id}» в файлах: ${list.map(x=>x.file).join(', ')}.`)); });
  const knownCats=R.categoriesFile?new Set(((R.categoriesFile.categories)||[]).map(c=>c.id)):null;
  const spritesKnown=!R.missing.sprites, soundsKnown=!R.missing.sounds;

  R.objects.forEach(o=>{
    const d=o.raw, A=(l,c,m)=>add(l,c,'object',o.id,m);
    if(o.fileBase!==o.id) A('warn','ID_FILE',`Имя файла «${o.file}» не совпадает с id «${o.id}» (редакторы ищут объект по id внутри файла, имя файла — запасной вариант).`);
    if(!slugOk(o.id)) A('warn','ID_SLUG','id содержит недопустимые символы (допустимо a-z, 0-9, _ и -).');
    if(!o.category) A('err','NO_CATEGORY','Не задана категория.');
    else if(knownCats&&!knownCats.has(o.category)) A('warn','CATEGORY_UNKNOWN',`Категории «${o.category}» нет в data/categories.json.`);
    if(o.schema&&o.schema<4) A('info','LEGACY_UNITS',`Старый формат (schema_version ${o.schema}): при следующем сохранении в ОС станет метрическим.`);
    if(!o.widthCm||!o.heightCm) A('warn','NO_SIZE','Не задан игровой размер (real_width_cm / real_height_cm).');
    else {
      if(!Number.isInteger(o.widthCm)||!Number.isInteger(o.heightCm)) A('info','SIZE_STEP','Игровой размер — не целое число сантиметров (ОС сохраняет размер в целых см).');
      const iw=num(d.appearance&&d.appearance.imageWidth), ih=num(d.appearance&&d.appearance.imageHeight);
      if(iw>0&&ih>0&&Math.abs(o.heightCm-o.widthCm*ih/iw)>1) A('warn','SIZE_ASPECT',`Размер ${o.widthCm}×${o.heightCm} см не совпадает с пропорциями картинки ${iw}×${ih} px — картинка растянута (по пропорциям высота была бы ${Math.round(o.widthCm*ih/iw)} см). В ОС включи «Сохранить пропорции» и нажми «Подогнать высоту по ширине».`);
    }

    // картинки и звуки
    const refs=objectAssetRefs(d);
    const hasAnyImage=refs.some(r=>r.type==='sprite'&&(r.main||r.ctx.startsWith('состояние')||r.ctx.startsWith('анимация «')));
    if(!hasAnyImage) A('warn','NO_IMAGE','У объекта нет картинки (ни основной, ни состояний, ни анимаций) — в редакторах показывается заглушка.');
    refs.forEach(r=>{
      if(r.type==='sprite'&&spritesKnown&&!idx.sprites.has(r.rel)) A(r.main?'err':'warn','ASSET_MISSING',`Файл не найден в assets/sprites: ${r.rel} (${r.ctx}).`);
      if(r.type==='sound'&&soundsKnown&&!idx.sounds.has(r.rel)) A('warn','SOUND_MISSING',`Файл не найден в assets/sounds: ${r.rel} (${r.ctx}).`);
    });

    // ссылки на другие объекты и на персонажа
    o.uses.forEach(u=>{
      if(u.kind==='object'&&!idx.obj.has(u.id)) A('err','REF_MISSING',`${u.ctx}: объект «${u.id}» не найден.`);
      if(u.kind==='character'&&!idx.chr.has(u.id)) A('err','REF_MISSING',`${u.ctx}: персонаж Assembler «${u.id}» не найден.`);
    });
    o.allowedRoomTypes.forEach(t=>{ if(!roomTypes.has(t)) A('info','ROOM_TYPE_UNKNOWN',`Разрешённый тип комнаты «${t}»: комнат такого типа пока нет.`); });

    // материал блока
    if(o.category==='block'){
      if(!o.block) A('warn','BLOCK_NO_DATA','Категория «Блок / материал», но нет секции block (открой объект в ОС и сохрани заново).');
      if(o.widthCm!==100||o.heightCm!==100) A('warn','BLOCK_SIZE',`Блок должен быть 100×100 см, сейчас ${o.widthCm}×${o.heightCm}.`);
      if(o.physics&&o.physics!=='STATIC') A('warn','BLOCK_PHYSICS',`У блока физика ${o.physics}, ожидается STATIC.`);
      if(o.block){
        if(!(num(o.block.hardness)>0)) A('warn','BLOCK_HARDNESS','Твёрдость не задана или равна 0.');
        const drops=Array.isArray(o.block.drop_table)?o.block.drop_table:[];
        if(!drops.length) A('info','BLOCK_NO_DROPS','Таблица добычи пуста — кусок ничего не даёт.');
        drops.forEach(dr=>{
          if(!dr) return;
          if(!(num(dr.chance,-1)>=0&&num(dr.chance,-1)<=1)) A('warn','BLOCK_DROP',`Добыча «${dr.item}»: шанс должен быть от 0 до 1 (сейчас ${dr.chance}).`);
          if(num(dr.min)>num(dr.max)) A('warn','BLOCK_DROP',`Добыча «${dr.item}»: минимум больше максимума.`);
        });
      }
    } else if(o.block){
      A('info','BLOCK_ON_NON_BLOCK',`Секция block есть, но категория «${o.category}» — она игрой не используется.`);
    }
  });
}

function checkRooms(add){
  const R=registry, spritesKnown=!R.missing.sprites;
  const byId=new Map(); R.rooms.forEach(r=>{ if(!byId.has(r.id)) byId.set(r.id,[]); byId.get(r.id).push(r); });
  byId.forEach((list,id)=>{ if(list.length>1) list.forEach(r=>add('err','ID_DUP','room',r.id,`Одинаковый id «${id}» в файлах: ${list.map(x=>x.file).join(', ')}.`)); });
  R.rooms.forEach(r=>{
    const A=(l,c,m)=>add(l,c,'room',r.id,m);
    if(r.fileBase!==r.id) A('warn','ID_FILE',`Имя файла «${r.file}» не совпадает с id «${r.id}».`);
    if(!r.type) A('warn','NO_TYPE','Не задан тип комнаты (генератор, рецепты и случайные слоты зданий работают по типу).');
    if(r.schema&&r.schema<4) A('info','LEGACY_UNITS',`Старый формат (schema_version ${r.schema}): координаты пересчитаны из px при 640 px/м, при пересохранении в Room Editor станет метрическим.`);
    if(!(r.widthM>0)||!(r.heightM>0)) A('err','NO_SIZE','Размер комнаты не задан.');

    // объекты
    const missing=new Map();
    r.instances.forEach(i=>{
      if(!i.objectId){ A('warn','NO_OBJECT_ID','Экземпляр без objectId.'); return; }
      if(!idx.obj.has(i.objectId)) missing.set(i.objectId,(missing.get(i.objectId)||0)+1);
    });
    missing.forEach((n,oid)=>A('err','OBJECT_MISSING',`Объект «${oid}» не найден в data/objects (экземпляров: ${n}).`));
    // размер экземпляра записан в комнате (его читает игра) — сверяем с текущим размером объекта в ОС
    const stale=new Map();
    r.instances.forEach(i=>{
      const o=idx.obj.get(i.objectId); if(!o||!o.widthCm||!o.heightCm) return;
      const w=num(i.realWidthCm), h=num(i.realHeightCm); if(!(w>0&&h>0)) return;
      if(Math.abs(w-o.widthCm)>0.5||Math.abs(h-o.heightCm)>0.5){ if(!stale.has(o.id)) stale.set(o.id,{n:0,w,h,o}); stale.get(o.id).n++; }
    });
    stale.forEach(v=>A('warn','INSTANCE_SIZE',`Размер «${v.o.name}» в комнате ${v.w}×${v.h} см (экземпляров: ${v.n}), в ОС ${v.o.widthCm}×${v.o.heightCm} см — нажми в Room Editor «📐 Размеры из ОС во всех комнатах».`));

    // двери
    r.doors.forEach(dr=>{
      if(!dr.toRoom) A('warn','DOOR_NO_TARGET',`Дверь №${dr.idx+1} (${dr.objectId}) не ведёт никуда.`);
      else if(dr.toRoom===r.id) A('warn','DOOR_SELF',`Дверь №${dr.idx+1} ведёт в эту же комнату.`);
      else if(!idx.room.has(dr.toRoom)) A('err','DOOR_TARGET',`Дверь №${dr.idx+1} ведёт в несуществующую комнату «${dr.toRoom}».`);
    });

    // блоки
    r.blockTypes.forEach((n,type)=>{
      const o=idx.obj.get(type);
      if(!o) A('err','BLOCK_TYPE_MISSING',`Тип блока «${type}» не найден в data/objects (блоков: ${n}).`);
      else if(o.category!=='block') A('warn','BLOCK_TYPE_CATEGORY',`Тип блока «${type}» — объект категории «${o.category}», а не «Блок / материал» (блоков: ${n}).`);
    });
    if(r.blocksOutside) A('warn','BLOCK_OUTSIDE',`Блоков за границей комнаты: ${r.blocksOutside} (сохраняются, но не видны — сотри их в Room Editor).`);
    if(r.hasBlocks&&(!isWholeMeter(r.widthM)||!isWholeMeter(r.heightM))) A('warn','BLOCK_ROOM_SIZE',`В комнате есть блоки, а размер ${fmtM(r.widthM)} × ${fmtM(r.heightM)} не кратен 1 м — крайние блоки выступают за границу, сетки соседних комнат не сойдутся.`);
    if(r.legacyBlockState) A('info','LEGACY_BLOCK_STATE',`Блоков в старом формате (state вместо mask): ${r.legacyBlockState}. Читаются как целые/пустые, при пересохранении станут новыми.`);
    if(r.legacyNeighbors) A('info','LEGACY_NEIGHBORS','Есть ключ world.neighbors (окружение 3×3) — оно больше не используется, ключ пропадёт при пересохранении.');

    // фоны
    if(spritesKnown) r.bgLayers.forEach(p=>{ if(!idx.sprites.has(normPath(p))) A('warn','BG_MISSING',`Фон комнаты не найден в assets/sprites: ${normPath(p)}.`); });
  });
}

function entryDims(e){
  const r=idx.room.get(e.roomId); if(!r) return null;
  const c=e.crop||{l:0,r:0,t:0,b:0};
  return {room:r,w:r.widthM-c.l-c.r,h:r.heightM-c.t-c.b};
}
function checkBuildings(add){
  const R=registry, spritesKnown=!R.missing.sprites;
  const byId=new Map(); R.buildings.forEach(b=>{ if(!byId.has(b.id)) byId.set(b.id,[]); byId.get(b.id).push(b); });
  byId.forEach((list,id)=>{ if(list.length>1) list.forEach(b=>add('err','ID_DUP','building',b.id,`Одинаковый id «${id}» в файлах: ${list.map(x=>x.file).join(', ')}.`)); });
  R.buildings.forEach(b=>{
    const A=(l,c,m)=>add(l,c,'building',b.id,m);
    if(b.fileBase!==b.id) A('warn','ID_FILE',`Имя файла «${b.file}» не совпадает с id «${b.id}».`);
    if(b.schema&&b.schema<4) A('info','LEGACY_UNITS',`Старый формат (schema_version ${b.schema}): позиции пересчитаны из px при 640 px/м.`);
    if(!b.entries.length) A('warn','EMPTY','В здании нет ни одной комнаты.');
    if(spritesKnown) b.bgLayers.forEach(p=>{ if(!idx.sprites.has(normPath(p))) A('warn','BG_MISSING',`Фон здания не найден в assets/sprites: ${normPath(p)}.`); });

    if(b.mode==='STREET'){
      let cursor=0, unknown=false, maxH=0;
      b.entries.forEach(e=>{ const r=idx.room.get(e.roomId); if(e.type!=='POOL'&&r) maxH=Math.max(maxH,r.heightM); });
      const hasPool=b.entries.some(e=>e.type==='POOL'&&e.count>0);
      b.entries.forEach((e,i)=>{
        if(e.type==='POOL'){
          if(!e.typeFilter) A('warn','SLOT_NO_TYPE',`Элемент №${i+1}: пул без type_filter.`);
          else if(e.count>0&&!roomsMatchingSlot(e.typeFilter,'',[]).length) A('warn','SLOT_NO_MATCH',`Элемент №${i+1}: в пуле «${e.typeFilter}» нет ни одной подходящей комнаты.`);
          if(e.count>0) unknown=true;
          return;
        }
        const r=idx.room.get(e.roomId);
        if(!e.roomId) A('err','ROOM_EMPTY',`Элемент №${i+1}: комната не указана.`);
        else if(!r) A('err','ROOM_MISSING',`Элемент №${i+1}: комната «${e.roomId}» не найдена.`);
        else {
          if(r.hasBlocks&&!unknown){
            if(!isWholeMeter(cursor)) A('warn','BLOCK_GRID',`Элемент №${i+1} «${r.name}»: комната с блоками начинается на ${fmtM(cursor)} от начала улицы — не на целом метре (проверь размеры комнат перед ней).`);
            if(!hasPool&&!isWholeMeter(maxH-r.heightM)) A('warn','BLOCK_GRID',`Элемент №${i+1} «${r.name}»: низ улицы выровнен по самой высокой комнате, и сетка блоков по вертикали сдвигается не на целый метр.`);
          }
          cursor+=r.widthM;
        }
      });
      return;
    }

    // режим «Здание»
    const dimsList=[];
    b.entries.forEach((e,i)=>{
      const tag=`Комната №${i+1}`+(e.instanceId?` (${e.instanceId})`:'');
      if(e.mode==='RANDOM'){
        if(!e.typeFilter) A('warn','SLOT_NO_TYPE',`${tag}: у случайного слота не задан тип.`);
        else if(!roomsMatchingSlot(e.typeFilter,e.role,e.stairs).length) A('warn','SLOT_NO_MATCH',`${tag}: нет комнат типа «${e.typeFilter}»`+(e.role?` с ролью ${e.role}`:'')+((e.stairs||[]).length?` и лестницами ${(e.stairs||[]).join(', ')}`:'')+'.');
        if(e.roomId&&!idx.room.has(e.roomId)) A('warn','ROOM_MISSING',`${tag}: выбранная при редактировании комната «${e.roomId}» не найдена.`);
      } else if(!e.roomId) A('err','ROOM_EMPTY',`${tag}: комната не указана.`);
      else if(!idx.room.has(e.roomId)) A('err','ROOM_MISSING',`${tag}: комната «${e.roomId}» не найдена.`);
      const dm=entryDims(e);
      if(dm){
        dimsList.push({e,i,dm});
        if(dm.room.hasBlocks){
          const ox=e.x-e.crop.l, oy=e.y-e.crop.t;
          if(!isWholeMeter(ox)||!isWholeMeter(oy)) A('warn','BLOCK_GRID',`${tag} «${dm.room.name}»: комната с блоками стоит не на целом метре (сетка блоков начинается в ${fmtM(ox)}; ${fmtM(oy)}) — ямы и грунт не сойдутся с соседями.`);
        }
      }
    });
    for(let i=0;i<dimsList.length;i++) for(let j=i+1;j<dimsList.length;j++){
      const a=dimsList[i], c=dimsList[j];
      if(a.e.floor!==c.e.floor) continue;
      if(a.e.x<c.e.x+c.dm.w-0.01&&a.e.x+a.dm.w>c.e.x+0.01&&a.e.y<c.e.y+c.dm.h-0.01&&a.e.y+a.dm.h>c.e.y+0.01)
        A('warn','OVERLAP',`Комнаты «${a.dm.room.name}» (№${a.i+1}) и «${c.dm.room.name}» (№${c.i+1}) пересекаются на этаже ${a.e.floor}.`);
    }
    // связи дверей
    const byInstance=new Map(b.entries.filter(e=>e.instanceId).map(e=>[e.instanceId,e]));
    b.doorLinks.forEach((l,k)=>['a','b'].forEach(side=>{
      const s=l&&l[side]; if(!s) return;
      const e=byInstance.get(s.room_instance);
      if(!e){ A('err','DOORLINK_BROKEN',`Связь дверей №${k+1}: комната-экземпляр «${s.room_instance}» не найдена в здании.`); return; }
      const r=idx.room.get(e.roomId);
      if(r&&!(s.door_index>=0&&s.door_index<r.doors.length)) A('err','DOORLINK_BROKEN',`Связь дверей №${k+1}: у комнаты «${r.name}» нет двери с номером ${s.door_index}.`);
    }));
  });
}

function checkSets(add){
  registry.sets.forEach(s=>{
    const miss=[...new Set(s.objects.filter(id=>!idx.obj.has(id)))];
    miss.forEach(id=>add('err','OBJECT_MISSING','set',s.id,`Объект «${id}» не найден в data/objects.`));
    if(!s.objects.length) add('info','EMPTY','set',s.id,'В наборе нет объектов.');
  });
}

function checkAssembler(add){
  const R=registry;
  R.characters.forEach(c=>{
    if(c.rig&&!idx.rig.has(c.rig)) add('err','RIG_MISSING','character',c.id,`Риг «${c.rig}» не найден.`);
    c.layers.forEach(l=>{
      if(!l.part) return;
      const list=R.parts[c.rig+'/'+l.slot];
      if(!(list&&list.includes(l.part))) add('err','PART_MISSING','character',c.id,`Часть «${l.part}» в слоте «${l.slot}» не найдена.`);
    });
  });
}

function checkRecipes(add){
  const R=registry, rec=R.recipes;
  if(!rec||typeof rec!=='object') return;
  Object.keys(rec).forEach(type=>{
    const rows=Array.isArray(rec[type])?rec[type]:[];
    if(!dict.roomTypes.get(type)||!dict.roomTypes.get(type).rooms.length) add('info','RECIPE_TYPE','project','data/room_recipes.json',`Рецепт для типа «${type}»: комнат такого типа пока нет.`);
    rows.forEach((row,i)=>{
      if(!row) return;
      if(row.group&&!(dict.groups.get(row.group)&&dict.groups.get(row.group).objects.length)) add('warn','RECIPE_GROUP','project','data/room_recipes.json',`Рецепт «${type}», строка ${i+1}: нет объектов в группе «${row.group}».`);
      if(num(row.min)>num(row.max)) add('warn','RECIPE_RANGE','project','data/room_recipes.json',`Рецепт «${type}», строка ${i+1}: «от» больше «до».`);
    });
  });
}

// Файлы, которые не упоминаются ни в одном JSON проекта (одной находкой — список смотри в разделе «Файлы»)
function orphanFiles(){
  const R=registry;
  return { sprites:R.sprites.filter(p=>!R.refs.has(p)), sounds:R.sounds.filter(p=>!R.refs.has(p)) };
}
function checkFiles(add){
  const o=orphanFiles(), n=o.sprites.length+o.sounds.length;
  if(n) add('info','FILE_ORPHANS','project','files',`Файлов, которые не упоминаются ни в одном JSON: ${n} (картинок ${o.sprites.length}, звуков ${o.sounds.length}). Список — в разделе «Файлы». Части и картинки Character Assembler могут быть перечислены неполно.`);
}
