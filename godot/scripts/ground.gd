class_name WindhillGround
extends Node2D
## Prerendered isometric ground: grass base, stone trail, stone+water river.
## Parity with game.js ground() trail abs(x-y)<2 + riverBank sine bend.

var world: WindhillWorld = null

func setup(w: WindhillWorld) -> void:
	world = w
	queue_redraw()

func _draw() -> void:
	if world == null:
		return
	var ox := Iso.N * Iso.TW * 0.5
	for x in range(Iso.N):
		for y in range(Iso.N):
			var p := Iso.project(Vector2(x, y))
			var pts := PackedVector2Array([
				p + Vector2(0, -Iso.TH * 0.5), p + Vector2(Iso.TW * 0.5, 0),
				p + Vector2(0, Iso.TH * 0.5), p + Vector2(-Iso.TW * 0.5, 0)])
			var col := Color("77895c")
			var on_trail: bool = abs(x - y) < 2 or (y >= 15 and y <= 16 and x > 10 and x < 23)
			var in_river := y >= 9 and y <= 11 and (x < 9 or x > 11)
			if in_river:
				col = Color("5a9da5") if y >= 9 and y <= 11 and (x < 8 or x > 12) else Color("b8b28c")
				# Inner water band vs bank (approx of riverBank clip).
				if y == 9 or y == 11:
					col = Color("b8b28c")
				else:
					col = Color("5a9da5")
			elif on_trail:
				col = Color("baae8b")
			draw_colored_polygon(pts, col)
			if world.is_blocked(x, y) and not in_river:
				draw_polyline(PackedVector2Array([pts[0], pts[1], pts[2], pts[3], pts[0]]), Color(0, 0, 0, 0.08), 1.0)
