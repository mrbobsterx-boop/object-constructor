/* ============================================================
   MODULE 05 — ПЕРЕИМЕНОВАНИЕ ФАЙЛА + ПРАВКА ИМЕНИ ОБЪЕКТА
   ============================================================ */

// Переименовывает/переносит ОДИН файл внутри assets/refs/. newStem — полное новое имя без
// расширения (id или id_суффикс). newDir — папка назначения (категория); если не задана, остаётся
// та же папка, где файл лежал. См. reassignPhoto ниже — он ВСЕГДА передаёт папку нужной категории,
// так что при смене id файл физически переезжает в правильную подпапку, а не просто переименовывается
// на месте (иначе assets/refs/block/ копил бы файлы объектов из других категорий).
async function doRename(oldPath,newStem,newDir){
  const dot=oldPath.lastIndexOf('.'); const ext=dot>=0?oldPath.slice(dot+1):'png';
  const lastSlash=oldPath.lastIndexOf('/');
  const dir=newDir!==undefined?newDir:(lastSlash>=0?oldPath.slice(0,lastSlash+1):'');
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
  const idsDesc=planAllItems().map(i=>i.id).sort((a,b)=>b.length-a.length);
  const match=idsDesc.find(id=>newStem===id||newStem.startsWith(id+'_'))||null;
  delete fileMatch[oldPath];
  fileMatch[newPath]=match;
  if(selectedPath===oldPath) selectedPath=newPath;
  logEvent({from:oldPath,to:newPath,ok:true});
  return {ok:true,path:newPath};
}
// Один и тот же путь для трёх случаев: поправить только вариацию (newId === текущему), привязать
// ранее непривязанное фото (fileMatch[oldPath] был null), и — то, из-за чего это вообще
// понадобилось — переподвесить НЕПРАВИЛЬНО привязанное фото на другой, правильный id (файл
// совпал по префиксу имени случайно, а по содержимому — это другой предмет). newId всегда задаёт
// пользователь явно (из каталога), не берём молча угаданный match.
async function reassignPhoto(oldPath,newId,newSuffixSlug){
  if(!newId) return {ok:false,error:'Укажи id объекта.'};
  const item=planItemById(newId);
  if(!item) return {ok:false,error:'Такого id нет в каталоге.'};
  const newDir=item.c+'/'; // папка-категория целевого id — файл переезжает туда, а не остаётся в старой
  return doRename(oldPath,newSuffixSlug?newId+'_'+newSuffixSlug:newId,newDir);
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
