/* ============================================================
   MODULE 05 — DATA: СЛОЙ 4 «МИР» И СЛОЙ 5 «ЖИВЫЕ NPC»
   Раздел 4, 6.4, 17–24, 35 мастер-документа.
   ============================================================ */

addSystems([
  // --- g_world: мир и сцены ---
  {id:'loot_container_system',n:'LootContainerSystem — лут и контейнеры',g:'g_world',p:0,
    why:'Раздел 19: содержимое контейнера зависит от типа комнаты и состояния, а не заполняется вручную в редакторе.',
    fn:'При первом открытии контейнера (или генерации комнаты) наполняет его через LootGenerator и центральный файл вероятностей (раздел 20).',
    path:'res://world/loot_system.gd',autoload:null,req:['sys:data_registry','sys:storage_system'],reads:['data/objects (drop_table, resource)'],blocksScenes:false},
  {id:'resource_node_system',n:'ResourceNodeSystem — точки ресурса',g:'g_world',p:1,
    why:'Категория «Точка ресурса» (resource) — отдельная логика добычи, отличная от контейнеров.',
    fn:'Добыча из объектов категории resource через ActionSystem, самовосстановление по настройкам объекта (см. 01-Object-Constructor-OS.md раздел «Инвентарь»).',
    path:'res://world/resource_node_system.gd',autoload:null,req:['sys:action_system'],reads:[],blocksScenes:false},
  {id:'exploration_tracker',n:'ExplorationTracker — исследование',g:'g_world',p:1,
    why:'Раздел 4.3: fast travel открывается после исследования — нужно знать, что уже посещено.',
    fn:'Отмечает посещённые сцены/точки перехода при срабатывании TransitionManager.',
    path:'res://world/exploration_tracker.gd',autoload:'ExplorationTracker',req:['sys:transition_manager'],reads:[],blocksScenes:false},
  {id:'fast_travel_system',n:'FastTravelSystem',g:'g_world',p:2,
    why:'Раздел 4.3: первое прохождение — всегда физическое, быстрое перемещение — награда за исследование.',
    fn:'Список открытых точек, телепорт персонажа со сменой сцены через TransitionManager.',
    path:'res://world/fast_travel.gd',autoload:'FastTravelSystem',req:['sys:exploration_tracker'],reads:[],blocksScenes:false,
    note:'Точные правила fast travel не зафиксированы — раздел 42 мастер-документа («правила fast travel»).'},
  {id:'world_state_generator',n:'RoomStateGenerator — состояния комнат/зданий',g:'g_world',p:1,
    why:'Раздел 18: состояние комнат и зданий должно деградировать/меняться со временем, а не оставаться таким, каким его сохранили в Room Editor.',
    fn:'При первом посещении или по тику TimeManager применяет к сцене состояние (разгром, пыль, обвал по времени) поверх данных фабрики.',
    path:'res://world/room_state_generator.gd',autoload:null,req:['sys:time_manager','sys:building_scene_factory'],reads:[],blocksScenes:false},

  // --- g_npc: живые NPC ---
  {id:'ai_controller',n:'AIController — AI-контроллер NPC',g:'g_npc',p:1,
    why:'Раздел 6.4: автономность — NPC должен сам выбирать действия по AutonomyHook, как это делал бы игрок.',
    fn:'Использует AutonomyHook + NeedsSystem, чтобы выбрать следующее действие NPC и передать его в Pathfinding/ActionSystem.',
    path:'res://npc/ai_controller.gd',autoload:null,req:['sys:autonomy_ai_hook'],reads:[],blocksScenes:false},
  {id:'perception_system',n:'PerceptionSystem — восприятие',g:'g_npc',p:1,
    why:'Раздел 6.4 и поле behavior.perception в ОС: NPC должен реагировать на то, что видит и слышит, а не на весь мир сразу.',
    fn:'Зрение/слух по радиусу из behavior.perception объекта; отдаёт список замеченного AIController.',
    path:'res://npc/perception_system.gd',autoload:null,req:['sys:ai_controller'],reads:[],blocksScenes:false},
  {id:'relationship_system',n:'RelationshipSystem — отношения',g:'g_npc',p:1,
    why:'Раздел 23: отношения между персонажами — основа морали, групп и последствий.',
    fn:'Хранит и обновляет пары «кто-к-кому», доверие/симпатию по событиям от EventSystem.',
    path:'res://npc/relationship_system.gd',autoload:'RelationshipSystem',req:['sys:ai_controller'],reads:[],blocksScenes:false},
  {id:'morale_mood_system',n:'MoraleMoodSystem — мораль и настроение',g:'g_npc',p:1,
    why:'Раздел 22–23: угрозы и отношения должны влиять на поведение через мораль и настроение.',
    fn:'Считает мораль/настроение персонажа и группы по потребностям, отношениям и событиям.',
    path:'res://npc/morale_system.gd',autoload:null,req:['sys:relationship_system'],reads:[],blocksScenes:false,
    note:'Формулы морали не зафиксированы — раздел 42 мастер-документа.'},
  {id:'event_system',n:'GameEventSystem — система событий',g:'g_npc',p:1,
    why:'Раздел 35: универсальное событие (event_id, conditions, actors, targets, actions, moral_tags, effects, time, location) — общий формат для последствий.',
    fn:'Создаёт и рассылает игровые события через EventBus; принимает подписки от RelationshipSystem, MoraleMoodSystem, фракций.',
    path:'res://npc/event_system.gd',autoload:'GameEventSystem',req:['sys:event_bus','sys:relationship_system'],reads:[],blocksScenes:false},
  {id:'group_system',n:'GroupSystem — группы',g:'g_npc',p:1,
    why:'Раздел 24: любой NPC может стать членом группы — это не свойство «выжившего», а состояние, которое может получить кто угодно.',
    fn:'Состав группы, вступление/выход, общие потребности группы (см. связь с 41 «человек присоединяется → его потребности входят в систему группы»).',
    path:'res://npc/group_system.gd',autoload:'GroupSystem',req:['sys:relationship_system'],reads:[],blocksScenes:false}
]);
