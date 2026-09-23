/* ============================================================
   MODULE 11 — VIEW: CARD (карточка объекта плана)
   Всё, что нужно, чтобы создать объект в ОС: зачем нужен, функция, вариации, поля ОС (по вкладкам, значения копируются кликом), действия,
   состояния, рецепт, связи (что нужно раньше / что с ним работает / кому нужен), шаги готовности и заметка.
   ============================================================ */

function itemLinks(ids,emptyText){
  if(!ids.length) return `<span class="muted">${emptyText||'—'}</span>`;
  return ids.map(id=>{
    const it=BY_ID.get(id), st=it?statusOf(it):'';
    return `<span class="pill">${lnk(id)}${it?` <span class="st ${st}" style="margin-left:2px">${esc((STATUSES.find(s=>s.id===st)||{}).name||st)}</span>`:''}</span>`;
  }).join(' ');
}
// Русское название объекта по id (для подсказок рядом с английскими значениями)
function nameOf(id){ const it=BY_ID.get(id); return it?it.n:''; }
function osHint(r){
  if(r.key==='category') return `кнопка «${esc(catName(r.raw))}»`;
  if(r.kind==='ref') return esc(nameOf(r.raw));
  if(r.kind==='drops') return (r.raw||[]).map(d=>esc(nameOf(d[0]))).join(' · ');
  if(r.key==='recipe') return esc(r.text.replace(/([a-z][a-z0-9_]*)/g,(m)=>nameOf(m)||m));
  if(r.key==='allowedRoomTypes') return (r.raw||[]).map(x=>esc((ROOM_TYPES.find(t=>t.id===x)||{}).name||x)).join(' · ');
  return '';
}
// Значение, которое копируется кликом (data-copy). Многострочные значения — с переводом строки, как их вводят в ОС.
function copyVal(text,extra){ return `<code class="osval" data-act="copy" data-copy="${esc(text)}" title="Клик — скопировать">${esc(text)}</code>${extra?` <span class="muted small">${extra}</span>`:''}`; }
function copyBtn(text,label){ return `<button type="button" class="copybtn" data-act="copy" data-copy="${esc(text)}">${esc(label)}</button>`; }
function osTabBlock(tab,rows,extraRows){
  const body=rows.map(r=>`<tr><td class="oslab">${r.sec?`<span class="muted small">${esc(r.sec)} › </span>`:''}${esc(r.label)}</td><td>${copyVal(r.text,osHint(r))}</td></tr>`).join('')
    +(extraRows||'');
  const all=rows.map(r=>`${r.label}: ${r.text.replace(/\n/g,' | ')}`).join('\n');
  return `<div class="ostab"><div class="ostab-head"><b>Вкладка «${esc(tab.name)}»</b>${copyBtn(all,'Копировать вкладку')}</div><table class="ostable"><tbody>${body}</tbody></table></div>`;
}
function osCard(i){
  const rows=osRows(i), out=[];
  OS_TABS.forEach(tab=>{
    const rs=rows.filter(r=>r.tab===tab.id);
    let extra='';
    if(tab.id==='crafting'&&i.rc.includes(';')){
      const st=i.rc.split(';').slice(1).join(';').trim();
      extra=`<tr><td class="oslab">Станция и инструмент <span class="muted small">(не поле ОС — нужны рядом при крафте)</span></td><td>${copyVal(st,esc(st.split(',').map(x=>nameOf(x.trim())||x.trim()).join(' · ')))}</td></tr>`;
    }
    if(rs.length||extra) out.push(osTabBlock(tab,rs,extra));
  });
  // Дополнительно → свои поля: имя — по-английски, значение — по-английски/число, описание — по-русски
  if(i.cf.length){
    const body=i.cf.map(f=>`<tr><td>${copyVal(f[0])}</td><td>${copyVal(String(f[1]===''?'':f[1]))}</td><td class="muted">${esc(f[2]||'')}</td></tr>`).join('');
    const all=i.cf.map(f=>`${f[0]}: ${f[1]}`).join('\n');
    out.push(`<div class="ostab"><div class="ostab-head"><b>Вкладка «Дополнительно» → свои поля</b><span class="muted small">имя поля → значение</span>${copyBtn(all,'Копировать вкладку')}</div>
      <table class="ostable cf"><thead><tr><th>Имя поля</th><th>Значение</th><th>Что это</th></tr></thead><tbody>${body}</tbody></table></div>`);
  }
  const notes=i.pn.length?`<div style="margin-top:8px"><div class="muted small">ПОЯСНЕНИЯ (в ОС не вводятся)</div><ul class="clean">${i.pn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
  const hint=`<div class="muted small" style="margin-bottom:8px">Названия полей — как в ОС (по-русски), значения — по-английски: клик по значению копирует его. Полей, которых здесь нет, не трогай — в ОС они по умолчанию выключены или пусты. «Название» — отображаемое имя, оно остаётся русским.</div>`;
  const meta=`<div style="margin-top:8px" class="muted small">Типы комнат: ${i.rooms.map(r=>chipLink('checklist','room',r,(ROOM_TYPES.find(x=>x.id===r)||{}).name||r)).join(' ')||'—'} &nbsp;·&nbsp; Системы: ${i.sys.map(x=>chipLink('checklist','sys',x,(SYSTEMS.find(y=>y.id===x)||{}).name||x)).join(' ')||'—'}</div>`;
  const cat=CATEGORIES.find(c=>c.id===i.c);
  const newCat=cat&&cat.needsNew?`<div class="warn small" style="margin-bottom:6px">Категории «${esc(i.c)}» ещё нет в ОС — сначала добавь её (см. «Справочники»).</div>`:'';
  return card('Как создать в ОС',hint+newCat+out.join('')+notes+meta);
}
VIEW_RENDERERS.card=function(id){
  const i=BY_ID.get(id);
  if(!i) return `<div class="toolbar"><button data-act="back">← Назад</button></div><div class="empty">Объект «${esc(id)}» не найден в плане.</div>`;
  const s=statusOf(i), auto=statusIsAuto(i), st=stepStats(i), f=found(i);
  const cat=CATEGORIES.find(c=>c.id===i.c), g=effectiveGroups().find(x=>x.id===i.g);
  const head=`<div class="toolbar"><button data-act="back">← Назад</button><div><h2>${esc(i.n)} <span class="muted small">${esc(i.id)}</span></h2></div>
    <div class="row">${prioBadge(i.p)} ${badge(catName(i.c))} ${badge(groupName(i.g))} ${statusBadge(i)} ${i.custom?badge('свой','info'):''}</div></div>`;

  const statusCard=card('Статус',`<div class="row">
      <label style="display:flex;gap:8px;align-items:center;margin:0;font-size:13px;color:#e8edf3"><input type="checkbox" class="chk" data-check="${esc(i.id)}" ${s==='done'?'checked':''}> Готово (создан в ОС)</label>
      <select data-status="${esc(i.id)}" style="margin-left:12px"><option value="auto"${auto?' selected':''}>Авто (по шагам и проекту)</option>${STATUSES.map(x=>`<option value="${x.id}"${(!auto&&s===x.id)?' selected':''}>${x.name}</option>`).join('')}</select>
      <span class="muted">Шаги: ${st.done} / ${st.total}</span>${blockedBy(i).length?`<span class="tag warn">сначала создай: ${blockedBy(i).map(r=>esc((BY_ID.get(r)||{}).n||r)).join(', ')}</span>`:''}
    </div><div style="margin-top:8px"><label>Заметка (сохраняется в браузере / в проекте)</label><textarea data-note="${esc(i.id)}" placeholder="Что получилось, что решил, что осталось…">${esc(store.notes[i.id]||'')}</textarea></div>`);

  const about=card('Зачем и что делает',`<div style="margin-bottom:8px"><div class="muted small">ЗАЧЕМ НУЖЕН</div>${esc(i.why)||'—'}</div>
    <div style="margin-bottom:8px"><div class="muted small">ФУНКЦИОНАЛЬНАЯ СПОСОБНОСТЬ</div>${esc(i.fn)||'—'}</div>
    <div><div class="muted small">ДЛЯ ЧЕГО ПОЛЕЗЕН</div>${esc(i.use)||'—'}</div>
    ${i.note?`<div style="margin-top:8px"><div class="muted small">ОТКРЫТЫЕ ВОПРОСЫ</div><span class="warn">${esc(i.note)}</span></div>`:''}`);

  const variantRow=v=>{
    const ru=variationRu(v), en=variationEn(v), url=refThumbFor(i,v);
    return `<li>${url?`<img class="vthumb" src="${esc(url)}" alt="">`:''}${esc(ru)} <span class="muted small">(${esc(en)})</span>${url?'':' <span class="muted small">· нет превью в assets/refs</span>'}</li>`;
  };
  const variants=card('Вариации ('+i.v.length+')',i.v.length?`<ul class="clean">${i.v.map(variantRow).join('')}</ul>`+(i.vg?`<div class="muted small" style="margin-top:6px">Группа взаимозаменяемости для генератора комнат: <b>${esc(i.vg)}</b> (поле «Группа» в ОС)</div>`:''):'<span class="muted">Нет.</span>');

  const osParams=osCard(i);

  const rel=card('Связи',`<div style="margin-bottom:10px"><div class="muted small">СНАЧАЛА СОЗДАЙ (материалы рецепта, инструмент, станция, носитель)</div>${itemLinks(i.req,'ничего — можно делать сразу')}</div>
    <div style="margin-bottom:10px"><div class="muted small">ВЗАИМОДЕЙСТВУЕТ С</div>${itemLinks(i.w,'—')}</div>
    <div style="margin-bottom:10px"><div class="muted small">НУЖЕН ДЛЯ СОЗДАНИЯ (${REL.neededBy.get(i.id).length})</div>${itemLinks(REL.neededBy.get(i.id),'ни для чего в плане')}</div>
    <div><div class="muted small">С НИМ ВЗАИМОДЕЙСТВУЮТ (${REL.touchedBy.get(i.id).length})</div>${itemLinks(REL.touchedBy.get(i.id),'—')}</div>`);

  const steps=stepList(i).map(sd=>{
    const man=stepManual(i,sd.id), au=autoStepDone(i,sd.id);
    return `<label><input type="checkbox" class="chk" data-item="${esc(i.id)}" data-step="${sd.id}" ${(man||au)?'checked':''} ${au&&!man?'disabled':''}> ${esc(sd.label)}${au?' <span class="auto">✓ найдено в проекте</span>':''}</label>`;
  }).join('');
  const stepsCard=card('Шаги готовности',`<div class="steps">${steps}</div>${progressBar(st.done,st.total,s==='wip'?'wip':'')}`,`<span class="muted small" style="margin-left:auto">${st.done} / ${st.total}</span>`);

  let proj='';
  if(PROJECT.scanned){
    if(f){
      const rows=[['Объект найден',`«${esc(f.name)}» (data/objects)`],['Категория',f.category===i.c?`${esc(f.category)} <span class="ok">совпадает</span>`:`${esc(f.category)} <span class="warn">в плане: ${esc(i.c)}</span>`],['Размер',f.w&&f.h?`${f.w} × ${f.h} см`+(i.sz&&(Math.abs(f.w-i.sz[0])>i.sz[0]*0.5||Math.abs(f.h-i.sz[1])>i.sz[1]*0.5)?` <span class="warn">сильно отличается от рекомендованного ${i.sz[0]}×${i.sz[1]}</span>`:''):'<span class="warn">не задан</span>'],['Картинка',f.asset?(PROJECT.sprites.has(f.asset)?'<span class="ok">файл есть</span>':`<span class="err">файл не найден: ${esc(f.asset)}</span>`):'<span class="warn">не задана</span>'],['Использований в проекте',String(PROJECT.usage.get(i.id)||0)]];
      proj=card('В проекте',kv(rows));
    } else proj=card('В проекте','<span class="muted">Объекта с таким id ещё нет в data/objects.</span>');
  }
  return head+statusCard+`<div class="two">${about}${variants}</div>${osParams}${rel}${stepsCard}${proj}`;
};
