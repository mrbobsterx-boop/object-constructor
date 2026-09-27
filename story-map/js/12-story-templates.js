/* ============================================================
   MODULE 12 — ШАБЛОНЫ СЦЕН (Story Templates)
   Небольшая библиотека готовых структурных паттернов — несколько связанных узлов сразу, а не
   собирать вручную каждый раз. Локальные ref внутри шаблона резолвятся тем же приёмом, что и в
   идее-импорте (layoutIdeaEntries/target_ref, §8), но шаблон — ЧИСТАЯ СТРУКТУРА: без переменных,
   сущностей и links — этим и отличается от полноценного импорта идеи.
   ============================================================ */

const STORY_TEMPLATES=[
  {
    id:'encounter',label:'Столкновение (Encounter)',
    hint:'Событие → два исхода (успех/неудача), каждый ведёт к своему следствию.',
    nodes:[
      {ref:'a',title:'Столкновение',type:'event',category:'story',trigger:{kind:'conditions',all:[]},
       choices:[{label:'Успех',target_ref:'b'},{label:'Неудача',target_ref:'c'}]},
      {ref:'b',title:'Исход: успех',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]},
      {ref:'c',title:'Исход: неудача',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]}
    ]
  },
  {
    id:'decision',label:'Развилка (Decision)',
    hint:'Один узел-выбор с тремя вариантами дальнейшего пути.',
    nodes:[
      {ref:'a',title:'Развилка',type:'choice',category:'story',trigger:{kind:'conditions',all:[]},
       choices:[{label:'Вариант 1',target_ref:'b'},{label:'Вариант 2',target_ref:'c'},{label:'Вариант 3',target_ref:'d'}]},
      {ref:'b',title:'Путь 1',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]},
      {ref:'c',title:'Путь 2',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]},
      {ref:'d',title:'Путь 3',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]}
    ]
  },
  {
    id:'discovery',label:'Находка (Discovery)',
    hint:'Фоновое событие обнаруживает что-то новое, ведёт к одному продолжению.',
    nodes:[
      {ref:'a',title:'Находка',type:'background',category:'story',trigger:{kind:'scheduled',afterHours:24,sinceNode:'',repeat:false},
       choices:[{label:'Осмотреть',target_ref:'b'}]},
      {ref:'b',title:'Что нашли',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]}
    ]
  },
  {
    id:'combat',label:'Бой (Combat)',
    hint:'Завязка боя → три отдельных исхода (победа/поражение/бегство).',
    nodes:[
      {ref:'a',title:'Бой',type:'event',category:'story',trigger:{kind:'conditions',all:[]},
       choices:[{label:'Победа',target_ref:'b'},{label:'Поражение',target_ref:'c'},{label:'Бегство',target_ref:'d'}]},
      {ref:'b',title:'Исход: победа',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]},
      {ref:'c',title:'Исход: поражение',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]},
      {ref:'d',title:'Исход: бегство',type:'event',category:'story',trigger:{kind:'conditions',all:[]},choices:[]}
    ]
  }
];
function findStoryTemplate(id){ return STORY_TEMPLATES.find(t=>t.id===id); }

// Вставка от текущей точки спауна (nextNodeSpawnPos, §3) — как и обычные кнопки "+ Событие/Выбор/
// Фоновое", а не в фиксированную точку холста (та точка — только у импорта идеи/вставки Ctrl+V, §3).
// layoutIdeaEntries раскладывает по "слоям" от корня — тот же приём, что и у идеи-импорта (§8),
// поэтому исходы шаблона сразу выстраиваются по колонкам, а не грудой друг на друге.
function insertStoryTemplate(templateId){
  if(blockIfReadOnly()) return null;
  const tpl=findStoryTemplate(templateId); if(!tpl) return null;
  const anchor=nextNodeSpawnPos();
  const positions=layoutIdeaEntries(tpl.nodes);
  const refMap={};
  tpl.nodes.forEach(entry=>{ refMap[entry.ref]=uid('n'); });
  const newNodes=tpl.nodes.map((entry,i)=>({
    id:refMap[entry.ref],
    title:entry.title||'(шаблон)',text:entry.text||'',
    type:entry.type||'event',category:entry.category||'story',tags:[],samSystem:'',
    arc:'',chapter:'',eventSource:'',actionRef:{action:'',target:''},refs:[],
    x:anchor.x+positions[i].col*240,y:anchor.y+positions[i].row*140,
    trigger:JSON.parse(JSON.stringify(entry.trigger||{kind:'conditions',all:[]})),
    effects:[],sim:defaultSim(),
    choices:[],
    ending:''
  }));
  tpl.nodes.forEach((entry,i)=>{
    (entry.choices||[]).forEach(ch=>{
      const target=refMap[ch.target_ref]; if(!target) return;
      newNodes[i].choices.push({id:uid('c'),label:ch.label||'',target,requires:[],effects:[],sim:{}});
    });
  });
  nodes.push(...newNodes);
  const rootId=refMap[tpl.nodes[0].ref];
  selectNode(rootId);
  pushHistory(); renderAll();
  return newNodes;
}

const templateSelectEl=document.getElementById('storyTemplateSelect');
if(templateSelectEl) templateSelectEl.innerHTML=STORY_TEMPLATES.map(t=>`<option value="${esc(t.id)}" title="${esc(t.hint)}">${esc(t.label)}</option>`).join('');
document.getElementById('btnInsertTemplate').onclick=()=>{
  const sel=document.getElementById('storyTemplateSelect');
  insertStoryTemplate(sel.value);
};
