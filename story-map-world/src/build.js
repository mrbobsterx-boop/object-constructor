/* Сборка мира: node story-map-world/src/build.js
   Читает world-data.js и пишет story.json, json/*.json (формат «Импорт идеи») и md/*.md.
   Падает с ошибкой, если есть ссылка на несуществующий узел/переменную/сущность. */
const fs=require('fs'), path=require('path');
const {VARIABLES,ENTITIES,RELATIONS,CATEGORIES,DECISIONS,OPEN_QUESTIONS}=require('./world-data');

const ROOT=path.join(__dirname,'..');
const SRC_MARK={gdd:'✅',idea:'💡',open:'❓',user:'⭐'};
const SRC_TEXT={gdd:'Из GDD',idea:'Предложение',open:'Не решено',user:'Решение автора'};
const SOURCE_LABEL={player:'Игрок',npc:'NPC',faction:'Фракция',world:'Мир',location:'Локация',timer:'Таймер',system:'Игровая система',
  resource_shortage:'Нехватка ресурса',weather:'Погода',relationship:'Отношения',random:'Случайное'};
// Раздел Story Map (SYSTEMS из Object Plan) — по префиксу id события
const PREFIX_CATEGORY={story:'story',death:'death',time:'time',water:'water',energy:'energy',food:'food',farming:'farming',health:'health',
  exploration:'exploration',loot:'loot',factions:'factions',trade:'trade',capture:'factions',group:'ai',combat:'combat',repair:'repair',
  building:'building',physics:'physics',digging:'digging',light:'light',crafting:'crafting'};
const DEFAULT_RELATION_TYPES=[
  {name:'состоит_в',inverseName:'включает'},{name:'находится_в'},{name:'содержит',inverseName:'часть_от'},
  {name:'владеет',inverseName:'принадлежит'},{name:'может_делать'},{name:'использует'},{name:'производит'},
  {name:'удовлетворяет_потребность'},{name:'имеет_навык'},{name:'имеет_потребность'},{name:'является'},{name:'поддерживает'},
  {name:'друг_с',symmetric:true},{name:'враг_с',symmetric:true}
];
const OPS={'>=':'≥','<=':'≤','==':'=','!=':'≠','>':'>','<':'<'};

// ---------- проверка ссылок ----------
const allNodes=CATEGORIES.flatMap(cat=>cat.nodes.map(n=>Object.assign({cat:cat.id},n)));
const nodeById=new Map(); const varIds=new Set(VARIABLES.map(v=>v.id)); const entIds=new Set(ENTITIES.map(e=>e.ref));
const errors=[];
allNodes.forEach(n=>{ if(nodeById.has(n.ref)) errors.push('дубль узла '+n.ref); nodeById.set(n.ref,n); });
const checkVars=(list,where)=>(list||[]).forEach(x=>{ if(!varIds.has(x.var)) errors.push(`${where}: нет переменной ${x.var}`); });
allNodes.forEach(n=>{
  if(!PREFIX_CATEGORY[n.ref.split('.')[0]]) errors.push(`${n.ref}: неизвестный префикс`);
  if(n.trigger&&n.trigger.kind==='conditions') checkVars(n.trigger.all,n.ref);
  if(n.trigger&&n.trigger.sinceNode&&!allNodes.some(m=>m.ref===n.trigger.sinceNode)) errors.push(`${n.ref}: таймер от несуществующего узла ${n.trigger.sinceNode}`);
  checkVars(n.effects,n.ref);
  (n.refs||[]).forEach(r=>{ if(!entIds.has(r)) errors.push(`${n.ref}: нет сущности ${r}`); });
  (n.choices||[]).forEach(c=>{
    if(!nodeById.has(c.target)&&!allNodes.some(m=>m.ref===c.target)) errors.push(`${n.ref} → «${c.label}»: нет узла ${c.target}`);
    checkVars(c.requires,n.ref); checkVars(c.effects,n.ref);
  });
});
RELATIONS.forEach(r=>{ [r.from,r.to].forEach(x=>{ if(!entIds.has(x)) errors.push(`связь: нет сущности ${x}`); });
  if(!DEFAULT_RELATION_TYPES.some(t=>t.name===r.type)) errors.push(`связь: неизвестный тип ${r.type}`); });
if(allNodes.filter(n=>n.trigger&&n.trigger.kind==='start').length!==1) errors.push('должен быть ровно один стартовый узел');
if(errors.length){ console.error('Ошибки в world-data.js:\n  '+errors.join('\n  ')); process.exit(1); }

// ---------- общее ----------
const srcLine=n=>`${SRC_MARK[n.src]} ${SRC_TEXT[n.src]}${n.gdd?' · GDD '+n.gdd:''}`;
const defaultSim=()=>({durationHours:1,dangerChance:0,foodCost:0,waterCost:0,requiresItems:[],requiresSkills:[],resourceEffects:[]});
const trig=n=>n.trigger||{kind:'conditions',all:[]};
const nodeType=n=>n.type||(trig(n).kind==='scheduled'?'background':'event');
function storyNode(n,x,y){
  return {
    id:n.ref,title:n.title,text:srcLine(n)+'\n'+(n.text||''),type:nodeType(n),category:PREFIX_CATEGORY[n.ref.split('.')[0]],
    tags:[],samSystem:'',arc:'',chapter:'',eventSource:n.source||'',actionRef:{action:'',target:''},implementationStatus:{},
    refs:(n.refs||[]).slice(),x,y,trigger:trig(n),effects:n.effects||[],sim:defaultSim(),
    choices:(n.choices||[]).map((c,i)=>({id:n.ref+'#'+i,label:c.label,target:c.target,requires:c.requires||[],effects:c.effects||[],sim:{}})),
    ending:n.ending||''
  };
}
// Раскладка: каждая категория — горизонтальная полоса; внутри — колонки по глубине переходов от узлов без входящих.
function layoutCategory(cat,left,top){
  const refs=cat.nodes.map(n=>n.ref), inCat=new Set(refs);
  const incoming=new Map(refs.map(r=>[r,0]));
  cat.nodes.forEach(n=>(n.choices||[]).forEach(c=>{ if(inCat.has(c.target)&&c.target!==n.ref) incoming.set(c.target,incoming.get(c.target)+1); }));
  const depth=new Map(); const queue=refs.filter(r=>incoming.get(r)===0).map(r=>[r,0]);
  if(!queue.length) queue.push([refs[0],0]);
  while(queue.length){
    const [r,d]=queue.shift(); if(depth.has(r)) continue; depth.set(r,d);
    (nodeById.get(r).choices||[]).forEach(c=>{ if(inCat.has(c.target)&&!depth.has(c.target)) queue.push([c.target,d+1]); });
  }
  refs.forEach(r=>{ if(!depth.has(r)) depth.set(r,0); });
  const rowsPerCol={}; const pos={};
  refs.forEach(r=>{ const d=Math.min(depth.get(r),4); const row=rowsPerCol[d]=(rowsPerCol[d]||0)+1; pos[r]={x:left+d*270,y:top+(row-1)*130}; });
  const cols=Math.max(...Object.keys(rowsPerCol).map(Number))+1, rows=Math.max(...Object.values(rowsPerCol));
  return {pos,width:cols*270,height:rows*130};
}
// Категории — сеткой по GRID_COLS блоков в ряд; над каждым блоком заметка с названием.
const GRID_COLS=4, GAP=160;
// ---------- story.json ----------
const relationTypes=DEFAULT_RELATION_TYPES.map(t=>({id:'rt_'+t.name,name:t.name,inverseName:t.inverseName||'',symmetric:!!t.symmetric}));
const storyNodes=[], stickyNotes=[];
let rowTop=0, colLeft=0, rowHeight=0;
CATEGORIES.forEach((cat,i)=>{
  if(i%GRID_COLS===0&&i){ rowTop+=rowHeight+GAP; colLeft=0; rowHeight=0; }
  const {pos,width,height}=layoutCategory(cat,colLeft,rowTop+170);
  stickyNotes.push({id:'note_'+cat.id,x:colLeft,y:rowTop,text:cat.title+' — '+cat.intro,color:'yellow'});
  cat.nodes.forEach(n=>storyNodes.push(storyNode(n,pos[n.ref].x,pos[n.ref].y)));
  colLeft+=Math.max(width,600)+GAP; rowHeight=Math.max(rowHeight,height+170);
});
const story={
  schema_version:1,saved_at:new Date().toISOString(),
  variables:VARIABLES.map(v=>({id:v.id,name:v.name,type:v.type,start:v.start,min:v.min,max:v.max})),
  nodes:storyNodes,stickyNotes,
  entities:ENTITIES.map(e=>({id:e.ref,kind:e.kind,name:e.name,ref:null,note:`${SRC_MARK[e.src]} ${SRC_TEXT[e.src]}${e.note?' · '+e.note:''}`,status:'active',lifecycle:''})),
  relationTypes,
  relations:RELATIONS.map((r,i)=>({id:'rel_'+i,type:'rt_'+r.type,from:r.from,to:r.to,status:r.status||'confirmed',source:'world-data',comment:r.comment||'',conditions:[],effects:[]})),
  proposals:OPEN_QUESTIONS.map((q,i)=>({id:'q_'+i,title:'❓ '+q.title,text:q.text,status:'idea',priority:'high',source:'world-data',createdAt:'',relatedEntities:[],relatedSystems:[],relatedNodes:[]})),
  worldEvents:[],
  decisions:DECISIONS.map((d,i)=>({id:'dec_'+i,title:d.title,text:d.text,status:d.status||'defined',source:'decision',relatedSystems:[],relatedEntities:[],comment:'',createdAt:''}))
};
fs.writeFileSync(path.join(ROOT,'story.json'),JSON.stringify(story,null,2)+'\n');

// ---------- json/ по категориям (формат «📥 Импорт идеи») ----------
fs.mkdirSync(path.join(ROOT,'json'),{recursive:true}); fs.mkdirSync(path.join(ROOT,'md'),{recursive:true});
const varsUsedBy=nodes=>{ const s=new Set(); const add=l=>(l||[]).forEach(x=>s.add(x.var));
  nodes.forEach(n=>{ if(trig(n).kind==='conditions') add(trig(n).all); add(n.effects); (n.choices||[]).forEach(c=>{add(c.requires);add(c.effects);}); }); return s; };
const fileBase=(cat,i)=>String(i+1).padStart(2,'0')+'-'+cat.id;
CATEGORIES.forEach((cat,i)=>{
  const used=varsUsedBy(cat.nodes); const entUsed=new Set(cat.nodes.flatMap(n=>n.refs||[]));
  const idea={
    idea_id:'world_'+cat.id,title:cat.title,
    variables:VARIABLES.filter(v=>used.has(v.id)).map(v=>({id:v.id,name:v.name,type:v.type,start:v.start,min:v.min,max:v.max})),
    nodes:cat.nodes.map(n=>{ const s=storyNode(n,0,0); return {ref:n.ref,title:s.title,text:s.text,type:s.type,category:s.category,eventSource:s.eventSource,
      refs:s.refs,trigger:s.trigger.kind==='start'?{kind:'conditions',all:[]}:s.trigger,effects:s.effects,sim:s.sim,ending:s.ending,
      choices:s.choices.map(c=>({label:c.label,target_ref:c.target,requires:c.requires,effects:c.effects}))}; }),
    entities:ENTITIES.filter(e=>entUsed.has(e.ref)).map(e=>({ref:e.ref,kind:e.kind,name:e.name}))
  };
  fs.writeFileSync(path.join(ROOT,'json',fileBase(cat,i)+'.json'),JSON.stringify(idea,null,2)+'\n');
});

// ---------- md/ по категориям ----------
const varName=id=>(VARIABLES.find(v=>v.id===id)||{}).name||id;
const fmtCond=x=>`${varName(x.var)} ${OPS[x.op]||x.op} ${x.value}`;
const fmtEff=x=>x.op==='set'?`${varName(x.var)} = ${x.value}`:`${varName(x.var)} ${x.op==='add'?'+':'−'}${x.value}`;
const fmtTrig=n=>{ const t=trig(n);
  if(t.kind==='start') return '▶ Старт игры';
  if(t.kind==='scheduled'){ const d=t.afterHours%24===0?`${t.afterHours/24} дн.`:`${t.afterHours} ч`; return `⏱ ${t.repeat?'каждые':'через'} ${d}`; }
  return t.all&&t.all.length?'⚑ '+t.all.map(fmtCond).join(' и '):'после другого события'; };
const nodeTitle=ref=>(nodeById.get(ref)||{}).title||ref;
const entName=ref=>(ENTITIES.find(e=>e.ref===ref)||{}).name||ref;
CATEGORIES.forEach((cat,i)=>{
  const L=[`# ${cat.title}`,'',cat.intro,'',`Пометки: ⭐ решение автора · ✅ из GDD · 💡 предложение · ❓ не решено. Источник правок — \`src/world-data.js\`, этот файл собирается автоматически.`,''];
  cat.nodes.forEach(n=>{
    L.push(`## ${SRC_MARK[n.src]} ${n.title}`,'');
    L.push(`\`${n.ref}\` · ${SOURCE_LABEL[n.source]||'—'} · ${fmtTrig(n)}${n.gdd?` · GDD ${n.gdd}`:''}`,'');
    if(n.text) L.push(n.text,'');
    if(n.refs&&n.refs.length) L.push(`Участвуют: ${n.refs.map(entName).join(', ')}`,'');
    if(n.effects&&n.effects.length) L.push(`**Меняет:** ${n.effects.map(fmtEff).join(' · ')}`,'');
    if(n.choices&&n.choices.length){
      L.push('**Дальше:**');
      n.choices.forEach(c=>{
        const parts=[];
        if(c.requires&&c.requires.length) parts.push('нужно: '+c.requires.map(fmtCond).join(' и '));
        if(c.effects&&c.effects.length) parts.push(c.effects.map(fmtEff).join(' · '));
        L.push(`- ${c.label} → *${nodeTitle(c.target)}*${parts.length?' ('+parts.join('; ')+')':''}`);
      });
      L.push('');
    }
    if(n.ending) L.push(`**Концовка:** \`${n.ending}\``,'');
  });
  fs.writeFileSync(path.join(ROOT,'md',fileBase(cat,i)+'.md'),L.join('\n'));
});
// Переменные и сущности — отдельным MD
const V=['# Мировые переменные и сущности','','Пометки: ⭐ решение автора · ✅ из GDD · 💡 предложение · ❓ не решено.','','## Переменные','','| id | Название | Тип | Старт | Диапазон | Откуда | Заметка |','|---|---|---|---|---|---|---|'];
VARIABLES.forEach(v=>V.push(`| \`${v.id}\` | ${v.name} | ${v.type==='flag'?'флаг':'число'} | ${v.start} | ${v.min}…${v.max} | ${SRC_MARK[v.src]}${v.ref?' '+v.ref:''} | ${v.note||''} |`));
V.push('','## Сущности мира','','| id | Вид | Название | Откуда | Заметка |','|---|---|---|---|---|');
ENTITIES.forEach(e=>V.push(`| \`${e.ref}\` | ${e.kind} | ${e.name} | ${SRC_MARK[e.src]} | ${e.note||''} |`));
V.push('','## Связи','');
RELATIONS.forEach(r=>V.push(`- ${entName(r.from)} — *${r.type}* → ${entName(r.to)}${r.status==='proposed'?' (💡 предложение)':''}${r.comment?' — '+r.comment:''}`));
V.push('','## ⭐ Решения автора','');
DECISIONS.forEach((d,i)=>V.push(`${i+1}. **${d.title}.**${d.status==='tentative'?' *(предварительно)*':''} ${d.text}`));
if(OPEN_QUESTIONS.length) V.push('','## ❓ Открытые вопросы','');
OPEN_QUESTIONS.forEach((q,i)=>V.push(`${i+1}. **${q.title}.** ${q.text}`));
fs.writeFileSync(path.join(ROOT,'md','00-variables-entities.md'),V.join('\n')+'\n');

const counts={gdd:0,idea:0,open:0,user:0}; allNodes.forEach(n=>counts[n.src]++);
console.log(`OK: ${allNodes.length} событий (⭐${counts.user} ✅${counts.gdd} 💡${counts.idea} ❓${counts.open}), ${VARIABLES.length} переменных, ${ENTITIES.length} сущностей, ${RELATIONS.length} связей, ${CATEGORIES.length} категорий`);
