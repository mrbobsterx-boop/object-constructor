/* ============================================================
   MODULE 02 — IMAGE DOCUMENT
   Reusable image/layer/collision engine.
   Public API is consumed by the editor modules below.
   ============================================================ */

/* ============================================================
   ImageDocument: reusable multi-layer image editor.
   Each layer = {id,name,bitmap(canvas),visible,tl,tr,bl} — a 3-point
   affine frame (TL/TR/BL are draggable doc-space points; BR is the
   derived 4th corner = TL+(TR-TL)+(BL-TL), shown but not draggable).
   This gives skew/scale/rotate via corner dragging, without needing
   true 4-point perspective (see chat note on that tradeoff).
   ============================================================ */
class ImageDocument{
  constructor(canvas, handleLayerEl, opts={}){
    this.canvas=canvas; this.ctx=canvas.getContext('2d',{willReadFrequently:true});
    this.handleLayer=handleLayerEl;
    this.layers=[]; this.activeLayerId=null;
    this.docW=0; this.docH=0;
    this.zoom=opts.zoom||2;
    this.onChange=opts.onChange||(()=>{});
    this.onCommit=opts.onCommit||(()=>{});
    this.collision={mode:'AUTO',padding:0,rect:null};
    this.tool='MOVE';
    this.brushColor='#9A9A9A'; this.brushSize=12; this.brushSmooth=true;
    this._drag=null;
    this._bind();
  }
  static blankBitmap(w,h){ const c=document.createElement('canvas'); c.width=Math.max(1,w); c.height=Math.max(1,h); return c; }
  static bitmapFromImage(img){ const c=document.createElement('canvas'); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height; c.getContext('2d').drawImage(img,0,0); return c; }

  clear(){ this.layers=[]; this.activeLayerId=null; this.docW=0; this.docH=0; this.canvas.width=0; this.canvas.height=0; this.collision={mode:'AUTO',padding:0,rect:null}; this.render(); }

  get activeLayer(){ return this.layers.find(l=>l.id===this.activeLayerId)||null; }

  addLayerFromImage(img){
    const bmp=ImageDocument.bitmapFromImage(img);
    const w=bmp.width,h=bmp.height;
    const isFirst = this.layers.length===0;
    if(isFirst){ this.docW=w; this.docH=h; this.canvas.width=w; this.canvas.height=h; this._applyZoom(); }
    const scale = isFirst ? 1 : Math.min(this.docW/w, this.docH/h, 1);
    const dispW = w*scale, dispH = h*scale;
    const x = isFirst?0:Math.round((this.docW-dispW)/2), y = isFirst?0:Math.round((this.docH-dispH)/2);
    const layer={ id:'L'+Date.now()+Math.random().toString(36).slice(2), name:'Слой '+(this.layers.length+1),
      bitmap:bmp, w0:w, h0:h, visible:true,
      tl:{x:x,y:y}, tr:{x:x+dispW,y:y}, bl:{x:x,y:y+dispH} };
    this.layers.push(layer); this.activeLayerId=layer.id;
    if(this.collision.mode==='AUTO' && isFirst) this._recomputeAutoCollision();
    this.render(); this.onCommit();
  }
  addBlankLayer(){
    if(!this.docW) return;
    const bmp=ImageDocument.blankBitmap(this.docW,this.docH);
    const layer={ id:'L'+Date.now()+Math.random().toString(36).slice(2), name:'Слой '+(this.layers.length+1),
      bitmap:bmp, w0:this.docW,h0:this.docH, visible:true,
      tl:{x:0,y:0}, tr:{x:this.docW,y:0}, bl:{x:0,y:this.docH} };
    this.layers.push(layer); this.activeLayerId=layer.id; this.render(); this.onCommit();
  }
  deleteActiveLayer(){
    const idx=this.layers.findIndex(l=>l.id===this.activeLayerId);
    if(idx<0)return;
    this.layers.splice(idx,1);
    this.activeLayerId=this.layers.length? this.layers[Math.max(0,idx-1)].id : null;
    if(!this.layers.length){ this.docW=0;this.docH=0;this.canvas.width=0;this.canvas.height=0; }
    this.render(); this.onCommit();
  }
  mergeAllLayers(){
    if(this.layers.length<2)return;
    const flat=this.flatten();
    this.layers=[{ id:'L'+Date.now(), name:'Слой 1', bitmap:flat, w0:this.docW,h0:this.docH, visible:true,
      tl:{x:0,y:0}, tr:{x:this.docW,y:0}, bl:{x:0,y:this.docH} }];
    this.activeLayerId=this.layers[0].id;
    this.render(); this.onCommit();
  }
  flipActiveLayerH(){ const l=this.activeLayer; if(!l)return; const t=l.tl; l.tl=l.tr; l.tr=t; this.render(); this.onCommit(); }
  flipActiveLayerV(){ const l=this.activeLayer; if(!l)return; const t=l.tl; l.tl=l.bl; l.bl=t; this.render(); this.onCommit(); }
  resetActiveLayerTransform(){ const l=this.activeLayer; if(!l)return; const x=l.tl.x,y=l.tl.y; l.tl={x,y};l.tr={x:x+l.w0,y};l.bl={x,y:y+l.h0}; this.render(); this.onCommit(); }
  moveLayer(layerId,dir){ // dir: +1 = toward top (drawn later/on top), -1 = toward bottom
    const idx=this.layers.findIndex(l=>l.id===layerId); if(idx<0)return;
    const newIdx=idx+dir; if(newIdx<0||newIdx>=this.layers.length)return;
    const tmp=this.layers[idx]; this.layers[idx]=this.layers[newIdx]; this.layers[newIdx]=tmp;
    this.render(); this.onCommit();
  }
  centerActiveLayer(){
    const l=this.activeLayer; if(!l)return;
    const c=this.layerCenter(l);
    const dx=this.docW/2-c.x, dy=this.docH/2-c.y;
    l.tl={x:l.tl.x+dx,y:l.tl.y+dy}; l.tr={x:l.tr.x+dx,y:l.tr.y+dy}; l.bl={x:l.bl.x+dx,y:l.bl.y+dy};
    this.render(); this.onCommit();
  }
  rotateActiveLayerBy(deltaDeg, center){
    const l=this.activeLayer; if(!l)return;
    const rad=deltaDeg*Math.PI/180, cos=Math.cos(rad), sin=Math.sin(rad);
    const rot=p=>{ const dx=p.x-center.x, dy=p.y-center.y; return {x:center.x+dx*cos-dy*sin, y:center.y+dx*sin+dy*cos}; };
    l.tl=rot(l.tl); l.tr=rot(l.tr); l.bl=rot(l.bl);
    this.render();
  }
  layerCenter(l){ const brX=l.tr.x+l.bl.x-l.tl.x, brY=l.tr.y+l.bl.y-l.tl.y; return {x:(l.tl.x+l.tr.x+l.bl.x+brX)/4, y:(l.tl.y+l.tr.y+l.bl.y+brY)/4}; }

  _layerMatrix(l){
    const w=l.w0,h=l.h0;
    const a=(l.tr.x-l.tl.x)/w, b=(l.tr.y-l.tl.y)/w, c=(l.bl.x-l.tl.x)/h, d=(l.bl.y-l.tl.y)/h, e=l.tl.x, f=l.tl.y;
    return [a,b,c,d,e,f];
  }
  _inv(m){ const [a,b,c,d,e,f]=m; const det=a*d-b*c||1e-9;
    return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det]; }
  docToLocal(l,px,py){ const m=this._inv(this._layerMatrix(l)); return {x:m[0]*px+m[2]*py+m[4], y:m[1]*px+m[3]*py+m[5]}; }

  drawLayer(ctx,l){ const m=this._layerMatrix(l); ctx.save(); ctx.setTransform(...m); ctx.drawImage(l.bitmap,0,0); ctx.restore(); }
  render(){
    this.ctx.imageSmoothingEnabled=false;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.layers.forEach(l=>{ if(l.visible) this.drawLayer(this.ctx,l); });
    this.ctx.setTransform(1,0,0,1,0,0);
    this._renderHandles();
    this.onChange();
  }
  flatten(){
    if(!this.docW)return null;
    const out=document.createElement('canvas'); out.width=this.docW; out.height=this.docH;
    const octx=out.getContext('2d');
    octx.imageSmoothingEnabled=false;
    this.layers.forEach(l=>{ if(l.visible) this.drawLayer(octx,l); });
    return out;
  }

  /* ---- collision ---- */
  _recomputeAutoCollision(){
    const flat=this.flatten(); if(!flat){ this.collision.rect=null; return; }
    const octx=flat.getContext('2d'); const data=octx.getImageData(0,0,flat.width,flat.height).data;
    let minX=flat.width,minY=flat.height,maxX=-1,maxY=-1;
    for(let y=0;y<flat.height;y++)for(let x=0;x<flat.width;x++) if(data[(y*flat.width+x)*4+3]>10){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    if(maxX<0){ this.collision.rect=null; return; }
    this.collision.rect={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  }
  getCollisionRect(){
    if(this.collision.mode==='NONE') return null;
    if(this.collision.mode==='FULL') return {x:0,y:0,w:this.docW,h:this.docH};
    let r=this.collision.rect;
    if(this.collision.mode==='AUTO'){ this._recomputeAutoCollision(); r=this.collision.rect; }
    if(!r) return null;
    const p=this.collision.padding||0;
    return {x:r.x-p,y:r.y-p,w:r.w+2*p,h:r.h+2*p};
  }

  /* ---- trim / pad / resize (applies to whole flattened doc, redistributes into layers proportionally is overkill — we flatten to one layer for these ops, simplest & predictable) ---- */
  trim(){
    const flat=this.flatten(); if(!flat)return;
    const octx=flat.getContext('2d'); const data=octx.getImageData(0,0,flat.width,flat.height).data;
    let minX=flat.width,minY=flat.height,maxX=-1,maxY=-1;
    for(let y=0;y<flat.height;y++)for(let x=0;x<flat.width;x++) if(data[(y*flat.width+x)*4+3]>10){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    if(maxX<0)return;
    const newW=maxX-minX+1, newH=maxY-minY+1;
    if(minX===0&&minY===0&&newW===flat.width&&newH===flat.height)return;
    const cropped=document.createElement('canvas'); cropped.width=newW; cropped.height=newH;
    cropped.getContext('2d').drawImage(flat,-minX,-minY);
    this._replaceWithFlat(cropped);
  }
  pad(top,bottom,left,right){
    const flat=this.flatten(); if(!flat)return;
    const newW=flat.width+left+right, newH=flat.height+top+bottom;
    const c=document.createElement('canvas'); c.width=newW; c.height=newH;
    c.getContext('2d').drawImage(flat,left,top);
    this._replaceWithFlat(c);
  }
  resizeToHeight(targetH){
    const flat=this.flatten(); if(!flat || !flat.height)return;
    const scale=targetH/flat.height; const newW=Math.max(1,Math.round(flat.width*scale)), newH=Math.max(1,Math.round(targetH));
    const c=document.createElement('canvas'); c.width=newW; c.height=newH;
    const cctx=c.getContext('2d'); cctx.imageSmoothingEnabled=true; cctx.drawImage(flat,0,0,newW,newH);
    this._replaceWithFlat(c);
  }
  _replaceWithFlat(canvasEl){
    this.docW=canvasEl.width; this.docH=canvasEl.height;
    this.canvas.width=this.docW; this.canvas.height=this.docH; this._applyZoom();
    this.layers=[{ id:'L'+Date.now(), name:'Слой 1', bitmap:canvasEl, w0:this.docW,h0:this.docH, visible:true,
      tl:{x:0,y:0}, tr:{x:this.docW,y:0}, bl:{x:0,y:this.docH} }];
    this.activeLayerId=this.layers[0].id;
    this.collision.rect=null;
    this.render(); this.onCommit();
  }

  /* ---- serialize / restore (for animation frames) ---- */
  async serialize(){
    const layers=await Promise.all(this.layers.map(async l=>({
      id:l.id,name:l.name,visible:l.visible,w0:l.w0,h0:l.h0,tl:l.tl,tr:l.tr,bl:l.bl,
      bitmap:l.bitmap.toDataURL()
    })));
    return {docW:this.docW,docH:this.docH,collision:this.collision,layers};
  }
  async restore(state){
    if(!state){ this.clear(); return; }
    this.docW=state.docW; this.docH=state.docH;
    this.canvas.width=this.docW; this.canvas.height=this.docH; this._applyZoom();
    this.collision=state.collision||{mode:'AUTO',padding:0,rect:null};
    this.layers=await Promise.all(state.layers.map(async ld=>{
      const img=await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=ld.bitmap; });
      const bmp=document.createElement('canvas'); bmp.width=ld.w0; bmp.height=ld.h0; bmp.getContext('2d').drawImage(img,0,0);
      return { id:ld.id,name:ld.name,visible:ld.visible,w0:ld.w0,h0:ld.h0,tl:ld.tl,tr:ld.tr,bl:ld.bl, bitmap:bmp };
    }));
    this.activeLayerId=this.layers.length?this.layers[0].id:null;
    this.render();
  }

  _applyZoom(){ this.canvas.style.width=(this.docW*this.zoom)+"px"; this.canvas.style.height=(this.docH*this.zoom)+"px"; }
  setZoom(z){ this.zoom=z; this._applyZoom(); this.render(); }

  /* ---- handles (corner drag, rotate handle, collision rect) ---- */
  _renderHandles(){
    const hl=this.handleLayer; hl.innerHTML='';
    if(!this.docW)return;
    const rect=this.canvas.getBoundingClientRect(); const s=rect.width/this.docW;
    hl.style.width=rect.width+"px"; hl.style.height=rect.height+"px";
    const l=this.activeLayer;
    if(l && this.tool==='MOVE'){
      const brX=l.tr.x+l.bl.x-l.tl.x, brY=l.tr.y+l.bl.y-l.tl.y;
      const mk=(p,cls,tag)=>{ const d=document.createElement('div'); d.className='corner-handle'+(cls?(' '+cls):''); d.style.left=(p.x*s)+"px"; d.style.top=(p.y*s)+"px"; d.dataset.corner=tag; hl.appendChild(d); return d; };
      mk(l.tl,'move','tl'); mk(l.tr,'','tr'); mk(l.bl,'','bl');
      const brDot=document.createElement('div'); brDot.className='corner-handle'; brDot.style.opacity='.4'; brDot.style.left=(brX*s)+"px"; brDot.style.top=(brY*s)+"px"; brDot.style.pointerEvents='none'; hl.appendChild(brDot);
      // rotate handle above center-top
      const c=this.layerCenter(l);
      const topMidX=(l.tl.x+l.tr.x)/2, topMidY=(l.tl.y+l.tr.y)/2;
      const dx=topMidX-c.x, dy=topMidY-c.y, len=Math.hypot(dx,dy)||1;
      const rx=topMidX+dx/len*22, ry=topMidY+dy/len*22;
      const rot=document.createElement('div'); rot.className='corner-handle'; rot.style.background='#e7c65b'; rot.style.borderColor='#fff0c0';
      rot.style.left=(rx*s)+"px"; rot.style.top=(ry*s)+"px"; rot.dataset.corner='rotate'; hl.appendChild(rot);
    }
    if(this.tool==='COLLISION'){
      const r=this.getCollisionRect();
      if(r){
        const box=document.createElement('div'); box.className='collision-rect';
        box.style.left=(r.x*s)+"px"; box.style.top=(r.y*s)+"px"; box.style.width=(r.w*s)+"px"; box.style.height=(r.h*s)+"px";
        box.style.pointerEvents='none'; hl.appendChild(box);
        if(this.collision.mode==='MANUAL'){
          const corners=[['nw',r.x,r.y],['ne',r.x+r.w,r.y],['sw',r.x,r.y+r.h],['se',r.x+r.w,r.y+r.h]];
          corners.forEach(([tag,x,y])=>{ const d=document.createElement('div'); d.className='collision-edge-handle'; d.style.left=(x*s-5)+"px"; d.style.top=(y*s-5)+"px"; d.dataset.edge=tag; hl.appendChild(d); });
        }
      }
    }
  }

  /* ---- pointer interaction ---- */
  _toDoc(e){ const rect=this.canvas.getBoundingClientRect(); const s=rect.width/this.docW; return {x:(e.clientX-rect.left)/s, y:(e.clientY-rect.top)/s}; }
  _paintAt(x,y,erase){
    const l=this.activeLayer; if(!l)return;
    const local=this.docToLocal(l,x,y);
    const bctx=l.bitmap.getContext('2d');
    bctx.save();
    bctx.lineCap = this.brushSmooth?'round':'butt';
    bctx.lineJoin='round';
    if(erase){ bctx.globalCompositeOperation='destination-out'; bctx.fillStyle='#000'; }
    else { bctx.globalCompositeOperation='source-over'; bctx.fillStyle=this.brushColor; }
    const size=this.brushSize;
    if(this.brushSmooth){ bctx.beginPath(); bctx.arc(local.x,local.y,size/2,0,Math.PI*2); bctx.fill(); }
    else { bctx.fillRect(local.x-size/2,local.y-size/2,size,size); }
    bctx.restore();
  }
  _bind(){
    let dragging=null, painting=false, lastDoc=null;
    this.canvas.addEventListener('pointerdown', e=>{
      if(!this.docW)return;
      const p=this._toDoc(e);
      if(this.tool==='MOVE' && this.activeLayer){ dragging={type:'move-layer',start:p,orig:JSON.parse(JSON.stringify(this.activeLayer))}; return; }
      if(this.tool==='COLLISION'){
        if(this.collision.mode!=='MANUAL'){ this.collision.mode='MANUAL'; }
        this.collision.rect={x:p.x,y:p.y,w:1,h:1};
        dragging={type:'collision-new',start:p};
        this._renderHandles();
        return;
      }
      if(this.tool==='BRUSH'||this.tool==='ERASER'){ painting=true; this._paintAt(p.x,p.y,this.tool==='ERASER'); this.render(); return; }
    });
    this.canvas.addEventListener('pointermove', e=>{
      if(!this.docW)return;
      const p=this._toDoc(e); lastDoc=p;
      if(painting){ this._paintAt(p.x,p.y,this.tool==='ERASER'); this.render(); return; }
      if(dragging && dragging.type==='move-layer'){
        const l=this.activeLayer; const o=dragging.orig; const dx=p.x-dragging.start.x, dy=p.y-dragging.start.y;
        l.tl={x:o.tl.x+dx,y:o.tl.y+dy}; l.tr={x:o.tr.x+dx,y:o.tr.y+dy}; l.bl={x:o.bl.x+dx,y:o.bl.y+dy};
        this.render();
      }
      if(dragging && dragging.type==='collision-new'){
        const r=this.collision.rect; const x0=dragging.start.x,y0=dragging.start.y;
        this.collision.rect={x:Math.min(x0,p.x),y:Math.min(y0,p.y),w:Math.abs(p.x-x0)||1,h:Math.abs(p.y-y0)||1};
        this._renderHandles();
      }
    });
    window.addEventListener('pointerup', ()=>{ const wasActive=painting||dragging; painting=false; dragging=null; if(this.tool==='COLLISION') this.onChange(); if(wasActive) this.onCommit(); });

    this.handleLayer.addEventListener('pointerdown', e=>{
      const corner=e.target.dataset.corner, edge=e.target.dataset.edge;
      if(corner){
        e.stopPropagation();
        const l=this.activeLayer; if(!l)return;
        const startDoc=this._toDocFromPage(e);
        const orig=JSON.parse(JSON.stringify(l));
        const center=this.layerCenter(l);
        const move=ev=>{
          const p=this._toDocFromPage(ev);
          if(corner==='rotate'){
            const a0=Math.atan2(startDoc.y-center.y, startDoc.x-center.x);
            const a1=Math.atan2(p.y-center.y, p.x-center.x);
            const deg=(a1-a0)*180/Math.PI;
            l.tl=orig.tl;l.tr=orig.tr;l.bl=orig.bl; // reset then rotate fresh each move for stability
            this.rotateActiveLayerBy(deg, center);
          } else {
            const dx=p.x-startDoc.x, dy=p.y-startDoc.y;
            if(corner==='tl'){ l.tl={x:orig.tl.x+dx,y:orig.tl.y+dy}; l.tr={x:orig.tr.x+dx,y:orig.tr.y+dy}; l.bl={x:orig.bl.x+dx,y:orig.bl.y+dy}; }
            else if((corner==='tr'||corner==='bl') && ev.shiftKey){
              const trVec={x:orig.tr.x-orig.tl.x,y:orig.tr.y-orig.tl.y};
              const blVec={x:orig.bl.x-orig.tl.x,y:orig.bl.y-orig.tl.y};
              const refVec=corner==='tr'?trVec:blVec;
              const refLen=Math.hypot(refVec.x,refVec.y)||1;
              const dir={x:refVec.x/refLen,y:refVec.y/refLen};
              const proj=dx*dir.x+dy*dir.y;
              const scale=Math.max(1,refLen+proj)/refLen;
              l.tr={x:orig.tl.x+trVec.x*scale,y:orig.tl.y+trVec.y*scale};
              l.bl={x:orig.tl.x+blVec.x*scale,y:orig.tl.y+blVec.y*scale};
            }
            else if(corner==='tr'){ l.tr={x:orig.tr.x+dx,y:orig.tr.y+dy}; }
            else if(corner==='bl'){ l.bl={x:orig.bl.x+dx,y:orig.bl.y+dy}; }
            this.render();
          }
        };
        const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); this.onCommit(); };
        window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
      } else if(edge){
        e.stopPropagation();
        const startDoc=this._toDocFromPage(e);
        const orig={...this.collision.rect};
        const move=ev=>{
          const p=this._toDocFromPage(ev);
          const dx=p.x-startDoc.x, dy=p.y-startDoc.y;
          let r={...orig};
          if(edge.includes('n')){ r.y=orig.y+dy; r.h=orig.h-dy; }
          if(edge.includes('s')){ r.h=orig.h+dy; }
          if(edge.includes('w')){ r.x=orig.x+dx; r.w=orig.w-dx; }
          if(edge.includes('e')){ r.w=orig.w+dx; }
          if(r.w<2)r.w=2; if(r.h<2)r.h=2;
          this.collision.rect=r; this._renderHandles();
        };
        const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); this.onChange(); this.onCommit(); };
        window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
      }
    });
  }
  _toDocFromPage(e){ const rect=this.canvas.getBoundingClientRect(); const s=rect.width/this.docW; return {x:(e.clientX-rect.left)/s,y:(e.clientY-rect.top)/s}; }

  /* brush round-cursor preview */
  attachBrushCursor(container){
    const cursor=document.createElement('div'); cursor.className='brush-cursor'; cursor.style.display='none';
    container.appendChild(cursor);
    this.canvas.addEventListener('pointermove', e=>{
      if(this.tool!=='BRUSH' && this.tool!=='ERASER'){ cursor.style.display='none'; return; }
      const rect=this.canvas.getBoundingClientRect(); const contRect=container.getBoundingClientRect();
      const s=rect.width/this.docW;
      cursor.style.display='block';
      cursor.style.width=(this.brushSize*s)+"px"; cursor.style.height=(this.brushSize*s)+"px";
      cursor.style.left=(e.clientX-contRect.left)+"px"; cursor.style.top=(e.clientY-contRect.top)+"px";
      cursor.style.borderRadius = this.brushSmooth ? '50%' : '0';
    });
    this.canvas.addEventListener('pointerleave', ()=>{ cursor.style.display='none'; });
  }
}
