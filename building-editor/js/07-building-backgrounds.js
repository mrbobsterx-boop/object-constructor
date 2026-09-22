/* ============================================================
   MODULE 07 — BUILDING BACKGROUNDS
   Background images of the building: scan, add, paste, crop, drag, resize,
   opacity / rotation / flip / z-order controls.
   ============================================================ */

// Новый фон по умолчанию вписывается по ширине здания (самая правая комната, но не уже 10 м)
function newBuildingBgPlacement(nativeW){
  const span=Math.max(10*PIXELS_PER_METER,...placedRooms.map(q=>q.x+q.w));
  return {x:span/2, scale:span/Math.max(1,nativeW)};
}
async function scanBuildingBackgrounds(){
  if(!projectDirHandle)return;
  const out=[];
  async function walk(dir,prefix){
    for await(const [name,h] of dir.entries()){
      if(h.kind==='directory') await walk(h,prefix+name+'/');
      else if(/\.(png|jpg|jpeg|webp)$/i.test(name)) out.push({path:prefix+name,handle:h});
    }
  }
  try{ const dir=await getSubdir(projectDirHandle,'assets/sprites/rooms',false); await walk(dir,'assets/sprites/rooms/'); }catch(e){ document.getElementById('buildingBgSelect').innerHTML='<option value="">— папка фонов не найдена —</option>'; return; }
  buildingBackgroundCatalog=out;
  document.getElementById('buildingBgSelect').innerHTML=out.length?out.map((x,i)=>`<option value="${i}">${esc(x.path)}</option>`).join(''):'<option value="">— фоны не найдены —</option>';
}
async function addBuildingBackground(){
  const idx=Number(document.getElementById('buildingBgSelect').value); const item=buildingBackgroundCatalog[idx]; if(!item)return;
  try{
    const file=await item.handle.getFile(); const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    const dims=await getImageDims(dataUrl);
    const b={id:'bg_'+Date.now()+Math.random().toString(36).slice(2),path:item.path,dataUrl,w:dims.w,h:dims.h,...(()=>{const pl=newBuildingBgPlacement(dims.w); return {x:pl.x,scale:pl.scale};})(),y:6*PIXELS_PER_METER,opacity:1,rotation:0,flipH:false,flipV:false,z:0};
    buildingBackgrounds.push(b); selectedBuildingBgId=b.id; renderBuildingBackgrounds();
  }catch(e){alert('Не удалось загрузить фон.');}
}
function renderBuildingBackgrounds(){
  const list=document.getElementById('buildingBgList');
  list.innerHTML=buildingBackgrounds.slice().sort((a,b)=>(a.z||0)-(b.z||0)).map(b=>`<div class="bg-layer-row ${b.id===selectedBuildingBgId?'selected':''}" data-bg="${b.id}">${esc((b.path||'фон').split('/').pop())}<div class="muted">${pxToM(b.w*b.scale)}×${pxToM(b.h*b.scale)} м · z:${b.z||0}</div></div>`).join('')||'<span class="muted">Слоёв пока нет.</span>';
  list.querySelectorAll('[data-bg]').forEach(el=>el.onclick=()=>{selectedBuildingBgId=el.dataset.bg; renderBuildingBackgrounds(); renderBuildingCanvas();});
  const b=buildingBackgrounds.find(x=>x.id===selectedBuildingBgId), panel=document.getElementById('buildingBgControls');
  panel.style.display=b?'':'none';
  if(b){ for(const [id,key] of [['bgX','x'],['bgY','y'],['bgScale','scale'],['bgOpacity','opacity'],['bgRotation','rotation'],['bgZ','z']])document.getElementById(id).value=(key==='x'||key==='y')?pxToM(b[key]):b[key]; }
}
function updateSelectedBuildingBg(){
  const b=buildingBackgrounds.find(x=>x.id===selectedBuildingBgId); if(!b)return;
  b.x=mToPx(Number(document.getElementById('bgX').value)||0); b.y=mToPx(Number(document.getElementById('bgY').value)||0); b.scale=Math.max(0.01,Number(document.getElementById('bgScale').value)||1); b.opacity=Math.max(0,Math.min(1,Number(document.getElementById('bgOpacity').value)||0)); b.rotation=Number(document.getElementById('bgRotation').value)||0; b.z=Number(document.getElementById('bgZ').value)||0; renderBuildingBackgrounds(); renderBuildingCanvas();
}
function startDragBuildingBackground(e,b){
  const sx=e.clientX, sy=e.clientY, ox=b.x, oy=b.y;
  const move=ev=>{ b.x=ox+(ev.clientX-sx)/buildingZoom; b.y=oy+(ev.clientY-sy)/buildingZoom; renderBuildingCanvas(); };
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderBuildingBackgrounds();};
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function startResizeBuildingBackground(e,b,handle){
  const startX=e.clientX,startY=e.clientY,startScale=b.scale,startW=b.w,startH=b.h,startCX=b.x,startCY=b.y,startRot=(b.rotation||0)*Math.PI/180;
  const sx=handle.includes('e')?1:-1, sy=handle.includes('s')?1:-1;
  const oppositeLocalX=-sx*startW*startScale/2, oppositeLocalY=-sy*startH*startScale/2;
  const cos=Math.cos(startRot), sin=Math.sin(startRot);
  const move=ev=>{
    const dx=(ev.clientX-startX)/buildingZoom, dy=(ev.clientY-startY)/buildingZoom;
    const localDx=dx*cos+dy*sin, localDy=-dx*sin+dy*cos;
    const draggedLocalX=oppositeLocalX+localDx, draggedLocalY=oppositeLocalY+localDy;
    const aspect=startW/startH || 1;
    let newW=Math.max(20,Math.abs(draggedLocalX)*2), newH=newW/aspect;
    const maxH=Math.max(20,Math.abs(draggedLocalY)*2); if(newH<maxH)newH=maxH,newW=newH*aspect;
    b.scale=Math.max(0.01,newW/startW);
    const centerLocalX=(oppositeLocalX+(sx*newW/2))/2;
    const centerLocalY=(oppositeLocalY+(sy*newH/2))/2;
    b.x=startCX+centerLocalX*cos-centerLocalY*sin;
    b.y=startCY+centerLocalX*sin+centerLocalY*cos;
    renderBuildingCanvas();
  };
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderBuildingBackgrounds();};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
}
async function addBuildingBackground(){
  const idx=Number(document.getElementById('buildingBgSelect').value); const item=buildingBackgroundCatalog[idx]; if(!item)return;
  try{
    const file=await item.handle.getFile(); const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    const dims=await getImageDims(dataUrl);
    const b={id:'bg_'+Date.now()+Math.random().toString(36).slice(2),path:item.path,dataUrl,w:dims.w,h:dims.h,...(()=>{const pl=newBuildingBgPlacement(dims.w); return {x:pl.x,scale:pl.scale};})(),y:6*PIXELS_PER_METER,opacity:1,rotation:0,flipH:false,flipV:false,z:0};
    buildingBackgrounds.push(b); selectedBuildingBgId=b.id; renderBuildingBackgrounds(); renderBuildingCanvas();
  }catch(e){alert('Не удалось загрузить фон.');}
}
function addBuildingBackgroundFromData(dataUrl,fileName){
  return getImageDims(dataUrl).catch(()=>null).then(async dims=>{
    if(!dims){ alert('Не удалось прочитать картинку: файл повреждён или это не изображение.'); return; }
    let path='assets/sprites/rooms/building_backgrounds/'+fileName;
    if(projectDirHandle){
      try{
        const base=fileName.replace(/[^a-zA-Z0-9._-]+/g,'_');
        path='assets/sprites/rooms/building_backgrounds/'+base;
        const m=dataUrl.match(/^data:([^;]+);base64,(.*)$/); if(m){
          const bin=atob(m[2]); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
          await writeFileToProject(path,bytes);
        }
      }catch(e){ console.warn('Не удалось сохранить пользовательский фон в проект:',e); }
    }
    const b={id:'bg_'+Date.now()+Math.random().toString(36).slice(2),path,dataUrl,w:dims.w,h:dims.h,...(()=>{const pl=newBuildingBgPlacement(dims.w); return {x:pl.x,scale:pl.scale};})(),y:6*PIXELS_PER_METER,opacity:1,rotation:0,flipH:false,flipV:false,z:0};
    buildingBackgrounds.push(b); selectedBuildingBgId=b.id; renderBuildingBackgrounds(); renderBuildingCanvas();
  });
}
async function chooseBuildingBackgroundFile(file){
  if(!file)return;
  const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
  const ext=(file.name.match(/\.[^.]+$/)||['.png'])[0].toLowerCase();
  await addBuildingBackgroundFromData(dataUrl,'building_bg_'+Date.now()+ext);
}
async function pasteBuildingBackground(){
  try{
    if(navigator.clipboard?.read){
      const items=await navigator.clipboard.read();
      for(const item of items){
        const type=item.types.find(x=>x.startsWith('image/'));
        if(type){const blob=await item.getType(type);const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});await addBuildingBackgroundFromData(dataUrl,'pasted_background_'+Date.now()+'.png');return;}
      }
    }
    alert('В буфере не найдено изображение. Можно также нажать Ctrl+V прямо в редакторе.');
  }catch(e){alert('Браузер не разрешил чтение изображения из буфера. Попробуй Ctrl+V.');}
}
function applySelectedCrop(){
  const p=placedRooms.find(x=>x.instanceId===selectedPlacedId); if(!p||!p.roomId)return;
  const meta=getRoomMeta(p.roomId); if(!meta)return;
  const c={left:mToPx(Math.max(0,Number(document.getElementById('cropLeft').value)||0)),right:mToPx(Math.max(0,Number(document.getElementById('cropRight').value)||0)),top:mToPx(Math.max(0,Number(document.getElementById('cropTop').value)||0)),bottom:mToPx(Math.max(0,Number(document.getElementById('cropBottom').value)||0))};
  if(c.left+c.right>=meta.width || c.top+c.bottom>=meta.height){alert('Обрезка больше или равна размеру комнаты.');return;}
  p.crop=c; p.w=meta.width-c.left-c.right; p.h=meta.height-c.top-c.bottom; recomputeAndRender();
}
function syncCropUI(){
  const p=placedRooms.find(x=>x.instanceId===selectedPlacedId),c=p?.crop||{left:0,right:0,top:0,bottom:0};
  document.getElementById('cropLeft').value=pxToM(c.left||0); document.getElementById('cropRight').value=pxToM(c.right||0); document.getElementById('cropTop').value=pxToM(c.top||0); document.getElementById('cropBottom').value=pxToM(c.bottom||0);
}
document.getElementById('btnScanBuildingBackgrounds').onclick=scanBuildingBackgrounds;
document.getElementById('btnAddBuildingBackground').onclick=addBuildingBackground;
document.getElementById('btnChooseBuildingBgFile').onclick=()=>document.getElementById('buildingBgFileInput').click();
document.getElementById('buildingBgFileInput').onchange=e=>chooseBuildingBackgroundFile(e.target.files?.[0]);
document.getElementById('btnPasteBuildingBg').onclick=pasteBuildingBackground;
document.addEventListener('paste',e=>{
  const item=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));
  if(!item)return;
  const file=item.getAsFile(); if(!file)return;
  e.preventDefault(); chooseBuildingBackgroundFile(file);
});
document.getElementById('btnApplyCrop').onclick=applySelectedCrop;
['bgX','bgY','bgScale','bgOpacity','bgRotation','bgZ'].forEach(id=>document.getElementById(id).addEventListener('change',updateSelectedBuildingBg));
document.getElementById('btnBgFlipH').onclick=()=>{const b=buildingBackgrounds.find(x=>x.id===selectedBuildingBgId);if(b){b.flipH=!b.flipH;renderBuildingBackgrounds();renderBuildingCanvas();}};
document.getElementById('btnBgFlipV').onclick=()=>{const b=buildingBackgrounds.find(x=>x.id===selectedBuildingBgId);if(b){b.flipV=!b.flipV;renderBuildingBackgrounds();renderBuildingCanvas();}};
document.getElementById('btnDeleteBuildingBg').onclick=()=>{buildingBackgrounds=buildingBackgrounds.filter(x=>x.id!==selectedBuildingBgId);selectedBuildingBgId=null;renderBuildingBackgrounds();renderBuildingCanvas();};
