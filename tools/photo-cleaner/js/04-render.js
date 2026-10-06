/* ============================================================
   MODULE 04 — ОТРИСОВКА (три колонки: карточки крупные, с номером/подписью/картинкой)
   ============================================================ */
function render(){
  renderColumn('colAll','active',colActive,{numbered:true});
  renderColumn('colStaged','staged',colStaged,{showJsonLink:true});
  renderColumn('colPending','pending',colPending,{});
  const btn=document.getElementById('btnCommitDelete');
  btn.disabled=colPending.length===0;
  document.getElementById('pendingCount').textContent=colPending.length?`(${colPending.length})`:'';
  const total=allPaths.length;
  const cov=document.getElementById('coverageLabel');
  if(cov) cov.textContent=total?`${colActive.length} в проекте · ${colStaged.length} врем. удалено · ${colPending.length} к удалению навсегда`:'';
}

function githubFileUrl(relPath){
  const s=ghLoad();
  if(!s||!ghIsConnected()) return null;
  return `https://github.com/${s.owner}/${s.repo}/blob/${encodeURIComponent(s.branch)}/${relPath.split('/').map(encodeURIComponent).join('/')}`;
}

function renderColumn(rootId,column,paths,opts){
  const root=document.getElementById(rootId);
  if(!paths.length){
    root.innerHTML = column==='active'
      ? (allPaths.length?'<div class="hint">Подключи папку проекта или GitHub вверху — здесь появятся все фото из assets/refs/.</div>':'<div class="hint">Пусто.</div>')
      : '<div class="hint">Пусто.</div>';
    return;
  }
  let html='';
  paths.forEach((p,i)=>{
    const id=fileMatch[p];
    const active=(activeColumn===column && selectedPath===p);
    const title=cardTitle(p);
    const sub=cardSub(p);
    html+=`<div class="card${active?' active':''}" data-path="${esc(p)}" data-column="${column}">
      ${opts.numbered?`<span class="num">${i+1}</span>`:''}
      <span class="thumb"><span class="thumb-empty">…</span></span>
      <span class="n"><span class="t">${esc(title)}</span><span class="sub${id?'':' warn'}">${esc(sub)}</span></span>
    </div>`;
  });
  root.innerHTML=html;

  if(opts.showJsonLink){
    paths.forEach((p,i)=>{
      const id=fileMatch[p];
      const card=root.children[i];
      const jsonPath=id?`data/objects/${id}.json`:null;
      const url=jsonPath?githubFileUrl(jsonPath):null;
      const linkEl=document.createElement('span');
      linkEl.className='json-link';
      linkEl.innerHTML = jsonPath
        ? (url?`JSON: <a href="${esc(url)}" target="_blank" rel="noopener">${esc(jsonPath)}</a>`:`JSON: ${esc(jsonPath)}`)
        : 'JSON: нет';
      card.appendChild(linkEl);
    });
  }

  const cardEls=root.querySelectorAll('.card');
  cardEls.forEach((el,i)=>el.addEventListener('click',()=>selectIn(column,paths[i])));
  ghMapLimit(paths,8,async(p,i)=>{
    const url=await getImageUrl(p);
    const el=cardEls[i];
    if(!el||!el.isConnected||el.dataset.path!==p) return;
    const t=el.querySelector('.thumb');
    if(t) t.innerHTML=url?`<img src="${url}">`:'<span class="thumb-empty">∅</span>';
  });

  if(activeColumn===column && selectedPath){
    const sel=root.querySelector('.card.active');
    if(sel) sel.scrollIntoView({block:'nearest'});
  }
}
