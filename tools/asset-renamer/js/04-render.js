/* ============================================================
   MODULE 04 — ОТРИСОВКА (источник / редактирование / журнал)
   ============================================================ */

function flashReject(fileName){
  const chip=document.querySelector(`.file-chip[data-file="${CSS.escape(fileName)}"]`);
  if(!chip) return;
  chip.classList.add('reject-flash');
  setTimeout(()=>chip.classList.remove('reject-flash'),400);
}

function render(){ renderLeft(); renderCenter(); renderRight(); }

function renderLeft(){
  const el=document.getElementById('sourceList');
  if(!families.length){
    el.innerHTML='<div class="hint">Подключи папку-источник — файлы появятся здесь, сгруппированные по названию (раздел — самый чёткий разделитель, объект — менее чёткий, вариация — самый нечёткий; номер в конце имени группировку не рвёт).</div>';
    return;
  }
  let html='', lastRazdel=null, lastObj=null;
  for(const fam of families){
    if(fam.razdel!==lastRazdel){
      html+=`<div class="razdel-band" style="--band-color:${razdelColor(fam.razdel)}">${esc(fam.razdel||'(без раздела)')}</div>`;
      lastRazdel=fam.razdel; lastObj=null;
    }
    if(fam.obj!==lastObj){
      html+=`<div class="obj-sub">${esc(fam.obj||'(без объекта)')}</div>`;
      lastObj=fam.obj;
    }
    const isActive=fam.key===activeFamilyKey;
    html+=`<div class="family-card ${isActive?'active':''}" style="--band-color:${razdelColor(fam.razdel)}">
      <div class="family-title">${esc(fam.variation||fam.key)} <span class="muted small">× ${fam.files.length}</span></div>
      <div class="family-files">`;
    for(const file of fam.files){
      const sel=isActive&&selection.has(file.fileName);
      const states=isActive&&pending.has(file.fileName)?STATE_ORDER.filter(s=>pending.get(file.fileName).states.has(s)):[];
      html+=`<div class="file-chip ${sel?'selected':''}" data-file="${esc(file.fileName)}" title="${esc(file.fileName)}">
        <img src="${esc(fileUrls.get(file.fileName)||'')}" alt="" loading="lazy">
        <div class="file-name">${esc(file.fileName)}</div>
        ${states.length?`<div class="state-tags">${states.map(s=>`<span class="state-tag st-${s}">${s}</span>`).join('')}</div>`:''}
      </div>`;
    }
    html+='</div></div>';
  }
  el.innerHTML=html;
}

function fieldRow(key,label,val,numKey){
  return `<div class="field-row" data-field="${key}">
    <label class="small">${label}</label>
    <div class="row">
      <span class="field-value" data-field-value="${key}">${val===null?'<span class="muted">— разное —</span>':(esc(val)||'<span class="muted">—</span>')}</span>
      <button class="field-edit-btn" data-edit-field="${key}">✏ Править<span class="kbd">Num${numKey}</span></button>
    </div>
  </div>`;
}

function renderCenter(){
  const el=document.getElementById('editPanel');
  if(!activeFamilyKey){ el.innerHTML='<div class="hint">Выбери файл слева, чтобы начать редактирование.</div>'; return; }
  const fam=findFamily(activeFamilyKey);
  if(!fam){ activeFamilyKey=null; el.innerHTML='<div class="hint">Выбери файл слева, чтобы начать редактирование.</div>'; return; }
  const razdelVal=commonValue('razdel'), objVal=commonValue('obj'), varVal=commonValue('variation');
  el.innerHTML=`
    <div class="group">
      <h3>Группа: ${esc(fam.key)} <span class="muted small">— выбрано ${selection.size} из ${fam.files.length} для правки полей</span></h3>
      ${fieldRow('razdel','Раздел',razdelVal,'7')}
      ${fieldRow('obj','Объект',objVal,'4')}
      ${fieldRow('variation','Вариация',varVal,'1')}
      <div class="row" style="margin-top:6px">
        <input type="text" id="quickAddVarText" placeholder="добавить к вариации, напр. зелёный" style="flex:1">
        <button id="btnAppendVar">+ добавить</button>
      </div>
    </div>
    <div class="group">
      <h3>Состояние для клика по файлу слева (без Ctrl)</h3>
      <div class="row">
        <button class="state-slider ${brush==='broken'?'on':''}" id="sliderBroken">Сломано<span class="kbd">Num0</span></button>
        <button class="state-slider ${brush==='icon'?'on':''}" id="sliderIcon">Иконка<span class="kbd">Num3</span></button>
      </div>
      <div class="hint">Клик по файлу слева (без Ctrl) ДОБАВЛЯЕТ или УБИРАЕТ отмеченное переключателем состояние у этого файла — состояния не заменяют друг друга. Один и тот же снимок можно отметить сразу и «айдл», и «иконкой» (кликни по нему без переключателя — добавится/уберётся айдл, включи «Иконка» и кликни ещё раз — добавится и иконка): при подтверждении из него получится два (или три) отдельных файла. Новый выбор слева сбрасывает все файлы группы на «хороший» (idle).</div>
    </div>
    <div class="group">
      <h3>Файлы этой группы и их итоговые имена</h3>
      <div class="filechips">${fam.files.map(f=>{
        const p=pending.get(f.fileName);
        const finalNames=computeFinalNames(p,f.ext);
        const tags=STATE_ORDER.filter(s=>p.states.has(s)).map(s=>`<span class="state-tag st-${s}">${s}</span>`).join('');
        return `<div class="preview-row ${selection.has(f.fileName)?'selected':''}">
          <img src="${esc(fileUrls.get(f.fileName)||'')}" alt="">
          <div class="preview-names"><div>${esc(f.fileName)}</div>${finalNames.map(n=>`<div>${esc(n)}</div>`).join('')}</div>
          <div class="state-tags">${tags}</div>
        </div>`;
      }).join('')}</div>
    </div>
    <button class="full primary" id="btnConfirm">✔ Подтвердить и перенести <span class="kbd">Enter</span></button>
  `;
}

function renderRight(){
  const el=document.getElementById('destLog');
  el.innerHTML=moveLog.length?moveLog.map(r=>`<div class="log-item ${r.ok?'ok':'err'}">${r.ok?`${esc(r.from)} → ${esc(r.to)}`:`${esc(r.from)} — ошибка: ${esc(r.error||'')}`}</div>`).join(''):'<div class="hint">Здесь появится список перенесённых файлов.</div>';
}

function startEditField(key){
  if(!activeFamilyKey) return;
  const span=document.querySelector(`.field-value[data-field-value="${key}"]`);
  if(!span) return;
  const cur=commonValue(key);
  const input=document.createElement('input');
  input.type='text'; input.value=cur===null?'':(cur||''); input.className='field-edit-input';
  span.replaceWith(input); input.focus(); input.select();
  let committed=false;
  const commit=()=>{ if(committed) return; committed=true; applyFieldEdit(key,input.value.trim()); };
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',e=>{ if(e.code==='Enter'||e.code==='NumpadEnter'){ e.preventDefault(); input.blur(); } });
}
