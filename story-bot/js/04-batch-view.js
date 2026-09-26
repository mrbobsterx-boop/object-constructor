/* ============================================================
   MODULE 04 — ВКЛАДКА «ПАКЕТНАЯ СТАТИСТИКА» (много прогонов, агрегаты)
   Простые полосы-метры (тот же приём, что и в остальных приложениях репозитория, .bar/.stat),
   без отдельной библиотеки графиков — их тут негде подключить офлайн, и это не нужно для чисел вида
   «% прогонов» и «средний день».
   ============================================================ */

function median(nums){
  const s=[...nums].sort((a,b)=>a-b); const m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function lastMeaningfulNode(log){
  for(let i=log.length-1;i>=0;i--){ if(log[i].kind==='node') return log[i].title; }
  return '(неизвестно)';
}

function runBatchAndRender(){
  if(!storyData){ alert('Сначала подключи папку проекта с data/story.json (его пишет Story Map).'); return; }
  const params=readParams();
  const n=Math.max(1,Math.round(num(document.getElementById('pBatchN').value,200)));
  const results=runBatch(storyData,params,n);
  lastBatchResults=results;

  const outcomeCounts={};
  results.forEach(r=>{ outcomeCounts[r.outcome]=(outcomeCounts[r.outcome]||0)+1; });
  const hours=results.map(r=>r.hours);
  const days=hours.map(h=>h/24);
  const avgDays=(days.reduce((a,b)=>a+b,0)/days.length)||0;
  const medDays=median(days);

  const failNodeCounts={};
  results.forEach(r=>{ if(r.outcome==='death'||r.outcome==='stuck'){ const t=lastMeaningfulNode(r.log); failNodeCounts[t]=(failNodeCounts[t]||0)+1; } });
  const failRows=Object.entries(failNodeCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const varSums={}, varCounts={};
  results.forEach(r=>{ Object.entries(r.finalVars||{}).forEach(([k,v])=>{ varSums[k]=(varSums[k]||0)+v; varCounts[k]=(varCounts[k]||0)+1; }); });

  const el=document.getElementById('viewBatch');
  const outcomeRows=Object.entries(outcomeCounts).sort((a,b)=>b[1]-a[1]).map(([o,c])=>barRow(outcomeLabel(o),c,n)).join('');
  const failRowsHtml=failRows.length?failRows.map(([t,c])=>barRow(t,c,n)).join(''):'<div class="hint">Ни один прогон не закончился смертью или тупиком.</div>';
  const varRows=Object.keys(varSums).map(id=>{
    const v=(storyData.variables||[]).find(x=>x.id===id);
    const avg=(varSums[id]/varCounts[id]).toFixed(1);
    return `<div class="bar-row"><span class="lbl">${esc(v?v.name:id)}</span><span class="val">${avg}</span></div>`;
  }).join('');

  el.innerHTML=`
    <div class="card">
      <h3>Пакет из ${n} прогонов</h3>
      <div class="statgrid">
        <div class="stat"><div class="n">${avgDays.toFixed(1)}</div><div class="t">дней в среднем</div></div>
        <div class="stat"><div class="n">${medDays.toFixed(1)}</div><div class="t">дней медиана</div></div>
        <div class="stat"><div class="n">${Math.round((outcomeCounts.death||0)/n*100)}%</div><div class="t">смертей</div></div>
        <div class="stat"><div class="n">${Math.round((outcomeCounts.stuck||0)/n*100)}%</div><div class="t">застряли</div></div>
      </div>
    </div>
    <div class="card"><h3>Чем закончились прогоны</h3>${outcomeRows}</div>
    <div class="card"><h3>Где чаще всего проигрывают (последний пройденный узел)</h3>${failRowsHtml}</div>
    ${varRows?`<div class="card"><h3>Среднее конечное значение переменных</h3>${varRows}</div>`:''}
  `;
}
function barRow(label,count,total){
  const pct=total?Math.round(count/total*100):0;
  return `<div class="bar-row"><span class="lbl">${esc(label)}</span><div class="bar"><i style="width:${pct}%"></i></div><span class="val">${count} (${pct}%)</span></div>`;
}
let lastBatchResults=null;
