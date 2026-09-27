/* ============================================================
   MODULE 16 — ОБЗОР ПРОЕКТА (Project Overview)
   Снимок-на-открытие (тот же принцип, что у Обозревателя триггеров/Симуляции, §15/§20 — не подписан
   на renderAll()) — сводная статистика по всем слоям (сюжет/мир/идеи/готовность/проверки), версия
   формата файла и время последнего сохранения, плюс экспорт диагностического отчёта одним файлом —
   вместо того чтобы собирать те же цифры по кусочкам из разных панелей вручную.
   ============================================================ */

function computeProjectStats(){
  const byType={}; nodes.forEach(n=>{ byType[n.type]=(byType[n.type]||0)+1; });
  const byEntityKind={}; entities.forEach(e=>{ byEntityKind[e.kind]=(byEntityKind[e.kind]||0)+1; });
  const byProposalStatus={}; proposals.forEach(p=>{ const s=p.status||'idea'; byProposalStatus[s]=(byProposalStatus[s]||0)+1; });
  let implDone=0,implTotal=0;
  nodes.forEach(n=>{ const p=implementationProgress(n); implDone+=p.done; implTotal+=p.total; });
  const problems=runChecks().filter(p=>p.level!=='summary');
  return {
    nodeCount:nodes.length, byType,
    variableCount:variables.length,
    entityCount:entities.length, byEntityKind,
    relationCount:relations.length,
    proposalCount:proposals.length, byProposalStatus,
    implDone, implTotal,
    errCount:problems.filter(p=>p.level==='err').length,
    warnCount:problems.filter(p=>p.level==='warn').length,
    infoCount:problems.filter(p=>p.level==='info').length,
    schemaVersion:lastLoadedSchemaVersion||STORY_SCHEMA_VERSION,
    savedAt:lastLoadedSavedAt||'',
    connected:!!projectDirHandle
  };
}
const PROPOSAL_STATUS_LABELS={idea:'идея',accepted:'принята',rejected:'отклонена'};
function overviewCountRows(map,labelFn){
  const entries=Object.entries(map);
  if(!entries.length) return '<div class="muted small">—</div>';
  return entries.map(([k,c])=>`<div>${esc(labelFn(k))}: ${c}</div>`).join('');
}
function renderProjectOverview(){
  const s=computeProjectStats();
  const implPct=s.implTotal?Math.round(100*s.implDone/s.implTotal):0;
  document.getElementById('projectOverviewBody').innerHTML=`
    <div class="group"><h3>Сюжет</h3>
      <div>Узлов: <b>${s.nodeCount}</b></div>
      ${overviewCountRows(s.byType,t=>t)}
      <div>Переменных: <b>${s.variableCount}</b></div>
    </div>
    <div class="group"><h3>Мир</h3>
      <div>Сущностей: <b>${s.entityCount}</b></div>
      ${overviewCountRows(s.byEntityKind,k=>entityKindLabel(k))}
      <div>Связей: <b>${s.relationCount}</b></div>
    </div>
    <div class="group"><h3>Идеи-предложения</h3>
      <div>Всего: <b>${s.proposalCount}</b></div>
      ${overviewCountRows(s.byProposalStatus,st=>PROPOSAL_STATUS_LABELS[st]||st)}
    </div>
    <div class="group"><h3>Готовность к реализации (§22)</h3>
      <div>${s.implTotal?`${s.implDone}/${s.implTotal} аспектов узлов — ${implPct}%`:'Пока нет узлов.'}</div>
    </div>
    <div class="group"><h3>Проверки</h3>
      <div>Ошибок: <b>${s.errCount}</b> · Предупреждений: <b>${s.warnCount}</b> · Инфо: <b>${s.infoCount}</b></div>
    </div>
    <div class="group"><h3>Файл</h3>
      <div>Версия формата: ${s.schemaVersion}</div>
      <div>Последнее сохранение (в файле): ${s.savedAt?new Date(s.savedAt).toLocaleString():'—'}</div>
      <div>Папка проекта: ${s.connected?'подключена ✓':'не подключена'}</div>
    </div>
  `;
}
document.getElementById('btnProjectOverview').onclick=()=>{
  renderProjectOverview();
  document.getElementById('projectOverviewModal').style.display='flex';
};
document.getElementById('btnProjectOverviewClose').onclick=()=>{ document.getElementById('projectOverviewModal').style.display='none'; };
document.getElementById('btnExportDiagnostics').onclick=()=>{
  const s=computeProjectStats();
  const problems=runChecks().filter(p=>p.level!=='summary');
  const report={generatedAt:new Date().toISOString(),stats:s,issues:problems.map(p=>({level:p.level,text:p.text}))};
  downloadText('story-map-diagnostics.json',JSON.stringify(report,null,2));
};
