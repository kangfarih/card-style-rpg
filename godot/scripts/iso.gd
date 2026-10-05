class_name Iso
extends RefCounted
## Isometric projection mirror of vanilla game.js project()/depth().
## TW=62, TH=31, N=28. Screen = project - cam + (W/2, H*0.55).

const TW := 62.0
const TH := 31.0
const N := 28
const W := 390.0
const H := 693.0

static func project(g: Vector2) -> Vector2:
	return Vector2((g.x - g.y) * TW * 0.5, (g.x + g.y) * TH * 0.5)

static func depth(g: Vector2) -> float:
	return (g.x + g.y) * 1000.0 + g.x * 0.01

static func in_bounds(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < N and y < N

static func tile_key(x: int, y: int) -> String:
	return "%d,%d" % [x, y]

static func dist(a: Vector2, b: Vector2) -> float:
	return a.distance_to(b)
