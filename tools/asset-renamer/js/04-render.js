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
      const title=item?item.n:p.split('/').pop();
      const sub=item?humanizeSuffix(variationSuffix(p,id)):'⚠ нет JSON';
      html+=`<div class="file-row${active?' active':''}" data-path="${esc(p)}">
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

async function renderCenter(){
  const root=document.getElementById('editPanel');
  if(!selectedPath){ root.innerHTML='<div class="hint">Выбери фото слева, чтобы начать редактирование.</div>'; return; }
  const path=selectedPath, id=fileMatch[path];
  const url=await getFileUrl(path);
  if(selectedPath!==path) return; // успели выбрать другое, пока грузилась картинка
  let html=`<div class="group"><div class="preview-row" style="align-items:flex-start">
      <img src="${esc(url||'')}" style="width:96px;height:96px">
      <div class="preview-names"><div>${esc(path)}</div></div>
    </div></div>`;

  if(id){
    const item=planItemById(id);
    const json=await getObjectJson(id);
    if(selectedPath!==path) return;
    const currentName=(json&&json.name)||(item?item.n:id);
    const suffix=variationSuffix(path,id);
    html+=`
      <div class="group">
        <h3>Объект</h3>
        <div class="hint">id: <code>${esc(id)}</code> · ${esc((item&&CATEGORY_NAME_BY_ID[item.c])||'')}${json?'':' · ⚠ data/objects/'+esc(id)+'.json не найден'}</div>
      </div>
      <div class="group">
        <h3>Название объекта <span class="muted small">(общее для всех фото этого id)</span></h3>
        <div class="row"><input type="text" id="fObjName" value="${esc(currentName)}" style="flex:1"><button id="btnSaveObjName" class="primary">Сохранить имя</button></div>
        <div class="hint" id="objNameStatus">id не меняется — только отображаемое имя. Затронет все фото этого объекта.</div>
      </div>
      <div class="group">
        <h3>Название ЭТОГО фото <span class="muted small">(id и другие фото не трогает)</span></h3>
        <div class="row"><input type="text" id="fVarName" value="${esc(humanizeSuffix(suffix)==='основная'?'':humanizeSuffix(suffix))}" placeholder="основная (без суффикса)" style="flex:1"><button id="btnRenamePhoto">Переименовать файл</button></div>
        <div class="hint" id="renameStatus">Можно по-русски — сохранится в имени файла английским словом.</div>
      </div>`;
  } else {
    html+=`
      <div class="group">
        <h3>⚠ У этого фото нет JSON</h3>
        <div class="hint">Укажи id существующего объекта — файл начнёт матчиться как его фото (как в Калибровщике размеров). Новый объект/JSON это не создаёт.</div>
        <div class="row"><input type="text" id="fTargetId" list="idList" placeholder="id объекта, напр. tank_water" style="flex:1"></div>
        <datalist id="idList">${PLAN_ITEMS.map(i=>`<option value="${esc(i.id)}">${esc(i.n)}</option>`).join('')}</datalist>
        <div class="row"><input type="text" id="fVarName" placeholder="вариация (необязательно), можно по-русски" style="flex:1"></div>
        <button id="btnAssignId" class="primary">Привязать и переименовать</button>
        <div class="hint" id="renameStatus"></div>
      </div>`;
  }
  root.innerHTML=html;

  if(id){
    document.getElementById('btnSaveObjName').onclick=async()=>{
      const statusEl=document.getElementById('objNameStatus');
      const name=document.getElementById('fObjName').value.trim();
      if(!name){ statusEl.textContent='Имя не может быть пустым.'; statusEl.className='save-status err'; return; }
      statusEl.textContent='Сохранение…'; statusEl.className='hint';
      const res=await saveObjectName(id,name);
      statusEl.textContent=res.ok?'Сохранено ✓':'Ошибка: '+res.error;
      statusEl.className=res.ok?'save-status ok':'save-status err';
      if(res.ok) renderLeft();
    };
    document.getElementById('btnRenamePhoto').onclick=async()=>{
      const statusEl=document.getElementById('renameStatus');
      const raw=document.getElementById('fVarName').value.trim();
      const slug=raw?sanitizeSlug(translit(raw)):'';
      statusEl.textContent='Переименование…'; statusEl.className='hint';
      const res=await renameMatchedPhoto(path,slug);
      if(res.ok){ renderLeft(); renderCenter(); }
      else { statusEl.textContent='Ошибка: '+res.error; statusEl.className='save-status err'; }
    };
  } else {
    document.getElementById('btnAssignId').onclick=async()=>{
      const statusEl=document.getElementById('renameStatus');
      const newId=document.getElementById('fTargetId').value.trim();
      const raw=document.getElementById('fVarName').value.trim();
      const slug=raw?sanitizeSlug(translit(raw)):'';
      statusEl.textContent='Переименование…'; statusEl.className='hint';
      const res=await renameUnmatchedPhoto(path,newId,slug);
      if(res.ok){ renderLeft(); renderCenter(); }
      else { statusEl.textContent='Ошибка: '+res.error; statusEl.className='save-status err'; }
    };
  }
}

function renderRight(){
  const el=document.getElementById('destLog');
  el.innerHTML=eventLog.length?eventLog.map(r=>`<div class="log-item ${r.ok?'ok':'err'}">${r.ok?`${esc(r.from)} → ${esc(r.to)}`:`${esc(r.from)} — ошибка: ${esc(r.error||'')}`}</div>`).join(''):'<div class="hint">Здесь появится список переименований и изменений имени объекта.</div>';
}
