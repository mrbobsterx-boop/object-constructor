/* ============================================================
   MODULE 03 — ВКЛАДКА «ПОДРОБНЫЙ ЛОГ» (один прогон, шаг за шагом)
   ============================================================ */

function readParams(){
  return {
    foodRate:num(document.getElementById('pFoodRate').value,1),
    waterRate:num(document.getElementById('pWaterRate').value,1.5),
    critical:num(document.getElementById('pCritical').value,15),
    dangerMul:num(document.getElementById('pDangerMul').value,1),
    seed:num(document.getElementById('pSeed').value,1),
    maxSteps:num(document.getElementById('pMaxSteps').value,500)
  };
}
const OUTCOME_LABEL={death:'☠ смерть',stuck:'⛔ застрял (нет доступных переходов)',timeout:'⏱ не завершился за отведённые шаги',
  no_start:'нет стартового узла',broken_link:'переход в несуществующий узел'};
function outcomeLabel(o){ return OUTCOME_LABEL[o]||('🏁 концовка «'+o+'»'); }

function stepHtml(s){
  const isDeath=s.ending==='death'||(s.warnings&&s.warnings.length);
  const cls='step'+(isDeath?' death':'')+(s.warnings&&s.warnings.length?' warn-row':'');
  const label=s.kind==='choice'?('→ '+esc(s.choiceLabel)):(esc(s.title)+(s.kind==='background'?' (фоновое)':''));
  const deltasTxt=s.deltas&&s.deltas.length?s.deltas.map(d=>esc(d.var)+': '+d.from+'→'+d.to).join(', '):'';
  return `<div class="${cls}">
    <div class="hdr"><span>${label}</span><span class="t">день ${s.day}, час ${Math.round(s.hour)}</span></div>
    ${s.why?`<div class="why">${esc(s.why)}</div>`:''}
    ${deltasTxt?`<div class="deltas">${deltasTxt}</div>`:''}
    ${s.ending?`<div class="deltas">🏁 концовка: ${esc(s.ending)}</div>`:''}
  </div>`;
}

function runSingle(){
  if(!storyData){ alert('Сначала подключи папку проекта с data/story.json (его пишет Story Map).'); return; }
  const params=readParams();
  const r=runOnce(storyData,params,params.seed);
  lastSingleResult=r;
  const el=document.getElementById('viewSingle');
  const varsHtml=Object.keys(r.finalVars||{}).map(id=>{
    const v=(storyData.variables||[]).find(x=>x.id===id);
    return `<div class="bar-row"><span class="lbl">${esc(v?v.name:id)}</span><span class="val">${r.finalVars[id]}</span></div>`;
  }).join('');
  el.innerHTML=`
    <div class="card">
      <h3>Итог: ${outcomeLabel(r.outcome)}</h3>
      <div class="statgrid">
        <div class="stat"><div class="n">${Math.round(r.hours)}</div><div class="t">часов прожито</div></div>
        <div class="stat"><div class="n">${Math.floor(r.hours/24)}</div><div class="t">игровых дней</div></div>
        <div class="stat"><div class="n">${Math.round(r.hunger)}</div><div class="t">голод на конец</div></div>
        <div class="stat"><div class="n">${Math.round(r.thirst)}</div><div class="t">жажда на конец</div></div>
        <div class="stat"><div class="n">${Math.round(r.health)}</div><div class="t">здоровье на конец</div></div>
        <div class="stat"><div class="n">${r.log.length}</div><div class="t">шагов в логе</div></div>
      </div>
      ${varsHtml?`<div style="margin-top:8px">${varsHtml}</div>`:''}
    </div>
    <div class="card"><h3>Хронология</h3><div class="timeline">${r.log.map(stepHtml).join('')}</div></div>
  `;
}
let lastSingleResult=null;
