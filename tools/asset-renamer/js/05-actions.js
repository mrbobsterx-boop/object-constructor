/* ============================================================
   MODULE 05 — СКАН ИСТОЧНИКА И ПЕРЕНОС (подтверждение)
   ============================================================ */

let moveLog=[];

const AR_GITHUB_SOURCE_PATH='assets/sprites', AR_GITHUB_DEST_PATH='assets/refs';
// assets/refs/ растёт сотнями файлов в одну плоскую папку — GitHub обрезает список на странице
// после 1000. Раскладываем по категории ОС (как и assets/sprites/<категория>/…), категорию берём
// из каталога Object Plan по id = раздел_объект; когда объекта ещё нет в каталоге (новый, не
// заведённый тип) — файл остаётся в плоском корне assets/refs/, как и раньше.
function categoryForPending(p){
  const idGuess=[slug(p.razdel),slug(p.obj)].filter(Boolean).join('_');
  if(!idGuess) return null;
  const item=(typeof PLAN_ITEMS!=='undefined'?PLAN_ITEMS:[]).find(i=>i.id===idGuess);
  return item?item.c:null;
}
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
  // Коллизии имён теперь проверяются отдельно в каждой подпапке-категории (destPath ниже), а не
  // одним плоским списком на весь assets/refs/ — набор для каждой нужной подпапки подгружаем
  // по требованию и кэшируем на время этого вызова.
  const existingByDir=new Map();
  async function existingSetFor(destDir){
    if(existingByDir.has(destDir)) return existingByDir.get(destDir);
    const set=new Set();
    if(destIsGithub()){
      try{ const r=await listFilesRecursiveGithub(destDir,SPRITE_EXT); r.files.forEach(f=>{ if(f.indexOf('/')===-1) set.add(f.toLowerCase()); }); }
      catch(e){ alert('Не удалось прочитать GitHub-назначение: '+e.message); throw e; }
    }else{
      try{ const dirHandle=await getSubdir(destDirHandle,destDir.replace(/^assets\/refs\/?/,''),true); for await(const [name,h] of dirHandle.entries()){ if(h.kind==='file') set.add(name.toLowerCase()); } }
      catch(e){ alert('Не удалось прочитать папку назначения: '+e.message); throw e; }
    }
    existingByDir.set(destDir,set);
    return set;
  }
  const results=[];
  for(const file of fam.files){
    const p=pending.get(file.fileName);
    if(!p||!p.states.size) continue;
    const category=categoryForPending(p);
    const destDir=category?(AR_GITHUB_DEST_PATH+'/'+category):AR_GITHUB_DEST_PATH;
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
      const existing=await existingSetFor(destDir);
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
          await writeFileToGithub(destDir+'/'+finalName,new Uint8Array(await blob.arrayBuffer()),'Asset Renamer: '+destDir+'/'+finalName);
        }else{
          const dirHandle=await getSubdir(destDirHandle,category||'',true);
          const destHandle=await dirHandle.getFileHandle(finalName,{create:true});
          const w=await destHandle.createWritable(); await w.write(blob); await w.close();
        }
        results.push({from:file.fileName,to:destDir+'/'+finalName,ok:true});
      }
      if(sourceIsGithub()) await deleteFileFromGithub(AR_GITHUB_SOURCE_PATH+'/'+file.fileName,'Asset Renamer: remove '+AR_GITHUB_SOURCE_PATH+'/'+file.fileName);
      else await sourceDirHandle.removeEntry(file.fileName);
    }catch(e){ results.push({from:file.fileName,to:null,ok:false,error:e.message}); }
  }
  logMoves(results);
  activeFamilyKey=null; selection=new Set(); pending=new Map(); brush='idle'; resetHistory();
  await scanSource();
}
