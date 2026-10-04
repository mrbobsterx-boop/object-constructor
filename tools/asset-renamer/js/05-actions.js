/* ============================================================
   MODULE 05 — ПЕРЕИМЕНОВАНИЕ ФАЙЛА + ПРАВКА ИМЕНИ ОБЪЕКТА
   ============================================================ */

// Переименовывает ОДИН файл внутри assets/refs/ (та же папка-категория, меняется только базовое
// имя). newStem — полное новое имя без расширения (id или id_суффикс).
async function doRename(oldPath,newStem){
  const dot=oldPath.lastIndexOf('.'); const ext=dot>=0?oldPath.slice(dot+1):'png';
  const lastSlash=oldPath.lastIndexOf('/');
  const dir=lastSlash>=0?oldPath.slice(0,lastSlash+1):'';
  const newPath=dir+newStem+'.'+ext;
  if(newPath===oldPath) return {ok:true,path:oldPath,unchanged:true};
  if(allFiles.includes(newPath)) return {ok:false,error:'Файл с таким именем уже есть: '+newPath};
  const file=await readProjectFileBlob('assets/refs/'+oldPath);
  if(!file) return {ok:false,error:'Не удалось прочитать файл для переименования.'};
  const bytes=new Uint8Array(await file.arrayBuffer());
  const wrote=await writeFileToProject('assets/refs/'+newPath,bytes);
  if(!wrote) return {ok:false,error:'Не удалось сохранить (не подключены ни папка, ни GitHub).'};
  await deleteProjectFile('assets/refs/'+oldPath);
  const idx=allFiles.indexOf(oldPath);
  if(idx>=0) allFiles[idx]=newPath; else allFiles.push(newPath);
  allFiles.sort();
  delete fileUrlCache[oldPath];
  const idsDesc=PLAN_ITEMS.map(i=>i.id).sort((a,b)=>b.length-a.length);
  const match=idsDesc.find(id=>newStem===id||newStem.startsWith(id+'_'))||null;
  delete fileMatch[oldPath];
  fileMatch[newPath]=match;
  if(selectedPath===oldPath) selectedPath=newPath;
  logEvent({from:oldPath,to:newPath,ok:true});
  return {ok:true,path:newPath};
}
// Фото УЖЕ привязано к id — меняем только суффикс-вариацию, id-префикс остаётся как есть.
async function renameMatchedPhoto(oldPath,newSuffixSlug){
  const id=fileMatch[oldPath];
  if(!id) return {ok:false,error:'У этого фото нет id.'};
  return doRename(oldPath,newSuffixSlug?id+'_'+newSuffixSlug:id);
}
// Фото НЕ привязано — присваиваем id вручную (плюс необязательную вариацию), чтобы оно начало
// матчиться как обычное фото объекта (JSON при этом не создаём — см. Калибровщик размеров).
async function renameUnmatchedPhoto(oldPath,newId,newSuffixSlug){
  if(!newId) return {ok:false,error:'Укажи id объекта.'};
  return doRename(oldPath,newSuffixSlug?newId+'_'+newSuffixSlug:newId);
}
// Правит ОБЩЕЕ имя объекта (data/objects/<id>.json → name) — читает актуальный файл целиком,
// меняет только name, пишет обратно, остальные поля не трогает.
async function saveObjectName(id,newName){
  const json=await getObjectJson(id);
  if(!json) return {ok:false,error:'Не удалось прочитать data/objects/'+id+'.json'};
  json.name=newName;
  const bytes=new TextEncoder().encode(JSON.stringify(json,null,2)+'\n');
  const wrote=await writeFileToProject('data/objects/'+id+'.json',bytes);
  if(!wrote) return {ok:false,error:'Не удалось сохранить JSON (не подключены ни папка, ни GitHub).'};
  jsonCache[id]=json;
  logEvent({from:'data/objects/'+id+'.json',to:'name → '+newName,ok:true});
  return {ok:true};
}
