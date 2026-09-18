/* ============================================================
   MODULE 06 — SHARED PREVIEW
   Top preview, background, pan/zoom and object positioning.
   ============================================================ */

/* ============================================================
   SHARED TOP PREVIEW: pan (RMB drag), zoom (Ctrl+wheel), copy (Ctrl+C)
   ============================================================ */
const previewCanvas=document.getElementById('previewCanvas'), pctx=previewCanvas.getContext('2d');
const previewViewport=document.getElementById('previewViewport'), previewStage=document.getElementById('previewStage');
let previewZoom=1, previewPanX=0, previewPanY=0;
const PREVIEW_PPM=640; // 640 px = 1 игровой метр; 64 px = 10 см
const PREVIEW_DEFAULT_W=4*PREVIEW_PPM, PREVIEW_DEFAULT_H=3*PREVIEW_PPM;
let previewWorldW=PREVIEW_DEFAULT_W, previewWorldH=PREVIEW_DEFAULT_H;
let previewObjectX=PREVIEW_DEFAULT_W/2, previewObjectY=PREVIEW_DEFAULT_H/2;
let previewDragging=false, previewDragOffsetX=0, previewDragOffsetY=0, previewObjectSelected=false, previewDragMoved=false;
let previewBackgroundCatalog=[]; // [{roomId,roomName,width,height,layers:[...]}]
let previewSelectedRoomId='';
let previewAutoFit=true;

function applyPreviewTransform(){
  previewStage.style.transform=`translate(${previewPanX}px,${previewPanY}px) scale(${previewZoom})`;
  document.getElementById('previewZoomLabel').textContent=Math.round(previewZoom*100)+'%';
}
function fitPreviewToViewport(){
  const vw=previewViewport.clientWidth||900, vh=previewViewport.clientHeight||260;
  const pad=24;
  previewZoom=Math.max(0.08,Math.min(2,Math.min((vw-pad)/Math.max(1,previewWorldW),(vh-pad)/Math.max(1,previewWorldH))));
  previewPanX=(vw-previewWorldW*previewZoom)/2;
  previewPanY=(vh-previewWorldH*previewZoom)/2;
  applyPreviewTransform();
}
previewViewport.addEventListener('wheel', e=>{
  if(!e.ctrlKey)return; e.preventDefault();
  const rect=previewViewport.getBoundingClientRect();
  const mx=e.clientX-rect.left, my=e.clientY-rect.top;
  const worldX=(mx-previewPanX)/previewZoom, worldY=(my-previewPanY)/previewZoom;
  const next=Math.max(0.05,Math.min(8,previewZoom*(e.deltaY<0?1.1:0.9)));
  previewPanX=mx-worldX*next; previewPanY=my-worldY*next; previewZoom=next; previewAutoFit=false;
  applyPreviewTransform();
},{passive:false});
let panning=false, panStart=null;
previewViewport.addEventListener('contextmenu', e=>{ e.preventDefault(); });
previewViewport.addEventListener('pointerdown', e=>{
  if(e.button===2){
    panning=true; panStart={x:e.clientX-previewPanX,y:e.clientY-previewPanY};
    previewViewport.classList.add('panning'); e.preventDefault(); return;
  }
  if(e.button!==0)return;
  const pt=previewClientToWorld(e);
  const box=getPreviewObjectBox();
  if(box && pt.x>=box.left && pt.x<=box.right && pt.y>=box.top && pt.y<=box.bottom){
    if(!previewObjectSelected){
      previewObjectSelected=true;
      drawWorldPreview();
    }
    previewDragging=true;
    previewDragMoved=false;
    previewDragOffsetX=pt.x-previewObjectX; previewDragOffsetY=pt.y-previewObjectY;
    previewViewport.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  } else {
    previewObjectSelected=false;
    drawWorldPreview();
  }
});
window.addEventListener('pointermove', e=>{
  if(panning){ previewPanX=e.clientX-panStart.x; previewPanY=e.clientY-panStart.y; previewAutoFit=false; applyPreviewTransform(); return; }
  if(previewDragging && previewObjectSelected){
    const pt=previewClientToWorld(e);
    const box=getPreviewObjectBox();
    const halfW=box.w/2, halfH=box.h/2;
    const nx=Math.max(halfW,Math.min(previewWorldW-halfW,pt.x-previewDragOffsetX));
    const ny=Math.max(halfH,Math.min(previewWorldH-halfH,pt.y-previewDragOffsetY));
    if(nx!==previewObjectX || ny!==previewObjectY) previewDragMoved=true;
    previewObjectX=nx; previewObjectY=ny;
    drawWorldPreview();
  }
});
window.addEventListener('pointerup', ()=>{
  panning=false; previewDragging=false; previewDragMoved=false; previewViewport.classList.remove('panning');
});
function previewClientToWorld(e){
  const rect=previewViewport.getBoundingClientRect();
  return {x:(e.clientX-rect.left-previewPanX)/previewZoom,y:(e.clientY-rect.top-previewPanY)/previewZoom};
}
function getPreviewObjectSize(){
  const w=Math.max(0,+document.getElementById('realWidthCm').value||0)/100*PREVIEW_PPM;
  const h=Math.max(0,+document.getElementById('realHeightCm').value||0)/100*PREVIEW_PPM;
  return {w,h};
}
function getPreviewObjectBox(){
  const {w,h}=getPreviewObjectSize();
  if(w<=0||h<=0)return null;
  return {w,h,left:previewObjectX-w/2,right:previewObjectX+w/2,top:previewObjectY-h/2,bottom:previewObjectY+h/2};
}
function drawGrid(){
  const enabled=document.getElementById('previewGridEnabled')?.checked!==false;
  if(!enabled)return;
  const step=PREVIEW_PPM/10; // 64 px = 10 cm
  pctx.save();
  pctx.lineWidth=1;
  for(let x=0;x<=previewWorldW;x+=step){
    const meter=(x%PREVIEW_PPM)===0;
    pctx.strokeStyle=meter?'rgba(210,225,240,.24)':'rgba(180,200,220,.10)';
    pctx.beginPath(); pctx.moveTo(Math.round(x)+.5,0); pctx.lineTo(Math.round(x)+.5,previewWorldH); pctx.stroke();
  }
  for(let y=0;y<=previewWorldH;y+=step){
    const meter=(y%PREVIEW_PPM)===0;
    pctx.strokeStyle=meter?'rgba(210,225,240,.24)':'rgba(180,200,220,.10)';
    pctx.beginPath(); pctx.moveTo(0,Math.round(y)+.5); pctx.lineTo(previewWorldW,Math.round(y)+.5); pctx.stroke();
  }
  pctx.font='11px Arial'; pctx.fillStyle='rgba(220,230,240,.48)';
  for(let x=0;x<=previewWorldW;x+=PREVIEW_PPM) pctx.fillText((x/PREVIEW_PPM).toFixed(0)+' m',x+5,15);
  for(let y=0;y<=previewWorldH;y+=PREVIEW_PPM) pctx.fillText((y/PREVIEW_PPM).toFixed(0)+' m',5,y-5);
  pctx.restore();
}
function drawRoomBackground(){
  const room=previewBackgroundCatalog.find(r=>r.roomId===previewSelectedRoomId);
  if(!room)return;
  pctx.save(); pctx.beginPath(); pctx.rect(0,0,previewWorldW,previewWorldH); pctx.clip();
  for(const layer of room.layers||[]){
    if(!layer.img)continue;
    const w=(layer.nativeWidth||layer.img.naturalWidth||1)*(layer.scale||1);
    const h=(layer.nativeHeight||layer.img.naturalHeight||1)*(layer.scale||1);
    const x=(layer.x!==undefined?layer.x:room.width/2), y=(layer.y!==undefined?layer.y:room.height/2);
    pctx.save(); pctx.globalAlpha=layer.opacity!==undefined?layer.opacity:1;
    pctx.translate(x,y); pctx.rotate((layer.rotation||0)*Math.PI/180); pctx.scale(layer.flipH?-1:1,layer.flipV?-1:1);
    pctx.drawImage(layer.img,-w/2,-h/2,w,h); pctx.restore();
  }
  pctx.restore();
}
function getPreviewSource(){
  const tab=activeTabId();
  if(tab==='animation' && typeof animDoc!=='undefined' && animDoc.docW) return animDoc.flatten();
  if(tab==='destruction' && typeof brokenW!=='undefined' && brokenW) return brokenCanvas;
  return (typeof mainDoc!=='undefined' && mainDoc.docW)?mainDoc.flatten():null;
}
function drawPreviewObject(){
  const src=getPreviewSource(), box=getPreviewObjectBox();
  if(!box)return;
  pctx.save();
  pctx.translate(previewObjectX,previewObjectY);
  pctx.fillStyle='rgba(77,154,106,.08)'; pctx.fillRect(-box.w/2,-box.h/2,box.w,box.h);
  if(src) pctx.drawImage(src,-box.w/2,-box.h/2,box.w,box.h);
  pctx.strokeStyle=previewObjectSelected?'rgba(255,220,90,.98)':'rgba(127,233,160,.9)';
  pctx.lineWidth=previewObjectSelected?3:2; pctx.setLineDash(previewObjectSelected?[10,5]:[8,5]);
  pctx.strokeRect(-box.w/2,-box.h/2,box.w,box.h); pctx.setLineDash([]);
  pctx.restore();
  drawObjectDimensions(box);
}
function fmtGameSize(cm){
  if(cm>=100) return (cm/100).toFixed(cm%100?2:1)+' м';
  return Math.round(cm)+' см';
}
function drawObjectDimensions(box){
  const wCm=(+document.getElementById('realWidthCm').value||0), hCm=(+document.getElementById('realHeightCm').value||0);
  if(!wCm||!hCm)return;
  pctx.save(); pctx.strokeStyle='rgba(231,198,91,.9)'; pctx.fillStyle='rgba(245,224,150,.95)'; pctx.lineWidth=1;
  pctx.font='12px Arial';
  const gap=24;
  pctx.beginPath(); pctx.moveTo(box.left,box.top-gap); pctx.lineTo(box.right,box.top-gap); pctx.moveTo(box.left,box.top-gap-4); pctx.lineTo(box.left,box.top-gap+4); pctx.moveTo(box.right,box.top-gap-4); pctx.lineTo(box.right,box.top-gap+4); pctx.stroke();
  pctx.textAlign='center'; pctx.fillText(fmtGameSize(wCm),previewObjectX,box.top-gap-7);
  pctx.beginPath(); pctx.moveTo(box.right+gap,box.top); pctx.lineTo(box.right+gap,box.bottom); pctx.moveTo(box.right+gap-4,box.top); pctx.lineTo(box.right+gap+4,box.top); pctx.moveTo(box.right+gap-4,box.bottom); pctx.lineTo(box.right+gap+4,box.bottom); pctx.stroke();
  pctx.save(); pctx.translate(box.right+gap+7,previewObjectY); pctx.rotate(Math.PI/2); pctx.textAlign='center'; pctx.fillText(fmtGameSize(hCm),0,0); pctx.restore();
  pctx.restore();
}
function updatePreviewSizeLabel(){
  const w=+document.getElementById('realWidthCm').value||0, h=+document.getElementById('realHeightCm').value||0;
  document.getElementById('previewObjectSizeLabel').textContent=w&&h?`Размер: ${fmtGameSize(w)} × ${fmtGameSize(h)}`:'Размер: задай ширину и высоту';
}
function ensurePreviewWorldForCurrentRoom(){
  const room=previewBackgroundCatalog.find(r=>r.roomId===previewSelectedRoomId);
  previewWorldW=room?.width||PREVIEW_DEFAULT_W; previewWorldH=room?.height||PREVIEW_DEFAULT_H;
  previewObjectX=Math.max(1,Math.min(previewWorldW-1,previewObjectX||previewWorldW/2));
  previewObjectY=Math.max(1,Math.min(previewWorldH-1,previewObjectY||previewWorldH/2));
  const box=getPreviewObjectBox();
  if(box){ previewObjectX=Math.max(box.w/2,Math.min(previewWorldW-box.w/2,previewObjectX)); previewObjectY=Math.max(box.h/2,Math.min(previewWorldH-box.h/2,previewObjectY)); }
  previewCanvas.width=Math.max(1,Math.round(previewWorldW)); previewCanvas.height=Math.max(1,Math.round(previewWorldH));
  previewStage.style.width=previewWorldW+'px'; previewStage.style.height=previewWorldH+'px';
}
function drawWorldPreview(){
  ensurePreviewWorldForCurrentRoom();
  pctx.clearRect(0,0,previewWorldW,previewWorldH);
  pctx.fillStyle='#14191f'; pctx.fillRect(0,0,previewWorldW,previewWorldH);
  drawRoomBackground();
  drawGrid();
  drawPreviewObject();
  updatePreviewSizeLabel();
}
function drawIntoPreview(sourceCanvasOrImg){
  // Сохраняем старую функцию для совместимости: теперь она обновляет игровое превью.
  drawWorldPreview();
}
function activeTabId(){ const t=document.querySelector('.tab.active'); return t?t.dataset.tab:'basic'; }
function syncPreview(){
  if(animPlaying||destroyPlaying)return;
  drawWorldPreview();
}

async function loadImageFromPreviewPath(relPath){
  if(!projectDirHandle||!relPath)return null;
  try{
    const spritesDir=await getSubdir(projectDirHandle,'assets/sprites',false);
    const clean=String(relPath).replace(/^assets\/sprites\//,'').replace(/^\//,'');
    const parts=clean.split('/'); const fileName=parts.pop();
    const subDir=parts.length?await getSubdir(spritesDir,parts.join('/'),false):spritesDir;
    const fh=await subDir.getFileHandle(fileName); const file=await fh.getFile();
    const url=URL.createObjectURL(file);
    const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=url;});
    return {img,url};
  }catch(e){ return null; }
}
async function scanPreviewBackgrounds(){
  if(!projectDirHandle){
    previewBackgroundCatalog=[];
    const sel=document.getElementById('previewBackgroundSelect');
    sel.innerHTML='<option value="">Без фона — подключи папку проекта</option>';
    sel.value=''; previewSelectedRoomId=''; previewWorldW=PREVIEW_DEFAULT_W; previewWorldH=PREVIEW_DEFAULT_H;
    fitPreviewToViewport(); drawWorldPreview(); return;
  }
  const found=[];
  try{
    const roomsDir=await getSubdir(projectDirHandle,'data/rooms',false);
    for await(const [name,handle] of roomsDir.entries()){
      if(handle.kind!=='file'||!name.endsWith('.json'))continue;
      try{
        const data=JSON.parse(await (await handle.getFile()).text());
        const layers=data.backgroundLayers||(data.background?[data.background]:[]);
        const room={roomId:data.id||name.replace(/\.json$/,''),roomName:data.name||data.id||name,width:data.width||PREVIEW_DEFAULT_W,height:data.height||PREVIEW_DEFAULT_H,layers:[]};
        for(const ld of layers){
          if(!ld||!ld.image)continue;
          const loaded=await loadImageFromPreviewPath(ld.image);
          if(!loaded)continue;
          room.layers.push({img:loaded.img,url:loaded.url,nativeWidth:loaded.img.naturalWidth,nativeHeight:loaded.img.naturalHeight,
            opacity:ld.opacity!==undefined?ld.opacity:1,parallax:ld.parallax!==undefined?ld.parallax:1,
            x:ld.x!==undefined?ld.x:room.width/2,y:ld.y!==undefined?ld.y:room.height/2,scale:ld.scale!==undefined?ld.scale:1,
            rotation:ld.rotation||0,flipH:!!ld.flipH,flipV:!!ld.flipV});
        }
        if(room.layers.length)found.push(room);
      }catch(e){}
    }
  }catch(e){}
  previewBackgroundCatalog.forEach(r=>(r.layers||[]).forEach(l=>{if(l.url)URL.revokeObjectURL(l.url);}));
  previewBackgroundCatalog=found;
  const sel=document.getElementById('previewBackgroundSelect'), current=previewSelectedRoomId;
  sel.innerHTML='<option value="">Без фона</option>'+found.map(r=>`<option value="${esc(r.roomId)}">${esc(r.roomName)} — ${Math.round(r.width/PREVIEW_PPM*10)/10} × ${Math.round(r.height/PREVIEW_PPM*10)/10} м</option>`).join('');
  if(found.some(r=>r.roomId===current)){ sel.value=current; } else { sel.value=''; previewSelectedRoomId=''; }
  ensurePreviewWorldForCurrentRoom();
  fitPreviewToViewport(); drawWorldPreview();
}
document.getElementById('previewBackgroundSelect').addEventListener('change', async e=>{
  previewSelectedRoomId=e.target.value||'';
  const room=previewBackgroundCatalog.find(r=>r.roomId===previewSelectedRoomId);
  if(room){ previewWorldW=room.width||PREVIEW_DEFAULT_W; previewWorldH=room.height||PREVIEW_DEFAULT_H; previewObjectX=previewWorldW/2; previewObjectY=previewWorldH/2; }
  else { previewWorldW=PREVIEW_DEFAULT_W; previewWorldH=PREVIEW_DEFAULT_H; previewObjectX=previewWorldW/2; previewObjectY=previewWorldH/2; }
  previewAutoFit=true; fitPreviewToViewport(); drawWorldPreview();
});
document.getElementById('btnRefreshPreviewBackgrounds').onclick=scanPreviewBackgrounds;
document.getElementById('previewGridEnabled').addEventListener('change',drawWorldPreview);

window.addEventListener('resize',()=>{ if(previewAutoFit) fitPreviewToViewport(); });
applyPreviewTransform();
