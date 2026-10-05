extends Node
## Autoload `Combat` — parity with game.js damage()/skill() numbers.
## Loads data/balance.json at runtime; Inspector defaults match file (fixed locks enforced).

const BALANCE_PATH := "res://data/balance.json"

var skills := {
	"attack": {"damage": 28, "cooldown": 0.65, "mana": 0, "range": 1.6, "critChance": 0.2, "critMult": 1.6},
	"fire": {"damage": 45, "cooldown": 4.0, "mana": 25, "radius": 3.2},
	"heal": {"tick": 18, "duration": 5, "cooldown": 8.0, "mana": 20},
}
var templates := {
	"slime": {"hp": 80, "dmg": 12, "aggro": 5.0, "attackRange": 1.6, "attackDelay": 0.65, "moveCd": 0.5, "exp": 12},
	"mushroom": {"hp": 80, "dmg": 12, "aggro": 5.0, "attackRange": 1.6, "attackDelay": 0.65, "moveCd": 0.5, "exp": 15},
}
var rules := {"respawnSec": 8.0, "killTarget": 5, "mpOnKill": 12, "nextExpMult": 1.28, "huntTick": 0.35}
var hero_max := {"hp": 240, "mp": 100, "mpRegen": 2.0}

var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	_load_balance()

func _load_balance() -> void:
	if not FileAccess.file_exists(BALANCE_PATH):
		return
	var f := FileAccess.open(BALANCE_PATH, FileAccess.READ)
	var parsed = JSON.parse_string(f.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	if parsed.has("skills"):
		for k in skills.keys():
			if parsed["skills"].has(k):
				for stat in skills[k].keys():
					# Locked: gold/exp not editable here (enforced in data file, not skills).
					skills[k][stat] = float(parsed["skills"][k].get(stat, skills[k][stat])) if typeof(skills[k][stat]) == TYPE_FLOAT else int(parsed["skills"][k].get(stat, skills[k][stat]))
	if parsed.has("templates"):
		for t in templates.keys():
			if parsed["templates"].has(t):
				for stat in ["hp", "dmg"]:
					templates[t][stat] = int(parsed["templates"][t].get(stat, templates[t][stat]))
				for stat in ["aggro", "attackRange", "attackDelay", "moveCd"]:
					templates[t][stat] = float(parsed["templates"][t].get(stat, templates[t][stat]))
	if parsed.has("rules"):
		for k in rules.keys():
			if parsed["rules"].has(k):
				rules[k] = parsed["rules"][k]
	if parsed.has("hero"):
		for k in hero_max.keys():
			if parsed["hero"].has(k):
				hero_max[k] = parsed["hero"][k]

## Returns [dealt:int, critical:bool]. Mirrors game.js crit 20% x1.6.
func roll_damage(base: int) -> Array:
	var crit := rng.randf() < float(skills["attack"]["critChance"])
	var n := base
	if crit:
		n = int(round(base * float(skills["attack"]["critMult"])))
	return [n, crit]
