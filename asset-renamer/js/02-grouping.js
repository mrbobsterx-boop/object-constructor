/* ============================================================
   MODULE 02 — ГРУППИРОВКА ИМЁН
   Разбирает имя файла на раздел/объект/вариацию по подчёркиваниям. Последняя группа цифр в конце имени —
   это номер (1=обычно «хороший», 2/3/… — дальше по смыслу, который выбирает сам пользователь) и в
   группировку НЕ входит: файлы, различающиеся только номером, — это одна «семья» (family), один и тот же
   объект в разных состояниях/ракурсах. Раздел (1-й токен) — самый чёткий разделитель, объект (средние
   токены) — менее чёткий, вариация (последний токен) — самый нечёткий. Это только ПОДСКАЗКА для полей
   редактирования — пользователь всегда может поправить любое из трёх полей вручную.
   ============================================================ */

function parseFileName(fileName){
  const dot=fileName.lastIndexOf('.');
  const ext=dot>0?fileName.slice(dot+1).toLowerCase():'';
  const base=dot>0?fileName.slice(0,dot):fileName;
  const m=base.match(/^(.*?)(?:_(\d+))?$/);
  const stem=(m&&m[1])||base;
  const number=(m&&m[2])?parseInt(m[2],10):1;
  const tokens=stem.split('_').filter(Boolean);
  let razdel='',obj='',variation='';
  if(tokens.length===1){ razdel=tokens[0]; }
  else if(tokens.length===2){ razdel=tokens[0]; obj=tokens[1]; }
  else if(tokens.length>=3){ razdel=tokens[0]; obj=tokens.slice(1,-1).join('_'); variation=tokens[tokens.length-1]; }
  return {fileName,ext,stem,number,tokens,razdel,obj,variation};
}

function buildFamilies(fileNames){
  const byStem=new Map();
  fileNames.forEach(name=>{
    const p=parseFileName(name);
    if(!byStem.has(p.stem)) byStem.set(p.stem,{key:p.stem,razdel:p.razdel,obj:p.obj,variation:p.variation,files:[]});
    byStem.get(p.stem).files.push(p);
  });
  const families=[...byStem.values()];
  families.forEach(f=>f.files.sort((a,b)=>a.number-b.number));
  families.sort((a,b)=>(a.razdel+'_'+a.obj+'_'+a.variation).localeCompare(b.razdel+'_'+b.obj+'_'+b.variation,'ru'));
  return families;
}

function hashHue(s){
  let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return h%360;
}
function razdelColor(razdel){ return `hsl(${hashHue(razdel||'—')} 55% 50%)`; }
