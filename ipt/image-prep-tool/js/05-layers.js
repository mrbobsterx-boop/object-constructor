/* ============================================================
   MODULE 05 — СЛОИ
   Каждый захваченный объект — отдельная цель (targets[layer.id]) + запись в layers[] с именем.
   Создание слоя (вырезать из листа → убрать фон → обрезать) — здесь; сам алгоритм убирания
   фона/обрезки офскрин-холста — в 07-tool-select.js (createLayerFromSheetRegion его только вызывает).
   ============================================================ */

let layers=[];
let layerCounter=0;

function createLayerFromSheetRegion(x0,y0,w,h){
  if(activeTargetKey!=='sheet') return null;
  commitActiveToTarget();
  const src=targets.sheet.canvas;
  x0=Math.max(0,Math.round(x0)); y0=Math.max(0,Math.round(y0));
  w=Math.min(Math.round(w), src.width-x0); h=Math.min(Math.round(h), src.height-y0);
  if(w<2||h<2) return null;

  const crop=makeOffscreen(w,h);
  crop.getContext('2d').drawImage(src,x0,y0,w,h,0,0,w,h);

  if(document.getElementById('bgRemoveOn').checked){
    const tol=Number(document.getElementById('bgTolerance').value)||26;
    floodRemoveBackground(crop.getContext('2d'),w,h,tol);
  }
  const trimmed=trimOffscreen(crop,3);
  const finalCanvas=trimmed||crop;
  if(finalCanvas.width<1||finalCanvas.height<1) return null;

  const id='layer_'+(++layerCounter);
  const layer={id,name:'',nameSource:null};
  layers.push(layer);
  createLayerTarget(id,finalCanvas);
  if(typeof nameLayerFromPicker==='function') nameLayerFromPicker(layer);

  pushHistory();
  ctx.clearRect(x0,y0,w,h);
  afterCanvasMutation();

  // Остаёмся на листе: так можно сразу тянуть рамку следующего объекта, не кликая обратно.
  // Слой доступен в списке слева — кликни по нему, когда понадобится подчистить ластиком или переименовать.
  renderLayers();
  return layer;
}

function activeLayer(){ return layers.find(l=>l.id===activeTargetKey)||null; }

function renderLayers(){
  document.getElementById('layerCount').textContent=layers.length;
  document.getElementById('layerHint').style.display=layers.length?'none':'';
  const el=document.getElementById('layerList');
  el.innerHTML='';
  if(targets.sheet){
    const sheetRow=document.createElement('div');
    sheetRow.className='layer-item'+(activeTargetKey==='sheet'?' active':'');
    sheetRow.innerHTML=`<span style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex:none;font-size:16px">🗂</span><span class="nm"><span class="full-name">Лист (вернуться сюда, чтобы выделить ещё один объект)</span></span>`;
    sheetRow.addEventListener('click',()=>setActiveTarget('sheet'));
    el.appendChild(sheetRow);
  }
  layers.forEach(l=>{
    const t=targets[l.id]; if(!t) return;
    const d=document.createElement('div');
    d.className='layer-item'+(l.id===activeTargetKey?' active':'');
    const tw=34, th=34, srcW=t.canvas.width, srcH=t.canvas.height;
    const scale=Math.min(tw/srcW,th/srcH);
    const thumb=document.createElement('canvas'); thumb.width=tw; thumb.height=th;
    thumb.getContext('2d').drawImage(t.canvas,(tw-srcW*scale)/2,(th-srcH*scale)/2,srcW*scale,srcH*scale);
    const nm=document.createElement('span'); nm.className='nm'+(l.name?'':' unnamed');
    nm.innerHTML=`<span class="full-name">${l.name?esc(l.name):'без имени'}</span><span class="sub">${esc(l.id)}${srcW}×${srcH}px</span>`;
    const del=document.createElement('button'); del.className='del'; del.textContent='✕'; del.title='Удалить слой';
    del.addEventListener('click',e=>{ e.stopPropagation(); deleteLayer(l.id); });
    d.appendChild(thumb); d.appendChild(nm); d.appendChild(del);
    d.addEventListener('click',()=>setActiveTarget(l.id));
    el.appendChild(d);
  });
}
function updateLayerThumb(){ renderLayers(); }
function deleteLayer(id){
  const idx=layers.findIndex(l=>l.id===id); if(idx<0) return;
  if(!confirm('Удалить слой «'+(layers[idx].name||id)+'»?')) return;
  layers.splice(idx,1);
  removeTarget(id);
  if(activeTargetKey===id){ activeTargetKey=null; setActiveTarget('sheet'); }
  else renderLayers();
}
function setActiveLayerName(name,source){
  const l=activeLayer(); if(!l) return false;
  l.name=name; l.nameSource=source||'manual';
  renderLayers();
  return true;
}
