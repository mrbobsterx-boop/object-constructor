/* ============================================================
   MODULE 03 — СОСТОЯНИЕ РЕДАКТИРОВАНИЯ + ОТМЕНА/ВОЗВРАТ
   activeFamilyKey — какая «семья» файлов сейчас редактируется (одна за раз, смешивать нельзя).
   selection — подмножество файлов ВНУТРИ активной семьи, к которому применяются правки полей
   раздел/объект/вариация (по умолчанию — вся семья; Ctrl+клик сужает/расширяет).
   pending — Map(имя файла → {razdel,obj,variation,states}) для ВСЕХ файлов активной семьи — при
   подтверждении переносится вся семья целиком, каждый файл — со своими накопленными значениями.
   states — МНОЖЕСТВО состояний одного файла (не одно значение): один и тот же снимок может стать
   сразу и «айдл», и «иконкой» (и иногда ещё и «сломано») — при подтверждении из него получится
   несколько выходных файлов, по одному на каждое отмеченное состояние.
   brush — какое состояние переключается кликом по файлу той же семьи: 'idle'|'broken'|'icon'.
   ============================================================ */

const STATE_ORDER=['idle','broken','icon'];

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
    pending:[...pending.entries()].map(([k,v])=>[k,{razdel:v.razdel,obj:v.obj,variation:v.variation,states:[...v.states]}]),
    brush
  };
}
function restoreSnapshot(s){
  activeFamilyKey=s.activeFamilyKey;
  selection=new Set(s.selection);
  pending=new Map(s.pending.map(([k,v])=>[k,{razdel:v.razdel,obj:v.obj,variation:v.variation,states:new Set(v.states)}]));
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
  pending=new Map(fam.files.map(f=>[f.fileName,{razdel:fam.razdel,obj:fam.obj,variation:fam.variation,states:new Set(['idle'])}]));
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
// Клик по файлу не ЗАМЕНЯЕТ его состояние, а ДОБАВЛЯЕТ/УБИРАЕТ отмеченный переключателем —
// так один и тот же снимок можно отметить сразу и «айдл», и «иконкой» (кликнуть дважды, разными
// переключателями), и получить из него два (или три) итоговых файла при подтверждении.
function applyBrushToFile(fileName){
  const parsed=parseFileName(fileName);
  if(parsed.stem!==activeFamilyKey||!pending.has(fileName)) return;
  const rec=pending.get(fileName);
  if(rec.states.has(brush)){
    if(rec.states.size>1) rec.states.delete(brush); // у файла должно остаться хотя бы одно состояние
  } else {
    rec.states.add(brush);
  }
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
function computeFinalNames(p,ext){
  const stem=[slug(p.razdel),slug(p.obj),slug(p.variation)].filter(Boolean).join('_');
  return STATE_ORDER.filter(s=>p.states.has(s)).map(s=>`${stem}${stem?'_':''}${s}.${ext}`);
}
