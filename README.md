# Windhill pawn RPG

Serve `dist/` with any static server. A fixed portrait 9:16 viewport stays centered on desktop.

## Gameplay

Tap a tile to walk or a creature to approach and attack. Open the character card through the portrait: current HP/MP, level, melee damage, critical chance/multiplier, patrol defeats, and three skill details. The card pauses simulation and restores the prior pause state when closed.

- Melee: 28 damage, 0.65s cooldown, no mana.
- Area burst: 45 damage within 3.2 tiles, 4s cooldown, 25 mana.
- Regrowth: 18 HP per second for five seconds, 8s cooldown, 20 mana. No instant healing. Green custom digit sprites show actual HP restored.
- Critical chance 20%, multiplier 1.6; custom regular and critical digits.
- Monsters respawn after eight seconds near their original spawn, on an unoccupied valid tile.
- Auto Hunt only changes through its button (or the matching development API). Map taps and arrow keys leave its enabled state unchanged. Movement orders finish before target acquisition resumes. Pause/death halt activity; restart preserves the button state.
- Desktop: arrow keys move, Space/1 melee, 2 area, 3 Regrowth.

## Rendering

Isometric projection: X=(x-y)*31, Y=(x+y)*15.5. Depth uses the continuously interpolated ground position: (x+y)*1000+x*0.01. Separate base and character images share movement bounce; shadows remain grounded. Character facing mirrors with a brief squash transition.

Terrain uses continuous painted grass and stone materials with pixel-identical opposite edges, a smooth path, and no per-tile texture restart. The invisible isometric movement grid can be shown through config. Terrain is cached and only the visible rectangle copied per frame. Static depths are pre-sorted and culled, then merged with moving pawns. Outlines are baked into optional textures; no per-frame shadow filters. Pathfinding reuses typed buffers.

Mobile performance mode defaults to 390×693 at 30 FPS. Quality mode allows 1.5× resolution/60 FPS. HUD updates approximately 8 Hz. Hidden pages skip rendering. Enable FPS in config to measure the actual device. No Android device benchmark was available; native desktop render checks are not Android FPS claims.

The game is a local simulation without multiplayer or server persistence. Config preferences stay on the device. Assets are original generated painterly fantasy artwork in replaceable WebP files.
