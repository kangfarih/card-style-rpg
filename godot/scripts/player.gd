class_name WindhillPlayer
extends CharacterBody2D
## Grid-step pawn. Parity: hp240 mp100, melee .65s, fire 4s/25MP, heal 8s/20MP 18x5.

signal changed

@export var grid := Vector2(13, 14)
var hp := 240.0
var mp := 100.0
var face := 1
var moving := false
var move_t := 0.0
var move_dur := 0.24
var move_from := Vector2.ZERO
var move_to := Vector2.ZERO
var cooldowns := {"attack": 0.0, "fire": 0.0, "heal": 0.0}
var heal_ticks := 0
var heal_tick := 0.0
var action_t := 0.0
var action_dur := 0.0
var action_kind := ""
var action_target: Node2D = null
var action_landed := false
var hit_flash := 0.0
var world: WindhillWorld = null

func setup(w: WindhillWorld, start: Vector2) -> void:
	world = w
	grid = start
	hp = 240.0
	mp = 100.0
	position = Iso.project(grid)

func _physics_process(delta: float) -> void:
	for k in cooldowns.keys():
		cooldowns[k] = maxf(0.0, cooldowns[k] - delta)
	mp = minf(100.0, mp + delta * 2.0)
	hit_flash = maxf(0.0, hit_flash - delta)
	if heal_ticks > 0:
		heal_tick -= delta
		if heal_tick <= 0.0:
			var amount := minf(18.0, 240.0 - hp)
			hp += amount
			heal_ticks -= 1
			heal_tick += 1.0
			changed.emit()
	if moving:
		move_t += delta
		var t := clampf(move_t / move_dur, 0.0, 1.0)
		var ease := t * t * (3.0 - 2.0 * t)
		var gp: Vector2 = move_from.lerp(move_to, ease)
		position = Iso.project(gp)
		if t >= 1.0:
			moving = false
			grid = move_to
			changed.emit()
	if action_dur > 0.0:
		action_t += delta
		if not action_landed and action_t >= 0.115 and action_kind == "melee":
			action_landed = true
			_try_melee_land()
		if action_t >= action_dur:
			action_dur = 0.0
			action_kind = ""

func order_move(cell: Vector2i) -> void:
	if moving:
		return
	var dx := float(cell.x) - grid.x
	var dy := float(cell.y) - grid.y
	var dir := dx - dy
	if dir != 0.0:
		face = 1 if dir > 0.0 else -1
	move_from = grid
	move_to = Vector2(cell)
	move_t = 0.0
	move_dur = 0.24
	moving = true

func can_act() -> bool:
	return action_dur <= 0.0 and cooldowns["attack"] <= 0.0 and hp > 0.0

func start_melee(target: Node2D) -> bool:
	if not can_act():
		return false
	cooldowns["attack"] = 0.65
	action_kind = "melee"
	action_t = 0.0
	action_dur = 0.22
	action_landed = false
	action_target = target
	if target != null:
		var d: Vector2 = (target as Node2D).get("grid") - grid if "grid" in target else Vector2.RIGHT
		var dir := d.x - d.y
		if dir != 0.0:
			face = 1 if dir > 0.0 else -1
	return true

func _try_melee_land() -> void:
	if action_target == null or not is_instance_valid(action_target):
		return
	if "hp" not in action_target:
		return
	if action_target.get("hp") <= 0.0:
		return
	var a: Vector2 = grid
	var b: Vector2 = action_target.get("grid")
	if a.distance_to(b) <= 1.8:
		action_target.take_damage(28, self)

func take_damage(n: int) -> void:
	hp = maxf(0.0, hp - n)
	hit_flash = 0.22
	changed.emit()
