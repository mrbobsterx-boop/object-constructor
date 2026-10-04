/* ============================================================
   MODULE 07 — KEYBOARD NAV
   Tab/Shift+Tab — следующее/предыдущее фото в списке слева (по кругу); как в Калибровщике
   размеров (size-calibrator/js/06-keyboard-nav.js), не работает внутри текстовых полей — там
   Tab ведёт себя как обычно (переход между полями).
   1/2/3 (по физической клавише, event.code — не зависит от раскладки) — встать в поле
   ID объекта / Название объекта / Название этого фото.
   Enter (не внутри текстового поля) — "всё ок, без изменений", пометить фото просмотренным
   и перейти к следующему.
   Ctrl+Enter — сохранить изменения в текущих полях (если есть) и тоже перейти к следующему;
   работает и во время набора текста — этим отличается от простого Enter.
   ============================================================ */
function isFreeTextFocus(){
  const el=document.activeElement;
  if(!el) return false;
  if(el.id==='searchBox') return true;
  if(el.tagName==='TEXTAREA') return true;
  if(el.tagName==='INPUT' && el.type==='text') return true;
  return false;
}

async function markOkAndAdvance(){
  if(!selectedPath) return;
  markReviewed(selectedPath);
  renderLeft();
  navigateList(1);
}

// Ctrl+Enter — сохраняет и ID/папку (если изменился), и вариацию, и название объекта (если
// изменилось), одним движением — читает поля напрямую, не дожидаясь blur/change на #fTargetId.
async function saveCurrentAndAdvance(){
  if(!selectedPath) return;
  const path=selectedPath;
  const idInput=document.getElementById('fTargetId');
  if(!idInput) return;
  const newId=idInput.value.trim();
  if(!newId||!planItemById(newId)) return;
  const varInput=document.getElementById('fVarName');
  const objNameInput=document.getElementById('fObjName');
  const raw=varInput?varInput.value.trim():'';
  const slug=raw?sanitizeSlug(translit(raw)):'';
  const detectedId=fileMatch[path];
  const currentSuffix=detectedId?variationSuffix(path,detectedId):'';
  let ok=true;
  if(newId!==detectedId||slug!==currentSuffix){
    const res=await reassignPhoto(path,newId,slug);
    ok=res.ok;
  }
  if(ok&&objNameInput){
    const json=await getObjectJson(newId);
    const newName=objNameInput.value.trim();
    if(json&&newName&&newName!==json.name) await saveObjectName(newId,newName);
  }
  if(!ok) return;
  markReviewed(selectedPath);
  renderLeft();
  navigateList(1);
}

document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.key==='Enter'){
    e.preventDefault();
    saveCurrentAndAdvance();
    return;
  }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==='Enter'){
    if(isFreeTextFocus()) return;
    e.preventDefault();
    markOkAndAdvance();
    return;
  }
  if(isFreeTextFocus()) return;
  if(e.key==='Tab'){
    e.preventDefault();
    navigateList(e.shiftKey?-1:1);
    return;
  }
  if(e.code==='Digit1'||e.code==='Numpad1'){
    const el=document.getElementById('fTargetId');
    if(el){ e.preventDefault(); el.focus(); el.select(); }
    return;
  }
  if(e.code==='Digit2'||e.code==='Numpad2'){
    const el=document.getElementById('fObjName');
    if(el){ e.preventDefault(); el.focus(); el.select(); }
    return;
  }
  if(e.code==='Digit3'||e.code==='Numpad3'){
    const el=document.getElementById('fVarName');
    if(el){ e.preventDefault(); el.focus(); el.select(); }
    return;
  }
});
