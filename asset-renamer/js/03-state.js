/* ============================================================
   MODULE 03 — СОСТОЯНИЕ РЕДАКТИРОВАНИЯ + ОТМЕНА/ВОЗВРАТ
   activeFamilyKey — какая «семья» файлов сейчас редактируется (одна за раз, смешивать нельзя).
   selection — подмножество файлов ВНУТРИ активной семьи, к которому применяются правки полей
   раздел/объект/вариация (по умолчанию — вся семья; Ctrl+клик сужает/расширяет).
   pending — Map(имя файла → {razdel,obj,variation,state}) для ВСЕХ файлов активной семьи — при
   подтверждении переносится вся семья целиком, каждый файл — со своими накопленными значениями.
   brush — какое состояние ставится простым кликом по файлу той же семьи: 'idle'|'broken'|'icon'.
   ============================================================ */

let families=[];
let fileUrls=new Map(); // имя файла → object URL превью
let activeFamilyKey=null;
let selection=new Set();
let pending=new Map();
let brush='idle';

let history=[], historyIndex=-1;
function snapshot(){
  return {
    activeFamilyKey,
    selection:[...selection],
    pending:[...pending.entries()].map(([k,v])=>[k,{...v}]),
    brush
  };
}
function restoreSnapshot(s){
  activeFamilyKey=s.activeFamilyKey;
  selection=new Set(s.selection);
  pending=new Map(s.pending.map(([k,v])=>[k,{...v}]));
  brush=s.brush;
}
function pushHistory(){
  history=history.slice(0,historyIndex+1);
  history.push(snapshot());
  historyIndex=history.length-1;
  if(history.length>200){ history.shift(); historyIndex--; }
}
function undo(){ if(historyIndex<=0) return; historyIndex--; restoreSnapshot(history[historyIndex]); render(); }
function redo(){ if(historyIndex>=history.length-1) return; historyIndex++; restoreSnapshot(history[historyIndex]); render(); }
function resetHistory(){ history=[]; historyIndex=-1; }

function findFamily(key){ return families.find(f=>f.key===key); }

function selectFamily(fileName){
  const parsed=parseFileName(fileName);
  const fam=findFamily(parsed.stem);
  if(!fam) return;
  activeFamilyKey=fam.key;
  selection=new Set(fam.files.map(f=>f.fileName));
  pending=new Map(fam.files.map(f=>[f.fileName,{razdel:fam.razdel,obj:fam.obj,variation:fam.variation,state:'idle'}]));
  brush='idle';
  pushHistory();
  render();
}
function toggleSelectionMember(fileName){
  const parsed=parseFileName(fileName);
  if(parsed.stem!==activeFamilyKey){ flashReject(fileName); return; }
  if(selection.has(fileName)) selection.delete(fileName); else selection.add(fileName);
  pushHistory(); render();
}
function applyBrushToFile(fileName){
  const parsed=parseFileName(fileName);
  if(parsed.stem!==activeFamilyKey||!pending.has(fileName)) return;
  pending.get(fileName).state=brush;
  pushHistory(); render();
}
function toggleBrush(kind){ brush=(brush===kind)?'idle':kind; render(); }

function commonValue(key){
  let val, mixed=false, any=false;
  for(const name of selection){
    if(!pending.has(name)) continue;
    const v=pending.get(name)[key];
    if(!any){ val=v; any=true; } else if(v!==val) mixed=true;
  }
  return mixed?null:(any?val:'');
}
function applyFieldEdit(key,value){
  if(!activeFamilyKey) return;
  for(const name of selection){ if(pending.has(name)) pending.get(name)[key]=value; }
  pushHistory(); render();
}
function appendToVariation(text){
  if(!activeFamilyKey||!text) return;
  for(const name of selection){
    if(!pending.has(name)) continue;
    const cur=pending.get(name).variation;
    pending.get(name).variation=cur?(cur+' — '+text):text;
  }
  pushHistory(); render();
}

function slug(s){ return sanitizeSlug(s||''); }
function computeFinalName(p,ext){
  const stem=[slug(p.razdel),slug(p.obj),slug(p.variation)].filter(Boolean).join('_');
  return `${stem}${stem?'_':''}${p.state}.${ext}`;
}
