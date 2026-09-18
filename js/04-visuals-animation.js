/* ============================================================
   MODULE 04 — ANIMATIONS / VISUAL STATES
   Animation frames, visual states, FPS/Loop, sounds and frame editing.
   This is the generic animation system.
   ============================================================ */

/* ============================================================
   ВИЗУАЛЬНЫЕ СОСТОЯНИЯ (вкладка «Анимации») — единая, заново написанная реализация.
   animations[] — записи с несколькими кадрами (fps/loop/играть).
   imageStates[] — одиночные картинки-состояния (damaged/broken/своё).
   currentVisual={type:'animation'|'image', id} — какая карточка сейчас редактируется.
   frames / currentFrameIndex / animDoc — рабочий кадр ТЕКУЩЕЙ анимации (для картинки frames=[её doc]).
   ============================================================ */
let animations=[]; // {id, fps, loop, frames:[serialized,...], collisionMode, collisionPadding, sound:{...}, frameSounds:{}, skillProgress:[...]}
let imageStates=[]; // {id, doc:serialized, previewDataUrl, width, height, collisionMode, sourceFrame:{fromId,frameIndex}|null}
let currentVisual=null; // {type,id}
let currentAnimIndex=-1; // индекс в animations[], -1 если сейчас редактируется картинка или ничего
let frames=[]; // рабочий массив кадров ТЕКУЩЕЙ записи (и для анимации, и для картинки — тогда длина 1)
let currentFrameIndex=-1;
let refFrameW=0, refFrameH=0;
let animActiveLayerIndex=0;
let idleCreated=false;
let animSoundFiles=[]; // {name,dataUrl}[] — временный буфер файлов звука ТЕКУЩЕЙ анимации

const animCanvas=document.getElementById('visualCanvas');
const animDoc=new ImageDocument(animCanvas, document.getElementById('visualHandleLayer'));
const scratchCanvas=document.createElement('canvas');
const scratchHandleLayer=document.createElement('div');
const scratchDoc=new ImageDocument(scratchCanvas, scratchHandleLayer);
animDoc.onCommit=()=>scheduleHistoryPush();
animDoc.onChange=()=>{ renderAnimThumbs(); drawWorldPreview(); };

/* ---- пути для экспорта в JSON/файлы ---- */
function imageStateAssetPath(stateId){
  return `${currentCategory}/${val('subtype')?val('subtype')+'/':''}${sanitizeSlug(id())}_${sanitizeSlug(stateId)}.png`;
}
async function buildAnimSheetCanvas(frameList){
  if(!frameList.length)return document.createElement('canvas');
  const imgs=[];
  for(const f of frameList){ await scratchDoc.restore(f); imgs.push(scratchDoc.flatten()); }
  const w=Math.max(...imgs.map(c=>c.width)), h=Math.max(...imgs.map(c=>c.height));
  const sheet=document.createElement('canvas'); sheet.width=w*imgs.length; sheet.height=h;
  const ctx=sheet.getContext('2d');
  imgs.forEach((c,i)=>ctx.drawImage(c,i*w,0));
  return sheet;
}
function copyLayerToFrame(doc,layerId,frameIdx){
  const layer=doc.layers.find(l=>l.id===layerId); if(!layer||!frames[frameIdx])return;
  scratchDoc.restore(frames[frameIdx]).then(()=>{
    scratchDoc.layers.push({...layer,id:'layer_'+Date.now()+Math.random().toString(36).slice(2)});
    frames[frameIdx]=scratchDoc.serialize();
  });
}
function buildVisualsExport(){
  return {
    idle: idleCreated ? 'idle' : null,
    animations: animations.map(a=>{
      const isAssembled=a.source==='assembled';
      return {
        name:a.id, type:'animation', asset: isAssembled?a.sourceSheet:animSheetPathFor(a.id),
        frame_count: isAssembled?(a.frameCountMeta||0):a.frames.length, fps:a.fps||8, loop:a.loop!==false,
        source: isAssembled?'assembled':'drawn',
        collision: isAssembled?(a.sourceCollision||'FULL'):(a.collisionMode||'FULL'),
        sound: (!isAssembled && a.sound&&a.sound.enabled) ? { files:(a.sound.files||[]).map((f,i)=>animSoundPathFor(a.id,i,f.name)), volume:(a.sound.volume||80)/100, radius:a.sound.radius||300, mode:a.sound.mode||'single' } : null,
        skill_progress: (a.skillProgress||[]).map(s=>({skill:s.skill,xp:s.xp||0}))
      };
    }),
    images: imageStates.map(s=>({
      name:s.id, type:'image', asset: imageStateAssetPath(s.id),
      width:s.width||s.doc?.docW||0, height:s.height||s.doc?.docH||0,
      collision:s.collisionMode||'FULL',
      source_frame:s.sourceFrame||null
    }))
  };
}

/* ============================================================
   Список визуальных карточек + мастер добавления
   ============================================================ */
const VS_KEY='uoc_visual_names_v13';
function loadCustomVisualNames(){ try{ return JSON.parse(localStorage.getItem(VS_KEY)||'[]'); }catch(e){ return []; } }
function saveVisualName(kind,name){
  const list=loadCustomVisualNames(); const key=kind+':'+name;
  if(!list.includes(key)){ list.push(key); try{ localStorage.setItem(VS_KEY, JSON.stringify(list)); }catch(e){} }
}
let projectVisualNames={animation:new Set(), image:new Set()};
async function scanProjectVisualNames(){
  projectVisualNames={animation:new Set(), image:new Set()};
  if(!projectDirHandle)return;
  try{
    const dir=await getSubdir(projectDirHandle,'data/objects',false);
    for await (const [name,handle] of dir.entries()){
      if(handle.kind!=='file' || !name.endsWith('.json'))continue;
      try{
        const data=JSON.parse(await (await handle.getFile()).text());
        const v=data.visuals;
        if(v){
          (v.animations||[]).forEach(a=>{ if(a.name && a.name!=='idle') projectVisualNames.animation.add(a.name); });
          (v.images||[]).forEach(s=>{ if(s.name && s.name!=='idle') projectVisualNames.image.add(s.name); });
        }
      }catch(e){}
    }
  }catch(e){}
}
window.scanProjectVisualNames=scanProjectVisualNames;

const BUILTIN_ANIM_NAMES=[['idle','Простой / основной (idle)'],['walk','Ходьба'],['run','Бег'],['jump','Прыжок'],['fall','Падение'],['attack','Атака'],['attack_1','Атака 1'],['attack_2','Атака 2'],['hit','Получение удара'],['hurt','Боль / ранение'],['death','Смерть'],['block','Блок'],['dodge','Уклонение'],['roll','Кувырок'],['crouch','Приседание'],['sit','Сидит'],['sleep','Сон'],['climb','Лазанье'],['swim','Плавание'],['interact','Взаимодействие'],['use','Использование'],['pickup','Поднять'],['drop','Бросить / положить'],['throw','Бросок'],['equip','Экипировать'],['unequip','Снять'],['open','Открытие'],['close','Закрытие'],['repair','Ремонт'],['build','Строительство'],['craft','Крафт'],['work','Работа'],['mine','Добыча / ломание'],['harvest','Сбор'],['reload','Перезарядка'],['shoot','Выстрел']];
const BUILTIN_IMAGE_NAMES=[['damaged','Повреждённое состояние'],['destroyed','Разрушенное состояние'],['broken','Сломанное состояние'],['aged','Старое / изношенное состояние'],['open','Открытое состояние'],['closed','Закрытое состояние'],['on','Включено'],['off','Выключено']];

function usedVisualNames(){ return new Set([...animations.map(a=>a.id), ...imageStates.map(s=>s.id)]); }

function getVisualEntries(){
  return [
    ...animations.map(a=>({type:'animation',id:a.id})),
    ...imageStates.map(s=>({type:'image',id:s.id}))
  ];
}
function getVisualImageData(v){
  if(v.type==='animation'){
    const a=animations.find(x=>x.id===v.id);
    const fr=a && ((currentVisual&&currentVisual.type==='animation'&&currentVisual.id===a.id&&frames.length)?frames[0]:a.frames[0]);
    return fr?.layers?.[0]?.bitmap || null;
  }
  const s=imageStates.find(x=>x.id===v.id);
  return s?.previewDataUrl || null;
}
function renderVisualList(){
  const box=document.getElementById('visualList');
  const entries=getVisualEntries();
  if(!entries.length){ box.innerHTML='<div class="muted">Пока пусто — добавь первое состояние (обычно начинают с idle).</div>'; return; }
  box.innerHTML=entries.map(v=>{
    const active=currentVisual && currentVisual.type===v.type && currentVisual.id===v.id;
    const img=getVisualImageData(v);
    const label=v.type==='animation'?'🎞':'🖼';
    return `<div class="visual-card${active?' active':''}" data-type="${v.type}" data-id="${escV(v.id)}">
      <div class="vicon">${img?`<img src="${img}">`:label}</div>
      <div class="vmain"><div class="vname">${escV(v.id)}</div><div class="vmeta">${v.type==='animation'?'анимация':'картинка'}</div></div>
      <button class="vdel" data-del="1">✕</button>
    </div>`;
  }).join('');
  box.querySelectorAll('.visual-card').forEach(card=>{
    card.addEventListener('click', async e=>{
      if(e.target.dataset.del){ await deleteVisual(card.dataset.type, card.dataset.id); return; }
      await selectVisual(card.dataset.type, card.dataset.id);
    });
  });
}
function escV(s){ return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

document.getElementById('btnAddVisual').onclick=()=>{
  const box=document.getElementById('visualAddBox');
  const willShow=box.style.display==='none';
  box.style.display=willShow?'':'none';
  if(willShow) populateVisualAddNameSelect();
};
document.getElementById('btnVisualCancel').onclick=()=>{ document.getElementById('visualAddBox').style.display='none'; };
document.getElementById('visualKindSelect').onchange=populateVisualAddNameSelect;
function populateVisualAddNameSelect(){
  const kind=document.getElementById('visualKindSelect').value;
  const used=usedVisualNames();
  const sel=document.getElementById('visualNameSelect');
  const names=[];
  (kind==='animation'?BUILTIN_ANIM_NAMES:BUILTIN_IMAGE_NAMES).forEach(x=>names.push(x));
  loadCustomVisualNames().filter(x=>x.startsWith(kind+':')).forEach(x=>{ const n=x.slice(kind.length+1); if(n&&!names.some(y=>y[0]===n))names.push([n,n]); });
  (kind==='animation'?projectVisualNames.animation:projectVisualNames.image).forEach(n=>{ if(!names.some(y=>y[0]===n))names.push([n,n+' (из проекта)']); });
  const filtered=names.filter(x=>!used.has(x[0]));
  sel.innerHTML='<option value="">— выбери готовое имя —</option>'+filtered.map(x=>`<option value="${escV(x[0])}">${escV(x[1])}</option>`).join('');
  document.getElementById('visualCustomName').value='';
}
document.getElementById('btnVisualCreate').onclick=async ()=>{
  const kind=document.getElementById('visualKindSelect').value;
  const sel=document.getElementById('visualNameSelect').value.trim();
  const custom=document.getElementById('visualCustomName').value.trim();
  const name=custom||sel;
  if(!name)return alert('Укажи техническое имя.');
  if(!/^[A-Za-z0-9_-]+$/.test(name))return alert('Имя должно содержать латинские буквы, цифры, _ или -.');
  if(usedVisualNames().has(name))return alert('Такое имя уже занято в этом объекте.');
  saveVisualName(kind,name);
  if(kind==='animation'){
    animations.push({id:name, fps:8, loop:true, frames:[], collisionMode:'FULL', collisionPadding:0, sound:{enabled:false,source:'NEW',files:[],mode:'single',volume:80,radius:300}, skillProgress:[]});
    if(name==='idle')idleCreated=true;
    await selectVisual('animation',name);
  }else{
    imageStates.push({id:name, doc:null, previewDataUrl:null, width:0, height:0, collisionMode:'FULL', sourceFrame:null});
    if(name==='idle')idleCreated=true;
    await selectVisual('image',name);
  }
  document.getElementById('visualAddBox').style.display='none';
  renderVisualList();
  if(window.update)window.update();
};

async function deleteVisual(type,id){
  if(!confirm('Удалить «'+id+'»? Это действие необратимо для этого сеанса.'))return;
  if(type==='animation'){ const idx=animations.findIndex(a=>a.id===id); if(idx>=0)animations.splice(idx,1); if(id==='idle')idleCreated=false; }
  else{ const idx=imageStates.findIndex(s=>s.id===id); if(idx>=0)imageStates.splice(idx,1); if(id==='idle')idleCreated=false; }
  if(currentVisual && currentVisual.type===type && currentVisual.id===id){
    currentVisual=null; currentAnimIndex=-1; frames=[]; currentFrameIndex=-1;
    document.getElementById('visualEditor').style.display='none';
  }
  renderVisualList();
  if(window.update)window.update();
}

/* ============================================================
   Переключение между карточками — редактируем ровно одну запись за раз
   ============================================================ */
async function commitCurrentFrame(){
  if(!currentVisual || currentFrameIndex<0)return;
  const state=await animDoc.serialize();
  if(currentVisual.type==='animation'){
    frames[currentFrameIndex]=state;
    const a=animations.find(x=>x.id===currentVisual.id); if(a)a.frames=frames;
  }else{
    frames[0]=state;
    const s=imageStates.find(x=>x.id===currentVisual.id);
    if(s){ s.doc=state; s.width=state.docW||0; s.height=state.docH||0; s.previewDataUrl=animDoc.docW?animDoc.flatten().toDataURL():null; }
  }
}
async function selectVisual(type,id){
  if(currentVisual) await commitCurrentFrame();
  currentVisual={type,id};
  if(type==='animation'){
    const a=animations.find(x=>x.id===id);
    currentAnimIndex=animations.indexOf(a);
    frames=a.frames; currentFrameIndex=frames.length?0:-1;
    if(frames.length) await animDoc.restore(frames[0]); else animDoc.clear();
    fitVisualEditorZoom();
    document.getElementById('visualEditorTitle').textContent='Анимация: '+id;
    document.getElementById('visualFramesBlock').style.display='';
    document.getElementById('visualSoundSection').style.display='';
    document.getElementById('visualSkillSection').style.display='';
    document.getElementById('saveFrameAsStateRow').style.display='';
    document.getElementById('visualFps').value=a.fps||8;
    document.getElementById('visualLoop').checked=a.loop!==false;
    document.getElementById('visualCollisionMode').value=a.collisionMode||'FULL';
    loadSoundUiFromAnim(a);
    loadSkillUiFromAnim(a);
  }else{
    currentAnimIndex=-1;
    const s=imageStates.find(x=>x.id===id);
    frames=[s.doc||null]; currentFrameIndex=0;
    if(s.doc) await animDoc.restore(s.doc); else animDoc.clear();
    document.getElementById('visualEditorTitle').textContent='Картинка: '+id;
    document.getElementById('visualFramesBlock').style.display='none';
    document.getElementById('visualSoundSection').style.display='none';
    document.getElementById('visualSkillSection').style.display='none';
    document.getElementById('saveFrameAsStateRow').style.display='none';
    document.getElementById('visualCollisionMode').value=s.collisionMode||'FULL';
  }
  document.getElementById('visualEditor').style.display='';
  renderAnimThumbs();
  renderLayerList('visualLayerList', animDoc);
  updateAnimStatus();
  drawWorldPreview();
  renderVisualList();
}

/* ============================================================
   Кадры: вставка/файл, дублирование, удаление, миниатюры
   ============================================================ */
async function loadFrameImage(file){
  if(!file||!file.type||!file.type.startsWith('image/'))return;
  if(!currentVisual || currentVisual.type!=='animation')return;
  try{
    const dataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error||new Error('Не удалось прочитать изображение.'));
      reader.readAsDataURL(file);
    });
    const im=await new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('Не удалось загрузить изображение.'));
      img.src=dataUrl;
    });
    animDoc.clear();
    animDoc.addLayerFromImage(im);
    const state=await animDoc.serialize();
    if(currentFrameIndex<0 || !frames.length){
      frames=[state];
      currentFrameIndex=0;
    }else{
      frames[currentFrameIndex]=state;
    }
    const a=animations.find(x=>x.id===currentVisual.id);
    if(a)a.frames=frames;
    fitVisualEditorZoom();
    renderAnimThumbs();
    renderLayerList('visualLayerList',animDoc);
    updateAnimStatus();
    if(window.update)window.update();
  }catch(err){
    console.error('Ошибка загрузки кадра:',err);
    alert('Не удалось загрузить изображение кадра: '+err.message);
  }
}
document.getElementById('armPasteVisual').onclick=()=>{
  setArmed('#panel-animation',document.getElementById('armPasteVisual'));
  window.armPasteTarget('visual-frame', loadFrameImage);
};
document.getElementById('visualFileInput').onchange=async e=>{
  if(e.target.files[0])await loadFrameImage(e.target.files[0]);
  e.target.value='';
};
const visualDocHolder=document.getElementById('visualDocHolder');
visualDocHolder.addEventListener('dragover',e=>{
  if(!currentVisual || currentVisual.type!=='animation')return;
  e.preventDefault();
  e.dataTransfer.dropEffect='copy';
});
visualDocHolder.addEventListener('drop',async e=>{
  if(!currentVisual || currentVisual.type!=='animation')return;
  e.preventDefault();
  e.stopPropagation();
  const file=[...(e.dataTransfer.files||[])].find(f=>f.type&&f.type.startsWith('image/'));
  if(file)await loadFrameImage(file);
});
document.addEventListener('paste',async e=>{
  if(document.getElementById('panel-animation').classList.contains('hidden'))return;
  if(!currentVisual || currentVisual.type!=='animation')return;
  const items=[...(e.clipboardData?.items||[])];
  const it=items.find(i=>i.type&&i.type.startsWith('image/'));
  if(!it)return;
  e.preventDefault();
  e.stopPropagation();
  const file=it.getAsFile();
  if(file)await loadFrameImage(file);
});

document.getElementById('btnDuplicateVisualFrame').onclick=async ()=>{
  if(!currentVisual || currentVisual.type!=='animation' || currentFrameIndex<0)return;
  await commitCurrentFrame();
  frames.splice(currentFrameIndex+1,0,JSON.parse(JSON.stringify(frames[currentFrameIndex])));
  const a=animations.find(x=>x.id===currentVisual.id); if(a)a.frames=frames;
  await switchToFrame(currentFrameIndex+1);
};
document.getElementById('btnDeleteVisualFrame').onclick=async ()=>{
  if(!currentVisual || currentVisual.type!=='animation' || currentFrameIndex<0)return;
  if(frames.length<=1){ alert('Нельзя удалить последний кадр анимации.'); return; }
  frames.splice(currentFrameIndex,1);
  const a=animations.find(x=>x.id===currentVisual.id); if(a)a.frames=frames;
  await switchToFrame(Math.min(currentFrameIndex,frames.length-1));
};
async function switchToFrame(i){
  if(!frames[i])return;
  await commitCurrentFrame();
  currentFrameIndex=i;
  await animDoc.restore(frames[i]);
  fitVisualEditorZoom();
  renderAnimThumbs(); renderLayerList('visualLayerList',animDoc); updateAnimStatus();
  if(window.update)window.update();
}
let thumbRenderToken=0;
function renderAnimThumbs(){
  const c=document.getElementById('visualFrames'); if(!c)return;
  c.innerHTML='';
  if(!currentVisual || currentVisual.type!=='animation')return;
  const imgs=[];
  frames.forEach((f,i)=>{
    const d=document.createElement('div'); d.className='anim-thumb'+(i===currentFrameIndex?' active':'');
    const im=document.createElement('img'); im.alt='Кадр '+(i+1);
    const idx=document.createElement('span'); idx.className='idx'; idx.textContent=i+1;
    d.appendChild(im); d.appendChild(idx);
    d.onclick=()=>switchToFrame(i);
    c.appendChild(d);
    imgs.push({im,f});
  });
  thumbRenderToken++;
  const token=thumbRenderToken;
  (async()=>{
    for(const {im,f} of imgs){
      if(token!==thumbRenderToken)return;
      try{
        await scratchDoc.restore(f);
        const flat=scratchDoc.flatten();
        if(token!==thumbRenderToken)return;
        if(flat) im.src=flat.toDataURL();
      }catch(e){}
    }
  })();
}
function fitVisualEditorZoom(){
  if(!animDoc.docW||!animDoc.docH)return;
  const maxW=720,maxH=420;
  const z=Math.min(maxW/animDoc.docW,maxH/animDoc.docH);
  animDoc.setZoom(Math.max(1,Math.min(24,z)));
}
function updateAnimStatus(){
  const el=document.getElementById('visualStatus'); if(!el)return;
  if(!currentVisual){ el.textContent=''; return; }
  el.textContent = currentVisual.type==='animation' ? `Кадров: ${frames.length}` : (animDoc.docW?`Картинка: ${animDoc.docW}×${animDoc.docH}px`:'Картинка не задана.');
}

/* ============================================================
   Спрайт-лист: разрезать текущий кадр на N кадров
   ============================================================ */
document.getElementById('btnSpriteSheetCut').onclick=async ()=>{
  if(!currentVisual || currentVisual.type!=='animation'){ alert('Разрезать можно только внутри анимации.'); return; }

  const cols=Math.max(1,parseInt(document.getElementById('spriteSheetCols').value,10)||1);
  const rows=Math.max(1,parseInt(document.getElementById('spriteSheetRows').value,10)||1);
  if(cols*rows<2){ alert('Укажи количество колонок и строк больше 1.'); return; }

  const source=animDoc.flatten();
  if(!source||!source.width||!source.height){ alert('Сначала вставь картинку в текущий кадр.'); return; }

  const frameW=Math.floor(source.width/cols);
  const frameH=Math.floor(source.height/rows);
  if(frameW<1||frameH<1){ alert('Количество колонок/строк больше размера картинки.'); return; }

  const newFrames=[];
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const piece=document.createElement('canvas');
      piece.width=frameW;
      piece.height=frameH;
      const ctx=piece.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,frameW,frameH);
      ctx.drawImage(
        source,
        col*frameW,row*frameH,frameW,frameH,
        0,0,frameW,frameH
      );

      const state=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=async ()=>{
          try{
            scratchDoc.clear();
            scratchDoc.addLayerFromImage(img);
            resolve(await scratchDoc.serialize());
          }catch(err){ reject(err); }
        };
        img.onerror=()=>reject(new Error('Не удалось создать кадр.'));
        img.src=piece.toDataURL('image/png');
      });
      newFrames.push(state);
    }
  }

  frames=newFrames;
  currentFrameIndex=0;

  const a=animations.find(x=>x.id===currentVisual.id);
  if(a)a.frames=frames;

  await animDoc.restore(frames[0]);
  fitVisualEditorZoom();
  renderAnimThumbs();
  renderLayerList('visualLayerList',animDoc);
  updateAnimStatus();
  drawWorldPreview();
  if(window.update)window.update();
};

async function framesFromCanvas(source,cols,rows){
  const frameW=Math.floor(source.width/cols);
  const frameH=Math.floor(source.height/rows);
  if(frameW<1||frameH<1)throw new Error('Количество колонок или строк больше размера картинки.');
  const out=[];
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const piece=document.createElement('canvas');
      piece.width=frameW; piece.height=frameH;
      const ctx=piece.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,frameW,frameH);
      ctx.drawImage(source,col*frameW,row*frameH,frameW,frameH,0,0,frameW,frameH);
      const state=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=async()=>{ try{ scratchDoc.clear(); scratchDoc.addLayerFromImage(img); resolve(await scratchDoc.serialize()); }catch(err){ reject(err); } };
        img.onerror=()=>reject(new Error('Не удалось создать кадр.'));
        img.src=piece.toDataURL('image/png');
      });
      out.push(state);
    }
  }
  return out;
}

function freeAnimationName(base){
  const used=usedVisualNames();
  if(!used.has(base))return base;
  let i=2;
  while(used.has(base+'_'+i))i++;
  return base+'_'+i;
}

const btnSliceMain=document.getElementById('btnSliceToAnimation');
if(btnSliceMain) btnSliceMain.onclick=async ()=>{
  const source=mainDoc.flatten();
  if(!source||!source.width||!source.height){ alert('Сначала загрузи основную картинку.'); return; }
  const cols=Math.max(1,parseInt(document.getElementById('mainSliceCols').value,10)||1);
  const rows=Math.max(1,parseInt(document.getElementById('mainSliceRows').value,10)||1);
  if(cols*rows<2){ alert('Укажи количество колонок и строк больше 1.'); return; }

  let newFrames;
  try{ newFrames=await framesFromCanvas(source,cols,rows); }
  catch(err){ alert(err.message||'Не удалось разрезать картинку.'); return; }

  if(currentVisual) await commitCurrentFrame();

  const animatedBox=document.getElementById('animated');
  if(animatedBox && !animatedBox.checked){ animatedBox.checked=true; animatedBox.dispatchEvent(new Event('change',{bubbles:true})); }

  let target=null;
  if(currentVisual && currentVisual.type==='animation'){
    target=animations.find(x=>x.id===currentVisual.id)||null;
  }
  if(!target){
    const name=freeAnimationName('idle');
    target={id:name, fps:8, loop:true, frames:[], collisionMode:'FULL', collisionPadding:0, sound:{enabled:false,source:'NEW',files:[],mode:'single',volume:80,radius:300}, skillProgress:[]};
    animations.push(target);
    saveVisualName('animation',name);
    if(name==='idle')idleCreated=true;
  }

  target.frames=newFrames;
  currentVisual=null;
  currentAnimIndex=-1;
  frames=[];
  currentFrameIndex=-1;

  const tab=document.querySelector('.tab[data-tab="animation"]');
  if(tab)tab.click();
  await selectVisual('animation',target.id);
  await switchToFrame(0);
  renderVisualList();
  if(window.update)window.update();
};

/* ============================================================
   Убрать пространство / добавить поля — сразу во ВСЕХ кадрах
   ============================================================ */
document.getElementById('btnTrimAllFrames').onclick=async ()=>{
  if(!currentVisual || !frames.length)return;
  await commitCurrentFrame();
  for(let i=0;i<frames.length;i++){ await scratchDoc.restore(frames[i]); scratchDoc.trim(); frames[i]=await scratchDoc.serialize(); }
  if(currentVisual.type==='animation'){ const a=animations.find(x=>x.id===currentVisual.id); if(a)a.frames=frames; }
  await animDoc.restore(frames[currentFrameIndex]);
  renderAnimThumbs(); updateAnimStatus();
  if(window.update)window.update();
};
document.getElementById('btnAddPaddingAllFrames').onclick=async ()=>{
  if(!currentVisual || !frames.length)return;
  const p=Math.max(0,+document.getElementById('paddingAmount').value||0);
  await commitCurrentFrame();
  for(let i=0;i<frames.length;i++){ await scratchDoc.restore(frames[i]); scratchDoc.pad(p,p,p,p); frames[i]=await scratchDoc.serialize(); }
  if(currentVisual.type==='animation'){ const a=animations.find(x=>x.id===currentVisual.id); if(a)a.frames=frames; }
  await animDoc.restore(frames[currentFrameIndex]);
  renderAnimThumbs(); updateAnimStatus();
  if(window.update)window.update();
};
document.getElementById('btnApplyVisualResize').onclick=async ()=>{
  if(!currentVisual || !frames.length)return;
  const h=+document.getElementById('visualResizeHeight').value; if(!(h>0))return;
  await commitCurrentFrame();
  for(let i=0;i<frames.length;i++){ await scratchDoc.restore(frames[i]); scratchDoc.resizeToHeight(h); frames[i]=await scratchDoc.serialize(); }
  if(currentVisual.type==='animation'){ const a=animations.find(x=>x.id===currentVisual.id); if(a)a.frames=frames; }
  await animDoc.restore(frames[currentFrameIndex]);
  renderAnimThumbs(); updateAnimStatus();
  if(window.update)window.update();
};

/* ============================================================
   Инструмент рисования / кисть
   ============================================================ */
document.getElementById('visualToolMode').onchange=e=>{ animDoc.tool=e.target.value; animDoc.render(); };
document.getElementById('visualBrushColor').oninput=e=>{ animDoc.brushColor=e.target.value; };
document.getElementById('visualBrushSize').oninput=e=>{ animDoc.brushSize=+e.target.value||1; };

/* ============================================================
   Слои
   ============================================================ */
document.getElementById('btnVisualAddLayer').onclick=()=>animDoc.addBlankLayer();
document.getElementById('btnVisualMergeLayers').onclick=()=>animDoc.mergeAllLayers();
document.getElementById('btnVisualDeleteLayer').onclick=()=>animDoc.deleteActiveLayer();
document.getElementById('btnVisualFlipLayerH').onclick=()=>animDoc.flipActiveLayerH();
document.getElementById('btnVisualFlipLayerV').onclick=()=>animDoc.flipActiveLayerV();
document.getElementById('btnVisualCenterLayer').onclick=()=>animDoc.centerActiveLayer();

/* ============================================================
   FPS / Loop / Играть — читает fps и loop ЗАНОВО на каждом тике,
   поэтому изменения на лету реально работают; при снятом Loop
   останавливается на последнем кадре и не зацикливается.
   ============================================================ */
document.getElementById('visualFps').oninput=()=>{
  if(currentAnimIndex<0 || !animations[currentAnimIndex])return;
  animations[currentAnimIndex].fps=Math.max(1,+document.getElementById('visualFps').value||8);
};
document.getElementById('visualLoop').onchange=()=>{
  if(currentAnimIndex<0 || !animations[currentAnimIndex])return;
  animations[currentAnimIndex].loop=document.getElementById('visualLoop').checked;
};
let animPlayFrames=[], animPlayRaf=null, animPlayNextTime=0;

async function buildPlaybackFrames(){
  const out=[];
  for(const f of frames){
    await scratchDoc.restore(f);
    const flat=scratchDoc.flatten();
    const c=document.createElement('canvas');
    c.width=Math.max(1,flat?flat.width:1); c.height=Math.max(1,flat?flat.height:1);
    if(flat)c.getContext('2d').drawImage(flat,0,0);
    out.push(c);
  }
  return out;
}

function markActiveThumb(i){
  const nodes=document.querySelectorAll('#visualFrames .anim-thumb');
  nodes.forEach((n,k)=>n.classList.toggle('active',k===i));
}

function drawPlaybackFrame(i){
  const src=animPlayFrames[i]; if(!src)return;
  const canvas=document.getElementById('visualCanvas'); if(!canvas)return;
  if(canvas.width!==src.width||canvas.height!==src.height){ canvas.width=src.width; canvas.height=src.height; }
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(src,0,0);
}

function stopAnimPlayback(){
  animPlaying=false;
  if(animPlayRaf)cancelAnimationFrame(animPlayRaf);
  if(animPlayTimer)clearTimeout(animPlayTimer);
  animPlayRaf=null; animPlayTimer=null; animPlayFrames=[];
}

document.getElementById('btnVisualPlay').onclick=async ()=>{
  const btn=document.getElementById('btnVisualPlay'), label=document.getElementById('visualPlayLabel');
  const handles=document.getElementById('visualHandleLayer');
  if(animPlaying){
    stopAnimPlayback();
    btn.textContent='▶ Играть'; label.textContent='';
    if(handles)handles.style.display='';
    if(frames.length && currentFrameIndex>=0){ await animDoc.restore(frames[currentFrameIndex]); renderAnimThumbs(); updateAnimStatus(); drawWorldPreview(); }
    return;
  }
  if(!currentVisual || currentVisual.type!=='animation' || !frames.length)return alert('Нет кадров.');
  await commitCurrentFrame();

  btn.textContent='⏸ Стоп';
  label.textContent='загрузка кадров…';
  animPlayFrames=await buildPlaybackFrames();
  if(!animPlayFrames.length){ btn.textContent='▶ Играть'; label.textContent=''; return; }
  if(handles)handles.style.display='none';

  animPlaying=true;
  animPlayIdx=Math.max(0,currentFrameIndex);
  const a=animations[currentAnimIndex];
  const fps=Math.max(1,+(a&&a.fps||document.getElementById('visualFps').value)||8);
  const frameDuration=1000/fps;
  animPlayNextTime=performance.now()+frameDuration;

  drawPlaybackFrame(animPlayIdx);
  markActiveThumb(animPlayIdx);
  label.textContent=`кадр ${animPlayIdx+1}/${animPlayFrames.length} · ${fps} FPS`;

  const step=(now)=>{
    if(!animPlaying)return;
    const cur=animations[currentAnimIndex];
    const loop=cur?cur.loop!==false:true;
    const liveFps=Math.max(1,+(cur&&cur.fps||document.getElementById('visualFps').value)||8);
    const dur=1000/liveFps;
    if(now>=animPlayNextTime){
      const isLast=animPlayIdx>=animPlayFrames.length-1;
      if(isLast && !loop){
        stopAnimPlayback();
        btn.textContent='▶ Играть';
        if(handles)handles.style.display='';
        animDoc.restore(frames[currentFrameIndex]).then(()=>{ renderAnimThumbs(); drawWorldPreview(); });
        return;
      }
      animPlayIdx=(animPlayIdx+1)%animPlayFrames.length;
      currentFrameIndex=animPlayIdx;
      drawPlaybackFrame(animPlayIdx);
      markActiveThumb(animPlayIdx);
      label.textContent=`кадр ${animPlayIdx+1}/${animPlayFrames.length} · ${liveFps} FPS`;
      const drift=now-animPlayNextTime;
      animPlayNextTime = now + Math.max(0, dur - Math.min(drift, dur));
    }
    animPlayRaf=requestAnimationFrame(step);
  };
  animPlayRaf=requestAnimationFrame(step);
};

/* ============================================================
   Коллизия
   ============================================================ */
document.getElementById('visualCollisionMode').onchange=e=>{
  if(!currentVisual)return;
  if(currentVisual.type==='animation'){ const a=animations.find(x=>x.id===currentVisual.id); if(a)a.collisionMode=e.target.value; }
  else{ const s=imageStates.find(x=>x.id===currentVisual.id); if(s)s.collisionMode=e.target.value; }
  if(window.update)window.update();
};

/* ============================================================
   Звук анимации
   ============================================================ */
function loadSoundUiFromAnim(a){
  const snd=a.sound||{enabled:false,source:'NEW',files:[],mode:'single',volume:80,radius:300};
  document.getElementById('animSoundEnabled').checked=!!snd.enabled;
  document.getElementById('animSoundFields').style.display=snd.enabled?'':'none';
  document.getElementById('animSoundSource').value=snd.source||'NEW';
  document.getElementById('animSoundMode').value=snd.mode||'single';
  document.getElementById('animSoundVolume').value=snd.volume||80;
  document.getElementById('animSoundRadius').value=snd.radius||300;
  animSoundFiles=snd.files||[];
  renderAnimSoundFileList();
  populateAnimSoundExistingRef();
}
function renderAnimSoundFileList(){
  const el=document.getElementById('animSoundFileList');
  el.innerHTML=animSoundFiles.length? animSoundFiles.map(f=>`<div class="muted">🔊 ${escV(f.name)}</div>`).join('') : '<span class="muted">Файлов нет.</span>';
}
function populateAnimSoundExistingRef(){
  const sel=document.getElementById('animSoundExistingRef');
  const others=animations.filter(a=>currentVisual&&a.id!==currentVisual.id && a.sound&&a.sound.enabled&&a.sound.files&&a.sound.files.length);
  sel.innerHTML=others.map(a=>`<option value="${escV(a.id)}">${escV(a.id)}</option>`).join('');
}
document.getElementById('animSoundEnabled').onchange=e=>{
  if(currentAnimIndex<0)return;
  const a=animations[currentAnimIndex]; a.sound=a.sound||{}; a.sound.enabled=e.target.checked;
  document.getElementById('animSoundFields').style.display=e.target.checked?'':'none';
  if(window.update)window.update();
};
document.getElementById('animSoundSource').onchange=e=>{
  const isExisting=e.target.value==='EXISTING';
  document.getElementById('animSoundExistingRef').style.display=isExisting?'':'none';
  document.getElementById('animSoundFilesRow').style.display=isExisting?'none':'';
  document.getElementById('animSoundModeRow').style.display=isExisting?'none':'';
  if(currentAnimIndex>=0){ animations[currentAnimIndex].sound.source=e.target.value; }
};
document.getElementById('animSoundFileInput').onchange=async e=>{
  const files=[...e.target.files]; if(!files.length)return;
  for(const f of files){ const dataUrl=await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f); }); animSoundFiles.push({name:f.name,dataUrl}); }
  if(currentAnimIndex>=0) animations[currentAnimIndex].sound.files=animSoundFiles;
  renderAnimSoundFileList(); e.target.value='';
  if(window.update)window.update();
};
document.getElementById('btnClearAnimSoundFiles').onclick=()=>{
  animSoundFiles=[]; if(currentAnimIndex>=0) animations[currentAnimIndex].sound.files=[];
  renderAnimSoundFileList(); if(window.update)window.update();
};
document.getElementById('animSoundMode').onchange=e=>{ if(currentAnimIndex>=0)animations[currentAnimIndex].sound.mode=e.target.value; };
document.getElementById('animSoundVolume').oninput=e=>{ if(currentAnimIndex>=0)animations[currentAnimIndex].sound.volume=+e.target.value||80; };
document.getElementById('animSoundRadius').oninput=e=>{ if(currentAnimIndex>=0)animations[currentAnimIndex].sound.radius=+e.target.value||300; };
document.getElementById('btnPreviewAnimSoundVolume').onclick=()=>{
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator(), gain=ctx.createGain();
    const vol=(+document.getElementById('animSoundVolume').value||80)/100;
    gain.gain.value=vol*0.3; osc.frequency.value=440;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime+0.3);
  }catch(e){}
};

/* ============================================================
   Прокачка навыков
   ============================================================ */
function loadSkillUiFromAnim(a){
  document.getElementById('animSkillEnabled').checked = !!(a.skillProgress&&a.skillProgress.length);
  document.getElementById('animSkillFields').style.display=(a.skillProgress&&a.skillProgress.length)?'':'none';
  renderAnimSkillRows();
}
function renderAnimSkillRows(){
  const box=document.getElementById('animSkillRows'); if(!box)return;
  const a=currentAnimIndex>=0?animations[currentAnimIndex]:null;
  const rows=a?(a.skillProgress||[]):[];
  box.innerHTML=rows.map((r,i)=>`
    <div class="row" style="margin-bottom:6px" data-idx="${i}">
      <select class="skill-sel" style="width:180px">${allSkills().map(([k,l])=>`<option value="${k}" ${r.skill===k?'selected':''}>${escV(l)}</option>`).join('')}</select>
      <label class="muted">XP</label><input type="number" class="skill-xp" min="0" value="${r.xp||0}" style="width:70px">
      <button class="skill-row-del">✕</button>
    </div>`).join('');
  box.querySelectorAll('[data-idx]').forEach(row=>{
    const i=+row.dataset.idx;
    row.querySelector('.skill-sel').onchange=e=>{ rows[i].skill=e.target.value; if(window.update)window.update(); };
    row.querySelector('.skill-xp').oninput=e=>{ rows[i].xp=+e.target.value||0; if(window.update)window.update(); };
    row.querySelector('.skill-row-del').onclick=()=>{ rows.splice(i,1); renderAnimSkillRows(); if(window.update)window.update(); };
  });
}
document.getElementById('animSkillEnabled').onchange=e=>{
  document.getElementById('animSkillFields').style.display=e.target.checked?'':'none';
  if(currentAnimIndex>=0 && !e.target.checked) animations[currentAnimIndex].skillProgress=[];
  if(window.update)window.update();
};
document.getElementById('btnAddSkillRow').onclick=()=>{
  if(currentAnimIndex<0)return;
  const a=animations[currentAnimIndex]; a.skillProgress=a.skillProgress||[];
  a.skillProgress.push({skill:allSkills()[0]?.[0]||'', xp:5});
  renderAnimSkillRows(); if(window.update)window.update();
};
document.getElementById('btnAddCustomSkill').onclick=()=>{
  const name=document.getElementById('newSkillName').value.trim(); if(!name)return;
  const key=sanitizeSlug(name)||name;
  const list=loadCustomSkills(); if(!list.some(x=>x[0]===key)){ list.push([key,name]); saveCustomSkills(list); }
  document.getElementById('newSkillName').value='';
  renderAnimSkillRows();
};

/* ============================================================
   Мастер «Сохранить текущий кадр как картинку состояния»
   ============================================================ */
let saveFrameStateDraft=null;
let saveFrameStatePreviewFlatUrl=null;
function saveFrameStateUsedNames(){ return usedVisualNames(); }
function populateSaveFrameStateNameSelect(){
  const used=saveFrameStateUsedNames();
  const sel=document.getElementById('saveFrameStateNameSelect');
  const names=[];
  BUILTIN_IMAGE_NAMES.forEach(x=>names.push(x));
  loadCustomVisualNames().filter(x=>x.startsWith('image:')).forEach(x=>{const n=x.slice(6);if(n&&!names.some(y=>y[0]===n))names.push([n,n]);});
  projectVisualNames.image.forEach(n=>{if(!names.some(y=>y[0]===n))names.push([n,n+' (из проекта)']);});
  const filtered=names.filter(x=>!used.has(x[0]));
  sel.innerHTML='<option value="">— выбери готовое имя —</option>'+filtered.map(x=>`<option value="${escV(x[0])}">${escV(x[1])}</option>`).join('');
}
function openSaveFrameStateWizard(){
  saveFrameStateDraft=null; saveFrameStatePreviewFlatUrl=null;
  populateSaveFrameStateNameSelect();
  document.getElementById('saveFrameStateCustomName').value='';
  document.getElementById('saveFrameStatePanel').style.display='';
  document.getElementById('saveFrameStateStep1').style.display='';
  document.getElementById('saveFrameStateStep2').style.display='none';
}
function closeSaveFrameStateWizard(){ saveFrameStateDraft=null; document.getElementById('saveFrameStatePanel').style.display='none'; }
document.getElementById('btnSaveFrameStateCancel1').onclick=closeSaveFrameStateWizard;
document.getElementById('btnSaveFrameStateCancel2').onclick=closeSaveFrameStateWizard;
document.getElementById('btnSaveFrameStateConfirmName').onclick=()=>{
  const sel=document.getElementById('saveFrameStateNameSelect').value.trim();
  const custom=document.getElementById('saveFrameStateCustomName').value.trim();
  const name=custom||sel;
  if(!name)return alert('Укажи имя состояния.');
  if(!/^[A-Za-z0-9_-]+$/.test(name))return alert('Имя должно содержать латинские буквы, цифры, _ или -.');
  if(saveFrameStateUsedNames().has(name))return alert('Такое имя уже занято в этом объекте.');
  saveFrameStateDraft={name, frameIndex:-1, frameSnapshot:null, collisionMode:'FULL'};
  document.getElementById('saveFrameStateNameLabel').textContent=name;
  document.getElementById('saveFrameStatePreviewImg').src='';
  document.getElementById('saveFrameStateCollisionMode').value='FULL';
  document.getElementById('saveFrameStateFramePicker').style.display='none';
  document.getElementById('saveFrameStateStep1').style.display='none';
  document.getElementById('saveFrameStateStep2').style.display='';
};
async function renderSaveFrameStateFramePicker(){
  const box=document.getElementById('saveFrameStateFrameList'); box.innerHTML='';
  for(let i=0;i<frames.length;i++){
    const d=document.createElement('div'); d.className='anim-thumb'+(i===saveFrameStateDraft?.frameIndex?' active':''); d.style.cursor='pointer';
    const im=document.createElement('img'); im.alt='Кадр '+(i+1);
    box.appendChild(d); d.appendChild(im);
    const idxLabel=document.createElement('span'); idxLabel.className='idx'; idxLabel.textContent=i+1; d.appendChild(idxLabel);
    d.onclick=async ()=>{ await pickSaveFrameStateFrame(i); };
    try{ await scratchDoc.restore(frames[i]); const flat=scratchDoc.flatten(); if(flat) im.src=flat.toDataURL(); }catch(e){}
  }
}
async function pickSaveFrameStateFrame(i){
  if(!saveFrameStateDraft)return;
  saveFrameStateDraft.frameIndex=i;
  saveFrameStateDraft.frameSnapshot=JSON.parse(JSON.stringify(frames[i]));
  try{
    await scratchDoc.restore(frames[i]);
    const flat=scratchDoc.flatten();
    if(flat){ saveFrameStatePreviewFlatUrl=flat.toDataURL(); document.getElementById('saveFrameStatePreviewImg').src=saveFrameStatePreviewFlatUrl; }
  }catch(e){}
  document.getElementById('saveFrameStateFramePicker').style.display='none';
}
document.getElementById('btnSaveFrameStateChooseFrame').onclick=async ()=>{
  const picker=document.getElementById('saveFrameStateFramePicker');
  const willShow=picker.style.display==='none';
  if(willShow) await renderSaveFrameStateFramePicker();
  picker.style.display=willShow?'':'none';
};
document.getElementById('saveFrameStatePreviewImg').onclick=()=>{ document.getElementById('btnSaveFrameStateChooseFrame').click(); };
document.getElementById('btnSaveFrameStateDone').onclick=()=>{
  if(!saveFrameStateDraft)return;
  if(!saveFrameStateDraft.frameSnapshot)return alert('Сначала нажми «Выбор» и выбери кадр.');
  saveFrameStateDraft.collisionMode=document.getElementById('saveFrameStateCollisionMode').value||'FULL';
  const {name,frameSnapshot,frameIndex,collisionMode}=saveFrameStateDraft;
  imageStates.push({id:name, doc:frameSnapshot, previewDataUrl:saveFrameStatePreviewFlatUrl||frameSnapshot.layers?.[0]?.bitmap||null,
    width:frameSnapshot.docW||0, height:frameSnapshot.docH||0,
    sourceFrame:{animation:animations[currentAnimIndex]?.id||null, frame:frameIndex}, collisionMode});
  saveVisualName('image',name);
  closeSaveFrameStateWizard();
  renderVisualList();
  if(window.update)window.update();
};
document.getElementById('btnUseCurrentFrameAsImage').onclick=async ()=>{
  if(!frames.length)return alert('В этой анимации пока нет ни одного кадра.');
  await commitCurrentFrame();
  openSaveFrameStateWizard();
};

/* ============================================================
   Стандартные имена анимаций для текущей категории (для запасного варианта открытия объекта)
   ============================================================ */
function renderStdAnimSelect(){ /* оставлено для совместимости с вызовами при смене категории — список имён теперь в самом мастере добавления */ }

/* ============================================================
   Character Assembler — связь анимаций персонажа (оставлено как было)
   ============================================================ */
document.getElementById('animSource').onchange=e=>{
  document.getElementById('assemblerPickerField').style.display = e.target.value==='ASSEMBLER' ? '' : 'none';
};