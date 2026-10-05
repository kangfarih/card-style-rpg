"""Collect completed image-generation outputs and record provenance prompts."""
from pathlib import Path
import json, shutil
root=Path(__file__).resolve().parents[1]
art=root/'art-source'
expected=['hero-clean','slime-clean','mushroom-clean','base','oak','pine','birch','fern','flowers','berries','rocks-clean','bridge','gate','fence','lantern','barrels','cart','fx-slash','fx-burst','fx-wind','fx-heal','skill-melee','skill-area','skill-heal','portrait','terrain-grass','terrain-stone','terrain-water','digits']
mapping={'hero-clean':'hero-adult','portrait':'portrait-adult'}
manifest={}
for name in expected:
    info=json.loads((art/(mapping.get(name,name)+'.json')).read_text())
    dest=art/(name+'.png')
    shutil.copyfile(info['path'],dest)
    manifest[name]={'file':dest.name,'prompt':info['prompt']}
(art/'manifest.json').write_text(json.dumps(manifest,indent=2))
(art/'PROMPTS.md').write_text('# Whimsical woodland art prompts\n\nGenerated with the built-in image-generation tool. The supplied Whimsical woodland standee RPG battle image is the style reference. The previous in-game hero is the proportion and identity reference for the character.\n\n'+'\n'.join('## '+name+'\n\n'+v['prompt']+'\n' for name,v in manifest.items()))
print('Collected',len(manifest),'original assets')
