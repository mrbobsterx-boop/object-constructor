/* ============================================================
   MODULE 08 — DATA: ИГРОВЫЕ ОБЪЕКТЫ (базовые классы/сцены Godot)
   Не путать с каталогом контента ОС (кровать, стол, кирка…) — там конкретные предметы,
   здесь — 17 категорий ОС (01-Object-Constructor-OS.md, раздел «Категории») + corpse как
   базовые классы, от которых наследуются экземпляры, которые создаёт ОС.
   ============================================================ */

addGameObjects([
  // --- og_actor: двигаются сами (CHARACTER-физика) ---
  {id:'character',n:'Character — базовый класс персонажа',g:'og_actor',p:0,
    why:'Раздел 6: персонаж двигается, действует, имеет инвентарь и потребности — игрок и NPC используют один и тот же класс (раздел 6.4).',
    fn:'Движение, взаимодействие через ActionSystem, потребности, инвентарь — общая база для игрока и NPC.',
    path:'res://objects/base/character.gd',req:['sys:component_base','sys:data_registry']},
  {id:'creature',n:'Creature — базовый класс существа',g:'og_actor',p:0,
    why:'Зомби и животные — тоже CHARACTER-физика (CAT_DEFAULTS ОС), но без части человеческой логики.',
    fn:'Наследует Character, отключает лишние компоненты (инвентарь/экипировка) для простых существ.',
    path:'res://objects/base/creature.gd',req:['obj:character']},

  // --- og_portable: живут в инвентаре (DYNAMIC + ANYWHERE, carry=true) ---
  {id:'item',n:'Item — базовый класс предмета',g:'og_portable',p:0,
    why:'Раздел 10.11: ресурс и предмет — не всегда одно и то же; предмет должен одинаково жить и в мире (лежать), и в инвентаре (быть записью).',
    fn:'Два представления одного ObjectDef из DataRegistry: физический узел на полу/в руке и облегчённая запись внутри InventorySystem.',
    path:'res://objects/base/item.gd',req:['sys:component_base','sys:data_registry']},
  {id:'tool',n:'Tool',g:'og_portable',p:0,
    why:'Раздел 12–13: инструмент — условие действия (requirements), а не отдельная механика.',
    fn:'Item + проверка «нужен для действия X» внутри ActionSystem.',
    path:'res://objects/base/tool.gd',req:['obj:item']},
  {id:'weapon',n:'Weapon',g:'og_portable',p:1,
    why:'Раздел 31: бой — отдельный набор анимаций (aim/attack/reload) и связь с экипировкой.',
    fn:'Item + слот экипировки + анимации боя + урон/дальность.',
    path:'res://objects/base/weapon.gd',req:['obj:item','sys:equipment_system']},
  {id:'clothing',n:'Clothing',g:'og_portable',p:1,
    why:'Раздел 25: одежда — экипировка со слотами и защитой, влияет на внешний вид через Character Assembler.',
    fn:'Item + слот экипировки + защита/вес + визуальная часть Assembler.',
    path:'res://objects/base/clothing.gd',req:['obj:item','sys:equipment_system']},

  // --- og_placed: расставляются, DYNAMIC + FLOOR_ONLY ---
  {id:'furniture',n:'Furniture',g:'og_placed',p:0,
    why:'Раздел 16: DYNAMIC-объекты падают вниз до твёрдого и получают урон от высоты и веса — это не обычная физика Godot, а собственная механика игры.',
    fn:'FLOOR_ONLY-логика опоры/падения (как в Room Editor, но в рантайме) + компоненты Interaction/Inventory.',
    path:'res://objects/base/furniture.gd',req:['sys:component_base','sys:interaction_system']},
  {id:'container',n:'Container',g:'og_placed',p:0,
    why:'Раздел 10.10: контейнер — единая система хранения (шкаф, ящик, сейф, рюкзак).',
    fn:'Furniture + StorageSystem внутри.',
    path:'res://objects/base/container.gd',req:['obj:furniture','sys:storage_system']},
  {id:'workbench',n:'Workbench',g:'og_placed',p:0,
    why:'Раздел 14: крафт хранится данными (рецепт), а не кодом под конкретный верстак.',
    fn:'Furniture + точка входа в CraftingSystem (какие рецепты доступны у этого верстака).',
    path:'res://objects/base/workbench.gd',req:['obj:furniture','sys:crafting_system']},
  {id:'machine',n:'Machine',g:'og_placed',p:1,
    why:'Категория «Машина» ОС — станки и устройства, часто с расходом энергии (раздел 8).',
    fn:'Furniture + потребление/производство энергии через ShelterEnergySystem, где применимо.',
    path:'res://objects/base/machine.gd',req:['obj:furniture']},
  {id:'decor',n:'Decor',g:'og_placed',p:1,
    why:'Декор игнорирует зоны и коллизии (02-Room-Editor.md, раздел «Декор») — визуал без геймплейной логики.',
    fn:'Furniture без Physics/Interaction — только Visual+Transform.',
    path:'res://objects/base/decor.gd',req:['sys:component_base']},
  {id:'plant',n:'Plant',g:'og_placed',p:1,
    why:'Раздел «Растения и ферма»: растения — объекты со стадиями роста, а не количество ресурса.',
    fn:'Стадии роста, полив/сбор через FarmingSystem.',
    path:'res://objects/base/plant.gd',req:['sys:component_base','sys:farming_system']},

  // --- og_static: часть мира (STATIC) ---
  {id:'building',n:'Building',g:'og_static',p:0,
    why:'Раздел 4: постройки (стены, полы, двери) остаются на месте — physics STATIC.',
    fn:'Статичная геометрия комнаты/здания; коллизия участвует в CollisionSystem.',
    path:'res://objects/base/building.gd',req:['sys:component_base','sys:collision_system']},
  {id:'block',n:'Block — материал блока',g:'og_static',p:0,
    why:'Раздел 4 (00-README-Overview.md): блок ломается куском 20×20 см — не как обычный STATIC-объект «на узел».',
    fn:'Данные материала (твёрдость/инструмент/добыча) читает DestructibleBlockSystem; отдельного узла на каждый блок нет.',
    path:'res://objects/base/block_material.gd',req:['sys:destructible_block_system']},
  {id:'door',n:'Door',g:'og_static',p:0,
    why:'Раздел 4.2: переходы между сценами идут через физические объекты — дверь главная среди них.',
    fn:'Building + область взаимодействия, подключена к TransitionManager (toRoom + точка спавна).',
    path:'res://objects/base/door.gd',req:['obj:building','sys:transition_manager']},

  // --- og_special ---
  {id:'resource',n:'ResourceNode — точка ресурса',g:'og_special',p:1,
    why:'Отдельная категория ОС — добыча, а не хранение (в отличие от контейнера).',
    fn:'Взаимодействие через ResourceNodeSystem, самовосстановление по настройкам объекта.',
    path:'res://objects/base/resource_node.gd',req:['sys:resource_node_system']},
  {id:'special',n:'Special — служебный объект',g:'og_special',p:2,
    why:'Категория ОС для записок, карт, сюжетных и интерфейсных объектов (Object Plan, раздел «Сюжет и служебные»).',
    fn:'Минимальный набор компонентов — обычно Visual+Interaction, без физики и инвентаря.',
    path:'res://objects/base/special.gd',req:['sys:component_base']},
  {id:'corpse',n:'Corpse — останки',g:'og_special',p:1,
    why:'Раздел 27: обыск, перенос, похороны, сожжение, разложение.',
    fn:'Инвентарь погибшего + разложение по времени, создаётся DeathSystem.',
    path:'res://objects/base/corpse.gd',req:['sys:corpse_system'],
    note:'Категории «Останки» (corpse) пока нет в ОС — см. 05-Object-Plan.md, проверка CATEGORY_NEW. Сначала завести категорию в ОС, прежде чем делать этот класс на реальных данных.'}
]);
