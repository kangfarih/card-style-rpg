'use strict';
const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d',{alpha:false});
const W=390,H=693,TW=62,TH=31,N=28;
const assets={};let ready=false;
let terrainCache=null,terrainKey='',hudElapsed=0,drawElapsed=0,fpsFrames=0,fpsElapsed=0,measuredFPS=0;
const ui={};function uiNode(id){return ui[id]||(ui[id]=document.querySelector(id))}
const staticProps=[];let minimapNext=-1,minimapStatic=null;

const defaults={hideEnvironment:true,hideCharacters:false,grid:false,coordinates:false,depthLabels:false,animation:true,freezeEnemies:false,speed:1,mobileMode:true,showFPS:false,combatSound:true,sfxVolume:.35,screenShake:true};
let config={...defaults};try{const saved=JSON.parse(localStorage.getItem('windhill-config')||'{}');for(const k in defaults){if(typeof saved[k]===typeof defaults[k])config[k]=saved[k]}config.speed=Math.max(.5,Math.min(2,config.speed));if(saved.terrainRevision!==3)config.grid=false;if(saved.artRevision!==2){config.hideEnvironment=true;config.hideCharacters=false}}catch{}

const foliage=['oak','pine','birch','fern','flowers','berries'];const ornaments=['bridge','gate','fence','lantern','barrels','cart'];
const cleanNames=['hero','slime','tree','rocks','mushroom'];
const paintedNames=['fx-slash','fx-burst','fx-wind','fx-heal','fx-impact','fx-critical','fx-dust','fx-claw','fx-death','loot-gold','loot-exp','loot-gel','loot-spore','loot-rare',...Array.from({length:10},(_,i)=>'digit-'+i),...Array.from({length:10},(_,i)=>'crit-'+i),...Array.from({length:10},(_,i)=>'heal-'+i),'terrain-grass','terrain-stone','terrain-water','bridge','gate','fence','lantern','barrels','cart'];
const names=[...paintedNames,'hero','slime','base','tree','rocks','mushroom',...foliage,...cleanNames.map(n=>n+'-clean'),...foliage.map(n=>n+'-outlined'),...ornaments.map(n=>n+'-outlined')];
Promise.all(names.map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{assets[name]=im;resolve()};im.onerror=reject;im.src=`assets/${name}.webp?v=combat-1`}))).then(()=>{terrainCache=null;minimapStatic=null;ready=true}).catch(()=>{notice('Artwork could not load. Please reload.')});
let autoHunt=false,huntTimer=0;const RESPAWN_SECONDS=8;
let hero,enemies,props,effects,path,target,paused=false,kills=0,time=0,last=0,cam={x:0,y:0},messageUntil=5,stepTime=.24,cooldowns={attack:0,fire:0,heal:0};
let hitStop=0,shakeTime=0,shakePower=0,combatSerial=0,combo={count:0,life:0},audioContext=null,audioNoise=null,audioBus=null,audioGain=null,audioVoices=[],audioLast={},lootDrops=[];
let progress={level:5,exp:0,nextExp:100,gold:0,items:0,slimeGel:0,mushroomSpore:0};try{progress={...progress,...JSON.parse(localStorage.getItem('windhill-progress')||'{}')}}catch{}
const blocked=new Set();const key=(x,y)=>`${x},${y}`;
const rnd=(x,y)=>{const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a)};
function project(x,y){return{x:(x-y)*TW/2,y:(x+y)*TH/2}}
function screen(x,y){const p=project(x,y);return{x:p.x-cam.x+W/2,y:p.y-cam.y+H*.55}}
function inverse(sx,sy){const x=sx-W/2+cam.x,y=sy-H*.55+cam.y;return{x:Math.round(x/TW+y/TH),y:Math.round(y/TH-x/TW)}}
function valid(x,y){return x>=0&&y>=0&&x<N&&y<N&&!blocked.has(key(x,y))}
function init(){
 huntTimer=0;syncHunt();hero={x:13,y:14,hp:240,mp:100,healTicks:0,healTick:0,face:1,flip:0,motion:null,action:null,hit:0,recoil:0};
 enemies=[];props=[];effects=[];path=[];target=null;kills=0;time=0;paused=false;hitStop=0;shakeTime=0;shakePower=0;combo={count:0,life:0};lootDrops=[];blocked.clear();terrainCache=null;minimapStatic=null;minimapNext=-1;
 const add=(x,y,type,solid=true,groundLayer=false)=>{props.push({x,y,type,groundLayer});if(solid)blocked.add(key(x,y))};
 // A continuous stream crosses the woodland; the bridge is its walkable crossing.
 for(let x=0;x<N;x++)for(let y=9;y<=11;y++)if(x<9||x>11)blocked.add(key(x,y));
 for(let x=0;x<N;x++)for(let y=0;y<N;y++){
  const edge=x<2||y<2||x>N-3||y>N-3;
  const nearTrail=Math.abs(x-y)<2||y===16;
  if(y>=9&&y<=11)continue;
  if((edge||rnd(x,y)>.91)&&!nearTrail&&Math.abs(x-y)>=4&&Math.hypot(x-13,y-14)>3){
   const kinds=['oak','pine','birch','rocks'];add(x,y,kinds[Math.floor(rnd(y,x)*kinds.length)]);
  }else if(!edge&&!nearTrail&&rnd(x+12,y+9)>.72){
   const kind=['flowers','fern','berries'][Math.floor(rnd(y+5,x)*3)];add(x+.15,y+.1,kind,false,true);
  }
 }
 // Authored landmarks and banks, rather than uniformly scattered props.
 add(7,7,'gate',false);add(10,10,'bridge',false,true);
 for(let x=0;x<N;x+=1.6)if(x<8.5||x>12){for(const y of [8.6,11.65]){const e={x:x+.15,y:y+Math.sin(x*.47)*.2,type:'rocks',groundLayer:true,scale:.5+rnd(x,y)*.25};props.push(e)}}
 for(const [x,y] of [[5,8],[8,8],[13,8],[16,8],[13,12],[16,12],[19,12]])add(x,y,'fence');
 for(const [x,y] of [[4,8],[7,12],[14,8],[18,12],[21,8],[24,12]])add(x,y,'rocks');
 add(9,13,'lantern');add(17,15,'lantern');add(12,13,'barrels');add(19,17,'cart');
 for(const [i,point] of [[10,13],[11,16],[15,12],[12,17],[16,14],[14,18]].entries()){
  add(point[0],point[1],foliage[i],i<3,i>=3);
 }
 staticProps.length=0;for(const e of props)if(!e.groundLayer)staticProps.push({e,prop:true,z:depth(e.x,e.y)});
 staticProps.sort((a,b)=>a.z-b.z);
 for(let i=0;i<9;i++){const x=8+(i*3)%14,y=12+(i*5)%12;if(valid(x,y))enemies.push(makeEnemy(x,y,i))}
 const p=project(hero.x,hero.y);cam={x:p.x,y:p.y};for(const k in cooldowns)cooldowns[k]=0;
 document.querySelector('#overlay').hidden=true;document.querySelector('#pause').textContent='Ⅱ';
 notice('Tap a tile to travel · tap a creature to attack');updateHUD();
}
function makeEnemy(x,y,i){return{x,y,hp:80,max:80,shownHp:80,face:-1,flip:0,motion:null,type:i%3===0?'mushroom':'slime',name:i%3===0?'Grove Mushroom':'Forest Slime',disposition:'aggressive',timer:1+i*.2,attackAt:0,spawn:{x,y},dead:0,respawn:0,hit:0,recoil:0}}
const pathQueue=new Uint16Array(N*N),pathPrevious=new Int16Array(N*N),pathVisited=new Uint32Array(N*N);let pathStamp=0;
function findPath(sx,sy,tx,ty){if(!valid(tx,ty)||!Number.isInteger(sx)||!Number.isInteger(sy))return[];const start=sx*N+sy,goal=tx*N+ty;pathStamp++;let head=0,tail=1;pathQueue[0]=start;pathVisited[start]=pathStamp;pathPrevious[start]=-1;
while(head<tail){const id=pathQueue[head++],x=Math.floor(id/N),y=id%N;if(id===goal){const result=[];for(let c=goal;c!==start;c=pathPrevious[c])result.push({x:Math.floor(c/N),y:c%N});return result.reverse()}for(let d=0;d<4;d++){const nx=x+(d===0?1:d===1?-1:0),ny=y+(d===2?1:d===3?-1:0),next=nx*N+ny;if(valid(nx,ny)&&pathVisited[next]!==pathStamp){pathVisited[next]=pathStamp;pathPrevious[next]=id;pathQueue[tail++]=next}}}return[]}
function changeFace(e,dx,dy){const direction=dx-dy;const face=direction===0?e.face:direction>0?1:-1;if(face!==e.face){e.face=face;e.flip=.18}}
function move(e,p,duration=stepTime){changeFace(e,p.x-e.x,p.y-e.y);e.motion={from:{x:e.x,y:e.y},to:p,t:0,duration:duration/config.speed}}
function position(e){if(!e.motion)return{x:e.x,y:e.y,bounce:0};const m=e.motion,t=Math.min(1,m.t/m.duration),ease=t*t*(3-2*t);return{x:m.from.x+(m.to.x-m.from.x)*ease,y:m.from.y+(m.to.y-m.from.y)*ease,bounce:config.animation?Math.sin(t*Math.PI)*7:0}}
function animateEntity(e,dt){e.flip=Math.max(0,e.flip-dt);if(e.motion){e.motion.t+=dt;if(e.motion.t>=e.motion.duration){e.x=e.motion.to.x;e.y=e.motion.to.y;e.motion=null}}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function nearest(){return enemies.filter(e=>e.hp>0).sort((a,b)=>distance(hero,a)-distance(hero,b))[0]}
function notice(text){document.querySelector('#notice').textContent=text;messageUntil=time+3.5}
function unlockAudio(){
 if(!config.combatSound||audioContext)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
 try{audioContext=new Audio();audioGain=audioContext.createGain();audioGain.gain.value=config.sfxVolume;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2400;filter.Q.value=.5;const limiter=audioContext.createDynamicsCompressor();limiter.threshold.value=-20;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;audioBus=audioContext.createGain();audioBus.gain.value=.65;audioBus.connect(filter);filter.connect(limiter);limiter.connect(audioGain);audioGain.connect(audioContext.destination)}catch{}
}
function sfx(kind){
 if(!config.combatSound||!audioContext||!audioBus)return;if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime;
 if(kind!=='levelup'&&now-(audioLast.levelup??-10)<1.1)return;if(now-(audioLast[kind]??-10)<(kind==='loot'?.09:.045))return;audioLast[kind]=now;audioVoices=audioVoices.filter(t=>t>now);if(kind!=='levelup'&&audioVoices.length>=8)return;audioVoices.push(now+.5);
 const tone=(freq,end,amp,duration,delay=0)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=now+delay;o.type='sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audioBus);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect()}};
 const brush=(amp,duration,freq)=>{if(!audioNoise){audioNoise=audioContext.createBuffer(1,audioContext.sampleRate*.5,audioContext.sampleRate);const d=audioNoise.getChannelData(0);let smooth=0;for(let i=0;i<d.length;i++){smooth=.78*smooth+.22*(Math.random()*2-1);d[i]=smooth}}const o=audioContext.createBufferSource(),f=audioContext.createBiquadFilter(),g=audioContext.createGain();o.buffer=audioNoise;f.type='lowpass';f.frequency.value=freq;f.Q.value=.4;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(amp,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(f);f.connect(g);g.connect(audioBus);o.start(now);o.stop(now+duration);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect()}};
 if(kind==='levelup'){tone(262,262,.075,.75);tone(392,392,.105,.55,.04);tone(494,494,.09,.6,.17);tone(587,587,.085,.65,.3);tone(784,784,.105,.95,.46);tone(988,988,.035,.8,.58)}
 else if(kind==='swing'){brush(.18,.15,1500)}
 else if(kind==='hit'||kind==='hurt'){tone(150,65,.18,.13);brush(.18,.08,1100)}
 else if(kind==='crit'){tone(185,65,.22,.18);tone(380,270,.055,.12,.025);brush(.24,.12,1700)}
 else if(kind==='area'){tone(115,48,.2,.3);brush(.25,.28,1000)}
 else if(kind==='death'){tone(140,55,.14,.28);brush(.15,.32,800)}
 else if(kind==='heal'){tone(440,440,.07,.3);tone(660,660,.045,.3,.1)}
 else if(kind==='item'){tone(520,520,.075,.22);tone(780,780,.04,.24,.06)}
 else if(kind==='loot'){tone(680,640,.055,.12)}
}
function kickCamera(power,duration){if(!config.screenShake)return;shakePower=Math.max(shakePower,power);shakeTime=Math.max(shakeTime,duration)}
function saveProgress(){try{localStorage.setItem('windhill-progress',JSON.stringify(progress))}catch{}}
function levelUpEffect(){
 effects.push({type:'levelUp',x:hero.x,y:hero.y,life:1.8,total:1.8});
 effects.push({type:'pickupText',x:hero.x,y:hero.y,label:'LEVEL UP · '+progress.level,color:'#ffe38a',life:1.8,total:1.8});
 unlockAudio();sfx('levelup');
}
function drawLevelUp(e,t){
 const h=position(hero),p=screen(h.x,h.y),alpha=Math.min(1,t/.08)*Math.min(1,(1-t)/.28),radius=18+Math.min(1,t/.35)*46;
 ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha;
 // Elliptical radial gradients reach zero alpha on every edge.
 ctx.save();ctx.translate(0,-66);ctx.scale(1,2.8);const beam=ctx.createRadialGradient(0,0,0,0,0,48);beam.addColorStop(0,'#fffbe8aa');beam.addColorStop(.22,'#fff1bb88');beam.addColorStop(.55,'#ffe29b38');beam.addColorStop(.8,'#ffe29b10');beam.addColorStop(1,'#ffe29b00');ctx.fillStyle=beam;ctx.fillRect(-48,-48,96,96);ctx.restore();
 for(let i=0;i<7;i++){const x=(i-3)*8+Math.sin(t*5+i)*3,top=-125-i%3*16;ctx.save();ctx.globalAlpha=alpha*.55;const ray=ctx.createLinearGradient(x,top,x,12);ray.addColorStop(0,'#fff4cf00');ray.addColorStop(.35,'#fff4cf77');ray.addColorStop(.75,'#fff4cf55');ray.addColorStop(1,'#fff4cf00');ctx.strokeStyle=ray;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,12);ctx.stroke();ctx.restore()}
 ctx.save();ctx.scale(1,.35);const halo=ctx.createRadialGradient(0,0,0,0,0,radius*1.3);halo.addColorStop(0,'#ffe9a033');halo.addColorStop(.6,'#ffe9a020');halo.addColorStop(1,'#ffe9a000');ctx.fillStyle=halo;ctx.fillRect(-radius*1.3,-radius*1.3,radius*2.6,radius*2.6);ctx.restore();
 ctx.strokeStyle='#ffebad';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(0,0,radius,radius*.36,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#f6cc6b';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,radius*.78,radius*.28,0,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.7,x=Math.cos(a)*radius,y=Math.sin(a)*radius*.36;ctx.fillStyle='#fff0b8';ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillRect(-2,-3,4,6);ctx.restore()}
 for(let i=0;i<22;i++){const phase=(t*1.3+i/22)%1,a=i*2.399,spread=20+phase*30,x=Math.cos(a)*spread,y=-phase*140;ctx.globalAlpha=alpha*Math.sin(phase*Math.PI);ctx.fillStyle=i%3?'#ffe9a0':'#faffef';ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+2,y);ctx.lineTo(x,y+4);ctx.lineTo(x-2,y);ctx.closePath();ctx.fill()}
 ctx.globalAlpha=alpha*Math.max(0,1-t*3);const flash=ctx.createRadialGradient(0,-32,0,0,-32,60);flash.addColorStop(0,'#fff9dfbb');flash.addColorStop(.25,'#fff6cf66');flash.addColorStop(1,'#fff6cf00');ctx.fillStyle=flash;ctx.fillRect(-60,-92,120,120);ctx.restore();
}
function awardLoot(drop){
 if(drop.kind==='gold')progress.gold+=drop.amount;
 else if(drop.kind==='exp'){
  progress.exp+=drop.amount;
  while(progress.exp>=progress.nextExp){progress.exp-=progress.nextExp;progress.level++;progress.nextExp=Math.round(progress.nextExp*1.28);levelUpEffect()}
 }else{progress.items+=drop.amount;if(drop.kind==='gel')progress.slimeGel+=drop.amount;else progress.mushroomSpore+=drop.amount;}
 saveProgress();
 sfx(drop.kind==='gold'||drop.kind==='exp'?'loot':'item');updateHUD();
}
function dropLoot(e){
 const exp=e.type==='mushroom'?15:12,gold=5+Math.floor(Math.random()*5),item=e.type==='mushroom'?'spore':'gel';
 const data=[['exp',exp],['gold',gold],[item,1]],rotation=Math.random()*Math.PI*2;
 data.forEach(([kind,amount],i)=>{const angle=rotation+i*Math.PI*2/3+(Math.random()-.5)*.35,radius=40+Math.random()*24;
 lootDrops.push({kind,amount,x:e.x,y:e.y,scatterX:Math.cos(angle)*radius,scatterY:Math.sin(angle)*radius*.48,lane:i-1,age:0,flight:.32+i*.025,rest:.14+i*.025,duration:.88+i*.06,done:false,spin:(Math.random()-.5)*.8});});
}
function updateLoot(dt){for(const l of lootDrops){l.age+=dt;if(!l.done&&l.age>=l.duration){l.done=true;awardLoot(l)}}lootDrops=lootDrops.filter(l=>!l.done)}
function floatingText(entity,value,options={}){const nearby=effects.filter(f=>f.type==='text'&&Math.abs(f.x-entity.x)<.2&&Math.abs(f.y-entity.y)<.2&&f.life>.55).length;effects.push({type:'text',x:entity.x,y:entity.y,text:String(value),critical:!!options.critical,healing:!!options.healing,incoming:!!options.incoming,lane:nearby%3-1,seed:++combatSerial,life:.82,total:.82})}
function damage(e,n,allowCrit=true,kind='melee'){
 if(e.hp<=0)return false;const critical=allowCrit&&Math.random()<.2;if(critical)n=Math.round(n*1.6);
 e.hp=Math.max(0,e.hp-n);e.hit=critical?.30:.22;e.recoil=critical?.22:.15;e.recoilFace=hero.face;
 floatingText(e,n,{critical});sfx(critical?'crit':'hit');effects.push({type:critical?'criticalImpact':'impact',x:e.x,y:e.y,life:critical?.36:.25,total:critical?.36:.25,face:hero.face});
 effects.push({type:'dust',x:e.x,y:e.y,life:.32,total:.32,face:hero.face});hitStop=Math.max(hitStop,critical?.095:.055);kickCamera(critical?5:2.8,critical?.22:.13);
 combo.count=combo.life>0?combo.count+1:1;combo.life=1.25;
 if(e.hp===0){kills++;sfx('death');hitStop=Math.max(hitStop,.11);kickCamera(4.2,.24);effects.push({type:'death',x:e.x,y:e.y,life:.7,total:.7});for(let i=0;i<7;i++)effects.push({type:'deathMote',x:e.x,y:e.y,seed:i+.37,life:.72+i*.025,total:.72+i*.025});dropLoot(e);e.dead=1.4;e.respawn=RESPAWN_SECONDS;e.motion=null;e.attackAt=0;hero.mp=Math.min(100,hero.mp+12);if(target===e){target=null;path=[]}notice(kills>=5?'Patrol complete! Keep exploring the grove.':`Creature defeated · ${kills}/5`)}
 return critical;
}
function startMelee(e){unlockAudio();sfx('swing');changeFace(hero,e.x-hero.x,e.y-hero.y);cooldowns.attack=.65;hero.action={type:'melee',target:e,t:0,duration:.22,impact:.115,landed:false}}
function attack(){if(paused||hero.hp<=0||cooldowns.attack>0||hero.action)return;const e=target&&target.hp>0?target:nearest();if(!e)return;if(distance(hero,e)>1.6){target=e;path=findPath(hero.motion?hero.motion.to.x:hero.x,hero.motion?hero.motion.to.y:hero.y,e.x,e.y);notice('Approaching target…');return}startMelee(e)}
function updateHeroAction(dt){const a=hero.action;if(!a)return;a.t+=dt;if(!a.landed&&a.t>=a.impact){a.landed=true;if(a.target.hp>0&&distance(hero,a.target)<=1.8){effects.push({type:'slash',x:a.target.x,y:a.target.y,life:.26,total:.26,face:hero.face});damage(a.target,28,true,'melee')}}if(a.t>=a.duration)hero.action=null}
function skill(name){if(name==='attack'){attack();return}if(paused||hero.hp<=0||cooldowns[name]>0)return;if(name==='fire'){if(hero.mp<25){notice('Not enough mana');return}hero.mp-=25;cooldowns.fire=4;unlockAudio();sfx('area');effects.push({type:'burst',x:hero.x,y:hero.y,life:.6,total:.6});enemies.filter(e=>distance(hero,e)<3.2).forEach((e,i)=>{effects.push({type:'impact',x:e.x,y:e.y,life:.26,total:.26,face:hero.face,delay:i*.025});damage(e,45,true,'area')});notice('Fire burst')}if(name==='heal'){if(hero.mp<20){notice('Not enough mana');return}hero.mp-=20;unlockAudio();sfx('heal');hero.healTicks=5;hero.healTick=1;cooldowns.heal=8;effects.push({type:'heal',x:hero.x,y:hero.y,life:.7,total:.7});notice('Regrowth · 18 HP each second')}updateHUD()}
function update(dt){time+=dt;for(const k in cooldowns)cooldowns[k]=Math.max(0,cooldowns[k]-dt);hero.mp=Math.min(100,hero.mp+dt*2);if(hero.healTicks>0){hero.healTick-=dt;if(hero.healTick<=0){const amount=Math.min(18,240-hero.hp);hero.hp+=amount;hero.healTicks--;hero.healTick+=1;if(amount>0){floatingText(hero,amount,{healing:true});effects.push({type:'heal',x:hero.x,y:hero.y,life:.35,total:.35})}}}hero.hit=Math.max(0,(hero.hit||0)-dt);hero.recoil=Math.max(0,(hero.recoil||0)-dt);updateHeroAction(dt);animateEntity(hero,dt);huntTimer-=dt;if(autoHunt&&huntTimer<=0){huntTimer=.35;huntTick()}if(target&&target.hp>0&&!hero.motion){if(distance(hero,target)<=1.5){path=[];attack()}else if(!path.length)path=findPath(hero.x,hero.y,target.x,target.y)}if(!hero.motion&&path.length)move(hero,path.shift());for(const e of enemies){if(!config.freezeEnemies)animateEntity(e,dt);e.hit=Math.max(0,(e.hit||0)-dt);e.recoil=Math.max(0,(e.recoil||0)-dt);e.shownHp+=(e.hp-e.shownHp)*Math.min(1,dt*7);if(e.hp<=0){e.dead=Math.max(0,e.dead-dt);if(!config.freezeEnemies){e.respawn-=dt;if(e.respawn<=0)respawnEnemy(e)}continue}if(config.freezeEnemies)continue;if(e.attackAt>0){e.attackAt-=dt;if(e.attackAt<=0&&distance(hero,e)<1.6){hero.hp=Math.max(0,hero.hp-12);hero.hit=.22;hero.recoil=.16;hero.recoilFace=e.face;floatingText(hero,12,{incoming:true});sfx('hurt');effects.push({type:'claw',x:hero.x,y:hero.y,life:.28,total:.28,face:e.face});hitStop=Math.max(hitStop,.045);kickCamera(2.2,.12);if(hero.hp===0){paused=true;document.querySelector('#overlaytitle').textContent='Return to the grove';document.querySelector('#resume').textContent='Try again';document.querySelector('#overlay').hidden=false}}}e.timer-=dt;if(e.timer<=0&&!e.motion&&e.attackAt<=0){e.timer=1.2+rnd(e.x,e.y);if(distance(hero,e)<1.6)e.attackAt=.65;else if(distance(hero,e)<5){const p=findPath(e.x,e.y,hero.x,hero.y);if(p.length)move(e,p[0],.5)}else{const dirs=[[1,0],[-1,0],[0,1],[0,-1]],d=dirs[Math.floor(rnd(e.x+time,e.y)*4)];if(valid(e.x+d[0],e.y+d[1]))move(e,{x:e.x+d[0],y:e.y+d[1]},.65)}}}updateLoot(dt);effects.forEach(e=>{e.life-=dt;if(e.delay)e.delay-=dt});effects=effects.filter(e=>e.life>0);combo.life=Math.max(0,combo.life-dt);if(combo.life===0)combo.count=0;shakeTime=Math.max(0,shakeTime-dt);if(shakeTime===0)shakePower=0;const hp=position(hero),p=project(hp.x,hp.y);cam.x+=(p.x-cam.x)*Math.min(1,dt*7);cam.y+=(p.y-cam.y)*Math.min(1,dt*7);hudElapsed+=dt;if(hudElapsed>=.12){hudElapsed=0;updateHUD()}}
function tile(x,y,fill,stroke){const p=screen(x,y);ctx.beginPath();ctx.moveTo(p.x,p.y-TH/2);ctx.lineTo(p.x+TW/2,p.y);ctx.lineTo(p.x,p.y+TH/2);ctx.lineTo(p.x-TW/2,p.y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function image(name,x,y,width,height,flip=1,alpha=1){if(!assets[name])return;const character=name==='hero'||name==='slime'||name==='mushroom',hide=character?config.hideCharacters:config.hideEnvironment;const selected=hide&&assets[name+'-clean']?assets[name+'-clean']:!hide&&assets[name+'-outlined']?assets[name+'-outlined']:assets[name];ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.scale(flip,1);ctx.drawImage(selected,-width/2,-height,width,height);ctx.restore()}
const propSize={oak:[148,184],pine:[132,188],birch:[110,170],tree:[148,184],rocks:[66,48],fern:[47,31],flowers:[54,36],berries:[51,34],gate:[176,158],fence:[88,60],lantern:[44,108],barrels:[53,53],cart:[101,82],bridge:[144,104]};
function ground(){
 const signature=config.grid+':'+config.coordinates+':'+config.hideEnvironment;
 if(!terrainCache||signature!==terrainKey){
  terrainKey=signature;terrainCache=document.createElement('canvas');terrainCache.width=N*TW;terrainCache.height=N*TH;
  const c=terrainCache.getContext('2d'),ox=N*TW/2,oy=TH/2;
  const polygon=(points)=>{c.beginPath();for(const [i,q]of points.entries()){const p=project(...q);i?c.lineTo(p.x+ox,p.y+oy):c.moveTo(p.x+ox,p.y+oy)}c.closePath()};
  const material=(name,color)=>{if(assets[name]){const pattern=c.createPattern(assets[name],'repeat');pattern.setTransform({a:1,b:0,c:0,d:.55,e:0,f:0});c.fillStyle=pattern}else c.fillStyle=color;c.fillRect(0,0,terrainCache.width,terrainCache.height)};
  material('terrain-grass','#77895c');
  // One continuous material for the whole trail; tiles do not each repeat a sprite.
  c.save();c.beginPath();for(let x=0;x<N;x++)for(let y=0;y<N;y++){
   if(Math.abs(x-y)>=2&&!(y>=15&&y<=16&&x>10&&x<23))continue;
   const p=project(x,y),px=p.x+ox,py=p.y+oy;
   c.moveTo(px,py-TH/2);c.lineTo(px+TW/2,py);c.lineTo(px,py+TH/2);c.lineTo(px-TW/2,py);c.closePath();
  }c.clip();material('terrain-stone','#baae8b');c.restore();
  const riverBank=(low,high)=>{const north=[],south=[];for(let x=-5;x<=N+5;x++){const bend=Math.sin(x*.47)*.22+Math.sin(x*1.3)*.09;north.push([x,low+bend]);south.unshift([x,high+bend])}polygon([...north,...south])};
  c.save();riverBank(8.6,11.6);c.clip();material('terrain-stone','#b8b28c');
  riverBank(9,11.2);c.clip();material('terrain-water','#5a9da5');c.restore();
  for(const e of props.filter(p=>p.groundLayer)){
   const p=project(e.x,e.y),size=propSize[e.type].map(v=>v*(e.scale||1)),name=config.hideEnvironment&&assets[e.type+'-clean']?e.type+'-clean':!config.hideEnvironment&&assets[e.type+'-outlined']?e.type+'-outlined':e.type;
   if(assets[name])c.drawImage(assets[name],p.x+ox-size[0]/2,p.y+oy+(e.type==='bridge'?44:7)-size[1],...size);
  }
  if(config.grid||config.coordinates)for(let x=0;x<N;x++)for(let y=0;y<N;y++){
   const p=project(x,y),px=p.x+ox,py=p.y+oy;
   if(config.grid){polygon([[x-.5,y],[x,y-.5],[x+.5,y],[x,y+.5]]);c.strokeStyle='#283d3635';c.stroke()}
   if(config.coordinates){c.fillStyle='#172b2699';c.font='8px system-ui';c.textAlign='center';c.fillText(x+','+y,px,py+3)}
  }
 }
 const sx=cam.x-W/2+N*TW/2,sy=cam.y-H*.55+TH/2,x=Math.max(0,sx),y=Math.max(0,sy);
 const width=Math.min(terrainCache.width-x,W-(x-sx)),height=Math.min(terrainCache.height-y,H-(y-sy));
 if(width>0&&height>0)ctx.drawImage(terrainCache,x,y,width,height,x-sx,y-sy,width,height);
}
// Painter's algorithm: depth is the continuously interpolated foot position.
// Base and character are one sortable unit; their independent images are drawn base-first.
function depth(x,y){return (x+y)*1000+x*.01}
function mobNameColor(e){return e.disposition==='friendly'||e.isNPC?'#90e6a1':e.disposition==='passive'?'#ffbb70':'#ff8275'}
function drawPawn(e,isHero){
 const p=position(e),s=screen(p.x,p.y),alive=isHero||e.hp>0,alpha=alive?1:e.dead/1.4;
 let actionX=0,actionY=0,actionTilt=0,actionScaleX=1,actionScaleY=1;const deathT=!isHero&&!alive?Math.max(0,Math.min(1,1-e.dead/1.4)):0;if(deathT){actionY=deathT*9;actionTilt=e.face*deathT*.72;actionScaleX=1+deathT*.12;actionScaleY=1-deathT*.62}
 if(isHero&&e.action){const q=Math.min(1,e.action.t/e.action.duration);if(q<.52){const wind=q/.52;actionX=-e.face*Math.sin(wind*Math.PI/2)*5;actionTilt=-e.face*wind*.08;actionScaleX=1-wind*.08;actionScaleY=1+wind*.05}else{const lunge=(q-.52)/.48;actionX=e.face*Math.sin(lunge*Math.PI)*13;actionTilt=e.face*Math.sin(lunge*Math.PI)*.16;actionScaleX=1+Math.sin(lunge*Math.PI)*.13;actionScaleY=1-Math.sin(lunge*Math.PI)*.08}}
 const recoil=(e.recoil||0)>0?Math.sin((e.recoil/(isHero?.16:.22))*Math.PI)*-(e.recoilFace||e.face)*7:0;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(actionX+recoil,actionY);ctx.fillStyle='#102a2460';ctx.beginPath();ctx.ellipse(s.x,s.y+3,22,10,0,0,Math.PI*2);ctx.fill();
 if(isHero||target===e){ctx.strokeStyle=isHero?'#f4d382':'#fa7862';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.x,s.y,23,11,0,0,Math.PI*2);ctx.stroke()}
 image('base',s.x,s.y+9-p.bounce,46,23);const flip=e.face*(config.animation&&e.flip?Math.max(.12,Math.abs(1-e.flip/.09)):1);const characterHeight=isHero?78:e.type==='mushroom'?47:39;
 ctx.save();ctx.translate(s.x,s.y-2-p.bounce);ctx.rotate(actionTilt);ctx.scale(actionScaleX,actionScaleY);ctx.translate(-s.x,-(s.y-2-p.bounce));
 if(e.hit>0){ctx.globalAlpha=.35;image(isHero?'hero':e.type,s.x,s.y-2-p.bounce,isHero?61:53,characterHeight*1.05,flip)}
 image(isHero?'hero':e.type,s.x,s.y-2-p.bounce,isHero?55:48,characterHeight,flip);ctx.restore();
 if(!isHero&&alive&&(e.hp<e.max||target===e)){const top=s.y-characterHeight-15-p.bounce;ctx.fillStyle='#101b16dd';ctx.fillRect(s.x-21,top-1,42,7);ctx.fillStyle='#e4b15c';ctx.fillRect(s.x-20,top,40*Math.max(0,e.shownHp)/e.max,5);ctx.fillStyle='#d84d3e';ctx.fillRect(s.x-20,top,40*e.hp/e.max,5);ctx.strokeStyle='#e7d5a077';ctx.strokeRect(s.x-20.5,top-.5,41,6)}ctx.restore();
 if(!isHero&&alive){ctx.save();ctx.textAlign='center';ctx.textBaseline='bottom';ctx.font='700 12px WindhillSerif';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#15221fee';ctx.fillStyle=mobNameColor(e);const label=e.name||(e.isNPC?'Grove Resident':e.type==='mushroom'?'Grove Mushroom':'Forest Slime'),y=s.y-characterHeight-20-p.bounce;ctx.strokeText(label,s.x,y);ctx.fillText(label,s.x,y);ctx.restore()}
}
function drawLoot(){
 const hp=position(hero),heroScreen=screen(hp.x,hp.y);
 for(const l of lootDrops){const origin=screen(l.x,l.y),landX=origin.x+l.scatterX,landY=origin.y+l.scatterY,flight=l.flight,magnet=flight+l.rest;let x,y,scale=1,alpha=1,turn=0;
 if(l.age<flight){const t=l.age/flight;x=origin.x+l.scatterX*t;y=origin.y+l.scatterY*t-4-4*t*(1-t)*58;scale=.65+.35*Math.min(1,t*4);turn=l.spin*Math.sin(t*Math.PI)}
 else if(l.age<magnet){const t=(l.age-flight)/l.rest;x=landX;y=landY-Math.max(0,Math.sin(t*Math.PI*2))*9*Math.exp(-t*5)}
 else{const t=Math.min(1,(l.age-magnet)/(l.duration-magnet)),ease=t*t;x=landX+(heroScreen.x-landX)*ease;y=landY+(heroScreen.y-42-landY)*ease-Math.sin(t*Math.PI)*15;scale=1-.55*t;alpha=t>.8?(1-t)/.2:1}
 ctx.save();ctx.globalAlpha=alpha;if(l.age<magnet){ctx.fillStyle='#10251f55';ctx.beginPath();ctx.ellipse(l.age<flight?origin.x+l.scatterX*l.age/flight:landX,l.age<flight?origin.y+l.scatterY*l.age/flight:landY,10,4,0,0,Math.PI*2);ctx.fill();if(l.age>=flight){ctx.globalAlpha=.2+.12*Math.sin(time*6);ctx.fillStyle=l.kind==='gold'?'#ffd45a':l.kind==='exp'?'#7ee9ff':'#a9ef99';ctx.beginPath();ctx.ellipse(landX,landY,17,6,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=alpha}}
 ctx.translate(x,y);ctx.rotate(turn);image({gold:'loot-gold',exp:'loot-exp',gel:'loot-gel',spore:'loot-spore'}[l.kind],0,7,28*scale,28*scale);ctx.restore();
 }
}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#334e40';ctx.fillRect(0,0,W,H);ctx.save();const shake=shakeTime>0?shakePower*(shakeTime<.05?shakeTime/.05:1):0;ctx.translate(shake?Math.sin(time*173)*shake:0,shake?Math.cos(time*211)*shake*.65:0);ground();path.slice(0,8).forEach((p,i)=>tile(p.x,p.y,'#eecb6b35',i===path.length-1?'#fff4b9':'#f9d77b'));enemies.filter(e=>e.attackAt>0).forEach(e=>{tile(e.x,e.y,'#f8554b65','#ff9b70');for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])tile(e.x+dx,e.y+dy,'#f8554b35','#ed846b80')});const dynamic=[{e:hero,hero:true},...enemies.filter(e=>e.hp>0||e.dead>0).map(e=>({e}))];for(const o of dynamic){const p=position(o.e);o.z=depth(p.x,p.y)}dynamic.sort((a,b)=>a.z-b.z);const visible=staticProps.filter(o=>{const s=screen(o.e.x,o.e.y);return s.x>-100&&s.x<W+100&&s.y>-40&&s.y<H+195});const renderables=[];let pi=0,di=0;while(pi<visible.length||di<dynamic.length){if(di>=dynamic.length||(pi<visible.length&&visible[pi].z<dynamic[di].z))renderables.push(visible[pi++]);else renderables.push(dynamic[di++])}for(const o of renderables){if(o.prop){const s=screen(o.e.x,o.e.y);if(s.x<-100||s.x>W+100||s.y<-100||s.y>H+195)continue;image(o.e.type,s.x,s.y+9,...(propSize[o.e.type]||[60,44]))}else drawPawn(o.e,o.hero);if(config.depthLabels){const p=position(o.e),s=screen(p.x,p.y);ctx.fillStyle='#10251fe0';ctx.fillRect(s.x-30,s.y+10,60,14);ctx.fillStyle='#ffe2a1';ctx.font='9px ui-monospace';ctx.textAlign='center';ctx.fillText('z '+Math.round(depth(p.x,p.y)),s.x,s.y+20)}}for(const e of effects){if(e.delay>0)continue;const p=e.type==='pickupText'&&e.label.startsWith('LEVEL UP')?screen(position(hero).x,position(hero).y):screen(e.x,e.y),t=Math.max(0,1-e.life/e.total);ctx.save();if(e.type==='levelUp'){drawLevelUp(e,t)}else if(e.type==='pickupText'){const u=1-e.life/e.total;ctx.globalAlpha=u<.72?1:Math.max(0,1-(u-.72)/.28);ctx.textAlign='center';ctx.font='700 13px WindhillSerif';ctx.lineWidth=3;ctx.strokeStyle='#173020';ctx.fillStyle=e.color||'#fff1c4';ctx.strokeText(e.label,p.x+(e.lane||0)*22,p.y-65-u*28);ctx.fillText(e.label,p.x+(e.lane||0)*22,p.y-65-u*28)}else if(e.type==='deathMote'){const a=e.seed*6.283,t=1-e.life/e.total,dist=18+t*45;ctx.globalAlpha=1-t;ctx.fillStyle=e.seed%2>.5?'#fff0a8':'#8de1c7';ctx.beginPath();ctx.arc(p.x+Math.cos(a)*dist,p.y-28-Math.sin(a)*dist-t*15,2.8*(1-t*.5),0,Math.PI*2);ctx.fill()}else if(e.type==='text'){const pop=Math.min(1,t/.1),settle=t<.1?1+(1-pop)*.65:1+.1*Math.sin((t-.1)/.18*Math.PI)*Math.max(0,1-(t-.1)/.18);const shrink=t<.55?1:Math.max(0,1-Math.pow((t-.55)/.45,1.25));const rise=140*t-180*t*t;const drift=(e.lane||0)*(8+12*t);ctx.globalAlpha=t<.85?1:Math.max(0,(1-t)/.15);drawDamage(e.text,p.x+drift,p.y-48-rise,e.critical,settle*shrink*(e.critical?1.16:1),e.healing,e.incoming,t)}else{const effectName={slash:'fx-slash',burst:'fx-burst',wind:'fx-wind',heal:'fx-heal',impact:'fx-impact',criticalImpact:'fx-critical',dust:'fx-dust',claw:'fx-claw',death:'fx-death'}[e.type];const impact=e.type==='impact'||e.type==='criticalImpact'||e.type==='claw'||e.type==='death';const size=e.type==='burst'?80+t*90:e.type==='heal'?60+t*50:e.type==='death'?115+t*65:e.type==='criticalImpact'?100+t*35:e.type==='impact'?58+t*26:e.type==='dust'?48+t*20:e.type==='claw'?62+t*22:e.type==='wind'?60+t*40:60+t*18;ctx.globalAlpha=impact?Math.max(0,1-t):e.type==='dust'?Math.max(0,.75-t*.75):1-t;const height=e.type==='burst'?size*.7:e.type==='dust'?size*.55:size*.8;image(effectName,p.x+(e.face||1)*(e.type==='dust'?-7:0),p.y-5+height*.35,size,height,e.face||1)}ctx.restore()}drawLoot();ctx.restore();if(combo.count>=2&&combo.life>0){ctx.save();ctx.globalAlpha=Math.min(1,combo.life*2);ctx.textAlign='right';ctx.fillStyle='#fff1bf';ctx.strokeStyle='#512d1e';ctx.lineWidth=4;ctx.font='700 25px WindhillSerif';ctx.strokeText(combo.count+' HIT',W-20,H*.39);ctx.fillText(combo.count+' HIT',W-20,H*.39);ctx.restore()}if(config.showFPS){ctx.fillStyle='#10251fe0';ctx.fillRect(12,142,108,23);ctx.fillStyle='#d6e8b0';ctx.font='12px WindhillSerif';ctx.textAlign='left';ctx.fillText(measuredFPS+' FPS · '+(config.mobileMode?'mobile':'quality'),18,158)}if(!ready){ctx.fillStyle='#16382bea';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f1d59b';ctx.textAlign='center';ctx.font='18px WindhillSerif';ctx.fillText('Opening the grove…',W/2,H/2)}}
function updateHUD(){drawMinimap();uiNode('#goldvalue').textContent=progress.gold.toLocaleString();uiNode('#itemvalue').textContent=progress.items;uiNode('#levelvalue').textContent='Lv. '+progress.level;uiNode('#expbar').style.width=progress.exp/progress.nextExp*100+'%';uiNode('#exptext').textContent='EXP '+progress.exp+' / '+progress.nextExp;uiNode('#hpbar').style.width=hero.hp/240*100+'%';uiNode('#mpbar').style.width=hero.mp+'%';uiNode('#hptext').textContent=`${Math.ceil(hero.hp)} / 240`;uiNode('#mptext').textContent=`${Math.floor(hero.mp)} / 100`;uiNode('#kills').textContent=`${Math.min(kills,5)}/5`;uiNode('#coords').textContent=`GROVE · ${hero.x}, ${hero.y}`;document.querySelectorAll('[data-skill]').forEach(b=>{const cd=cooldowns[b.dataset.skill];b.disabled=cd>0;const em=b.querySelector('em');em.style.display=cd>0?'flex':'none';em.textContent=Math.ceil(cd)+'s';if(b.dataset.skill==='heal')b.classList.toggle('active',hero.healTicks>0)});if(time>messageUntil)document.querySelector('#notice').textContent=autoHunt?'Auto hunt active · use the button to stop':target?'Pursuing target · tap a tile to disengage':'Tap a tile to move'}
canvas.addEventListener('pointerdown',ev=>{unlockAudio();if(paused||!ready)return;const r=canvas.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*W,y=(ev.clientY-r.top)/r.height*H;const hit=enemies.filter(e=>e.hp>0).map(e=>({e,s:screen(position(e).x,position(e).y)})).reverse().find(o=>Math.abs(o.s.x-x)<26&&y>o.s.y-60&&y<o.s.y+12);if(hit){target=hit.e;path=findPath(hero.motion?hero.motion.to.x:hero.x,hero.motion?hero.motion.to.y:hero.y,target.x,target.y);notice('Target selected');attack();return}const p=inverse(x,y);if(!valid(p.x,p.y)){notice('That tile is blocked');return}target=null;path=findPath(hero.motion?hero.motion.to.x:hero.x,hero.motion?hero.motion.to.y:hero.y,p.x,p.y);notice(path.length?'Following your path':'You are here')});
function togglePause(){if(hero.hp<=0)return;paused=!paused;document.querySelector('#overlaytitle').textContent='Taking a breather';document.querySelector('#resume').textContent='Continue';document.querySelector('#overlay').hidden=!paused;document.querySelector('#pause').textContent=paused?'▶':'Ⅱ'}
document.querySelector('#pause').onclick=togglePause;document.querySelector('#resume').onclick=()=>hero.hp<=0?init():togglePause();document.querySelector('#reset').onclick=init;document.querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>skill(b.dataset.skill));document.querySelector('#help').onclick=()=>{paused=true;document.querySelector('#helpdialog').showModal()};document.querySelector('#closehelp').onclick=()=>document.querySelector('#helpdialog').close();document.querySelector('#helpdialog').addEventListener('close',()=>{paused=false});window.addEventListener('keydown',e=>{if(document.querySelector('#helpdialog').open||document.querySelector('#configdialog').open||document.querySelector('#characterdialog').open)return;const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(d){e.preventDefault();if(paused||hero.motion)return;const p={x:hero.x+d[0],y:hero.y+d[1]};if(valid(p.x,p.y)){target=null;path=[];move(hero,p)}}if(e.code==='Space'){e.preventDefault();attack()}if(['1','2','3'].includes(e.key))skill({1:'attack',2:'fire',3:'heal'}[e.key])});
function resize(){const dpr=config.mobileMode?1:Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}window.addEventListener('resize',resize);resize();init();
function loop(now){requestAnimationFrame(loop);if(document.hidden){last=now;return}const delta=Math.min((now-last)/1000,.1);last=now;drawElapsed+=delta;if(drawElapsed<(config.mobileMode?1/30:1/60)-.001)return;const dt=drawElapsed;drawElapsed=0;fpsFrames++;fpsElapsed+=dt;if(fpsElapsed>=1){measuredFPS=Math.round(fpsFrames/fpsElapsed);fpsFrames=0;fpsElapsed=0}if(hitStop>0){hitStop=Math.max(0,hitStop-delta)}else if(!paused&&ready)update(dt);draw()}requestAnimationFrame(loop);
window.windhill={performance:()=>({fps:measuredFPS,resolution:canvas.width/W,mobileMode:config.mobileMode,terrainCached:!!terrainCache}),config:()=>({...config}),setConfig,props:()=>props.map(p=>({...p})),autoHunt:setAutoHunt,monsters:()=>enemies.map(e=>({x:e.x,y:e.y,hp:e.hp,name:e.name,disposition:e.disposition,respawn:e.respawn,spawn:{...e.spawn}})),state:()=>({autoHunt,hero:{x:hero.x,y:hero.y,hp:hero.hp,face:hero.face},path:path.length,kills,paused,progress:{...progress},loot:lootDrops.map(l=>({kind:l.kind,amount:l.amount,age:l.age}))}),project,inverse,depth,findPath,skill,reset:init};
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'move_pawn',description:'Move the player pawn to an open tile in the grove.',inputSchema:{type:'object',properties:{x:{type:'integer',minimum:0,maximum:27},y:{type:'integer',minimum:0,maximum:27}},required:['x','y'],additionalProperties:false},execute:({x,y})=>{if(!Number.isInteger(x)||!Number.isInteger(y)||!valid(x,y))throw Error('Choose an open tile within the grove');target=null;path=findPath(hero.motion?hero.motion.to.x:hero.x,hero.motion?hero.motion.to.y:hero.y,x,y);return{destination:{x,y},steps:path.length}}})}catch{}}

let configWasPaused=false;
function syncConfig(){document.querySelectorAll('[data-config]').forEach(input=>{const k=input.dataset.config;if(input.type==='checkbox')input.checked=config[k];else input.value=config[k]});document.querySelector('#speedvalue').textContent=config.speed+'×';document.querySelector('#configreadout').textContent='Map: '+N+' × '+N+' tiles · '+props.length+' props\nDepth: (x + y) × 1000 + x × 0.01'}
function setConfig(k,value){if(!(k in defaults)||typeof value!==typeof defaults[k])throw Error('Invalid config value');if(k==='speed'&&(!Number.isFinite(value)||value<.5||value>2))throw Error('Speed must be 0.5–2');if(k==='sfxVolume'&&(!Number.isFinite(value)||value<0||value>1))throw Error('Volume must be 0–1');config[k]=value;if(k==='sfxVolume'&&audioGain)audioGain.gain.setTargetAtTime(value,audioContext.currentTime,.05);if(k==='mobileMode')resize();try{localStorage.setItem('windhill-config',JSON.stringify({...config,terrainRevision:3,artRevision:2}))}catch{}syncConfig()}
document.querySelector('#config').onclick=()=>{configWasPaused=paused;paused=true;syncConfig();document.querySelector('#configdialog').showModal()};document.querySelector('#closeconfig').onclick=()=>document.querySelector('#configdialog').close();document.querySelector('#configdialog').addEventListener('close',()=>{paused=configWasPaused});document.querySelectorAll('[data-config]').forEach(input=>input.addEventListener('input',()=>setConfig(input.dataset.config,input.type==='checkbox'?input.checked:Number(input.value))));document.querySelector('#defaults').onclick=()=>{for(const k in defaults)setConfig(k,defaults[k])};

function syncHunt(){const b=document.querySelector('#autohunt');b.textContent=autoHunt?'HUNTING · ON':'AUTO HUNT';b.setAttribute('aria-pressed',String(autoHunt))}
function setAutoHunt(enabled){autoHunt=Boolean(enabled)&&hero?.hp>0;huntTimer=0;syncHunt();if(!autoHunt){target=null;path=[];if(hero)hero.dashSteps=0}notice(autoHunt?'Auto hunt enabled':'Auto hunt disabled')}
function huntTick(){if(paused||hero.hp<=0)return;if(!target&&(path.length||hero.motion))return;if(hero.hp<170&&hero.mp>=20&&cooldowns.heal===0)skill('heal');if(!target||target.hp<=0){const candidates=enemies.filter(e=>e.hp>0).sort((a,b)=>distance(hero,a)-distance(hero,b));for(const e of candidates){const route=findPath(hero.motion?hero.motion.to.x:hero.x,hero.motion?hero.motion.to.y:hero.y,e.x,e.y);if(route.length||distance(hero,e)<=1.5){target=e;path=route;break}}}if(target&&target.hp>0){if(distance(hero,target)<2.5&&hero.mp>=45&&cooldowns.fire===0)skill('fire');if(!target||target.hp<=0)return;if(!hero.motion&&distance(hero,target)>1.5&&path.length===0)path=findPath(hero.x,hero.y,target.x,target.y)}}
function respawnEnemy(e){let spawn=null;for(let radius=0;radius<5&&!spawn;radius++){for(let dx=-radius;dx<=radius&&!spawn;dx++)for(let dy=-radius;dy<=radius;dy++){const x=e.spawn.x+dx,y=e.spawn.y+dy;if(valid(x,y)&&distance(hero,{x,y})>1.5&&!enemies.some(other=>other!==e&&other.hp>0&&other.x===x&&other.y===y)){spawn={x,y};break}}}if(!spawn){e.respawn=1;return}e.x=spawn.x;e.y=spawn.y;e.hp=e.max;e.shownHp=e.max;e.dead=0;e.respawn=0;e.attackAt=0;e.timer=1;e.motion=null;e.hit=0;effects.push({type:'heal',x:e.x,y:e.y,life:.6,total:.6})}
function drawDamage(text,x,y,critical=false,scale=1,healing=false,incoming=false,t=0){const digits=String(text).replace(/\D/g,'');const h=(critical?34:26)*scale,w=h*.65,gap=-2,full=digits.length*(w+gap)-gap;ctx.save();ctx.translate(x,y);ctx.rotate((incoming?-.05:critical?.035:0)*Math.sin((t+.15)*Math.PI));if(critical){const bounce=1+.32*Math.exp(-t*7)*Math.sin(t*Math.PI*14);ctx.scale(bounce,1)}let left=-full/2;for(const digit of digits){const im=assets[(healing?'heal-':critical?'crit-':'digit-')+digit];if(im){ctx.globalAlpha*=.28;ctx.drawImage(im,left+2,-h+3,w,h);ctx.globalAlpha/=.28;ctx.drawImage(im,left,-h,w,h)}left+=w+gap}ctx.restore()}
document.querySelector('#autohunt').onclick=()=>{unlockAudio();setAutoHunt(!autoHunt)};

let cardWasPaused=false;function updateCard(){document.querySelector('#cardhp').textContent=Math.ceil(hero.hp)+' / 240 HP';document.querySelector('#cardmp').textContent=Math.floor(hero.mp)+' / 100 MP';document.querySelector('#cardkills').textContent=String(kills);document.querySelector('#cardhpbar').style.width=hero.hp/240*100+'%';document.querySelector('#cardmpbar').style.width=hero.mp+'%'}document.querySelector('#character').onclick=()=>{cardWasPaused=paused;paused=true;updateCard();document.querySelector('#characterdialog').showModal()};document.querySelector('#closecharacter').onclick=()=>document.querySelector('#characterdialog').close();document.querySelector('#characterdialog').addEventListener('close',()=>{paused=cardWasPaused});

function drawMinimap(){
 const map=uiNode('#minimap');if(!map?.getContext||time<minimapNext)return;minimapNext=time+.35;const c=map.getContext('2d'),scale=96/N;
 if(!minimapStatic){minimapStatic=document.createElement('canvas');minimapStatic.width=96;minimapStatic.height=96;const m=minimapStatic.getContext('2d');
  m.fillStyle='#829063';m.fillRect(0,0,96,96);if(assets['terrain-grass'])m.drawImage(assets['terrain-grass'],0,0,96,96);m.fillStyle='#b9b391';for(let x=0;x<N;x++)for(let y=0;y<N;y++)if(Math.abs(x-y)<2)m.fillRect(x*scale,y*scale,scale,scale);
  m.fillStyle='#649ba2';m.fillRect(0,9*scale,96,3*scale);m.fillStyle='#b89865';m.fillRect(9*scale,9*scale,3*scale,3*scale);
  m.fillStyle='#304d37';for(const p of props)if(!p.groundLayer){m.beginPath();m.arc(p.x*scale,p.y*scale,scale*.55,0,Math.PI*2);m.fill()}
 }c.clearRect(0,0,96,96);c.drawImage(minimapStatic,0,0);c.fillStyle='#a84936';for(const e of enemies)if(e.hp>0)c.fillRect(e.x*scale-1,e.y*scale-1,2.5,2.5);
 const p=position(hero);c.fillStyle='#fff1a9';c.beginPath();c.arc(p.x*scale,p.y*scale,3,0,Math.PI*2);c.fill();c.strokeStyle='#394b39';c.stroke();
}

document.querySelector('#returntogrove').onclick=()=>document.querySelector('#characterdialog').close();
