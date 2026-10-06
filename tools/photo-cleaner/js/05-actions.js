/* ============================================================
   MODULE 05 — ПЕРЕМЕЩЕНИЕ МЕЖДУ КОЛОНКАМИ + ФИНАЛЬНОЕ УДАЛЕНИЕ
   ============================================================ */

// active -> staged (Backspace в колонке 1). Выбор сам переходит на СЛЕДУЮЩЕЕ фото в колонке 1 —
// индекс считаем ДО удаления, чтобы "продолжить дальше со следующей", как попросили.
function moveToStaged(path){
  const idx=colActive.indexOf(path);
  if(idx===-1) return;
  colActive.splice(idx,1);
  colStaged.push(path);
  if(activeColumn==='active') selectedPath=colActive.length?colActive[Math.min(idx,colActive.length-1)]:null;
  render();
}
// staged -> active, В КОНЕЦ списка (Enter в колонке 2) — "вернётся в низ списка первого".
function restoreToActive(path){
  const idx=colStaged.indexOf(path);
  if(idx===-1) return;
  colStaged.splice(idx,1);
  colActive.push(path);
  if(activeColumn==='staged') selectedPath=colStaged.length?colStaged[Math.min(idx,colStaged.length-1)]:null;
  render();
}
// staged -> pending (Backspace в колонке 2) — последний шаг перед реальным удалением.
function moveToPending(path){
  const idx=colStaged.indexOf(path);
  if(idx===-1) return;
  colStaged.splice(idx,1);
  colPending.push(path);
  if(activeColumn==='staged') selectedPath=colStaged.length?colStaged[Math.min(idx,colStaged.length-1)]:null;
  render();
}

// Тот же выбор "официального" фото, что generate_objects.js делает для appearance.asset: не
// _broken/_icon предпочтительнее, и парный _broken для него (если есть) — см. pickVariationFiles
// в scratchpad/generate_objects.js. Нужен здесь, чтобы переподставить спрайт, когда часть фото
// объекта удаляют, а часть остаётся.
function pickIdleBroken(paths){
  if(!paths.length) return null;
  const idleCandidates=paths.filter(p=>!/_(broken|icon)(_\d+)?\.png$/i.test(p));
  const idle=idleCandidates[0]||paths[0];
  const stem=idle.replace(/(_idle)?(_\d+)?\.png$/i,'');
  const broken=paths.find(p=>p.replace(/_broken(_\d+)?\.png$/i,'')===stem && /_broken(_\d+)?\.png$/i.test(p))||null;
  return {idle,broken};
}
async function getNaturalDimsFromBlob(blob){
  if(!blob) return null;
  const url=URL.createObjectURL(blob);
  const dims=await new Promise(res=>{ const im=new Image(); im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight}); im.onerror=()=>res(null); im.src=url; });
  URL.revokeObjectURL(url);
  return dims;
}

// Финальное удаление всего, что в колонке 3 — ОДИН батч-коммит в GitHub (ghBatchCommit) плюс
// зеркально в папку проекта файл-за-файлом (там коммитов нет, лимита Vercel это не касается).
// Для каждого затронутого id: если после удаления у него НЕ остаётся ни одного фото в assets/refs —
// удаляем и сам data/objects/<id>.json, и его спрайты в assets/sprites/ (иначе осиротевший файл).
// Если фото остаются — JSON НЕ трогаем как объект, но переподставляем официальный спрайт на одно из
// оставшихся фото (иначе appearance.asset продолжит указывать на уже несуществующий путь).
async function commitPendingDeletes(){
  if(!colPending.length) return;
  if(!confirm(`Удалить навсегда ${colPending.length} фото из GitHub/папки проекта? Это нельзя отменить.`)) return;

  const btn=document.getElementById('btnCommitDelete');
  const statusEl=document.getElementById('pendingStatus');
  btn.disabled=true; statusEl.textContent='Сохранение…'; statusEl.className='hint';

  try{
    const batch=[]; // {path, content:Uint8Array|string|null}
    const deletingSet=new Set(colPending);

    // Фото без id — просто удаляем сам файл.
    colPending.forEach(p=>{ if(!fileMatch[p]) batch.push({path:'assets/refs/'+p,content:null}); });

    // Фото С id — группируем, чтобы на каждый id посчитать remaining один раз.
    const idsTouched=[...new Set(colPending.map(p=>fileMatch[p]).filter(Boolean))];
    for(const id of idsTouched){
      const deletedForId=colPending.filter(p=>fileMatch[p]===id);
      deletedForId.forEach(p=>batch.push({path:'assets/refs/'+p,content:null}));

      const remaining=allPaths.filter(p=>fileMatch[p]===id && !deletingSet.has(p));
      const jsonPath='data/objects/'+id+'.json';
      const r=await readSingleJson(jsonPath);
      const json=r&&r.data;

      if(!remaining.length){
        // Последнее фото этого id ушло — удаляем и JSON, и его спрайты (чтобы не висели осиротевшими).
        batch.push({path:jsonPath,content:null});
        if(json&&json.appearance&&json.appearance.asset) batch.push({path:'assets/sprites/'+json.appearance.asset,content:null});
        if(json&&json.destruction&&json.destruction.broken&&json.destruction.broken.image) batch.push({path:'assets/sprites/'+json.destruction.broken.image,content:null});
        continue;
      }
      if(!json||!json.appearance||!json.appearance.asset) continue; // нечего переподставлять — JSON и так не ссылался на спрайт

      const picked=pickIdleBroken(remaining);
      if(!picked) continue;
      const idleBlob=await readProjectFileBlob('assets/refs/'+picked.idle);
      if(!idleBlob) continue;
      const idleBytes=new Uint8Array(await idleBlob.arrayBuffer());
      const idleDims=await getNaturalDimsFromBlob(idleBlob);
      batch.push({path:'assets/sprites/'+json.appearance.asset,content:idleBytes});
      json.appearance.imageWidth=idleDims?idleDims.w:json.appearance.imageWidth;
      json.appearance.imageHeight=idleDims?idleDims.h:json.appearance.imageHeight;

      const oldBrokenImg=json.destruction&&json.destruction.broken&&json.destruction.broken.image;
      if(picked.broken){
        const brokenBlob=await readProjectFileBlob('assets/refs/'+picked.broken);
        if(brokenBlob){
          const brokenBytes=new Uint8Array(await brokenBlob.arrayBuffer());
          const brokenDims=await getNaturalDimsFromBlob(brokenBlob);
          const brokenImgPath=oldBrokenImg||(json.appearance.asset.replace(/\.png$/i,'')+'_broken.png');
          batch.push({path:'assets/sprites/'+brokenImgPath,content:brokenBytes});
          json.destruction=json.destruction||{};
          json.destruction.broken={nativeWidth:brokenDims?brokenDims.w:0,nativeHeight:brokenDims?brokenDims.h:0,image:brokenImgPath};
        }
      } else if(oldBrokenImg){
        batch.push({path:'assets/sprites/'+oldBrokenImg,content:null});
        json.destruction.broken=null;
      }
      batch.push({path:jsonPath,content:JSON.stringify(json,null,2)+'\n'});
    }

    // Пишем: папка проекта — по одному файлу (как везде), GitHub — ОДНИМ коммитом.
    if(projectDirHandle){
      for(const c of batch){
        if(c.content===null) await deleteProjectFileLocal(c.path);
        else await writeFileToProjectLocal(c.path,c.content);
      }
    }
    if(ghIsConnected()){
      await ghBatchCommit(batch,`Photo Cleaner: удалить ${colPending.length} фото`);
    }

    // Обновляем состояние в памяти.
    allPaths=allPaths.filter(p=>!deletingSet.has(p));
    colPending.forEach(p=>{ delete fileMatch[p]; delete imageUrlCache[p]; });
    colPending=[];
    selectedPath = activeColumn==='pending' ? null : selectedPath;
    statusEl.textContent='Сохранено ✓'; statusEl.className='hint save-status ok';
    render();
  }catch(e){
    statusEl.textContent='Ошибка: '+e.message; statusEl.className='hint save-status err';
  }finally{
    btn.disabled=colPending.length===0;
  }
}
document.getElementById('btnCommitDelete').onclick=commitPendingDeletes;
