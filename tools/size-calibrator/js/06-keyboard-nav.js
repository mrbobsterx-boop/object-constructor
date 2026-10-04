/* ============================================================
   MODULE 06 — KEYBOARD NAV
   Быстрый проход по всем объектам руками, без мыши:
   Tab/Shift+Tab — следующий/предыдущий объект слева (по кругу).
   X — встать в поле "Ширина", Y — встать в поле "Высота" (по физической клавише,
   через event.code, а не event.key — работает одинаково при любой раскладке клавиатуры).
   Внутри поиска и текстовых полей custom-полей буквы x/y/Tab работают как обычно (набор текста).
   ============================================================ */
function isFreeTextFocus(){
  const el=document.activeElement;
  if(!el) return false;
  if(el.id==='searchBox') return true;
  if(el.tagName==='TEXTAREA') return true;
  if(el.tagName==='INPUT' && el.type==='text') return true; // ключ/строковое значение custom-поля
  return false;
}
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(isFreeTextFocus()) return;
  if(e.key==='Tab'){
    e.preventDefault();
    navigateObjectList(e.shiftKey?-1:1);
    return;
  }
  if(e.code==='KeyX'){
    const el=document.getElementById('fRealWidth');
    if(el){ e.preventDefault(); el.focus(); el.select(); }
    return;
  }
  if(e.code==='KeyY'){
    const el=document.getElementById('fRealHeight');
    if(el){ e.preventDefault(); el.focus(); el.select(); }
    return;
  }
});
