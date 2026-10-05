"""Prepare generated reference-style artwork for the mobile renderer."""
from pathlib import Path
from PIL import Image, ImageFilter
import json, shutil
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets'
manifest = json.loads((ROOT / 'art-source/manifest.json').read_text())

def source(name):
    return Image.open(ROOT / 'art-source' / manifest[name]['file']).convert('RGBA')

def sprite(name, size):
    im = source(name)
    alpha = np.array(im.getchannel('A'))
    ys, xs = np.where(alpha > 20)
    if not len(xs):
        raise ValueError('Empty image: ' + name)
    im = im.crop((max(0,int(xs.min())-2), max(0,int(ys.min())-2), min(im.width,int(xs.max())+3), min(im.height,int(ys.max())+3)))
    padding=4 if name in ('hero-clean','slime-clean','mushroom-clean') else 2
    im.thumbnail((size[0]-padding*2,size[1]-padding*2), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', size)
    cell.alpha_composite(im, ((size[0]-im.width)//2, size[1]-im.height-padding))
    im = cell
    im.save(OUT / (name + '.webp'), quality=88, method=6)
    return im

def outline(im, name):
    # Baked once at import; no runtime canvas filters.
    edge = Image.new('RGBA', im.size, (248,236,209))
    edge.putalpha(im.getchannel('A').filter(ImageFilter.MaxFilter(9)))
    edge.alpha_composite(im)
    edge.save(OUT / (name + '.webp'), quality=88, method=6)

for name in ('hero-clean','slime-clean','mushroom-clean','rocks-clean'):
    size = {'hero-clean':(110,156),'slime-clean':(96,78),'mushroom-clean':(96,94),'rocks-clean':(120,88)}[name]
    im = sprite(name,size)
    outline(im,name.removesuffix('-clean'))
im = sprite('base',(92,46))
for name in ('oak','pine','birch','fern','flowers','berries'):
    im = sprite(name,{'oak':(296,368),'pine':(264,376),'birch':(220,340)}.get(name,(120,88)))
    outline(im,name+'-outlined')
for name,size in {'bridge':(288,208),'gate':(352,316),'fence':(176,120),'lantern':(88,216),'barrels':(106,106),'cart':(202,164)}.items():
    im=sprite(name,size)
    outline(im,name+'-outlined')
shutil.copyfile(OUT/'oak.webp',OUT/'tree-clean.webp')
shutil.copyfile(OUT/'oak-outlined.webp',OUT/'tree.webp')
for name in ('fx-slash','fx-burst','fx-wind','fx-heal'):
    sprite(name,(224,160))
for name in ('skill-melee','skill-area','skill-heal'):
    sprite(name,(144,144))
sprite('portrait',(192,192))
for old,new in [('icon-attack','skill-melee'),('icon-burst','skill-area'),('icon-dash','skill-melee'),('icon-heal','skill-heal')]:
    shutil.copyfile(OUT/(new+'.webp'),OUT/(old+'.webp'))

for name in ('terrain-grass','terrain-stone','terrain-water'):
    im = source(name).convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
    a = np.array(im).astype(float)
    # Blend only the edge strips into matching opposing edges.
    for axis in (0,1):
        for i in range(40):
            j=511-i
            weight=(1-i/40)**2*.5
            if axis==0:
                left,right=a[i].copy(),a[j].copy()
                a[i]=left*(1-weight)+right*weight
                a[j]=right*(1-weight)+left*weight
            else:
                left,right=a[:,i].copy(),a[:,j].copy()
                a[:,i]=left*(1-weight)+right*weight
                a[:,j]=right*(1-weight)+left*weight
    Image.fromarray(np.clip(a,0,255).astype('uint8')).save(OUT/(name+'.webp'),quality=88,method=6)
for old,new in [('floor-grass-a','terrain-grass'),('floor-grass-b','terrain-grass'),('floor-moss','terrain-grass'),('floor-path','terrain-stone')]:
    shutil.copyfile(OUT/(new+'.webp'),OUT/(old+'.webp'))

im=source('digits')
for row,prefix in enumerate(('digit','crit','heal')):
    part=im.crop((0,round(row*im.height/3),im.width,round((row+1)*im.height/3)))
    mask=np.array(part.getchannel('A'))>100
    projection=mask.sum(axis=0)>3
    edges=np.diff(np.pad(projection.astype(int),(1,1)))
    starts=np.where(edges==1)[0]; ends=np.where(edges==-1)[0]
    runs=[(int(l),int(r)) for l,r in zip(starts,ends) if r-l>15]
    if len(runs)!=10: raise ValueError(f'Expected 10 distinct {prefix} digits, got {runs}')
    for digit,(left,right) in enumerate(runs):
        glyph=part.crop((max(0,left-2),0,min(im.width,right+2),part.height))
        bbox=glyph.getbbox()
        if not bbox: raise ValueError(f'Missing digit {prefix}-{digit}')
        glyph=glyph.crop(bbox)
        glyph.thumbnail((44,59),Image.Resampling.LANCZOS)
        cell=Image.new('RGBA',(48,64))
        cell.alpha_composite(glyph,((48-glyph.width)//2,64-glyph.height-2))
        cell.save(OUT/(prefix+'-'+str(digit)+'.webp'),quality=94,method=6)
print('Prepared reference artwork:',sum(p.stat().st_size for p in OUT.glob('*.webp')),'bytes')
