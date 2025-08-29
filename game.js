// Game JS - expects assets folder next to index.html
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const goldEl = document.getElementById('gold');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');

// Map and placement (same as before)
const MAP_SIZE = { w: 2496, h: 1728 };
const MAP_TILES = { cols: 13, rows: 9 };
const placementTilesData = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,9,0,0,0,9,0,0,0,0,0,9,0,9,0,0,9,9,0,0,0,0,0,9,0,0,0,9,0,0,0,0,0,0,9,9,0,0,9,0,9,0,0,0,0,0,0,0,0,0,0,9,0,0,0,9,9,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const rawWaypoints = [{"x":665.3333,"y":1436},{"x":290.6666,"y":1437.3333},{"x":297.3333,"y":864},{"x":666.6666,"y":866.6666},{"x":665.3333,"y":289.3333},{"x":1430.6666,"y":288},{"x":1437.3333,"y":853.3333},{"x":1060,"y":861.3333},{"x":1065.3333,"y":1428},{"x":1825.3333,"y":1421.3333},{"x":1826.6666,"y":861.3333},{"x":2202.6666,"y":858.6666},{"x":2196,"y":292},{"x":1769.3333,"y":293.3333}];
const waypoints = rawWaypoints.map(p => ({ x: p.x / MAP_SIZE.w, y: p.y / MAP_SIZE.h }));

function waypointToCanvas(i){ const p = waypoints[i]; return { x: p.x * canvas.width, y: p.y * canvas.height }; }

// Assets
const assets = {
  map: 'assets/map.png',
  spawn: 'assets/spawn.png',
  base: 'assets/base.png',
  logo: 'assets/logo.png',
  bullet: 'assets/bullets/bullet.png',
  towers: {
    archer: 'assets/towers/archer.png',
    cannon: 'assets/towers/cannon.png',
    magic: 'assets/towers/magic.png'
  },
  enemies: {
    goblin: 'assets/enemies/goblin.png',
    orc: 'assets/enemies/orc.png',
    dragon: 'assets/enemies/dragon.png'
  }
};

// Preload images
const IMGS = {};
function loadImages(list, cb){
  const keys = Object.keys(list);
  let toLoad = 0;
  for(const k of keys){
    const v = list[k];
    if(typeof v === 'string'){
      toLoad++;
      const img = new Image();
      img.src = v;
      img.onload = () => { IMGS[k] = img; toLoad--; if(toLoad===0 && cb) cb(); };
      img.onerror = () => { console.warn('Failed load', v); IMGS[k] = null; toLoad--; if(toLoad===0 && cb) cb(); };
    } else if(typeof v === 'object'){
      loadImages(v, () => { /* nested loaded */ });
    }
  }
}
// Flattened load for our structure
const toLoadFlat = [assets.map, assets.spawn, assets.base, assets.logo, assets.bullet,
  assets.towers.archer, assets.towers.cannon, assets.towers.magic,
  assets.enemies.goblin, assets.enemies.orc, assets.enemies.dragon];
let loadedCount = 0;
for(const p of toLoadFlat){
  const img = new Image();
  img.src = p;
  img.onload = () => { loadedCount++; };
  img.onerror = () => { loadedCount++; };
  IMGS[p] = img;
}

// Game variables
let placementGrid = [];
function rebuildPlacementGrid(){
  placementGrid = [];
  for(let r=0;r<MAP_TILES.rows;r++){
    for(let c=0;c<MAP_TILES.cols;c++){
      const idx = r * MAP_TILES.cols + c;
      if(placementTilesData[idx] === 9){
        placementGrid.push({ x: (c+0.5)/MAP_TILES.cols*canvas.width, y: (r+0.5)/MAP_TILES.rows*canvas.height, occupied: false });
      }
    }
  }
}

function isOnPath(x,y){
  for(let i=0;i<waypoints.length-1;i++){
    const a = waypointToCanvas(i), b = waypointToCanvas(i+1);
    const ABx = b.x - a.x, ABy = b.y - a.y;
    const APx = x - a.x, APy = y - a.y;
    const denom = ABx*ABx + ABy*ABy;
    const t = denom===0?0:Math.max(0, Math.min(1, (APx*ABx + APy*ABy)/denom));
    const projX = a.x + ABx*t, projY = a.y + ABy*t;
    const d = Math.hypot(x-projX, y-projY);
    if(d < 36) return true;
  }
  return false;
}

// Entities similar to previous but draw images
class Enemy {
  constructor(type){
    this.type = type;
    this.hp = (type==='orc')?80: (type==='dragon'?160:40);
    this.maxHp = this.hp;
    this.speed = (type==='dragon')?20: (type==='orc'?36:60);
    this.segment = 0; this.progress = 0;
    const p = waypointToCanvas(0);
    this.pos = { x: p.x, y: p.y };
    this.dead = false; this.reached=false;
  }
  update(dt){
    if(this.dead||this.reached) return;
    if(this.segment >= waypoints.length-1){ this.reached = true; return; }
    const a = waypointToCanvas(this.segment), b = waypointToCanvas(this.segment+1);
    const segLen = Math.hypot(b.x-a.x, b.y-a.y);
    this.progress += this.speed * dt;
    const t = Math.min(1, this.progress/(segLen||1));
    this.pos.x = a.x + (b.x-a.x)*t; this.pos.y = a.y + (b.y-a.y)*t;
    if(this.progress >= segLen){ this.segment++; this.progress=0; if(this.segment >= waypoints.length-1) this.reached=true; }
  }
  draw(ctx){
    const img = IMGS[assets.enemies[this.type]];
    if(img && img.complete){
      ctx.drawImage(img, this.pos.x - img.width/2, this.pos.y - img.height/2);
    } else {
      ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(this.pos.x,this.pos.y,12,0,Math.PI*2); ctx.fill();
    }
    // hp bar
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(this.pos.x-22,this.pos.y-28,44,6);
    ctx.fillStyle='#ff6b6b'; ctx.fillRect(this.pos.x-22,this.pos.y-28,44*(this.hp/this.maxHp),6);
  }
}

class Tower {
  constructor(x,y,type){
    this.x=x;this.y=y;this.type=type;this.cool=0;const spec={archer:{range:160,fire:1.8,dmg:12},cannon:{range:110,fire:0.6,dmg:30},magic:{range:150,fire:1.0,dmg:42}}[type];this.range=spec.range;this.fireRate=spec.fire;this.dmg=spec.dmg;
  }
  update(dt){ this.cool -= dt; if(this.cool<0) this.cool=0; }
  canFire(){ return this.cool<=0; }
  fire(target){ this.cool = 1/this.fireRate; bullets.push(new Bullet(this.x,this.y,target,this.dmg)); }
  draw(ctx){
    const img = IMGS[assets.towers[this.type]];
    if(img && img.complete){ ctx.drawImage(img,this.x - img.width/2, this.y - img.height/2); }
    else { ctx.fillStyle='black'; ctx.beginPath(); ctx.arc(this.x,this.y,14,0,Math.PI*2); ctx.fill(); }
  }
}

class Bullet {
  constructor(x,y,target,dmg){
    this.x=x;this.y=y;this.target=target;this.dmg=dmg;this.speed=420;this.dead=false;
    this.img = new Image(); this.img.src = assets.bullet;
  }
  update(dt){
    if(!this.target||this.target.dead||this.target.reached){ this.dead=true; return; }
    const dx = this.target.pos.x - this.x, dy = this.target.pos.y - this.y;
    const dist = Math.hypot(dx,dy);
    const step = this.speed * dt;
    if(dist <= step + 4){ this.target.hp -= this.dmg; if(this.target.hp <= 0){ this.target.dead = true; } this.dead = true; return; }
    this.x += dx/dist * step; this.y += dy/dist * step;
  }
  draw(ctx){
    const img = IMGS[assets.bullet];
    if(img && img.complete){ ctx.drawImage(img, this.x - img.width/2, this.y - img.height/2); }
    else { ctx.fillStyle='yellow'; ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2); ctx.fill(); }
  }
}

// Game arrays
let enemies = [], towers = [], bullets = [], placementGrid = [];
let gold = 150, lives = 10, waveIndex = 0, score = 0, spawnQueue = [], spawnTimer = 0, last = performance.now();

// Waves (simple)
const WAVES = [ {goblin:6}, {goblin:8, orc:1}, {goblin:10, orc:3}, {goblin:6, orc:6, dragon:1} ];

function rebuildGrid(){ placementGrid = []; for(let r=0;r<MAP_TILES.rows;r++){ for(let c=0;c<MAP_TILES.cols;c++){ const idx = r*MAP_TILES.cols + c; if(placementTilesData[idx]===9){ placementGrid.push({ x:(c+0.5)/MAP_TILES.cols*canvas.width, y:(r+0.5)/MAP_TILES.rows*canvas.height, occupied:false }); } } } }

function spawnTick(dt){ if(spawnQueue.length===0) return; spawnTimer -= dt; if(spawnTimer<=0){ const t = spawnQueue.shift(); enemies.push(new Enemy(t)); spawnTimer = 0.6; } }

function update(dt){
  spawnTick(dt);
  for(const e of enemies) e.update(dt);
  enemies = enemies.filter(e=>{ if(e.dead){ gold += 10; score += 10; return false; } if(e.reached){ lives--; if(lives<=0) endGame(false); return false; } return true; });
  for(const t of towers){ t.update(dt); if(t.canFire()){ let best=null,bestD=1e9; for(const e of enemies){ const d = Math.hypot(e.pos.x - t.x, e.pos.y - t.y); if(d <= t.range && d < bestD){ bestD = d; best = e; } } if(best) t.fire(best); } }
  for(const b of bullets) b.update(dt); bullets = bullets.filter(b=>!b.dead);
  if(spawnQueue.length===0 && enemies.length===0){ // next wave
    setTimeout(()=>{ if(waveIndex < WAVES.length) prepareNextWave(); else endGame(true); }, 700);
  }
  // UI update
  document.getElementById('gold').textContent = gold;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = Math.max(1,waveIndex);
}

function drawTerrain(){
  const mapImg = IMGS[assets.map];
  if(mapImg && mapImg.complete){ ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height); } else {
    ctx.fillStyle='#023e2f'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  // draw spawn and base
  const sImg = IMGS[assets.spawn], bImg = IMGS[assets.base];
  const s = waypointToCanvas(0), e = waypointToCanvas(waypoints.length-1);
  if(sImg && sImg.complete) ctx.drawImage(sImg, s.x - sImg.width/2, s.y - sImg.height/2);
  if(bImg && bImg.complete) ctx.drawImage(bImg, e.x - bImg.width/2, e.y - bImg.height/2);
  // path overlay
  ctx.save();
  ctx.lineWidth = Math.max(32, canvas.width*0.035);
  ctx.strokeStyle = 'rgba(180,140,80,0.7)'; ctx.beginPath();
  const p0 = waypointToCanvas(0); ctx.moveTo(p0.x,p0.y);
  for(let i=1;i<waypoints.length;i++){ const p = waypointToCanvas(i); ctx.lineTo(p.x,p.y); }
  ctx.stroke();
  ctx.restore();
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawTerrain();
  // slots
  for(const s of placementGrid){ ctx.beginPath(); ctx.fillStyle = s.occupied ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)'; ctx.arc(s.x,s.y, Math.min(canvas.width/MAP_TILES.cols, canvas.height/MAP_TILES.rows)*0.26,0,Math.PI*2); ctx.fill(); }
  // draw towers/enemies/bullets
  for(const t of towers) t.draw(ctx);
  for(const e of enemies) e.draw(ctx);
  for(const b of bullets) b.draw(ctx);
}

// Input and placement
let selectedType = null;
function initUI(){
  const panel = document.getElementById('towerList');
  panel.innerHTML = '';
  const types = ['archer','cannon','magic'];
  types.forEach(type=>{
    const btn = document.createElement('div');
    btn.className = 'tower-btn';
    btn.innerHTML = `<img class="asset" src="${assets.towers[type]}" /><div>${type}</div>`;
    btn.onclick = ()=>{ document.querySelectorAll('.tower-btn').forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); selectedType = type; };
    panel.appendChild(btn);
  });
}

function clientToCanvas(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
}

canvas.addEventListener('click', (e)=>{
  if(!selectedType) return;
  const pos = clientToCanvas(e.clientX, e.clientY);
  // find nearest slot
  let best=null,bestD=1e9;
  for(const s of placementGrid){ if(s.occupied) continue; const d = Math.hypot(s.x-pos.x,s.y-pos.y); if(d<bestD){bestD=d;best=s;} }
  const threshold = Math.min(canvas.width/MAP_TILES.cols, canvas.height/MAP_TILES.rows)*0.6;
  if(!best || bestD>threshold) return;
  if(isOnPath(best.x,best.y)) return;
  // cost simple: all towers cost 60
  const cost = 60; if(gold < cost) { alert('Gold tidak cukup'); return; }
  gold -= cost; best.occupied = true; towers.push(new Tower(best.x,best.y,selectedType));
  document.querySelectorAll('.tower-btn').forEach(x=>x.classList.remove('selected')); selectedType = null;
});

// Wave control
function prepareNextWave(){
  if(waveIndex >= WAVES.length){ return; }
  const mix = WAVES[waveIndex];
  spawnQueue = [];
  Object.keys(mix).forEach(k=>{ for(let i=0;i<mix[k];i++) spawnQueue.push(k); });
  // shuffle
  for(let i=spawnQueue.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [spawnQueue[i], spawnQueue[j]] = [spawnQueue[j], spawnQueue[i]]; }
  spawnTimer = 0.6; waveIndex++;
  document.getElementById('wave').textContent = waveIndex;
}

function startGame(){
  gold = 150; lives = 10; waveIndex = 0; score = 0; enemies = []; towers = []; bullets = []; spawnQueue = []; spawnTimer = 0;
  rebuildGrid(); initUI(); prepareNextWave();
}

function endGame(win){
  alert(win ? 'You win! QorGeniusOS aman.' : 'Game Over'); // simple
}

// Main loop
function loop(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}

function update(dt){ updateGame(dt); }
function updateGame(dt){
  spawnTick(dt);
  for(const e of enemies) e.update(dt);
  enemies = enemies.filter(e=>{ if(e.dead){ gold+=10; score+=10; return false; } if(e.reached){ lives--; if(lives<=0) { endGame(false); } return false; } return true; });
  for(const t of towers){ t.update(dt); if(t.canFire()){ let best=null,bestD=1e9; for(const e of enemies){ const d = Math.hypot(e.pos.x - t.x, e.pos.y - t.y); if(d <= t.range && d < bestD){ bestD = d; best = e; } } if(best) t.fire(best); } }
  for(const b of bullets) b.update(dt); bullets = bullets.filter(b=>!b.dead);
  document.getElementById('gold').textContent = gold;
  document.getElementById('lives').textContent = lives;
}

window.addEventListener('resize', ()=>{ fitCanvas(); rebuildGrid(); });
function fitCanvas(){
  const ratio = canvas.width / canvas.height;
  const maxW = Math.min(window.innerWidth - 40, 1100);
  const maxH = Math.min(window.innerHeight - 200, 820);
  let newW = maxW; let newH = Math.round(newW/ratio);
  if(newH > maxH){ newH = maxH; newW = Math.round(newH * ratio); }
  canvas.style.width = newW + 'px'; canvas.style.height = newH + 'px';
  rebuildGrid();
}

// Start
document.getElementById('startBtn').addEventListener('click', ()=>{ document.getElementById('homeScreen').style.display='none'; document.getElementById('gameScreen').style.display='flex'; fitCanvas(); loadAssetsAndStart(); });
function loadAssetsAndStart(){
  // wait a little for image elements created earlier to load
  setTimeout(()=>{ rebuildGrid(); initUI(); last = performance.now(); requestAnimationFrame(loop); }, 300);
}