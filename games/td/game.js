/* ===========================================================
   《别按那个键》V2 prototype
   增量清屏塔防：不摆塔，只升级整座岛和环形围墙。
   =========================================================== */

const C = {
  W: 960, H: 640,
  WALL_R: 116, SPAWN_R: 380,
  FIRST_SPAWN: 5,
  BASE_WALL: 420,
  OVERDRIVE_TIME: 20,
  OVERDRIVE_CD: 28,
};
const CX = C.W / 2, CY = C.H / 2 + 16;

const STAGES = [
  { name:'破浪', target:260,  max:42, rate:6.0,  pool:[['grunt',100]] },
  { name:'箭雨', target:780,  max:50, rate:10.5, pool:[['grunt',64],['runner',36]] },
  { name:'燃墙', target:1650, max:58, rate:16.5, pool:[['grunt',50],['runner',25],['brute',25]] },
  { name:'裂潮', target:2950, max:64, rate:23.0, pool:[['grunt',38],['runner',22],['splitter',30],['brute',10]] },
  { name:'污染', target:4700, max:70, rate:33.0, pool:[['grunt',28],['runner',23],['splitter',25],['corroder',14],['ranged',10]] },
  { name:'暴潮', target:7000, max:76, rate:46.0, pool:[['grunt',22],['runner',22],['splitter',26],['corroder',12],['ranged',12],['brute',6]] },
];

const ENEMIES = {
  grunt:    { name:'小怪', hp:10,  spd:50, dmg:2,  armor:0, reward:2,  threat:1,   r:6,  color:'#d06a42' },
  runner:   { name:'快怪', hp:10,  spd:90, dmg:2,  armor:0, reward:2,  threat:1.2, r:5,  color:'#f0b429' },
  brute:    { name:'厚皮怪', hp:72, spd:30, dmg:7,  armor:3, reward:12, threat:4.5, r:12, color:'#758293' },
  splitter: { name:'分裂怪', hp:36, spd:43, dmg:3,  armor:0, reward:8,  threat:3.2, r:9,  color:'#b58a30', split:true },
  mini:     { name:'碎怪', hp:8,   spd:66, dmg:1,  armor:0, reward:1,  threat:.6,  r:4,  color:'#d2a84b' },
  corroder: { name:'腐蚀怪', hp:32, spd:38, dmg:2,  armor:0, reward:9,  threat:4.5, r:8,  color:'#59c98a', corrode:true },
  ranged:   { name:'远程怪', hp:30, spd:28, dmg:6,  armor:1, reward:9,  threat:4.6, r:8,  color:'#a879ff', ranged:74 },
  elite:    { name:'污染精英', hp:360,spd:24, dmg:16, armor:3, reward:110, threat:24, r:18, color:'#ef4b55', elite:true },
};

const UPGRADES = [
  { id:'wall', name:'围墙加固', desc:s=>`最大 HP +${fmt(wallGain(s.wallLv+1))}，Lv${s.wallLv}`, cost:s=>Math.round(28*Math.pow(1.50,s.wallLv)), buy:s=>{s.wallLv++; s.wallMax+=wallGain(s.wallLv); s.wallHp=s.wallMax;} },
  { id:'atk', name:'基础攻击', desc:s=>`基础火力 ${pct(atkScale(s.atkLv))}，Lv${s.atkLv}（后期递减）`, cost:s=>softCost(24,1.55,s.atkLv,8,1.25), buy:s=>s.atkLv++ },
  { id:'spd', name:'射击节奏', desc:s=>`射速 ${pct(spdScale(s.spdLv))}，Lv${s.spdLv}（后期递减）`, cost:s=>softCost(30,1.57,s.spdLv,7,1.22), buy:s=>s.spdLv++ },
  { id:'mine', name:'魔力矿', desc:s=>`掉落与点矿 +${Math.round(mineBonus(s)*100)}%，Lv${s.mineLv}`, cost:s=>Math.round(18*Math.pow(1.49,s.mineLv)), buy:s=>s.mineLv++ },
  { id:'repair', name:'自修复', desc:s=>`围墙恢复 +2.4/s，Lv${s.repairLv}`, cost:s=>Math.round(44*Math.pow(1.58,s.repairLv)), buy:s=>s.repairLv++ },
  { id:'armor', name:'装甲层', desc:s=>`格挡 ${armorBlockPreview(s.armorLv).toFixed(1)}，Lv${s.armorLv}（最低仍受伤）`, cost:s=>softCost(42,1.58,s.armorLv,6,1.28), buy:s=>s.armorLv++ },
  { id:'core', name:'战场核心', desc:s=>`核心奖励 +${Math.round((coreMul(s)-1)*100)}%，Lv${s.coreLv}`, cost:s=>Math.round(36*Math.pow(1.53,s.coreLv)), buy:s=>s.coreLv++ },
];

const EVOS = [
  { id:'multi', tier:1, branch:'弹幕', name:'多重箭孔', desc:'基础射击额外锁定 2 个目标，是弹幕路线入口。', req:[] },
  { id:'fire', tier:1, branch:'元素', name:'火焰环', desc:'每 5 秒围墙爆出火环，解决贴墙小怪。', req:[] },
  { id:'spikes', tier:1, branch:'铁壁', name:'尖刺墙', desc:'敌人攻击围墙时受到反伤，是生存路线入口。', req:[] },
  { id:'siphon', tier:1, branch:'贪婪', name:'魔力虹吸', desc:'击杀收益 +45%，让路线成型更快。', req:[] },
  { id:'pierce', tier:2, branch:'弹幕', name:'穿透箭', desc:'箭矢贯穿一串敌人，对密集怪潮有效。', req:['multi'] },
  { id:'chain', tier:2, branch:'弹幕', name:'闪电链', desc:'攻击命中后弹射 5 次，补足散怪清理。', req:['multi'] },
  { id:'shred', tier:2, branch:'弹幕', name:'破甲箭头', desc:'射击削弱厚皮怪护甲，避免只堆攻击卡住。', req:['multi'] },
  { id:'frost', tier:2, branch:'元素', name:'冰霜脉冲', desc:'每 7 秒冻结外圈怪潮，给清屏争取时间。', req:['fire'] },
  { id:'blast', tier:2, branch:'元素', name:'爆裂符文', desc:'死亡有 30% 概率爆炸，连锁清小怪。', req:['fire'] },
  { id:'bulwark', tier:2, branch:'铁壁', name:'活体城墙', desc:'围墙最大 HP +32%，修复效果 +50%。', req:['spikes'] },
  { id:'barrier', tier:2, branch:'铁壁', name:'符文护盾', desc:'围墙获得可再生护盾，抵消远程消耗。', req:['spikes'] },
  { id:'treasury', tier:2, branch:'贪婪', name:'聚宝矿脉', desc:'连击倍率更高，点矿收益翻倍。', req:['siphon'] },
  { id:'conduit', tier:2, branch:'贪婪', name:'核心导管', desc:'战场核心刷新更快，点击收益提高。', req:['siphon'] },
  { id:'volley', tier:3, branch:'弹幕', name:'万箭齐发', desc:'多重箭再额外 +4 目标，形成主清线。', req:['pierce','chain'] },
  { id:'railgun', tier:3, branch:'弹幕', name:'破浪重炮', desc:'周期性轰击最高生命目标并溅射。', req:['shred'] },
  { id:'inferno', tier:3, branch:'元素', name:'炼狱火环', desc:'火环更快、更大，并点燃全屏。', req:['frost','blast'] },
  { id:'storm', tier:3, branch:'元素', name:'风暴裂变', desc:'爆裂核心和死亡爆炸范围更大。', req:['blast'] },
  { id:'thornnova', tier:3, branch:'铁壁', name:'荆棘新星', desc:'围墙受击会周期性爆发反伤波。', req:['bulwark'] },
  { id:'aegis', tier:3, branch:'铁壁', name:'偏转穹顶', desc:'护盾更厚，远程和腐蚀伤害降低。', req:['barrier'] },
  { id:'gear', tier:3, branch:'贪婪', name:'贪婪齿轮', desc:'过载期间进化触发频率 ×2。', req:['treasury'] },
  { id:'collector', tier:3, branch:'贪婪', name:'拾荒协议', desc:'点击战场核心时额外喷发魔力和伤害。', req:['conduit'] },
  { id:'blackhole', tier:4, branch:'终局', name:'黑洞裂隙', desc:'周期性牵引怪潮并爆炸。', req:['inferno','volley'] },
  { id:'annihilator', tier:4, branch:'终局', name:'湮灭炮环', desc:'重炮和炼狱连成炮环，专打厚血目标。', req:['railgun','inferno'] },
  { id:'singularity', tier:4, branch:'终局', name:'奇点收割', desc:'黑洞击杀会再次喷发魔力与伤害。', req:['blackhole','gear'] },
  { id:'laststand', tier:4, branch:'终局', name:'不破孤岛', desc:'低血自动巨型清屏，并重置护盾。', req:['thornnova','aegis'] },
];

const BRANCH_ORDER = ['弹幕','元素','铁壁','贪婪','终局'];

let S;
function newGame(){
  S = {
    t:0, paused:false, over:false, won:false,
    mana:0, totalMana:0, rate:0, rateBuf:[],
    wallLv:0, atkLv:0, spdLv:0, mineLv:0, repairLv:0, armorLv:0, coreLv:0,
    wallMax:C.BASE_WALL, wallHp:C.BASE_WALL, wallShield:0, wallFlash:0, corrodeT:0,
    enemies:[], shots:[], parts:[], floats:[], bits:[], fieldEvents:[],
    stage:1, stageT:0, stageThreat:0, stageWarned:false, surgeCd:4, spawnBag:0, spawnDelay:C.FIRST_SPAWN,
    combo:0, comboT:0, comboTier:0, kills:0, totalKills:0,
    evos:[], evoPts:0, evoPending:false,
    attackCd:0, fireCd:5, frostCd:7, blackCd:16, thornCd:5, railCd:4.8, laststandReady:true,
    fieldCd:8, fieldHint:0,
    mineCd:0, mineReadyAt:0, minePulse:0,
    overdriveT:0, overdriveCd:0, presses:0, debt:0, corruption:0,
    boss:null, bossMarks:{p75:false,p50:false,p25:false}, bossSummon:0,
    message:'怪潮逼近', startReal:Date.now(), lastRenderShop:0,
  };
}

const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
function wpick(pool){ const sum=pool.reduce((s,x)=>s+x[1],0); let r=Math.random()*sum; for(const x of pool){ r-=x[1]; if(r<=0)return x[0]; } return pool[pool.length-1][0]; }
function fmt(n){
  if(!isFinite(n)) return '0';
  const a=Math.abs(n), units=['','k','M','B','T']; let u=0;
  while(a/Math.pow(1000,u)>=1000 && u<units.length-1) u++;
  const v=n/Math.pow(1000,u);
  return u? (v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2))+units[u] : Math.floor(n).toLocaleString('en-US');
}
function pct(v){ return 'x'+v.toFixed(2); }
function softCost(base,growth,lv,softAt,extraGrowth){
  return Math.round(base*Math.pow(growth,lv)*(lv>=softAt?Math.pow(extraGrowth,lv-softAt+1):1));
}
function statCurve(lv,early,softAt,late){ return 1+Math.min(lv,softAt)*early+Math.max(0,lv-softAt)*late; }
function atkScale(lv=S.atkLv){ return statCurve(lv,.17,8,.055); }
function spdScale(lv=S.spdLv){ return statCurve(lv,.12,7,.045); }
function mineBonus(s=S){ return .12*(s.mineLv||0); }
function mineScale(s=S){ return 1+mineBonus(s); }
function coreMul(s=S){
  let m=1+.16*(s.coreLv||0);
  if(s.evos && s.evos.includes('conduit')) m+=.45;
  if(s.evos && s.evos.includes('collector')) m+=.35;
  return m;
}
function wallGain(lv){ return Math.round(105*Math.pow(lv,.20)); }
function armorBlockPreview(lv){ return Math.min(lv,6)*.75+Math.max(0,lv-6)*.28; }
function armorBlock(){ return armorBlockPreview(S.armorLv)+(evo('bulwark')?1.1:0)+(evo('aegis')?1.2:0); }
function shieldMax(){ return evo('barrier') ? S.wallMax*(evo('aegis')?.24:.13) : 0; }
function stageRewardPoints(stage){ return [0,2,2,2,3,3,3][stage] || 3; }
function comboMul(){
  if(S.combo>=1000) return evo('treasury') ? 14 : 10;
  if(S.combo>=500) return evo('treasury') ? 9 : 7;
  if(S.combo>=200) return evo('treasury') ? 5.5 : 4;
  if(S.combo>=75) return evo('treasury') ? 3.2 : 2.5;
  if(S.combo>=25) return evo('treasury') ? 1.9 : 1.5;
  return 1;
}
function overMul(){ return S.overdriveT>0 ? 4 : 1; }
function fireRateMul(){ return spdScale() * (S.overdriveT>0?2.45:1); }
function damageMul(){
  let m=atkScale() * (S.overdriveT>0?1.65:1);
  if(evo('railgun')) m*=1.08;
  if(evo('annihilator')) m*=1.18;
  return m;
}
function evo(id){ return S.evos.includes(id); }

let AC=null;
function sfx(type){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    const now=AC.currentTime, o=AC.createOscillator(), g=AC.createGain();
    const m={mine:[580,.045,.018],kill:[780,.035,.014],big:[220,.18,.045],bad:[120,.2,.04],evo:[520,.22,.05],button:[80,.28,.065]}[type]||[400,.06,.02];
    o.type=(type==='button'||type==='bad')?'sawtooth':'triangle';
    o.frequency.setValueAtTime(m[0],now); o.frequency.exponentialRampToValueAtTime(Math.max(35,m[0]*.48),now+m[1]);
    g.gain.setValueAtTime(m[2],now); g.gain.exponentialRampToValueAtTime(.0001,now+m[1]);
    o.connect(g); g.connect(AC.destination); o.start(now); o.stop(now+m[1]);
  }catch(_){ }
}
function toast(html,type=''){
  const box=document.getElementById('toast'), d=document.createElement('div');
  d.className='tmsg '+type; d.innerHTML=html; box.appendChild(d);
  setTimeout(()=>{d.style.transition='opacity .35s, transform .35s';d.style.opacity=0;d.style.transform='translateY(-8px)';setTimeout(()=>d.remove(),360);},2200);
}
function addFloat(x,y,txt,color='#f3bd36',size=14){ S.floats.push({x,y,txt,color,size,life:1,max:1}); }
function burst(x,y,n,color,spd=120,life=.55){
  for(let i=0;i<n;i++){ const a=rnd(0,Math.PI*2), v=rnd(spd*.25,spd); S.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:rnd(1.2,3.5),color,life,max:life}); }
}
function manaBits(x,y,amount,color='#49c7ff'){
  const count=clamp(Math.ceil(Math.log2(amount+2))*2,3,20);
  for(let i=0;i<count;i++) S.bits.push({x:x+rnd(-8,8),y:y+rnd(-8,8),tx:42+rnd(-8,52),ty:30+rnd(-4,15),t:rnd(-.15,0),color,amount:amount/count});
}
function gainMana(amount,x=CX,y=CY,color='#49c7ff'){
  amount=Math.max(0,amount);
  S.mana+=amount; S.totalMana+=amount;
  S.rateBuf.push({t:S.t,a:amount});
  manaBits(x,y,amount,color);
}

function mineClick(){
  if(S.over||S.paused||S.mineCd>0) return;
  const perfect=S.mineReadyAt && (S.t-S.mineReadyAt)<.32;
  const gain=(5+S.mineLv*2) * mineScale() * (evo('treasury')?2:1) * overMul() * (perfect?1.5:1);
  gainMana(gain,CX,CY,perfect?'#f3bd36':'#49c7ff');
  addFloat(CX+rnd(-16,16),CY-36,(perfect?'精准 +':'+')+fmt(gain),perfect?'#f3bd36':'#49c7ff',perfect?18:15);
  burst(CX,CY,perfect?16:9,perfect?'#f3bd36':'#49c7ff',perfect?170:120,.45);
  S.mineCd=.7; S.mineReadyAt=0; S.minePulse=1;
  sfx(perfect?'big':'mine');
}

function buyUpgrade(id){
  const u=UPGRADES.find(x=>x.id===id); if(!u) return;
  const cost=u.cost(S); if(S.mana<cost) return;
  S.mana-=cost; u.buy(S); renderShop(true); burst(CX,CY,12,'#f3bd36',130,.45); sfx('evo');
}
function techCost(t){ return 1; }
function canBuyTech(t){ return t && !evo(t.id) && S.evoPts>=techCost(t) && t.req.every(evo); }
function buyTech(id){
  const t=EVOS.find(x=>x.id===id); if(!canBuyTech(t)) return;
  S.evoPts-=techCost(t); S.evos.push(t.id);
  if(t.id==='bulwark'){
    S.wallMax*=1.32; S.wallHp=Math.min(S.wallMax,S.wallHp+S.wallMax*.32);
  }
  if(t.id==='barrier' || t.id==='aegis' || t.id==='laststand') S.wallShield=shieldMax();
  if(t.id==='conduit'){
    S.fieldCd=2;
    spawnFieldEvent('blast');
  }
  if(t.id==='laststand') S.laststandReady=true;
  renderShop(true); updateHUD(); sfx('evo'); burst(CX,CY,52,'#a879ff',230,.75);
  toast(`<b style="color:#c9b6ff">${t.name}</b> 已解锁`,'good');
}

function pressButton(){
  if(S.over||S.paused||S.overdriveCd>0||S.overdriveT>0) return;
  S.presses++; S.debt++; S.corruption++;
  S.overdriveT=C.OVERDRIVE_TIME; S.overdriveCd=C.OVERDRIVE_CD+C.OVERDRIVE_TIME;
  S.message='贪婪过载';
  burst(CX,CY,60,'#ef4b55',250,.8); sfx('button');
  toast(`<b style="color:#ef4b55">贪婪过载</b> — 20 秒内射速 x2.45，收益 x4，怪潮 x2.4`,'bad');
}

function spawnFieldEvent(kind=null){
  const types=kind?[kind]:['mana','blast','repair','rift'];
  const type=pick(types);
  const a=rnd(0,Math.PI*2), r=rnd(C.WALL_R+95,C.WALL_R+250);
  const cfg={
    mana:{label:'魔力核心',color:'#49c7ff',life:9,r:18},
    blast:{label:'爆裂核心',color:'#f3bd36',life:8,r:20},
    repair:{label:'修复核心',color:'#4bd37b',life:8,r:18},
    rift:{label:'污染裂隙',color:'#ef4b55',life:6,r:22,hazard:true},
  }[type];
  const life=cfg.life + (S.coreLv||0)*.3 + (evo('conduit')?1.4:0);
  S.fieldEvents.push({type,x:CX+Math.cos(a)*r,y:CY+Math.sin(a)*r,life,max:life,r:cfg.r,color:cfg.color,label:cfg.label,hazard:!!cfg.hazard});
  S.fieldHint=3;
}

function activateFieldEvent(ev){
  const scale=(1+S.stage*.35+S.presses*.15)*coreMul();
  if(ev.type==='mana'){
    const amt=120*scale*comboMul()*overMul();
    gainMana(amt,ev.x,ev.y,ev.color);
    addFloat(ev.x,ev.y-26,'+'+fmt(amt),ev.color,22);
    burst(ev.x,ev.y,26,ev.color,170,.55);
  } else if(ev.type==='blast'){
    explode(ev.x,ev.y,evo('storm')?215:150,55*scale*damageMul(),ev.color);
    gainMana(60*scale*overMul(),ev.x,ev.y,ev.color);
    addFloat(ev.x,ev.y-26,'爆裂核心',ev.color,23);
  } else if(ev.type==='repair'){
    const heal=S.wallMax*.28;
    S.wallHp=Math.min(S.wallMax,S.wallHp+heal);
    S.wallShield=Math.min(shieldMax(),S.wallShield+shieldMax()*.7);
    gainMana(45*scale,ev.x,ev.y,ev.color);
    addFloat(ev.x,ev.y-26,'围墙修复',ev.color,22);
    burst(CX,CY,36,ev.color,150,.55);
  } else if(ev.type==='rift'){
    explode(ev.x,ev.y,evo('storm')?250:180,70*scale*damageMul(),ev.color);
    gainMana(90*scale*overMul(),ev.x,ev.y,'#f3bd36');
    addFloat(ev.x,ev.y-26,'裂隙封印','#f3bd36',23);
  }
  if(evo('collector')){
    const bonus=90*scale*overMul();
    gainMana(bonus,ev.x,ev.y,'#c9b6ff');
    explode(ev.x,ev.y,120,22*scale*damageMul(),'#a879ff');
    addFloat(ev.x,ev.y+24,'拾荒 +' + fmt(bonus),'#c9b6ff',18);
  }
  S.fieldEvents=S.fieldEvents.filter(e=>e!==ev);
  sfx(ev.hazard?'big':'evo');
}

function expireFieldEvent(ev){
  if(ev.type==='rift'){
    wallHit(42+S.stage*11);
    for(let i=0;i<12+S.stage*4;i++) spawnEnemy(i%5===0?'brute':i%3===0?'runner':'grunt',rnd(0,Math.PI*2),1.45);
    toast('<b style="color:#ef4b55">污染裂隙爆开</b> — 怪潮增援并伤害围墙','bad');
  }
}

function spawnEnemy(type,angle=null,mul=1){
  const e0=ENEMIES[type];
  const a=angle==null?rnd(0,Math.PI*2):angle;
  const hpMul=(1+0.28*(S.stage-1))*(1+0.09*S.presses)*mul;
  S.enemies.push({
    type, ...e0,
    x:CX+Math.cos(a)*C.SPAWN_R, y:CY+Math.sin(a)*C.SPAWN_R,
    hp:e0.hp*hpMul, maxhp:e0.hp*hpMul, a, cd:rnd(.1,.8), slow:0, pull:0,
  });
}
function spawnStageEnemy(){
  if(S.enemies.length>260) return;
  const st=STAGES[S.stage-1];
  let type=wpick(st.pool);
  if(S.corruption>0 && Math.random()<Math.min(.02+.015*S.corruption,.18)) type='elite';
  spawnEnemy(type);
}

function wallHit(dmg,e){
  let incoming=dmg;
  if(e && e.ranged && evo('aegis')) incoming*=.74;
  if(e && e.corrode && evo('aegis')) incoming*=.70;
  const block=Math.max(0,armorBlock() + (S.corrodeT>0?-2.2:0));
  const floor=Math.max(1,Math.ceil(incoming*(S.corrodeT>0?.44:.30)));
  let real=Math.max(floor,Math.round(incoming-block));
  if(S.wallShield>0){
    const absorb=Math.min(S.wallShield,real*(evo('aegis')?.75:.55));
    S.wallShield-=absorb; real-=absorb;
  }
  real=Math.max(1,Math.round(real));
  S.wallHp-=real; S.wallFlash=.35;
  if(S.combo>0){ S.combo=Math.floor(S.combo*.82); S.comboTier=Math.min(S.comboTier, comboTier()); }
  if(e && evo('spikes')) damageEnemy(e, 6*damageMul() + S.wallLv*1.5, true);
  if(e && e.corrode) S.corrodeT=5;
  if(evo('laststand') && S.laststandReady && S.wallHp/S.wallMax<.28){
    S.laststandReady=false;
    S.wallHp=Math.min(S.wallMax,S.wallHp+S.wallMax*.35);
    S.wallShield=shieldMax();
    explode(CX,CY,520,180*damageMul(),'#f3bd36');
    gainMana(900*overMul(),CX,CY,'#f3bd36');
    addFloat(CX,CY-C.WALL_R-90,'不破孤岛','#f3bd36',30);
    toast('<b style="color:#f3bd36">不破孤岛</b> — 低血巨型清屏触发','good');
  }
  if(S.wallHp<=0) lose('wall');
}

function damageEnemy(e,dmg,silent=false,opts={}){
  if(!e || e.hp<=0) return;
  if(opts.shred) e.armorBreak=Math.max(e.armorBreak||0,evo('shred')?2.6:1.2);
  const armor=opts.trueDamage?0:Math.max(0,(e.armor||0)-(e.armorBreak||0));
  const real=Math.max(1,dmg-armor);
  e.hp-=real;
  if(!silent && (real>20 || Math.random()<.35)) addFloat(e.x,e.y-10,fmt(real),real>60?'#f3bd36':'#e9f0f7',real>60?18:12);
  if(e.hp<=0) killEnemy(e);
}
function killEnemy(e){
  if(e===S.boss){ win(); return; }
  const idx=S.enemies.indexOf(e); if(idx<0) return;
  S.enemies.splice(idx,1);
  S.kills++; S.totalKills++; S.combo++; S.comboT=2.6;
  S.stageThreat += e.threat||1;
  let reward=e.reward * mineScale() * comboMul() * overMul();
  if(evo('siphon')) reward*=1.45;
  gainMana(reward,e.x,e.y,e.elite?'#ef4b55':'#49c7ff');
  if(evo('siphon') && Math.random()<(evo('conduit')?.18:.08)) explode(e.x,e.y,evo('conduit')?58:38,7.5*damageMul(),'#49c7ff');
  checkComboSurge();
  if(e.elite) addFloat(e.x,e.y-18,'污染精英 +'+fmt(reward),'#ef4b55',18);
  burst(e.x,e.y,e.elite?28:10,e.color,e.elite?210:120,.55);
  if(e.split){
    for(let i=0;i<3;i++) spawnEnemy('mini', rnd(0,Math.PI*2), .9);
    const kids=S.enemies.slice(-3); kids.forEach(k=>{k.x=e.x+rnd(-14,14);k.y=e.y+rnd(-14,14);});
  }
  if(evo('blast') && Math.random()<.30) explode(e.x,e.y,evo('storm')?82:52,12*damageMul(),'#f3bd36');
  sfx(e.elite?'big':'kill');
}
function comboTier(){
  if(S.combo>=1000) return 5;
  if(S.combo>=500) return 4;
  if(S.combo>=200) return 3;
  if(S.combo>=75) return 2;
  if(S.combo>=25) return 1;
  return 0;
}
function checkComboSurge(){
  const tier=comboTier();
  if(tier<=S.comboTier) return;
  S.comboTier=tier;
  const dmg=[0,10,20,36,60,95][tier]*damageMul();
  const radius=[0,105,150,210,280,390][tier];
  const bonus=[0,35,90,220,520,1300][tier]*overMul();
  explode(CX,CY,radius,dmg,'#f3bd36');
  gainMana(bonus,CX,CY,'#f3bd36');
  addFloat(CX,CY-C.WALL_R-74,`连击爆发 x${comboMul().toFixed(1)}`,'#f3bd36',24+tier*2);
  burst(CX,CY,42+tier*18,'#f3bd36',220+tier*45,.75);
  sfx('big');
}
function explode(x,y,r,dmg,color){
  burst(x,y,34,color,230,.6);
  for(const e of [...S.enemies]) if(dist(x,y,e.x,e.y)<=r) damageEnemy(e,dmg,true);
  if(S.boss && dist(x,y,S.boss.x,S.boss.y)<=r+24) damageEnemy(S.boss,dmg,true);
}

function wallAttack(dt){
  const targets=[...S.enemies]; if(S.boss) targets.push(S.boss);
  const baseRange=190 + (evo('pierce')?36:0) + (evo('volley')?28:0);
  S.attackCd-=dt;
  const shotsPerFire=1+(evo('multi')?2:0)+(evo('volley')?4:0);
  const rate=5.6*fireRateMul();
  while(S.attackCd<=0){
    S.attackCd+=1/rate;
    const inRange=targets.filter(e=>e.hp>0 && dist(CX,CY,e.x,e.y)<=C.WALL_R+baseRange).sort((a,b)=>dist(CX,CY,a.x,a.y)-dist(CX,CY,b.x,b.y));
    for(let i=0;i<Math.min(shotsPerFire,inRange.length);i++) shootAt(inRange[i], i);
  }
}
function shootAt(tgt,slot=0){
  const a=Math.atan2(tgt.y-CY,tgt.x-CX)+slot*.08;
  const sx=CX+Math.cos(a)*C.WALL_R, sy=CY+Math.sin(a)*C.WALL_R;
  const dmg=6.6*damageMul();
  S.shots.push({x:sx,y:sy,tx:tgt.x,ty:tgt.y,t:0,speed:720,color:evo('chain')?'#7ee7ff':'#f3bd36',r:evo('chain')?2.4:2});
  damageEnemy(tgt,dmg,false,{shred:evo('shred')});
  if(evo('pierce')){
    const lineA=Math.atan2(tgt.y-sy,tgt.x-sx);
    const list=S.enemies.filter(e=>e!==tgt && e.hp>0 && Math.abs(Math.sin(Math.atan2(e.y-sy,e.x-sx)-lineA))*dist(sx,sy,e.x,e.y)<18 && dist(sx,sy,e.x,e.y)<280).slice(0,evo('volley')?9:5);
    list.forEach(e=>damageEnemy(e,dmg*.68,true,{shred:evo('shred')}));
  }
  if(evo('chain')) chainFrom(tgt,evo('volley')?8:5,dmg*.70);
}
function chainFrom(src,n,dmg){
  let cur=src;
  for(let i=0;i<n;i++){
    const next=S.enemies.filter(e=>e!==cur && e.hp>0 && dist(cur.x,cur.y,e.x,e.y)<95).sort((a,b)=>dist(cur.x,cur.y,a.x,a.y)-dist(cur.x,cur.y,b.x,b.y))[0];
    if(!next) break;
    S.shots.push({x:cur.x,y:cur.y,tx:next.x,ty:next.y,t:0,speed:900,color:'#7ee7ff',r:2});
    damageEnemy(next,dmg,true,{shred:evo('shred')}); cur=next; dmg*=.75;
  }
}

function fireRailgun(){
  const targets=[...S.enemies]; if(S.boss) targets.push(S.boss);
  const tgt=targets.filter(e=>e.hp>0).sort((a,b)=>b.hp-a.hp)[0];
  if(!tgt) return;
  const a=Math.atan2(tgt.y-CY,tgt.x-CX), sx=CX+Math.cos(a)*C.WALL_R, sy=CY+Math.sin(a)*C.WALL_R;
  const main=(evo('annihilator')?150:92)*damageMul();
  const splash=(evo('annihilator')?56:30)*damageMul();
  const radius=evo('annihilator')?150:96;
  S.shots.push({x:sx,y:sy,tx:tgt.x,ty:tgt.y,t:0,speed:520,color:'#ffe15f',r:evo('annihilator')?6:4});
  damageEnemy(tgt,main,false,{trueDamage:evo('annihilator'),shred:true});
  explode(tgt.x,tgt.y,radius,splash,'#ffe15f');
  addFloat(tgt.x,tgt.y-28,evo('annihilator')?'湮灭炮环':'破浪重炮','#ffe15f',22);
}

function updateEvos(dt){
  const freq=S.overdriveT>0 && evo('gear') ? 2 : 1;
  if(evo('railgun')){
    S.railCd-=dt*freq;
    if(S.railCd<=0){ S.railCd=evo('annihilator')?2.9:4.6; fireRailgun(); }
  }
  if(evo('fire')){
    S.fireCd-=dt*freq;
    if(S.fireCd<=0){
      S.fireCd=evo('inferno')?3.2:5;
      explode(CX,CY,C.WALL_R+(evo('inferno')?210:135),(evo('inferno')?42:24)*damageMul(),'#ff8a42');
      addFloat(CX,CY-C.WALL_R-45,evo('inferno')?'炼狱火环':'火焰环','#ff8a42',evo('inferno')?24:18);
    }
  }
  if(evo('frost')){
    S.frostCd-=dt*freq;
    if(S.frostCd<=0){
      S.frostCd=evo('inferno')?5.2:7;
      S.enemies.forEach(e=>{ if(dist(CX,CY,e.x,e.y)<C.WALL_R+230) e.slow=evo('inferno')?2.4:1.8; });
      burst(CX,CY,46,'#49c7ff',210,.6); addFloat(CX,CY+C.WALL_R+40,'冰霜脉冲','#49c7ff',19);
    }
  }
  if(evo('thornnova')){
    S.thornCd-=dt*freq;
    if(S.thornCd<=0){ S.thornCd=4.2; explode(CX,CY,C.WALL_R+90,24*damageMul(),'#4bd37b'); addFloat(CX,CY+C.WALL_R+70,'荆棘新星','#4bd37b',18); }
  }
  if(evo('blackhole')){
    S.blackCd-=dt*freq;
    if(S.blackCd<=0){ S.blackCd=evo('singularity')?10:16; blackhole(); }
  }
}
function blackhole(){
  if(!S.enemies.length) return;
  const center=[...S.enemies].sort((a,b)=>nearCount(b)-nearCount(a))[0];
  if(!center) return;
  center.pull=2.2; center.hole={x:center.x,y:center.y,t:2.2};
  S.parts.push({hole:true,x:center.x,y:center.y,life:2.2,max:2.2,r:55,color:'#a879ff'});
  for(const e of S.enemies) if(dist(center.x,center.y,e.x,e.y)<130){ e.pull=2.2; e.hx=center.x; e.hy=center.y; }
  setTimeout(()=>{
    if(!S) return;
    explode(center.x,center.y,evo('singularity')?150:105,(evo('singularity')?58:34)*damageMul(),'#a879ff');
    if(evo('singularity')){
      gainMana(420*comboMul()*overMul(),center.x,center.y,'#a879ff');
      addFloat(center.x,center.y-28,'奇点收割','#c9b6ff',24);
    }
  },900);
}
function nearCount(o){ return S.enemies.filter(e=>dist(o.x,o.y,e.x,e.y)<110).length; }

function advanceStage(){
  if(S.evoPending||S.paused||S.phase==='boss') return;
  burst(CX,CY,70,'#f3bd36',260,.8);
  const bonus=Math.round(160*Math.pow(S.stage,1.35)*(1+S.presses*.12));
  const pts=stageRewardPoints(S.stage);
  S.evoPts+=pts;
  gainMana(bonus,CX,CY,'#f3bd36');
  toast(`<b style="color:#f3bd36">阶段突破</b> — ${STAGES[S.stage-1].name} 清除，+${fmt(bonus)} 魔力，+${pts} 进化点`,'good');
  S.enemies.length=0;
  if(S.stage>=6){ startBoss(); return; }
  S.stage++; S.stageT=0; S.stageThreat=0; S.stageWarned=false; S.surgeCd=4; S.spawnBag=0;
  renderShop(true);
}
function offerEvolution(){
  S.paused=true; S.evoPending=true;
  const avail=EVOS.filter(e=>!S.evos.includes(e.id));
  const pool=[...avail], cards=[];
  while(cards.length<3 && pool.length) cards.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  openModal(`
    <div class="mtitle" style="color:#f3bd36">围墙进化</div>
    <div class="msub">选择一种会立刻改变画面的防御方式。下一阶段怪潮会更密。</div>
    <div class="choices">${cards.map(c=>`<button class="choice evo" data-id="${c.id}"><h4>${c.name}</h4><p>${c.desc}</p></button>`).join('')}</div>
  `);
  document.querySelectorAll('.evo').forEach(btn=>btn.onclick=()=>{
    const card=EVOS.find(e=>e.id===btn.dataset.id); if(!card) return;
    S.evos.push(card.id); S.stage++; S.stageT=0; S.stageThreat=0; S.spawnBag=0; S.evoPending=false; S.paused=false;
    closeModal(); renderShop(true); sfx('evo'); burst(CX,CY,50,'#a879ff',220,.7);
    toast(`<b style="color:#c9b6ff">${card.name}</b> 已刻入围墙`,'good');
  });
}

function startBoss(){
  S.phase='boss'; S.stageT=0; S.stageThreat=0; S.enemies.length=0;
  const hp=18000*Math.pow(1.18,S.presses)*(1+S.debt*.14)*(1+S.stage*.10);
  const a=rnd(0,Math.PI*2);
  S.boss={type:'boss',name:'收债者',x:CX+Math.cos(a)*(C.WALL_R+170),y:CY+Math.sin(a)*(C.WALL_R+170),a,hp,maxhp:hp,r:32,cd:1.25,color:'#ef4b55',armor:2+Math.floor(S.presses/2),dmg:30+S.presses*4,reward:0,threat:0};
  S.message='BOSS 收债';
  burst(CX,CY,90,'#ef4b55',280,.9); sfx('bad');
  toast(`<b style="color:#ef4b55">BOSS 收债</b> — 过载债务正在显形`,'bad');
}
function updateBoss(dt){
  if(!S.boss) return;
  const b=S.boss;
  b.a += dt*.55; const rr=C.WALL_R+155+Math.sin(S.t*.6)*25;
  b.x=CX+Math.cos(b.a)*rr; b.y=CY+Math.sin(b.a)*rr;
  b.cd-=dt; if(b.cd<=0){ b.cd=1.8; wallHit(b.dmg,b); S.shots.push({x:b.x,y:b.y,tx:CX,ty:CY,t:0,speed:360,color:'#ef4b55',r:4}); }
  S.bossSummon-=dt;
  if(S.bossSummon<=0){
    S.bossSummon=5.5;
    const count=2+Math.floor(S.presses/2);
    for(let i=0;i<count;i++) spawnEnemy(S.corruption>3&&i===0?'elite':'grunt',rnd(0,Math.PI*2),1.4);
    if(Math.random()<.75) spawnFieldEvent(Math.random()<.45?'rift':'blast');
    toast('债务怪潮涌入','bad');
  }
  const pct=b.hp/b.maxhp;
  for(const [key,mark] of [['p75',.75],['p50',.5],['p25',.25]]){
    if(!S.bossMarks[key] && pct<=mark){
      S.bossMarks[key]=true;
      const bonus=220*(1+(1-mark)*3)*(1+S.presses*.1);
      gainMana(bonus,b.x,b.y,'#f3bd36');
      explode(b.x,b.y,110,35*damageMul(),'#f3bd36');
      toast(`<b style="color:#f3bd36">BOSS 破防</b> — 喷出 ${fmt(bonus)} 魔力`,'good');
    }
  }
  if(b.hp<=0) win();
}

function update(dt){
  if(S.over) return;
  if(S.paused){ draw(); return; }
  S.t+=dt; S.stageT+=dt;
  S.rateBuf=S.rateBuf.filter(x=>S.t-x.t<1); S.rate=S.rateBuf.reduce((a,b)=>a+b.a,0);
  if(S.comboT>0){ S.comboT-=dt; if(S.comboT<=0){ S.combo=0; S.comboTier=0; } }
  if(S.mineCd>0){ S.mineCd-=dt; if(S.mineCd<=0){ S.mineCd=0; S.mineReadyAt=S.t; } }
  if(S.minePulse>0) S.minePulse-=dt*3;
  if(S.wallFlash>0) S.wallFlash-=dt*3;
  if(S.corrodeT>0) S.corrodeT-=dt;
  if(S.fieldHint>0) S.fieldHint-=dt;
  if(S.overdriveT>0){ S.overdriveT-=dt; if(S.overdriveT<=0){ S.overdriveT=0; toast('过载结束，债务已记录到 BOSS。','bad'); } }
  if(S.overdriveCd>0) S.overdriveCd-=dt;
  S.wallHp=Math.min(S.wallMax,S.wallHp+(S.repairLv*2.4*(evo('bulwark')?1.5:1))*dt);
  const sm=shieldMax();
  if(sm>0) S.wallShield=Math.min(sm,S.wallShield+(7+S.repairLv*1.15)*(evo('aegis')?1.7:1)*dt);
  else S.wallShield=0;

  if(!S.phase && S.t>=S.spawnDelay) S.phase='swarm';
  if(S.phase==='swarm'){
    const st=STAGES[S.stage-1];
    const pressure=S.stageT>st.max ? 1+Math.min(1.35,(S.stageT-st.max)/18) : 1;
    const rate=st.rate*(S.overdriveT>0?2.4:1)*(1+S.presses*.05)*pressure;
    if(S.t>=S.spawnDelay) S.spawnBag+=rate*dt;
    while(S.spawnBag>=1){ S.spawnBag-=1; spawnStageEnemy(); }
    if(S.stageT>st.max){
      if(!S.stageWarned){
        S.stageWarned=true;
        toast('<b style="color:#ef4b55">清怪不足</b> — 怪潮进入压迫波，必须提高有效清屏','bad');
      }
      S.surgeCd-=dt;
      if(S.surgeCd<=0){
        S.surgeCd=6.5;
        spawnFieldEvent('rift');
        for(let i=0;i<4+S.stage;i++) spawnEnemy(i%3===0?'brute':i%2===0?'runner':'grunt',rnd(0,Math.PI*2),1.55);
      }
    }
    S.fieldCd-=dt*(S.overdriveT>0?1.6:1);
    if(S.fieldCd<=0){
      S.fieldCd=rnd(10,15)/(evo('conduit')?1.25:1);
      spawnFieldEvent(S.stage>=4 && Math.random()<.4 ? 'rift' : null);
    }
    if(S.stageThreat>=st.target) advanceStage();
  }
  if(S.phase==='boss') updateBoss(dt);
  updateEnemies(dt); wallAttack(dt); updateEvos(dt); updateVisuals(dt);
  if(S.t-S.lastRenderShop>.2){ renderShop(); S.lastRenderShop=S.t; }
  updateHUD();
}
function updateEnemies(dt){
  for(let i=S.enemies.length-1;i>=0;i--){
    const e=S.enemies[i]; if(e.hp<=0){ killEnemy(e); continue; }
    const d=dist(CX,CY,e.x,e.y);
    if(e.slow>0) e.slow-=dt;
    if(e.armorBreak>0) e.armorBreak-=dt*.35;
    if(e.pull>0){ e.pull-=dt; const hx=e.hx||CX, hy=e.hy||CY; e.x+=(hx-e.x)*dt*2.8; e.y+=(hy-e.y)*dt*2.8; }
    const stop=C.WALL_R+e.r+(e.ranged||0);
    if(d>stop){
      const a=Math.atan2(CY-e.y,CX-e.x), slow=e.slow>0?.28:1;
      e.x+=Math.cos(a)*e.spd*slow*dt; e.y+=Math.sin(a)*e.spd*slow*dt;
    } else {
      e.cd-=dt; if(e.cd<=0){ e.cd=e.ranged?1.2:.85; wallHit(e.dmg,e); }
    }
  }
}
function updateVisuals(dt){
  for(let i=S.shots.length-1;i>=0;i--){ const s=S.shots[i]; s.t+=dt*s.speed/Math.max(1,dist(s.x,s.y,s.tx,s.ty)); if(s.t>=1) S.shots.splice(i,1); }
  for(let i=S.parts.length-1;i>=0;i--){ const p=S.parts[i]; p.life-=dt; if(!p.hole){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;} if(p.life<=0) S.parts.splice(i,1); }
  for(let i=S.floats.length-1;i>=0;i--){ const f=S.floats[i]; f.y-=34*dt; f.life-=dt; if(f.life<=0) S.floats.splice(i,1); }
  for(let i=S.bits.length-1;i>=0;i--){ const b=S.bits[i]; b.t+=dt*1.8; b.x+=(b.tx-b.x)*dt*4; b.y+=(b.ty-b.y)*dt*4; if(b.t>=1) S.bits.splice(i,1); }
  for(let i=S.fieldEvents.length-1;i>=0;i--){
    const ev=S.fieldEvents[i]; ev.life-=dt;
    if(ev.life<=0){ expireFieldEvent(ev); S.fieldEvents.splice(i,1); }
  }
}

function win(){
  if(S.over) return; S.over=true; S.won=true; sfx('evo');
  const score=Math.round(S.totalKills + S.totalMana*.1 + S.presses*80 + S.evos.length*120 + S.wallHp);
  openModal(`
    <div class="grade" style="color:#f3bd36">胜</div>
    <div class="mtitle" style="text-align:center">围墙守住了</div>
    <div class="msub" style="text-align:center">这座岛被升级成了一台清屏机器。</div>
    <div class="rows">
      <span class="k">用时</span><span class="v">${Math.floor(S.t/60)}:${String(Math.floor(S.t%60)).padStart(2,'0')}</span>
      <span class="k">击杀</span><span class="v">${fmt(S.totalKills)}</span>
      <span class="k">总魔力</span><span class="v">${fmt(S.totalMana)}</span>
      <span class="k">过载次数</span><span class="v">${S.presses}</span>
      <span class="k">进化</span><span class="v">${S.evos.length} 个</span>
      <span class="k">分数</span><span class="v" style="color:#f3bd36">${fmt(score)}</span>
    </div>
    <div class="btnrow"><button class="mbtn pri" onclick="restart()">再来一局</button></div>
  `);
}
function lose(kind){
  if(S.over) return; S.over=true; sfx('bad');
  let reason='怪潮击穿了围墙。';
  if(kind==='wall' && S.presses>=6) reason=`你按了 ${S.presses} 次，污染债务把怪潮和 BOSS 推高了。`;
  else if(kind==='wall' && S.wallLv<4) reason='围墙加固不足，怪物持续啃墙击穿了防线。';
  else if(S.evos.length<3) reason='进化数量太少，后期缺少清屏手段。';
  openModal(`
    <div class="grade" style="color:#ef4b55">败</div>
    <div class="mtitle" style="text-align:center">围墙破碎</div>
    <div class="msub" style="text-align:center">${reason}</div>
    <div class="rows">
      <span class="k">存活</span><span class="v">${Math.floor(S.t/60)}:${String(Math.floor(S.t%60)).padStart(2,'0')}</span>
      <span class="k">击杀</span><span class="v">${fmt(S.totalKills)}</span>
      <span class="k">最高连击</span><span class="v">${fmt(S.combo)}</span>
      <span class="k">过载次数</span><span class="v">${S.presses}</span>
    </div>
    <div class="btnrow"><button class="mbtn pri" onclick="restart()">重开</button></div>
  `);
}

// ---------------------- Render ----------------------
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let DPR=1, OX=0, OY=0, SC=1;
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  const r=cv.parentElement.getBoundingClientRect();
  cv.width=r.width*DPR; cv.height=r.height*DPR; cv.style.width=r.width+'px'; cv.style.height=r.height+'px';
  SC=Math.min(r.width/C.W, r.height/C.H); OX=(r.width-C.W*SC)/2; OY=(r.height-C.H*SC)/2;
}
window.addEventListener('resize',resize);
function draw(){
  const r=cv.parentElement.getBoundingClientRect();
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,r.width,r.height);
  ctx.save(); ctx.translate(OX,OY); ctx.scale(SC,SC);
  drawOcean(); drawIsland(); drawWall(); drawMine(); drawFieldEvents(); drawEnemies(); drawBoss(); drawShots(); drawParticles(); drawManaBits(); drawFloats(); drawOverlay();
  ctx.restore();
}
function drawOcean(){
  const doom=clamp(S.presses/9,0,1);
  const g=ctx.createRadialGradient(CX,CY,80,CX,CY,520);
  g.addColorStop(0,doom>.2?'#1e2632':'#12354a'); g.addColorStop(.58,doom>.2?'#151a27':'#0b1b27'); g.addColorStop(1,doom?'#170609':'#050b12');
  ctx.fillStyle=g; ctx.fillRect(0,0,C.W,C.H);
  ctx.lineWidth=1;
  for(let i=0;i<9;i++){
    const rr=160+i*36+Math.sin(S.t*.8+i)*7;
    ctx.strokeStyle=`rgba(${doom>.35?'239,75,85':'73,199,255'},${.08-i*.005+doom*.025})`;
    ctx.beginPath(); ctx.arc(CX,CY,rr,0,Math.PI*2); ctx.stroke();
  }
}
function drawIsland(){
  ctx.save(); ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=30; ctx.shadowOffsetY=8;
  ctx.fillStyle='#c7b682'; ctx.beginPath(); ctx.arc(CX,CY,C.WALL_R+34,0,Math.PI*2); ctx.fill(); ctx.restore();
  const g=ctx.createRadialGradient(CX-45,CY-45,20,CX,CY,C.WALL_R+20);
  g.addColorStop(0,'#64a95a'); g.addColorStop(.65,'#3f7a43'); g.addColorStop(1,'#285a34');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(CX,CY,C.WALL_R+20,0,Math.PI*2); ctx.fill();
}
function drawWall(){
  const hp=S.wallHp/S.wallMax, flash=Math.max(0,S.wallFlash);
  ctx.save(); ctx.translate(CX,CY);
  ctx.lineWidth=18+Math.min(16,S.wallLv*1.4);
  ctx.strokeStyle=flash>0?'#ef4b55':'#6d7480'; ctx.beginPath(); ctx.arc(0,0,C.WALL_R,0,Math.PI*2); ctx.stroke();
  ctx.lineWidth=8; ctx.strokeStyle='#9aa4b1'; ctx.beginPath(); ctx.arc(0,0,C.WALL_R,0,Math.PI*2*hp); ctx.stroke();
  if(S.wallShield>1){
    const sp=clamp(S.wallShield/Math.max(1,shieldMax()),0,1);
    ctx.lineWidth=4; ctx.strokeStyle=`rgba(73,199,255,${.25+.45*sp})`; ctx.beginPath(); ctx.arc(0,0,C.WALL_R+16,0,Math.PI*2*sp); ctx.stroke();
  }
  if(evo('spikes')){ ctx.fillStyle='#d8dde8'; for(let i=0;i<36;i++){ const a=i/36*Math.PI*2; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(C.WALL_R+8,0); ctx.lineTo(C.WALL_R+22,5); ctx.lineTo(C.WALL_R+22,-5); ctx.closePath(); ctx.fill(); ctx.restore(); } }
  if(evo('fire')){ ctx.strokeStyle=`rgba(255,138,66,${.22+Math.sin(S.t*4)*.08})`; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(0,0,C.WALL_R+20,0,Math.PI*2); ctx.stroke(); }
  if(evo('frost')){ ctx.strokeStyle='rgba(73,199,255,.32)'; ctx.lineWidth=4; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.arc(0,0,C.WALL_R+28,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
}
function drawMine(){
  const ready=S.mineCd<=0, perfect=ready&&S.mineReadyAt&&(S.t-S.mineReadyAt)<.32;
  const pulse=1+Math.max(0,S.minePulse)*.18+(perfect?Math.sin(S.t*22)*.04:Math.sin(S.t*2)*.02);
  ctx.save(); ctx.translate(CX,CY); ctx.scale(pulse,pulse);
  const g=ctx.createRadialGradient(0,0,5,0,0,70); g.addColorStop(0,perfect?'rgba(243,189,54,.58)':'rgba(73,199,255,.48)'); g.addColorStop(1,'rgba(73,199,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,70,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#223545'; ctx.beginPath(); ctx.ellipse(0,18,42,15,0,0,Math.PI*2); ctx.fill();
  const rocks=[[0,-32,18],[-18,-20,12],[19,-22,13],[-8,-8,10],[12,-6,9]];
  for(const [x,y,h] of rocks){ const cg=ctx.createLinearGradient(x-8,y-h,x+8,y+h); cg.addColorStop(0,perfect?'#fff1a4':'#9fe7ff'); cg.addColorStop(.6,perfect?'#f3bd36':'#35bdea'); cg.addColorStop(1,'#126b96'); ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(x,y-h); ctx.lineTo(x+8,y+3); ctx.lineTo(x+3,y+h); ctx.lineTo(x-5,y+h); ctx.lineTo(x-8,y+3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle=perfect?'#f3bd36':ready?'rgba(73,199,255,.75)':'rgba(73,199,255,.25)'; ctx.lineWidth=perfect?4:2; ctx.beginPath(); ctx.arc(CX,CY,54,0,Math.PI*2); ctx.stroke();
}
function drawEnemies(){
  for(const e of S.enemies){
    ctx.save(); ctx.translate(e.x,e.y);
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,e.r+5,e.r*.8,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.fill();
    if(e.elite){ ctx.strokeStyle='#ffd0d3'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,e.r+5,0,Math.PI*2); ctx.stroke(); }
    if(e.armorBreak>0){ ctx.strokeStyle='#ffe15f'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(-e.r*.6,-e.r*.35); ctx.lineTo(e.r*.5,e.r*.2); ctx.stroke(); }
    if(e.corrode){ ctx.fillStyle='#baffcd'; ctx.beginPath(); ctx.arc(-3,-2,2,0,Math.PI*2); ctx.arc(4,-2,2,0,Math.PI*2); ctx.fill(); }
    if(e.hp<e.maxhp){ ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(-e.r,-e.r-8,e.r*2,3); ctx.fillStyle='#ef4b55'; ctx.fillRect(-e.r,-e.r-8,e.r*2*(e.hp/e.maxhp),3); }
    ctx.restore();
  }
}
function drawFieldEvents(){
  for(const ev of S.fieldEvents){
    const p=clamp(ev.life/ev.max,0,1), pulse=.5+.5*Math.sin(S.t*9);
    ctx.save(); ctx.translate(ev.x,ev.y); ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=ev.color; ctx.globalAlpha=.28+.28*p; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,ev.r+12+pulse*8,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=.14+.2*p; ctx.fillStyle=ev.color; ctx.beginPath(); ctx.arc(0,0,ev.r+20,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.fillStyle=ev.color; ctx.beginPath(); ctx.arc(0,0,ev.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.globalAlpha=.75; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,ev.r*.58,0,Math.PI*2*p); ctx.stroke();
    ctx.globalAlpha=1; ctx.textAlign='center'; ctx.font='800 12px "Segoe UI",sans-serif'; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.65)'; ctx.strokeText(ev.label,0,-ev.r-16); ctx.fillStyle=ev.hazard?'#ffb0b4':'#e9f0f7'; ctx.fillText(ev.label,0,-ev.r-16);
    ctx.restore();
  }
}
function drawBoss(){
  if(!S.boss) return; const b=S.boss;
  ctx.save(); ctx.translate(b.x,b.y);
  const g=ctx.createRadialGradient(0,0,8,0,0,70); g.addColorStop(0,'rgba(239,75,85,.45)'); g.addColorStop(1,'rgba(239,75,85,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,70,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#8f1720'; ctx.beginPath(); ctx.moveTo(0,-32); ctx.lineTo(27,-10); ctx.lineTo(22,25); ctx.lineTo(0,36); ctx.lineTo(-22,25); ctx.lineTo(-27,-10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#ff727b'; ctx.lineWidth=3; ctx.stroke();
  ctx.fillStyle='#ffe15f'; ctx.beginPath(); ctx.arc(-9,-8,4,0,Math.PI*2); ctx.arc(9,-8,4,0,Math.PI*2); ctx.fill();
  ctx.restore();
  const bw=190; ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillRect(b.x-bw/2,b.y-55,bw,8); ctx.fillStyle='#ef4b55'; ctx.fillRect(b.x-bw/2,b.y-55,bw*Math.max(0,b.hp/b.maxhp),8);
}
function drawShots(){
  for(const s of S.shots){ const t=clamp(s.t,0,1), x=s.x+(s.tx-s.x)*t, y=s.y+(s.ty-s.y)*t, p=clamp(t-.1,0,1), px=s.x+(s.tx-s.x)*p, py=s.y+(s.ty-s.y)*p; ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.strokeStyle=s.color; ctx.lineWidth=(s.r||2)*2.4; ctx.globalAlpha=.16; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke(); ctx.globalAlpha=1; ctx.lineWidth=s.r||2; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke(); ctx.restore(); }
}
function drawParticles(){
  for(const p of S.parts){ ctx.save(); ctx.globalAlpha=Math.max(0,p.life/p.max); if(p.hole){ ctx.strokeStyle=p.color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1-p.life/p.max*.4),0,Math.PI*2); ctx.stroke(); } else { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
}
function drawManaBits(){
  for(const b of S.bits){ ctx.save(); ctx.globalAlpha=clamp(b.t+.2,0,1); ctx.fillStyle=b.color; ctx.beginPath(); ctx.arc(b.x,b.y,2.2,0,Math.PI*2); ctx.fill(); ctx.restore(); }
}
function drawFloats(){
  ctx.textAlign='center';
  for(const f of S.floats){ ctx.save(); ctx.globalAlpha=Math.max(0,f.life/f.max); ctx.font=`800 ${f.size}px "Segoe UI",sans-serif`; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.65)'; ctx.strokeText(f.txt,f.x,f.y); ctx.fillStyle=f.color; ctx.fillText(f.txt,f.x,f.y); ctx.restore(); }
}
function drawOverlay(){
  const doom=clamp(S.presses/9,0,1);
  if(S.overdriveT>0 || doom>0){ const a=S.overdriveT>0?.13:.04*doom; ctx.fillStyle=`rgba(239,75,85,${a})`; ctx.fillRect(0,0,C.W,C.H); }
}

function renderShop(force=false){
  const box=document.getElementById('upgradeList');
  if(!box) return;
  box.innerHTML='<div class="sec">常驻升级</div>'+UPGRADES.map(u=>{
    const cost=u.cost(S), ok=S.mana>=cost;
    return `<div class="upgrade ${ok?'':'off'}" data-id="${u.id}"><div><h3>${u.name}</h3><p>${u.desc(S)}</p></div><div class="cost">${fmt(cost)}</div></div>`;
  }).join('');
  box.querySelectorAll('.upgrade').forEach(el=>{ if(!el.classList.contains('off')) el.onclick=()=>buyUpgrade(el.dataset.id); });
  const tree=document.getElementById('techTree');
  if(tree){
    const readyNodes=EVOS.filter(canBuyTech).sort((a,b)=>a.tier-b.tier);
    const routeTip=!S.evos.length?'开局建议：先拿多重箭孔 + 火焰环，经济线第二阶段后再补':readyNodes.length?`当前可点：${readyNodes.slice(0,3).map(n=>n.name).join(' / ')}`:'先完成可见前置，或推进阶段拿进化点';
    tree.innerHTML=`<div class="treeHead"><b>围墙拓扑树</b><span>进化点 ${S.evoPts}</span></div><div class="routeTip">${routeTip}</div>`+
      BRANCH_ORDER.map(branch=>{
        const nodes=EVOS.filter(e=>e.branch===branch).sort((a,b)=>a.tier-b.tier);
        return `<div class="branchRow"><div class="branchLabel">${branch}</div><div class="branchNodes">${nodes.map(n=>{
          const got=evo(n.id), ready=canBuyTech(n), missing=n.req.filter(id=>!evo(id));
          const req=n.req.length?n.req.map(id=>EVOS.find(e=>e.id===id).name).join(' + '):'入口';
          const hint=got?'已解锁':ready?'可解锁':missing.length?`缺：${missing.map(id=>EVOS.find(e=>e.id===id).name).join(' / ')}`:`缺 ${techCost(n)-S.evoPts} 点`;
          const cls=got?'got':ready?'ready':'locked';
          return `<div class="techNode ${cls}" data-id="${n.id}"><span class="costDot">${got?'✓':ready?'可点':techCost(n)+'点'}</span><h4>T${n.tier} · ${n.name}</h4><p>${n.desc}</p><div class="meta">前置：${req}</div><div class="hint">${hint}</div></div>`;
        }).join('')}</div></div>`;
      }).join('');
    tree.querySelectorAll('.techNode.ready').forEach(el=>el.onclick=()=>buyTech(el.dataset.id));
  }
}
function updateHUD(){
  document.getElementById('sMana').textContent=fmt(S.mana);
  document.getElementById('sRate').textContent=fmt(S.rate)+'/s';
  document.getElementById('sCombo').textContent='x'+comboMul().toFixed(1);
  document.getElementById('sKills').textContent=fmt(S.totalKills);
  document.getElementById('sWall').textContent=fmt(Math.max(0,S.wallHp))+(S.wallShield>1?'+'+fmt(S.wallShield):'');
  document.getElementById('sStage').textContent=S.phase==='boss'?'BOSS':'S'+S.stage;
  document.getElementById('wallfill').style.width=clamp(S.wallHp/S.wallMax*100,0,100)+'%';
  document.getElementById('wallfill').style.background=S.wallHp/S.wallMax>.35?'linear-gradient(90deg,#4bd37b,#a4e66a)':'linear-gradient(90deg,#ef4b55,#f3bd36)';
  document.getElementById('phaseTag').textContent=S.overdriveT>0?'贪婪过载':S.message;
  document.documentElement.style.setProperty('--doom',clamp(S.presses/9,0,1).toFixed(3));
  const st=STAGES[S.stage-1];
  const obj=document.getElementById('objective');
  if(S.phase==='boss') obj.innerHTML=`<div class="ot">BOSS 收债</div><div class="on">污染精英会持续涌入</div><div class="op">过载 ${S.presses} 次 · BOSS 护甲 ${S.boss?S.boss.armor:0}</div>`;
  else {
    const eventTip=S.fieldEvents.length?`战场事件：点击 ${S.fieldEvents.map(e=>e.label).join(' / ')}`:'战场会刷核心和裂隙，点击可清屏或修墙';
    const pressure=st&&S.stageT>st.max?' · 压迫波中':'';
    obj.innerHTML=`<div class="ot">阶段 ${S.stage} · ${st?st.name:'终局'}${pressure}</div><div class="on">威胁 ${fmt(S.stageThreat)} / ${st?fmt(st.target):'--'} · 进化点 ${S.evoPts}</div><div class="op">${eventTip}</div>`;
  }
  const btn=document.getElementById('bigbtn'), cd=document.getElementById('btnCd');
  const ready=S.overdriveCd<=0 && S.overdriveT<=0 && !S.over;
  btn.disabled=!ready;
  cd.textContent=S.overdriveT>0?Math.ceil(S.overdriveT):ready?'':Math.ceil(S.overdriveCd);
  document.getElementById('odState').textContent=S.overdriveT>0?'过载中':ready?'就绪':'冷却';
  const nextHp=18000*Math.pow(1.18,S.presses+1)*(1+(S.debt+1)*.14)*(1+S.stage*.10);
  document.getElementById('debt').innerHTML=`
    <div class="debtLine">已按 <b>${S.presses}</b> 次</div>
    <div class="debtLine">再按：BOSS 生命约 <b>${fmt(nextHp)}</b></div>
    <div class="debtLine">污染精英权重 +1 · 债务 +1</div>
    <div class="debtLine">战场核心会在怪潮中刷新，别只盯升级栏</div>`;
}
function openModal(html){ if(S&&!S.over) S.paused=true; document.getElementById('mbox').innerHTML=html; document.getElementById('modal').classList.add('on'); }
function closeModal(){ document.getElementById('modal').classList.remove('on'); if(S&&!S.over) S.paused=false; }
function restart(){ closeModal(); newGame(); renderShop(true); updateHUD(); }

function toWorld(ev){ const r=cv.getBoundingClientRect(); return {x:(ev.clientX-r.left-OX)/SC,y:(ev.clientY-r.top-OY)/SC}; }
cv.addEventListener('mousedown',ev=>{
  if(ev.button!==0) return;
  const p=toWorld(ev);
  const hit=S.fieldEvents.find(e=>dist(p.x,p.y,e.x,e.y)<e.r+22);
  if(hit){ activateFieldEvent(hit); return; }
  if(dist(p.x,p.y,CX,CY)<62) mineClick();
});
cv.addEventListener('mousemove',ev=>{
  const p=toWorld(ev);
  const hit=S.fieldEvents.some(e=>dist(p.x,p.y,e.x,e.y)<e.r+22);
  cv.style.cursor=hit||dist(p.x,p.y,CX,CY)<62?'pointer':'default';
});
window.addEventListener('keydown',ev=>{ if(ev.code==='Space'){ ev.preventDefault(); mineClick(); } });
document.getElementById('bigbtn').addEventListener('click',pressButton);

let last=performance.now();
function loop(now){ const dt=Math.min(.05,(now-last)/1000); last=now; update(dt); draw(); requestAnimationFrame(loop); }
newGame(); resize(); renderShop(true); updateHUD();
openModal(`
  <div class="mtitle">别按那个键 V2</div>
  <div class="msub">
    这版不再摆塔。怪潮会直接撞上环形围墙，你升级的是整座岛：围墙、攻击、攻速、魔力矿和清屏进化。<br>
    第一批敌人 5 秒内出现。击杀会喷出魔力粒子，连击越高收益越夸张，连击达标会自动触发清屏爆发。<br>
    左侧是拓扑进化树：阶段突破给进化点，先点前置，再解锁更强的清屏路线。<br>
    红按钮会立刻触发 20 秒贪婪过载：射速 x2.45，收益 x4，怪潮 x2.4，但所有爽感都会变成 BOSS 债务。
  </div>
  <div class="rows">
    <span class="k">采矿</span><span class="v">点击魔力矿或按 <kbd>Space</kbd></span>
    <span class="k">成长</span><span class="v">购买升级，用进化点点拓扑树</span>
    <span class="k">目标</span><span class="v">守住围墙，打赢收债 BOSS</span>
  </div>
  <div class="btnrow"><button class="mbtn pri" onclick="closeModal()">开始</button></div>
`);
requestAnimationFrame(loop);
