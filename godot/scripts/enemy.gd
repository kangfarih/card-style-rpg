class_name WindhillEnemy
extends CharacterBody2D
## Parity with game.js makeEnemy/update: HP80, dmg12, aggro<5, attack<1.6 delay .65.

signal died(enemy: WindhillEnemy)
signal changed

@export var monster_type := "slime"
@export var display_name := "Forest Slime"
@export var grid := Vector2(8, 12)
@export var spawn := Vector2(8, 12)

var hp := 80.0
var max_hp := 80.0
var face := -1
var timer := 1.0
var attack_at := 0.0
var dead := 0.0
var respawn := 0.0
var hit_flash := 0.0
var moving := false
var move_t := 0.0
var move_dur := 0.5
var move_from := Vector2.ZERO
var move_to := Vector2.ZERO
var world: WindhillWorld = null
var player_ref: WindhillPlayer = null

func setup(w: WindhillWorld, p: WindhillPlayer, cell: Vector2, kind: String, label: String, index: int) -> void:
	world = w
	player_ref = p
	grid = cell
	spawn = cell
	monster_type = kind
	display_name = label
	max_hp = 80.0
	hp = max_hp
	timer = 1.0 + float(index) * 0.2
	position = Iso.project(grid)

func _physics_process(delta: float) -> void:
	hit_flash = maxf(0.0, hit_flash - delta)
	if hp <= 0.0:
		dead = maxf(0.0, dead - delta)
		if respawn > 0.0:
			respawn -= delta
			if respawn <= 0.0:
				_try_respawn()
		return
	if moving:
		move_t += delta
		var t := clampf(move_t / move_dur, 0.0, 1.0)
		var ease := t * t * (3.0 - 2.0 * t)
		position = Iso.project(move_from.lerp(move_to, ease))
		if t >= 1.0:
			moving = false
			grid = move_to
		return
	if attack_at > 0.0:
		attack_at -= delta
		if attack_at <= 0.0 and player_ref != null and grid.distance_to(player_ref.grid) < 1.6:
			player_ref.take_damage(12)
			if player_ref.hp <= 0.0:
				get_tree().paused = true
		return
	timer -= delta
	if timer <= 0.0 and not moving and attack_at <= 0.0 and player_ref != null:
		timer = 1.2
		var d := grid.distance_to(player_ref.grid)
		if d < 1.6:
			attack_at = 0.65
		elif d < 5.0 and world != null:
			var route := world.find_path(int(grid.x), int(grid.y), int(player_ref.grid.x), int(player_ref.grid.y))
			if route.size() > 0:
				_step_to(route[0], 0.5)

func _step_to(cell: Vector2i, dur: float) -> void:
	var dx := float(cell.x) - grid.x
	var dy := float(cell.y) - grid.y
	var dir := dx - dy
	if dir != 0.0:
		face = 1 if dir > 0.0 else -1
	move_from = grid
	move_to = Vector2(cell)
	move_t = 0.0
	move_dur = dur
	moving = true

func _combat() -> Node:
	return get_node_or_null("/root/Combat")

func take_damage(n: int, from: Node = null) -> void:
	if hp <= 0.0:
		return
	# Crit mirrors balance.json attack critChance/critMult (fallback 20% x1.6).
	var dealt := n
	var crit := false
	if from != null and from is WindhillPlayer:
		var cb := _combat()
		if cb != null and cb.has_method("roll_damage"):
			var r: Array = cb.call("roll_damage", n)
			dealt = int(r[0])
			crit = bool(r[1])
		else:
			crit = randf() < 0.2
			if crit:
				dealt = int(round(n * 1.6))
	hp = maxf(0.0, hp - dealt)
	hit_flash = 0.30 if crit else 0.22
	changed.emit()
	if hp <= 0.0:
		dead = 1.4
		var cb2 := _combat()
		var rs := 8.0
		if cb2 != null and "rules" in cb2:
			rs = float((cb2.get("rules") as Dictionary).get("respawnSec", 8.0))
		respawn = rs
		moving = false
		attack_at = 0.0
		died.emit(self)

func _try_respawn() -> void:
	if world == null or player_ref == null:
		respawn = 1.0
		return
	for radius in range(5):
		for dx in range(-radius, radius + 1):
			for dy in range(-radius, radius + 1):
				var x := int(spawn.x) + dx
				var y := int(spawn.y) + dy
				if not world.valid(x, y):
					continue
				if Vector2(x, y).distance_to(player_ref.grid) <= 1.5:
					continue
				grid = Vector2(x, y)
				spawn = grid
				hp = max_hp
				dead = 0.0
				respawn = 0.0
				attack_at = 0.0
				timer = 1.0
				position = Iso.project(grid)
				changed.emit()
				return
	respawn = 1.0
