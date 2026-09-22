/* ============================================================
   MODULE 02 — VOCABULARY
   Словари для ПЯТИ каталогов чертежа: Системы, Компоненты (UI), Игровые объекты, Данные —
   авторские (пишутся в модулях 03–09), и Сцены — целиком вычисляются из data/rooms и
   data/buildings проекта (своего словаря не имеют, см. 11-store.js).
   Слои разработки (раздел 40 мастер-документа), разделы каждого каталога, приоритеты,
   статусы, шаги готовности — отдельно под форму каждого каталога.
   ============================================================ */

// Слои разработки — как в мастер-документе (раздел 40)
const LAYERS={1:'Фундамент',2:'Персонаж',3:'Убежище',4:'Мир',5:'Живые NPC',6:'Живой мир',7:'Последствия',8:'Процедурный контент'};

// --- Системы (движок) ---
const SYS_GROUPS=[
  {id:'g_data',name:'Мост данных: редакторы → Godot',layer:1,desc:'Чтение JSON из ОС/Room/Building Editor и превращение его в игровые узлы. Без этого слоя редакторы просто пишут файлы в никуда.'},
  {id:'g_engine',name:'Фундамент движка',layer:1,desc:'Время, события, коллизии, навигация, интеракция, действия — раздел 5 и 33 мастер-документа. Нужен до того, как собирать первую сцену.'},
  {id:'g_char',name:'Персонаж',layer:2,desc:'Управление, движение, потребности, здоровье, инвентарь — раздел 6, 7, 25, 26.'},
  {id:'g_shelter',name:'Убежище',layer:3,desc:'Хранение, вода, энергия, крафт, строительство, ремонт, ферма — раздел 7–15.'},
  {id:'g_world',name:'Мир и сцены',layer:4,desc:'Переходы между сценами, лут, ресурсы, исследование, состояние комнат — раздел 4, 17–20.'},
  {id:'g_npc',name:'Живые NPC',layer:5,desc:'AI, автономность, отношения, мораль, события, группы — раздел 6.4, 22–24, 35.'},
  {id:'g_livingworld',name:'Живой мир',layer:6,desc:'Фракции, симуляция мира без игрока, конфликты, торговля — раздел 21.'},
  {id:'g_conseq',name:'Последствия',layer:7,desc:'Смерть, останки, долгосрочные последствия — раздел 26–27, 36.'},
  {id:'g_proc',name:'Процедурный контент',layer:8,desc:'Рантайм-генерация комнат, зданий, лута, NPC, состояний — раздел 17, 20.'}
];

// --- Компоненты (переиспользуемые UI-сцены Godot) ---
// Список экранов/виджетов в мастер-документе не описан (там игровая механика, не интерфейс) —
// это стартовое предложение по тому, какие экраны нужны механикам раздела 6–27; список правится в игре.
const UI_GROUPS=[
  {id:'ui_atoms',name:'Атомы — мелкие переиспользуемые элементы',desc:'Кнопки, полосы, иконки, всплывающие подсказки — то, из чего собираются карточки и панели.'},
  {id:'ui_cards',name:'Карточки — компактное отображение одной сущности',desc:'Слот предмета, карточка рецепта, персонажа, NPC — переиспользуются в разных панелях.'},
  {id:'ui_panels',name:'Панели — экран одной механики',desc:'Инвентарь, крафт, здоровье, торговля, диалог, карта мира — по одной панели на игровую систему.'},
  {id:'ui_shell',name:'Оболочка — меню и служебные экраны',desc:'Главное меню, пауза, сохранения, настройки — не привязаны к конкретной игровой системе.'}
];

// --- Игровые объекты (базовые классы/сцены Godot, а не конкретные предметы из ОС) ---
// Ровно 17 категорий ОС (01-Object-Constructor-OS.md, раздел «Категории») + corpse (есть в
// дизайн-документе, в ОС ещё не заведена — см. 05-Object-Plan.md, проверка CATEGORY_NEW).
const OBJ_GROUPS=[
  {id:'og_actor',name:'Действующие — двигаются сами',desc:'CHARACTER-физика (см. CAT_DEFAULTS ОС): персонаж, существо.'},
  {id:'og_portable',name:'Переносимые — живут в инвентаре',desc:'DYNAMIC + ANYWHERE, carry=true: предмет, инструмент, оружие, одежда.'},
  {id:'og_placed',name:'Расставляемые — DYNAMIC, стоят на полу',desc:'DYNAMIC + FLOOR_ONLY: мебель, контейнер, верстак, машина, декор, растение.'},
  {id:'og_static',name:'Неподвижные — часть мира (STATIC)',desc:'STATIC: постройка, блок, дверь.'},
  {id:'og_special',name:'Особые',desc:'Точка ресурса, служебный объект, останки.'}
];

// --- Данные (JSON-домены редакторов → Resource-классы Godot) ---
const DATA_GROUPS=[
  {id:'dat_core',name:'Игровые данные',desc:'То, что напрямую становится объектами, комнатами и зданиями в игре.'},
  {id:'dat_support',name:'Служебные данные',desc:'Настройки, справочники и заготовки редакторов — нужны для их корректной работы, не для геймплея напрямую.'}
];

const PRIORITIES=[
  {id:0,label:'P0',name:'P0 — нужно для первого игрового цикла (бункер → вылазка → возвращение)'},
  {id:1,label:'P1',name:'P1 — расширение: живые NPC, крафт, фракции, ремонт'},
  {id:2,label:'P2',name:'P2 — позже: живой мир, процедурный контент, доработки'}
];
const STATUSES=[
  {id:'todo',name:'Не начато'},{id:'wip',name:'В работе'},{id:'done',name:'Готово'},{id:'skip',name:'Отложено'}
];

// Шаги готовности — свой набор под форму каждого каталога.
// auto: 'script'/'scene'/'resource' проверяются наличием файла по item.path; 'autoload' — по project.godot.
const SYS_STEP_DEFS=[
  {id:'script',label:'Скрипт создан по указанному пути',when:i=>true},
  {id:'autoload',label:'Зарегистрирован в Project Settings → Autoload',when:i=>!!i.autoload},
  {id:'api',label:'Публичный API / сигналы продуманы и записаны',when:i=>true},
  {id:'wired',label:'Подключена к системам, которые от неё зависят',when:i=>true},
  {id:'tested',label:'Проверена в игре (не только компилируется)',when:i=>true}
];
const COMP_STEP_DEFS=[
  {id:'scene',label:'.tscn компонента создан по указанному пути',when:i=>true},
  {id:'script',label:'Скрипт компонента подключён (если нужен)',when:i=>true},
  {id:'wired',label:'Подключён к панели/системе, которая его использует',when:i=>true},
  {id:'tested',label:'Проверен в игре с реальными данными',when:i=>true}
];
const OBJ_STEP_DEFS=[
  {id:'scene',label:'Базовая .tscn создана по указанному пути',when:i=>true},
  {id:'script',label:'Скрипт наследует нужный набор компонентов (раздел 33)',when:i=>true},
  {id:'components',label:'Нужные компоненты (Visual/Physics/Inventory/…) подключены',when:i=>true},
  {id:'instantiable',label:'Экземпляр можно создать по object_id из DataRegistry',when:i=>true},
  {id:'tested',label:'Проверен на хотя бы одном реальном объекте из ОС',when:i=>true}
];
const DATA_STEP_DEFS=[
  {id:'schema',label:'Формат данных зафиксирован (см. соответствующий редактор)',when:i=>true},
  {id:'resource',label:'Resource-класс Godot создан по указанному пути',when:i=>true},
  {id:'loader',label:'Загрузчик подключён к системе, которая его использует',when:i=>true},
  {id:'tested',label:'Проверено на реальных файлах из data/',when:i=>true}
];
// Шаги готовности СЦЕНЫ-КОМНАТЫ (data/rooms/<id>.json → .tscn)
const ROOM_STEP_DEFS=[
  {id:'tscn',label:'.tscn сцены существует в папке сцен Godot',when:i=>true},
  {id:'root',label:'Корневой скрипт сцены наследует базовый класс комнаты и берёт данные по id',when:i=>true},
  {id:'navigation',label:'NavigationRegion2D / полигон собран по зелёным зонам',when:i=>true},
  {id:'collision',label:'Коллизии по красным зонам и объектам настроены',when:i=>true},
  {id:'instances',label:'Объекты заспавнены из instances[] через фабрику, а не расставлены руками',when:i=>(i.instCount||0)>0},
  {id:'blocks',label:'Разрушаемые блоки собраны из world.blocks',when:i=>!!i.hasBlocks},
  {id:'doors',label:'Двери подключены к менеджеру переходов (toRoom + точка спавна)',when:i=>(i.doorCount||0)>0},
  {id:'lighting',label:'Источники света расставлены по данным экземпляров',when:i=>!!i.hasLight},
  {id:'background',label:'Фоновые слои с параллаксом подключены',when:i=>(i.bgCount||0)>0},
  {id:'tested',label:'Сцена открыта и пройдена в игре без ошибок',when:i=>true}
];
// Шаги готовности СЦЕНЫ-ЗДАНИЯ/УЛИЦЫ (data/buildings/<id>.json → .tscn)
const BUILDING_STEP_DEFS=[
  {id:'tscn',label:'.tscn сцены существует в папке сцен Godot',when:i=>true},
  {id:'root',label:'Корневой скрипт наследует базовый класс здания/улицы и берёт данные по id',when:i=>true},
  {id:'rooms',label:'Комнаты собираются по rooms[] / sequence[] (позиция, этаж, обрезка)',when:i=>true},
  {id:'doorlinks',label:'Связи дверей (door_links) подключены между комнатами',when:i=>(i.doorLinkCount||0)>0},
  {id:'slots',label:'RANDOM / POOL слоты резолвятся в игре',when:i=>(i.slotCount||0)>0},
  {id:'floors',label:'Переключение между этажами работает',when:i=>(i.floorCount||0)>1},
  {id:'background',label:'Фоны здания подключены',when:i=>(i.bgCount||0)>0},
  {id:'tested',label:'Здание открыто и пройдено в игре',when:i=>true}
];

// Описание каталога: prefix ключа, группы, шаги. Используется генеричным слоем (10-model.js,
// 14-view-catalog.js), чтобы не писать одинаковый код 4 раза.
const CATALOGS={
  system:{id:'system',label:'Системы',labelOne:'Система',prefix:'sys:',groups:SYS_GROUPS,steps:SYS_STEP_DEFS,hasAutoload:true,autoStepId:'script'},
  component:{id:'component',label:'Компоненты',labelOne:'Компонент',prefix:'comp:',groups:UI_GROUPS,steps:COMP_STEP_DEFS,hasAutoload:false,autoStepId:'scene'},
  gameobject:{id:'gameobject',label:'Игровые объекты',labelOne:'Игровой объект',prefix:'obj:',groups:OBJ_GROUPS,steps:OBJ_STEP_DEFS,hasAutoload:false,autoStepId:'scene'},
  data:{id:'data',label:'Данные',labelOne:'Домен данных',prefix:'dat:',groups:DATA_GROUPS,steps:DATA_STEP_DEFS,hasAutoload:false,autoStepId:'resource'}
};
function groupsOf(kind){ return CATALOGS[kind].groups; }
function groupById(kind,id){ return CATALOGS[kind].groups.find(g=>g.id===id); }

// Каталоги пополняются модулями 03–09 через add*([...]) — единая форма записи для всех четырёх:
// id — слаг; n — название; g — раздел своего каталога; p — приоритет 0/1/2;
// why — зачем нужен; fn — что делает/показывает; path — путь файла в Godot (res://…);
// autoload — (только у систем) имя синглтона в Project Settings → Autoload, иначе null;
// req — ключи ДРУГИХ элементов (любого из 4 каталогов, с префиксом 'sys:'/'comp:'/'obj:'/'dat:'),
//       которые должны быть готовы раньше — по ним считаются волны И граф связей;
// reads — какие файлы/папки проекта элемент читает (только для смысла, в граф не идёт);
// blocksScenes — (только у систем) без неё сцены собирать бессмысленно; note — открытый вопрос.
const SYSTEM_ITEMS=[]; function addSystems(list){ list.forEach(i=>SYSTEM_ITEMS.push(i)); }
const COMPONENT_ITEMS=[]; function addComponents(list){ list.forEach(i=>COMPONENT_ITEMS.push(i)); }
const GAMEOBJECT_ITEMS=[]; function addGameObjects(list){ list.forEach(i=>GAMEOBJECT_ITEMS.push(i)); }
const DATA_ITEMS=[]; function addDataDomains(list){ list.forEach(i=>DATA_ITEMS.push(i)); }
