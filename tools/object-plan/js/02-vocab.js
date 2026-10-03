/* ============================================================
   MODULE 02 — VOCABULARY
   Словари плана: категории ОС, разделы, системы игры, типы комнат, действия, приоритеты, статусы, шаги.
   Всё, на что ссылаются объекты плана (модули 03–05), должно быть определено здесь.
   ============================================================ */

// Категории ОС (id = category в data/objects). needsNew — категории, которых пока нет в ОС.
const CATEGORIES=[
  {id:'character',name:'Персонаж'},{id:'creature',name:'Существо'},{id:'item',name:'Предмет'},{id:'tool',name:'Инструмент'},
  {id:'weapon',name:'Оружие'},{id:'clothing',name:'Одежда'},{id:'furniture',name:'Мебель'},{id:'decor',name:'Декор'},
  {id:'container',name:'Контейнер'},{id:'workbench',name:'Верстак'},{id:'machine',name:'Машина'},
  {id:'building',name:'Строительный объект'},{id:'block',name:'Блок / материал'},{id:'door',name:'Дверь'},
  {id:'plant',name:'Растение'},{id:'resource',name:'Точка ресурса'},{id:'special',name:'Специальный'},
  {id:'corpse',name:'Останки',needsNew:true,note:'Есть в дизайн-документе (раздел 11), в ОС такой категории нет — добавь её в CAT_LABELS, кнопки и STANDARD_ANIMATIONS, либо временно используй special.'}
];
// Категории, для которых редактор по умолчанию ставит физику/размещение (см. ОС «Поведение»)
const CAT_DEFAULTS={
  item:{ph:'DYNAMIC',pl:'ANYWHERE',carry:true}, tool:{ph:'DYNAMIC',pl:'ANYWHERE',carry:true}, weapon:{ph:'DYNAMIC',pl:'ANYWHERE',carry:true},
  clothing:{ph:'DYNAMIC',pl:'ANYWHERE',carry:true}, furniture:{ph:'DYNAMIC',pl:'FLOOR_ONLY'}, container:{ph:'DYNAMIC',pl:'FLOOR_ONLY'},
  workbench:{ph:'DYNAMIC',pl:'FLOOR_ONLY'}, machine:{ph:'DYNAMIC',pl:'FLOOR_ONLY'}, decor:{ph:'DYNAMIC',pl:'ANYWHERE'},
  building:{ph:'STATIC',pl:'ANYWHERE'}, door:{ph:'STATIC',pl:'ANYWHERE'}, block:{ph:'STATIC',pl:'ANYWHERE'}, plant:{ph:'STATIC',pl:'ANYWHERE'},
  resource:{ph:'STATIC',pl:'ANYWHERE'}, special:{ph:'STATIC',pl:'ANYWHERE'}, character:{ph:'CHARACTER',pl:'FLOOR_ONLY'},
  creature:{ph:'CHARACTER',pl:'FLOOR_ONLY'}, corpse:{ph:'DYNAMIC',pl:'FLOOR_ONLY'}
};

// Разделы (группы) плана; layer — слой разработки из дизайн-документа (раздел 40)
const GROUPS=[
  {id:'home',name:'Убежище: жильё и быт',layer:3,desc:'Сон, свет, время и уют. Без этого комнаты убежища пустые, а потребности персонажей не закрыты.'},
  {id:'water',name:'Вода',layer:3,desc:'Добыча, хранение, очистка и распределение воды. Вода — ресурс-количество внутри объекта (литры), а не предмет.'},
  {id:'energy',name:'Энергия и топливо',layer:3,desc:'Производство, хранение и потребление энергии; топливо. Баланс «приход − расход» показывает панель убежища.'},
  {id:'food',name:'Еда и кухня',layer:3,desc:'Готовая и сырая еда, приготовление, порча. Еда — обычные предметы единой системы хранения.'},
  {id:'medicine',name:'Медицина',layer:3,desc:'Лечение работает по требованиям (treat = bleeding и т.п.): персонаж ищет подходящий предмет, а не конкретную аптечку.'},
  {id:'storage',name:'Хранение и контейнеры',layer:3,desc:'Одна система хранения для шкафов, ящиков, сейфов и рюкзаков; лут зависит от типа комнаты и состояния.'},
  {id:'production',name:'Производство: верстаки и станки',layer:3,desc:'Крафт, ремонт и разборка. Рецепты хранятся данными: вход, инструмент, верстак, время, результат.'},
  {id:'farm',name:'Растения и ферма',layer:3,desc:'Растения — объекты мира со стадиями роста (не количество ресурса); семена, грунт и вода — ресурсы.'},
  {id:'tools',name:'Инструменты',layer:2,desc:'Инструмент — условие действия (requirements). Копание блоков, рубка, ремонт, вскрытие — всё через инструменты.'},
  {id:'weapons',name:'Оружие и боеприпасы',layer:2,desc:'Ближний и дальний бой, шум выстрела, износ. Оружие — экипировка с анимациями aim/attack/reload.'},
  {id:'clothes',name:'Одежда и экипировка',layer:2,desc:'Слоты экипировки, защита, вес, влияние на внешний вид (части Assembler) и выпадение при смерти.'},
  {id:'materials',name:'Материалы и компоненты',layer:3,desc:'Технические ресурсы для строительства, ремонта и крафта; добыча из блоков и разборки.'},
  {id:'blocks',name:'Блоки: грунт и стены',layer:4,desc:'Категория «Блок / материал»: куски 20×20 см ломаются по одному, твёрдость, инструмент, добыча. Основа копания и стен.'},
  {id:'structures',name:'Постройки, двери, лестницы',layer:4,desc:'Физические переходы между сценами и укрепления. Постройки остаются на месте (physics STATIC).'},
  {id:'world',name:'Мир: город и дорога',layer:4,desc:'Объекты внешнего мира: указатели-переходы, машины, мусор, точки добычи. Наполняют улицы и здания лутом.'},
  {id:'people',name:'Люди и существа',layer:5,desc:'Выжившие, зомби, рейдеры, животные: личности с потребностями, восприятием, автономностью и инвентарём.'},
  {id:'death',name:'Смерть и последствия',layer:7,desc:'Смерть постоянна: останки, инвентарь, обыск, перенос, похороны, сожжение, разложение.'},
  {id:'factions',name:'Фракции и торговля',layer:6,desc:'Объекты, по которым видно живой мир: лагеря, знамёна, склады, торговля, доски заданий.'},
  {id:'special',name:'Сюжет и служебные',layer:6,desc:'Записки, карты и служебные объекты для сюжета и интерфейса убежища.'}
];
const LAYERS={1:'Фундамент',2:'Персонаж',3:'Убежище',4:'Мир',5:'Живые NPC',6:'Живой мир',7:'Последствия',8:'Процедурный контент'};

// Системы игры (теги)
const SYSTEMS=[
  {id:'needs',name:'Потребности'},{id:'water',name:'Вода'},{id:'energy',name:'Энергия'},{id:'food',name:'Еда'},{id:'health',name:'Здоровье и лечение'},
  {id:'storage',name:'Хранение'},{id:'loot',name:'Лут и контейнеры'},{id:'crafting',name:'Крафт'},{id:'building',name:'Строительство'},{id:'repair',name:'Ремонт и износ'},
  {id:'farming',name:'Ферма'},{id:'digging',name:'Копание блоков'},{id:'combat',name:'Бой'},{id:'exploration',name:'Исследование'},
  {id:'time',name:'Игровое время'},{id:'light',name:'Свет'},{id:'sound',name:'Звук и шум'},{id:'death',name:'Смерть'},
  {id:'factions',name:'Фракции'},{id:'trade',name:'Торговля'},{id:'rooms',name:'Генерация комнат'},{id:'transitions',name:'Переходы между сценами'},
  {id:'physics',name:'Физика и нагрузка'},{id:'story',name:'Сюжет'},{id:'ai',name:'Автономность NPC'},{id:'equipment',name:'Экипировка'}
];
// Типы комнат (для генерации: обязательные и дополнительные объекты)
const ROOM_TYPES=[
  {id:'shelter_living',name:'Жилая комната убежища'},{id:'bedroom',name:'Спальня'},{id:'kitchen',name:'Кухня'},{id:'bathroom',name:'Ванная'},
  {id:'workshop',name:'Мастерская'},{id:'storage',name:'Склад'},{id:'medical',name:'Медпункт'},{id:'machine_room',name:'Машинное (энергия)'},
  {id:'water_room',name:'Водная / насосная'},{id:'greenhouse',name:'Оранжерея'},{id:'garage',name:'Гараж'},{id:'shop',name:'Магазин'},
  {id:'office',name:'Офис'},{id:'house_living',name:'Жилая комната дома'},{id:'street',name:'Улица'},{id:'entrance',name:'Вход / шлюз'},
  {id:'camp',name:'Лагерь фракции'}
];
const ACTIONS=['USE','TAKE','DROP','OPEN','CLOSE','SLEEP','EAT','DRINK','CRAFT','REPAIR','BUILD','DISMANTLE','HARVEST','ATTACK','EQUIP','UNEQUIP','TALK','SEARCH','STORE','TAKE_FROM'];

const PRIORITIES=[
  {id:0,label:'P0',name:'P0 — нужно для первого игрового цикла (бункер → вылазка → возвращение)'},
  {id:1,label:'P1',name:'P1 — расширение: крафт, ферма, фракции, ремонт'},
  {id:2,label:'P2',name:'P2 — позже: редкое, вариативность, украшения'}
];
const STATUSES=[
  {id:'todo',name:'Не начато'},{id:'wip',name:'В работе'},{id:'done',name:'Готово'},{id:'skip',name:'Отложено'}
];
// Шаги готовности объекта. auto — можно определить по проекту; when — когда шаг нужен объекту
const STEP_DEFS=[
  {id:'image',label:'Картинка нарисована и вставлена в ОС',when:i=>true},
  {id:'params',label:'Размер (см) и параметры заданы в ОС',when:i=>true},
  {id:'actions',label:'Действия и требования настроены (вкладка «Действия»)',when:i=>(i.act||[]).length>0},
  {id:'visuals',label:'Состояния / анимации добавлены (вкладка «Анимации»)',when:i=>(i.vis||[]).length>0},
  {id:'recipe',label:'Рецепт крафта задан (вкладка «Крафт»)',when:i=>!!i.rc},
  {id:'material',label:'Материал блока: твёрдость, инструмент, добыча (вкладка «Материал»)',when:i=>i.c==='block'},
  {id:'saved',label:'Сохранён в проект (data/objects)',when:i=>true},
  {id:'used',label:'Используется: стоит в комнате, лежит блоком, есть в рецепте или добыче',when:i=>true}
];

/* ============================================================
   ПОЛЯ ОС. Названия — русские, как на вкладках ОС; значения — только английские
   (enum, числа, id объектов), потому что их копируют в ОС.
   Ключ = id поля в ОС (index.html). Порядок = порядок вывода внутри вкладки.
   [вкладка, название поля, тип, раздел на вкладке (необязательно)]
   ============================================================ */
const OS_TABS=[
  {id:'basic',name:'Основное'},{id:'behavior',name:'Поведение'},{id:'actions',name:'Действия'},{id:'inventory',name:'Инвентарь'},
  {id:'crafting',name:'Крафт'},{id:'animation',name:'Анимации'},{id:'destruction',name:'Разрушение'},{id:'material',name:'Материал'}
];
const OS_FIELDS={
  id:['basic','ID','str'], name:['basic','Название','str'], category:['basic','Категория','str'], subtype:['basic','Подтип','str'],

  carryable:['behavior','Может быть перемещён (поднять/нести)','bool'], placeable:['behavior','Может быть размещён','bool'],
  realWidthCm:['behavior','Реальная ширина (см, целое число)','num'], realHeightCm:['behavior','Реальная высота (см, целое число)','num'],
  placementMode:['behavior','Расположение в мире (для Room Editor)','enum'], variantGroup:['behavior','Группа взаимозаменяемости','str'],
  allowedRoomTypes:['behavior','Разрешённые типы комнат','list'],
  collision:['behavior','Столкновение','enum'], physics:['behavior','Физика','enum'], interactive:['behavior','Интерактивный','bool'],
  hasWeight:['behavior','Имеет собственный вес','bool'], weight:['behavior','Вес','num'],
  emitsLight:['behavior','Излучает свет','bool'], lightRadius:['behavior','Радиус света (м)','num'], lightColor:['behavior','Цвет света','str'],
  lightIntensity:['behavior','Интенсивность (%)','num'], lightShape:['behavior','Форма света','enum'],
  lightAngle:['behavior','Направление (градусы, 90 = вниз, 0 = вправо)','num'], lightSpread:['behavior','Раскрытие конуса (градусы)','num'],
  lightSoftness:['behavior','Размытие краёв (%)','num'],
  castsShadow:['behavior','Отбрасывает тень','bool'], shadowAbsorption:['behavior','Поглощение света (%)','num'],
  needFood:['behavior','Есть потребность в еде','bool','Потребности'], needWater:['behavior','Есть потребность в воде','bool','Потребности'],
  needSleep:['behavior','Нужен сон','bool','Потребности'], needHealth:['behavior','Учитывается здоровье','bool','Потребности'],
  needStress:['behavior','Испытывает стресс','bool','Потребности'],
  thirstDecayRate:['behavior','Скорость уменьшения (в игровой час)','num','Потребность в воде'],
  thirstWantThreshold:['behavior','Порог «хочет пить»','num','Потребность в воде'],
  thirstCriticalThreshold:['behavior','Критический порог','num','Потребность в воде'],
  autonomyEnabled:['behavior','Автономен','bool','Автономность'], autonomySatisfyNeeds:['behavior','Сам удовлетворяет потребности','bool','Автономность'],
  autonomySearchWater:['behavior','Может сам искать воду','bool','Автономность'], autonomySearchFood:['behavior','Может сам искать еду','bool','Автономность'],
  autonomySleep:['behavior','Может сам спать','bool','Автономность'],
  visionEnabled:['behavior','Видит','bool','Восприятие'], visionRange:['behavior','Дальность зрения (м)','num','Восприятие'],
  hearingEnabled:['behavior','Слышит звуки','bool','Восприятие'], hearingRange:['behavior','Дальность слуха (м)','num','Восприятие'],
  canMove:['behavior','Может перемещаться (сам, своим ходом)','bool','Перемещение'], moveSpeed:['behavior','Скорость движения (м/с)','num','Перемещение'],
  dangerReacts:['behavior','Реагирует на опасность','bool','Реакция на опасность'], dangerCanFlee:['behavior','Может убегать','bool','Реакция на опасность'],
  dangerCanHide:['behavior','Может прятаться','bool','Реакция на опасность'],
  makesSounds:['behavior','Издаёт звуки','bool','Звук'],

  actions:['actions','Действия','list'],
  dealsDamage:['actions','Наносит урон','bool','Урон / Защита / Износ'], damageAmount:['actions','Урон за удар','num','Урон / Защита / Износ'],
  providesDefense:['actions','Защита от урона','bool','Урон / Защита / Износ'], defenseAmount:['actions','+Единиц защиты','num','Урон / Защита / Износ'],
  wearsOut:['actions','Изнашивается при использовании','bool','Урон / Защита / Износ'], wearAmount:['actions','Износ за одно применение','num','Урон / Защита / Износ'],
  wearLifetimeDays:['actions','Срок службы (игровые дни)','num','Урон / Защита / Износ'],

  hasInventory:['inventory','Есть инвентарь','bool'], slots:['inventory','Количество слотов','num'], maxWeight:['inventory','Макс. масса','num'],
  storage:['inventory','Тип хранения','enum'],
  resourceType:['inventory','Тип ресурса','str','Ресурс'], resourceMax:['inventory','Макс. объём','num','Ресурс'], resourceInitial:['inventory','Начальный объём','num','Ресурс'],
  resourceState:['inventory','Начальное состояние','str','Ресурс'], resourceSource:['inventory','Источник пополнения','str','Ресурс'],
  resourceRecoveryHours:['inventory','Самоочищение (игровых часов)','num','Ресурс'],

  crafting:['crafting','Участвует в крафте','bool'], recipe:['crafting','Рецепт (сетка 5×3: одна ячейка = один предмет)','str'],

  animated:['animation','Есть анимации','bool'], animSource:['animation','Источник анимаций','enum'], states:['animation','Визуальные состояния (имена)','list'],
  animSoundEnabled:['animation','Издаёт звук','bool','Звук'], animSoundRadius:['animation','Радиус слышимости (м)','num','Звук'],

  destructible:['destruction','Разрушаемый','bool'], hp:['destruction','HP','num'],
  onDestroy_REMOVE:['destruction','Убрать','bool'], onDestroy_REMAINS:['destruction','Остаются останки','bool'],
  onDestroy_DROP_ITEMS:['destruction','Роняет предметы','bool'], onDestroy_LOOTABLE:['destruction','Можно обыскать/собрать','bool'],
  onDestroy_MOVABLE:['destruction','Можно перенести','bool'], onDestroy_DECAYS:['destruction','Разлагается со временем','bool'],
  onDestroy_DROP_EQUIPPED:['destruction','Роняет надетую экипировку','bool'], onDestroy_REPLACE_OBJECT:['destruction','Заменяется другим объектом','bool'],
  damagedThreshold:['destruction','Порог повреждения (% HP)','num'],

  blockHardness:['material','Твёрдость','num'], blockTool:['material','Нужный инструмент','ref'], blockBevelPx:['material','Срез внешних углов (px = см)','num'],
  blockDrops:['material','Что даёт один кусок (предмет; шанс %; от; до)','drops'],
  blockDropSkill:['material','Навык, влияющий на шанс','skill'], blockDropSkillBonus:['material','Бонус к шансу за уровень навыка (%)','num'],
  blockDropToolBonus:['material','Бонус к шансу от подходящего инструмента (%)','num']
};
// Настройки конкретного действия (ключ в os: «ДЕЙСТВИЕ.поле», например HARVEST.produceItem) — вкладка «Действия»
const OS_ACTION_FIELDS={
  tool:['Нужен инструмент','ref'], time:['Время выполнения (сек)','num'], consumeItem:['Расходует предмет','ref'], consumeAmount:['Количество расхода','num'],
  produceItem:['Выдаёт предмет','ref'], produceAmount:['Количество выдачи','num'], requiredSkill:['Требует навык','skill'], requiredSkillLevel:['Мин. уровень навыка','num']
};
// Допустимые значения выпадающих списков ОС
const OS_ENUMS={
  placementMode:['ANYWHERE','FLOOR_ONLY'], collision:['NONE','RECT','HULL_PIXELS','CIRCLE'], physics:['STATIC','DYNAMIC','CHARACTER'],
  lightShape:['CIRCLE','CONE'], storage:['GENERAL','CARGO','EQUIPMENT','RESOURCE'], animSource:['MANUAL','ASSEMBLER']
};
// Навыки, которые ОС знает из коробки (SKILLS_BUILTIN в ОС)
const OS_SKILLS=['strength','endurance','fortitude','agility','repair','building','crafting','cooking','medicine','exploration','orientation','weapons','melee','shooting','stealth','pickpocketing','lockpicking','intelligence','negotiation','trading'];
// Ресурс ОС сохраняет только у этих категорий
const OS_RESOURCE_CATS=['resource','container'];

// Каталог объектов плана. Наполняется модулями 03–05 через addItems([...]).
// Поля объекта: id — id в ОС; n — название; c — категория ОС; s — подтип; g — раздел; p — приоритет (0/1/2);
// sz — [ширина, высота] в см; wt — вес, кг; ph/pl — физика/размещение (если отличаются от умолчаний категории); vg — группа взаимозаменяемости;
// why — зачем нужен; fn — функциональная способность; v — вариации;
// os — настройки полей ОС: ключ = id поля ОС (см. OS_FIELDS), значение — только английское (enum, число, id объекта);
// cf — свои поля («Дополнительно → свои поля»): [ключ_по_английски, значение, описание по-русски];
// pn — пояснения по-русски (не копируются в ОС);
// act — действия ОС; req — что создать раньше (материалы рецепта, инструмент, носитель); w — с чем взаимодействует;
// use — для чего полезно; rooms — типы комнат; vis — состояния/анимации; sys — системы;
// rc — рецепт: «id ×N + id ×N; станция, инструмент» (только id); note — открытые вопросы.
// Размер (sz), вес (wt), физика/размещение, группа, действия, состояния и типы комнат попадают в поля ОС автоматически.
const PLAN_ITEMS=[];
function addItems(list){ list.forEach(i=>PLAN_ITEMS.push(i)); }
