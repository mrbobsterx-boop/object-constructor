/* ============================================================
   MODULE 05 — СКАН ИСТОЧНИКА И ПЕРЕНОС (подтверждение)
   ============================================================ */

let moveLog=[];

const AR_GITHUB_SOURCE_PATH='assets/sprites', AR_GITHUB_DEST_PATH='assets/refs';
async function scanSource(){
  if(!sourceDirHandle&&!sourceIsGithub()) return;
  let names;
  if(sourceIsGithub()){
    const r=await listFilesRecursiveGithub(AR_GITHUB_SOURCE_PATH,SPRITE_EXT);
    names=r.files.filter(f=>f.indexOf('/')===-1); // источник плоский, как и папочный режим (listTopLevelFiles)
  }else{
    names=await listTopLevelFiles(sourceDirHandle);
  }
  families=buildFamilies(names);
  const keep=new Set(names);
  for(const [name,url] of fileUrls){ if(!keep.has(name)){ URL.revokeObjectURL(url); fileUrls.delete(name); } }
  for(const name of names){
    if(!fileUrls.has(name)){
      try{
        const url=sourceIsGithub()
          ? await readBinaryObjectUrlFromGithub(AR_GITHUB_SOURCE_PATH+'/'+name)
          : URL.createObjectURL(await (await sourceDirHandle.getFileHandle(name)).getFile());
        if(url) fileUrls.set(name,url);
      }catch(e){ /* пропускаем нечитаемый файл */ }
    }
  }
  setSourceStatus(`Источник: ${sourceIsGithub()?'GitHub ('+AR_GITHUB_SOURCE_PATH+')':sourceDirHandle.name} · файлов: ${names.length}, групп: ${families.length}`);
  if(activeFamilyKey&&!findFamily(activeFamilyKey)){ activeFamilyKey=null; selection=new Set(); pending=new Map(); }
  render();
}

function logMoves(results){
  moveLog=[...results.map(r=>({...r,at:new Date()})),...moveLog].slice(0,300);
  renderRight();
}

async function confirmMove(){
  if(!activeFamilyKey) return;
  const srcOk=sourceDirHandle||sourceIsGithub(), destOk=destDirHandle||destIsGithub();
  if(!srcOk||!destOk){ alert('Подключи и источник, и назначение (папку или GitHub).'); return; }
  const fam=findFamily(activeFamilyKey);
  if(!fam) return;
  const existing=new Set();
  if(destIsGithub()){
    try{ const r=await listFilesRecursiveGithub(AR_GITHUB_DEST_PATH,SPRITE_EXT); r.files.forEach(f=>{ if(f.indexOf('/')===-1) existing.add(f.toLowerCase()); }); }
    catch(e){ alert('Не удалось прочитать GitHub-назначение: '+e.message); return; }
  }else{
    try{ for await(const [name,h] of destDirHandle.entries()){ if(h.kind==='file') existing.add(name.toLowerCase()); } }
    catch(e){ alert('Не удалось прочитать папку назначения: '+e.message); return; }
  }
  const results=[];
  for(const file of fam.files){
    const p=pending.get(file.fileName);
    if(!p||!p.states.size) continue;
    try{
      let blob;
      if(sourceIsGithub()){
        const raw=await ghReadFileRaw(AR_GITHUB_SOURCE_PATH+'/'+file.fileName);
        if(!raw) throw new Error('файл не найден на GitHub');
        blob=new Blob([raw.bytes]);
      }else{
        const srcHandle=await sourceDirHandle.getFileHandle(file.fileName);
        blob=await srcHandle.getFile();
      }
      // Один снимок может быть отмечен сразу несколькими состояниями (айдл + иконка, и т.п.) —
      // тогда из него получается несколько итоговых файлов, все — копии одних и тех же байтов.
      for(const wantedName of computeFinalNames(p,file.ext)){
        let finalName=wantedName;
        if(existing.has(finalName.toLowerCase())){
          const dot=finalName.lastIndexOf('.'); const stem=finalName.slice(0,dot); const fext=finalName.slice(dot+1);
          let n=2;
          while(existing.has(`${stem}_${n}.${fext}`.toLowerCase())) n++;
          finalName=`${stem}_${n}.${fext}`;
        }
        existing.add(finalName.toLowerCase());
        if(destIsGithub()){
          await writeFileToGithub(AR_GITHUB_DEST_PATH+'/'+finalName,new Uint8Array(await blob.arrayBuffer()),'Asset Renamer: '+AR_GITHUB_DEST_PATH+'/'+finalName);
        }else{
          const destHandle=await destDirHandle.getFileHandle(finalName,{create:true});
          const w=await destHandle.createWritable(); await w.write(blob); await w.close();
        }
        results.push({from:file.fileName,to:finalName,ok:true});
      }
      if(sourceIsGithub()) await deleteFileFromGithub(AR_GITHUB_SOURCE_PATH+'/'+file.fileName,'Asset Renamer: remove '+AR_GITHUB_SOURCE_PATH+'/'+file.fileName);
      else await sourceDirHandle.removeEntry(file.fileName);
    }catch(e){ results.push({from:file.fileName,to:null,ok:false,error:e.message}); }
  }
  logMoves(results);
  activeFamilyKey=null; selection=new Set(); pending=new Map(); brush='idle'; resetHistory();
  await scanSource();
}
