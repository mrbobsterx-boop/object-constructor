/* ============================================================
   MODULE 05 — DESTRUCTION
   Broken state and destruction animation are isolated here.
   Do not mix this state with generic Animations.
   ============================================================ */

/* ============================================================
   DESTRUCTION tab: broken image + destroy-animation frames.
   Lightweight (no layers/skew) — per scope agreement.
   ============================================================ */
const brokenCanvas=document.getElementById('brokenCanvas'), bctx=brokenCanvas.getContext('2d',{willReadFrequently:true});
let brokenW=0, brokenH=0;
function loadBroken(file){
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=()=>{
    const im=new Image();
    im.onload=()=>{
      brokenW=im.naturalWidth; brokenH=im.naturalHeight;
      brokenCanvas.width=brokenW; brokenCanvas.height=brokenH;
      const dispW=Math.min(220,brokenW); brokenCanvas.style.width=dispW+'px'; brokenCanvas.style.height=(brokenH*dispW/brokenW)+'px';
      bctx.clearRect(0,0,brokenW,brokenH); bctx.drawImage(im,0,0);
      if(!document.getElementById('brokenPath').value.trim()) autofillPaths();
      document.getElementById('btnDownloadBroken').disabled=false;
      document.getElementById('brokenStatus').textContent=`Задан: ${brokenW}×${brokenH}px`;
      if(window.update)window.update(); syncPreview();
    };
    im.src=reader.result;
  };
  reader.readAsDataURL(file);
}
function trimCanvas(canvas,ctx){
  const w=canvas.width,h=canvas.height; if(!w)return null;
  const data=ctx.getImageData(0,0,w,h).data;
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) if(data[(y*w+x)*4+3]>10){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  if(maxX<0)return null;
  return {minX,minY,w:maxX-minX+1,h:maxY-minY+1};
}
document.getElementById('btnTrimBroken').onclick=()=>{
  if(!brokenW)return;
  const b=trimCanvas(brokenCanvas,bctx); if(!b)return;
  const c=document.createElement('canvas'); c.width=b.w;c.height=b.h; c.getContext('2d').drawImage(brokenCanvas,-b.minX,-b.minY);
  brokenW=b.w;brokenH=b.h; brokenCanvas.width=brokenW;brokenCanvas.height=brokenH;
  const dispW=Math.min(220,brokenW); brokenCanvas.style.width=dispW+'px'; brokenCanvas.style.height=(brokenH*dispW/brokenW)+'px';
  bctx.drawImage(c,0,0); if(window.update)window.update();
};
document.getElementById('btnApplyBrokenResize').onclick=()=>{
  const h=+document.getElementById('brokenResizeHeight').value; if(!(h>0)||!brokenW)return;
  const scale=h/brokenH, newW=Math.round(brokenW*scale);
  const c=document.createElement('canvas'); c.width=newW;c.height=h; c.getContext('2d').drawImage(brokenCanvas,0,0,newW,h);
  brokenW=newW;brokenH=h; brokenCanvas.width=brokenW;brokenCanvas.height=brokenH;
  const dispW=Math.min(220,brokenW); brokenCanvas.style.width=dispW+'px'; brokenCanvas.style.height=(brokenH*dispW/brokenW)+'px';
  bctx.drawImage(c,0,0); if(window.update)window.update();
};
document.getElementById('btnClearBroken').onclick=()=>{ brokenW=0;brokenH=0; brokenCanvas.width=0;brokenCanvas.height=0; document.getElementById('btnDownloadBroken').disabled=true; document.getElementById('brokenStatus').textContent='Не задан.'; if(window.update)window.update(); };
document.getElementById('btnDownloadBroken').onclick=()=>{ if(!brokenW)return; brokenCanvas.toBlob(blob=>downloadBlob(blob, document.getElementById('brokenPath').value.trim().split('/').pop()||'broken.png'),'image/png'); };
document.getElementById('brokenFileInput').onchange=e=>{ if(e.target.files[0])loadBroken(e.target.files[0]); e.target.value=''; };
document.getElementById('armPasteBroken').onclick=()=>{ setArmed('#panel-destruction',document.getElementById('armPasteBroken')); window.armPasteTarget('broken', loadBroken); };

/* повреждённое состояние — та же логика, что и разрушенное, отдельный канвас */
const damagedCanvas=document.getElementById('damagedCanvas'), dactx=damagedCanvas.getContext('2d',{willReadFrequently:true});
let damagedW=0, damagedH=0;
function loadDamaged(file){
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=()=>{
    const im=new Image();
    im.onload=()=>{
      damagedW=im.naturalWidth; damagedH=im.naturalHeight;
      damagedCanvas.width=damagedW; damagedCanvas.height=damagedH;
      const dispW=Math.min(220,damagedW); damagedCanvas.style.width=dispW+'px'; damagedCanvas.style.height=(damagedH*dispW/damagedW)+'px';
      dactx.clearRect(0,0,damagedW,damagedH); dactx.drawImage(im,0,0);
      if(!document.getElementById('damagedPath').value.trim()) autofillPaths();
      document.getElementById('btnDownloadDamaged').disabled=false;
      document.getElementById('damagedStatus').textContent=`Задан: ${damagedW}×${damagedH}px`;
      if(window.update)window.update(); syncPreview();
    };
    im.src=reader.result;
  };
  reader.readAsDataURL(file);
}
document.getElementById('btnTrimDamaged').onclick=()=>{
  if(!damagedW)return;
  const b=trimCanvas(damagedCanvas,dactx); if(!b)return;
  const c=document.createElement('canvas'); c.width=b.w;c.height=b.h; c.getContext('2d').drawImage(damagedCanvas,-b.minX,-b.minY);
  damagedW=b.w;damagedH=b.h; damagedCanvas.width=damagedW;damagedCanvas.height=damagedH;
  const dispW=Math.min(220,damagedW); damagedCanvas.style.width=dispW+'px'; damagedCanvas.style.height=(damagedH*dispW/damagedW)+'px';
  dactx.drawImage(c,0,0); if(window.update)window.update();
};
document.getElementById('btnApplyDamagedResize').onclick=()=>{
  const h=+document.getElementById('damagedResizeHeight').value; if(!(h>0)||!damagedW)return;
  const scale=h/damagedH, newW=Math.round(damagedW*scale);
  const c=document.createElement('canvas'); c.width=newW;c.height=h; c.getContext('2d').drawImage(damagedCanvas,0,0,newW,h);
  damagedW=newW;damagedH=h; damagedCanvas.width=damagedW;damagedCanvas.height=damagedH;
  const dispW=Math.min(220,damagedW); damagedCanvas.style.width=dispW+'px'; damagedCanvas.style.height=(damagedH*dispW/damagedW)+'px';
  dactx.drawImage(c,0,0); if(window.update)window.update();
};
document.getElementById('btnClearDamaged').onclick=()=>{ damagedW=0;damagedH=0; damagedCanvas.width=0;damagedCanvas.height=0; document.getElementById('btnDownloadDamaged').disabled=true; document.getElementById('damagedStatus').textContent='Не задан.'; if(window.update)window.update(); };
document.getElementById('btnDownloadDamaged').onclick=()=>{ if(!damagedW)return; damagedCanvas.toBlob(blob=>downloadBlob(blob, document.getElementById('damagedPath').value.trim().split('/').pop()||'damaged.png'),'image/png'); };
document.getElementById('damagedFileInput').onchange=e=>{ if(e.target.files[0])loadDamaged(e.target.files[0]); e.target.value=''; };
document.getElementById('armPasteDamaged').onclick=()=>{ setArmed('#panel-destruction',document.getElementById('armPasteDamaged')); window.armPasteTarget('damaged', loadDamaged); };

/* destroy-animation frames: array of flat dataURLs */
let destroyFrames=[], destroyFrameW=0, destroyFrameH=0, destroyCurrentFrame=0;
function processDestroyCell(cell){
  let out=cell;
  if(!destroyFrameW){ destroyFrameW=cell.width; destroyFrameH=cell.height; }
  else if(cell.width!==destroyFrameW||cell.height!==destroyFrameH){ out=document.createElement('canvas'); out.width=destroyFrameW; out.height=destroyFrameH; const scale=Math.min(destroyFrameW/cell.width,destroyFrameH/cell.height); const dw=Math.round(cell.width*scale),dh=Math.round(cell.height*scale); out.getContext('2d').drawImage(cell,Math.floor((destroyFrameW-dw)/2),Math.floor((destroyFrameH-dh)/2),dw,dh); }
  destroyFrames.push(out.toDataURL()); destroyCurrentFrame=destroyFrames.length-1;
}
function renderDestroyThumbs(){
  const c=document.getElementById('destroyAnimFrames'); c.innerHTML='';
  destroyFrames.forEach((src,i)=>{
    const d=document.createElement('div'); d.className='anim-thumb'+(i===destroyCurrentFrame?' active':'');
    const im=document.createElement('img'); im.src=src;
    const idx=document.createElement('span'); idx.className='idx'; idx.textContent=i+1;
    d.appendChild(im);d.appendChild(idx); d.onclick=()=>{destroyCurrentFrame=i;renderDestroyThumbs();};
    c.appendChild(d);
  });
  document.getElementById('destroyStatus').textContent = destroyFrames.length?`Кадров: ${destroyFrames.length} · ${destroyFrameW}×${destroyFrameH}px`:'Кадров разрушения нет.';
  document.getElementById('btnDownloadDestroySheet').disabled = destroyFrames.length===0;
  if(window.update)window.update();
}
function addDestroyFile(file){
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=()=>{ const im=new Image(); im.onload=()=>{ processDestroyCell(ImageDocument.bitmapFromImage(im)); renderDestroyThumbs(); }; im.src=reader.result; };
  reader.readAsDataURL(file);
}
document.getElementById('destroyAnimFileInput').onchange=e=>{ [...e.target.files].forEach(addDestroyFile); e.target.value=''; };
document.getElementById('armPasteDestroyFrame').onclick=()=>{ setArmed('#panel-destruction',document.getElementById('armPasteDestroyFrame')); window.armPasteTarget('destroy-frame', addDestroyFile); };
let destroySliceFile=null;
document.getElementById('destroySliceFileInput').onchange=e=>{ destroySliceFile=e.target.files[0]||null; document.getElementById('btnDestroySlice').disabled=!destroySliceFile; };
document.getElementById('btnDestroySlice').onclick=()=>{
  if(!destroySliceFile)return;
  const cols=Math.max(1,+document.getElementById('destroySliceCols').value||1), rows=Math.max(1,+document.getElementById('destroySliceRows').value||1);
  const reader=new FileReader();
  reader.onload=()=>{ const im=new Image(); im.onload=()=>{ forEachSlicedCell(im, equalBoundaries(im.naturalWidth,cols), equalBoundaries(im.naturalHeight,rows), processDestroyCell); renderDestroyThumbs(); }; im.src=reader.result; };
  reader.readAsDataURL(destroySliceFile);
  destroySliceFile=null; document.getElementById('destroySliceFileInput').value=''; document.getElementById('btnDestroySlice').disabled=true;
};
document.getElementById('btnDestroySliceCurrent').onclick=()=>{
  if(!destroyFrames.length)return alert('Нет кадров разрушения — сначала вставь картинку.');
  const cols=Math.max(1,+document.getElementById('destroySliceCols').value||1), rows=Math.max(1,+document.getElementById('destroySliceRows').value||1);
  if(cols===1 && rows===1)return alert('Укажи Колонки/Строки больше 1 — иначе резать нечего.');
  const removeIdx=destroyCurrentFrame;
  const src=destroyFrames[removeIdx];
  const wasOnly=destroyFrames.length===1;
  const im=new Image();
  im.onload=()=>{
    if(wasOnly){ destroyFrameW=0; destroyFrameH=0; }
    const cells=[]; forEachSlicedCell(im, equalBoundaries(im.naturalWidth,cols), equalBoundaries(im.naturalHeight,rows), c=>cells.push(c));
    const newDataUrls=cells.map(c=>{
      let out=c;
      if(!destroyFrameW){ destroyFrameW=c.width; destroyFrameH=c.height; }
      else if(c.width!==destroyFrameW||c.height!==destroyFrameH){
        out=document.createElement('canvas'); out.width=destroyFrameW; out.height=destroyFrameH;
        const scale=Math.min(destroyFrameW/c.width,destroyFrameH/c.height);
        const dw=Math.round(c.width*scale), dh=Math.round(c.height*scale);
        out.getContext('2d').drawImage(c, Math.floor((destroyFrameW-dw)/2), Math.floor((destroyFrameH-dh)/2), dw, dh);
      }
      return out.toDataURL();
    });
    destroyFrames.splice(removeIdx,1,...newDataUrls);
    destroyCurrentFrame=removeIdx;
    renderDestroyThumbs();
  };
  im.src=src;
};
document.getElementById('btnTrimDestroyFrames').onclick=()=>{
  if(!destroyFrames.length)return;
  Promise.all(destroyFrames.map(src=>new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.src=src}))).then(imgs=>{
    let minX=destroyFrameW,minY=destroyFrameH,maxX=-1,maxY=-1;
    const canvases=imgs.map(im=>{ const c=document.createElement('canvas'); c.width=destroyFrameW;c.height=destroyFrameH; const cx=c.getContext('2d'); cx.drawImage(im,0,0); return c; });
    canvases.forEach(c=>{ const b=trimCanvas(c,c.getContext('2d')); if(b){ minX=Math.min(minX,b.minX);minY=Math.min(minY,b.minY); maxX=Math.max(maxX,b.minX+b.w); maxY=Math.max(maxY,b.minY+b.h); } });
    if(maxX<0)return;
    const newW=maxX-minX, newH=maxY-minY;
    destroyFrames=canvases.map(c=>{ const out=document.createElement('canvas'); out.width=newW;out.height=newH; out.getContext('2d').drawImage(c,-minX,-minY); return out.toDataURL(); });
    destroyFrameW=newW; destroyFrameH=newH; renderDestroyThumbs();
  });
};
document.getElementById('btnDestroyDeleteFrame').onclick=()=>{
  if(!destroyFrames.length)return;
  destroyFrames.splice(destroyCurrentFrame,1);
  if(!destroyFrames.length){destroyFrameW=0;destroyFrameH=0}
  destroyCurrentFrame=Math.max(0,Math.min(destroyCurrentFrame,destroyFrames.length-1));
  renderDestroyThumbs();
};
function buildDestroySheetCanvas(){
  const sheet=document.createElement('canvas'); sheet.width=destroyFrameW*destroyFrames.length; sheet.height=destroyFrameH;
  const sctx=sheet.getContext('2d'); let chain=Promise.resolve();
  destroyFrames.forEach((src,i)=>{ chain=chain.then(()=>new Promise(r=>{const im=new Image();im.onload=()=>{sctx.drawImage(im,i*destroyFrameW,0);r()};im.src=src})); });
  return chain.then(()=>sheet);
}
document.getElementById('btnDownloadDestroySheet').onclick=()=>{ if(!destroyFrames.length)return; buildDestroySheetCanvas().then(s=>s.toBlob(b=>downloadBlob(b, document.getElementById('destroySheetPath').value.trim()||'broken_anim.png'),'image/png')); };
let destroyPlaying=false, destroyTimer=null, destroyImgs=[], destroyIdx=0;
document.addEventListener('paste', e=>{
  if(document.getElementById('panel-destruction').classList.contains('hidden'))return;
  const items=[...(e.clipboardData?.items||[])]; const it=items.find(i=>i.type.startsWith('image/')); if(!it)return;
  e.preventDefault(); const file=it.getAsFile(); if(!file)return;
  if(window.__pasteTarget && (window.__pasteTarget.id==='broken'||window.__pasteTarget.id==='destroy-frame')) window.__pasteTarget.handler(file);
  else loadBroken(file);
});
document.getElementById('btnDestroyPlay').onclick=()=>{
  if(destroyPlaying){ destroyPlaying=false; if(destroyTimer)clearInterval(destroyTimer); document.getElementById('btnDestroyPlay').textContent='▶ Играть'; syncPreview(); return; }
  if(!destroyFrames.length)return alert('Нет кадров.');
  Promise.all(destroyFrames.map(src=>new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.src=src}))).then(imgs=>{
    destroyImgs=imgs; destroyIdx=0; destroyPlaying=true; document.getElementById('btnDestroyPlay').textContent='⏸ Стоп';
    const fps=Math.max(1,+document.getElementById('destroyFps').value||8);
    const tick=()=>{ if(!destroyPlaying)return; drawIntoPreview(destroyImgs[destroyIdx]); destroyIdx=(destroyIdx+1)%destroyImgs.length; };
    tick(); destroyTimer=setInterval(tick,1000/fps);
  });
};
