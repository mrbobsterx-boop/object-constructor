/* ============================================================
   MODULE 03 — MAIN OBJECT EDITOR
   Main image, layers, transforms, brush and collision controls.
   ============================================================ */

/* ============================================================
   MAIN DOCUMENT (Основное tab) wiring
   ============================================================ */
window.__pasteTarget=null;
window.armPasteTarget=(id,handler)=>{ window.__pasteTarget={id,handler}; };

const mainDoc = new ImageDocument(document.getElementById('docCanvas'), document.getElementById('mainHandleLayer'), {
  onChange: ()=>{ renderLayerList('layerList', mainDoc); updateMainStatus(); syncPreview(); if(window.update) window.update(); }
});
mainDoc.attachBrushCursor(document.getElementById('mainDocHolder'));

function updateMainStatus(){
  const el=document.getElementById('mainStatus');
  el.textContent = mainDoc.docW ? `Картинка: ${mainDoc.docW}×${mainDoc.docH}px · слоёв: ${mainDoc.layers.length}` : "Картинка не задана. Вставь (Ctrl+V) или выбери файл.";
  document.getElementById('collisionStatus').textContent = (()=>{ const r=mainDoc.getCollisionRect(); return r?`Коллизия: ${Math.round(r.w)}×${Math.round(r.h)} @ (${Math.round(r.x)},${Math.round(r.y)})`:'Нет коллизии'; })();
}
function renderLayerList(elId, doc){
  const el=document.getElementById(elId); el.innerHTML='';
  const isAnim = elId==='visualLayerList' && typeof currentVisual!=='undefined' && currentVisual && currentVisual.type==='animation';
  doc.layers.slice().reverse().forEach(l=>{
    const row=document.createElement('div'); row.className='layer-row'+(l.id===doc.activeLayerId?' active':'');
    row.innerHTML = `<span class="name">${l.name}</span><button data-act="up" title="Переместить выше (поверх других)">▲</button><button data-act="down" title="Переместить ниже (под другие)">▼</button>`
      + (isAnim ? `<button data-act="tonext" title="Скопировать этот слой (как он есть сейчас) на следующий кадр">→след.</button><button data-act="toall" title="Скопировать этот слой (как он есть сейчас) на все кадры">→все</button>` : '')
      + `<button data-act="vis">${l.visible?'👁':'🚫'}</button>`;
    row.addEventListener('click', async e=>{
      const act=e.target.dataset.act;
      if(act==='vis'){ l.visible=!l.visible; doc.render(); return; }
      if(act==='up'){ doc.moveLayer(l.id,1); return; }
      if(act==='down'){ doc.moveLayer(l.id,-1); return; }
      if(act==='tonext'){
        if(currentFrameIndex+1>=frames.length){ alert('Нет следующего кадра.'); return; }
        await commitCurrentFrame();
        copyLayerToFrame(doc, l.id, currentFrameIndex+1);
        renderAnimThumbs(); if(window.update)window.update();
        return;
      }
      if(act==='toall'){
        await commitCurrentFrame();
        frames.forEach((f,i)=>{ if(i!==currentFrameIndex) copyLayerToFrame(doc, l.id, i); });
        renderAnimThumbs(); if(window.update)window.update();
        return;
      }
      doc.activeLayerId=l.id; doc.render();
      if(isAnim) animActiveLayerIndex=doc.layers.findIndex(x=>x.id===l.id);
    });
    el.appendChild(row);
  });
}

function loadMainImage(file){
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=()=>{
    const im=new Image();
    im.onload=()=>{
      mainDoc.clear();
      mainDoc.addLayerFromImage(im);
      const baseName=(file.name||'object').replace(/\.[^/.]+$/,'');
      if(!document.getElementById('name').value.trim()){ document.getElementById('name').value=baseName; syncIdFromName(); }
      if(window.update) window.update();
    };
    im.src=reader.result;
  };
  reader.readAsDataURL(file);
}
function addMainLayerFromFile(file){
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=()=>{ const im=new Image(); im.onload=()=>{ mainDoc.addLayerFromImage(im); }; im.src=reader.result; };
  reader.readAsDataURL(file);
}
document.getElementById('mainFileInput').onchange=e=>{ if(e.target.files[0]) loadMainImage(e.target.files[0]); e.target.value=''; };

function syncIdFromName(){
  const idEl=document.getElementById('id');
  if(idEl.dataset.auto==='0')return;
  const nameVal=document.getElementById('name').value.trim();
  idEl.value = nameVal ? (translit(nameVal)||'object') : '';
  if(typeof syncLocaleKeysFromId==='function') syncLocaleKeysFromId();
}
document.getElementById('id').dataset.auto='1';
document.getElementById('id').addEventListener('input', ()=>{ document.getElementById('id').dataset.auto='0'; if(typeof syncLocaleKeysFromId==='function') syncLocaleKeysFromId(); });
document.getElementById('name').addEventListener('input', syncIdFromName);
function setArmed(groupSel, btn){ document.querySelectorAll(groupSel+' .paste-arm-btn').forEach(b=>b.classList.remove('armed')); btn.classList.add('armed'); }
document.getElementById('armPasteMain').onclick=()=>{ setArmed('#panel-basic',document.getElementById('armPasteMain')); window.armPasteTarget('main', loadMainImage); };
document.getElementById('armPasteLayerAdd').onclick=()=>{ setArmed('#panel-basic',document.getElementById('armPasteLayerAdd')); window.armPasteTarget('main-layer', addMainLayerFromFile); };
document.getElementById('layerFileInput').onchange=e=>{ if(e.target.files[0]) addMainLayerFromFile(e.target.files[0]); e.target.value=''; };
window.armPasteTarget('main', loadMainImage);

document.getElementById('mainDocHolder').addEventListener('drop', e=>{ e.preventDefault(); const f=[...(e.dataTransfer.files||[])].find(f=>f.type.startsWith('image/')); if(f){ mainDoc.layers.length? addMainLayerFromFile(f) : loadMainImage(f); } });
document.getElementById('mainDocHolder').addEventListener('dragover', e=>e.preventDefault());

document.addEventListener('paste', e=>{
  if(document.getElementById('panel-basic').classList.contains('hidden'))return;
  const items=[...(e.clipboardData?.items||[])]; const it=items.find(i=>i.type.startsWith('image/')); if(!it)return;
  e.preventDefault(); const file=it.getAsFile(); if(!file)return;
  if(window.__pasteTarget && (window.__pasteTarget.id==='main'||window.__pasteTarget.id==='main-layer')) window.__pasteTarget.handler(file);
  else loadMainImage(file);
});

document.getElementById('btnTrimMain').onclick=()=>mainDoc.trim();
document.getElementById('btnApplyPad').onclick=()=>{
  mainDoc.pad(+document.getElementById('padTop').value||0, +document.getElementById('padBottom').value||0, +document.getElementById('padLeft').value||0, +document.getElementById('padRight').value||0);
};
document.getElementById('btnApplyResize').onclick=()=>{ const h=+document.getElementById('resizeHeight').value; if(h>0) mainDoc.resizeToHeight(h); };
document.getElementById('btnAddLayer').onclick=()=>mainDoc.addBlankLayer();
document.getElementById('btnMergeLayers').onclick=()=>mainDoc.mergeAllLayers();
document.getElementById('btnDeleteLayer').onclick=()=>mainDoc.deleteActiveLayer();
document.getElementById('btnFlipLayerH').onclick=()=>mainDoc.flipActiveLayerH();
document.getElementById('btnFlipLayerV').onclick=()=>mainDoc.flipActiveLayerV();
document.getElementById('btnResetLayerTransform').onclick=()=>mainDoc.resetActiveLayerTransform();

document.getElementById('toolMode').onchange=e=>{ mainDoc.tool=e.target.value; mainDoc.render(); };
document.getElementById('brushColor').oninput=e=>{ mainDoc.brushColor=e.target.value; };
document.getElementById('brushSize').oninput=e=>{ mainDoc.brushSize=+e.target.value||1; };
document.getElementById('brushSmooth').onchange=e=>{ mainDoc.brushSmooth=e.target.checked; };
document.getElementById('collisionMode').onchange=e=>{ mainDoc.collision.mode=e.target.value; mainDoc.render(); updateMainStatus(); };
document.getElementById('collisionPadding').oninput=e=>{ mainDoc.collision.padding=+e.target.value||0; updateMainStatus(); if(window.update)window.update(); };

/* Ctrl+click on canvas selects the layer whose bounding box contains the click point (topmost first) */
document.getElementById('docCanvas').addEventListener('pointerdown', e=>{
  if(!e.ctrlKey)return;
  const p=mainDoc._toDoc(e);
  for(let i=mainDoc.layers.length-1;i>=0;i--){
    const l=mainDoc.layers[i]; const local=mainDoc.docToLocal(l,p.x,p.y);
    if(local.x>=0&&local.x<=l.w0&&local.y>=0&&local.y<=l.h0){ mainDoc.activeLayerId=l.id; mainDoc.render(); break; }
  }
});
