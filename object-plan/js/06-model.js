/* ============================================================
   MODULE 06 — MODEL
   Из каталога (PLAN_ITEMS) + своих объектов (store.custom) строится модель: индексы, обратные связи,
   «волны» создания (что нужно сделать раньше), проверки самого плана.
   Связи:
     req — «сначала создай»: материалы рецепта, инструмент, станция или носитель (из них считаются волны);
     w   — «взаимодействует с»: с кем и чем работает объект в игре (обратная связь считается автоматически).
   ============================================================ */

// Отметки пользователя (localStorage и data/object_plan.json): статусы, шаги, заметки, свои объекты, свои разделы
let store={status:{},steps:{},notes:{},custom:[],customGroups:[]};
let ITEMS=[], BY_ID=new Map();
let REL={neededBy:new Map(), touchedBy:new Map()};   // id → [id] (кто требует этот объект / кто с ним взаимодействует)
let WAVES=[];                                         // WAVES[n] = [item…]
let PLAN_PROBLEMS=[];                                 // {level, code, id, msg}

const CAT_BY_ID=()=>new Map(CATEGORIES.map(c=>[c.id,c]));
// Разделы плана + свои разделы (store.customGroups — добавляются из этого приложения или из image-prep-tool,
// хранятся вместе с остальными отметками в data/object_plan.json). Везде, где раньше читали GROUPS напрямую,
// нужно читать effectiveGroups() — иначе объект в своём разделе получит ошибку «раздела нет в словаре».
function effectiveGroups(){ return GROUPS.concat(Array.isArray(store.customGroups)?store.customGroups:[]); }
const GROUP_BY_ID=()=>new Map(effectiveGroups().map(g=>[g.id,g]));

function normalizeItem(raw,custom){
  const it=Object.assign({p:1,sz:null,wt:0,v:[],os:{},cf:[],pn:[],act:[],req:[],w:[],rooms:[],vis:[],sys:[],why:'',fn:'',use:'',note:'',rc:''},raw);
  it.custom=!!custom;
  ['v','cf','pn','act','req','w','rooms','vis','sys'].forEach(k=>{ if(!Array.isArray(it[k])) it[k]=[]; });
  if(!it.os||typeof it.os!=='object'||Array.isArray(it.os)) it.os={};
  const d=CAT_DEFAULTS[it.c]||{ph:'STATIC',pl:'ANYWHERE'};
  it.phEff=it.ph||d.ph; it.plEff=it.pl||d.pl; it.carry=!!d.carry;
  const g=effectiveGroups().find(x=>x.id===it.g); it.layer=g?g.layer:0;
  it.search=[it.id,it.n,it.c,it.s,it.g,(it.sys||[]).join(' '),(it.rooms||[]).join(' '),it.why,it.fn,(it.v||[]).join(' ')].join(' ').toLowerCase();
  return it;
}


/* ---------- Поля ОС объекта ----------
   osValues(it) — все значения по ключам полей ОС: сначала выводятся из данных объекта (размер, вес, физика, группа,
   действия, состояния, типы комнат, рецепт), затем поверх кладётся it.os (свои значения и переопределения).
   osRows(it)  — те же значения, разложенные по вкладкам ОС в порядке OS_FIELDS: русское название поля + английское значение. */
const CYR=/[А-Яа-яЁё]/;
function osValues(it){
  const m={};
  m.id=it.id; m.name=it.n; m.category=it.c; m.subtype=it.s||'';
  if(it.carry) m.carryable=true;
  if(it.rooms.length) m.placeable=true;
  if(it.sz){ m.realWidthCm=it.sz[0]; m.realHeightCm=it.sz[1]; }
  m.placementMode=it.plEff; if(it.vg) m.variantGroup=it.vg; if(it.rooms.length) m.allowedRoomTypes=it.rooms.slice();
  m.physics=it.phEff;
  if(it.act.length){ m.interactive=true; m.actions=it.act.slice(); }
  if(it.wt){ m.hasWeight=true; m.weight=it.wt; }
  if(it.vis.length){ m.animated=true; m.states=it.vis.slice(); }
  if(it.rc){ m.crafting=true; m.recipe=it.rc.split(';')[0].trim(); }
  Object.keys(it.os||{}).forEach(k=>{ m[k]=it.os[k]; });
  return m;
}
function osFmtValue(kind,v){
  if(kind==='bool') return v?'true':'false';
  if(kind==='list') return (v||[]).join(', ');
  if(kind==='drops') return (v||[]).map(r=>r.join('; ')).join('\n');
  return String(v);
}
function osRows(it){
  const m=osValues(it), rows=[];
  Object.keys(OS_FIELDS).forEach(k=>{
    if(!(k in m)) return;
    const v=m[k], f=OS_FIELDS[k];
    if(f[2]==='bool'&&!v&&k!=='destructible') return;           // флажки по умолчанию выключены — «false» не выводим
    if((f[2]==='list'||f[2]==='drops')&&!(v||[]).length) return;
    rows.push({tab:f[0],key:k,label:f[1],sec:f[3]||'',kind:f[2],raw:v,text:osFmtValue(f[2],v)});
  });
  // настройки действий: «ДЕЙСТВИЕ.поле» — вкладка «Действия», после общих полей вкладки
  const acts=[];
  Object.keys(m).forEach(k=>{ const p=k.split('.'); if(p.length===2&&OS_ACTION_FIELDS[p[1]]) acts.push({tab:'actions',key:k,label:OS_ACTION_FIELDS[p[1]][0],sec:'Действие '+p[0],kind:OS_ACTION_FIELDS[p[1]][1],raw:m[k],text:String(m[k])}); });
  const ord=k=>Object.keys(OS_ACTION_FIELDS).indexOf(k.split('.')[1]);
  acts.sort((a,b)=>a.key.split('.')[0].localeCompare(b.key.split('.')[0])||ord(a.key)-ord(b.key));
  const at=rows.reduce((n,r,i)=>r.tab==='actions'?i+1:n,-1);
  if(acts.length){ if(at>=0) rows.splice(at,0,...acts); else rows.push(...acts); }
  return rows;
}

function buildModel(){
  ITEMS=[]; BY_ID=new Map(); PLAN_PROBLEMS=[];
  const seen=new Set();
  PLAN_ITEMS.forEach(r=>{ const it=normalizeItem(r,false); if(seen.has(it.id)) PLAN_PROBLEMS.push({level:'err',code:'ID_DUP',id:it.id,msg:'Повторяется id в каталоге плана.'}); seen.add(it.id); ITEMS.push(it); BY_ID.set(it.id,it); });
  (store.custom||[]).forEach(r=>{ const it=normalizeItem(r,true); if(BY_ID.has(it.id)){ PLAN_PROBLEMS.push({level:'err',code:'ID_DUP',id:it.id,msg:'Свой объект повторяет id объекта каталога.'}); return; } ITEMS.push(it); BY_ID.set(it.id,it); });

  // обратные связи
  REL={neededBy:new Map(), touchedBy:new Map()};
  ITEMS.forEach(i=>{ REL.neededBy.set(i.id,[]); REL.touchedBy.set(i.id,[]); });
  ITEMS.forEach(i=>{
    i.req.forEach(r=>{ if(REL.neededBy.has(r)) REL.neededBy.get(r).push(i.id); });
    i.w.forEach(r=>{ if(REL.touchedBy.has(r)&&!REL.touchedBy.get(r).includes(i.id)) REL.touchedBy.get(r).push(i.id); });
  });

  // волны: 0 — ничего не требует; иначе 1 + максимум по требованиям
  const memo=new Map(), stack=new Set(); let cyc=new Set();
  function wave(id){
    if(memo.has(id)) return memo.get(id);
    if(stack.has(id)){ cyc.add(id); return 0; }
    stack.add(id);
    const it=BY_ID.get(id); let w=0;
    it.req.forEach(r=>{ if(BY_ID.has(r)&&r!==id) w=Math.max(w,wave(r)+1); });
    stack.delete(id); memo.set(id,w); return w;
  }
  ITEMS.forEach(i=>{ i.wave=wave(i.id); i.cyclic=cyc.has(i.id); });
  WAVES=[]; ITEMS.forEach(i=>{ (WAVES[i.wave]=WAVES[i.wave]||[]).push(i); });
  for(let k=0;k<WAVES.length;k++) if(!WAVES[k]) WAVES[k]=[];

  checkPlan(cyc);
}

function checkPlan(cyc){
  const add=(level,code,id,msg)=>PLAN_PROBLEMS.push({level,code,id,msg});
  const cats=CAT_BY_ID(), groups=GROUP_BY_ID(), systems=new Set(SYSTEMS.map(s=>s.id)), rooms=new Set(ROOM_TYPES.map(r=>r.id)), acts=new Set(ACTIONS);
  ITEMS.forEach(i=>{
    if(!/^[a-z0-9_\-]+$/.test(i.id)) add('warn','ID_SLUG',i.id,'id должен состоять из a-z, 0-9, _ и - (как в ОС).');
    if(!cats.has(i.c)) add('err','CATEGORY',i.id,`Категории «${i.c}» нет в словаре (02-vocab.js).`);
    else if(cats.get(i.c).needsNew) add('info','CATEGORY_NEW',i.id,`Категория «${i.c}» ещё не создана в ОС — ${cats.get(i.c).note}`);
    if(!groups.has(i.g)) add('err','GROUP',i.id,`Раздела «${i.g}» нет в словаре.`);
    if(!i.custom){
      if(!i.why) add('warn','NO_WHY',i.id,'Не написано, зачем нужен объект.');
      if(!i.fn) add('warn','NO_FN',i.id,'Не описана функциональная способность.');
      if(!i.use) add('warn','NO_USE',i.id,'Не описано, для чего он полезен.');
      if(!i.v.length) add('info','NO_VARIANTS',i.id,'Нет вариаций.');
      if(!i.sz&&!['building','decor'].includes(i.c)) add('info','NO_SIZE',i.id,'Не указан рекомендуемый размер (см).');
    }
    i.req.forEach(r=>{ const q=BY_ID.get(r); if(q&&q.p>i.p) add('warn','PRIORITY_REQ',i.id,`Приоритет P${i.p}, но требует «${q.n}» с приоритетом P${q.p} — сначала нужно сделать материал, поднимите ему приоритет.`); });
    i.req.forEach(r=>{ if(!BY_ID.has(r)) add('err','REQ_MISSING',i.id,`req: объекта «${r}» нет в плане.`); if(r===i.id) add('err','REQ_SELF',i.id,'Объект требует сам себя.'); });
    i.w.forEach(r=>{ if(!BY_ID.has(r)) add('err','WITH_MISSING',i.id,`w (взаимодействует): объекта «${r}» нет в плане.`); });
    i.sys.forEach(s=>{ if(!systems.has(s)) add('warn','SYSTEM',i.id,`Система «${s}» не описана в словаре.`); });
    i.rooms.forEach(r=>{ if(!rooms.has(r)) add('warn','ROOM_TYPE',i.id,`Тип комнаты «${r}» не описан в словаре.`); });
    i.act.forEach(a=>{ if(!acts.has(a)) add('warn','ACTION',i.id,`Действие «${a}» не входит в список действий ОС.`); });
    if(i.cyclic) add('err','CYCLE',i.id,'Объект участвует в цикле требований (req) — волны создания не определены.');
    if(i.c==='block'&&!(i.os.blockHardness>0)) add('warn','BLOCK_HARDNESS',i.id,'У блока не указана твёрдость (поле «Твёрдость»).');
    if(i.c==='block'&&i.os.blockDrops===undefined) add('info','BLOCK_DROPS',i.id,'У блока не указана добыча (поле «Что даёт один кусок»; пустой список — добычи нет).');
    checkOsFields(i,add);
  });
}

// Проверка полей ОС объекта: известные ключи, допустимые значения, существующие id, английские значения
function checkOsFields(i,add){
  const ref=(what,id)=>{ if(id&&!BY_ID.has(id)) add('err','OS_REF',i.id,`${what}: объекта «${id}» нет в плане.`); };
  const lang=(what,v)=>{ if(typeof v==='string'&&CYR.test(v)) add('warn','OS_LANG',i.id,`${what}: значение «${v}» написано по-русски — в ОС значения вводятся по-английски.`); };
  Object.keys(i.os).forEach(k=>{
    const p=k.split('.'), v=i.os[k];
    let kind, label;
    if(p.length===2){
      if(!OS_ACTION_FIELDS[p[1]]) return add('err','OS_KEY',i.id,`Неизвестная настройка действия «${k}».`);
      if(!ACTIONS.includes(p[0])) return add('err','OS_KEY',i.id,`Действия «${p[0]}» нет в списке ОС («${k}»).`);
      if(!i.act.includes(p[0])) add('warn','OS_ACTION',i.id,`Настройка «${k}», но действия ${p[0]} нет в списке действий объекта.`);
      kind=OS_ACTION_FIELDS[p[1]][1]; label=k;
    } else {
      const f=OS_FIELDS[k]; if(!f) return add('err','OS_KEY',i.id,`Неизвестное поле ОС «${k}» (см. OS_FIELDS в 02-vocab.js).`);
      kind=f[2]; label=f[1];
    }
    if(OS_ENUMS[k]&&!OS_ENUMS[k].includes(v)) add('err','OS_ENUM',i.id,`${label}: значение «${v}» не подходит; допустимо: ${OS_ENUMS[k].join(' / ')}.`);
    if(kind==='ref') ref(label,v);
    if(kind==='skill'&&!OS_SKILLS.includes(v)) add('warn','OS_SKILL',i.id,`${label}: навыка «${v}» нет среди навыков ОС; можно ввести свой в ОС.`);
    if(kind==='drops') (v||[]).forEach(r=>{ ref(label,r[0]); if(!(r[1]>0&&r[1]<=100)) add('warn','OS_DROP',i.id,`${label}: шанс ${r[1]} % вне 0…100.`); if(r[2]>r[3]) add('warn','OS_DROP',i.id,`${label}: «от» больше «до» у ${r[0]}.`); });
    if(kind==='str'||kind==='enum') lang(label,v);
    if(kind==='num'&&typeof v!=='number') add('warn','OS_VALUE',i.id,`${label}: ожидается число, а не «${v}».`);
  });
  if(i.os.resourceType&&!OS_RESOURCE_CATS.includes(i.c)) add('warn','OS_RESOURCE_CAT',i.id,'Ресурс ОС сохраняет только у категорий «Точка ресурса» и «Контейнер» — используйте свои поля (resource_type, resource_max).');
  const keys=new Set();
  i.cf.forEach(f=>{
    const [k,v,d]=f;
    if(!/^[a-z][a-z0-9_]*$/.test(k||'')) add('warn','CF_KEY',i.id,`Своё поле «${k}»: имя — по-английски, a-z, 0-9 и _ (как locked, temperature_resistance).`);
    if(keys.has(k)) add('warn','CF_DUP',i.id,`Своё поле «${k}» указано дважды.`); keys.add(k);
    if(typeof v==='string'&&CYR.test(v)) add('warn','OS_LANG',i.id,`Своё поле «${k}»: значение «${v}» написано по-русски.`);
    if(!d) add('info','CF_NOTE',i.id,`У своего поля «${k}» нет описания.`);
  });
  if(i.rc&&CYR.test(i.rc)) add('warn','OS_LANG',i.id,'Рецепт (rc) должен состоять из id объектов, без русских слов.');
}
