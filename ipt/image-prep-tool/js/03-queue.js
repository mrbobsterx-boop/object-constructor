/* ============================================================
   MODULE 03 — ОЧЕРЕДЬ КАРТИНОК
   Каждая картинка в очереди — «лист», который может содержать несколько объектов (см. 05-layers.js).
   ============================================================ */

let queue=[];      // {id, name, url, done}
let activeQueueId=null;
let qCounter=0;

function addFilesToQueue(files){
  const arr=[...files].filter(f=>f.type.startsWith('image/'));
  arr.forEach(f=>{
    const id='q'+(++qCounter);
    const url=URL.createObjectURL(f);
    queue.push({id,name:f.name.replace(/\.[a-z0-9]+$/i,''),url,done:false});
  });
  renderQueue();
  if(!activeQueueId && queue.length) loadQueueItem(queue[0].id);
}
function renderQueue(){
  const el=document.getElementById('queueList');
  document.getElementById('queueCount').textContent=queue.length;
  document.getElementById('queueHint').style.display=queue.length?'none':'';
  el.innerHTML='';
  queue.forEach(q=>{
    const d=document.createElement('div');
    d.className='queue-item'+(q.id===activeQueueId?' active':'')+(q.done?' done':'');
    d.innerHTML=`<img src="${q.url}"><span class="nm">${esc(q.name)}</span>${q.done?'<span class="ck">✓</span>':''}`;
    d.onclick=()=>loadQueueItem(q.id);
    el.appendChild(d);
  });
}
function nextUndoneQueue(afterId){
  const i=queue.findIndex(q=>q.id===afterId);
  for(let k=i+1;k<queue.length;k++) if(!queue[k].done) return queue[k];
  for(let k=0;k<queue.length;k++) if(!queue[k].done) return queue[k];
  return null;
}
function loadQueueItem(id){
  const q=queue.find(x=>x.id===id); if(!q) return;
  if(layers.length && !confirm('Есть незахваченные/несохранённые слои для текущего листа — переключиться и потерять их?')) return;
  const img=new Image();
  // IPT-3: activeQueueId переключается только после УСПЕШНОЙ загрузки — иначе битый/неподдерживаемый
  // файл (HEIC и т.п.) оставлял activeQueueId на новом элементе, пока на холсте всё ещё был старый
  // лист: «Сохранить всё» писало старую картинку под новым именем и помечало битый элемент готовым.
  img.onerror=()=>{ alert('Не удалось открыть «'+q.name+'» — файл повреждён или формат не поддерживается браузером.'); };
  img.onload=()=>{
    activeQueueId=id; renderQueue();
    // canvasWrap должен стать видимым ДО initSheetFromImage: там считается зум и рисуется линейка
    // по getBoundingClientRect() холста — на скрытом элементе он нулевой ширины.
    document.getElementById('canvasWrap').style.display='';
    document.getElementById('emptyDrop').style.display='none';
    initSheetFromImage(img);
    document.getElementById('baseName').value=sanitizeSlug(q.name)||'object';
    resetPicker();
  };
  img.src=q.url;
}
