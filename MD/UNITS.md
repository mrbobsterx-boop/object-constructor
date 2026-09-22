# Единицы измерения проекта

**Правило:** во всех JSON — игровые метры. Пиксели есть только внутри редакторов, для отображения (`100 px = 1 м`, то есть 1 px = 1 см).
Масштаб — одна константа в каждом редакторе (`PIXELS_PER_METER` / `PREVIEW_PPM`); менять его можно, данные от этого не меняются.

Система координат комнаты: начало — левый верхний угол, ось Y вниз. `x/y` объекта и фона — его **центр**.

## Объекты — `data/objects/*.json` (Object Constructor, `schema_version: 4`)

| Поле | Единица |
|---|---|
| `behavior.real_width_cm`, `real_height_cm` | см (целое число) — игровой размер объекта; задаётся только в ОС и не зависит от пикселей картинки. Автоподбор по пропорциям картинки («Сохранить пропорции») описан в дизайне ОС, но пока не реализован — см. «Что сейчас требует внимания» в `00-README-Overview.md` |
| `behavior.light.radius_m` | м |
| `behavior.perception.vision.range_m`, `hearing.range_m` | м |
| `behavior.movement.speed_mps` | м/с |
| `visuals.animations[].sound.radius_m` | м |
| `block.piece_size_cm` | см (20) — размер куска блока |
| `block.bevel_px` | px (1 px = 1 см) — срез внешних углов; `null` — брать `block_bevel_px` из `project_settings.json` |
| `block.hardness` | относительная величина (1 = обычная земля), не единица длины |
| `block.drop_table[].chance`, `drop_chance_modifiers.*` | доля 0…1 (60 % = `0.6`) |
| `appearance.imageWidth/imageHeight`, `appearance.collision.rect/padding` | **px исходной картинки** (не мировые) — привязаны к текстуре, в игре масштабируются вместе с ней |

## Комнаты — `data/rooms/*.json` (Room Editor, `schema_version: 4`)

| Поле | Единица |
|---|---|
| `widthM`, `heightM` | м |
| `instances[].xM`, `yM` | м (центр объекта) |
| `instances[].realWidthCm`, `realHeightCm` | см — копия размера объекта на момент сохранения комнаты (Room Editor обновляет её при открытии и кнопкой «Размеры из ОС во всех комнатах») |
| `instances[].light.radiusM` | м |
| `instances[].door.spawnXM`, `spawnYM` | м (точка появления в комнате назначения) |
| `backgroundLayers[].xM`, `yM`, `widthM`, `heightM` | м (центр и реальный размер слоя; масштаб = `widthM * PPM / ширина_текстуры_px`) |
| `walkLineThicknessCm` | см |
| `zoneCells` | ключ `"cx,cy"` — индекс клетки 10×10 см |
| `world.blockSizeM`, `world.pieceSizeM` | м (1 и 0,2) |
| `world.blocks[].cx`, `cy` | **индекс** клетки 1×1 м от левого верхнего угла комнаты (не метры и не px) |
| `world.blocks[].mask` | битовая маска кусков, см. раздел «Блоки» |

## Здания — `data/buildings/*.json` (Building Editor, `schema_version: 4`)

| Поле | Единица |
|---|---|
| `rooms[].x_m`, `y_m` | м (левый верхний угол комнаты в здании) |
| `rooms[].crop_m.left/right/top/bottom` | м |
| `backgroundLayers[].x_m`, `y_m`, `width_m`, `height_m` | м (центр и размер) |

Комната с блоками должна стоять в здании на **целом метре** (с учётом обрезки: `x_m − crop_m.left` и `y_m − crop_m.top` — целые), иначе сетки блоков соседних комнат не совпадут. Размеры такой комнаты тоже должны быть целыми метрами.

## Блоки

Блок 1×1 м = 5×5 кусков по 20×20 см. В редакторе блоки ставятся целыми, куски ломаются в игре, поэтому у блока есть **маска**: 25 бит, бит `py*5 + px` = 1 — кусок на месте (`px`, `py` = 0…4, слева направо и сверху вниз внутри блока). Ключа `mask` нет — блок целый (`33554431 = 0x1FFFFFF`). Блок без единого куска в файле не хранится.

Твёрдый кусок — красная зона: на него встают объекты, внутрь ставить нельзя. Куски лежат на сетке 20 см, поэтому ровно ложатся на клетки зон 10×10 см.

Срез углов — только внешний вид: угол куска срезается фаской `bevel_px`, если **оба** соседних по стороне куска отсутствуют (внутренние углы прямые). Collision остаётся квадратной. Редактор считает границу комнаты «твёрдой» (на стыке комнат среза нет); в игре срез считают по реальным данным соседней комнаты.

## Прочее

`data/project_settings.json`: `walk_line_bottom_m` — м; `block_bevel_px` — px (= см, 0…10; по умолчанию 4). `data/categories.json` — список категорий ОС `[{id, name}]` (пишет ОС, читают Room Editor и реестр). `data/room_recipes.json` — рецепты комнат по типам. Наборы `data/sets/*.json` (`schema_version: 2`) — служебные, только для редактора.

## Godot

```gdscript
const PPM := 100.0                                  # 1 игровой метр = 100 px

pos    = Vector2(inst.xM, inst.yM) * PPM            # центр объекта
scale  = Vector2(inst.realWidthCm / 100.0 * PPM / tex.get_width(),
                 inst.realHeightCm / 100.0 * PPM / tex.get_height()) * inst.scale
bg_scl = layer.widthM * PPM / tex.get_width()       # масштаб фона
speed  = movement.speed_mps * PPM                   # px/с

# блоки комнаты: 5×5 кусков по 20 px
const PIECES := 5
const FULL_MASK := 0x1FFFFFF
var mask: int = b.get("mask", FULL_MASK)
for py in PIECES:
    for px in PIECES:
        if (mask >> (py * PIECES + px)) & 1:
            var piece_pos = (Vector2(b.cx, b.cy) + Vector2(px, py) / PIECES) * PPM   # левый верх куска
            var piece_size = PPM / PIECES                                             # 20 px
```

Картинка растягивается ровно под `realWidthCm × realHeightCm`; чтобы она не искажалась, в ОС используется «Сохранить пропорции» (размер соответствует пропорциям картинки). Если размер не задан (0), редакторы берут размер картинки как 1 px = 1 см.

Персонаж 512×512: задайте его рост в метрах и считайте масштаб так же — `рост_м * PPM / высота_персонажа_в_кадре_px` (высота в кадре — без пустых полей вокруг).

## Старые файлы

Файлы, сохранённые до перехода на метры (`schema_version < 4`), читаются автоматически и пересчитываются: координаты комнат и зданий — из px при 640 px/м; радиусы света/зрения/слуха/звука и скорость («px») — делятся на 100. Пресеты и сессии Object Constructor без пометки `units:"m"` пересчитываются так же. При следующем сохранении файл становится метрическим.
