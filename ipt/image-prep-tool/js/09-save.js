/* ============================================================
   MODULE 09 — СОХРАНЕНИЕ
   Если слоёв нет — сохраняем весь лист одним файлом (как в исходном инструменте). Если слои есть —
   каждый сохраняется отдельным PNG в assets/refs/ под своим именем (существующие файлы не трогаем,
   добавляется номер). Без подключённой папки — обычное скачивание файла браузером.
   ============================================================ */

async function saveBlob(blob,base){
  if(projectDirHandle){
    if(projectDirHandle.queryPermission){
      const p=await projectDirHandle.queryPermission({mode:'readwrite'});
      if(p!=='granted') await regrantFolder();
    }
    const dir=await getSubdir(projectDirHandle,'assets/refs',true);
    const name=await nextAvailableName(dir,base);
    const fh=await dir.getFileHandle(name,{create:true});
    const w=await fh.createWritable(); await w.write(blob); await w.close();
    return name;
  }
  downloadCanvasPng(blob, base+'.png');
  return base+'.png (скачан)';
}

async function saveAll(){
  const btn=document.getElementById('btnSave'), status=document.getElementById('saveStatus');
  if(!activeQueueId){ alert('Сначала открой картинку.'); return; }
  commitActiveToTarget();
  const autoTrim=document.getElementById('autoTrimOnSave').checked;
  btn.disabled=true; btn.textContent='Сохраняю…';
  try{
    if(layers.length===0){
      const baseName=sanitizeSlug(document.getElementById('baseName').value)||'object';
      setActiveTarget('sheet');
      if(autoTrim){ pushHistory(); trimCanvas(0); }
      const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
      const saved=await saveBlob(blob,baseName);
      status.textContent='Сохранено как один файл: '+saved+' · '+new Date().toLocaleTimeString();
    } else {
      const unnamed=layers.filter(l=>!l.name);
      if(unnamed.length && !confirm(unnamed.length+' слой(ев) без имени сохранятся как layer_N — так их не найдёт Object Plan. Продолжить?')){ return; }
      let savedCount=0;
      for(const layer of layers.slice()){
        // Переключаем холст для экспорта, но не применяем текущий выбор из панели
        // именования: у каждого слоя должно остаться уже назначенное ему имя.
        setActiveTarget(layer.id,{skipNameSync:true});
        if(autoTrim){ pushHistory(); trimCanvas(0); }
        const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
        await saveBlob(blob, layer.name||layer.id);
        savedCount++;
      }
      layers.forEach(l=>removeTarget(l.id));
      layers=[];
      activeTargetKey=null; setActiveTarget('sheet');
      status.textContent='Сохранено слоёв: '+savedCount+' · '+new Date().toLocaleTimeString();
    }
    const q=queue.find(x=>x.id===activeQueueId); if(q) q.done=true;
    renderQueue();
    if(document.getElementById('autoNext').checked){
      const nxt=nextUndoneQueue(activeQueueId);
      if(nxt) loadQueueItem(nxt.id);
    }
  }catch(e){ console.error(e); alert('Не удалось сохранить: '+e.message); }
  finally{ btn.disabled=false; btn.textContent='💾 Сохранить всё'; }
}
document.getElementById('btnSave').onclick=saveAll;
