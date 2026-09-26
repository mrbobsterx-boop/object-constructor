/* ============================================================
   MODULE 05 — СКАН ИСТОЧНИКА И ПЕРЕНОС (подтверждение)
   ============================================================ */

let moveLog=[];

async function scanSource(){
  if(!sourceDirHandle) return;
  const names=await listTopLevelFiles(sourceDirHandle);
  families=buildFamilies(names);
  const keep=new Set(names);
  for(const [name,url] of fileUrls){ if(!keep.has(name)){ URL.revokeObjectURL(url); fileUrls.delete(name); } }
  for(const name of names){
    if(!fileUrls.has(name)){
      try{ const f=await (await sourceDirHandle.getFileHandle(name)).getFile(); fileUrls.set(name,URL.createObjectURL(f)); }
      catch(e){ /* пропускаем нечитаемый файл */ }
    }
  }
  setSourceStatus(`Источник: ${sourceDirHandle.name} · файлов: ${names.length}, групп: ${families.length}`);
  if(activeFamilyKey&&!findFamily(activeFamilyKey)){ activeFamilyKey=null; selection=new Set(); pending=new Map(); }
  render();
}

function logMoves(results){
  moveLog=[...results.map(r=>({...r,at:new Date()})),...moveLog].slice(0,300);
  renderRight();
}

async function confirmMove(){
  if(!activeFamilyKey) return;
  if(!sourceDirHandle||!destDirHandle){ alert('Подключи и папку-источник, и папку назначения.'); return; }
  const fam=findFamily(activeFamilyKey);
  if(!fam) return;
  const existing=new Set();
  try{ for await(const [name,h] of destDirHandle.entries()){ if(h.kind==='file') existing.add(name.toLowerCase()); } }
  catch(e){ alert('Не удалось прочитать папку назначения: '+e.message); return; }
  const results=[];
  for(const file of fam.files){
    const p=pending.get(file.fileName);
    if(!p||!p.states.size) continue;
    try{
      const srcHandle=await sourceDirHandle.getFileHandle(file.fileName);
      const blob=await srcHandle.getFile();
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
        const destHandle=await destDirHandle.getFileHandle(finalName,{create:true});
        const w=await destHandle.createWritable(); await w.write(blob); await w.close();
        results.push({from:file.fileName,to:finalName,ok:true});
      }
      await sourceDirHandle.removeEntry(file.fileName);
    }catch(e){ results.push({from:file.fileName,to:null,ok:false,error:e.message}); }
  }
  logMoves(results);
  activeFamilyKey=null; selection=new Set(); pending=new Map(); brush='idle'; resetHistory();
  await scanSource();
}
