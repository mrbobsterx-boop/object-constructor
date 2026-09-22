/* ============================================================
   MODULE 09 — DATA: ДОМЕНЫ ДАННЫХ (JSON редакторов → Resource-классы Godot)
   Каждый домен — это «что нужно превратить в собственный Resource-класс Godot, чтобы
   не разбирать сырой JSON руками в десяти местах».
   ============================================================ */

addDataDomains([
  // --- dat_core: игровые данные ---
  {id:'dat_items',n:'Items — предметы и объекты',g:'dat_core',p:0,
    why:'Раздел 32 / 01-Object-Constructor-OS.md: всё, что создаёт ОС, должно читаться игрой без ручной перепечатки полей под каждую категорию.',
    fn:'Resource-класс ObjectDef с полями из data/objects/<id>.json (appearance/behavior/actions/destruction/block/crafting/visuals).',
    path:'res://data/resources/object_def.gd',reads:['data/objects/*.json','data/categories.json'],req:['sys:data_registry']},
  {id:'dat_rooms',n:'Rooms — комнаты',g:'dat_core',p:0,
    why:'Комната — главная единица мира; формат уже зафиксирован Room Editor, нужен его Resource-аналог в Godot.',
    fn:'Resource-класс RoomDef по формату data/rooms/<id>.json (см. 02-Room-Editor.md, раздел 2).',
    path:'res://data/resources/room_def.gd',reads:['data/rooms/*.json'],req:['sys:room_data_registry']},
  {id:'dat_buildings',n:'Buildings — здания и улицы',g:'dat_core',p:0,
    why:'Здание — композиция комнат; без Resource-класса BuildingSceneFactory придётся разбирать JSON вручную каждый раз.',
    fn:'Resource-класс BuildingDef по формату data/buildings/<id>.json (см. 03-Building-Editor.md, раздел 2), оба режима BUILDING/STREET.',
    path:'res://data/resources/building_def.gd',reads:['data/buildings/*.json'],req:['sys:building_data_registry']},
  {id:'dat_recipes',n:'Recipes — рецепты крафта',g:'dat_core',p:0,
    why:'Раздел 14: рецепт — данные (вход, инструмент, станция, время, результат), а не код под конкретный предмет.',
    fn:'Разбор рецепта из `crafting.recipe` объекта и отдельно из data/room_recipes.json (генерация комнат) по одному формату.',
    path:'res://data/resources/recipe_def.gd',reads:['data/objects/*.json (crafting.recipe)','data/room_recipes.json'],req:['dat:dat_items']},
  {id:'dat_characters',n:'Characters — персонажи Assembler',g:'dat_core',p:1,
    why:'Раздел 6, 25: внешний вид и анимации персонажа собираются из частей Assembler, а не рисуются заново под каждого NPC.',
    fn:'Персонажи/риги/части Character Assembler (data/characters, data/rigs, data/parts) — источник анимаций и внешнего вида NPC.',
    path:'res://data/resources/character_assembler_def.gd',reads:['data/characters/*.json','data/rigs/*.json','data/parts/**'],req:['dat:dat_items']},
  {id:'dat_loot_probabilities',n:'Loot Probabilities — центральный файл вероятностей',g:'dat_core',p:1,
    why:'Раздел 19–20: содержимое контейнера должно определяться одной таблицей вероятностей, а не быть разбросано по объектам.',
    fn:'Единая таблица вероятностей лута по типу комнаты/контейнера/состоянию (раздел 20).',
    path:'res://data/resources/loot_table_def.gd',reads:[],req:['dat:dat_items'],
    note:'В документации редакторов такого файла ещё нет — раздел 20 мастер-документа его требует, но кто именно его пишет (ОС, Room Editor или отдельный небольшой редактор), не решено.'},

  // --- dat_support: служебные данные ---
  {id:'dat_categories',n:'Categories — список категорий ОС',g:'dat_support',p:1,
    why:'Без единого списка категорий Room Editor, Building Editor и игра могут разойтись с ОС в названиях.',
    fn:'data/categories.json — список категорий и их порядок; пишет ОС, читают Room Editor и Project Registry.',
    path:'',reads:['data/categories.json'],req:['sys:data_registry']},
  {id:'dat_project_settings',n:'Project Settings — настройки проекта редакторов',g:'dat_support',p:1,
    why:'Если игра посчитает линию ходьбы иначе, чем Room Editor, персонаж будет проваливаться или зависать в воздухе (02-Room-Editor.md).',
    fn:'data/project_settings.json (walk_line_bottom_m, block_bevel_px) — геометрические константы, общие для редакторов и игры.',
    path:'res://data/resources/project_settings_def.gd',reads:['data/project_settings.json'],req:[]},
  {id:'dat_sets',n:'Sets — заготовки Room Editor',g:'dat_support',p:2,
    why:'00-README-Overview.md прямо говорит: «служебный формат редактора, игра его не читает» — вероятно, этот домен рантайму не нужен вовсе.',
    fn:'data/sets/<id>.json — заготовки из нескольких объектов, уже разворачиваются в instances[] комнаты при вставке в Room Editor.',
    path:'',reads:['data/sets/*.json'],req:[],
    note:'Решить: читает ли рантайм сеты напрямую, или они существуют только внутри Room Editor и в игру не попадают.'},
  {id:'dat_plan_progress',n:'Scene/Object Plan — прогресс чертежа',g:'dat_support',p:2,
    why:'Для полноты картины: это домен планирования, а не геймплея — отмечен, чтобы не спутать с игровыми данными.',
    fn:'data/scene_plan.json и data/object_plan.json — свои файлы этого инструмента и Object Plan; игра их не читает.',
    path:'',reads:['data/scene_plan.json','data/object_plan.json'],req:[]}
]);
