/* ============================================================
   MODULE 02 — SCAN
   Читает папку проекта и раскладывает всё в `registry`. Никаких проверок и связей здесь нет —
   они считаются в модулях 03 (связи) и 04 (проверки).

   Источники (те же файлы, что читают редакторы и игра):
     data/objects/*.json      ОС
     data/rooms/*.json        Room Editor
     data/buildings/*.json    Building Editor
     data/sets/*.json         Room Editor (наборы, служебные)
     data/characters|rigs/*.json, data/parts/<риг>/<слот>/*.json   Character Assembler
     data/categories.json     категории ОС (пишет ОС)
     data/project_settings.json, data/room_recipes.json            Room Editor
     assets/sprites/**, assets/sounds/**                            картинки и звуки
   ============================================================ */

let registry=emptyRegistry();
function emptyRegistry(){
  return { objects:[], rooms:[], buildings:[], sets:[], characters:[], rigs:[], parts:{},   // parts: 'риг/слот' → [имена]
    sprites:[], sounds:[], settings:null, categoriesFile:null, recipes:null,
    missing:{}, problems:[], refs:new Set(), scannedAt:null };
}
function mkProblem(level,code,kind,id,msg){ return {level,code,kind,id,msg}; }
function setScanStatus(t){ const el=document.getElementById('scanStatus'); if(el) el.textContent=t||''; }

async function scanObjects(R){
  const {items,missing}=await listJsonDir('data/objects'); if(missing) R.missing.objects=true;
  for(const f of items){
    const base=f.name.replace(/\.json$/i,'');
    if(f.broken||!f.data||typeof f.data!=='object'){ R.problems.push(mkProblem('err','JSON_BROKEN','file','data/objects/'+f.name,'Не удалось прочитать JSON.')); continue; }
    const d=f.data, b=d.behavior||{}, a=d.appearance||{}, id=String(d.id||base);
    collectStrings(d,R.refs);
    const o={ kind:'object', id, name:d.name||id, file:f.name, fileBase:base, category:d.category||'', categoryName:d.category_name||'', subtype:d.subtype||'',
      tags:Array.isArray(d.tags)?d.tags:[], widthCm:num(b.real_width_cm), heightCm:num(b.real_height_cm),
      physics:b.physics||'', collision:b.collision||'', placement:b.placement_mode||'', variantGroup:b.variant_group||'',
      allowedRoomTypes:Array.isArray(b.allowed_room_types)?b.allowed_room_types:[],
      asset:a.asset||'', destructible:!!(d.destruction&&d.destruction.enabled), hp:num(d.destruction&&d.destruction.hp),
      crafting:!!(d.crafting&&d.crafting.enabled), weight:b.hasWeight?num(b.weight):0,
      block:(d.block&&typeof d.block==='object')?d.block:null, schema:num(d.schema_version), raw:d,
      uses:[], usedBy:{rooms:new Map(),blocks:new Map(),sets:new Map(),objects:[]}, thumb:null };
    o.search=[o.id,o.name,o.category,o.categoryName,o.subtype,o.tags.join(' '),o.variantGroup].join(' ').toLowerCase();
    R.objects.push(o);
  }
}
async function scanRooms(R){
  const {items,missing}=await listJsonDir('data/rooms'); if(missing) R.missing.rooms=true;
  for(const f of items){
    const base=f.name.replace(/\.json$/i,'');
    if(f.broken||!f.data||typeof f.data!=='object'){ R.problems.push(mkProblem('err','JSON_BROKEN','file','data/rooms/'+f.name,'Не удалось прочитать JSON.')); continue; }
    const d=f.data, id=String(d.id||base);
    collectStrings(d,R.refs);
    const widthM=lenM(d,'widthM','width',6.4), heightM=lenM(d,'heightM','height',2.2);
    const instances=Array.isArray(d.instances)?d.instances.filter(Boolean):[];
    const doors=[]; instances.forEach(i=>{ if(i.door) doors.push({objectId:i.objectId||'',toRoom:i.door.toRoom||'',idx:doors.length}); });
    const wb=(d.world&&Array.isArray(d.world.blocks))?d.world.blocks:[];
    const blockTypes=new Map(); let outside=0, legacyState=0;
    const cols=Math.ceil(widthM-1e-9), rows=Math.ceil(heightM-1e-9);
    wb.forEach(b=>{
      if(!b) return;
      blockTypes.set(b.type||'',(blockTypes.get(b.type||'')||0)+1);
      if(!(b.cx>=0&&b.cy>=0&&b.cx<cols&&b.cy<rows)) outside++;
      if(b.state!==undefined&&b.mask===undefined) legacyState++;
    });
    const r={ kind:'room', id, name:d.name||id, type:d.type||'', file:f.name, fileBase:base, widthM, heightM,
      role:d.compositionRole||'CENTER_CENTER',
      stairs:(Array.isArray(d.stairConnections)?d.stairConnections:[]).map(x=>typeof x==='string'?x:(x&&x.position)).filter(Boolean),
      instances, instCount:instances.length, doors,
      blockCount:wb.length, blockTypes, blocksOutside:outside, legacyBlockState:legacyState,
      legacyNeighbors:!!(d.world&&d.world.neighbors),
      bgLayers:(d.backgroundLayers||[]).map(l=>l&&l.image).filter(Boolean),
      schema:num(d.schema_version), raw:d,
      usedObjects:new Map(), usedBy:{buildings:[],doors:[],slots:[]} };
    r.hasBlocks=r.blockCount>0;
    r.search=[r.id,r.name,r.type,r.role].join(' ').toLowerCase();
    R.rooms.push(r);
  }
}
function cropM(item,k){
  if(item&&item.crop_m) return num(item.crop_m[k]);
  if(item&&item.crop) return num(item.crop[k])/LEGACY_PPM;
  return 0;
}
async function scanBuildings(R){
  const {items,missing}=await listJsonDir('data/buildings'); if(missing) R.missing.buildings=true;
  for(const f of items){
    const base=f.name.replace(/\.json$/i,'');
    if(f.broken||!f.data||typeof f.data!=='object'){ R.problems.push(mkProblem('err','JSON_BROKEN','file','data/buildings/'+f.name,'Не удалось прочитать JSON.')); continue; }
    const d=f.data, id=String(d.id||base), mode=d.layout_mode==='STREET'?'STREET':'BUILDING';
    collectStrings(d,R.refs);
    let entries;
    if(mode==='STREET'){
      entries=(Array.isArray(d.sequence)?d.sequence:[]).filter(Boolean).map(x=>({type:x.type||'FIXED',roomId:x.room||'',typeFilter:x.type_filter||'',count:num(x.count)}));
    } else {
      entries=(Array.isArray(d.rooms)?d.rooms:[]).filter(Boolean).map(x=>({instanceId:x.instance_id||'',roomId:x.room||'',mode:x.mode||'FIXED',typeFilter:x.type_filter||'',
        role:x.required_role||'',stairs:Array.isArray(x.required_stairs)?x.required_stairs:[],floor:num(x.floor),
        x:lenM(x,'x_m','x',0),y:lenM(x,'y_m','y',0),crop:{l:cropM(x,'left'),r:cropM(x,'right'),t:cropM(x,'top'),b:cropM(x,'bottom')}}));
    }
    const b={ kind:'building', id, name:d.name||id, file:f.name, fileBase:base, mode, entries,
      bgLayers:(d.backgroundLayers||[]).map(l=>l&&l.image).filter(Boolean),
      doorLinks:Array.isArray(d.door_links)?d.door_links:[], schema:num(d.schema_version), raw:d };
    b.floors=[...new Set(entries.map(e=>e.floor).filter(v=>v!==undefined))].sort((x,y)=>x-y);
    b.randomCount=entries.filter(e=>e.mode==='RANDOM'||e.type==='POOL').length;
    b.search=[b.id,b.name,b.mode].join(' ').toLowerCase();
    R.buildings.push(b);
  }
}
async function scanSets(R){
  const {items}=await listJsonDir('data/sets');
  for(const f of items){
    const base=f.name.replace(/\.json$/i,'');
    if(f.broken||!f.data){ R.problems.push(mkProblem('err','JSON_BROKEN','file','data/sets/'+f.name,'Не удалось прочитать JSON.')); continue; }
    const d=f.data, id=String(d.id||base);
    collectStrings(d,R.refs);
    const s={ kind:'set', id, name:d.name||id, file:f.name, fileBase:base, objects:(Array.isArray(d.objects)?d.objects:[]).map(o=>o&&o.objectId).filter(Boolean),
      bgCount:(d.background_layers||[]).length, schema:num(d.schema_version), raw:d };
    s.search=[s.id,s.name].join(' ').toLowerCase();
    R.sets.push(s);
  }
}
// Character Assembler: персонажи, риги, части. Формат читаем так же, как проверка ссылок в ОС.
async function scanAssembler(R){
  const chars=await listJsonDir('data/characters'), rigs=await listJsonDir('data/rigs');
  for(const f of chars.items){
    const base=f.name.replace(/\.json$/i,'');
    if(f.broken||!f.data){ R.problems.push(mkProblem('err','JSON_BROKEN','file','data/characters/'+f.name,'Не удалось прочитать JSON.')); continue; }
    const d=f.data, id=String(d.id||base); collectStrings(d,R.refs);
    const c={ kind:'character', id, name:d.name||id, file:f.name, rig:d.rig||'', layers:(Array.isArray(d.layers)?d.layers:[]).filter(Boolean).map(l=>({slot:l.slot||'',part:l.part||''})), raw:d };
    c.search=[c.id,c.name,c.rig].join(' ').toLowerCase(); R.characters.push(c);
  }
  for(const f of rigs.items){
    const base=f.name.replace(/\.json$/i,'');
    if(f.broken||!f.data){ R.problems.push(mkProblem('err','JSON_BROKEN','file','data/rigs/'+f.name,'Не удалось прочитать JSON.')); continue; }
    const d=f.data, id=String(d.id||base); collectStrings(d,R.refs);
    const g={ kind:'rig', id, name:d.name||id, file:f.name, raw:d };
    g.search=[g.id,g.name].join(' ').toLowerCase(); R.rigs.push(g);
  }
  try{
    const root=await getSubdir(projectDirHandle,'data/parts',false);
    for await(const [rigName,rigH] of root.entries()){
      if(rigH.kind!=='directory') continue;
      for await(const [slotName,slotH] of rigH.entries()){
        if(slotH.kind!=='directory') continue;
        const names=[];
        for await(const [fname,fh] of slotH.entries()){
          if(fh.kind!=='file'||!/\.json$/i.test(fname)) continue;
          names.push(fname.replace(/\.json$/i,''));
          const r=await readJsonFile(slotH,fname); if(r.data) collectStrings(r.data,R.refs);
        }
        R.parts[rigName+'/'+slotName]=names;
      }
    }
  }catch(e){ /* data/parts может отсутствовать */ }
}
async function scanFiles(R){
  const sp=await listFilesRecursive('assets/sprites',SPRITE_EXT), sn=await listFilesRecursive('assets/sounds',SOUND_EXT);
  R.sprites=sp.files; R.sounds=sn.files;
  if(sp.missing) R.missing.sprites=true; if(sn.missing) R.missing.sounds=true;
}
async function scanSettings(R){
  let dir=null; try{ dir=await getSubdir(projectDirHandle,'data',false); }catch(e){ R.missing.data=true; return; }
  const s=await readJsonFile(dir,'project_settings.json'); R.settings=s.data;
  const c=await readJsonFile(dir,'categories.json'); R.categoriesFile=c.data;
  const r=await readJsonFile(dir,'room_recipes.json'); R.recipes=r.data;
}

async function scanProject(){
  if(!projectDirHandle){ alert('Сначала подключи папку проекта.'); return; }
  setScanStatus('Сканирование…');
  const R=emptyRegistry();
  try{
    await scanObjects(R); setScanStatus('Объекты ✓');
    await scanRooms(R); await scanBuildings(R); await scanSets(R); setScanStatus('Комнаты, здания ✓');
    await scanAssembler(R); await scanFiles(R); await scanSettings(R);
  }catch(e){ console.error(e); setScanStatus('Ошибка сканирования: '+e.message); }
  R.scannedAt=new Date();
  registry.objects.forEach(o=>{ if(o.thumb) URL.revokeObjectURL(o.thumb); });
  registry=R;
  buildRelations();
  runChecks();
  render();
  setScanStatus('Готово · '+R.scannedAt.toLocaleTimeString());
  loadThumbs();
}
