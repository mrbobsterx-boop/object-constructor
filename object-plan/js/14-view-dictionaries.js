/* ============================================================
   MODULE 14 — VIEWS: DICTIONARIES / CHECKS / CUSTOM
   Справочники (категории ОС, разделы, системы, типы комнат, группы взаимозаменяемости), проверки самого плана,
   форма добавления своего объекта.
   ============================================================ */

VIEW_RENDERERS.dictionaries=function(){
  const catRows=CATEGORIES.map(c=>{
    const list=ITEMS.filter(i=>i.c===c.id), done=list.filter(isDone).length;
    return `<tr class="click" data-act="filter" data-view="checklist" data-fk="cat" data-fv="${c.id}"><td><b>${esc(c.name)}</b> <span class="muted small">${esc(c.id)}</span>${c.needsNew?' <span class="tag new">нет в ОС</span>':''}${c.note?`<div class="muted small">${esc(c.note)}</div>`:''}</td><td>${list.length}</td><td>${done}</td></tr>`;
  });
  const groupRows=GROUPS.map(g=>{ const list=ITEMS.filter(i=>i.g===g.id); return `<tr class="click" data-act="filter" data-view="checklist" data-fk="group" data-fv="${g.id}"><td><b>${esc(g.name)}</b><div class="muted small">${esc(g.desc)}</div></td><td>${g.layer} — ${esc(LAYERS[g.layer]||'')}</td><td>${list.length}</td></tr>`; });
  const sysRows=SYSTEMS.map(s=>{ const list=ITEMS.filter(i=>i.sys.includes(s.id)); return `<tr class="click" data-act="filter" data-view="checklist" data-fk="sys" data-fv="${s.id}"><td><b>${esc(s.name)}</b> <span class="muted small">${esc(s.id)}</span></td><td>${list.length}</td><td>${list.filter(isDone).length}</td></tr>`; });
  const roomRows=ROOM_TYPES.map(r=>{
    const list=ITEMS.filter(i=>i.rooms.includes(r.id)).sort((a,b)=>a.p-b.p);
    return `<tr><td><b>${esc(r.name)}</b> <span class="muted small">${esc(r.id)}</span></td><td>${list.length}</td><td>${list.filter(i=>i.p===0).length}</td><td>${list.slice(0,14).map(i=>lnk(i.id)).join(', ')}${list.length>14?` … <a class="lnk" data-act="filter" data-view="checklist" data-fk="room" data-fv="${r.id}">все ${list.length}</a>`:''}</td></tr>`;
  });
  const vg=new Map(); ITEMS.forEach(i=>{ if(i.vg){ if(!vg.has(i.vg)) vg.set(i.vg,[]); vg.get(i.vg).push(i); } });
  const vgRows=[...vg.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,l])=>`<tr><td><b>${esc(k)}</b></td><td>${l.length}</td><td>${l.map(i=>lnk(i.id)).join(', ')}</td></tr>`);
  return `<div class="toolbar"><div><h2>Справочники</h2><div class="muted">Словари плана: чем описываются объекты (правятся в js/02-vocab.js)</div></div></div>
  ${card('Категории ОС',table(['Категория','В плане','Готово'],catRows))}
  ${card('Разделы плана',table(['Раздел','Слой разработки','Объектов'],groupRows))}
  ${card('Системы игры',table(['Система','Объектов','Готово'],sysRows))}
  ${card('Типы комнат — какие объекты нужны для генерации',table(['Тип комнаты','Объектов','P0','Объекты'],roomRows),'<span class="muted small" style="margin-left:auto">типы комнат из Room Editor: «Тип комнаты» и рецепты</span>')}
  ${card('Группы взаимозаменяемости (variant_group)',table(['Группа','Объектов','Объекты'],vgRows),'<span class="muted small" style="margin-left:auto">объекты одной группы генератор считает вариантами одной вещи</span>')}`;
};

VIEW_RENDERERS.checks=function(){
  const order={err:0,warn:1,info:2};
  const list=PLAN_PROBLEMS.slice().sort((a,b)=>(order[a.level]-order[b.level])||a.code.localeCompare(b.code)||String(a.id).localeCompare(String(b.id)));
  const cnt={err:0,warn:0,info:0}; list.forEach(p=>cnt[p.level]++);
  const rows=list.map(p=>`<div class="problem ${p.level}"><span class="badge ${p.level==='err'?'err':p.level==='warn'?'warn':'info'}">${esc(p.code)}</span> ${BY_ID.has(p.id)?lnk(p.id):esc(p.id)} — ${esc(p.msg)}</div>`).join('');
  return `<div class="toolbar"><div><h2>Проверки плана</h2><div class="muted">Целостность самого каталога: ссылки, циклы, словари, пустые поля</div></div></div>
  ${card('Итог',`<div class="statgrid wide"><div class="stat"><div class="n">${cnt.err}</div><div class="t">ошибок</div></div><div class="stat"><div class="n">${cnt.warn}</div><div class="t">предупреждений</div></div><div class="stat"><div class="n">${cnt.info}</div><div class="t">заметок</div></div><div class="stat"><div class="n">${ITEMS.length}</div><div class="t">объектов проверено</div></div></div>`)}
  ${list.length?rows:'<div class="empty ok">Проблем нет ✓</div>'}`;
};

/* ---------- свои объекты ---------- */
VIEW_RENDERERS.custom=function(){
  const rows=(store.custom||[]).map(c=>`<tr><td>${lnk(c.id)} <span class="muted small">${esc(c.id)}</span></td><td>${esc(catName(c.c))}</td><td>${esc(groupName(c.g))}</td><td>${prioBadge(c.p)}</td><td><button data-act="del-custom" data-id="${esc(c.id)}">Удалить</button></td></tr>`);
  return `<div class="toolbar"><div><h2>Свои объекты</h2><div class="muted">Добавь объект, которого нет в каталоге: он появится в чек-листе, порядке создания и сверке</div></div></div>
  ${card('Новый объект',`<div class="filters">
    <div><label>id (a-z, 0-9, _)</label><input id="cId" placeholder="например: bed_wide"></div>
    <div><label>Название</label><input id="cName" placeholder="Кровать широкая"></div>
    <div><label>Категория ОС</label><select id="cCat">${CATEGORIES.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
    <div><label>Раздел</label><select id="cGroup">${GROUPS.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>
    <div><label>Приоритет</label><select id="cPrio">${PRIORITIES.map(p=>`<option value="${p.id}"${p.id===1?' selected':''}>P${p.id}</option>`).join('')}</select></div>
  </div><div style="margin-top:8px"><label>Зачем нужен</label><input id="cWhy" style="width:100%"></div>
  <div style="margin-top:8px"><label>Функциональная способность</label><input id="cFn" style="width:100%"></div>
  <div style="margin-top:10px"><button class="primary" data-act="add-custom">➕ Добавить в план</button> <span id="cMsg" class="muted"></span></div>`)}
  ${card('Мои объекты ('+(store.custom||[]).length+')',table(['Объект','Категория','Раздел','Приоритет',''],rows,'Пока нет своих объектов.'))}`;
};
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-act="add-custom"],[data-act="del-custom"]'); if(!a) return;
  if(a.dataset.act==='del-custom'){
    if(!confirm('Удалить свой объект «'+a.dataset.id+'» из плана? Его отметки тоже пропадут.')) return;
    store.custom=store.custom.filter(c=>c.id!==a.dataset.id); delete store.status[a.dataset.id]; delete store.steps[a.dataset.id]; delete store.notes[a.dataset.id];
    saveStore(); buildModel(); if(PROJECT.scanned) PROJECT.extra=[...PROJECT.found.values()].filter(o=>!BY_ID.has(o.id)); render(); return;
  }
  const v=id=>document.getElementById(id).value.trim(), msg=document.getElementById('cMsg');
  const id=v('cId'), name=v('cName');
  if(!/^[a-z0-9_\-]+$/.test(id)){ msg.textContent='id: только a-z, 0-9, _ и -'; return; }
  if(BY_ID.has(id)){ msg.textContent='Такой id уже есть в плане.'; return; }
  if(!name){ msg.textContent='Укажи название.'; return; }
  store.custom.push({id,n:name,c:v('cCat'),g:v('cGroup'),p:Number(v('cPrio')),why:v('cWhy'),fn:v('cFn'),use:'',note:''});
  saveStore(); buildModel(); if(PROJECT.scanned) PROJECT.extra=[...PROJECT.found.values()].filter(o=>!BY_ID.has(o.id)); render();
});
