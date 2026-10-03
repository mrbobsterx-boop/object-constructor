# Найденные баги

Ревью кода всех редакторов (2026-10-02).

> **Статус (2026-10-03): все пункты исправлены** — коммиты `878feea` (OS-1…4, PLAN-1, ROOM-1/2), `234692c` (OS-5…8), `b20ab9a` (ROOM-3…6), `980374b` (BLD-1…4), `f05da4e` (PLAN-2), `36d25c9` (IPT-1…4), `f6464f7` (REG-1/2), `4441fda` (устаревшие файлы). Пути ниже — до переезда редакторов в `tools/`.
Все 7 приложений открываются в браузере без ошибок в консоли; синтаксических ошибок в JS нет.

Уверенность: **высокая** — проверено чтением кода и прослеживанием сценария; **средняя** — вероятно, но стоит перепроверить.

## Приоритет (потеря данных — чинить первым)

1. Object Plan и image-prep-tool затирают друг друга в `data/object_plan.json` — [PLAN-1](#plan-1)
2. ОС теряет рецепт / разрушение / звук / коллизию при пересохранении объекта — [OS-3](#os-3)
3. ОС: удаление не того кадра и `Promise` вместо кадра — [OS-1](#os-1), [OS-2](#os-2)
4. Room Editor: undo портит историю — [ROOM-1](#room-1), [ROOM-2](#room-2)
5. Значение 0 сохраняется как значение по умолчанию (свет 0 % → 100 %) — [OS-4](#os-4)

---

## ОС — Universal Object Constructor (`os/`)

### OS-1
**Удаление кадра анимации удаляет не тот кадр** — `os/js/04-visuals-animation.js:342-344` · высокая

`frames.splice(currentFrameIndex,1)`, затем `switchToFrame()` → `commitCurrentFrame()` записывает пиксели удалённого кадра (они ещё в `animDoc`) в `frames[currentFrameIndex]` — то есть в следующий кадр.
- Кадры A,B,C, удаляем B → получаем A,B (C затёрт).
- Удаляем последний кадр C → commit дописывает его обратно, ничего не удаляется.

### OS-2
**«→след.» / «→все» записывают `Promise` вместо кадра** — `os/js/04-visuals-animation.js:49-51` · высокая

`frames[frameIdx]=scratchDoc.serialize()` без `await` (`serialize()` асинхронный). Клик по такому кадру → `animDoc.restore(Promise)` → TypeError; при сохранении кадр становится `{}`. «→все» ещё и запускает несколько `scratchDoc.restore()` параллельно на одном `scratchDoc` (`forEach` без `await`, строка 44).

### OS-3
**Открыть и пересохранить объект — часть данных пропадает** — `os/js/07-object-io.js:1042-1073` (+ `resetIdentityAndImages` 500-519) · высокая

`collect()` пишет, но `restoreJsonFields()` / `restoreObjectProjectData()` не восстанавливают:
- `crafting.recipe` (`craftRecipe` сбрасывается в null);
- `destruction.damaged`, `destruction.broken`, `destroyAnimation` — картинки не грузятся с диска, `collect()` (467-470) пишет `null`;
- `visuals.animations[].sound` — строка 1070 жёстко ставит `sound:{enabled:false,...}`;
- `appearance.collision` (mode, padding, MANUAL rect) — возвращается AUTO;
- `character_ref` — `linkedCharacter` остаётся null.

Сценарий: открыть объект с рецептом, спрайтом «разрушен» и звуком анимации, поменять имя, сохранить → в JSON всего этого больше нет.

### OS-4
**Значение 0 сохраняется как значение по умолчанию** — `os/js/07-object-io.js:404,408,410`; `os/js/04-visuals-animation.js:64,752,753` · высокая

Используется `(+v||default)`, а при чтении — `??`:
- яркость света 0 % → `intensity:1`;
- мягкость света 0 → 0.4;
- поглощение тени 0 → 0.7;
- громкость звука 0 % → 0.8 (и в памяти принудительно 80, строка 752);
- радиус звука 0 м → `radius_m:3`.

Исправление: `Number.isFinite(+v) ? +v : default` или `??`.

### OS-5
**Промисы загрузки картинок без `onerror` — вечное ожидание** · высокая

- Окно крафта: `os/js/07-object-io.js:97` — `loadImageEl` без `onerror`. Клетки с `image:null` (`src="null"`) или с blob-URL, отозванными `scanProjectFolderCatalog()` (строка 1181, вызывается из `openCraftModal()` строка 18) → `Promise.all` в `buildRecipeImageCanvas` (113) не завершается, «Сохранить рецепт» ничего не делает, окно не закрывается.
- То же: `os/js/02-image-document.js:199` (`ImageDocument.restore`), `os/js/07-object-io.js:708, 714, 879, 1102`, `os/js/05-destruction.js:173, 193, 208`.

### OS-6
**Undo/redo делит изменяемые объекты с живым состоянием** — `os/js/07-object-io.js:687, 717`; `os/js/02-image-document.js:191, 197` · высокая

- `buildSessionState()` хранит `destroyFrames` по ссылке; массив потом меняется на месте (`05-destruction.js:110` push, 165/185 splice). Добавил кадр разрушения → Ctrl+Z не убирает его.
- `mainDoc.serialize()` возвращает `this.collision` по ссылке; `03-main-editor.js:121-122` меняют `.mode`/`.padding` на месте → изменение коллизии не отменяется, старые снимки портятся.

### OS-7
**Гонка на общем `scratchDoc`** — `os/js/04-visuals-animation.js:372-382` против `541/551/561`; `os/js/07-object-io.js:659, 1273` · средняя

`renderAnimThumbs()` на каждый рендер запускает фоновый цикл с `scratchDoc.restore()`, а «обрезать/дополнить/изменить размер всех кадров», сохранение и экспорт используют тот же `scratchDoc`. `restore()` ставит `docW/docH` сразу, а `layers` — после загрузки картинок → кадр может получить чужой размер.

### OS-8
**Данные в `innerHTML` без `esc()`** · средняя
- `os/js/07-object-io.js:319` `renderComponents` — `currentComponents` прямо из JSON (строка 1066).
- `os/js/01-core-utils.js:242` `renderPresetSelect` — имена пресетов.
- `os/js/03-main-editor.js:27` — `${l.name}` (имена слоёв из ZIP сессии / истории).

### OS-9 (вопрос)
**Размер объекта округляется до 10 см** — `os/js/07-object-io.js:399-400` и обработчик на `1337`.
Документация (`MD/01-Object-Constructor-OS.md`, `MD/UNITS.md`) говорит «целые сантиметры»: 155 см сохраняется как 160. Если не задумано — баг. Связано с [REG-1](#reg-1).

---

## Room Editor (`room-editor/`)

### ROOM-1
**Undo делит память с записью истории** — `room-editor/js/12-history.js:20` · высокая

`restoreSnapshot` делает `room=s.room` → живая комната = объект в `historyStack`. Сдвинул A→B, Ctrl+Z, сдвинул другой объект — запись истории переписана, повторный Ctrl+Z ничего не меняет, состояние A потеряно.
Исправление: `room=JSON.parse(JSON.stringify(s.room))`.

### ROOM-2
**Undo не отменяет отложенную запись истории** — `room-editor/js/12-history.js:10, 31-32` · высокая

`scheduleHistoryPush` пишет через 500 мс; `undoAction`/`redoAction` не делают `clearTimeout(historyTimer)`, `suppressHistory` блокирует только новые. История [S0,S1], перетащил объект и Ctrl+Z в течение 0,5 с → перетаскивание не записано, откат прыгает на S0 мимо S1, затем таймер пушит S0 и стирает S1 из redo.

### ROOM-3
**«Обновить библиотеку» ломает картинки поставленных объектов** — `room-editor/js/02-catalog.js:113` · высокая

`scanProjectFolderCatalog` делает `URL.revokeObjectURL(e.image)` для всех картинок каталога, а экземпляры в комнате и снимки истории держат те же `blob:` URL (`image:cat.image` в `11-room-io.js:131`, `06-instances-sets.js:15/112`). После обновления — битые картинки до переоткрытия комнаты; undo тоже возвращает мёртвые URL.

### ROOM-4
**Набор теряет `isDecor` и `placementMode`** — `room-editor/js/06-instances-sets.js:45` · высокая

`collectSetJSON` не пишет эти поля, `insertSet` (110-114) читает `undefined`. Лампа FLOOR_ONLY, отмеченная декором для стены, после вставки набора встаёт на пол и проверяется на зоны/столкновения.

### ROOM-5
**HTML без `esc()`** · высокая
- `room-editor/js/08-properties-panel.js:37` — `${inst.name}` / `${inst.objectId}`
- `room-editor/js/08-properties-panel.js:85` — `value="${inst.door.toRoom}"`
- `room-editor/js/08-properties-panel.js:130` — `existingRoomIds` в `<option value>`
- `room-editor/js/13-room-generator.js:40` — `${r.name||r.id}`
- `room-editor/js/02-catalog.js:188` — `value="${r.id}"`
- `room-editor/js/06-instances-sets.js:92` — `data-id="${s.id}"`

Объект с именем `Стол <b>` ломает разметку панели свойств; `toRoom` вида `a"b` обрывает атрибут.

### ROOM-6 (мелкие)
- Конусный свет с углом 0° рисуется вниз: `inst.light.angle||90` — `room-editor/js/04-room-canvas.js:81`.
- Генератор ставит `path` слоя = `ld.image` (`rooms/x.png`) — `room-editor/js/13-room-generator.js:90`; при сохранении получается `rooms/rooms/x.png`.
- Undo не обновляет оверлей зон и поле толщины линии стен.

---

## Building Editor (`building-editor/`)

### BLD-1
**При загрузке здания обрезка не учитывается в размере комнаты** — `building-editor/js/09-building-save-load.js:66` · высокая

`w:room.width, h:room.height`, хотя `crop` восстанавливается; `applySelectedCrop` (`07-building-backgrounds.js:124`) считает `w = meta.width - left - right`. После переоткрытия неверны проверка наложения, прилипание к краям, размер холста и рамка.

### BLD-2
**Связь дверей без учёта обрезки и этажа** — `building-editor/js/05-room-visuals-doors.js:160` · высокая (обрезка) / средняя (этаж)

`recomputeDoorLinks` берёт `p.x+d.x`, а рисование — `p.x+d.x-crop.left` (`06-building-canvas.js:139`). Совпадающие на экране двери не связываются, а двери в 50 см друг от друга — связываются. Двери в обрезанной части тоже связываются. Этаж не проверяется — комнаты этажей 0 и 1 с одинаковыми координатами связываются.

### BLD-3
**«Вписать» не уменьшает масштаб ниже 25 %** — `building-editor/js/02-zoom-pan.js:18` · высокая

Значение не из `ZOOM_STEPS` обрезается `Math.max(0.25, …)`, хотя шаги идут до 0.05. Здание 60 м в окне 1200 px должно вписаться на 0.187, а получает 0.25 и не помещается.

### BLD-4
**HTML без `esc()`** — `building-editor/js/03-room-catalog.js:41` (`data-id="${r.id}"`); также `room-editor/js/13-room-generator.js:31` и `14-room-recipes.js:27` (подпись своего типа комнаты) · средняя

---

## Object Plan + image-prep-tool

### PLAN-1
**Оба инструмента затирают друг друга в `data/object_plan.json`** — `object-plan/js/07-store.js:21-22`, `ipt/image-prep-tool/js/02-plan-bridge.js:87` · высокая

Оба пишут `custom`, `customGroups`, `variationOverrides` из своей памяти, не перечитывая файл перед записью. Object Plan берёт их из localStorage; IPT читает файл один раз при подключении.
- Добавил вариацию в IPT → «💾 Прогресс в проект» в Object Plan → вариация пропала.
- Добавил объект в Object Plan при открытом IPT → следующая «+ вариация» в IPT его удалит.

Исправление: перед записью перечитывать файл и сливать изменения.

### PLAN-2
**Превью ищется по началу имени файла** — `object-plan/js/07-store.js:87-93` · средняя

`refThumbFor` берёт первый файл, начинающийся с `<id>_<вариация>`: для `chair`/`red` подходит `chair_red_dark.png`, для `lamp`/`oil` — файлы `lamp_oil_big`. Результат зависит от порядка файлов. Нужно точное совпадение или только суффикс `_<n>`.

---

## image-prep-tool (`ipt/image-prep-tool/`)

### IPT-1
**Новые слои не получают имя; клик по слою перезаписывает имя** — `ipt/image-prep-tool/js/05-layers.js:34`, `08-naming-panel.js:66-70` · высокая

`nameLayerFromPicker` нигде не определена — `typeof`-проверка пропускает именование. `onLayerCreated` пустая. Имя ставится только потом в `onActiveTargetChanged` → `applyPickToActiveLayerIfAny`, и берётся *текущее* значение выбора. Вырезал chair/«red», переключил на «blue», вырезал второй → клик по первому слою переименует его в `chair_blue`. Ручное переименование тоже затирается. При сохранении — дубли или `layer_N`.

### IPT-2
**Выделение за левый/верхний край захватывает лишние пиксели** — `ipt/image-prep-tool/js/05-layers.js:19-20` · высокая

`x0`/`y0` прижимаются к 0, а `w`/`h` не уменьшаются на обрезанную часть. Тянул с x=100 до x=-50 → `x0=-50, w=150` → `x0=0, w=150`: столбцы 100–149 соседнего объекта попадают в слой.

### IPT-3
**Битая картинка в очереди** — `ipt/image-prep-tool/js/03-queue.js:43-53` · высокая

Нет `img.onerror`, а `activeQueueId` переключается до загрузки. Повреждённый файл / HEIC → остаётся старый лист и старое `baseName`; «Сохранить всё» запишет предыдущую картинку как `<старое_имя>_2.png` и отметит битый элемент готовым.

### IPT-4
**Ошибка посреди сохранения → дубли** — `ipt/image-prep-tool/js/09-save.js:42-50` · средняя

Слои убираются из списка только после записи всех. Упала запись 3-го из 5 → слои 1–2 уже на диске, но остались в списке (и уже обрезаны автотримом); повтор пишет их как `_2.png`.

---

## Project Registry (`project-registry/`)

### REG-1
**`SIZE_ASPECT` ругается на правильные объекты** — `project-registry/js/04-checks.js:57` · высокая

Допуск 1 см, а ОС округляет размеры до 10 см ([OS-9](#os-9-вопрос)). Картинка 512×341, ширина 100 см → точная высота 66,6, сохраняется 70 → «картинка растянута», и переподгонка в ОС не помогает. Нужен допуск ≥ 5 см (или округление в ОС до 1 см).

### REG-2
**Числа блоков в `innerHTML` без `esc()`** — `project-registry/js/07-view-objects.js:54, 81, 82`; `06-view-overview.js:28` · средняя, риск низкий

`block.bevel_px`, `piece_size_cm`, `pieces_per_side`, `settings.block_bevel_px` — если в JSON строка с HTML, она отрисуется как разметка.

Проверено и в порядке: проверки ссылок совпадают с ОС и Building Editor (индексы дверей, слоты, crop/x, ключ пустого рига `'/slot'`), проверки OVERLAP, BLOCK_GRID, DOORLINK.

---

## Устаревшие / лишние файлы

| Файл | Проблема |
|---|---|
| `room-editor/js/15-init.js` | Старая копия `16-init.js`, в `index.html` не подключена |
| `MD/room-blocks-palette-fix.zip` | Старая версия `15-destructible-blocks.js` (ещё с окружением 3×3, которое удалено). Распаковка затрёт актуальный файл |
| `os/UNITS.md` | Устаревшая копия `MD/UNITS.md` («кратно 10 см», нет блоков) |
| `os/# ОС — Universal Object Constructor.txt` | Устаревшая копия `MD/01-Object-Constructor-OS.md` |
