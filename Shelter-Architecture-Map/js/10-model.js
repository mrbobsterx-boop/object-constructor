/* ============================================================
   MODULE 10 — MODEL (ЧЕТЫРЕ АВТОРСКИХ КАТАЛОГА + ЕДИНЫЙ ГРАФ)
   Системы, Компоненты, Игровые объекты и Данные — четыре каталога одной формы: из
   *_ITEMS (модули 03–09) + своих элементов (store.custom[kind]) строится модель:
   индексы, единый граф связей поверх ВСЕХ каталогов сразу (req может указывать на элемент
   любого из них — ключ с префиксом sys:/comp:/obj:/dat:), «волны» постройки, проверки.
   Модель Сцен (комнат/зданий) отдельная — у неё нет статического каталога, она целиком
   приходит из чтения проекта (11-store.js), поэтому в общий граф req не участвует.
   ============================================================ */

let store={status:{},steps:{},notes:{},custom:{system:{},component:{},gameobject:{},data:{}},settings:{}};

let SYSTEMS=[], SYS_BY_ID=new Map();
let COMPONENTS=[], COMP_BY_ID=new Map();
let GAMEOBJECTS=[], OBJ_BY_ID=new Map();
let DOMAINS=[], DOM_BY_ID=new Map();
let BY_KEY=new Map();            // ключ ('sys:x' / 'comp:x' / 'obj:x' / 'dat:x') → элемент, все 4 каталога сразу
let REL={neededBy:new Map()};    // ключ → [ключ…] элементов, которые требуют его раньше
let WAVES=[];                     // WAVES[n] = [элемент…] из любых каталогов
let PLAN_PROBLEMS=[];             // {level, code, id (ключ), msg}

const RAW_BY_KIND={system:SYSTEM_ITEMS,component:COMPONENT_ITEMS,gameobject:GAMEOBJECT_ITEMS,data:DATA_ITEMS};
const LIST_SETTERS={
  system:(l,m)=>{ SYSTEMS=l; SYS_BY_ID=m; },
  component:(l,m)=>{ COMPONENTS=l; COMP_BY_ID=m; },
  gameobject:(l,m)=>{ GAMEOBJECTS=l; OBJ_BY_ID=m; },
  data:(l,m)=>{ DOMAINS=l; DOM_BY_ID=m; }
};

function normalizeAuthored(kind,raw,custom){
  const it=Object.assign({p:1,req:[],reads:[],path:'',autoload:null,note:''},raw);
  it.custom=!!custom; it.kind=kind; it.key=CATALOGS[kind].prefix+it.id;
  if(!Array.isArray(it.req)) it.req=[];
  if(!Array.isArray(it.reads)) it.reads=[];
  it.search=[it.id,it.n,it.g,it.why,it.fn,it.path,it.req.join(' ')].join(' ').toLowerCase();
  return it;
}
function buildCatalog(kind){
  const list=[], byId=new Map(), seen=new Set();
  RAW_BY_KIND[kind].forEach(r=>{
    const it=normalizeAuthored(kind,r,false);
    if(seen.has(it.id)) PLAN_PROBLEMS.push({level:'err',code:'ID_DUP',id:it.key,msg:`Повторяется id в каталоге «${CATALOGS[kind].label}».`});
    seen.add(it.id); list.push(it); byId.set(it.id,it);
  });
  Object.values(store.custom[kind]||{}).forEach(r=>{
    const it=normalizeAuthored(kind,r,true);
    if(byId.has(it.id)){ PLAN_PROBLEMS.push({level:'err',code:'ID_DUP',id:it.key,msg:`Свой элемент повторяет id элемента каталога «${CATALOGS[kind].label}».`}); return; }
    list.push(it); byId.set(it.id,it);
  });
  LIST_SETTERS[kind](list,byId);
}

function buildModel(){
  PLAN_PROBLEMS=[];
  Object.keys(CATALOGS).forEach(buildCatalog);

  BY_KEY=new Map();
  [...SYSTEMS,...COMPONENTS,...GAMEOBJECTS,...DOMAINS].forEach(it=>BY_KEY.set(it.key,it));

  REL={neededBy:new Map()};
  BY_KEY.forEach((it,key)=>REL.neededBy.set(key,[]));
  BY_KEY.forEach((it,key)=>{ it.req.forEach(r=>{ if(REL.neededBy.has(r)) REL.neededBy.get(r).push(key); }); });

  // волны: 0 — ничего не требует; иначе 1 + максимум по требованиям (граф общий на все 4 каталога)
  const memo=new Map(), stack=new Set(); let cyc=new Set();
  function wave(key){
    if(memo.has(key)) return memo.get(key);
    if(stack.has(key)){ cyc.add(key); return 0; }
    stack.add(key);
    const it=BY_KEY.get(key); let w=0;
    it.req.forEach(r=>{ if(BY_KEY.has(r)&&r!==key) w=Math.max(w,wave(r)+1); });
    stack.delete(key); memo.set(key,w); return w;
  }
  BY_KEY.forEach((it,key)=>{ it.wave=wave(key); it.cyclic=cyc.has(key); });
  WAVES=[]; BY_KEY.forEach(it=>{ (WAVES[it.wave]=WAVES[it.wave]||[]).push(it); });
  for(let k=0;k<WAVES.length;k++) if(!WAVES[k]) WAVES[k]=[];

  checkCatalogs();
}

function checkCatalogs(){
  const add=(level,code,key,msg)=>PLAN_PROBLEMS.push({level,code,id:key,msg});
  BY_KEY.forEach((it,key)=>{
    if(!/^[a-z0-9_\-]+$/.test(it.id)) add('warn','ID_SLUG',key,'id должен состоять из a-z, 0-9, _ и - (как имя файла Godot).');
    if(!groupById(it.kind,it.g)) add('err','GROUP',key,`Раздела «${it.g}» нет в словаре каталога «${CATALOGS[it.kind].label}».`);
    if(!it.custom){
      if(!it.why) add('warn','NO_WHY',key,'Не написано, зачем нужен элемент.');
      if(!it.fn) add('warn','NO_FN',key,'Не описано, что элемент делает.');
      if(!it.path) add('info','NO_PATH',key,'Не указан предполагаемый путь файла.');
    }
    it.req.forEach(r=>{
      if(!BY_KEY.has(r)) add('err','REQ_MISSING',key,`req: элемента «${r}» нет ни в одном каталоге.`);
      if(r===key) add('err','REQ_SELF',key,'Элемент требует сам себя.');
    });
    if(it.cyclic) add('err','CYCLE',key,'Элемент участвует в цикле требований (req) — волны постройки не определены.');
  });
}
