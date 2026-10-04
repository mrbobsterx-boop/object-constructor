/* ============================================================
   MODULE 04 — ОТРИСОВКА (список фото / редактор / журнал)
   ============================================================ */
function render(){ renderLeft(); renderCenter(); renderRight(); }

function renderLeft(){
  const root=document.getElementById('sourceList');
  const grouped=computeGroupedEntries(allFiles,fileMatch,searchQuery);
  if(!grouped.length){ root.innerHTML=allFiles.length?'<div class="hint">Ничего не найдено.</div>':'<div class="hint">Подключи папку проекта или GitHub вверху — здесь появятся все фото из assets/refs/.</div>'; return; }
  let html='';
  for(const {groupName,paths} of grouped){
    html+=`<div class="razdel-band">${esc(groupName)} (${paths.length})</div>`;
    for(const p of paths){
      const id=fileMatch[p];
      const item=id?planItemById(id):null;
      const active=p===selectedPath;
      const reviewed=isReviewed(p);
      const title=item?item.n:p.split('/').pop();
      const sub=item?humanizeSuffix(variationSuffix(p,id)):'⚠ нет JSON';
      html+=`<div class="file-row${active?' active':''}${reviewed?' reviewed':''}" data-path="${esc(p)}">
        <span class="thumb"><span class="thumb-empty">…</span></span>
        <span class="n"><span class="t">${esc(title)}</span><span class="sub">${esc(sub)}</span></span>
      </div>`;
    }
  }
  root.innerHTML=html;
  const total=allFiles.length, matched=allFiles.filter(p=>fileMatch[p]).length;
  const cov=document.getElementById('coverageLabel');
  if(cov) cov.textContent=total?`${total} фото · ${matched} с JSON · ${total-matched} без JSON`:'';
  const allPaths=grouped.flatMap(g=>g.paths);
  const rowEls=root.querySelectorAll('.file-row');
  rowEls.forEach((el,i)=>el.addEventListener('click',()=>selectPath(allPaths[i])));
  ghMapLimit(allPaths,8,async(p,i)=>{
    const url=await getFileUrl(p);
    const row=rowEls[i];
    if(!row||!row.isConnected||row.dataset.path!==p) return;
    const t=row.querySelector('.thumb');
    if(t) t.innerHTML=url?`<img src="${url}">`:'<span class="thumb-empty">∅</span>';
  });
}

// ID редактируется ВСЕГДА — не только у непривязанных фото. Автоматическое сопоставление по
// префиксу имени файла может совпасть случайно/ошибочно (файл реально не про то, что в его
// имени) — тогда нужно явно указать правильный id, а не только поправить суффикс внутри
// неправильного. См. скриншот: block_ore_iron_bednaya_5.png на самом деле деревянный указатель.
async function renderCenter(){
  const root=document.getElementById('editPanel');
  if(!selectedPath){ root.innerHTML='<div class="hint">Выбери фото слева, чтобы начать редактирование.</div>'; return; }
  const path=selectedPath, detectedId=fileMatch[path];
  const url=await getFileUrl(path);
  if(selectedPath!==path) return; // успели выбрать другое, пока грузилась картинка
  const suffix=detectedId?variationSuffix(path,detectedId):'';
  root.innerHTML=`
    <div class="group"><div class="preview-row" style="align-items:flex-start">
      <img src="${esc(url||'')}" style="width:96px;height:96px">
      <div class="preview-names"><div>${esc(path)}</div></div>
    </div></div>
    <div class="group" style="display:flex;align-items:center;gap:10px">
      <button id="btnMarkOk">✓ Всё ОК <span class="kbd">Enter</span></button>
      <span class="hint muted" id="okHint">${isReviewed(path)?'Уже отмечено как просмотренное ✓':'Если здесь всё правильно и менять ничего не нужно.'}</span>
    </div>
    <div class="group">
      <h3>ID объекта <span class="kbd">1</span> <span class="muted small">(если он здесь неправильный — поправь, это переименует файл)</span></h3>
      <div class="row"><input type="text" id="fTargetId" list="idList" value="${esc(detectedId||'')}" placeholder="id объекта, напр. tank_water" style="flex:1"></div>
      <datalist id="idList">${planAllItems().map(i=>`<option value="${esc(i.id)}">${esc(i.n)}</option>`).join('')}</datalist>
      <div class="hint" id="idMatchHint"></div>
    </div>
    <div class="group">
      <h3>Название ЭТОГО фото <span class="kbd">3</span> <span class="muted small">(остальные фото этого id не трогает)</span></h3>
      <div class="row"><input type="text" id="fVarName" value="${esc(humanizeSuffix(suffix)==='основная'?'':humanizeSuffix(suffix))}" placeholder="основная (без суффикса)" style="flex:1"></div>
      <button id="btnRenamePhoto" class="primary">Сохранить (переименовать файл)</button>
      <div class="hint" id="renameStatus">Можно по-русски — сохранится в имени файла английским словом. Или <span class="kbd">Ctrl+Enter</span> — сохранить всё сразу и перейти дальше.</div>
    </div>
    <div class="group" id="objNameGroup"></div>
  `;
  document.getElementById('btnMarkOk').onclick=markOkAndAdvance;

  const idInput=document.getElementById('fTargetId');
  async function refreshObjNameGroup(){
    const curId=idInput.value.trim();
    const item=curId?planItemById(curId):null;
    const hintEl=document.getElementById('idMatchHint');
    const group=document.getElementById('objNameGroup');
    if(!curId){ hintEl.textContent=''; group.innerHTML=''; return; }
    if(!item){ hintEl.textContent='⚠ такого id нет в каталоге — выбери из списка.'; hintEl.className='hint save-status err'; group.innerHTML=''; return; }
    hintEl.textContent=item.n+' · '+(CATEGORY_NAME_BY_ID[item.c]||item.c);
    hintEl.className='hint';
    const json=await getObjectJson(curId);
    if(idInput.value.trim()!==curId) return; // id успели поменять, пока грузился JSON
    const currentName=(json&&json.name)||item.n;
    group.innerHTML=`
      <h3>Название объекта <span class="kbd">2</span> <span class="muted small">(общее для всех фото этого id)</span></h3>
      <div class="row"><input type="text" id="fObjName" value="${esc(currentName)}" style="flex:1"><button id="btnSaveObjName" class="primary">Сохранить имя</button></div>
      <div class="hint" id="objNameStatus">${json?'id не меняется — только отображаемое имя. Затронет все фото этого id.':'⚠ data/objects/'+esc(curId)+'.json не найден.'}</div>
    `;
    document.getElementById('btnSaveObjName').onclick=async()=>{
      const statusEl=document.getElementById('objNameStatus');
      const name=document.getElementById('fObjName').value.trim();
      if(!name){ statusEl.textContent='Имя не может быть пустым.'; statusEl.className='save-status err'; return; }
      statusEl.textContent='Сохранение…'; statusEl.className='hint';
      const res=await saveObjectName(curId,name);
      statusEl.textContent=res.ok?'Сохранено ✓':'Ошибка: '+res.error;
      statusEl.className=res.ok?'save-status ok':'save-status err';
      if(res.ok) renderLeft();
    };
  }
  idInput.addEventListener('change',refreshObjNameGroup);
  await refreshObjNameGroup();

  document.getElementById('btnRenamePhoto').onclick=async()=>{
    const statusEl=document.getElementById('renameStatus');
    const newId=idInput.value.trim();
    if(!newId){ statusEl.textContent='Укажи id объекта.'; statusEl.className='save-status err'; return; }
    if(!planItemById(newId)){ statusEl.textContent='Такого id нет в каталоге — выбери из списка.'; statusEl.className='save-status err'; return; }
    const raw=document.getElementById('fVarName').value.trim();
    const slug=raw?sanitizeSlug(translit(raw)):'';
    statusEl.textContent='Сохранение…'; statusEl.className='hint';
    const res=await reassignPhoto(path,newId,slug);
    if(res.ok){ renderLeft(); renderCenter(); }
    else { statusEl.textContent='Ошибка: '+res.error; statusEl.className='save-status err'; }
  };
}

function renderRight(){
  const el=document.getElementById('destLog');
  el.innerHTML=eventLog.length?eventLog.map(r=>`<div class="log-item ${r.ok?'ok':'err'}">${r.ok?`${esc(r.from)} → ${esc(r.to)}`:`${esc(r.from)} — ошибка: ${esc(r.error||'')}`}</div>`).join(''):'<div class="hint">Здесь появится список переименований и изменений имени объекта.</div>';
}
