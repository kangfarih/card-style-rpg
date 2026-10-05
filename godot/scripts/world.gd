class_name WindhillWorld
extends Node2D
## Builds blocked/props/spawns from data/grove.json with procedural fallback.
## Parity with game.js init() + valid() + findPath() BFS (here via AStar2D).

const LEVEL_PATH := "res://data/grove.json"

const PROP_SIZE := {
	"oak": [148, 184], "pine": [132, 188], "birch": [110, 170], "tree": [148, 184],
	"rocks": [66, 48], "fern": [47, 31], "flowers": [54, 36], "berries": [51, 34],
	"gate": [176, 158], "fence": [88, 60], "lantern": [44, 108], "barrels": [53, 53],
	"cart": [101, 82], "bridge": [144, 104],
}

var blocked := {}
var props: Array = []
var spawns: Array = []
var hero_spawn := Vector2(13, 14)
var astar := AStar2D.new()
var tex_cache := {}

signal world_ready

func _ready() -> void:
	_build()

func key(x: int, y: int) -> String:
	return "%d,%d" % [x, y]

func is_blocked(x: int, y: int) -> bool:
	return blocked.has(key(x, y))

func valid(x: int, y: int) -> bool:
	if x < 0 or y < 0 or x >= Iso.N or y >= Iso.N:
		return false
	return not is_blocked(x, y)

func grid_to_screen(g: Vector2, cam: Vector2) -> Vector2:
	var p := Iso.project(g)
	return Vector2(p.x - cam.x + Iso.W * 0.5, p.y - cam.y + Iso.H * 0.55)

func _build() -> void:
	blocked.clear()
	props.clear()
	spawns.clear()
	var data := _load_level()
	hero_spawn = Vector2(data["heroSpawn"]["x"], data["heroSpawn"]["y"])
	var river = data["river"]
	for x in range(Iso.N):
		for y in range(int(river["y0"]), int(river["y1"]) + 1):
			if x < int(river["gapX0"]) or x > int(river["gapX1"]):
				blocked[key(x, y)] = true
	for b in data.get("blockedExtra", []):
		blocked[key(int(b[0]), int(b[1]))] = true
	for p in data.get("props", []):
		var d := {"x": float(p["x"]), "y": float(p["y"]), "type": String(p["type"]),
			"solid": bool(p.get("solid", true)), "groundLayer": bool(p.get("groundLayer", false))}
		props.append(d)
		if d["solid"]:
			blocked[key(int(d["x"]), int(d["y"]))] = true
	for s in data.get("spawns", []):
		# Locked: slime|mushroom only.
		if String(s["type"]) != "slime" and String(s["type"]) != "mushroom":
			continue
		spawns.append({"x": int(s["x"]), "y": int(s["y"]), "type": String(s["type"]),
			"name": String(s.get("name", s["type"]))})
	_rebuild_astar()
	world_ready.emit()

func _load_level() -> Dictionary:
	if FileAccess.file_exists(LEVEL_PATH):
		var f := FileAccess.open(LEVEL_PATH, FileAccess.READ)
		var parsed = JSON.parse_string(f.get_as_text())
		if typeof(parsed) == TYPE_DICTIONARY and parsed.has("props"):
			return parsed
	return _procedural_fallback()

func _procedural_fallback() -> Dictionary:
	# Mirrors game.js init() authored landmarks (no RNG scatter for determinism).
	return {
		"heroSpawn": {"x": 13, "y": 14},
		"river": {"y0": 9, "y1": 11, "gapX0": 9, "gapX1": 11},
		"blockedExtra": [[5, 8], [8, 8], [13, 8], [16, 8], [13, 12], [16, 12], [19, 12]],
		"props": [
			{"x": 7, "y": 7, "type": "gate", "solid": false, "groundLayer": false},
			{"x": 10, "y": 10, "type": "bridge", "solid": false, "groundLayer": true},
			{"x": 9, "y": 13, "type": "lantern", "solid": true, "groundLayer": false},
			{"x": 17, "y": 15, "type": "lantern", "solid": true, "groundLayer": false},
			{"x": 12, "y": 13, "type": "barrels", "solid": true, "groundLayer": false},
			{"x": 19, "y": 17, "type": "cart", "solid": true, "groundLayer": false},
		],
		"spawns": [
			{"x": 8, "y": 12, "type": "slime", "name": "Forest Slime"},
			{"x": 11, "y": 17, "type": "slime", "name": "Forest Slime"},
			{"x": 17, "y": 15, "type": "mushroom", "name": "Grove Mushroom"},
		],
	}

func _rebuild_astar() -> void:
	astar.clear()
	for x in range(Iso.N):
		for y in range(Iso.N):
			astar.add_point(_pid(x, y), Vector2(x, y))
	for x in range(Iso.N):
		for y in range(Iso.N):
			if not valid(x, y):
				continue
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var nx: int = x + d.x
				var ny: int = y + d.y
				if valid(nx, ny):
					astar.connect_points(_pid(x, y), _pid(nx, ny))

func _pid(x: int, y: int) -> int:
	return x * Iso.N + y

## AStar2D path mirrors game.js BFS 4-dir. Returns Array[Vector2i].
func find_path(sx: int, sy: int, tx: int, ty: int) -> Array:
	var out: Array = []
	if not valid(tx, ty):
		return out
	var id_path := astar.get_point_path(_pid(sx, sy), _pid(tx, ty))
	for i in range(1, id_path.size()):
		out.append(Vector2i(int(id_path[i].x), int(id_path[i].y)))
	return out

func load_texture(name: String) -> Texture2D:
	if tex_cache.has(name):
		return tex_cache[name]
	var path := "res://assets/%s.webp" % name
	if not ResourceLoader.exists(path):
		return null
	var t := load(path) as Texture2D
	tex_cache[name] = t
	return t
