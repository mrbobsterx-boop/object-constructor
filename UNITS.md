# Единицы измерения проекта

**Правило:** во всех JSON — игровые метры. Пиксели есть только внутри редакторов, для отображения (`100 px = 1 м`, то есть 1 px = 1 см).
Масштаб — одна константа в каждом редакторе (`PIXELS_PER_METER` / `PREVIEW_PPM`); менять его можно, данные от этого не меняются.

Система координат комнаты: начало — левый верхний угол, ось Y вниз. `x/y` объекта и фона — его **центр**.

## Объекты — `data/objects/*.json` (Object Constructor, `schema_version: 4`)

| Поле | Единица |
|---|---|
| `behavior.real_width_cm`, `real_height_cm` | см (кратно 10) — игровой размер объекта |
| `behavior.light.radius_m` | м |
| `behavior.perception.vision.range_m`, `hearing.range_m` | м |
| `behavior.movement.speed_mps` | м/с |
| `visuals.animations[].sound.radius_m` | м |
| `appearance.imageWidth/imageHeight`, `appearance.collision.rect/padding` | **px исходной картинки** (не мировые) — привязаны к текстуре, в игре масштабируются вместе с ней |

## Комнаты — `data/rooms/*.json` (Room Editor, `schema_version: 4`)

| Поле | Единица |
|---|---|
| `widthM`, `heightM` | м |
| `instances[].xM`, `yM` | м (центр объекта) |
| `instances[].realWidthCm`, `realHeightCm` | см |
| `instances[].light.radiusM` | м |
| `instances[].door.spawnXM`, `spawnYM` | м (точка появления в комнате назначения) |
| `backgroundLayers[].xM`, `yM`, `widthM`, `heightM` | м (центр и реальный размер слоя; масштаб = `widthM * PPM / ширина_текстуры_px`) |
| `walkLineThicknessCm` | см |
| `zoneCells` | ключ `"cx,cy"` — индекс клетки 10×10 см |

## Здания — `data/buildings/*.json` (Building Editor, `schema_version: 4`)

| Поле | Единица |
|---|---|
| `rooms[].x_m`, `y_m` | м (левый верхний угол комнаты в здании) |
| `rooms[].crop_m.left/right/top/bottom` | м |
| `backgroundLayers[].x_m`, `y_m`, `width_m`, `height_m` | м (центр и размер) |

## Прочее

`data/project_settings.json` → `walk_line_bottom_m` — м. Наборы `data/sets/*.json` (`schema_version: 2`) — служебные, только для редактора.

## Godot

```gdscript
const PPM := 100.0                                  # 1 игровой метр = 100 px

pos    = Vector2(inst.xM, inst.yM) * PPM            # центр объекта
scale  = Vector2(inst.realWidthCm / 100.0 * PPM / tex.get_width(),
                 inst.realHeightCm / 100.0 * PPM / tex.get_height()) * inst.scale
bg_scl = layer.widthM * PPM / tex.get_width()       # масштаб фона
speed  = movement.speed_mps * PPM                   # px/с
```

Персонаж 512×512: задайте его рост в метрах и считайте масштаб так же — `рост_м * PPM / высота_персонажа_в_кадре_px` (высота в кадре — без пустых полей вокруг).

## Старые файлы

Файлы, сохранённые до перехода на метры (`schema_version < 4`), читаются автоматически и пересчитываются: координаты комнат и зданий — из px при 640 px/м; радиусы света/зрения/слуха/звука и скорость («px») — делятся на 100. Пресеты и сессии Object Constructor без пометки `units:"m"` пересчитываются так же. При следующем сохранении файл становится метрическим.
