/* ===========================================================
   《别按那个键》可玩原型  v1.0
   所有美术均由代码程序化生成，无任何外部图片资源。
   数值全部来自 GDD 第 6-7 章，与 sim/economy_sim_v3.py 一致。
   =========================================================== */

// ---------------------- 数值配置（对应 GDD 6.3 / 7.x / v1.1 扩展） ----------------------
const C = {
  nodeYield:  lv => 1 + (lv - 1),
  nodeCost:   lv => Math.round(10 * Math.pow(1.66, lv - 1)),
  cdAt:       sp => Math.max(0.15, 1.0 * Math.pow(0.88, sp - 1)),
  spdCost:    sp => Math.round(15 * Math.pow(1.72, sp - 1)),
  minerRate:  lv => 0.30 * lv,
  villCost:   n  => Math.round(20 * Math.pow(1.34, n)),
  arrowCost:  n  => Math.round(40 * Math.pow(1.48, n)),
  cannonCost: n  => Math.round(90 * Math.pow(1.48, n)),
  barrackCost:n  => Math.round(120 * Math.pow(2.2, n)),
  frostCost:  n  => Math.round(60 * Math.pow(1.45, n)),
  sniperCost: n  => Math.round(120 * Math.pow(1.6, n)),
  totemCost:  n  => Math.round(100 * Math.pow(1.55, n)),
  scoutCost:  n  => Math.round(70 * Math.pow(1.5, n)),
  towerUp:    (base,k) => Math.round(base * Math.pow(1.55, k + 1)),
  btnCdCost:  n  => Math.round(60 * Math.pow(1.9, n)),
  overcharge: n  => Math.round(250 * Math.pow(1.6, n)),
  pylonCost:  [150, 100, 170, 270, 420],   // Lv1 建造 + Lv2..Lv5 升级
  pylonRepair:[0, 2, 4, 6, 8, 8],
  SLOTS: 12, POP_BASE: 3, POP_PER_BAR: 4, MAX_BAR: 2, MAX_TOWER_UP: 6,
  BASE_HP: 500, SHIELD: 400,
  BTN_CD: 30, BTN_CD_MIN: 8,
  // BOSS：运行时几何验证后由 9000 降为 5000，移动模型改为绕岛螺旋（见 GDD 7.3 / 附录）
  BOSS_HP: 5000, BOSS_ATK: 40, BOSS_HP_MUL: 1.045, BOSS_ATK_MUL: 1.035,
  BOSS_ATK_CD: 3.2, BOSS_ORBIT_SPD: 95, BOSS_SPIRAL: 10,
  WAVE_QTY_MUL: 1.03, WAVE_HP_MUL: 1.02,
  SELL_RATE: 0.6,        // 卖塔回收比例（GDD 7.4）
  RES: {                 // 研究所（GDD 6.4）：经济 / 防御 / 风险 三分支
    crit:    { max:5, cost:lv=>Math.round(120*Math.pow(2,lv)),   name:'暴击挖掘', desc:l=>`点矿 ${l*4}% 概率 ×3` },
    miner:   { max:3, cost:lv=>Math.round(100*Math.pow(1.9,lv)), name:'矿工效率', desc:l=>`矿工产出 +${l*25}%` },
    pierce:  { max:3, cost:lv=>Math.round(140*Math.pow(2.1,lv)), name:'破甲弹',   desc:l=>`全塔无视护甲 ${l} 点` },
    repair:  { max:3, cost:lv=>Math.round(110*Math.pow(1.9,lv)), name:'工程修复', desc:l=>`建筑修复 +${(1.5*l).toFixed(1)} HP/s` },
    luck:    { max:2, cost:lv=>Math.round(200*Math.pow(2.4,lv)), name:'幸运星',   desc:l=>`空响权重 ${[4,2,1][l]}%` },
    foresee: { max:1, cost:lv=>150,                              name:'预知',     desc:()=>'按钮面板显示奖励权重' },
  },
};

const TOWERS = {
  arrow:  { name:'箭塔', dmg:8,  rate:0.8, range:110, air:true,  splash:0,  hp:120, cost:C.arrowCost,  base:40 },
  cannon: { name:'炮台', dmg:22, rate:1.8, range:95,  air:false, splash:40, hp:150, cost:C.cannonCost, base:90 },
  frost:  { name:'冰霜塔', dmg:4,  rate:1.2, range:90,  air:false, splash:0,  hp:120, cost:C.frostCost,  base:60, slow:2 },
  sniper: { name:'狙击塔', dmg:45, rate:3.5, range:220, air:false, splash:0,  hp:140, cost:C.sniperCost, base:120, snipe:true },
  totem:  { name:'图腾', dmg:0,  rate:0,   range:70,  air:false, splash:0,  hp:160, cost:C.totemCost,  base:100, totem:true },
  scout:  { name:'斥候塔', dmg:0,  rate:0,   range:60,  air:false, splash:0,  hp:120, cost:C.scoutCost,  base:70,  scout:true },
};

const ENEMIES = {
  grunt:   { name:'陆地怪', hp:40,  spd:30, dmg:5,  armor:0, air:false, r:9,  color:'#c05a3e', reward:4 },
  flyer:   { name:'飞行怪', hp:25,  spd:45, dmg:4,  armor:0, air:true,  r:8,  color:'#7f5fd6', reward:5, ranged:70 },
  tank:    { name:'肉盾怪', hp:200, spd:18, dmg:12, armor:3, air:false, r:14, color:'#5c6b7a', reward:14 },
  bomber:  { name:'爆炸怪', hp:30,  spd:55, dmg:0,  armor:0, air:false, r:9,  color:'#d4a017', reward:6, boom:35 },
  lurker:  { name:'潜行者', hp:30,  spd:50, dmg:6,  armor:0, air:false, r:8,  color:'#4f9d8f', reward:7, stealth:true },
  splitter:{ name:'分裂者', hp:70,  spd:40, dmg:6,  armor:0, air:false, r:9,  color:'#b08a2e', reward:9, split:true },
  smini:   { name:'迷你分裂', hp:25, spd:50, dmg:3,  armor:0, air:false, r:6,  color:'#c9a25a', reward:2 },
  shielder:{ name:'护盾兵', hp:60,  spd:30, dmg:4,  armor:0, air:false, r:10, color:'#6f7fc4', reward:8, aura:0.35 },
  stinger: { name:'自爆蜂', hp:18,  spd:90, dmg:0,  armor:0, air:true,  r:7,  color:'#d96a3a', reward:5, sting:40 },
  hexer:   { name:'献祭者', hp:50,  spd:22, dmg:0,  armor:0, air:false, r:9,  color:'#8a5fbf', reward:12, hex:true },
  elite:   { name:'精英守卫', hp:750, spd:15, dmg:18, armor:2, air:false, r:16, color:'#c04a5a', reward:0, elite:true },
};

const WAVES = [
  { grunt:8 },
  { grunt:10, flyer:4, lurker:3 },
  { grunt:10, tank:2, splitter:4, elite:1 },
  { grunt:10, flyer:6, bomber:6, stinger:4 },
  { grunt:10, tank:2, flyer:5, hexer:1, shielder:2, elite:1 },
];

const REWARDS = [
  { id:'ore',    w:22, name:'矿石雨',   desc:lv=>`+${lv*40} 魔力` },
  { id:'vill',   w:13, name:'免费村民', desc:()=>'+1 村民（不推高成本）' },
  { id:'oil',    w:13, name:'武器涂油', desc:()=>'全塔攻击 +8%' },
  { id:'fort',   w:13, name:'加固',     desc:()=>'建筑 HP +10%，基地 +50' },
  { id:'reso',   w:10, name:'矿脉共鸣', desc:()=>'矿脉等级 +1' },
  { id:'blue',   w:7,  name:'蓝图',     desc:()=>'下一座建筑免费（仍占格）' },
  { id:'rift',   w:7,  name:'时间裂隙', desc:()=>'发育期 +20s／战斗中冻结 3s' },
  { id:'meteor', w:5,  name:'陨石',     desc:()=>'全场敌人受 60 真实伤害' },
  { id:'bribe',  w:6,  name:'贿赂',     desc:()=>'当前敌人 HP −15%' },
  { id:'none',   w:4,  name:'空　响',   desc:()=>'什么都没有。代价照付。' },
];

const CURSES = [
  { id:'iron',  name:'铁壳',  desc:'BOSS 获得 8 点护甲，每次受击减伤' },
  { id:'echo',  name:'回响',  desc:'BOSS 每 10 秒召唤 2 只陆地怪' },
  { id:'pierce',name:'破魔',  desc:'BOSS 攻击无视护盾' },
  { id:'scorch',name:'焦土',  desc:'BOSS 攻击附带溅射伤害' },
  { id:'haste', name:'疾行',  desc:'BOSS 移动速度 +40%' },
  { id:'drain', name:'吸魔',  desc:'BOSS 受击时偷取你 5 点魔力' },
  { id:'outage',name:'断电',  desc:'你的魔力产出 -10%' },
  { id:'hate',  name:'憎恨',  desc:'BOSS 优先攻击护盾塔' },
  { id:'plague',name:'瘟疫',  desc:'BOSS 战期间建筑每秒 -1 HP' },
  { id:'fog',   name:'迷雾',  desc:'全塔射程 -20%（BOSS 战）' },
  { id:'bait',  name:'诱饵',  desc:'BOSS 战每 20 秒生成 1 只潜行者' },
];

// 波次事件池（GDD 7.4）—— 适应性压力，非新 sink
const EVENTS = [
  { id:'tailwind', name:'顺风',   w:16, desc:'敌人速度 +15%' },
  { id:'mist',     name:'迷雾',   w:14, desc:'塔射程 -15%（本波）' },
  { id:'gemrain',  name:'灵石雨', w:16, desc:'击杀掉落 +50%' },
  { id:'armor',    name:'岩甲',   w:12, desc:'敌人 +1 护甲（本波）' },
  { id:'rage',     name:'暴怒',   w:14, desc:'敌人伤害 +25%、生命 -20%' },
  { id:'airstrike',name:'空袭',   w:14, desc:'本波 +2 自爆蜂' },
  { id:'calm',     name:'平静',   w:10, desc:'无（稀缺的安心）' },
];

// ---------------------- 世界坐标 ----------------------
const W = 900, H = 680, CX = W/2, CY = H/2 + 8;
const NODE_R = 34, SPAWN_R = 300, BASE_R = 44, SLOT_R = 145;

const SLOTS = [];
for (let i = 0; i < C.SLOTS; i++) {
  const a = (i / C.SLOTS) * Math.PI * 2 - Math.PI/2;
  SLOTS.push({ i, a, x: CX + Math.cos(a)*SLOT_R, y: CY + Math.sin(a)*SLOT_R, b:null });
}

// ---------------------- 状态 ----------------------
let S = null;
function newGame() {
  S = {
    t:0, running:true, over:false, paused:false,
    mana:0, nodeLv:1, spdLv:1, mineCd:0,
    pop:[], // {job:'miner'|'warrior'|'archer'|'mage', x,y,hp,maxhp,tx,ty,cd,target}
    slots: SLOTS.map(s=>({...s, b:null})),
    arrows:0, cannons:0, barracks:0, pylonLv:0,
    frost:0, sniper:0, totem:0, scout:0,
    arrowUp:0, cannonUp:0, frostUp:0, sniperUp:0,
    ocUsed:0, btnCdLv:0, sold:0,
    res:{crit:0,miner:0,pierce:0,repair:0,luck:0,foresee:0},
    baseHp:C.BASE_HP, baseMax:C.BASE_HP, shield:0, shieldMax:0,
    atkBuff:1, hpBuff:1, ocActive:0,
    presses:0, curses:[], btnCd:C.BTN_CD, btnCdMax:C.BTN_CD,
    phase:'build', wave:0, phaseT:300, freeze:0,
    enemies:[], shots:[], parts:[], floats:[], spawnQ:[],
    boss:null, bossSummonT:0, bossBaitT:0,
    build:null, blueprint:0, sellMode:false,
    event:null, nextEvent:null, deadLog:[],
    hints:{}, killed:0, startT:Date.now(),
    fail:null,
  };
}

// ---------------------- 工具 ----------------------
const rnd=(a,b)=>a+Math.random()*(b-a);
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function wpick(list){
  const tot=list.reduce((s,x)=>s+x.w,0); let r=Math.random()*tot;
  for(const x of list){ r-=x.w; if(r<=0) return x; } return list[list.length-1];
}
function fmt(n){ n=Math.floor(n); return n>=10000? (n/1000).toFixed(1)+'k' : n.toLocaleString('en-US'); }
function mmss(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

// 派生值
const popCap    = ()=> C.POP_BASE + C.POP_PER_BAR*S.barracks;
const slotsUsed = ()=> S.slots.filter(s=>s.b).length;
const outageMul = ()=> S.curses.includes('outage') ? 0.9 : 1;
function income(){
  const miners=S.pop.filter(p=>p.job==='miner').length;
  return miners*C.minerRate(S.nodeLv)*outageMul()*(1+0.25*S.res.miner);
}
const towerUpLv = b => b.type==='arrow'?S.arrowUp : b.type==='cannon'?S.cannonUp
  : b.type==='frost'?S.frostUp : b.type==='sniper'?S.sniperUp : 0;
function totemBuff(slot){  // 图腾：70px 内每座 +20% 伤害 / +10% 射程（可叠加，GDD 6.3）
  let d=1,r=1;
  for(const o of S.slots)
    if(o.b && o.b.type==='totem' && dist(o.x,o.y,slot.x,slot.y)<=TOWERS.totem.range){ d*=1.2; r*=1.1; }
  return {d,r};
}
const scoutRateBuff = s => S.slots.some(o=>o.b&&o.b.type==='scout'&&dist(o.x,o.y,s.x,s.y)<=TOWERS.scout.range) ? 1.15 : 1;
function towerRangeMul(){ // 波次事件「迷雾」× 诅咒「迷雾」
  let m=1;
  if(S.event && S.event.id==='mist') m*=0.85;
  if(S.curses.includes('fog') && S.phase==='boss') m*=0.80;
  return m;
}
function towerDmg(t){
  const up=towerUpLv(t);
  return TOWERS[t.type].dmg*(1+0.25*up)*S.atkBuff*totemBuff(t).d;
}
function towerRate(t){
  const oc = S.ocActive>0 ? 1.35 : 1;
  return TOWERS[t.type].rate/(oc*scoutRateBuff(t));
}
function effArmor(e){ // 破甲弹研究无视护甲
  return Math.max(0,(e.armor||0)-S.res.pierce);
}

// ---------------------- 视觉效果 ----------------------
function burst(x,y,n,color,spd=90,life=.55){
  for(let i=0;i<n;i++){
    const a=rnd(0,Math.PI*2), v=rnd(spd*.35,spd);
    S.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,r:rnd(1.2,3)});
  }
}
function float(x,y,txt,color='#4fc3f7',size=14){
  S.floats.push({x,y,txt,color,size,life:1.0});
}
function toast(msg,type=''){
  const box=document.getElementById('toast');
  const d=document.createElement('div'); d.className='tmsg '+type; d.innerHTML=msg;
  box.appendChild(d);
  setTimeout(()=>{ d.style.transition='opacity .4s'; d.style.opacity=0;
    setTimeout(()=>d.remove(),400); }, 2600);
}

// ======================= 采集 / 经济 =======================
function mineClick(){
  if(S.mineCd>0 || S.over) return;
  let gain = C.nodeYield(S.nodeLv) * outageMul();
  let crit=false;
  if(S.res.crit>0 && Math.random() < 0.04*S.res.crit){ gain*=3; crit=true; }
  S.mana += gain;
  S.mineCd = C.cdAt(S.spdLv);
  float(CX+rnd(-16,16), CY-30, crit? '暴击 ×3! +'+Math.round(gain) : '+'+Math.round(gain), crit?'#f0b429':'#4fc3f7', crit?19:16);
  burst(CX,CY,crit?12:7,crit?'#f0b429':'#4fc3f7',crit?150:110,.45);
  S.nodePulse = 1;
  if(!S.hints.first){ S.hints.first=1; setHint('攒够 10 魔力可以升级<b style="color:#f0b429">魔力矿</b> — 等级决定一切收入'); }
}

function buy(cost){ if(S.mana<cost) return false; S.mana-=cost; return true; }

// ======================= 建造 =======================
function placeBuilding(slot, type){
  if(slot.b) return;
  let cost, ok=true;
  if(type==='arrow')      cost=C.arrowCost(S.arrows);
  else if(type==='cannon')cost=C.cannonCost(S.cannons);
  else if(type==='barracks'){ cost=C.barrackCost(S.barracks); ok=S.barracks<C.MAX_BAR; }
  else if(type==='pylon'){ cost=C.pylonCost[0]; ok=S.pylonLv===0; }
  else if(type==='frost') cost=C.frostCost(S.frost);
  else if(type==='sniper'){ cost=C.sniperCost(S.sniper); ok=S.sniper<2; }
  else if(type==='totem'){ cost=C.totemCost(S.totem); ok=S.totem<2; }
  else if(type==='scout'){ cost=C.scoutCost(S.scout); ok=S.scout<2; }
  if(!ok) return;
  if(S.blueprint>0){ cost=0; S.blueprint--; toast('<b style="color:#f0b429">蓝图生效</b> — 本座建筑免费','good'); }
  else if(!buy(cost)) return;

  const maxhp = (type==='pylon'?200:type==='barracks'?180:TOWERS[type]?TOWERS[type].hp:120)*S.hpBuff;
  slot.b = { type, hp:maxhp, maxhp, cd:0, ang:slot.a };
  if(type==='arrow')S.arrows++; else if(type==='cannon')S.cannons++;
  else if(type==='barracks')S.barracks++; else if(type==='pylon')S.pylonLv=1;
  else if(type==='frost')S.frost++; else if(type==='sniper')S.sniper++;
  else if(type==='totem')S.totem++; else if(type==='scout')S.scout++;
  burst(slot.x,slot.y,14,'#f0b429',120,.6);
  S.build=null; renderShop();
}

function recruit(job){
  const cost=C.villCost(S.pop.length);
  if(S.pop.length>=popCap()) { toast('人口已满 — 需要更多兵营','bad'); return; }
  if((job==='warrior'||job==='archer'||job==='mage') && S.barracks===0){ toast('需要先建造兵营','bad'); return; }
  if(!buy(cost)) return;
  spawnVillager(job);
  renderShop();
}
function spawnVillager(job){
  const a=rnd(0,Math.PI*2), r=rnd(55,80);
  S.pop.push({ job, x:CX+Math.cos(a)*r, y:CY+Math.sin(a)*r,
    hp: job==='warrior'?60:job==='archer'?35:30,
    maxhp: job==='warrior'?60:job==='archer'?35:30,
    cd:0, wob:rnd(0,6.28), target:null, hx:CX+Math.cos(a)*r, hy:CY+Math.sin(a)*r });
}

// ======================= 红按钮 =======================
function pressButton(){
  if(S.btnCd>0 || S.over) return;
  S.presses++;
  S.btnCdMax = Math.max(C.BTN_CD_MIN, C.BTN_CD*Math.pow(0.85,S.btnCdLv));
  S.btnCd = S.btnCdMax;

  // 人口满时把「免费村民」剔出奖励池（GDD 第 8 章 bug 修正）；幸运星研究压低空响权重
  let pool = REWARDS.filter(r=> !(r.id==='vill' && S.pop.length>=popCap()) );
  if(S.res.luck>0){ const none=pool.find(r=>r.id==='none'); if(none) none.w=[4,2,1][S.res.luck]; }
  const r = wpick(pool);
  applyReward(r);

  document.getElementById('bbase').animate(
    [{transform:'scale(1)'},{transform:'scale(1.09)'},{transform:'scale(1)'}],
    {duration:260,easing:'ease-out'});

  if(S.presses % 3 === 0) offerCurse();
  updateButtonUI();
}

function applyReward(r){
  let msg='';
  switch(r.id){
    case 'ore': { const g=S.nodeLv*40; S.mana+=g; msg=`矿石雨 · +${g} 魔力`; float(CX,CY-60,'+'+g,'#4fc3f7',22); break; }
    case 'vill': spawnVillager('miner'); msg='免费村民 · +1 矿工'; break;
    case 'oil': S.atkBuff*=1.08; msg=`武器涂油 · 全塔攻击 +8%（当前 ${Math.round(S.atkBuff*100)}%）`; break;
    case 'fort': S.hpBuff*=1.10; S.baseMax+=50; S.baseHp+=50;
      S.slots.forEach(s=>{ if(s.b){ s.b.maxhp*=1.1; s.b.hp*=1.1; } });
      msg='加固 · 建筑 HP +10%，基地 +50'; break;
    case 'reso': S.nodeLv++; msg=`矿脉共鸣 · 矿脉升至 ${S.nodeLv} 级`; break;
    case 'rift':
      if(S.phase==='build'){ S.phaseT+=20; msg='时间裂隙 · 发育期 +20 秒'; }
      else { S.freeze=3; msg='时间裂隙 · 敌人冻结 3 秒'; }
      break;
    case 'meteor':
      S.enemies.forEach(e=>{ e.hp-=60; burst(e.x,e.y,8,'#ff8a4c',130,.5); });
      if(S.boss) S.boss.hp-=60;
      msg='陨石 · 全场敌人 -60 生命'; break;
    case 'blue': S.blueprint++; msg='蓝图 · 下一座建筑免费（仍占建造格）'; break;
    case 'bribe':
      S.enemies.forEach(e=>{ e.hp*=0.85; });
      if(S.boss) S.boss.hp*=0.85;
      msg='贿赂 · 当前敌人生命 -15%'; break;
    case 'none': msg='空　响 · 什么都没有发生。代价照付。'; break;
  }
  toast(`<b style="color:#f0b429">${r.name}</b> — ${msg.replace(r.name+' · ','')}`,
        r.id==='none'?'bad':'good');
  renderShop();
}

function offerCurse(){
  const avail = CURSES.filter(c=>!S.curses.includes(c.id));
  if(!avail.length) return;
  const three = [];
  const pool=[...avail];
  while(three.length<3 && pool.length) three.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  S.paused=true;
  openModal(`
    <div class="mtitle" style="color:#c4a1ff">第 ${S.presses} 次按下 · 里程碑诅咒</div>
    <div class="msub">按钮记住了你的贪婪。BOSS 将获得下列其中一项能力 —— <b style="color:#e6edf3">由你来选</b>。</div>
    <div class="choices">${three.map(c=>`
      <button class="choice" data-c="${c.id}"><h4>${c.name}</h4><p>${c.desc}</p></button>`).join('')}</div>
  `);
  document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{
    S.curses.push(b.dataset.c);
    if(b.dataset.c==='pierce' && S.pylonLv>=5) toast('你的 1,110 魔力护盾投资刚刚变成了废铁','bad');
    closeModal(); S.paused=false; updateButtonUI();
  });
}

// ======================= 波次 =======================
function startWave(n){
  S.wave=n; S.phase='fight'; S.spawnQ=[];
  const comp = WAVES[n-1];
  const qtyMul = Math.pow(C.WAVE_QTY_MUL, S.presses);
  const hpMul  = (1 + 0.22*(n-1)) * Math.pow(C.WAVE_HP_MUL, S.presses);
  S.event = S.nextEvent; S.nextEvent=null;
  let t=0;
  const dirs=[0,1,2,3];
  for(const [type,base] of Object.entries(comp)){
    // round 而非 ceil：ceil 会让 elite:1 在按键加成后翻倍（1.27→2），分裂者 4→6 —— harness 实测抓出的 bug
    const cnt = Math.max(1, Math.round(base*qtyMul));
    for(let i=0;i<cnt;i++){
      S.spawnQ.push({ type, hpMul, at:t, dir:dirs[(i+ (type==='tank'||type==='elite'||type==='hexer'?2:0)) % 4] });
      t += (type==='tank'||type==='elite')? 3.2 : type==='hexer'? 4.2 : 0.9;
    }
  }
  if(S.event && S.event.id==='airstrike'){
    S.spawnQ.push({type:'stinger',hpMul,at:1.5,dir:1},{type:'stinger',hpMul,at:2.4,dir:3});
  }
  S.spawnQ.sort((a,b)=>a.at-b.at);
  S.phaseT = Math.max(45, t+16);
  toast(`<b style="color:#e5484d">第 ${n} 波</b> — 敌人从四面登陆`+
    (S.event?`<br><b style="color:#f0b429">事件：${S.event.name}</b> · ${S.event.desc}`:''),
    S.event&&S.event.id==='calm'?'good':'bad');
}

function spawnEnemy(type,hpMul,dir){
  const base=ENEMIES[type];
  const a = dir*Math.PI/2 + rnd(-0.42,0.42) - Math.PI/2;
  let hp = base.hp*hpMul;
  let armor = base.armor||0;
  if(S.event && S.event.id==='armor') armor+=1;   // 岩甲事件
  if(S.event && S.event.id==='rage')  hp*=0.8;    // 暴怒事件
  S.enemies.push({ type, ...base, x:CX+Math.cos(a)*SPAWN_R, y:CY+Math.sin(a)*SPAWN_R,
    hp, maxhp:hp, armor, cd:0, wob:rnd(0,6.28), slowT:0, revealed:false });
}

function spawnBoss(){
  S.phase='boss';
  const hp = C.BOSS_HP*Math.pow(C.BOSS_HP_MUL,S.presses);
  const a = rnd(0,Math.PI*2);
  S.boss = { x:CX+Math.cos(a)*SPAWN_R, y:CY+Math.sin(a)*SPAWN_R, hp, maxhp:hp,
    atk:C.BOSS_ATK*Math.pow(C.BOSS_ATK_MUL,S.presses),
    ang:a, orbit:SPAWN_R,
    spd: C.BOSS_ORBIT_SPD*(S.curses.includes('haste')?1.5:1),
    spiral: C.BOSS_SPIRAL,
    armor: S.curses.includes('iron')?8:0, cd:C.BOSS_ATK_CD, phase2:false };
  S.phaseT=999;
  const tier = S.presses>=15?'灾厄':S.presses>=9?'畸变':S.presses>=3?'膨胀':'常态';
  toast(`<b style="color:#e5484d">最终 BOSS 降临</b> — 形态：${tier} · 生命 ${fmt(hp)}`,'bad');
}

// ======================= 战斗 =======================
function damageEnemy(e,dmg,src){
  // 护盾兵光环：40px 内友军受伤 -35%（可叠加）
  let mult=1;
  if(!e.air && e.type!=='shielder')
    for(const o of S.enemies)
      if(o.type==='shielder' && o!==e && o.hp>0 && dist(o.x,o.y,e.x,e.y)<=40) mult*=(1-ENEMIES.shielder.aura);
  const real = Math.max(1, Math.round(dmg*mult) - effArmor(e));
  e.hp -= real;
  if(S.curses.includes('drain') && e===S.boss){ S.mana=Math.max(0,S.mana-5); }
  if(e.hp<=0) killEnemy(e);
}

function killEnemy(e){
  if(e===S.boss){ S.boss=null; win(); return; }
  const i=S.enemies.indexOf(e); if(i<0) return;
  S.enemies.splice(i,1); S.killed++;
  let rw = e.reward || 0;
  if(S.event && S.event.id==='gemrain') rw=Math.round(rw*1.5);   // 灵石雨事件
  S.mana += rw;
  if(rw>0) float(e.x,e.y,'+'+rw,'#4fc3f7',12);
  burst(e.x,e.y,12,e.color,120,.5);
  // 分裂者：死亡分裂为 2 只迷你分裂者（在哪杀它 = 迷你怪距离决策，GDD 7.1）
  if(e.split){
    for(let k=0;k<2;k++){
      const a=rnd(0,Math.PI*2);
      S.enemies.push({ type:'smini', ...ENEMIES.smini, x:e.x+Math.cos(a)*10, y:e.y+Math.sin(a)*10,
        hp:ENEMIES.smini.hp, maxhp:ENEMIES.smini.hp, armor:0, cd:0, wob:rnd(0,6.28), slowT:0, revealed:true });
    }
    toast('分裂者裂开了 — 2 只迷你分裂','bad');
  }
  // 精英守卫：赏金 120 魔力 + 红按钮 CD 重置
  if(e.elite){
    S.mana+=120; S.btnCd=0; updateButtonUI();
    float(e.x,e.y-14,'+120 · 按钮冷却已重置','#f0b429',14);
    toast('<b style="color:#f0b429">精英守卫被击破</b> — 赏金 120 魔力，红按钮冷却重置','good');
  }
  // 献祭者复活日志：记录最近死亡的普通单位
  if(S.enemies.some(o=>o.type==='hexer' && o.hp>0) && !e.elite && e.type!=='smini' && e.type!=='stinger'){
    S.deadLog.push(e.type); if(S.deadLog.length>3) S.deadLog.shift();
  }
  if(e.boom){
    burst(e.x,e.y,26,'#ff8a4c',200,.7);
    S.slots.forEach(s=>{ if(s.b && dist(s.x,s.y,e.x,e.y)<60){
      s.b.hp-=e.boom; float(s.x,s.y-16,'-'+e.boom,'#ff8a4c',13);
      if(s.b.hp<=0) destroyBuilding(s);
    }});
    S.pop.forEach(p=>{ if(dist(p.x,p.y,e.x,e.y)<60) p.hp-=e.boom; });
  }
}

function destroyBuilding(s){
  const t=s.b.type;
  if(t==='arrow')S.arrows--; else if(t==='cannon')S.cannons--;
  else if(t==='barracks')S.barracks--; else if(t==='pylon'){ S.pylonLv=0; S.shieldMax=0; S.shield=0; }
  else if(t==='frost')S.frost--; else if(t==='sniper')S.sniper--;
  else if(t==='totem')S.totem--; else if(t==='scout')S.scout--;
  burst(s.x,s.y,20,'#8b98a5',150,.7); s.b=null; renderShop();
  toast('建筑被摧毁','bad');
}

// 卖塔：回收 60%（GDD 7.4 —— 允许纠错，但 40% 磨损防反复横跳）
function sellBuilding(s){
  if(!s.b) return;
  const t=s.b.type;
  let cost=0;
  if(t==='arrow') cost=C.arrowCost(Math.max(0,S.arrows-1));
  else if(t==='cannon') cost=C.cannonCost(Math.max(0,S.cannons-1));
  else if(t==='barracks') cost=C.barrackCost(Math.max(0,S.barracks-1));
  else if(t==='pylon') cost=C.pylonCost[0];
  else if(t==='frost') cost=C.frostCost(Math.max(0,S.frost-1));
  else if(t==='sniper') cost=C.sniperCost(Math.max(0,S.sniper-1));
  else if(t==='totem') cost=C.totemCost(Math.max(0,S.totem-1));
  else if(t==='scout') cost=C.scoutCost(Math.max(0,S.scout-1));
  const refund=Math.round(cost*C.SELL_RATE);
  S.mana+=refund; S.sold++;
  if(t==='arrow')S.arrows--; else if(t==='cannon')S.cannons--;
  else if(t==='barracks')S.barracks--; else if(t==='pylon'){S.pylonLv=0;S.shieldMax=0;S.shield=0;}
  else if(t==='frost')S.frost--; else if(t==='sniper')S.sniper--;
  else if(t==='totem')S.totem--; else if(t==='scout')S.scout--;
  burst(s.x,s.y,14,'#f0b429',130,.5); s.b=null;
  float(s.x,s.y-18,'+'+refund,'#f0b429',13);
  renderShop();
}

function hitBase(dmg){
  if(S.shield>0 && !S.curses.includes('pierce')){
    S.shield-=dmg; if(S.shield<0){ S.baseHp+=S.shield; S.shield=0; }
  } else S.baseHp-=dmg;
  burst(CX+rnd(-20,20),CY+rnd(-20,20),4,'#e5484d',80,.4);
  if(S.baseHp<=0 && !S.over) lose();
}

// 范围爆炸：伤建筑与小人（自爆蜂 / 炸弹共用，GDD 7.1）
function explodeAt(x,y,dmg,radius=45){
  burst(x,y,26,'#ff8a4c',200,.7);
  S.slots.forEach(s=>{ if(s.b && dist(s.x,s.y,x,y)<radius){
    s.b.hp-=dmg; float(s.x,s.y-16,'-'+dmg,'#ff8a4c',13);
    if(s.b.hp<=0) destroyBuilding(s);
  }});
  S.pop.forEach(p=>{ if(dist(p.x,p.y,x,y)<radius) p.hp-=dmg; });
}

// ======================= 主循环 =======================
function update(dt){
  if(S.paused||S.over) return;
  S.t+=dt;
  if(S.mineCd>0) S.mineCd-=dt;
  if(S.btnCd>0)  S.btnCd-=dt;
  if(S.freeze>0) S.freeze-=dt;
  if(S.ocActive>0) S.ocActive-=dt;
  if(S.nodePulse>0) S.nodePulse-=dt*4;
  S.mana += income()*dt;

  // 阶段推进
  S.phaseT-=dt;
  if(S.phase==='build' && S.phaseT<=0){
    if(S.wave<5) startWave(S.wave+1); else spawnBoss();
  }
  if(S.phase==='fight' && S.spawnQ.length===0 && S.enemies.length===0){
    endWave();
  }
  if(S.phase==='fight' && S.phaseT<=0 && S.spawnQ.length===0 && S.enemies.length===0) endWave();

  // 刷怪
  if(S.spawnQ.length){
    const elapsed = (S.phase==='fight')? (Math.max(45,0), S.t) : 0;
    S.waveClock=(S.waveClock||0)+dt;
    while(S.spawnQ.length && S.spawnQ[0].at<=S.waveClock){
      const q=S.spawnQ.shift(); spawnEnemy(q.type,q.hpMul,q.dir);
    }
  }

  const frozen = S.freeze>0;

  // ---- 敌人 ----
  const hasScout = S.scout>0;   // 斥候塔：全场破隐（GDD 6.3）
  for(let i=S.enemies.length-1;i>=0;i--){
    const e=S.enemies[i];
    if(e.hp<=0){ killEnemy(e); continue; }
    if(frozen) continue;
    e.wob+=dt*3;
    if(e.slowT>0) e.slowT-=dt;
    const d=dist(e.x,e.y,CX,CY);
    // 潜行者：斥候塔 / 逼近建筑或基地 60px 时显形
    if(e.stealth && !e.revealed){
      if(hasScout) e.revealed=true;
      else if(d < BASE_R+60) e.revealed=true;
      else for(const s of S.slots) if(s.b && dist(s.x,s.y,e.x,e.y)<60){ e.revealed=true; break; }
    }
    // 速度修正：冰霜塔减速 × 顺风事件；未显形的潜行者半速潜行
    const spdMul = (e.slowT>0?0.65:1) * (S.event&&S.event.id==='tailwind'?1.15:1) * (e.revealed?1:0.55);
    // 被战士拦截？
    let blocker=null;
    if(!e.air){
      for(const p of S.pop) if(p.job==='warrior' && p.hp>0 && dist(p.x,p.y,e.x,e.y)<22){ blocker=p; break; }
    }
    if(blocker){
      e.cd-=dt;
      if(e.cd<=0){ e.cd=1.0; blocker.hp-=e.dmg;
        if(blocker.hp<=0) S.pop.splice(S.pop.indexOf(blocker),1); }
    } else if(e.ranged && d < BASE_R+e.ranged){
      e.cd-=dt; if(e.cd<=0){ e.cd=1.4; hitBase(e.dmg);
        S.shots.push({x:e.x,y:e.y,tx:CX,ty:CY,t:0,color:'#a371f7',speed:260}); }
    } else if(e.hex && d < 160){   // 献祭者：停驻施法（GDD 7.1）
      e.cd-=dt;
      if(e.cd<=0){ e.cd=4.0;
        if(S.deadLog.length && Math.random()<0.5){
          const t=S.deadLog.pop(); spawnEnemy(t, 0.4, Math.floor(Math.random()*4));
          toast('献祭者复活了一只死去的敌人','bad');
        } else {
          const alive=S.enemies.filter(o=>o!==e && o.hp>0).sort((a,b)=>b.hp-a.hp)[0];
          if(alive){ alive.hp=Math.min(alive.maxhp, alive.hp+alive.maxhp*0.15); burst(alive.x,alive.y,10,'#a371f7',120,.5); }
          toast('献祭者治愈了最强的敌人','bad');
        }
      }
    } else if(d>BASE_R+e.r){
      const ang=Math.atan2(CY-e.y,CX-e.x);
      e.x+=Math.cos(ang)*e.spd*spdMul*dt; e.y+=Math.sin(ang)*e.spd*spdMul*dt;
    } else {
      if(e.sting){ explodeAt(e.x,e.y,e.sting); hitBase(e.sting); S.enemies.splice(i,1); continue; } // 自爆蜂抵达
      if(e.boom){ killEnemy(e); hitBase(e.boom); continue; }
      e.cd-=dt; if(e.cd<=0){ e.cd=1.0; hitBase(e.dmg); }
    }
  }

  // ---- BOSS：绕岛螺旋 —— 沿途经过四面防御，迫使整片防线都参与输出（GDD 核心机制） ----
  if(S.boss){
    const b=S.boss;
    if(b.hp<=0){ S.boss=null; win(); return; }
    if(!frozen){
      b.ang += (b.spd / b.orbit) * dt;                       // 角速度 = 线速度 / 半径
      b.orbit = Math.max(BASE_R+34, b.orbit - b.spiral*dt);  // 缓慢向心螺旋
      b.x = CX + Math.cos(b.ang)*b.orbit;
      b.y = CY + Math.sin(b.ang)*b.orbit;
      b.cd -= dt;
      if(b.cd<=0){
        b.cd = C.BOSS_ATK_CD;
        let tgt=null;
        if(S.curses.includes('hate')){ const p=S.slots.find(s=>s.b&&s.b.type==='pylon'); if(p) tgt=p; }
        if(!tgt && Math.random()<0.4){   // 建筑是基地的护盾：40% 打建筑 = 基地直伤减少
          const near=S.slots.filter(s=>s.b).sort((x,y)=>dist(x.x,x.y,b.x,b.y)-dist(y.x,y.y,b.x,b.y))[0];
          if(near) tgt=near;
        }
        if(tgt){
          tgt.b.hp-=b.atk; S.shots.push({x:b.x,y:b.y,tx:tgt.x,ty:tgt.y,t:0,color:'#e5484d',speed:300});
          if(S.curses.includes('scorch')) S.slots.forEach(s=>{ if(s.b&&s!==tgt&&dist(s.x,s.y,tgt.x,tgt.y)<70) s.b.hp-=b.atk*0.5; });
          S.slots.forEach(s=>{ if(s.b&&s.b.hp<=0) destroyBuilding(s); });
        } else {
          hitBase(b.atk);   // 复用护盾/破魔逻辑
          S.shots.push({x:b.x,y:b.y,tx:CX,ty:CY,t:0,color:'#e5484d',speed:300});
        }
      }
      if(S.curses.includes('echo')){
        S.bossSummonT+=dt;
        if(S.bossSummonT>=10){ S.bossSummonT=0;
          for(let k=0;k<2;k++) spawnEnemy('grunt',1+0.22*4,Math.floor(Math.random()*4));
          toast('BOSS 召唤了增援','bad'); }
      }
      if(S.curses.includes('plague')){   // 瘟疫诅咒：建筑每秒 -1 HP（打击聚拢流）
        S.slots.forEach(s=>{ if(s.b){ s.b.hp-=dt; if(s.b.hp<=0) destroyBuilding(s); } });
      }
      if(S.curses.includes('bait')){     // 诱饵诅咒：每 20s 生成潜行者（打击无斥候塔阵容）
        S.bossBaitT+=dt;
        if(S.bossBaitT>=20){ S.bossBaitT=0; spawnEnemy('lurker',1+0.22*4,Math.floor(Math.random()*4));
          toast('BOSS 撒下诱饵 — 潜行者来袭','bad'); }
      }
    }
  }

  // ---- 塔 ----
  const allTargets = ()=> S.boss? [...S.enemies,S.boss] : S.enemies;
  if(S.res.repair>0){   // 工程修复研究：全局建筑回复
    const rp=1.5*S.res.repair*dt;
    S.slots.forEach(s=>{ if(s.b && s.b.hp<s.b.maxhp) s.b.hp=Math.min(s.b.maxhp,s.b.hp+rp); });
  }
  for(const s of S.slots){
    if(!s.b) continue;
    const b=s.b;
    if(b.type==='pylon'){
      const rep=C.pylonRepair[S.pylonLv]||0;
      S.slots.forEach(o=>{ if(o.b&&o.b.hp<o.b.maxhp) o.b.hp=Math.min(o.b.maxhp,o.b.hp+rep*dt); });
      continue;
    }
    if(b.type==='barracks'||b.type==='totem'||b.type==='scout') continue; // 功能性建筑无攻击
    const T=TOWERS[b.type]; if(!T) continue;
    b.cd-=dt;
    if(b.cd>0) continue;
    const range=T.range*totemBuff(s).r*towerRangeMul();   // 图腾射程 buff × 迷雾修正
    const list=allTargets().filter(e=> (T.air||!e.air) && dist(s.x,s.y,e.x,e.y)<=range && e.hp>0);
    if(!list.length) continue;
    if(T.snipe) list.sort((a,c)=>c.hp-a.hp);              // 狙击塔：锁定最高 HP
    else list.sort((a,c)=>dist(a.x,a.y,CX,CY)-dist(c.x,c.y,CX,CY)); // 默认：离基地最近
    const tgt=list[0];
    b.cd=towerRate(b); b.ang=Math.atan2(tgt.y-s.y,tgt.x-s.x);
    const dmg=towerDmg(b);
    const col = b.type==='arrow'?'#f0b429': b.type==='frost'?'#4fc3f7'
      : b.type==='sniper'?'#c4a1ff':'#ff8a4c';
    S.shots.push({x:s.x,y:s.y,tx:tgt.x,ty:tgt.y,t:0,color:col,
      speed: b.type==='arrow'?520 : b.type==='sniper'?900 : 340,
      r: b.type==='arrow'?2 : b.type==='sniper'?2.4 : 4});
    if(T.slow){   // 冰霜塔：范围内敌人减速（离场后持续 2s）
      allTargets().forEach(e=>{ if(!e.air && dist(e.x,e.y,s.x,s.y)<=range) e.slowT=2; });
    }
    if(T.splash){
      allTargets().forEach(e=>{ if(!e.air && dist(e.x,e.y,tgt.x,tgt.y)<=T.splash) damageEnemy(e,dmg); });
      burst(tgt.x,tgt.y,8,'#ff8a4c',110,.4);
    } else damageEnemy(tgt,dmg);
  }

  // ---- 小人 ----
  for(let i=S.pop.length-1;i>=0;i--){
    const p=S.pop[i];
    if(p.hp<=0){ S.pop.splice(i,1); burst(p.x,p.y,10,'#8b98a5',110,.5); continue; }
    p.wob+=dt*2.4;
    if(p.job==='miner'){
      const a=p.wob*0.4, r=62+Math.sin(p.wob)*8;
      p.x=CX+Math.cos(a+i)*r; p.y=CY+Math.sin(a+i)*r*0.8;
    } else {
      const tl=allTargets().filter(e=> (p.job==='archer'||!e.air) && e.hp>0);
      tl.sort((a,c)=>dist(a.x,a.y,p.x,p.y)-dist(c.x,c.y,p.x,p.y));
      const tgt=tl[0];
      const rng = (p.job==='archer'||p.job==='mage')?90:18;
      if(tgt){
        const d=dist(p.x,p.y,tgt.x,tgt.y);
        if(d>rng){ const a=Math.atan2(tgt.y-p.y,tgt.x-p.x);
          p.x+=Math.cos(a)*46*dt; p.y+=Math.sin(a)*46*dt; }
        else { p.cd-=dt; if(p.cd<=0){
          if(p.job==='archer'){ p.cd=1.0; damageEnemy(tgt,5*S.atkBuff);
            S.shots.push({x:p.x,y:p.y,tx:tgt.x,ty:tgt.y,t:0,color:'#9be89b',speed:400,r:1.6}); }
          else if(p.job==='mage'){ p.cd=1.6;  // 法师：命中溅射 30px 群伤
            const mDmg=6*S.atkBuff;
            allTargets().forEach(e=>{ if(!e.air && dist(e.x,e.y,tgt.x,tgt.y)<=30) damageEnemy(e,mDmg); });
            burst(tgt.x,tgt.y,10,'#a371f7',130,.45);
            S.shots.push({x:p.x,y:p.y,tx:tgt.x,ty:tgt.y,t:0,color:'#a371f7',speed:340,r:2.2}); }
          else { p.cd=0.8; damageEnemy(tgt,6*S.atkBuff); }
        }}
      } else {
        const a=p.wob*0.3, r=92;
        p.x+= (CX+Math.cos(a+i*1.7)*r - p.x)*dt*1.2;
        p.y+= (CY+Math.sin(a+i*1.7)*r - p.y)*dt*1.2;
      }
    }
  }

  // ---- 特效 ----
  for(let i=S.shots.length-1;i>=0;i--){ const s=S.shots[i]; s.t+=dt*s.speed/dist(s.x,s.y,s.tx,s.ty||1);
    if(s.t>=1) S.shots.splice(i,1); }
  for(let i=S.parts.length-1;i>=0;i--){ const p=S.parts[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=140*dt; p.life-=dt;
    if(p.life<=0) S.parts.splice(i,1); }
  for(let i=S.floats.length-1;i>=0;i--){ const f=S.floats[i];
    f.y-=34*dt; f.life-=dt*1.5; if(f.life<=0) S.floats.splice(i,1); }

  checkHints();
}

function endWave(){
  if(S.phase!=='fight') return;
  const rw=60*S.wave; S.mana+=rw;
  S.phase='build'; S.phaseT=60; S.waveClock=0;
  S.deadLog=[];
  if(S.wave<5) S.nextEvent = wpick(EVENTS);
  if(S.pylonLv>=5){ S.shield=S.shieldMax=C.SHIELD; }
  toast(`第 ${S.wave} 波清除 · 结算 +${rw} 魔力 · 60 秒发育期`,'good');
  if(S.wave>=5) setHint('下一个是 <b style="color:#e5484d">BOSS</b>。你按了 '+S.presses+' 次。');
}

// ======================= 引导提示（GDD 第 9 章） =======================
function setHint(html){ const h=document.getElementById('hint'); h.innerHTML=html; h.style.display='block'; }
function checkHints(){
  const el=Date.now()-S.startT;
  if(!S.hints.node && S.t>180 && S.nodeLv<4){ S.hints.node=1;
    setHint('<b style="color:#f0b429">矿脉等级决定一切收入</b> — 现在只有 '+S.nodeLv+' 级'); }
  if(!S.hints.tower && S.t>270 && slotsUsed()===0){ S.hints.tower=1;
    setHint('<b style="color:#e5484d">敌人 30 秒后从四面登陆</b> — 你还没有任何防御'); }
  if(!S.hints.air && S.wave>=2 && S.phase==='build' && S.arrows===0
      && !S.pop.some(p=>p.job==='archer')){ S.hints.air=1;
    setHint('只有<b style="color:#f0b429">箭塔</b>和<b style="color:#3fb950">弓箭手</b>能打到飞行单位'); }
  if(!S.hints.lurk && S.wave>=2 && S.phase==='build'){ S.hints.lurk=1;
    setHint('<b style="color:#4f9d8f">潜行者</b>会隐身逼近 — <b style="color:#4fc3f7">斥候塔</b>可全场照出它们'); }
}

// ======================= 胜负 =======================
function win(){
  if(S.over) return; S.over=true; S.running=false;
  const secs=Math.round(S.t);
  const score = Math.round(100 + S.presses*12 + Math.max(0,1020-secs)*0.1 + S.baseHp*0.15);
  const grade = score>=400?'S':score>=300?'A':score>=200?'B':'C';
  const gc = {S:'#f0b429',A:'#3fb950',B:'#4fc3f7',C:'#8b98a5'}[grade];
  const ach=[];
  if(S.presses===0) ach.push('洁癖 · 0 次按键通关');
  if(S.presses>=20) ach.push('赌徒 · 20 次以上按键通关');
  if(S.arrows+S.cannons===0) ach.push('空手道 · 未建任何塔');
  if((S.arrows>0)!==(S.cannons>0)) ach.push('独木难支 · 只用一种塔');
  if(S.baseHp<10) ach.push('险胜 · 基地 HP < 10');
  if(S.sold>=3) ach.push('拆迁办 · 单局卖塔 ≥ 3 次');
  if(Object.keys(C.RES).every(k=>S.res[k]>=C.RES[k].max)) ach.push('全科医生 · 研究所全满');

  openModal(`
    <div class="grade" style="color:${gc}">${grade}</div>
    <div class="mtitle" style="text-align:center">通　关</div>
    <div class="msub" style="text-align:center">你按了 ${S.presses} 次，然后活了下来。</div>
    <div class="rows">
      <span class="k">按键次数</span><span class="v">${S.presses} 次 <span style="color:#5a6673">(+${S.presses*12})</span></span>
      <span class="k">通关用时</span><span class="v">${mmss(secs)} <span style="color:#5a6673">(+${Math.round(Math.max(0,1020-secs)*0.1)})</span></span>
      <span class="k">基地剩余</span><span class="v">${Math.round(S.baseHp)} / ${Math.round(S.baseMax)} <span style="color:#5a6673">(+${Math.round(S.baseHp*0.15)})</span></span>
      <span class="k">BOSS 最终生命</span><span class="v">${fmt(C.BOSS_HP*Math.pow(C.BOSS_HP_MUL,S.presses))}</span>
      <span class="k">承受的诅咒</span><span class="v">${S.curses.length? S.curses.map(id=>CURSES.find(c=>c.id===id).name).join('、'):'无'}</span>
      <span class="k">总　分</span><span class="v" style="color:${gc};font-size:16px">${score}</span>
    </div>
    ${ach.length?`<div class="achv">${ach.map(a=>`<div class="abadge">${a}</div>`).join('')}</div>`:''}
    <div class="hookline">${S.presses>0? `你按了 ${S.presses} 次。0 次通关会怎样？` : '一次都没按。20 次通关会怎样？'}</div>
    <div class="btnrow"><button class="mbtn pri" onclick="restart()">再来一局</button></div>
  `);
}

function lose(){
  if(S.over) return; S.over=true; S.running=false;
  // 失败归因（GDD P5：输要输得明白）
  let reason;
  const armorLoss = S.curses.includes('iron') && S.arrows>S.cannons;
  if(S.phase==='boss'){
    if(armorLoss) reason=`你按了 <b>${S.presses}</b> 次，抽到了「铁壳」。你的箭塔每发 ${Math.round(TOWERS.arrow.dmg*(1+0.25*S.arrowUp)*S.atkBuff)} 点伤害被护甲吃掉了 8 点 —— 高频低伤阵容打不穿护甲。`;
    else if(S.curses.includes('echo')) reason=`你按了 <b>${S.presses}</b> 次，抽到了「回响」。BOSS 不断召唤增援，你的火力被分散了。`;
    else if(S.curses.includes('pierce')&&S.pylonLv>=5) reason=`你按了 <b>${S.presses}</b> 次，抽到了「破魔」。你投进护盾塔的 1,110 魔力一点用都没有。`;
    else if(S.curses.includes('plague')) reason=`你按了 <b>${S.presses}</b> 次，抽到了「瘟疫」。你的建筑在 BOSS 战里被慢慢腐蚀，火力网崩塌了。`;
    else if(S.curses.includes('fog')) reason=`你按了 <b>${S.presses}</b> 次，抽到了「迷雾」。全塔射程 -20%，BOSS 贴脸时你的塔打不到它。`;
    else reason=`你按了 <b>${S.presses}</b> 次，BOSS 生命被推到 <b>${fmt(C.BOSS_HP*Math.pow(C.BOSS_HP_MUL,S.presses))}</b>，超出了你的火力上限。`;
  } else if(S.arrows===0 && !S.pop.some(p=>p.job==='archer') && S.wave>=2){
    reason=`第 ${S.wave} 波倒下 —— 你没有任何对空单位，飞行怪一路飞到了基地。`;
  } else if(slotsUsed()<4){
    reason=`第 ${S.wave} 波倒下 —— 你只建了 ${slotsUsed()} 座建筑，四个方向覆盖不过来。`;
  } else if(S.nodeLv<6){
    reason=`第 ${S.wave} 波倒下 —— 矿脉只有 ${S.nodeLv} 级，收入跟不上敌人成长曲线。`;
  } else {
    reason=`第 ${S.wave} 波倒下 —— 火力集中在少数方向，其余方向被突破。`;
  }
  openModal(`
    <div class="mtitle" style="color:#e5484d">基地陷落</div>
    <div class="msub">存活至 ${S.phase==='boss'?'BOSS 战':'第 '+S.wave+' 波'} · 用时 ${mmss(S.t)}</div>
    <div class="reason">${reason}</div>
    <div class="rows">
      <span class="k">按键次数</span><span class="v">${S.presses}</span>
      <span class="k">矿脉 / 速度</span><span class="v">Lv ${S.nodeLv} / Lv ${S.spdLv}</span>
      <span class="k">建筑 / 人口</span><span class="v">${slotsUsed()} / ${S.pop.length}</span>
      <span class="k">诅咒</span><span class="v">${S.curses.length? S.curses.map(id=>CURSES.find(c=>c.id===id).name).join('、'):'无'}</span>
    </div>
    <div class="btnrow"><button class="mbtn pri" onclick="restart()">再来一局</button></div>
  `);
}

// ======================= 程序化绘制（无任何外部图片） =======================
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let DPR=1, VW=W, VH=H, OX=0, OY=0, SC=1;

function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  const r=cv.parentElement.getBoundingClientRect();
  cv.width=r.width*DPR; cv.height=r.height*DPR;
  cv.style.width=r.width+'px'; cv.style.height=r.height+'px';
  SC=Math.min(r.width/W, r.height/H);
  OX=(r.width-W*SC)/2; OY=(r.height-H*SC)/2;
}
window.addEventListener('resize',resize);

// 岛屿轮廓：用固定种子的正弦扰动生成有机形状（可复现）
const ISLE=[];
for(let i=0;i<72;i++){
  const a=i/72*Math.PI*2;
  const r=232 + Math.sin(a*3+0.7)*14 + Math.sin(a*5+2.1)*9 + Math.sin(a*7+4.3)*5;
  ISLE.push({a,r});
}
function islePath(scale=1){
  ctx.beginPath();
  ISLE.forEach((p,i)=>{ const x=CX+Math.cos(p.a)*p.r*scale, y=CY+Math.sin(p.a)*p.r*scale*0.9;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.closePath();
}

function draw(){
  const r=cv.parentElement.getBoundingClientRect();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,r.width,r.height);
  ctx.save(); ctx.translate(OX,OY); ctx.scale(SC,SC);

  drawOcean(); drawIsland(); drawSlots();
  drawNode(); drawVillagers(); drawBuildings();
  drawEnemies(); drawBoss(); drawShots(); drawParticles(); drawFloats();
  if(S.build) drawGhost();
  if(S.freeze>0) drawFreeze();

  ctx.restore();
}

function drawOcean(){
  const g=ctx.createRadialGradient(CX,CY,120,CX,CY,520);
  g.addColorStop(0,'#0f2534'); g.addColorStop(.55,'#0a1a26'); g.addColorStop(1,'#050b11');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // 同心波纹
  ctx.lineWidth=1;
  for(let k=0;k<7;k++){
    const rr=250+k*34+Math.sin(S.t*0.7+k*0.9)*6;
    ctx.strokeStyle=`rgba(79,195,247,${0.055-k*0.006})`;
    ctx.beginPath(); ctx.ellipse(CX,CY,rr,rr*0.9,0,0,6.284); ctx.stroke();
  }
  // 浪花点
  for(let k=0;k<40;k++){
    const a=(k/40)*6.284+S.t*0.05, rr=270+Math.sin(k*2.3+S.t)*26;
    ctx.fillStyle='rgba(140,200,235,.10)';
    ctx.fillRect(CX+Math.cos(a)*rr, CY+Math.sin(a)*rr*0.9, 2.5,1.2);
  }
}

function drawIsland(){
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=26; ctx.shadowOffsetY=6;
  islePath(1.03); ctx.fillStyle='#c9b98a'; ctx.fill();           // 沙滩
  ctx.restore();
  islePath(0.955);
  const g=ctx.createRadialGradient(CX-50,CY-60,40,CX,CY,240);
  g.addColorStop(0,'#5e9e52'); g.addColorStop(.6,'#4a8442'); g.addColorStop(1,'#356331');
  ctx.fillStyle=g; ctx.fill();
  // 草地纹理
  ctx.save(); islePath(0.955); ctx.clip();
  for(let i=0;i<190;i++){
    const a=(i*2.399), rr=Math.sqrt((i%97)/97)*220;
    const x=CX+Math.cos(a)*rr, y=CY+Math.sin(a)*rr*0.9;
    ctx.fillStyle= i%3? 'rgba(120,175,105,.16)':'rgba(45,85,45,.14)';
    ctx.fillRect(x,y,3,1.6);
  }
  // 从矿脉向外的能量脉络
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4;
    ctx.strokeStyle='rgba(79,195,247,.10)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(CX,CY);
    ctx.quadraticCurveTo(CX+Math.cos(a+.3)*120, CY+Math.sin(a+.3)*120,
                         CX+Math.cos(a)*215, CY+Math.sin(a)*200);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSlots(){
  for(const s of S.slots){
    if(s.b) continue;
    const hov = S.build && S.hoverSlot===s;
    ctx.save(); ctx.translate(s.x,s.y);
    ctx.strokeStyle= hov? 'rgba(240,180,41,.95)' : (S.build? 'rgba(240,180,41,.42)':'rgba(255,255,255,.16)');
    ctx.lineWidth= hov?2:1.4; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(0,0,17,0,6.284); ctx.stroke();
    ctx.setLineDash([]);
    if(hov){ ctx.fillStyle='rgba(240,180,41,.16)'; ctx.fill(); }
    ctx.restore();
  }
}

function drawNode(){
  const pulse = 1 + Math.max(0,S.nodePulse)*0.16 + Math.sin(S.t*2)*0.02;
  const ready = S.mineCd<=0;
  ctx.save(); ctx.translate(CX,CY); ctx.scale(pulse,pulse);
  // 光晕
  const g=ctx.createRadialGradient(0,0,8,0,0,74);
  g.addColorStop(0,`rgba(79,195,247,${ready?.42:.18})`); g.addColorStop(1,'rgba(79,195,247,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,74,0,6.284); ctx.fill();
  // 基座
  ctx.fillStyle='#2b3a44'; ctx.beginPath(); ctx.ellipse(0,16,42,15,0,0,6.284); ctx.fill();
  // 水晶簇（程序化多边形）
  const crystals=[[0,-38,15,1],[-20,-24,11,.86],[19,-26,12,.9],[-11,-12,9,.74],[12,-10,9,.78]];
  crystals.forEach(([ox,oy,h,sc],i)=>{
    const sway=Math.sin(S.t*1.4+i)*1.2;
    ctx.beginPath();
    ctx.moveTo(ox+sway, oy-h*1.5);
    ctx.lineTo(ox+7*sc, oy-h*0.15);
    ctx.lineTo(ox+4.5*sc, oy+h*0.85);
    ctx.lineTo(ox-4.5*sc, oy+h*0.85);
    ctx.lineTo(ox-7*sc, oy-h*0.15);
    ctx.closePath();
    const cg=ctx.createLinearGradient(ox-8,oy-h*1.5,ox+8,oy+h);
    cg.addColorStop(0, ready?'#8fe4ff':'#5c8fa3'); cg.addColorStop(.5, ready?'#39b6e8':'#2f6b80');
    cg.addColorStop(1, ready?'#1a6f96':'#1c4757');
    ctx.fillStyle=cg; ctx.fill();
    ctx.strokeStyle=ready?'rgba(190,240,255,.65)':'rgba(120,160,180,.4)'; ctx.lineWidth=1; ctx.stroke();
  });
  ctx.restore();
  // 冷却环
  if(S.mineCd>0){
    const p=1-S.mineCd/C.cdAt(S.spdLv);
    ctx.strokeStyle='rgba(79,195,247,.85)'; ctx.lineWidth=3.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(CX,CY,52,-Math.PI/2,-Math.PI/2+p*6.284); ctx.stroke();
  } else {
    ctx.strokeStyle=`rgba(79,195,247,${.35+Math.sin(S.t*3)*.2})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(CX,CY,52,0,6.284); ctx.stroke();
  }
  // 护盾
  if(S.shield>0){
    ctx.strokeStyle=`rgba(79,195,247,${.28+Math.sin(S.t*4)*.12})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(CX,CY,BASE_R+26,0,6.284); ctx.stroke();
    ctx.fillStyle='rgba(79,195,247,.05)'; ctx.fill();
  }
}

function drawBuildings(){
  for(const s of S.slots){
    if(!s.b) continue;
    const b=s.b; ctx.save(); ctx.translate(s.x,s.y);
    ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0,11,16,6,0,0,6.284); ctx.fill();
    if(b.type==='arrow'){
      // 射程圈
      if(S.hoverSlot===s){ ctx.strokeStyle='rgba(240,180,41,.25)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,TOWERS.arrow.range,0,6.284); ctx.stroke(); }
      ctx.fillStyle='#6b5b45'; ctx.beginPath();
      ctx.moveTo(-10,10); ctx.lineTo(-6,-14); ctx.lineTo(6,-14); ctx.lineTo(10,10); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#8a7658'; ctx.fillRect(-9,-19,18,6);
      ctx.save(); ctx.rotate(b.ang);
      ctx.fillStyle='#f0b429'; ctx.fillRect(0,-1.8,16,3.6);
      ctx.beginPath(); ctx.arc(0,0,5,0,6.284); ctx.fillStyle='#c99420'; ctx.fill();
      ctx.restore();
      for(let k=0;k<S.arrowUp;k++){ ctx.fillStyle='#f0b429';
        ctx.fillRect(-9+k*3.2,13,2.2,2.2); }
    } else if(b.type==='cannon'){
      if(S.hoverSlot===s){ ctx.strokeStyle='rgba(255,138,76,.25)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,TOWERS.cannon.range,0,6.284); ctx.stroke(); }
      ctx.fillStyle='#4a4a52'; ctx.beginPath(); ctx.ellipse(0,2,15,11,0,0,6.284); ctx.fill();
      ctx.fillStyle='#5e5e68'; ctx.beginPath(); ctx.ellipse(0,-2,12,9,0,0,6.284); ctx.fill();
      ctx.save(); ctx.rotate(b.ang);
      ctx.fillStyle='#3a3a42'; ctx.fillRect(0,-4,19,8);
      ctx.fillStyle='#ff8a4c'; ctx.fillRect(16,-3,4,6);
      ctx.restore();
      for(let k=0;k<S.cannonUp;k++){ ctx.fillStyle='#ff8a4c'; ctx.fillRect(-9+k*3.2,13,2.2,2.2); }
    } else if(b.type==='barracks'){
      ctx.fillStyle='#7a5c3a'; ctx.fillRect(-14,-6,28,17);
      ctx.fillStyle='#9c7448'; ctx.beginPath();
      ctx.moveTo(-17,-6); ctx.lineTo(0,-18); ctx.lineTo(17,-6); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#3a2a1a'; ctx.fillRect(-4,1,8,10);
      ctx.fillStyle='#3fb950'; ctx.fillRect(-14,-6,28,2);
    } else if(b.type==='pylon'){
      const lit=S.pylonLv>=5;
      ctx.save(); ctx.rotate(S.t*0.5);
      ctx.beginPath();
      for(let k=0;k<6;k++){ const a=k/6*6.284; const x=Math.cos(a)*13,y=Math.sin(a)*13;
        k?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.closePath();
      ctx.fillStyle= lit? 'rgba(79,195,247,.85)':'rgba(90,120,140,.75)'; ctx.fill();
      ctx.strokeStyle= lit?'#8fe4ff':'#5a7888'; ctx.lineWidth=1.6; ctx.stroke();
      ctx.restore();
      ctx.fillStyle= lit?'#8fe4ff':'#6b8898';
      ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('L'+S.pylonLv,0,-20);
    } else if(b.type==='frost'){
      // 冰霜塔：冰晶 + 呼吸光环
      if(S.hoverSlot===s){ ctx.strokeStyle='rgba(79,195,247,.25)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,TOWERS.frost.range,0,6.284); ctx.stroke(); }
      ctx.save(); ctx.rotate(S.t*0.7);
      ctx.beginPath();
      for(let k=0;k<6;k++){ const a=k/6*6.284; const x=Math.cos(a)*11,y=Math.sin(a)*11;
        k?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.closePath();
      ctx.fillStyle='rgba(79,195,247,.8)'; ctx.fill();
      ctx.strokeStyle='#8fe4ff'; ctx.lineWidth=1.4; ctx.stroke();
      ctx.restore();
      ctx.fillStyle='rgba(200,240,255,.35)'; ctx.beginPath(); ctx.arc(0,0,6+(S.t*2%5),0,6.284); ctx.fill();
      for(let k=0;k<S.frostUp;k++){ ctx.fillStyle='#4fc3f7'; ctx.fillRect(-9+k*3.2,13,2.2,2.2); }
    } else if(b.type==='sniper'){
      // 狙击塔：长炮管 + 镜片
      if(S.hoverSlot===s){ ctx.strokeStyle='rgba(196,161,255,.25)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,TOWERS.sniper.range,0,6.284); ctx.stroke(); }
      ctx.fillStyle='#3d3550'; ctx.beginPath(); ctx.ellipse(0,3,11,9,0,0,6.284); ctx.fill();
      ctx.save(); ctx.rotate(b.ang);
      ctx.fillStyle='#2a2440'; ctx.fillRect(0,-2.2,24,4.4);
      ctx.fillStyle='#c4a1ff'; ctx.fillRect(22,-2.6,6,5.2);
      ctx.beginPath(); ctx.arc(0,0,4,0,6.284); ctx.fillStyle='#5a4a80'; ctx.fill();
      ctx.restore();
      for(let k=0;k<S.sniperUp;k++){ ctx.fillStyle='#c4a1ff'; ctx.fillRect(-9+k*3.2,13,2.2,2.2); }
    } else if(b.type==='totem'){
      // 图腾：三色图腾柱，光环显示 buff 范围
      ctx.strokeStyle='rgba(240,180,41,.18)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(0,0,TOWERS.totem.range,0,6.284); ctx.stroke();
      ctx.fillStyle='#8a6a3a'; ctx.fillRect(-4,-16,8,28);
      ctx.fillStyle='#c9a25a'; ctx.beginPath(); ctx.arc(0,-17,6,0,6.284); ctx.fill();
      ctx.fillStyle='#e5484d'; ctx.fillRect(-4,-10,8,3);
      ctx.fillStyle='#4fc3f7'; ctx.fillRect(-4,-4,8,3);
      ctx.fillStyle='#3fb950'; ctx.fillRect(-4,2,8,3);
      ctx.fillStyle='rgba(240,180,41,.25)'; ctx.beginPath(); ctx.arc(0,0,4+S.t*3%6,0,6.284); ctx.fill();
    } else if(b.type==='scout'){
      // 斥候塔：雷达碟 + 旋转扫描线
      ctx.strokeStyle='rgba(79,195,247,.15)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(0,0,TOWERS.scout.range,0,6.284); ctx.stroke();
      ctx.fillStyle='#4a4a52'; ctx.fillRect(-2,-8,4,20);
      ctx.fillStyle='#5c6b7a'; ctx.beginPath(); ctx.ellipse(0,-12,14,4.4,0,0,6.284); ctx.fill();
      ctx.fillStyle='#7c8b9a'; ctx.beginPath(); ctx.ellipse(0,-13,10,3,0,0,6.284); ctx.fill();
      ctx.strokeStyle='#8fe4ff'; ctx.lineWidth=1;
      const sa=S.t*2;
      ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(Math.cos(sa)*11,-13+Math.sin(sa)*3.4); ctx.stroke();
    }
    // 血条
    if(b.hp<b.maxhp){
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(-13,-26,26,3);
      ctx.fillStyle= b.hp/b.maxhp>.4?'#3fb950':'#e5484d';
      ctx.fillRect(-13,-26,26*(b.hp/b.maxhp),3);
    }
    ctx.restore();
  }
}

function drawVillagers(){
  for(const p of S.pop){
    const col = p.job==='miner'?'#c9a227': p.job==='warrior'?'#d96a4a'
      : p.job==='archer'?'#5cc98a':'#a371f7';
    const bob=Math.sin(p.wob*2)*1.6;
    ctx.save(); ctx.translate(p.x,p.y+bob);
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0,7,6,2.4,0,0,6.284); ctx.fill();
    ctx.fillStyle=col; ctx.beginPath();
    ctx.roundRect? ctx.roundRect(-4,-5,8,11,3) : ctx.rect(-4,-5,8,11);
    ctx.fill();
    ctx.fillStyle='#f2ddc0'; ctx.beginPath(); ctx.arc(0,-8,3.6,0,6.284); ctx.fill();
    if(p.job==='miner'){ ctx.strokeStyle='#8b98a5'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(4,-4); ctx.lineTo(8,-9); ctx.stroke(); }
    if(p.job==='warrior'){ ctx.fillStyle='#c9ccd1'; ctx.fillRect(4,-8,2,10); }
    if(p.job==='archer'){ ctx.strokeStyle='#9be89b'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(5,-2,5,-1.1,1.1); ctx.stroke(); }
    if(p.hp<p.maxhp){ ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(-6,-15,12,2);
      ctx.fillStyle='#3fb950'; ctx.fillRect(-6,-15,12*(p.hp/p.maxhp),2); }
    ctx.restore();
  }
}

function drawEnemies(){
  for(const e of S.enemies){
    ctx.save(); ctx.translate(e.x,e.y);
    // 潜行者未显形：仅一圈若隐若现的水纹（GDD 7.1）
    if(e.stealth && !e.revealed){
      ctx.globalAlpha=.16;
      ctx.strokeStyle='#4f9d8f'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(0,0,8+Math.sin(S.t*4+e.wob)*2,0,6.284); ctx.stroke();
      ctx.fillStyle='#4f9d8f'; ctx.beginPath(); ctx.arc(0,0,3.2,0,6.284); ctx.fill();
      ctx.globalAlpha=1;
      ctx.restore(); continue;
    }
    if(e.air && e.type!=='stinger'){
      const f=Math.sin(S.t*16+e.wob)*4;
      ctx.fillStyle='rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0,16,7,2.6,0,0,6.284); ctx.fill();
      ctx.fillStyle='rgba(127,95,214,.5)';
      ctx.beginPath(); ctx.ellipse(-9,-2,8,3.5,-0.4+f*0.05,0,6.284); ctx.fill();
      ctx.beginPath(); ctx.ellipse(9,-2,8,3.5,0.4-f*0.05,0,6.284); ctx.fill();
      ctx.fillStyle=e.color; ctx.beginPath(); ctx.ellipse(0,0,e.r,e.r*0.8,0,0,6.284); ctx.fill();
      ctx.fillStyle='#ffd6e0'; ctx.beginPath(); ctx.arc(0,-1,2.2,0,6.284); ctx.fill();
    } else if(e.type==='stinger'){
      // 自爆蜂：高速振翅 + 尾刺引信，压迫感靠动效
      const f=Math.sin(S.t*22+e.wob)*3;
      ctx.fillStyle='rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0,14,6,2,0,0,6.284); ctx.fill();
      ctx.fillStyle='rgba(217,106,58,.35)';
      ctx.beginPath(); ctx.ellipse(-7+f,0,6,2.6,-0.3,0,6.284); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7-f,0,6,2.6,0.3,0,6.284); ctx.fill();
      ctx.fillStyle='#d96a3a'; ctx.beginPath(); ctx.arc(0,0,e.r,0,6.284); ctx.fill();
      ctx.strokeStyle='#ffd27a'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(0,-e.r-4); ctx.stroke();
      ctx.fillStyle='rgba(255,210,122,.85)'; ctx.beginPath(); ctx.arc(0,-e.r-5,2,0,6.284); ctx.fill();
    } else if(e.type==='tank'){
      ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0,12,15,5,0,0,6.284); ctx.fill();
      ctx.fillStyle=e.color; ctx.beginPath();
      ctx.roundRect? ctx.roundRect(-13,-12,26,24,5) : ctx.rect(-13,-12,26,24); ctx.fill();
      ctx.fillStyle='#7c8b9a'; ctx.fillRect(-13,-12,26,5);
      ctx.strokeStyle='#98a7b5'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,0,10,0,6.284); ctx.stroke();
      ctx.fillStyle='#e5484d'; ctx.beginPath(); ctx.arc(0,-2,3,0,6.284); ctx.fill();
    } else if(e.type==='bomber'){
      const t=Math.sin(S.t*9+e.wob)*.5+.5;
      ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,10,8,3,0,0,6.284); ctx.fill();
      ctx.fillStyle=`rgb(${212+t*40},${160-t*60},${23})`;
      ctx.beginPath(); ctx.arc(0,0,e.r,0,6.284); ctx.fill();
      ctx.strokeStyle='#5a4a10'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(0,-e.r); ctx.lineTo(2,-e.r-5); ctx.stroke();
      ctx.fillStyle=`rgba(255,${120+t*100},60,${.5+t*.5})`;
      ctx.beginPath(); ctx.arc(2,-e.r-6,2.4+t,0,6.284); ctx.fill();
    } else if(e.type==='splitter'||e.type==='smini'){
      // 分裂者/迷你分裂：裂纹 = 它还能再裂一次
      ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,9,7,2.6,0,0,6.284); ctx.fill();
      ctx.fillStyle=e.color; ctx.beginPath();
      ctx.roundRect? ctx.roundRect(-7,-7,14,15,3) : ctx.rect(-7,-7,14,15); ctx.fill();
      ctx.strokeStyle='#5a4a10'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-2,-6); ctx.lineTo(2,7); ctx.stroke();
      ctx.fillStyle='#ffdb4d'; ctx.fillRect(-3,-4,1.6,1.6); ctx.fillRect(1.4,-4,1.6,1.6);
    } else if(e.type==='shielder'){
      // 护盾兵：可见的光环（玩家能直接读懂"它在保谁"）
      ctx.fillStyle='rgba(111,127,196,.14)'; ctx.beginPath(); ctx.arc(0,0,16,0,6.284); ctx.fill();
      ctx.strokeStyle='rgba(111,127,196,.4)'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(0,0,16,0,6.284); ctx.stroke();
      ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,9,7,2.6,0,0,6.284); ctx.fill();
      ctx.fillStyle=e.color; ctx.beginPath();
      ctx.roundRect? ctx.roundRect(-7,-7,14,15,3) : ctx.rect(-7,-7,14,15); ctx.fill();
      ctx.fillStyle='#9aa8e8'; ctx.fillRect(-7,-7,14,3);
      ctx.fillStyle='#ffdb4d'; ctx.fillRect(-3,-4,1.6,1.6); ctx.fillRect(1.4,-4,1.6,1.6);
    } else if(e.type==='hexer'){
      // 献祭者：兜帽 + 法杖，施法时法杖发光
      const cast=Math.sin(S.t*3+e.wob)*.5+.5;
      ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,9,7,2.6,0,0,6.284); ctx.fill();
      ctx.fillStyle='#3a2a4a'; ctx.beginPath();
      ctx.roundRect? ctx.roundRect(-7,-6,14,14,3) : ctx.rect(-7,-6,14,14); ctx.fill();
      ctx.fillStyle='#6a4a8a'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(8,-2); ctx.lineTo(-8,-2); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffdb4d'; ctx.fillRect(-2.5,-4,1.6,1.6); ctx.fillRect(1,-4,1.6,1.6);
      ctx.strokeStyle='#c4a1ff'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(10,7); ctx.stroke();
      ctx.fillStyle=`rgba(196,161,255,${.25+cast*.35})`;
      ctx.beginPath(); ctx.arc(11,8,2.4+cast*2,0,6.284); ctx.fill();
    } else if(e.type==='elite'){
      // 精英守卫：体型压制 + 王冠角
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0,14,18,6,0,0,6.284); ctx.fill();
      ctx.fillStyle='#8a3040'; ctx.beginPath();
      ctx.roundRect? ctx.roundRect(-15,-14,30,28,6) : ctx.rect(-15,-14,30,28); ctx.fill();
      ctx.fillStyle='#c04a5a'; ctx.fillRect(-15,-14,30,7);
      ctx.fillStyle='#e8d8a0'; ctx.beginPath(); ctx.moveTo(-10,-14); ctx.lineTo(-6,-21); ctx.lineTo(-2,-14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2,-14); ctx.lineTo(6,-21); ctx.lineTo(10,-14); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffdb4d'; ctx.fillRect(-7,-6,3,3); ctx.fillRect(4,-6,3,3);
      ctx.strokeStyle='#ffd6e0'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(0,2,8,0,6.284); ctx.stroke();
    } else {
      const step=Math.sin(S.t*9+e.wob)*2;
      ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,10,8,3,0,0,6.284); ctx.fill();
      ctx.fillStyle=e.color; ctx.beginPath();
      ctx.roundRect? ctx.roundRect(-7,-8+step*.3,14,17,4) : ctx.rect(-7,-8,14,17); ctx.fill();
      ctx.fillStyle='#8f3a26'; ctx.beginPath(); ctx.arc(0,-10,4.5,0,6.284); ctx.fill();
      ctx.fillStyle='#ffdb4d'; ctx.fillRect(-2.5,-11,1.8,1.8); ctx.fillRect(1,-11,1.8,1.8);
    }
    if(e.hp<e.maxhp){
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(-e.r,-e.r-9,e.r*2,3);
      ctx.fillStyle='#e5484d'; ctx.fillRect(-e.r,-e.r-9,e.r*2*(e.hp/e.maxhp),3);
    }
    ctx.restore();
  }
}

function drawBoss(){
  if(!S.boss) return;
  const b=S.boss;
  const tier = S.presses>=15?3 : S.presses>=9?2 : S.presses>=3?1 : 0;
  const sc = 1 + tier*0.17;
  ctx.save(); ctx.translate(b.x,b.y); ctx.scale(sc,sc);
  const glow=['rgba(140,40,45,','rgba(180,45,50,','rgba(190,60,190,','rgba(255,80,80,'][tier];
  const g=ctx.createRadialGradient(0,0,10,0,0,70);
  g.addColorStop(0,glow+(.34+Math.sin(S.t*3)*.1)+')'); g.addColorStop(1,glow+'0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,70,0,6.284); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0,28,30,9,0,0,6.284); ctx.fill();
  // 额外肢体（畸变以上）
  if(tier>=2){
    for(let k=0;k<4;k++){
      const a=k*1.57+Math.sin(S.t*1.5+k)*0.3;
      ctx.strokeStyle='rgba(163,113,247,.75)'; ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.cos(a)*26,Math.sin(a)*26,Math.cos(a)*42,Math.sin(a)*42+8);
      ctx.stroke();
    }
  }
  // 躯体
  ctx.fillStyle=['#7a2429','#932a30','#8b2f7a','#c0303a'][tier];
  ctx.beginPath();
  ctx.moveTo(0,-30);
  ctx.lineTo(22,-12); ctx.lineTo(26,14); ctx.lineTo(0,28); ctx.lineTo(-26,14); ctx.lineTo(-22,-12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=['#a8393f','#c4454c','#c060c0','#ff6b70'][tier]; ctx.lineWidth=2; ctx.stroke();
  // 裂纹（膨胀以上）
  if(tier>=1){
    ctx.strokeStyle=`rgba(255,${tier>=2?120:60},${tier>=2?255:60},${.5+Math.sin(S.t*4)*.25})`;
    ctx.lineWidth=1.6;
    for(let k=0;k<5;k++){ const a=k*1.257+0.4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*6,Math.sin(a)*6);
      ctx.lineTo(Math.cos(a)*20,Math.sin(a)*20); ctx.stroke(); }
  }
  // 眼
  ctx.fillStyle='#ffe14d'; ctx.beginPath(); ctx.arc(-8,-8,4,0,6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(8,-8,4,0,6.284); ctx.fill();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(-8,-8,1.8,0,6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(8,-8,1.8,0,6.284); ctx.fill();
  if(b.armor>0){ ctx.strokeStyle='rgba(190,200,215,.6)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(0,0,36,0,6.284); ctx.stroke(); }
  ctx.restore();
  // 血条
  const bw=170;
  ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(b.x-bw/2-2,b.y-52*sc-2,bw+4,10);
  ctx.fillStyle='#e5484d'; ctx.fillRect(b.x-bw/2,b.y-52*sc,bw*Math.max(0,b.hp/b.maxhp),6);
  ctx.fillStyle='#fff'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
  ctx.fillText(fmt(Math.max(0,b.hp))+' / '+fmt(b.maxhp), b.x, b.y-58*sc);
  if(tier>=3){ ctx.fillStyle=`rgba(229,72,77,${.05+Math.sin(S.t*2)*.03})`; ctx.fillRect(0,0,W,H); }
}

function drawShots(){
  for(const s of S.shots){
    const x=s.x+(s.tx-s.x)*Math.min(1,s.t), y=s.y+(s.ty-s.y)*Math.min(1,s.t);
    ctx.strokeStyle=s.color; ctx.lineWidth=s.r||2; ctx.lineCap='round';
    const px=s.x+(s.tx-s.x)*Math.max(0,s.t-0.09), py=s.y+(s.ty-s.y)*Math.max(0,s.t-0.09);
    ctx.globalAlpha=.9; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke();
    ctx.globalAlpha=1;
  }
}
function drawParticles(){
  for(const p of S.parts){
    ctx.globalAlpha=Math.max(0,p.life/p.max); ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.284); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawFloats(){
  ctx.textAlign='center';
  for(const f of S.floats){
    ctx.globalAlpha=Math.max(0,Math.min(1,f.life));
    ctx.font=`bold ${f.size}px "Segoe UI",sans-serif`;
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.strokeText(f.txt,f.x,f.y);
    ctx.fillStyle=f.color; ctx.fillText(f.txt,f.x,f.y);
  }
  ctx.globalAlpha=1;
}
function drawGhost(){
  if(!S.hoverSlot||S.hoverSlot.b) return;
  const s=S.hoverSlot, T=TOWERS[S.build];
  if(T){ ctx.fillStyle='rgba(240,180,41,.09)'; ctx.strokeStyle='rgba(240,180,41,.45)';
    ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(s.x,s.y,T.range,0,6.284); ctx.fill(); ctx.stroke(); }
}
function drawFreeze(){
  ctx.fillStyle=`rgba(120,200,255,${0.09+Math.sin(S.t*10)*0.03})`; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(160,220,255,.5)'; ctx.lineWidth=3; ctx.strokeRect(3,3,W-6,H-6);
}

// ======================= 商店 UI =======================
const ICONS = {
  node:  '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 L15 8 L12.5 17 L7.5 17 L5 8 Z" fill="#4fc3f7" stroke="#8fe4ff" stroke-width="1"/></svg>',
  spd:   '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M11 2 L4 11 H9 L8 18 L16 8 H10.5 Z" fill="#f0b429"/></svg>',
  miner: '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="5.5" r="3.2" fill="#f2ddc0"/><rect x="6.5" y="9" width="7" height="9" rx="3" fill="#c9a227"/></svg>',
  warrior:'<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="5.5" r="3.2" fill="#f2ddc0"/><rect x="6.5" y="9" width="7" height="9" rx="3" fill="#d96a4a"/><rect x="14" y="6" width="2" height="10" fill="#c9ccd1"/></svg>',
  archer:'<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="5.5" r="3.2" fill="#f2ddc0"/><rect x="6.5" y="9" width="7" height="9" rx="3" fill="#5cc98a"/><path d="M15 8 A5 5 0 0 1 15 16" stroke="#9be89b" stroke-width="1.6" fill="none"/></svg>',
  mage:  '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="5.5" r="3.2" fill="#f2ddc0"/><rect x="6.5" y="9" width="7" height="9" rx="3" fill="#a371f7"/><path d="M14 5 L17 2" stroke="#c4a1ff" stroke-width="1.6" stroke-linecap="round"/><circle cx="17.5" cy="1.5" r="1.4" fill="#c4a1ff"/></svg>',
  arrow: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M6 18 L7.5 4 H12.5 L14 18 Z" fill="#6b5b45"/><rect x="5.5" y="2" width="9" height="3" fill="#8a7658"/><rect x="9" y="8" width="9" height="2.4" fill="#f0b429"/></svg>',
  cannon:'<svg width="20" height="20" viewBox="0 0 20 20"><ellipse cx="9" cy="13" rx="7" ry="5" fill="#4a4a52"/><rect x="8" y="4" width="4" height="9" fill="#3a3a42" transform="rotate(20 10 9)"/><circle cx="13" cy="4" r="2.2" fill="#ff8a4c"/></svg>',
  frost: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 1 L16 7 L12 15 L8 15 L4 7 Z" fill="#4fc3f7" stroke="#8fe4ff" stroke-width="1"/></svg>',
  sniper:'<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="8" width="14" height="3.4" rx="1" fill="#3d3550"/><rect x="15" y="7" width="4" height="5.4" fill="#c4a1ff"/><circle cx="6" cy="9.7" r="2.4" fill="#8fe4ff"/></svg>',
  totem: '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="8" y="3" width="4" height="14" fill="#8a6a3a"/><circle cx="10" cy="3.4" r="3" fill="#c9a25a"/><rect x="8" y="7" width="4" height="2.4" fill="#e5484d"/><rect x="8" y="11" width="4" height="2.4" fill="#4fc3f7"/></svg>',
  scout: '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="8.5" y="12" width="3" height="6" fill="#4a4a52"/><ellipse cx="10" cy="9" rx="7" ry="2.6" fill="#5c6b7a"/><path d="M10 7 L14 3" stroke="#8fe4ff" stroke-width="1.4"/></svg>',
  barracks:'<svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 9 L10 2 L18 9 Z" fill="#9c7448"/><rect x="4" y="9" width="12" height="9" fill="#7a5c3a"/><rect x="8" y="12" width="4" height="6" fill="#3a2a1a"/></svg>',
  pylon: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 L17 6 V14 L10 18 L3 14 V6 Z" fill="#4fc3f7" opacity=".85" stroke="#8fe4ff"/></svg>',
  btncd: '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#e5484d" stroke-width="2"/><path d="M10 5 V10 L13.5 12" stroke="#e5484d" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  oc:    '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 1 L3 11 H8.5 L7 19 L17 8 H11 Z" fill="none" stroke="#a371f7" stroke-width="1.6"/></svg>',
  sell:  '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#f0b429" stroke-width="1.8"/><path d="M7.6 13.5 V6.5 L12 6.5" stroke="#f0b429" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.6 10 H11.4" stroke="#f0b429" stroke-width="1.8" stroke-linecap="round"/></svg>',
  rcrit:  '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M11 2 L4 11 H9 L8 18 L16 8 H10.5 Z" fill="#4fc3f7"/></svg>',
  rpierce:'<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 L15 7 V13 L10 18 L5 13 V7 Z" fill="none" stroke="#ff8a4c" stroke-width="1.6"/><path d="M6 6 L14 14" stroke="#e5484d" stroke-width="1.6"/></svg>',
  rrepair:'<svg width="20" height="20" viewBox="0 0 20 20"><path d="M14 3 a4 4 0 0 1 0 8 l-9 6 l-2 -2 l6 -9 a4 4 0 0 1 5 -3 z" fill="#5cc98a"/></svg>',
  rluck:  '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 1.5 L12.2 6.8 L18 7.3 L13.6 11 L15 16.7 L10 13.8 L5 16.7 L6.4 11 L2 7.3 L7.8 6.8 Z" fill="#f0b429"/></svg>',
  rforesee:'<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 C5.5 3 2 10 2 10 C2 10 5.5 17 10 17 C14.5 17 18 10 18 10 C18 10 14.5 3 10 3 Z" fill="none" stroke="#c4a1ff" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="#c4a1ff"/></svg>',
};

function renderShop(){
  const A=(id,ico,nm,sub,cost,ok,extra='')=>
    `<div class="item ${ok?'':'off'}" data-a="${id}">
       <div class="ico">${ICONS[ico]}</div>
       <div class="nm">${nm}${extra}<small>${sub}</small></div>
       <div class="pz">${cost}</div></div>`;
  const m=S.mana, cap=popCap(), free=C.SLOTS-slotsUsed();
  let h='';

  h+='<div class="sec">魔　力　矿</div>';
  h+=A('node','node',`矿脉等级`,`每次点击 ${C.nodeYield(S.nodeLv)} → ${C.nodeYield(S.nodeLv+1)}`,
       C.nodeCost(S.nodeLv), m>=C.nodeCost(S.nodeLv), `<span class="lv">Lv${S.nodeLv}</span>`);
  h+=A('spd','spd',`挖掘速度`,`冷却 ${C.cdAt(S.spdLv).toFixed(2)}s → ${C.cdAt(S.spdLv+1).toFixed(2)}s`,
       C.spdCost(S.spdLv), m>=C.spdCost(S.spdLv), `<span class="lv">Lv${S.spdLv}</span>`);

  h+=`<div class="sec">村　民　（${S.pop.length}/${cap}）</div>`;
  const vc=C.villCost(S.pop.length), popOk=S.pop.length<cap;
  h+=A('miner','miner','矿工',`自动产出 ${(C.minerRate(S.nodeLv)*(1+0.25*S.res.miner)).toFixed(1)}/s`, vc, m>=vc&&popOk);
  h+=A('warrior','warrior','战士',S.barracks?'近战拦截 · HP 60':'需要兵营', vc, m>=vc&&popOk&&S.barracks>0);
  h+=A('archer','archer','弓箭手',S.barracks?'远程 · 可对空':'需要兵营', vc, m>=vc&&popOk&&S.barracks>0);
  h+=A('mage','mage','法师',S.barracks?'远程溅射 · 群伤':'需要兵营', vc, m>=vc&&popOk&&S.barracks>0);

  h+=`<div class="sec">建　筑　（${slotsUsed()}/${C.SLOTS} 格）</div>`;
  const ac=C.arrowCost(S.arrows), cc=C.cannonCost(S.cannons), bc=C.barrackCost(S.barracks);
  const fc=C.frostCost(S.frost), snc=C.sniperCost(S.sniper);
  const tmc=C.totemCost(S.totem), scc=C.scoutCost(S.scout);
  h+=A('b_arrow','arrow','箭塔','单体 · 对空 · 射程 110', ac, m>=ac&&free>0, `<span class="lv">×${S.arrows}</span>`);
  h+=A('b_cannon','cannon','炮台','溅射 · 不对空 · 射程 95', cc, m>=cc&&free>0, `<span class="lv">×${S.cannons}</span>`);
  h+=A('b_frost','frost','冰霜塔','减速 35% · 控制', fc, m>=fc&&free>0, `<span class="lv">×${S.frost}</span>`);
  h+=A('b_sniper','sniper','狙击塔','单体高伤 · 射程 220', snc, m>=snc&&free>0&&S.sniper<2, `<span class="lv">×${S.sniper}</span>`);
  h+=A('b_totem','totem','图腾','相邻塔 +20% 伤 / +10% 射程', tmc, m>=tmc&&free>0&&S.totem<2, `<span class="lv">×${S.totem}</span>`);
  h+=A('b_scout','scout','斥候塔','全场破隐 · 攻速 +15%', scc, m>=scc&&free>0&&S.scout<2, `<span class="lv">×${S.scout}</span>`);
  h+=A('b_barracks','barracks','兵营',`解锁战斗职业 · 人口 +4`, bc,
       m>=bc&&free>0&&S.barracks<C.MAX_BAR, `<span class="lv">×${S.barracks}</span>`);
  if(S.pylonLv===0)
    h+=A('b_pylon','pylon','护盾塔','建造后需升至 Lv5 才生成护盾', C.pylonCost[0], m>=C.pylonCost[0]&&free>0);
  else if(S.pylonLv<5){
    const pc=C.pylonCost[S.pylonLv];
    h+=A('pylon_up','pylon','护盾塔升级',
      S.pylonLv===4?'★ 升至 Lv5 · 解锁 400 点基地护盾':`修复 ${C.pylonRepair[S.pylonLv]} → ${C.pylonRepair[S.pylonLv+1]} HP/s`,
      pc, m>=pc, `<span class="lv">Lv${S.pylonLv}</span>`);
  } else h+=`<div class="item off"><div class="ico">${ICONS.pylon}</div><div class="nm">护盾塔 <span class="lv">Lv5 满</span><small>基地护盾 400 · 每波恢复</small></div><div class="pz" style="color:#3fb950">已满</div></div>`;
  h+=`<div class="item ${S.sellMode?'sel':''}" data-a="sellmode">
       <div class="ico">${ICONS.sell}</div>
       <div class="nm">出售模式${S.sellMode?'<span class="lv">开</span>':''}<small>点击建筑回收 60%${S.sold?` · 已卖 ${S.sold} 座`:''}</small></div>
       <div class="pz">${S.sellMode?'开':'关'}</div></div>`;

  h+='<div class="sec">强　化</div>';
  const MAXROW=(ico,nm,sub)=>`<div class="item off"><div class="ico">${ICONS[ico]}</div><div class="nm">${nm} <span class="lv">已满</span><small>${sub}</small></div><div class="pz" style="color:#3fb950">已满</div></div>`;
  if(S.arrows>0){
    if(S.arrowUp>=C.MAX_TOWER_UP) h+=MAXROW('arrow','箭塔强化',`伤害 ${(8*(1+.25*C.MAX_TOWER_UP)).toFixed(1)} · 已达上限`);
    else { const c=C.towerUp(TOWERS.arrow.base,S.arrowUp);
      h+=A('up_arrow','arrow','箭塔强化',`伤害 ${(8*(1+.25*S.arrowUp)).toFixed(1)} → ${(8*(1+.25*(S.arrowUp+1))).toFixed(1)}`,
        c, m>=c, `<span class="lv">+${S.arrowUp}</span>`); } }
  if(S.cannons>0){
    if(S.cannonUp>=C.MAX_TOWER_UP) h+=MAXROW('cannon','炮台强化',`伤害 ${(22*(1+.25*C.MAX_TOWER_UP)).toFixed(1)} · 已达上限`);
    else { const c=C.towerUp(TOWERS.cannon.base,S.cannonUp);
      h+=A('up_cannon','cannon','炮台强化',`伤害 ${(22*(1+.25*S.cannonUp)).toFixed(1)} → ${(22*(1+.25*(S.cannonUp+1))).toFixed(1)}`,
        c, m>=c, `<span class="lv">+${S.cannonUp}</span>`); } }
  if(S.frost>0){
    if(S.frostUp>=C.MAX_TOWER_UP) h+=MAXROW('frost','冰霜塔强化',`伤害 ${(4*(1+.25*C.MAX_TOWER_UP)).toFixed(1)} · 已达上限`);
    else { const c=C.towerUp(TOWERS.frost.base,S.frostUp);
      h+=A('up_frost','frost','冰霜塔强化',`伤害 ${(4*(1+.25*S.frostUp)).toFixed(1)} → ${(4*(1+.25*(S.frostUp+1))).toFixed(1)}`,
        c, m>=c, `<span class="lv">+${S.frostUp}</span>`); } }
  if(S.sniper>0){
    if(S.sniperUp>=C.MAX_TOWER_UP) h+=MAXROW('sniper','狙击塔强化',`伤害 ${(45*(1+.25*C.MAX_TOWER_UP)).toFixed(1)} · 已达上限`);
    else { const c=C.towerUp(TOWERS.sniper.base,S.sniperUp);
      h+=A('up_sniper','sniper','狙击塔强化',`伤害 ${(45*(1+.25*S.sniperUp)).toFixed(1)} → ${(45*(1+.25*(S.sniperUp+1))).toFixed(1)}`,
        c, m>=c, `<span class="lv">+${S.sniperUp}</span>`); } }
  const bcd=C.btnCdCost(S.btnCdLv), nextCd=Math.max(C.BTN_CD_MIN,C.BTN_CD*Math.pow(0.85,S.btnCdLv+1));
  h+=A('btncd','btncd','按钮冷却缩短',`${S.btnCdMax.toFixed(0)}s → ${nextCd.toFixed(0)}s`, bcd, m>=bcd,
       `<span class="lv">Lv${S.btnCdLv}</span>`);
  const oc=C.overcharge(S.ocUsed);
  h+=A('oc','oc','魔力过载',`本波全塔攻速 +35%${S.ocActive>0?' · 生效中':''}`, oc, m>=oc);

  h+='<div class="sec">研　究　（v1.1）</div>';
  for(const [id,cfg] of Object.entries(C.RES)){
    const lv=S.res[id], done=lv>=cfg.max;
    const cost=cfg.cost(lv);
    h+=A('res_'+id, 'r'+id, cfg.name, done?'已满级':cfg.desc(lv+1),
      done?'已满':cost, !done&&m>=cost, `<span class="lv">Lv${lv}/${cfg.max}</span>`);
  }

  const shop=document.getElementById('shop');
  shop.innerHTML=h;
  shop.querySelectorAll('.item').forEach(el=>{
    if(el.classList.contains('off')) return;
    el.onclick=()=>doAction(el.dataset.a);
  });
}

function doAction(a){
  switch(a){
    case 'node': if(buy(C.nodeCost(S.nodeLv))){S.nodeLv++; burst(CX,CY,16,'#4fc3f7',140,.6);} break;
    case 'spd':  if(buy(C.spdCost(S.spdLv))) S.spdLv++; break;
    case 'miner': case 'warrior': case 'archer': case 'mage': recruit(a); return;
    case 'b_arrow': S.build='arrow'; toast('选择一个建造格放置<b>箭塔</b>'); break;
    case 'b_cannon':S.build='cannon';toast('选择一个建造格放置<b>炮台</b>'); break;
    case 'b_barracks':S.build='barracks';toast('选择一个建造格放置<b>兵营</b>'); break;
    case 'b_pylon': S.build='pylon'; toast('选择一个建造格放置<b>护盾塔</b>'); break;
    case 'pylon_up': {
      const c=C.pylonCost[S.pylonLv];
      if(buy(c)){ S.pylonLv++;
        if(S.pylonLv===5){ S.shieldMax=C.SHIELD; S.shield=C.SHIELD;
          toast('<b style="color:#4fc3f7">护盾生成</b> — 基地获得 400 点护盾，每波结束恢复','good');
          document.getElementById('shbar').style.display='block'; }
      } break; }
    case 'up_arrow': if(buy(C.towerUp(TOWERS.arrow.base,S.arrowUp))) S.arrowUp++; break;
    case 'up_cannon':if(buy(C.towerUp(TOWERS.cannon.base,S.cannonUp))) S.cannonUp++; break;
    case 'btncd': if(buy(C.btnCdCost(S.btnCdLv))){ S.btnCdLv++;
      S.btnCdMax=Math.max(C.BTN_CD_MIN,C.BTN_CD*Math.pow(0.85,S.btnCdLv)); } break;
    case 'oc': if(buy(C.overcharge(S.ocUsed))){ S.ocUsed++; S.ocActive=45;
      toast('<b style="color:#a371f7">魔力过载</b> — 全塔攻速 +35%','good'); } break;
    case 'b_frost': S.build='frost'; toast('选择一个建造格放置<b style="color:#4fc3f7">冰霜塔</b>（减速控制）'); break;
    case 'b_sniper':S.build='sniper';toast('选择一个建造格放置<b style="color:#c4a1ff">狙击塔</b>（锁定最高 HP）'); break;
    case 'b_totem': S.build='totem'; toast('选择一个建造格放置<b style="color:#f0b429">图腾</b>（相邻塔加成）'); break;
    case 'b_scout': S.build='scout'; toast('选择一个建造格放置<b style="color:#4fc3f7">斥候塔</b>（全场破隐）'); break;
    case 'up_frost': if(buy(C.towerUp(TOWERS.frost.base,S.frostUp))) S.frostUp++; break;
    case 'up_sniper':if(buy(C.towerUp(TOWERS.sniper.base,S.sniperUp))) S.sniperUp++; break;
    case 'sellmode': S.sellMode=!S.sellMode;
      toast(S.sellMode?'<b style="color:#f0b429">出售模式</b> — 点击地图上的建筑回收 60%（升级投入不返还）':'退出出售模式'); break;
    default: {
      if(a.startsWith('res_')){
        const id=a.slice(4), cfg=C.RES[id];
        if(cfg && S.res[id]<cfg.max && buy(cfg.cost(S.res[id]))){ S.res[id]++;
          if(id==='foresee') updateButtonUI();
          if(id==='luck') toast('<b style="color:#f0b429">幸运星</b> — 空响概率降低','good');
        }
      }
    }
  }
  renderShop();
}

// ======================= HUD =======================
function updateHUD(){
  // 商店可购性节流刷新：挖矿 / 被动收入 / 波次结算加钱后立即可购（Bug 修复：原只在玩家操作时刷新）
  if(S.t - (S._shopT || -9) > 0.25){ S._shopT = S.t; renderShop(); }
  document.getElementById('sMana').textContent=fmt(S.mana);
  document.getElementById('sInc').textContent=income().toFixed(1)+'/s';
  document.getElementById('sPop').textContent=`${S.pop.length}/${popCap()}`;
  document.getElementById('sSlot').textContent=`${slotsUsed()}/${C.SLOTS}`;
  document.getElementById('sHp').textContent=Math.max(0,Math.round(S.baseHp));
  document.getElementById('hpfill').style.width=clamp(S.baseHp/S.baseMax*100,0,100)+'%';
  document.getElementById('hpfill').style.background= S.baseHp/S.baseMax>.35?'#3fb950':'#e5484d';
  if(S.shieldMax>0){ document.getElementById('shbar').style.display='block';
    document.getElementById('shfill').style.width=clamp(S.shield/S.shieldMax*100,0,100)+'%'; }
  const wv=document.getElementById('sWave');
  wv.textContent = S.phase==='boss'?'BOSS': S.phase==='fight'?`第 ${S.wave} 波`
    : S.wave===0?'发育期':`发育期`;
  document.getElementById('sTime').textContent= S.phase==='boss'?'—':mmss(S.phaseT);
  const tag=document.getElementById('phaseTag');
  if(S.phase==='fight'||S.phase==='boss'){ tag.className='fight';
    tag.textContent= S.phase==='boss'?'最终决战':'战斗中'; }
  else { tag.className=''; tag.textContent= S.wave===0?'建设阶段 · 无敌人':`发育期 ${S.wave}/5`; }
  // 波次预览（GDD 7.4）：发育期常驻显示下一波组成与事件
  const wvprev=document.getElementById('wvprev');
  if(wvprev){
    if(S.phase==='build' && S.wave<5){
      const comp=WAVES[S.wave];
      const names=Object.entries(comp)
        .map(([t,c])=>`${ENEMIES[t]?ENEMIES[t].name:t}×${c}`).join(' · ');
      wvprev.innerHTML=`<div class="wp-t">下一波 W${S.wave+1}</div><div class="wp-c">${names}</div>`
        +(S.nextEvent?`<div class="wp-e">事件：${S.nextEvent.name}</div>`:'');
      wvprev.style.display='block';
    } else if(S.phase==='build' && S.wave>=5){
      wvprev.innerHTML='<div class="wp-t">下一战</div><div class="wp-c" style="color:#e5484d">BOSS · 环绕螺旋</div><div class="wp-e">四面皆有交战窗口</div>';
      wvprev.style.display='block';
    } else wvprev.style.display='none';
  }
}

function updateButtonUI(){
  const btn=document.getElementById('bigbtn'), cd=document.getElementById('bcd');
  const ready=S.btnCd<=0 && !S.over;
  btn.disabled=!ready;
  cd.textContent = ready? '' : Math.ceil(S.btnCd);
  const p = ready? 0 : (S.btnCd/S.btnCdMax);
  document.getElementById('ringfx').setAttribute('stroke-dashoffset', (383.3*p).toFixed(1));
  document.getElementById('pcount').textContent=S.presses;
  const n=S.presses;
  const h0=C.BOSS_HP*Math.pow(C.BOSS_HP_MUL,n), h1=C.BOSS_HP*Math.pow(C.BOSS_HP_MUL,n+1);
  const a0=C.BOSS_ATK*Math.pow(C.BOSS_ATK_MUL,n), a1=C.BOSS_ATK*Math.pow(C.BOSS_ATK_MUL,n+1);
  document.getElementById('cHp').textContent=`${fmt(h0)} → ${fmt(h1)}`;
  document.getElementById('cAtk').textContent=`${Math.round(a0)} → ${Math.round(a1)}`;
  document.getElementById('cEnemy').textContent=`+3% 数量 / +2% HP`;
  document.getElementById('curses').innerHTML =
    S.curses.map(id=>`<div class="curse">${CURSES.find(c=>c.id===id).name}</div>`).join('');
  // 预知研究：按钮面板显示当前奖励权重（GDD 6.4 —— P1 友好）
  const fw=document.getElementById('fw');
  if(fw){
    if(S.res.foresee>0){
      const noneW = S.res.luck>0 ? [4,2,1][S.res.luck] : 4;
      fw.innerHTML='<div class="fw-t">奖励权重 · 预知</div>'+REWARDS.map(r=>
        `<span class="fw-i" style="${r.id==='none'?'color:#e5484d':''}">${r.name} ${r.id==='none'?noneW:r.w}%</span>`).join('');
      fw.style.display='block';
    } else fw.style.display='none';
  }
}

// ======================= 弹窗 =======================
function openModal(html){ document.getElementById('mbox').innerHTML=html;
  document.getElementById('modal').classList.add('on'); }
function closeModal(){ document.getElementById('modal').classList.remove('on'); }
function restart(){ closeModal(); newGame(); renderShop(); updateButtonUI();
  setHint('点击中央<b style="color:#4fc3f7">魔力矿</b>开始采集'); }

// ======================= 输入 =======================
function toWorld(ev){
  const r=cv.getBoundingClientRect();
  return { x:(ev.clientX-r.left-OX)/SC, y:(ev.clientY-r.top-OY)/SC };
}
cv.addEventListener('mousemove',ev=>{
  const p=toWorld(ev); S.hoverSlot=null;
  for(const s of S.slots) if(dist(p.x,p.y,s.x,s.y)<20){ S.hoverSlot=s; break; }
  cv.style.cursor = (dist(p.x,p.y,CX,CY)<52) ? 'pointer'
    : (S.hoverSlot && (S.build||S.hoverSlot.b)) ? 'pointer' : 'default';
});
cv.addEventListener('mousedown',ev=>{
  if(S.paused||S.over) return;
  const p=toWorld(ev);
  if(ev.button===2){ S.build=null; return; }
  if(dist(p.x,p.y,CX,CY)<52){ mineClick(); return; }
  if(S.sellMode){
    for(const s of S.slots) if(dist(p.x,p.y,s.x,s.y)<20 && s.b){ sellBuilding(s); return; }
  }
  if(S.build){ for(const s of S.slots) if(dist(p.x,p.y,s.x,s.y)<20 && !s.b){ placeBuilding(s,S.build); return; } }
});
cv.addEventListener('contextmenu',e=>{ e.preventDefault(); S.build=null; });
document.getElementById('bigbtn').addEventListener('click',pressButton);
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){ e.preventDefault(); mineClick(); }
  if(e.key==='Escape') S.build=null;
});

// ======================= 启动 =======================
let last=performance.now();
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  update(dt); draw(); updateHUD(); updateButtonUI();
  requestAnimationFrame(loop);
}
newGame(); resize(); renderShop(); updateButtonUI();
openModal(`
  <div class="mtitle">别按那个键</div>
  <div class="msub">
    一座孤岛，中间一处魔力矿。你有 <b style="color:#e6edf3">5 分钟</b> 发育，然后面对五波敌人和最终 BOSS。<br>
    敌人会隐身、会分裂、会自爆、会复活队友；你有箭塔炮台，还有冰霜、狙击、图腾、斥候和<b style="color:#e6edf3">研究所</b>。<br>
    右边那个红按钮会给你随机好处 —— 代价是 BOSS 变强。代价是<b style="color:#e6edf3">确定的、可见的</b>。<br>
    按不按，你自己决定。
  </div>
  <div class="rows" style="grid-template-columns:auto 1fr">
    <span class="k">采集</span><span class="v" style="text-align:left">点击中央魔力矿 或按 <kbd>空格</kbd></span>
    <span class="k">建造</span><span class="v" style="text-align:left">在右侧面板选建筑，再点地图上的虚线格</span>
    <span class="k">出售</span><span class="v" style="text-align:left">商店「出售模式」开启后点击建筑回收 60%</span>
    <span class="k">取消</span><span class="v" style="text-align:left"><kbd>右键</kbd> 或 <kbd>Esc</kbd></span>
    <span class="k">目标</span><span class="v" style="text-align:left">守住基地，打赢 BOSS</span>
  </div>
  <div class="btnrow"><button class="mbtn pri" onclick="closeModal();">开始</button></div>
`);
requestAnimationFrame(loop);
