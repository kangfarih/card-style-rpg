class_name WindhillHUD
extends CanvasLayer
## Portrait HUD parity: Lv, HP/MP, gold/items, kills, notice, skills, autohunt, minimap dots.

signal skill_pressed(kind: String)
signal autohunt_toggled
signal pause_toggled
signal reset_pressed

var level_l: Label
var hp_bar: ProgressBar
var mp_bar: ProgressBar
var hp_l: Label
var mp_l: Label
var gold_l: Label
var item_l: Label
var kills_l: Label
var coords_l: Label
var notice_l: Label
var btn_attack: Button
var btn_fire: Button
var btn_heal: Button
var btn_hunt: Button
var minimap: Control
var dots: Array = []

func _ready() -> void:
	layer = 10
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	var top := VBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.add_theme_constant_override("separation", 2)
	root.add_child(top)
	level_l = _mk_label(top, "Lv. 5  Grove Wanderer")
	var vit := HBoxContainer.new()
	top.add_child(vit)
	hp_bar = _mk_bar(vit, 240.0)
	mp_bar = _mk_bar(vit, 100.0)
	hp_l = _mk_label(top, "240 / 240")
	mp_l = _mk_label(top, "100 / 100")
	var row := HBoxContainer.new()
	top.add_child(row)
	gold_l = _mk_label(row, "Gold 0   ")
	item_l = _mk_label(row, "Items 0   ")
	kills_l = _mk_label(row, "0/5")
	coords_l = _mk_label(top, "GROVE · 13, 14")
	notice_l = _mk_label(top, "Tap a tile to travel")
	notice_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	minimap = _Minimap.new()
	minimap.custom_minimum_size = Vector2(96, 96)
	top.add_child(minimap)
	var bottom := VBoxContainer.new()
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.alignment = BoxContainer.ALIGNMENT_END
	root.add_child(bottom)
	var skills := HBoxContainer.new()
	skills.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom.add_child(skills)
	btn_attack = _mk_button(skills, "Melee (1)", "attack")
	btn_fire = _mk_button(skills, "Burst (2)", "fire")
	btn_heal = _mk_button(skills, "Regrow (3)", "heal")
	var util := HBoxContainer.new()
	util.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom.add_child(util)
	btn_hunt = Button.new()
	btn_hunt.text = "AUTO HUNT"
	btn_hunt.toggle_mode = true
	btn_hunt.toggled.connect(func(_on: bool) -> void: autohunt_toggled.emit())
	util.add_child(btn_hunt)
	var b_pause := Button.new()
	b_pause.text = "II"
	b_pause.pressed.connect(func() -> void: pause_toggled.emit())
	util.add_child(b_pause)
	var b_reset := Button.new()
	b_reset.text = "Reset"
	b_reset.pressed.connect(func() -> void: reset_pressed.emit())
	util.add_child(b_reset)

func _mk_label(parent: Control, t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", 13)
	parent.add_child(l)
	return l

func _mk_bar(parent: Control, mx: float) -> ProgressBar:
	var b := ProgressBar.new()
	b.min_value = 0.0
	b.max_value = mx
	b.value = mx
	b.custom_minimum_size = Vector2(150, 14)
	b.show_percentage = false
	parent.add_child(b)
	return b

func _mk_button(parent: Control, t: String, kind: String) -> Button:
	var b := Button.new()
	b.text = t
	b.pressed.connect(func() -> void: skill_pressed.emit(kind))
	parent.add_child(b)
	return b

func refresh(player: WindhillPlayer, gold: int, items: int, kills: int, level: int, auto_hunt: bool) -> void:
	level_l.text = "Lv. %d  Grove Wanderer" % level
	hp_bar.value = player.hp
	mp_bar.value = player.mp
	hp_l.text = "%d / 240" % int(ceil(player.hp))
	mp_l.text = "%d / 100" % int(player.mp)
	gold_l.text = "Gold %d   " % gold
	item_l.text = "Items %d   " % items
	kills_l.text = "%d/5" % mini(kills, 5)
	coords_l.text = "GROVE · %d, %d" % [int(player.grid.x), int(player.grid.y)]
	btn_hunt.button_pressed = auto_hunt
	btn_hunt.text = "HUNTING · ON" if auto_hunt else "AUTO HUNT"
	btn_attack.disabled = player.cooldowns["attack"] > 0.0
	btn_fire.disabled = player.cooldowns["fire"] > 0.0
	btn_heal.disabled = player.cooldowns["heal"] > 0.0

func set_notice(t: String) -> void:
	notice_l.text = t

func set_dots(enemies: Array, player_cell: Vector2) -> void:
	dots = []
	for e in enemies:
		if e.hp > 0.0:
			dots.append(Vector2(e.grid) )
	(minimap as _Minimap).update_dots(dots, player_cell)
	minimap.queue_redraw()

class _Minimap extends Control:
	var dots: Array = []
	var hero := Vector2(13, 14)
	func update_dots(d: Array, h: Vector2) -> void:
		dots = d
		hero = h
	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), Color("829063"))
		draw_rect(Rect2(Vector2(0, 9.0 / 28.0 * size.y), Vector2(size.x, 3.0 / 28.0 * size.y)), Color("649ba2"))
		var s := size.x / 28.0
		draw_rect(Rect2(Vector2(9 * s, 9 * s), Vector2(3 * s, 3 * s)), Color("b89865"))
		for d in dots:
			draw_rect(Rect2(Vector2(d.x * s - 1, d.y * s - 1), Vector2(2.5, 2.5)), Color("a84936"))
		draw_circle(hero * s, 3.0, Color("fff1a9"))
