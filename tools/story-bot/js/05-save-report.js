/* ============================================================
   MODULE 05 — ОТЧЁТ data/story_playtest.json (единственный файл, который пишет этот инструмент)
   ============================================================ */

async function saveReport(){
  if(!projectDirHandle&&!ghIsConnected()){ return; }
  const report={
    schema_version:1,
    saved_at:new Date().toISOString(),
    lastSingleRun:lastSingleResult?{outcome:lastSingleResult.outcome,hours:lastSingleResult.hours,finalVars:lastSingleResult.finalVars,steps:lastSingleResult.log.length}:null,
    lastBatch:lastBatchResults?{
      n:lastBatchResults.length,
      outcomeCounts:lastBatchResults.reduce((acc,r)=>{ acc[r.outcome]=(acc[r.outcome]||0)+1; return acc; },{}),
      avgHours:lastBatchResults.reduce((a,r)=>a+r.hours,0)/lastBatchResults.length
    }:null
  };
  try{ await writeFileToProject('data/story_playtest.json',JSON.stringify(report,null,2)); }
  catch(e){ console.warn('Не удалось сохранить отчёт:',e); }
}
