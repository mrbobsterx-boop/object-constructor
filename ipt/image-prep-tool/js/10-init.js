/* ============================================================
   MODULE 10 — INIT (всегда последний)
   Открытие файлов / вставка / drag&drop, подключение папки, горячие клавиши.
   ============================================================ */

document.getElementById('btnConnectFolder').onclick=connectFolder;
document.getElementById('btnRegrant').onclick=regrantFolder;

const fileInput=document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*'; fileInput.multiple=true;
fileInput.onchange=()=>{ if(fileInput.files.length) addFilesToQueue(fileInput.files); fileInput.value=''; };
document.getElementById('btnOpenFiles').onclick=()=>fileInput.click();

document.getElementById('btnPaste').onclick=async ()=>{
  try{
    const items=await navigator.clipboard.read();
    for(const item of items){
      const type=item.types.find(t=>t.startsWith('image/')); if(!type) continue;
      const blob=await item.getType(type);
      addFilesToQueue([new File([blob],'pasted_'+Date.now()+'.png',{type})]);
      return;
    }
    alert('В буфере обмена нет картинки.');
  }catch(e){ alert('Не удалось прочитать буфер обмена. Попробуй Ctrl+V прямо на странице.'); }
};
window.addEventListener('paste', e=>{
  const items=[...(e.clipboardData?.items||[])];
  const imgItem=items.find(i=>i.type.startsWith('image/'));
  if(!imgItem) return;
  const file=imgItem.getAsFile();
  if(file) addFilesToQueue([file]);
});
const stage=document.getElementById('stage');
['dragenter','dragover'].forEach(ev=>stage.addEventListener(ev,e=>{ e.preventDefault(); stage.classList.add('drag'); }));
['dragleave','drop'].forEach(ev=>stage.addEventListener(ev,e=>{ e.preventDefault(); stage.classList.remove('drag'); }));
stage.addEventListener('drop',e=>{ if(e.dataTransfer.files.length) addFilesToQueue(e.dataTransfer.files); });

/* ---------------- клавиатура ---------------- */
function selectLayerByShortcut(index){
  const layer=layers[index];
  if(!layer) return false;
  setActiveTarget(layer.id);
  return true;
}
function selectNextLayer(){
  if(!layers.length) return false;
  const currentIndex=layers.findIndex(layer=>layer.id===activeTargetKey);
  const nextIndex=currentIndex<0 ? 0 : (currentIndex+1)%layers.length;
  return selectLayerByShortcut(nextIndex);
}
window.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select') return;
  if((e.ctrlKey||e.metaKey) && e.code==='KeyZ'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
  if((e.ctrlKey||e.metaKey) && e.code==='KeyY'){ e.preventDefault(); redo(); return; }
  if(e.code==='Space'){ if(tryCaptureSelection()) e.preventDefault(); return; }
  if(e.code==='Escape'){ cancelSelection(); return; }
  if(e.code==='KeyA'){ e.preventDefault(); document.getElementById('btnShowRemnants').click(); return; }
  if(e.code==='Delete'||e.code==='Backspace'){ if(activeLayer()){ e.preventDefault(); deleteLayer(activeTargetKey); } return; }
  // Й/Q обрезает прозрачные края активного холста.
  if(e.code==='KeyQ'){ e.preventDefault(); document.getElementById('btnTrim').click(); return; }
  // X/Ч удаляет активный слой; Delete и Backspace оставлены как дополнительные варианты.
  if(e.code==='Delete'||e.code==='Backspace'||e.code==='KeyX'){
    if(activeLayer()){ e.preventDefault(); deleteLayer(activeTargetKey); }
    return;
  }
  if(e.code==='BracketLeft'){ brushSize=Math.max(4,brushSize-6); brushSizeInput.value=brushSize; brushSizeLabel.textContent=brushSize+' px'; }
  if(e.code==='BracketRight'){ brushSize=Math.min(260,brushSize+6); brushSizeInput.value=brushSize; brushSizeLabel.textContent=brushSize+' px'; }
  if(e.code==='KeyS'){ document.getElementById('toolSelect').click(); }
  if(e.code==='KeyE'){ document.getElementById('toolErase').click(); }
  if(e.code==='KeyR'){ document.getElementById('toolRestore').click(); }
  if(e.code==='KeyT'){ document.getElementById('toolTransform').click(); }
  // event.code привязан к физической клавише, поэтому сочетания работают и в
  // английской, и в русской раскладке: M/Ь, E/У, R/К, T/Е.
  const toolButtons={ KeyM:'toolSelect', KeyE:'toolErase', KeyR:'toolRestore', KeyT:'toolTransform' };
  if(toolButtons[e.code]){ e.preventDefault(); document.getElementById(toolButtons[e.code]).click(); return; }
  if(e.code==='Tab'){
    if(selectNextLayer()) e.preventDefault();
    return;
  }
  if(/^Digit[1-9]$/.test(e.code)){
    if(selectLayerByShortcut(Number(e.code.slice(-1))-1)) e.preventDefault();
  }
});

tryRestoreFolder();
