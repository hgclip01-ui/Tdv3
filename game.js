const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const startBtn=document.getElementById('startBtn');
const homeScreen=document.getElementById('homeScreen');
const gameScreen=document.getElementById('gameScreen');
const endScreen=document.getElementById('endScreen');
const towerList=document.getElementById('towerList');
const goldEl=document.getElementById('gold');
const livesEl=document.getElementById('lives');
const waveEl=document.getElementById('wave');
const endTitle=document.getElementById('endTitle');
const finalScore=document.getElementById('finalScore');
const restartBtn=document.getElementById('restartBtn');
const homeBtn=document.getElementById('homeBtn');

const MAP_SIZE={w:2496,h:1728};
const MAP_TILES={cols:13,rows:9};
const placementTilesData=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,9,0,0,0,9,0,0,0,0,0,9,0,9,0,0,9,9,0,0,0,0,0,9,0,0,0,9,0,0,0,0,0,0,9,9,0,0,9,0,9,0,0,0,0,0,0,0,0,0,0,9,0,0,0,9,9,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const rawWaypoints=[{"x":665.3,"y":1436},{"x":290.6,"y":1437.3},{"x":297.3,"y":864},{"x":666.6,"y":866.6},{"x":665.3,"y":289.3},{"x":1430.6,"y":288},{"x":1437.3,"y":853.3},{"x":1060,"y":861.3},{"x":1065.3,"y":1428},{"x":1825.3,"y":1421.3},{"x":1826.6,"y":861.3},{"x":2202.6,"y":858.6},{"x":2196,"y":292},{"x":1769.3,"y":293.3}];
const waypoints=rawWaypoints.map(p=>({x:p.x/MAP_SIZE.w,y:p.y/MAP_SIZE.h}));
function waypointToCanvas(i){const p=waypoints[i];return{x:p.x*canvas.width,y:p.y*canvas.height}};

// Load assets
function loadImage(path,fallbackColor){
    const img=new Image();
    img.src=path;
    img.onerror=()=>{img.isFallback=true;img.fallbackColor=fallbackColor;};
    return img;
}
const mapImg=loadImage('assets/map.png','#222');
const spawnImg=loadImage('assets/spawn.png','#0f0');
const baseImg=loadImage('assets/base.png','#f00');
const bulletImg=loadImage('assets/bullets/bullet.png','yellow');
const towerImgs={
    'Archer':loadImage('assets/towers/archer.png','#0ff'),
    'Cannon':loadImage('assets/towers/cannon.png','#ff0'),
    'Magic':loadImage('assets/towers/magic.png','#f0f')
};
const enemyImgs={
    'goblin':loadImage('assets/enemies/goblin.png','red'),
    'orc':loadImage('assets/enemies/orc.png','green'),
    'dragon':loadImage('assets/enemies/dragon.png','purple')
};

// Placement grid
let placementGrid=[];
function buildPlacementGrid(){
    placementGrid=[];
    for(let r=0;r<MAP_TILES.rows;r++){
        for(let c=0;c<MAP_TILES.cols;c++){
            const idx=r*MAP_TILES.cols+c;
            const val=placementTilesData[idx];
            const px=(c+0.5)/MAP_TILES.cols*canvas.width;
            const py=(r+0.5)/MAP_TILES.rows*canvas.height;
            if(val===9){placementGrid.push({x:px,y:py,occupied:false});}
        }
    }
}
function isOnPath(x,y){
    for(let i=0;i<waypoints.length-1;i++){
        const a=waypointToCanvas(i),b=waypointToCanvas(i+1);
        const ABx=b.x-a.x,ABy=b.y-a.y;
        const APx=x-a.x,APy=y-a.y;
        const t=Math.max(0,Math.min(1,(APx*ABx+APy*ABy)/(ABx*ABx+ABy*ABy)));
        const projX=a.x+ABx*t,projY=a.y+ABy*t;
        const d=Math.hypot(x-projX,y-projY);
        if(d<40)return true;
    }
    return false;
}

// Classes
class Enemy{
    constructor(type){
        this.segment=0;this.progress=0;this.speed=50;
        this.hp=type==='orc'?60:(type==='dragon'?120:30);
        this.type=type;
        const p=waypointToCanvas(0);this.x=p.x;this.y=p.y;this.dead=false;
    }
    update(dt){
        if(this.segment>=waypoints.length-1)return;
        const a=waypointToCanvas(this.segment),b=waypointToCanvas(this.segment+1);
        const segLen=Math.hypot(b.x-a.x,b.y-a.y);
        this.progress+=this.speed*dt;
        let t=this.progress/segLen;
        if(t>=1){this.segment++;this.progress=0;}
        else{this.x=a.x+(b.x-a.x)*t;this.y=a.y+(b.y-a.y)*t;}
    }
    draw(){
        const img=enemyImgs[this.type];
        if(!img.isFallback){ctx.drawImage(img,this.x-16,this.y-16,32,32);}
        else{ctx.fillStyle=img.fallbackColor;ctx.beginPath();ctx.arc(this.x,this.y,12,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='black';ctx.fillRect(this.x-10,this.y-16,20,4);
        ctx.fillStyle='lime';ctx.fillRect(this.x-10,this.y-16,Math.max(0,20*(this.hp/100)),4);
    }
}

class Tower{
    constructor(x,y,type){this.x=x;this.y=y;this.range=150;this.cooldown=0;this.type=type;}
    update(dt){if(this.cooldown>0)this.cooldown-=dt;if(this.cooldown<0)this.cooldown=0;}
    canShoot(){return this.cooldown<=0;}
    shoot(enemy){this.cooldown=0.8;bullets.push(new Bullet(this.x,this.y,enemy));}
    draw(){
        const img=towerImgs[this.type];
        if(!img.isFallback){ctx.drawImage(img,this.x-24,this.y-24,48,48);}
        else{ctx.fillStyle=img.fallbackColor;ctx.beginPath();ctx.arc(this.x,this.y,16,0,Math.PI*2);ctx.fill();}
    }
}

class Bullet{
    constructor(x,y,target){this.x=x;this.y=y;this.target=target;this.speed=300;this.dead=false;}
    update(dt){
        if(!this.target||this.target.dead)return this.dead=true;
        const dx=this.target.x-this.x;const dy=this.target.y-this.y;
        const dist=Math.hypot(dx,dy);
        if(dist<5){this.target.hp-=20;if(this.target.hp<=0)this.target.dead=true;this.dead=true;return;}
        this.x+=dx/dist*this.speed*dt;this.y+=dy/dist*this.speed*dt;
    }
    draw(){
        if(!bulletImg.isFallback){ctx.drawImage(bulletImg,this.x-8,this.y-8,16,16);}
        else{ctx.fillStyle=bulletImg.fallbackColor;ctx.beginPath();ctx.arc(this.x,this.y,6,0,Math.PI*2);ctx.fill();}
    }
}

// Game state
let enemies=[],towers=[],bullets=[];let gold=150,lives=10,wave=1,score=0;
let last=performance.now();let spawnTimer=0;let waveEnemies=[];
const waves=[['goblin','goblin','goblin','orc','goblin','goblin'],['orc','orc','goblin','orc','dragon']];

// Loop
function loop(now){const dt=(now-last)/1000;last=now;update(dt);render();requestAnimationFrame(loop);} 
function update(dt){
    spawnTimer-=dt;
    if(spawnTimer<=0&&waveEnemies.length>0){enemies.push(new Enemy(waveEnemies.shift()));spawnTimer=1.5;}
    enemies.forEach(e=>e.update(dt));
    enemies=enemies.filter(e=>{if(e.dead){gold+=10;score+=10;return false;}if(e.segment>=waypoints.length-1){lives--;if(lives<=0)endGame(false);return false;}return true;});
    towers.forEach(t=>{t.update(dt);if(t.canShoot()){const target=enemies.find(e=>Math.hypot(e.x-t.x,e.y-t.y)<t.range);if(target)t.shoot(target);}});
    bullets.forEach(b=>b.update(dt));
    bullets=bullets.filter(b=>!b.dead);
    if(enemies.length===0&&waveEnemies.length===0&&wave<waves.length){wave++;waveEl.textContent=wave;startWave();}
    goldEl.textContent=gold;livesEl.textContent=lives;
}
function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!mapImg.isFallback){ctx.drawImage(mapImg,0,0,canvas.width,canvas.height);}
    else{ctx.fillStyle=mapImg.fallbackColor;ctx.fillRect(0,0,canvas.width,canvas.height);}
    const spawnPos=waypointToCanvas(0);
    if(!spawnImg.isFallback){ctx.drawImage(spawnImg,spawnPos.x-24,spawnPos.y-24,48,48);}
    else{ctx.fillStyle=spawnImg.fallbackColor;ctx.beginPath();ctx.arc(spawnPos.x,spawnPos.y,20,0,Math.PI*2);ctx.fill();}
    const basePos=waypointToCanvas(waypoints.length-1);
    if(!baseImg.isFallback){ctx.drawImage(baseImg,basePos.x-24,basePos.y-24,48,48);}
    else{ctx.fillStyle=baseImg.fallbackColor;ctx.beginPath();ctx.arc(basePos.x,basePos.y,20,0,Math.PI*2);ctx.fill();}
    for(const s of placementGrid){ctx.beginPath();ctx.fillStyle=s.occupied?'rgba(255,255,255,0.1)':'rgba(0,255,255,0.2)';ctx.arc(s.x,s.y,20,0,Math.PI*2);ctx.fill();}
    enemies.forEach(e=>e.draw());towers.forEach(t=>t.draw());bullets.forEach(b=>b.draw());
}

// Control
function fitCanvas(){
    const ratio=canvas.width/canvas.height;
    const maxW=Math.min(window.innerWidth-20,1000);
    const maxH=Math.min(window.innerHeight-120,700);
    let newW=maxW;let newH=Math.round(newW/ratio);
    if(newH>maxH){newH=maxH;newW=Math.round(newH*ratio);}
    canvas.style.width=newW+'px';canvas.style.height=newH+'px';
}
window.addEventListener('resize',fitCanvas);

startBtn.onclick=()=>{startGame();};
restartBtn.onclick=()=>{startGame();};
homeBtn.onclick=()=>{showScreen('home');};
function startGame(){
    gold=150;lives=10;wave=1;score=0;enemies=[];towers=[];bullets=[];
    spawnTimer=0;waveEnemies=[];
    homeScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    fitCanvas();buildPlacementGrid();render();initTowerUI();startWave();
}
function startWave(){waveEnemies=waves[wave-1].slice();}
function endGame(win){
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    endTitle.textContent=win?'You Win!':'Game Over';
    finalScore.textContent=score;
}
function initTowerUI(){
    const towersName=['Archer','Cannon','Magic'];
    towerList.innerHTML='';
    towersName.forEach(tn=>{
        const btn=document.createElement('div');
        btn.className='tower-btn';
        btn.textContent=tn;
        btn.onclick=()=>{placeTower(btn,tn)};
        towerList.appendChild(btn);
    });
}
function placeTower(btn,type){
    btn.classList.toggle('selected');
    canvas.onclick=(e)=>{
        const rect=canvas.getBoundingClientRect();
        const x=(e.clientX-rect.left)*(canvas.width/rect.width);
        const y=(e.clientY-rect.top)*(canvas.height/rect.height);
        const slot=placementGrid.find(s=>!s.occupied&&Math.hypot(s.x-x,s.y-y)<25&&!isOnPath(s.x,s.y));
        if(slot&&gold>=50){slot.occupied=true;towers.push(new Tower(slot.x,slot.y,type));gold-=50;}
    };
}
fitCanvas();render();requestAnimationFrame(loop);
