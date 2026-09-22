/* ============================================================
   MODULE 01 — GLOBAL DATA / UTILITIES / UNITS
   Effects, skills, game-meter units, helpers, catalog and preset state.
   Keep this block before modules that consume these definitions.
   ============================================================ */

/* ============================================================
   Каталоги навыков/эффектов — должны быть определены РАНЬШЕ, чем
   что-либо ещё, потому что renderAnimSkillRows() и подобные вызываются
   уже при самой загрузке страницы (ниже) и сразу их используют.
   ============================================================ */
const EFFECTS_BUILTIN=[
  ['damage_physical','Физический урон'],['heal','Лечение'],
  ['thirst_restore','Восстановление жажды'],['hunger_restore','Восстановление голода'],['energy_restore','Восстановление энергии'],
  ['stress_change','Изменение стресса'],['morale_change','Изменение морали'],
  ['armor_buff','Бафф брони'],['speed_buff','Бафф скорости'],['strength_buff','Бафф силы'],
  ['poison','Отравление'],['bleeding','Кровотечение'],['buff','Бафф (общий)'],['debuff','Дебафф (общий)']
];
const CUSTOM_EFFECTS_KEY='uoc_custom_effects_v1';
function loadCustomEffects(){ try{ return JSON.parse(localStorage.getItem(CUSTOM_EFFECTS_KEY)||'[]'); }catch(e){ return []; } }
function saveCustomEffects(l){ try{ localStorage.setItem(CUSTOM_EFFECTS_KEY, JSON.stringify(l)); }catch(e){} }
function allEffects(){ return [...EFFECTS_BUILTIN, ...loadCustomEffects()]; }

const SKILLS_BUILTIN=[
  ['strength','Сила'],['endurance','Выносливость'],['fortitude','Крепость'],['agility','Ловкость'],
  ['repair','Ремонт'],['building','Строительство'],['crafting','Крафт'],['cooking','Готовка'],['medicine','Медицина'],
  ['exploration','Исследование'],['orientation','Ориентирование'],
  ['weapons','Оружие'],['melee','Ближний бой'],['shooting','Стрельба'],
  ['stealth','Скрытность'],['pickpocketing','Карманная кража'],['lockpicking','Взлом'],
  ['intelligence','Интеллект'],['negotiation','Переговоры'],['trading','Торговля']
];
const CUSTOM_SKILLS_KEY='uoc_custom_skills_v1';
function loadCustomSkills(){ try{ return JSON.parse(localStorage.getItem(CUSTOM_SKILLS_KEY)||'[]'); }catch(e){ return []; } }
function saveCustomSkills(l){ try{ localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(l)); }catch(e){} }
function allSkills(){ return [...SKILLS_BUILTIN, ...loadCustomSkills()]; }

let animPlaying=false, animPlayTimer=null, animPlayImgs=[], animPlayIdx=0; // тоже используется раньше своего старого места объявления
function switchObjectTab(button){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  button.classList.add('active');
  document.querySelectorAll('.tabpanel').forEach(x=>x.classList.add('hidden'));
  const panel=document.getElementById('panel-'+button.dataset.tab);
  if(panel) panel.classList.remove('hidden');
  if(typeof syncPreview==='function') syncPreview();
}

function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
let customFields=[]; // {name,value}[] — свои поля объекта, дружелюбная форма поверх raw JSON
function parseCustomFieldValue(v){
  if(v==='true')return true; if(v==='false')return false;
  if(v!=='' && !isNaN(v)) return +v;
  return v;
}
function renderCustomFieldList(){
  const box=document.getElementById('customFieldList');
  if(!customFields.length){ box.innerHTML='<span class="muted">Пока пусто.</span>'; return; }
  box.innerHTML=customFields.map((f,i)=>`
    <div class="row" style="margin-bottom:4px" data-idx="${i}">
      <input class="cf-name" value="${esc(f.name)}" placeholder="имя" style="width:220px">
      <input class="cf-value" value="${esc(f.value)}" placeholder="значение" style="width:220px">
      <button type="button" class="cf-del">✕</button>
    </div>`).join('');
  box.querySelectorAll('[data-idx]').forEach(row=>{
    const i=+row.dataset.idx;
    row.querySelector('.cf-name').oninput=e=>{ customFields[i].name=e.target.value; if(window.update)window.update(); };
    row.querySelector('.cf-value').oninput=e=>{ customFields[i].value=e.target.value; if(window.update)window.update(); };
    row.querySelector('.cf-del').onclick=()=>{ customFields.splice(i,1); renderCustomFieldList(); if(window.update)window.update(); };
  });
}
document.getElementById('btnAddCustomField').onclick=()=>{
  const nameEl=document.getElementById('newCustomFieldName'), valEl=document.getElementById('newCustomFieldValue');
  const name=nameEl.value.trim(); if(!name)return;
  customFields.push({name, value:valEl.value});
  nameEl.value=''; valEl.value='';
  renderCustomFieldList();
  if(window.update)window.update();
};
/* ============================================================
   GLOBAL UTILS: zip writer+reader, catalog, presets, translit
   ============================================================ */
function sanitizeSlug(s){ return (s||"").toLowerCase().replace(/[^a-z0-9_\-]+/g,"_").replace(/^_+|_+$/g,""); }
function sanitizeFilenamePreserve(s){ return (s||"object").replace(/[\\/:*?"<>|]+/g,"_").trim() || "object"; }
function translit(str){
  const map={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return (str||"").toLowerCase().split("").map(c=>map[c]!==undefined?map[c]:(/[a-z0-9]/.test(c)?c:"_")).join("").replace(/_+/g,"_").replace(/^_|_$/g,"");
}
async function dataURLToBytes(dataURL){ const r=await fetch(dataURL); return new Uint8Array(await r.arrayBuffer()); }
function bytesToDataURL(bytes, mime){ return new Promise(resolve=>{ const blob=new Blob([bytes],{type:mime}); const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.readAsDataURL(blob); }); }

let __crc32table=null;
function crc32(buf){
  if(!__crc32table){ __crc32table=new Uint32Array(256); for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);__crc32table[n]=c>>>0} }
  let crc=0xFFFFFFFF; for(let i=0;i<buf.length;i++) crc=__crc32table[(crc^buf[i])&0xFF]^(crc>>>8); return (crc^0xFFFFFFFF)>>>0;
}
function makeZip(files){
  const encoder=new TextEncoder(); const localParts=[],centralParts=[]; let offset=0; const dosTime=0,dosDate=0x21;
  files.forEach(f=>{
    const nameBytes=encoder.encode(f.name), data=f.data, crc=crc32(data), size=data.length;
    const local=new Uint8Array(30+nameBytes.length), dv=new DataView(local.buffer);
    dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0,true);dv.setUint16(8,0,true);
    dv.setUint16(10,dosTime,true);dv.setUint16(12,dosDate,true);dv.setUint32(14,crc,true);
    dv.setUint32(18,size,true);dv.setUint32(22,size,true);dv.setUint16(26,nameBytes.length,true);dv.setUint16(28,0,true);
    local.set(nameBytes,30); localParts.push(local,data);
    const central=new Uint8Array(46+nameBytes.length), cdv=new DataView(central.buffer);
    cdv.setUint32(0,0x02014b50,true);cdv.setUint16(4,20,true);cdv.setUint16(6,20,true);cdv.setUint16(8,0,true);cdv.setUint16(10,0,true);
    cdv.setUint16(12,dosTime,true);cdv.setUint16(14,dosDate,true);cdv.setUint32(16,crc,true);
    cdv.setUint32(20,size,true);cdv.setUint32(24,size,true);cdv.setUint16(28,nameBytes.length,true);
    cdv.setUint16(30,0,true);cdv.setUint16(32,0,true);cdv.setUint16(34,0,true);cdv.setUint16(36,0,true);
    cdv.setUint32(38,0,true);cdv.setUint32(42,offset,true);
    central.set(nameBytes,46); centralParts.push(central); offset+=local.length+data.length;
  });
  const centralStart=offset; let centralSize=0; centralParts.forEach(c=>centralSize+=c.length);
  const end=new Uint8Array(22), edv=new DataView(end.buffer);
  edv.setUint32(0,0x06054b50,true);edv.setUint16(4,0,true);edv.setUint16(6,0,true);
  edv.setUint16(8,files.length,true);edv.setUint16(10,files.length,true);
  edv.setUint32(12,centralSize,true);edv.setUint32(16,centralStart,true);edv.setUint16(20,0,true);
  return new Blob([...localParts,...centralParts,end],{type:"application/zip"});
}
// Minimal ZIP reader — only supports "stored" (uncompressed) entries, which is all makeZip() ever produces.
async function readZip(arrayBuffer){
  const dv=new DataView(arrayBuffer); const bytes=new Uint8Array(arrayBuffer);
  const files={};
  let i=0;
  while(i < bytes.length-4){
    const sig=dv.getUint32(i,true);
    if(sig!==0x04034b50) break;
    const method=dv.getUint16(i+8,true);
    const compSize=dv.getUint32(i+18,true);
    const nameLen=dv.getUint16(i+26,true);
    const extraLen=dv.getUint16(i+28,true);
    const nameBytes=bytes.slice(i+30,i+30+nameLen);
    const name=new TextDecoder().decode(nameBytes);
    const dataStart=i+30+nameLen+extraLen;
    const data=bytes.slice(dataStart,dataStart+compSize);
    if(method===0) files[name]=data;
    i=dataStart+compSize;
  }
  return files;
}
function downloadBlob(blob,filename){ const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=filename; document.body.appendChild(a);a.click();a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }

/* ---- catalog (shared library of everything ever saved/exported) ---- */
const CATALOG_KEY='uoc_catalog_v1';
function loadCatalog(){ try{ return JSON.parse(localStorage.getItem(CATALOG_KEY)||"[]"); }catch(e){ return []; } }
function saveCatalogList(list){ try{ localStorage.setItem(CATALOG_KEY, JSON.stringify(list)); }catch(e){ console.warn("Каталог не сохранён (возможно переполнен localStorage)",e); } }
function addToCatalog(entry){ // entry: {id,category,name,image(dataURL flattened preview),json}
  const list=loadCatalog();
  const idx=list.findIndex(x=>x.id===entry.id);
  if(idx>=0) list[idx]=entry; else list.push(entry);
  saveCatalogList(list);
  renderCatalogSidebar();
}
// Превью объекта каталога. Нет картинки → аккуратная заглушка с подсказкой (а не «битая» иконка браузера).
function catalogThumbHtml(e,size,extraStyle){
  const s=size||18;
  if(e&&e.image) return `<img src="${e.image}" style="width:${s}px;height:${s}px;object-fit:contain;image-rendering:pixelated;${extraStyle||''}">`;
  const iss=e&&e.imageIssue;
  const why=iss ? (iss.kind==='invalid'?'Файл картинки повреждён (пустой или не PNG): ':'Основная картинка не найдена на диске: ')+'assets/sprites/'+iss.path
                : 'У объекта нет картинки: не задана основная картинка и нет кадров анимации';
  return `<span class="thumb-empty" title="${esc(why)}" style="width:${s}px;height:${s}px">${iss?'⚠':''}</span>`;
}
function renderCatalogSidebar(){
  const list = projectDirHandle ? projectCatalog : loadCatalog();
  const el=document.getElementById('catalogList');
  if(!list.length){ el.textContent = projectDirHandle ? 'В подключённой папке пока нет сохранённых объектов.' : 'Пока пусто.'; return; }
  el.innerHTML = list.slice().reverse().slice(0,30).map(e=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px" title="${esc((e.id||'')+' · '+((typeof CAT_LABELS!=='undefined'&&CAT_LABELS[e.category])||e.category||''))}">${catalogThumbHtml(e,18,'background:#0d1116;border-radius:3px')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name||e.id)}</span></div>`).join('') + (list.length>30?`<div class="muted">…и ещё ${list.length-30}</div>`:'');
  renderObjectCatalogList(list);
}
function renderObjectCatalogList(list){
  list = list || (projectDirHandle ? projectCatalog : loadCatalog());
  const dl=document.getElementById('objectCatalogList'); if(!dl)return;
  dl.innerHTML=list.map(e=>`<option value="${esc(e.id)}">${esc(e.name||e.id)} (${esc(e.category||'')})</option>`).join('');
  renderVariantGroupList(list);
}
function renderVariantGroupList(list){
  list = list || (projectDirHandle ? projectCatalog : loadCatalog());
  const dl=document.getElementById('variantGroupList'); if(!dl)return;
  const groups=[...new Set(list.map(e=>e.json&&e.json.behavior&&e.json.behavior.variant_group).filter(Boolean))];
  dl.innerHTML=groups.map(g=>`<option value="${esc(g)}">`).join('');
  renderResourceTypeList(list);
}
function renderResourceTypeList(list){
  list = list || (projectDirHandle ? projectCatalog : loadCatalog());
  const dl=document.getElementById('resourceTypeList'); if(!dl)return;
  const types=[...new Set(list.map(e=>e.json&&e.json.behavior&&e.json.behavior.resource&&e.json.behavior.resource.type).filter(Boolean))];
  dl.innerHTML=types.map(t=>`<option value="${esc(t)}">`).join('');
}

/* ============================================================
   UNITS — ИГРОВЫЕ МЕТРЫ
   В JSON объекта длины хранятся в МЕТРАХ (суффикс _m), скорость — в м/с (_mps).
   Реальный размер объекта — по-прежнему в сантиметрах (real_width_cm / real_height_cm).
   Пиксели — только для отображения в превью: 100 px = 1 игровой метр.
   Старые файлы/пресеты/сессии (значения «px») читаются и пересчитываются сами.
   ============================================================ */
const PIXELS_PER_METER=100;
const LEGACY_GEOMETRY_PPM=640; // старые комнаты (schema_version<4): координаты в px при 640 px/м
const LEGACY_VALUE_PPM=100;    // старые радиусы света/зрения/слуха/звука и скорость были «px» без привязки к сцене
function mToPx(m){ return Math.round(m*PIXELS_PER_METER*1000)/1000; }
// Длина из JSON → px. mKeys: ключ(и) в метрах; legacyKey: старый ключ в px; иначе fallbackPx.
function lenPx(o,mKeys,legacyKey,fallbackPx,legacyPPM){
  if(!o) return fallbackPx;
  for(const k of [].concat(mKeys)){ const v=o[k]; if(v!==undefined&&v!==null&&Number.isFinite(+v)) return mToPx(+v); }
  if(legacyKey){ const v=o[legacyKey]; if(v!==undefined&&v!==null&&Number.isFinite(+v)) return Math.round(+v*PIXELS_PER_METER/(legacyPPM||LEGACY_GEOMETRY_PPM)*1000)/1000; }
  return fallbackPx;
}
// Масштаб фона комнаты: в JSON — реальная ширина в метрах (widthM), масштаб считаем от размера картинки.
function bgScaleFromJSON(l,nativeW){
  const wm=l&&l.widthM;
  if(wm!==undefined&&wm!==null&&nativeW>0) return mToPx(wm)/nativeW;
  return ((l&&l.scale!==undefined)?l.scale:1)*PIXELS_PER_METER/LEGACY_GEOMETRY_PPM;
}
// JSON комнаты (Room Editor, новый или старый) → тот же объект с числами в px (для превью)
function roomFromJSON(d){
  const width=lenPx(d,'widthM','width',6.4*PIXELS_PER_METER), height=lenPx(d,'heightM','height',2.2*PIXELS_PER_METER);
  const bgList=d.backgroundLayers||(d.background?[d.background]:[]);
  return {...d, width, height, backgroundLayers:bgList.map(l=>({...l, x:lenPx(l,'xM','x',width/2), y:lenPx(l,'yM','y',height/2)}))};
}
// Значение в метрах из JSON объекта: новый ключ (метры) → старый ключ (px / 100) → запасное.
function metersFromJSON(o,mKey,legacyKey,fallbackM){
  if(o&&o[mKey]!==undefined&&o[mKey]!==null) return +o[mKey];
  if(o&&o[legacyKey]!==undefined&&o[legacyKey]!==null) return Math.round(+o[legacyKey]/LEGACY_VALUE_PPM*100)/100;
  return fallbackM;
}
// Пресеты и сессии, сохранённые до перехода на метры (нет пометки units:'m'), содержат «px»
const LEGACY_UNIT_FIELDS=['lightRadius','visionRange','hearingRange','moveSpeed'];
function migrateLegacyFieldUnits(f){
  if(!f) return f; const c={...f};
  LEGACY_UNIT_FIELDS.forEach(k=>{ if(c[k]!==undefined&&c[k]!==''&&Number.isFinite(+c[k])) c[k]=String(Math.round(+c[k]/LEGACY_VALUE_PPM*100)/100); });
  return c;
}
function migrateLegacyAnimUnits(anims){
  return (anims||[]).map(a=>(a&&a.sound&&a.sound.radius!==undefined)?{...a,sound:{...a.sound,radius:Math.round(a.sound.radius/LEGACY_VALUE_PPM*100)/100}}:a);
}

/* ---- presets (named templates, no images) ---- */
const PRESET_KEY='uoc_presets_v1';
function loadPresets(){ try{ return JSON.parse(localStorage.getItem(PRESET_KEY)||"{}"); }catch(e){ return {}; } }
function savePresetsAll(p){ try{ localStorage.setItem(PRESET_KEY, JSON.stringify(p)); }catch(e){} }
function renderPresetSelect(){
  const presets=loadPresets(); const sel=document.getElementById('presetSelect');
  sel.innerHTML='<option value="">— выбрать пресет —</option>'+Object.keys(presets).map(k=>`<option value="${k}">${k}</option>`).join('');
}
