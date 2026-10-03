/* ============================================================
   MODULE 09 — СОХРАНЕНИЕ
   Если слоёв нет — сохраняем весь лист одним файлом (как в исходном инструменте). Если слои есть —
   каждый сохраняется отдельным PNG в assets/refs/ под своим именем (существующие файлы не трогаем,
   добавляется номер). Без подключённой папки — обычное скачивание файла браузером.
   ============================================================ */

async function saveBlob(blob,base,category){
  // Категория объекта (ОС: item/furniture/tool/…) кладёт файл в assets/refs/<категория>/ —
  // без неё (лист без слоёв, свободный текст в baseName) идёт в плоский корень assets/refs/.
  const destDir=category?('assets/refs/'+category):'assets/refs';
  if(projectDirHandle||ghIsConnected()){
    let name='';
    if(projectDirHandle){
      if(projectDirHandle.queryPermission){
        const p=await projectDirHandle.queryPermission({mode:'readwrite'});
        if(p!=='granted') await regrantFolder();
      }
      const dir=await getSubdir(projectDirHandle,destDir,true);
      name=await nextAvailableName(dir,base);
      const fh=await dir.getFileHandle(name,{create:true});
      const w=await fh.createWritable(); await w.write(blob); await w.close();
    }
    if(ghIsConnected()){
      const ghName=name||await nextAvailableNameGithub(destDir,base);
      await writeFileToGithub(destDir+'/'+ghName,new Uint8Array(await blob.arrayBuffer()),'Image Prep Tool: '+destDir+'/'+ghName);
      name=name||ghName;
    }
    return destDir+'/'+name;
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
      // IPT-4: убираем слой из списка/targets СРАЗУ после того как он реально записан на диск, а не
      // все разом в конце — если сохранение прервётся на середине (ошибка диска/прав/отмена разрешения),
      // уже записанные слои не останутся в списке и не запишутся повторно (с суффиксом _2) при
      // повторном нажатии «Сохранить всё».
      for(const layer of layers.slice()){
        // Переключаем холст для экспорта, но не применяем текущий выбор из панели
        // именования: у каждого слоя должно остаться уже назначенное ему имя.
        setActiveTarget(layer.id,{skipNameSync:true});
        if(autoTrim){ pushHistory(); trimCanvas(0); }
        const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
        await saveBlob(blob, layer.name||layer.id, layer.category);
        savedCount++;
        const idx=layers.findIndex(l=>l.id===layer.id); if(idx>=0) layers.splice(idx,1);
        removeTarget(layer.id);
      }
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
