extends Node2D
## Main parity loop: tap-to-move/attack, arrow keys, 1/2/3 skills, AutoHunt .35s, pause.
## Mirrors game.js loop/update/pointerdown/keydown/huntTick.

@onready var world: WindhillWorld = $World
@onready var ground: WindhillGround = $World/Ground
@onready var props_root: Node2D = $World/Props
@onready var actors_root: Node2D = $World/Actors
@onready var cam: Camera2D = $World/Camera2D
@onready var hud: WindhillHUD = $HUD

const PlayerScript := preload("res://scripts/player.gd")
const EnemyScript := preload("res://scripts/enemy.gd")

var player: WindhillPlayer
var enemies: Array = []
var path: Array = []
var target: WindhillEnemy = null
var paused := false
var kills := 0
var level := 5
var exp := 0
var next_exp := 100
var gold := 0
var items := 0
var auto_hunt := false
var hunt_cd := 0.0
var cam_goal := Vector2.ZERO
var prop_nodes: Array = []

func _ready() -> void:
	y_sort_enabled = true
	$World.y_sort_enabled = true
	world.world_ready.connect(_on_world)
	ground.setup(world)
	_spawn_all()
	hud.skill_pressed.connect(_on_skill)
	hud.autohunt_toggled.connect(_on_hunt_toggle)
	hud.pause_toggled.connect(_on_pause)
	hud.reset_pressed.connect(_spawn_all)
	cam_goal = Iso.project(player.grid)
	cam.position = cam_goal
	hud.set_notice("Tap a tile to travel")
	set_process_unhandled_input(true)

func _on_world() -> void:
	pass

func _spawn_all() -> void:
	for c in props_root.get_children():
		c.queue_free()
	for c in actors_root.get_children():
		c.queue_free()
	enemies.clear()
	path.clear()
	target = null
	kills = 0
	paused = false
	get_tree().paused = false
	player = WindhillPlayer.new()
	player.set_script(PlayerScript)
	actors_root.add_child(player)
	player.setup(world, world.hero_spawn)
	player.add_child(_make_pawn_visual("hero"))
	for p in world.props:
		props_root.add_child(_make_prop(p))
	var i := 0
	for s in world.spawns:
		var e := WindhillEnemy.new()
		e.set_script(EnemyScript)
		actors_root.add_child(e)
		e.setup(world, player, Vector2(s["x"], s["y"]), String(s["type"]), String(s["name"]), i)
		e.add_child(_make_pawn_visual(String(s["type"])))
		e.died.connect(_on_enemy_died)
		enemies.append(e)
		i += 1
	ground.setup(world)

func _make_pawn_visual(kind: String) -> Node2D:
	var root := Node2D.new()
	var base := Sprite2D.new()
	base.texture = world.load_texture("base")
	base.position = Vector2(0, 9)
	base.scale = Vector2(46.0 / maxf(1.0, base.texture.get_width() if base.texture else 46.0), 23.0 / maxf(1.0, base.texture.get_height() if base.texture else 23.0))
	root.add_child(base)
	var body := Sprite2D.new()
	body.texture = world.load_texture(kind)
	var h := 78.0 if kind == "hero" else (47.0 if kind == "mushroom" else 39.0)
	if body.texture:
		body.scale = Vector2(55.0 / body.texture.get_width(), h / body.texture.get_height())
	body.position = Vector2(0, -2)
	root.add_child(body)
	var shadow := _Shadow.new()
	root.add_child(shadow)
	return root

class _Shadow extends Node2D:
	func _draw() -> void:
		draw_ellipse(Vector2.ZERO, 22.0, 10.0, Color(0.06, 0.16, 0.14, 0.38))

func _make_prop(p: Dictionary) -> Node2D:
	var root := Node2D.new()
	root.position = Iso.project(Vector2(float(p["x"]), float(p["y"])))
	var sp := Sprite2D.new()
	sp.texture = world.load_texture(String(p["type"]))
	var size: Array = WindhillWorld.PROP_SIZE.get(String(p["type"]), [60, 44])
	if sp.texture:
		sp.scale = Vector2(float(size[0]) / sp.texture.get_width(), float(size[1]) / sp.texture.get_height())
		sp.position.y = -float(size[1]) * 0.5 + 9.0
	root.add_child(sp)
	if bool(p["solid"]):
		var body := StaticBody2D.new()
		var cs := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size = Vector2(28, 14)
		cs.shape = rect
		body.add_child(cs)
		root.add_child(body)
	prop_nodes.append(root)
	return root

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_tap(get_global_mouse_position())
	elif event.is_action_pressed("ui_up"):
		_step(Vector2i(0, -1))
	elif event.is_action_pressed("ui_down"):
		_step(Vector2i(0, 1))
	elif event.is_action_pressed("ui_left"):
		_step(Vector2i(-1, 0))
	elif event.is_action_pressed("ui_right"):
		_step(Vector2i(1, 0))
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_1: _on_skill("attack")
			KEY_2: _on_skill("fire")
			KEY_3: _on_skill("heal")
			KEY_SPACE: _on_skill("attack")

func _screen_to_cell(screen_pos: Vector2) -> Vector2i:
	# Inverse of Iso.project relative to camera (mirrors game.js inverse()).
	var wx := screen_pos.x - Iso.W * 0.5 + cam.position.x
	var wy := screen_pos.y - Iso.H * 0.55 + cam.position.y
	var gx := int(round(wx / Iso.TW + wy / Iso.TH))
	var gy := int(round(wy / Iso.TH - wx / Iso.TW))
	return Vector2i(gx, gy)

func _tap(screen_pos: Vector2) -> void:
	if paused or player.hp <= 0.0:
		return
	# Enemy hit-test approx (26px wide, 60px tall above feet).
	var best: WindhillEnemy = null
	var best_d := 1e9
	for e in enemies:
		if e.hp <= 0.0:
			continue
		var sp := world.grid_to_screen(e.grid, cam.position)
		var d: float = absf(sp.x - screen_pos.x)
		if d < 26.0 and screen_pos.y > sp.y - 60.0 and screen_pos.y < sp.y + 12.0 and d < best_d:
			best = e
			best_d = d
	if best:
		target = best
		path = world.find_path(int(player.grid.x), int(player.grid.y), int(target.grid.x), int(target.grid.y))
		hud.set_notice("Target selected")
		_try_attack()
		return
	var cell := _screen_to_cell(screen_pos)
	if not world.valid(cell.x, cell.y):
		hud.set_notice("That tile is blocked")
		return
	target = null
	path = world.find_path(int(player.grid.x), int(player.grid.y), cell.x, cell.y)
	hud.set_notice("Following your path" if path.size() > 0 else "You are here")

func _step(d: Vector2i) -> void:
	if paused or player.moving:
		return
	var nx := int(player.grid.x) + d.x
	var ny := int(player.grid.y) + d.y
	if world.valid(nx, ny):
		target = null
		path.clear()
		player.order_move(Vector2i(nx, ny))

func _on_skill(kind: String) -> void:
	if paused or player.hp <= 0.0:
		return
	if kind == "attack":
		_try_attack()
	elif kind == "fire":
		if player.cooldowns["fire"] > 0.0:
			return
		if player.mp < 25.0:
			hud.set_notice("Not enough mana")
			return
		player.mp -= 25.0
		player.cooldowns["fire"] = 4.0
		for e in enemies:
			if e.hp > 0.0 and player.grid.distance_to(e.grid) < 3.2:
				e.take_damage(45, player)
		hud.set_notice("Fire burst")
	elif kind == "heal":
		if player.cooldowns["heal"] > 0.0:
			return
		if player.mp < 20.0:
			hud.set_notice("Not enough mana")
			return
		player.mp -= 20.0
		player.cooldowns["heal"] = 8.0
		player.heal_ticks = 5
		player.heal_tick = 1.0
		hud.set_notice("Regrowth · 18 HP each second")

func _try_attack() -> void:
	if not player.can_act():
		return
	var e: WindhillEnemy = target if target != null and target.hp > 0.0 else _nearest()
	if e == null:
		return
	if player.grid.distance_to(e.grid) > 1.6:
		target = e
		path = world.find_path(int(player.grid.x), int(player.grid.y), int(e.grid.x), int(e.grid.y))
		hud.set_notice("Approaching target…")
		return
	player.start_melee(e)

func _nearest() -> WindhillEnemy:
	var best: WindhillEnemy = null
	var bd := 1e9
	for e in enemies:
		if e.hp <= 0.0:
			continue
		var d := player.grid.distance_to(e.grid)
		if d < bd:
			bd = d
			best = e
	return best

func _on_enemy_died(e: WindhillEnemy) -> void:
	kills += 1
	gold += 5 + randi() % 5
	items += 1
	player.mp = minf(100.0, player.mp + 12.0)
	exp += 15 if e.monster_type == "mushroom" else 12
	while exp >= next_exp:
		exp -= next_exp
		level += 1
		next_exp = int(round(next_exp * 1.28))
	if target == e:
		target = null
		path.clear()
	hud.set_notice("Patrol complete! Keep exploring the grove." if kills >= 5 else "Creature defeated · %d/5" % kills)

func _on_hunt_toggle() -> void:
	auto_hunt = not auto_hunt
	hunt_cd = 0.0
	if not auto_hunt:
		target = null
		path.clear()
	hud.set_notice("Auto hunt enabled" if auto_hunt else "Auto hunt disabled")

func _on_pause() -> void:
	if player.hp <= 0.0:
		return
	paused = not paused
	get_tree().paused = paused

func _process(delta: float) -> void:
	if paused or player.hp <= 0.0:
		return
	# Follow queued path.
	if not player.moving and path.size() > 0:
		var cell: Vector2i = path.pop_front()
		if world.valid(cell.x, cell.y):
			player.order_move(cell)
	# Target pursuit mirrors game.js update().
	if target != null and target.hp > 0.0 and not player.moving:
		if player.grid.distance_to(target.grid) <= 1.5:
			path.clear()
			_try_attack()
	# AutoHunt .35s tick.
	hunt_cd -= delta
	if auto_hunt and hunt_cd <= 0.0:
		hunt_cd = 0.35
		_hunt_tick()
	# Camera lerp.
	cam_goal = Iso.project(player.grid)
	cam.position = cam.position.lerp(cam_goal, minf(1.0, delta * 7.0))
	hud.refresh(player, gold, items, kills, level, auto_hunt)
	hud.set_dots(enemies, player.grid)

func _hunt_tick() -> void:
	if target == null and (path.size() > 0 or player.moving):
		return
	if player.hp < 170.0 and player.mp >= 20.0 and player.cooldowns["heal"] == 0.0:
		_on_skill("heal")
	if target == null or target.hp <= 0.0:
		var cands := enemies.duplicate()
		cands.sort_custom(func(a, b): return player.grid.distance_to(a.grid) < player.grid.distance_to(b.grid))
		for e in cands:
			if e.hp <= 0.0:
				continue
			var route := world.find_path(int(player.grid.x), int(player.grid.y), int(e.grid.x), int(e.grid.y))
			if route.size() > 0 or player.grid.distance_to(e.grid) <= 1.5:
				target = e
				path = route
				break
	if target != null and target.hp > 0.0:
		if player.grid.distance_to(target.grid) < 2.5 and player.mp >= 45.0 and player.cooldowns["fire"] == 0.0:
			# Fire costs 25 but hunts only when comfortable (mirrors vanilla mp>=45 gate).
			_on_skill("fire")
