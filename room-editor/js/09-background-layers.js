/* ============================================================
   MODULE 09 — BACKGROUND LAYERS
   Parallax background layers.
   ============================================================ */

/* ============================================================
   СЛОИ ФОНА (параллакс) — несколько картинок, у каждой своя
   прозрачность и "скорость параллакса" (0-100%, использует Godot
   при движении камеры: 100% = двигается как обычный передний план,
   меньше — дальше/медленнее, создаёт эффект глубины).
   ============================================================ */
function loadBackgroundLayer(file){
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=()=>{
    const im=new Image();
    im.onload=()=>{
      const idx=room.backgroundLayers.length;
      const layer={ id:'bg_'+Date.now()+Math.random().toString(36).slice(2), dataUrl:reader.result, nativeWidth:im.naturalWidth, nativeHeight:im.naturalHeight,
        path:(sanitizeSlug(room.id||document.getElementById('roomId').value||'room'))+'_bg'+(idx+1)+'.png', opacity:1, parallax:1,
        x:room.width/2, y:room.height/2, scale:room.width/im.naturalWidth, rotation:0, flipH:false, flipV:false }; // по умолчанию — вписать по ширине комнаты
      room.backgroundLayers.push(layer);
      renderRoom(); renderBgLayerList(); scheduleHistoryPush();
    };
    im.src=reader.result;
  };
  reader.readAsDataURL(file);
}
document.getElementById('bgLayerFileInput').onchange=e=>{ if(e.target.files[0]) loadBackgroundLayer(e.target.files[0]); e.target.value=''; };
window.__pasteTargetBgLayer=false;
document.getElementById('armPasteBgLayer').onclick=()=>{ window.__pasteTargetBgLayer=true; };
document.addEventListener('paste', e=>{
  if(!window.__pasteTargetBgLayer)return;
  const items=[...(e.clipboardData?.items||[])]; const it=items.find(i=>i.type.startsWith('image/')); if(!it)return;
  e.preventDefault(); const file=it.getAsFile(); if(file) loadBackgroundLayer(file);
});
function renderBgLayerList(){
  const list=document.getElementById('bgLayerList'); list.innerHTML='';
  if(!room.backgroundLayers.length){ list.innerHTML='<span class="status">Слоёв нет — добавь через кнопку выше.</span>'; return; }
  room.backgroundLayers.forEach((layer,idx)=>{
    const chip=document.createElement('div');
    chip.style.cssText='display:flex;align-items:center;gap:6px;background:#12161c;border:1px solid #303844;border-radius:6px;padding:5px 7px';
    chip.innerHTML=`<img src="${layer.dataUrl}" style="width:32px;height:32px;object-fit:cover;border-radius:3px;flex:none">
      <div style="display:flex;flex-direction:column;gap:3px">
        <div style="display:flex;align-items:center;gap:4px"><label style="font-size:9px;color:#8290a0;width:52px;flex:none">Прозр. %</label><input type="number" min="0" max="100" value="${Math.round(layer.opacity*100)}" data-bg-opacity="${layer.id}" style="width:52px;padding:2px 4px"></div>
        <div style="display:flex;align-items:center;gap:4px"><label style="font-size:9px;color:#8290a0;width:52px;flex:none">Паралл. %</label><input type="number" min="0" max="100" value="${Math.round(layer.parallax*100)}" style="width:52px;padding:2px 4px"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <button title="Флип ↔" style="padding:2px 6px">↔</button>
        <button title="Флип ↕" style="padding:2px 6px">↕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <button title="Выше (дальше от камеры)" style="padding:2px 6px">▲</button>
        <button title="Ниже (ближе к камере)" style="padding:2px 6px">▼</button>
      </div>
      <button title="Сбросить размер (по ширине комнаты) и поворот" style="align-self:center;font-size:10px">⟲</button>
      <button title="Удалить слой" style="align-self:center">✕</button>`;
    const inputs=chip.querySelectorAll('input'), buttons=chip.querySelectorAll('button');
    inputs[0].oninput=e=>{ layer.opacity=Math.max(0,Math.min(1,(+e.target.value||0)/100)); renderRoom(); scheduleHistoryPush(); };
    inputs[1].oninput=e=>{ layer.parallax=Math.max(0,Math.min(1,(+e.target.value||0)/100)); scheduleHistoryPush(); };
    buttons[0].onclick=()=>{ layer.flipH=!layer.flipH; renderRoom(); scheduleHistoryPush(); };
    buttons[1].onclick=()=>{ layer.flipV=!layer.flipV; renderRoom(); scheduleHistoryPush(); };
    buttons[2].onclick=()=>{ if(idx>0){ [room.backgroundLayers[idx-1],room.backgroundLayers[idx]]=[room.backgroundLayers[idx],room.backgroundLayers[idx-1]]; renderRoom(); renderBgLayerList(); scheduleHistoryPush(); } };
    buttons[3].onclick=()=>{ if(idx<room.backgroundLayers.length-1){ [room.backgroundLayers[idx+1],room.backgroundLayers[idx]]=[room.backgroundLayers[idx],room.backgroundLayers[idx+1]]; renderRoom(); renderBgLayerList(); scheduleHistoryPush(); } };
    buttons[4].onclick=()=>{ layer.scale=room.width/layer.nativeWidth; layer.rotation=0; renderRoom(); scheduleHistoryPush(); };
    buttons[5].onclick=()=>{ room.backgroundLayers.splice(idx,1); if(selectedBgLayerId===layer.id)selectedBgLayerId=null; renderRoom(); renderBgLayerList(); scheduleHistoryPush(); };
    list.appendChild(chip);
  });
}

/* ============================================================
   ВЫБРАННЫЙ СЛОЙ ФОНА — прозрачность и удаление из верхнего тулбара.
   Работает с selectedBgLayerId (клик по слою на холсте).
   Синхронизация с тулбаром — обёрткой над renderRoom (как в модуле 15):
   выбор слоя, undo/redo, открытие комнаты — всё это вызывает renderRoom.
   ============================================================ */
function getSelectedBgLayer(){ return room.backgroundLayers.find(l=>l.id===selectedBgLayerId)||null; }

function setSelectedBgOpacity(pct){
  const layer=getSelectedBgLayer(); if(!layer)return;
  layer.opacity=Math.max(0,Math.min(1,(+pct||0)/100));
  renderRoom(); scheduleHistoryPush();
}

function deleteSelectedBgLayer(){
  const layer=getSelectedBgLayer(); if(!layer)return;
  const idx=room.backgroundLayers.indexOf(layer);
  room.backgroundLayers.splice(idx,1);
  selectedBgLayerId=null; multiSelectedBgIds.delete(layer.id);
  renderRoom(); renderBgLayerList(); renderPropertiesPanel(); scheduleHistoryPush();
}

function syncBgSelectionControls(){
  const layer=getSelectedBgLayer();
  const rng=document.getElementById('bgSelOpacity'), num=document.getElementById('bgSelOpacityNum');
  const btn=document.getElementById('btnDeleteBgLayer'), hint=document.getElementById('bgSelHint');
  if(!rng||!num||!btn||!hint)return;
  rng.disabled=num.disabled=btn.disabled=!layer;
  hint.style.display=layer?'none':'';
  if(!layer){ rng.value=100; num.value=100; return; }
  const pct=Math.round(layer.opacity*100);
  if(document.activeElement!==rng) rng.value=pct;
  if(document.activeElement!==num) num.value=pct;
  const chipInput=document.querySelector('[data-bg-opacity="'+layer.id+'"]'); // поле в списке слоёв ниже
  if(chipInput && document.activeElement!==chipInput) chipInput.value=pct;
}

document.getElementById('bgSelOpacity').oninput=e=>setSelectedBgOpacity(e.target.value);
document.getElementById('bgSelOpacityNum').oninput=e=>{ if(e.target.value==='')return; setSelectedBgOpacity(e.target.value); };
document.getElementById('btnDeleteBgLayer').onclick=deleteSelectedBgLayer;

const __renderRoomBg=renderRoom;
renderRoom=function(){
  const r=__renderRoomBg.apply(this,arguments);
  syncBgSelectionControls();
  return r;
};
