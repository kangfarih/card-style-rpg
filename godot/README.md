# Windhill Godot Rewrite (parity grove)

Godot 4.6.1 port of `../dist` (vanilla web build). Original is **untouched** — this lives in the same repo under `godot/`.

## Quick start

1. Open `godot/project.godot` in Godot 4.6.1 (templates must match exactly).
2. Press `F5` — desktop run, `390x693` portrait viewport.
3. Web: `Project > Export > Web (single-threaded, mobile-safe)` — single-threaded = no `COOP/COEP` headers, works on plain static hosts + mobile Safari.
4. Serve export: `python3 -m http.server 8000 --directory builds/web`.

## Parity mapping (vanilla `game.js` -> Godot)

| Vanilla | Godot |
|---|---|
| `project/inverse/depth N=28 TW=62 TH=31` | `scripts/iso.gd` (static) + `TileMapLayer` iso `62x31` |
| `init()` procedural + `blocked` | `scripts/world.gd` builds from `data/grove.json`, fallback procedural |
| `makeEnemy()` | `scenes/Enemy.tscn` + `scripts/enemy.gd` |
| `damage/skill/update/huntTick/respawn` | `scripts/combat.gd` (autoload `Combat`) + `skills.tres` |
| `updateHUD/drawMinimap/updateCard` | `scenes/HUD.tscn` + `scripts/hud.gd` |
| `localStorage windhill-*` | `user://windhill.cfg` via `scripts/save.gd` |
| `window.windhill` debug | Godot `OS.has_feature("editor")` debug panel (same API names) |

## Edit locally (replaces architect-mode plan)

* Open `scenes/Main.tscn` in editor: paint `TileMapLayer Ground/Props`, drag `Enemy.tscn` / prop markers, tune numbers in Inspector (`skills.tres`, enemy `@export` vars).
* Files in `data/` are permanent source of truth. `Export JSON` in-game (HUD debug) writes back for commit.
* Fixed for now: spawns `slime|mushroom` only, gold `[5,9]`, exp `slime:12 mushroom:15`.

## Layout

```
project.godot  export_presets.cfg
data/grove.json  data/balance.json  data/meta.json
scenes/Main.tscn  Player.tscn  Enemy.tscn  Prop.tscn  HUD.tscn
scripts/*.gd  assets/*.webp (copied from original dist/)
builds/web/  builds/android/
```
