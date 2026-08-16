/* =====================================================================
 * engine.js — 《营造司》v1.5 城市营造盘 纯逻辑引擎 (无 DOM, 可 node 单测)
 * 城盘评分 / 放置 / 灵感 / 主动技 / 删牌 sink / 商店 / 道具 / 胜负
 * 所有未验证数值标 [PLACEHOLDER]
 * ===================================================================== */

(function (root) {
  'use strict';

  const D = (typeof require !== 'undefined') ? require('./data.js') : root.GAME_DATA;

  /* 相邻功能加成表规范化: 数据里键顺序无关(无序对), 引擎按 [a,b].sort() 查表,
     这里预建成"排序键 → 加成"的映射, 避免数据键顺序写反导致加成永不触发(曾发生的 bug)。 */
  const ADJ = {};
  for (const k in (D.ADJ || {})) {
    const [a, b] = k.split('|');
    ADJ[[a, b].sort().join('|')] = D.ADJ[k];
  }

  /* ---------- 工具 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let _uid = 1;
  function newUid() { return 'u' + (_uid++); }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeInstance(base, overrides) {
    const inst = {
      uid: newUid(),
      id: base.id || null,
      name: base.name,
      type: base.type,
      kind: base.kind,
      pillar: base.pillar,
      value: base.value,
      element: base.element,
      rarity: base.rarity,
      desc: base.desc || '',
      skill: base.skill || '',
      effect: base.effect || null,
      active: !!base.active,
      cost: base.cost || 0,
      white: base.type === 'normal',
      archetype: (D.ARCHETYPES ? D.ARCHETYPES.filter((a) => a.match(base) || (base.type === 'special' && a.core.includes(base.effect))).map((a) => a.id) : []),
    };
    if (overrides) Object.assign(inst, overrides);
    return inst;
  }

  /* ---------- 创建一局 ---------- */
  function createGame(seed) {
    const rng = mulberry32(seed || (Date.now() & 0xffffffff));
    const state = {
      rng, seed: seed || 0,
      level: 0,
      score: 0,
      coins: 0,
      owned: [],            // 永久牌组(建筑池)
      hand: [], discard: [],
      board: [], boardW: 0, boardH: 0,
      terrain: [],          // 与 board 同维: 每格地形 key(TERRAIN)
      placementsLeft: 0,
      inspiration: 0,
      props: [],
      artifacts: [],        // 永久遗珍(肉鸽被动)
      charter: null,        // 开局营造令/司署, 决定初始牌组与奖励倾向
      shop: null,
      pending: { levelScoreMult: 1, ignoreKe: false, wildAdj: false },
      removedCount: 0,
      upgradeCount: 0,
      heat: 0,              // 气势: 高质量落子推进, 达段位给即时奖励
      heatRank: 0,
      bestHeatRank: 0,
      // [v2 P1] 拆建/迁建/余烬/印记/本关放置记录
      demolishCount: 0,     // 全局已拆建数(成本递增 3+2n)
      movesLeft: 0,         // 本关剩余迁建次数
      ember: 0,             // 灵感溢出存的"余烬"
      sealCount: 0,         // 已得诏令印记
      levelPlaced: [],      // 本关放置的建筑 uid(圣旨重开时移除)
      rerollCost: 2,
      over: false, won: false,
      rewarded: false,      // 防重复发放关卡奖励
      edictLog: [],         // 已达成诏令名(用于结算)
      tutorial: false,      // 首关引导关标记
      tutorialShown: false, // 引导弹窗已展示(每局一次)
      tutCell: null,        // 教学高亮格 {r,c}(放这里触发地形+相邻双回响)
      log: [],
    };
    return state;
  }

  function artifactById(id) { return (D.ARTIFACTS || []).find((a) => a.id === id); }
  function hasArtifact(state, id) { return !!(state.artifacts || []).some((a) => a.id === id); }
  function charterById(id) { return (D.CHARTERS || []).find((c) => c.id === id) || (D.CHARTERS || [])[0]; }
  function findNormalByName(name) { return D.normalCards.find((c) => c.name === name); }
  function findSpecialByName(name) { return D.specialCards.find((c) => c.name === name); }

  function chooseCharter(state, id) {
    if (state.level > 0) return { ok: false, msg: '本局已开始' };
    const ch = charterById(id);
    if (!ch) return { ok: false, msg: '无此营造令' };
    state.charter = { id: ch.id, name: ch.name, title: ch.title, color: ch.color, desc: ch.desc };
    state.artifacts = [];
    if (ch.artifact) {
      const a = artifactById(ch.artifact);
      if (a) state.artifacts.push(Object.assign({}, a, { source: '营造令' }));
    }
    state.owned = [];
    (ch.starterNames || []).forEach((name) => {
      const base = findNormalByName(name);
      if (base) state.owned.push(makeInstance(base));
    });
    (ch.starterSpecialNames || []).forEach((name) => {
      const base = findSpecialByName(name);
      if (base) state.owned.push(makeInstance(base));
    });
    if (state.owned.length < 8) D.normalCards.slice(0, 12).forEach((b) => state.owned.push(makeInstance(b)));
    log(state, `营造令: ${ch.name}·${ch.title}`);
    return { ok: true, charter: state.charter };
  }

  function ensureStarterDeck(state) {
    if (state.owned.length) return;
    chooseCharter(state, (D.CHARTERS && D.CHARTERS[0] && D.CHARTERS[0].id) || null);
  }

  function heatName(rank) {
    return ['无', '起势', '连营', '鼎盛', '名动', '狂潮'][rank] || '狂潮';
  }
  function awardHeat(state, gain) {
    const oldRank = state.heatRank || 0;
    state.heat = Math.min(100, (state.heat || 0) + Math.max(0, gain));
    const thresholds = D.HEAT_THRESHOLDS || [];
    let rank = oldRank;
    while (rank < thresholds.length && state.heat >= thresholds[rank]) rank++;
    state.heatRank = rank;
    state.bestHeatRank = Math.max(state.bestHeatRank || 0, rank);
    const ups = [];
    for (let r = oldRank + 1; r <= rank; r++) {
      const reward = { rank: r, name: heatName(r), coins: 0, inspiration: 0, placements: 0, mult: 1 };
      if (r === 1) { reward.inspiration = 1; state.inspiration = Math.min(D.INSP_CAP, state.inspiration + 1); }
      if (r === 2) { reward.coins = 2; state.coins += 2; }
      if (r === 3) { reward.placements = 1; state.placementsLeft += 1; }
      if (r === 4) { reward.coins = 3; reward.inspiration = 1; state.coins += 3; state.inspiration = Math.min(D.INSP_CAP, state.inspiration + 1); }
      if (r === 5) { reward.mult = 1.2; state.pending.levelScoreMult = Math.max(state.pending.levelScoreMult, 1.2); }
      ups.push(reward);
      log(state, `气势·${reward.name}`);
    }
    return { gain, heat: state.heat, rank, name: heatName(rank), ups };
  }

  /* ---------- 地势生成: 首关建盘, 城盘长大时旧地形保留、新格按概率生成 ---------- */
  // 地形概率随关卡缓升: p = min(0.28, 0.16 + 0.006*level)。地形类型均匀取自 4 种非plain。
  function expandTerrain(state, n) {
    const old = state.terrain || [];
    let p = Math.min(0.28, 0.16 + 0.006 * state.level);
    // [v2 P1] 洪涝灾异: 本关水泽生成概率 ×1.5
    const cat = state.cfg && state.cfg.catastrophe;
    if (cat) p *= (cat.marshBoost || 1);
    const types = ['marsh', 'hill', 'fertile', 'road'];
    const nt = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        if (r < old.length && c < old.length) { row.push(old[r][c]); continue; } // 旧地形保留
        row.push(state.rng() < p ? types[Math.floor(state.rng() * types.length)] : 'plain');
      }
      nt.push(row);
    }
    state.terrain = nt;
  }

  /* ---------- 关卡: 城盘持久 + 随关卡长大, 抽手牌 ---------- */
  function startLevel(state) {
    ensureStarterDeck(state);
    state.level += 1;
    const cfg = D.getLevelConfig(state.level);
    state.cfg = cfg;
    state.score = 0;
    state.placementsLeft = cfg.placements;
    state.inspiration = 0;
    state.pending = { levelScoreMult: 1, ignoreKe: false, wildAdj: false };
    state.rewarded = false;
    state.lastEdict = null;
    state.movesLeft = D.MOVES_PER_LEVEL;  // [v2 P1] 每关迁建次数重置
    state.discardsLeft = D.DISCARDS_PER_LEVEL; // [v3] 修复: 弃牌次数未初始化导致无限弃牌+UI 显示 undefined
    state.levelPlaced = [];               // [v2 P1] 本关放置记录清空
    state.over = false; state.won = false; // 圣旨重开/重进关卡时复位
    const n = cfg.size;
    if (state.boardW === 0) {
      // 首关: 新建空盘
      state.boardW = n; state.boardH = n;
      state.board = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push(null);
        state.board.push(row);
      }
      expandTerrain(state, n);
    } else if (n > state.boardW) {
      // 城盘长大: 复制旧格到新盘左上, 新格留空
      const nb = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push((r < state.boardH && c < state.boardW) ? state.board[r][c] : null);
        nb.push(row);
      }
      state.board = nb; state.boardW = n; state.boardH = n;
      expandTerrain(state, n); // 仅新格生成地形, 旧地形已保留
    }
    // 首关引导关: 预置一座民居 + 相邻沃壤格高亮, 保证手牌含民居, 让第一次落子必见回响(P1)
    if (state.level === 1) setupTutorial(state, n);
    state.discard = [];
    state.hand = [];
    drawTo(state, D.HAND_SIZE);
    if (state.tutorial) ensureTutorialHand(state);
    state.score = evalBoard(state).total; // 既有城市已有分
    return cfg;
  }

  /* ---------- 首关引导关: 让第一次落子必触发正反馈(地势+相邻双回响) ---------- */
  // 预置一座衙门(土)作相邻参照 —— 与民居有相邻功能加成(治安+8)且土属性不会被民居克;
  // 把其下方格地形设为沃壤(契合民居)并高亮为教学格; 保证手牌含一张土/金民居(不会反克衙门)。
  // 引导玩家把该民居放到高亮🌾格 → 同时见"地形×1.3"与"相邻功能加成"两条回响(P1)。
  function setupTutorial(state, n) {
    if (state.tutorial) return;
    state.tutorial = true;
    const yamen = D.normalCards.find((b) => b.kind === '衙门'); // 衙门(土): 与民居有 ADJ, 与土/金民居无相克
    if (yamen && n >= 3 && !state.board[0][1]) state.board[0][1] = makeInstance(yamen);
    if (state.terrain[1]) state.terrain[1][1] = 'fertile';      // 下方(1,1)沃壤高亮
    state.tutCell = { r: 1, c: 1 };
  }
  function ensureTutorialHand(state) {
    const safe = (c) => c.kind === '民居' && (c.element === '土' || c.element === '金'); // 土/金民居不会被衙门(土)克
    const ideal = (c) => c.kind === '民居' && c.element === '金'; // 金民居还能吃 土生金, 保证首落过线
    if (state.hand.some(ideal)) return;                          // 手牌已有最佳教学民居
    const onBoard = new Set();
    for (const row of state.board) for (const c of row) if (c) onBoard.add(c.uid);
    let idx = state.owned.findIndex((c) => ideal(c) && !onBoard.has(c.uid)); // [v3] 盘上已放置的不可换
    if (idx < 0) {
      const fallback = D.normalCards.find((c) => c.name === '山西大院') || D.normalCards.find(ideal) || D.normalCards.find(safe);
      if (!fallback) return;
      state.owned.push(makeInstance(fallback));
      idx = state.owned.length - 1;
    }
    const mins = state.owned[idx];
    state.discard = state.discard.filter((c) => c.uid !== mins.uid); // 防止同一实例同时在手牌和抽牌堆
    const removed = state.hand.shift();                         // 让出一个手牌位
    if (removed) state.discard.push(removed);
    state.hand.push(mins);
  }

  function drawTo(state, n) {
    while (state.hand.length < n) {
      if (state.owned.length === 0) break;
      if (state.discard.length === 0) {
        // [v3] 修复: 盘上已放置的建筑不得回手(否则同一对象同时在手牌与盘上, 预览还原会误删盘上建筑)
        const onBoard = new Set();
        for (const row of state.board) for (const c of row) if (c) onBoard.add(c.uid);
        const pool = state.owned.filter((c) => !onBoard.has(c.uid));
        if (pool.length === 0) break;
        state.discard = shuffle(pool, state.rng);
      }
      const inst = state.discard.pop();
      if (inst) state.hand.push(inst);
    }
  }

  function cellList(board) {
    const cells = [];
    for (let r = 0; r < board.length; r++)
      for (let c = 0; c < board[r].length; c++)
        if (board[r][c]) cells.push({ r, c, inst: board[r][c] });
    return cells;
  }

  // 相邻对: 正交邻居(去重) + 若 wildAdj 则另加所有非邻居对(半效)
  function neighborPairs(state) {
    const b = state.board, W = state.boardW, H = state.boardH;
    const pairs = [];
    const cells = cellList(b);
    const at = (r, c) => (r >= 0 && r < H && c >= 0 && c < W) ? b[r][c] : null;
    const dirs = [[0, 1], [1, 0]];
    for (const cell of cells) {
      for (const [dr, dc] of dirs) {
        const nr = cell.r + dr, nc = cell.c + dc;
        const o = at(nr, nc);
        if (o) pairs.push({ a: cell, b: { r: nr, c: nc, inst: o }, orth: true });
      }
    }
    // 全连接(仅观星台 wildAdj 激活时): 所有其他无序对, 半效; 否则仅正交相邻参与评分
    if (state.pending.wildAdj) {
      for (let i = 0; i < cells.length; i++)
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i], c = cells[j];
          const orth = Math.abs(a.r - c.r) + Math.abs(a.c - c.c) === 1;
          if (!orth) pairs.push({ a, b: c, orth: false });
        }
    }
    return pairs;
  }

  /* [v2 P1] 流派成型判定(evalBoard 流派印 & getArchetypeStatus 共用) */
  function archetypeDone(state, a) {
    const allCards = state.owned.concat(state.board.flat().filter(Boolean));
    const hasCore = allCards.some((c) => c.type === 'special' && a.core.includes(c.effect));
    if (!hasCore) return false;
    return state.owned.filter((c) => a.match(c)).length >= a.need;
  }

  /* ---------- 城盘评分(核心大脑) ---------- */
  function evalBoard(state) {
    const S = D.SCORE;
    const board = state.board;
    const cells = cellList(board);
    const pillars = { 民生: 0, 经济: 0, 治安: 0 };
    const triggers = [];

    // 收集盘上营造物效果与计数
    const present = new Set();
    const kindCount = {}, elemCount = {};
    cells.forEach((x) => {
      if (x.inst.type === 'special' && x.inst.effect) present.add(x.inst.effect);
      kindCount[x.inst.kind] = (kindCount[x.inst.kind] || 0) + 1;
      elemCount[x.inst.element] = (elemCount[x.inst.element] || 0) + 1;
    });
    const gardenCount = kindCount['园林'] || 0;
    const charterId = state.charter && state.charter.id;
    const chainPair = S.CHAIN_PAIR + (hasArtifact(state, 'star_chart') ? 2 : 0) + (charterId === 'wuxing' ? 1 : 0);
    const adjBonus = (hasArtifact(state, 'street_license') ? 2 : 0) + (charterId === 'dense' ? 1 : 0);

    // [v2 P1] 相生链: 正交相邻且顺生(木→火→土…)构成有向边, 求最长顺生链(链上同元素只计一次,
    // 五格闭环天然享受 ×1.5)。链上节点基础值 ×1.25(≥3 链) / ×1.5(≥5 链)——五行从加法升级为乘法主轴。
    const nCells = cells.length;
    const child = Array.from({ length: nCells }, () => []);
    for (let i = 0; i < nCells; i++) {
      for (let j = i + 1; j < nCells; j++) {
        const a = cells[i], b = cells[j];
        if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) continue;
        if (D.SHENG[a.inst.element] === b.inst.element) child[i].push(j);
        if (D.SHENG[b.inst.element] === a.inst.element) child[j].push(i);
      }
    }
    let chainLen = 0;
    const chainSet = new Set();
    {
      const visElem = new Set();
      const dfs = (i, len, set) => {
        const el = cells[i].inst.element;
        if (visElem.has(el)) return;
        visElem.add(el); set.add(i);
        if (len > chainLen) { chainLen = len; chainSet.clear(); for (const k of set) chainSet.add(k); }
        for (const j of child[i]) dfs(j, len + 1, set);
        set.delete(i); visElem.delete(el);
      };
      for (let i = 0; i < nCells; i++) dfs(i, 1, new Set());
    }
    const chainMult = chainLen >= S.CHAIN_MULT2_LEN ? S.CHAIN_MULT2
      : chainLen >= S.CHAIN_MULT_LEN ? S.CHAIN_MULT : 1;
    if (chainLen >= S.CHAIN_MULT_LEN) triggers.push('生链×' + chainMult + '(' + chainLen + '座)');

    // 1) 基础值(含每格乘率: 都江堰/颐和园/承德 + 地势契合 + 圜丘 + 生链乘率)
    // 先统计地形契合建筑数(圜丘按契合数触发), 再逐格计分
    const fitCells = [];
    cells.forEach((x) => {
      const terr = state.terrain[x.r] && state.terrain[x.r][x.c];
      if (terr && D.TERRAIN[terr] && D.TERRAIN[terr].mult > 1 && D.TERRAIN[terr].kinds.includes(x.inst.kind)) fitCells.push(x);
    });
    const yuanqiuOn = present.has('yuanqiu') && fitCells.length >= S.YUANQIU_FIT_NEED;
    if (yuanqiuOn) triggers.push('圜丘·契合×1.1');
    cells.forEach((x, i) => {
      let v = x.inst.value;
      if (x.inst.pillar === '经济' && x.inst.element === '水' && present.has('dujiangyan')) v *= 1.5;
      if (x.inst.pillar === '民生' && present.has('yihe')) v *= 1.3;
      if (x.inst.element === '水' && present.has('dayunhe')) v *= 1.4;
      // 地势契合: 落在匹配地形上, 该建筑基础值 ×TERRAIN.mult
      const terr = state.terrain[x.r] && state.terrain[x.r][x.c];
      if (terr && D.TERRAIN[terr] && D.TERRAIN[terr].mult > 1 && D.TERRAIN[terr].kinds.includes(x.inst.kind)) {
        v *= D.TERRAIN[terr].mult + (hasArtifact(state, 'terrain_atlas') ? 0.15 : 0);
        triggers.push('地形·' + D.TERRAIN[terr].name);
      }
      if (yuanqiuOn && fitCells.includes(x)) v *= S.YUANQIU_MULT;
      if (chainSet.has(i)) v *= chainMult;
      pillars[x.inst.pillar] += v;
    });

    // 2) 邻接 / 五行生克链 / 相克
    const pairs = neighborPairs(state);
    let waterWoodChain = 0;
    for (const p of pairs) {
      const a = p.a.inst, b = p.b.inst;
      const w = p.orth ? 1 : 0.5;
      // 功能邻接(键已规范化, 顺序无关)
      const key = [a.kind, b.kind].sort().join('|');
      const adj = ADJ[key];
      if (adj) { for (const k in adj) pillars[k] += (adj[k] + adjBonus) * w; triggers.push(`${a.kind}↔${b.kind}`); }
      // 五行相生链
      if (D.SHENG[a.element] === b.element) { pillars[b.pillar] += chainPair * w; triggers.push(`${a.element}生${b.element}`); }
      else if (D.SHENG[b.element] === a.element) { pillars[a.pillar] += chainPair * w; triggers.push(`${b.element}生${a.element}`); }
      if (a.element === '水' && present.has('dayunhe')) waterWoodChain += chainPair * w;
      // 五行相克惩罚
      if (!state.pending.ignoreKe) {
        let victim = null, keStr = null;
        if (D.KE.has(a.element + b.element)) { victim = b; keStr = a.element + '克' + b.element; }
        else if (D.KE.has(b.element + a.element)) { victim = a; keStr = b.element + '克' + a.element; }
        if (victim) {
          const resolve = D.RESOLVE_KINDS.includes(a.kind) || D.RESOLVE_KINDS.includes(b.kind);
          // v1.8: 相克惩罚 = max(被克建筑基础值×KE_PEN_FRAC, KE_PEN_MIN)。
          //       与被克卡自身价值挂钩(白卡≈-12, 红卡≈-19), 是相邻加成的 1.5~2 倍 → 真实取舍;
          //       不做整栏乘法/clamp——实测会把"不看相克乱放"的 bot 从 L19 砍到 L10, 对普通玩家过狠。
          //       观星台隔空半效仍按 w=0.5。
          if (!resolve) {
            const pen = Math.max(S.KE_PEN_MIN, victim.value * S.KE_PEN_FRAC) * w;
            pillars[victim.pillar] -= pen;
            triggers.push(keStr + '✗');
          }
          else triggers.push(keStr + '·化解');
        }
      }
    }
    if (waterWoodChain) pillars['经济'] += waterWoodChain;

    // 3) 资源链路: 水利 & 市集(大旱灾异时水利失效)
    const cat = state.cfg && state.cfg.catastrophe;
    const hasWater = !(cat && cat.waterDead) && (kindCount['水利'] || 0) > 0;
    const hasMarket = (kindCount['市集'] || 0) > 0;
    if (hasWater && hasMarket) {
      const adj = pairs.some((p) => (p.a.inst.kind === '水利' && p.b.inst.kind === '市集') || (p.a.inst.kind === '市集' && p.b.inst.kind === '水利'));
      const linkBonus = (hasArtifact(state, 'canal_tally') ? 8 : 0) + (charterId === 'hydro' ? 4 : 0);
      pillars['经济'] += (adj ? S.RES_LINK_ADJ : S.RES_LINK) + linkBonus;
      triggers.push(adj ? '水利↔市集(相邻)' : '水利↔市集(同盘)');
    }

    // 4) 营造物区域技能(计数类)
    if (present.has('xian_wall')) pillars['治安'] += 4 * (kindCount['防御'] || 0);
    if (present.has('luoyang_qiao')) pillars['经济'] += 4 * (kindCount['道路'] || 0);
    if (present.has('ge_yuan')) pillars['民生'] += 5 * gardenCount;
    if (present.has('lianhua')) pillars['民生'] += 3 * (elemCount['水'] || 0);
    if (present.has('gong_wang')) pillars['治安'] += 6 * (kindCount['礼制'] || 0);
    if (present.has('zhaozhou')) pillars['经济'] += 10 * (kindCount['道路'] || 0);
    if (present.has('chengde')) pillars['民生'] += 8 * gardenCount * (kindCount['民生'] || 0);
    if (present.has('shanhai') && ((elemCount['金'] || 0) + (elemCount['土'] || 0)) >= 3) pillars['治安'] += 30;
    if (present.has('wanli')) {
      pillars['治安'] += 15 * (kindCount['防御'] || 0);
      // 相邻防御对额外 +10
      let defPairs = 0;
      for (const p of pairs) {
        if (p.a.inst.kind === '防御' && p.b.inst.kind === '防御' && p.orth) defPairs++;
      }
      pillars['治安'] += 10 * defPairs;
    }

    // 4.1) 永久遗珍 / 营造令被动: 关隘奖励带来的长期构筑 payoff
    if (hasArtifact(state, 'city_register')) { pillars['民生'] += 3 * (kindCount['民居'] || 0); triggers.push('遗珍·户籍'); }
    if (charterId === 'living') pillars['民生'] += 2 * ((kindCount['民居'] || 0) + gardenCount);
    if (hasArtifact(state, 'war_drum')) { pillars['治安'] += 3 * ((kindCount['衙门'] || 0) + (kindCount['防御'] || 0)); triggers.push('遗珍·边鼓'); }
    if (charterId === 'wall') pillars['治安'] += 2 * ((kindCount['衙门'] || 0) + (kindCount['防御'] || 0));
    if (charterId === 'inspire' && state.inspiration >= 4) { pillars['民生'] += 12; triggers.push('机巧·蓄势'); }

    // 4.5) 坊: 棋盘 ≥5×5 时, 非重叠 3×3 坊(自左上平铺)全满且主栏占比≥7 → 主栏 +20
    // 纯增益(不影响可解性), 奖励"密集主题建造"这一空间策略。
    // [v2 P1] 9/9 全同栏 → 该栏 ×1.2(坊升级为后期乘率入口)
    const ward9 = {};  // 主栏 -> 累计乘率(可能多个 9/9 坊)
    if (state.boardW >= 5) {
      for (let br = 0; br + 3 <= state.boardW; br += 3) {
        for (let bc = 0; bc + 3 <= state.boardW; bc += 3) {
          let full = true; const pc = {};
          for (let r = br; r < br + 3 && full; r++)
            for (let c = bc; c < bc + 3; c++) {
              const x = state.board[r][c];
              if (!x) { full = false; break; }
              pc[x.pillar] = (pc[x.pillar] || 0) + 1;
            }
          if (!full) continue;
          let topK = null, topV = 0;
          for (const k in pc) if (pc[k] > topV) { topV = pc[k]; topK = k; }
          if (topV >= 7) { pillars[topK] += 20; triggers.push('坊·' + topK + '满'); }
          if (topV >= 9) { ward9[topK] = (ward9[topK] || 1) * S.WARD9_MULT; triggers.push('坊·' + topK + '9/9×' + S.WARD9_MULT); }
        }
      }
    }
    for (const k in ward9) pillars[k] *= ward9[k];

    // [v2 P1] 流派印: 已成型流派的"流派印"加分(放置即见回报, 盘面常量分幂等)
    let stampSum = 0;
    (D.ARCHETYPES || []).forEach((a) => {
      if (a.stamp && archetypeDone(state, a)) { pillars[a.stamp.pillar] += a.stamp.n; stampSum += a.stamp.n; }
    });
    if (stampSum) triggers.push('流派印+' + stampSum);

    // [v2 P1] 灾异栏乘率(关隘仪式化): 在总乘率前作用于整栏
    const pillarMult = {};
    if (cat) {
      const cats = cat.parts ? cat.parts : [cat];
      cats.forEach((c) => { if (c.pillarMult) for (const k in c.pillarMult) pillarMult[k] = (pillarMult[k] || 1) * c.pillarMult[k]; });
    }
    for (const k in pillarMult) { pillars[k] *= pillarMult[k]; if (pillarMult[k] !== 1) triggers.push('灾异·' + k + '×' + pillarMult[k]); }

    // 5) 含嘉仓: 三栏均有建筑 → 总分 ×1.25
    const allThree = (kindCount['民生'] || 0) + (kindCount['经济'] || 0) + (kindCount['治安'] || 0) > 0
      && pillars['民生'] > 0 && pillars['经济'] > 0 && pillars['治安'] > 0;
    let totalMult = state.pending.levelScoreMult;
    if (present.has('hanjiacang') && allThree) totalMult *= 1.25;
    if (hasArtifact(state, 'jade_ruler') && allThree) { totalMult *= 1.08; triggers.push('遗珍·白玉尺×1.08'); }

    let total = (pillars['民生'] + pillars['经济'] + pillars['治安']) * totalMult;

    // 6) 硬上限防爆炸: 超出部分按 SCORE_CAP_OVER_MULT 衰减计入(截断会吃掉极限 build 的反馈)
    const cap = state.cfg ? state.cfg.quota * S.SCORE_CAP_MULT : Infinity;
    if (total > cap) total = cap + (total - cap) * S.SCORE_CAP_OVER_MULT;

    return { pillars, total: Math.round(total), cells: cells.length, allThree, triggers };
  }

  /* ---------- 预览: 把若干卡放在最优空位后的总分 ---------- */
  function computePreview(state, uids) {
    const cards = uids.map((u) => state.hand.find((c) => c.uid === u)).filter(Boolean);
    if (cards.length === 0) return evalBoard(state);
    // 贪心: 逐张放入使其边际增益最大的空位
    const tmp = state.hand;
    let total = evalBoard(state).total;
    const saved = cards.map((c) => c);
    for (const card of cards) {
      let best = -Infinity, bestRC = null;
      for (let r = 0; r < state.boardH; r++)
        for (let c = 0; c < state.boardW; c++) {
          if (state.board[r][c]) continue;
          state.board[r][c] = card;
          const t = evalBoard(state).total;
          state.board[r][c] = null;
          if (t - total > best) { best = t - total; bestRC = [r, c]; }
        }
      if (bestRC) { state.board[bestRC[0]][bestRC[1]] = card; total += best; }
    }
    // 还原(预览不真正落子)
    for (let r = 0; r < state.boardH; r++)
      for (let c = 0; c < state.boardW; c++)
        if (state.board[r][c] && saved.includes(state.board[r][c])) state.board[r][c] = null;
    return { total: Math.round(total) };
  }

  /* ---------- 易上手辅助: 推荐落点 / 落子解释(只读模拟, 不改变棋盘) ---------- */
  function scoreDeltaForCard(state, card, r, c) {
    const before = evalBoard(state);
    state.board[r][c] = card;
    const after = evalBoard(state);
    state.board[r][c] = null;
    const prev = new Set(before.triggers);
    const triggers = after.triggers.filter((t) => !prev.has(t));
    return { gain: after.total - before.total, triggers };
  }
  function rankPlacements(state, uid, limit) {
    const card = state.hand.find((x) => x.uid === uid);
    if (!card) return [];
    const out = [];
    for (let r = 0; r < state.boardH; r++) {
      for (let c = 0; c < state.boardW; c++) {
        if (state.board[r][c]) continue;
        const d = scoreDeltaForCard(state, card, r, c);
        out.push({ r, c, gain: Math.round(d.gain), triggers: d.triggers.slice(0, 6) });
      }
    }
    out.sort((a, b) => b.gain - a.gain || b.triggers.length - a.triggers.length || a.r - b.r || a.c - b.c);
    return out.slice(0, limit || 3);
  }
  function describePlacements(state, placements) {
    const placed = [];
    let totalGain = 0;
    for (const p of placements) {
      const card = state.hand.find((c) => c.uid === p.uid);
      if (!card || state.board[p.r][p.c]) continue;
      const before = evalBoard(state);
      state.board[p.r][p.c] = card;
      const after = evalBoard(state);
      const prev = new Set(before.triggers);
      const gain = after.total - before.total;
      totalGain += gain;
      placed.push({ uid: p.uid, r: p.r, c: p.c, name: card.name, gain: Math.round(gain), triggers: after.triggers.filter((t) => !prev.has(t)).slice(0, 6) });
    }
    for (const p of placed) state.board[p.r][p.c] = null;
    return { totalGain: Math.round(totalGain), placed };
  }

  /* ---------- 放置(提交) ---------- */
  function applyPlace(state, placements) {
    // placements: [{uid, r, c}]
    if (state.placementsLeft <= 0) return { ok: false, msg: '本关放置次数已用完' };
    if (placements.length < 1 || placements.length > D.PLAY_MAX) return { ok: false, msg: `放置数量需在 1~${D.PLAY_MAX}` };
    // 校验
    for (const p of placements) {
      const card = state.hand.find((c) => c.uid === p.uid);
      if (!card) return { ok: false, msg: '卡不在手牌' };
      if (p.r < 0 || p.r >= state.boardH || p.c < 0 || p.c >= state.boardW) return { ok: false, msg: '坐标越界' };
      if (state.board[p.r][p.c]) return { ok: false, msg: '该格已被占用' };
    }
    const beforeEval = evalBoard(state);
    const beforeTriggers = new Set(beforeEval.triggers || []);
    let added = 0;
    for (const p of placements) {
      const idx = state.hand.findIndex((c) => c.uid === p.uid);
      const card = state.hand[idx];
      state.hand.splice(idx, 1);
      state.board[p.r][p.c] = card;
      state.levelPlaced.push(card.uid); // [v2 P1] 记录本关放置(圣旨重开用)
      const before = state.score;
      const after = evalBoard(state).total;
      added += (after - before);
      state.score = after;
    }
    state.placementsLeft -= placements.length;
    // [v2 P1] 灵感溢出池: 满灵感后溢出存"余烬", 每 EMBER_FREE_COST 点换 1 次免费主动技
    const gained = placements.length * D.INSP_PER_PLACE;
    const overflow = Math.max(0, state.inspiration + gained - D.INSP_CAP);
    if (overflow > 0) { state.ember += overflow; log(state, `灵感溢出 +${overflow} 余烬(共${state.ember})`); }
    state.inspiration = Math.min(D.INSP_CAP, state.inspiration + gained);
    const afterEval = evalBoard(state);
    const newTriggers = (afterEval.triggers || []).filter((t) => !beforeTriggers.has(t));
    const heatGain = Math.max(1, placements.length + Math.min(7, new Set(newTriggers).size) + Math.floor(Math.max(0, added) / 45));
    const heat = awardHeat(state, heatGain);
    drawTo(state, D.HAND_SIZE);
    log(state, `营造 +${Math.round(added)} · 气势 +${heatGain} (本盘 ${state.score})`);
    const win = checkWin(state);
    return { ok: true, score: Math.round(added), win, heat, triggers: newTriggers.slice(0, 8) };
  }

  /* ---------- 弃牌(手牌) ---------- */
  function applyDiscard(state, indices) {
    if (state.discardsLeft <= 0) return { ok: false, msg: '弃牌次数已用完' };
    if (indices.length < 1 || indices.length > D.DISCARD_MAX) return { ok: false, msg: `弃牌数量需在 1~${D.DISCARD_MAX}` };
    const cards = indices.map((i) => state.hand[i]).filter(Boolean);
    cards.forEach((c) => {
      const idx = state.hand.indexOf(c);
      if (idx >= 0) state.hand.splice(idx, 1);
      state.discard.push(c);
    });
    state.discardsLeft -= 1;
    drawTo(state, D.HAND_SIZE);
    return { ok: true };
  }

  /* ---------- 主动技(营造物) ---------- */
  function activateJoker(state, uid) {
    const card = state.board.flat().find((c) => c && c.uid === uid && c.active);
    if (!card) return { ok: false, msg: '无此主动营造物' };
    // [v2 P1] 余烬兜底: 灵感不足时每 EMBER_FREE_COST 点余烬换 1 次免费施展
    if (state.inspiration < card.cost) {
      if (state.ember >= D.EMBER_FREE_COST) { state.ember -= D.EMBER_FREE_COST; log(state, `余烬×${D.EMBER_FREE_COST} 免费施展`); }
      else return { ok: false, msg: '灵感不足(余烬也不够)' };
    } else state.inspiration -= card.cost;
    switch (card.effect) {
      case 'guanxing': state.pending.levelScoreMult = Math.max(state.pending.levelScoreMult, 1.5); state.pending.wildAdj = true; break;
      case 'luban': state.placementsLeft += 1; break;
      case 'qutang': state.pending.levelScoreMult = Math.max(state.pending.levelScoreMult, 2); break;
      case 'qinghui': state.pending.ignoreKe = true; break;
    }
    if (hasArtifact(state, 'luban_manual')) state.inspiration = Math.min(D.INSP_CAP, state.inspiration + 1);
    state.score = evalBoard(state).total; // 重算(乘率生效)
    log(state, '施展: ' + card.name);
    return { ok: true };
  }

  /* ---------- 拆建 / 迁建 [v2 P1]: 把"放置次数"与"城盘容量"解绑 ---------- */
  // 拆建: L7 解锁, 花费 3+2×已拆数, 拆下的卡回抽牌循环(下一轮可能再上手), 返还灵感。
  function demolishBuilding(state, r, c) {
    if (state.level < D.DEMOLISH_UNLOCK) return { ok: false, msg: '第' + D.DEMOLISH_UNLOCK + '关解锁拆建' };
    if (r < 0 || r >= state.boardH || c < 0 || c >= state.boardW || !state.board[r][c]) return { ok: false, msg: '该格无建筑' };
    const cost = D.DEMOLISH_BASE + state.demolishCount * D.DEMOLISH_STEP;
    if (state.coins < cost) return { ok: false, msg: `金币不足(需 ${cost})` };
    const card = state.board[r][c];
    state.board[r][c] = null;
    state.coins -= cost;
    state.demolishCount += 1;
    // 返还灵感(半张向上取整); 拆下的卡回弃牌堆(不永久移除, 保留构筑)
    state.inspiration = Math.min(D.INSP_CAP, state.inspiration + D.DEMOLISH_INSP);
    state.discard.push(card);
    const old = state.score;
    state.score = evalBoard(state).total;
    drawTo(state, D.HAND_SIZE);
    log(state, `拆建 ${card.name} -${cost}金 (分 ${old}→${state.score})`);
    return { ok: true, cost, card };
  }

  // 迁建: L13 解锁, 2 金移动一格, 每关限 1 次。
  function moveBuilding(state, fr, fc, tr, tc) {
    if (state.level < D.MOVE_UNLOCK) return { ok: false, msg: '第' + D.MOVE_UNLOCK + '关解锁迁建' };
    if (state.movesLeft <= 0) return { ok: false, msg: '本关迁建次数已用完' };
    if (fr < 0 || fr >= state.boardH || fc < 0 || fc >= state.boardW || !state.board[fr][fc]) return { ok: false, msg: '源格无建筑' };
    if (tr < 0 || tr >= state.boardH || tc < 0 || tc >= state.boardW) return { ok: false, msg: '目标格越界' };
    if (state.board[tr][tc]) return { ok: false, msg: '目标格已被占用' };
    if (state.coins < D.MOVE_COST) return { ok: false, msg: `金币不足(需 ${D.MOVE_COST})` };
    const card = state.board[fr][fc];
    state.board[tr][tc] = card; state.board[fr][fc] = null;
    state.coins -= D.MOVE_COST;
    state.movesLeft -= 1;
    const old = state.score;
    state.score = evalBoard(state).total;
    log(state, `迁建 ${card.name} (${fr},${fc})→(${tr},${tc}) -${D.MOVE_COST}金 (分 ${old}→${state.score})`);
    return { ok: true, cost: D.MOVE_COST, card };
  }

  /* ---------- 圣旨重开 [v2 P1]: 集齐 SEAL_NEED 枚诏令印记, 重开当前关(保留牌组/金币/城市) ---------- */
  // 移除本关放置的建筑(回弃牌堆), 关数回退后重新 startLevel(score/手牌/放置次数重置, 可再达标再拿奖励)。
  function retryLevel(state) {
    if (state.sealCount < D.SEAL_NEED) return { ok: false, msg: `需要 ${D.SEAL_NEED} 枚印记(现有 ${state.sealCount})` };
    const placed = state.levelPlaced || [];
    for (const uid of placed) {
      outer:
      for (let r = 0; r < state.boardH; r++)
        for (let c = 0; c < state.boardW; c++)
          if (state.board[r][c] && state.board[r][c].uid === uid) { state.discard.push(state.board[r][c]); state.board[r][c] = null; break outer; }
    }
    state.sealCount -= D.SEAL_NEED;
    state.level -= 1;
    startLevel(state);
    log(state, '圣旨重开：回到本关开局');
    return { ok: true };
  }

  /* ---------- 删牌(付费移除牌组, 真 sink) ---------- */
  function removeCard(state, uid) {
    const idx = state.owned.findIndex((c) => c.uid === uid);
    if (idx < 0) return { ok: false, msg: '卡不在牌组' };
    if (state.owned.length <= D.HAND_SIZE) return { ok: false, msg: '牌组过小, 不可再删' };
    const cost = D.REMOVE_BASE + state.removedCount * D.REMOVE_STEP;
    if (state.coins < cost) return { ok: false, msg: `金币不足(需 ${cost})` };
    state.coins -= cost;
    state.removedCount += 1;
    state.owned.splice(idx, 1);
    return { ok: true, cost };
  }

  /* ---------- 营造诏令达成检测(在达标瞬间判定, 影响奖励金币) ---------- */
  function checkEdict(state, ev) {
    const e = state.cfg && state.cfg.edict;
    if (!e) return false;
    if (e.kind === 'pillar') return ev.pillars[e.pillar] >= e.target;
    if (e.kind === 'pairs') {
      let cnt = 0; const b = state.board;
      for (let r = 0; r < state.boardH; r++)
        for (let c = 0; c < state.boardW; c++) {
          const x = b[r][c]; if (!x || x.kind !== e.kindName) continue;
          if (c + 1 < state.boardW && b[r][c + 1] && b[r][c + 1].kind === e.kindName) cnt++;
          if (r + 1 < state.boardH && b[r + 1][c] && b[r + 1][c].kind === e.kindName) cnt++;
        }
      return cnt >= e.need;
    }
    if (e.kind === 'count') {
      let cnt = 0;
      state.board.forEach((row) => row.forEach((x) => { if (x && x.kind === e.kindName) cnt++; }));
      return cnt >= e.need;
    }
    if (e.kind === 'cycle') {
      const elems = new Set();
      state.board.forEach((row) => row.forEach((x) => { if (x) elems.add(x.element); }));
      if (elems.size < 5) return false;
      const pairs = neighborPairs(state).filter((p) => p.orth);
      const has = (a, b) => pairs.some((p) =>
        (p.a.inst.element === a && p.b.inst.element === b) ||
        (p.a.inst.element === b && p.b.inst.element === a));
      return has('木', '火') && has('火', '土') && has('土', '金') && has('金', '水') && has('水', '木');
    }
    if (e.kind === 'fullrow') {
      for (let r = 0; r < state.boardH; r++) {
        let full = true;
        for (let c = 0; c < state.boardW; c++) if (!state.board[r][c]) { full = false; break; }
        if (full) return true;
      }
      for (let c = 0; c < state.boardW; c++) {
        let full = true;
        for (let r = 0; r < state.boardH; r++) if (!state.board[r][c]) { full = false; break; }
        if (full) return true;
      }
      return false;
    }
    return false;
  }

  /* ---------- 胜负 ---------- */
  function checkWin(state) {
    if (state.score >= state.cfg.quota) {
      if (!state.rewarded) {
        const ev = evalBoard(state);
        const edictOk = checkEdict(state, ev);
        let reward = state.cfg.coinTier + state.placementsLeft;
        if (edictOk) { reward += state.cfg.edict.reward + (hasArtifact(state, 'edict_seal') ? 2 : 0); state.edictLog.push(state.cfg.edict.name); }
        const ratio = state.cfg.quota > 0 ? state.score / state.cfg.quota : 1;
        let overkill = { tier: 0, name: '', bonusCoins: 0, extraChoices: 0, ratio: Math.round(ratio * 100) };
        if (ratio >= 1.5) overkill = { tier: 3, name: '营造大成', bonusCoins: 4, extraChoices: 2, ratio: Math.round(ratio * 100) };
        else if (ratio >= 1.25) overkill = { tier: 2, name: '匠心盈城', bonusCoins: 2, extraChoices: 1, ratio: Math.round(ratio * 100) };
        else if (ratio >= 1.1) overkill = { tier: 1, name: '余裕达成', bonusCoins: 1, extraChoices: 1, ratio: Math.round(ratio * 100) };
        if (overkill.bonusCoins) reward += overkill.bonusCoins;
        state.coins += reward;
        state.lastReward = reward;
        state.lastEdict = { satisfied: edictOk, name: state.cfg.edict.name, reward: edictOk ? state.cfg.edict.reward + (hasArtifact(state, 'edict_seal') ? 2 : 0) : 0 };
        state.lastOverkill = overkill;
        if (edictOk) state.sealCount += 1; // [v2 P1] 达成诏令得 1 枚印记
        state.rewarded = true;
      }
      state.won = true;
      return true;
    }
    if (state.placementsLeft <= 0 && state.score < state.cfg.quota) {
      state.over = true;
      return 'lose';
    }
    return false;
  }

  /* ---------- 道具 ---------- */
  function addProp(state, base) {
    if (state.props.length >= D.PROP_SLOTS) return { ok: false, msg: '道具栏已满' };
    state.props.push({ uid: newUid(), base });
    return { ok: true };
  }
  function useProp(state, propUid, opts) {
    opts = opts || {};
    const idx = state.props.findIndex((p) => p.uid === propUid);
    if (idx < 0) return { ok: false, msg: '无此道具' };
    const p = state.props[idx];
    const eff = p.base.effect;
    switch (eff) {
      case 'yuangui': state.coins += 8; break;
      case 'baozi': case 'juzi': case 'zuanzi': {
        if (!opts.uid) return { ok: false, msg: '需选择一张建筑' };
        const c = state.owned.find((x) => x.uid === opts.uid) || state.board.flat().find((x) => x && x.uid === opts.uid);
        if (!c) return { ok: false, msg: '建筑不在牌组/盘上' };
        if (eff === 'baozi') c.value += 6;
        if (eff === 'juzi') c.value += 5;
        if (eff === 'zuanzi') c.value += 4;
        break;
      }
      case 'chuizi': state.owned.forEach((c) => { if (c.pillar === '民生') c.value += 4; }); break;
      case 'benzi': state.owned.forEach((c) => { if (c.pillar === '经济') c.value += 3; }); break;
      case 'cuodao': state.owned.forEach((c) => { if (c.pillar === '治安') c.value += 2; }); break;
      case 'modou': {
        if (!opts.uid) return { ok: false, msg: '需选择一张营造物' };
        const src = state.board.flat().find((x) => x && x.uid === opts.uid && x.type === 'special');
        if (!src) return { ok: false, msg: '营造物不在盘上' };
        state.owned.push(makeInstance(src));
        break;
      }
      case 'hualun': state.placementsLeft += 1; break;
      case 'yingzao': state.pending.levelScoreMult *= 1.25; state.score = evalBoard(state).total; break;
    }
    state.props.splice(idx, 1);
    log(state, '使用道具: ' + p.base.name);
    return { ok: true };
  }

  /* ---------- 商店 ---------- */
  function rollProp(rng) {
    const r = rng();
    let acc = 0;
    for (const p of D.PROPS) { acc += p.prob; if (r <= acc) return p; }
    return D.PROPS[D.PROPS.length - 1];
  }
  function openShop(state) {
    state.rerollCost = 2;
    const props = [];
    for (let i = 0; i < 3; i++) props.push(rollProp(state.rng));
    state.shop = { props, locked: [], upgraded: false };
    return state.shop;
  }
  function rerollShop(state) {
    if (state.coins < state.rerollCost) return { ok: false, msg: '金币不足' };
    state.coins -= state.rerollCost;
    state.rerollCost += 1;
    state.shop.props = state.shop.props.map((p, i) => state.shop.locked.includes(i) ? p : rollProp(state.rng));
    return { ok: true };
  }
  function buyProp(state, idx) {
    const p = state.shop.props[idx];
    if (!p) return { ok: false, msg: '无此道具' };
    if (state.coins < p.cost) return { ok: false, msg: '金币不足' };
    if (state.props.length >= D.PROP_SLOTS) return { ok: false, msg: '道具栏已满' };
    state.coins -= p.cost;
    state.props.push({ uid: newUid(), base: p });
    state.shop.props[idx] = null;
    return { ok: true };
  }
  function lockShopItem(state, idx) {
    if (state.shop.locked.includes(idx)) return { ok: false, msg: '已锁定' };
    const cost = 2 + state.shop.locked.length * 2;
    if (state.coins < cost) return { ok: false, msg: '锁定金币不足' };
    state.coins -= cost;
    state.shop.locked.push(idx);
    return { ok: true };
  }

  function charterLikes(state) {
    const ch = state.charter && charterById(state.charter.id);
    return (ch && ch.likes) || {};
  }
  function affinityScore(state, base) {
    const likes = charterLikes(state);
    let w = 1;
    if (likes.kinds && likes.kinds.includes(base.kind)) w += 4;
    if (likes.pillars && likes.pillars.includes(base.pillar)) w += 3;
    if (likes.elements && likes.elements.includes(base.element)) w += 1;
    if (base.type === 'special' && likes.effects && likes.effects.includes(base.effect)) w += 7;
    if (base.archetype && state.charter && base.archetype.includes(state.charter.id)) w += 2;
    const ownedNames = new Set(state.owned.map((c) => c.name));
    if (!ownedNames.has(base.name)) w += 2;
    return Math.max(1, w);
  }
  function weightedChoices(state, pool, n) {
    const out = [];
    const rest = pool.slice();
    while (out.length < n && rest.length) {
      const total = rest.reduce((s, c) => s + affinityScore(state, c), 0);
      let r = state.rng() * total;
      let pick = 0;
      for (; pick < rest.length; pick++) {
        r -= affinityScore(state, rest[pick]);
        if (r <= 0) break;
      }
      out.push(rest.splice(Math.min(pick, rest.length - 1), 1)[0]);
    }
    return out;
  }

  /* ---------- [v3] 过关奖励三选一: 杀戮尖塔式"每关选卡"节奏 ---------- */
  function rollRewardCandidates(state, count) {
    count = count || 3;
    const specialChance = Math.min(0.18 + state.level * 0.018, 0.52);
    let pool;
    if (state.rng() < specialChance) {
      const r = state.rng();
      const rarity = state.level >= 15 && r > 0.88 ? '红' : state.level >= 7 && r > 0.58 ? '紫' : '黄';
      pool = D.specialCards.filter((c) => c.rarity === rarity);
    } else {
      pool = D.normalCards;
    }
    return weightedChoices(state, pool, count).map((c) => makeInstance(c));
  }
  function acceptReward(state, inst) {
    state.owned.push(inst); // 候选实例即入牌组实例(uid 一致, 右键可查)
    return { ok: true };
  }
  function skipReward(state) {
    state.coins += D.SKIP_REWARD;
    log(state, `跳过选卡 +${D.SKIP_REWARD}金`);
    return { ok: true, coins: D.SKIP_REWARD };
  }
function rollPackCandidates(state, type) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      if (type === 'focus') {
        const pool = state.rng() < 0.68 ? D.normalCards : D.specialCards;
        out.push(makeInstance(weightedChoices(state, pool, 1)[0]));
      }
      else if (type === 'normal') out.push(makeInstance(weightedChoices(state, D.normalCards, 1)[0]));
      else if (type === 'mixed') {
        const r = state.rng(), pr = D.PACK_PROB.mixed;
        if (r < pr.normal) out.push(makeInstance(weightedChoices(state, D.normalCards, 1)[0]));
        else if (r < pr.normal + pr.yellow) out.push(makeInstance(pickSpecial(state, '黄')));
        else if (r < pr.normal + pr.yellow + pr.purple) out.push(makeInstance(pickSpecial(state, '紫')));
        else out.push(makeInstance(pickSpecial(state, '红')));
      } else {
        const r = state.rng(), pr = D.PACK_PROB.special;
        if (r < pr.yellow) out.push(makeInstance(pickSpecial(state, '黄')));
        else if (r < pr.yellow + pr.purple) out.push(makeInstance(pickSpecial(state, '紫')));
        else out.push(makeInstance(pickSpecial(state, '红')));
      }
    }
    return out;
  }
  function openPack(state, type) {
    const cost = D.PACK_COST[type];
    if (cost == null) return { ok: false, msg: '无此营造匣' };
    if (state.coins < cost) return { ok: false, msg: '金币不足' };
    state.coins -= cost;
    return { ok: true, cost, candidates: rollPackCandidates(state, type) };
  }
  function acceptPackCard(state, inst) {
    state.owned.push(inst);
    return { ok: true };
  }
  function pickSpecial(state, rarity) {
    // [v2 P1] 流派成型奖励: 已成型流派的 core 营造物出现率 ×3(定向构筑, 解决"抽到什么玩什么")
    const done = new Set();
    (D.ARCHETYPES || []).forEach((a) => { if (archetypeDone(state, a)) a.core.forEach((e) => done.add(e)); });
    const pool = D.specialCards.filter((c) => c.rarity === rarity);
    const weighted = [];
    pool.forEach((c) => {
      const w = (done.has(c.effect) ? 3 : 1) + affinityScore(state, c);
      for (let i = 0; i < w; i++) weighted.push(c);
    });
    return weighted[Math.floor(state.rng() * weighted.length)];
  }

  function rollArtifactChoices(state) {
    const owned = new Set((state.artifacts || []).map((a) => a.id));
    const chId = state.charter && state.charter.id;
    const pool = (D.ARTIFACTS || []).filter((a) => !owned.has(a.id));
    const weighted = [];
    pool.forEach((a) => {
      let w = 1;
      if (a.charter === chId) w += 6;
      if (a.charter === 'any') w += 2;
      if (a.rarity === '红') w += state.level >= 12 ? 1 : 0;
      for (let i = 0; i < w; i++) weighted.push(a);
    });
    return shuffle(weighted.length ? weighted : pool, state.rng).filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i).slice(0, 3).map((a) => Object.assign({}, a));
  }
  function acceptArtifact(state, artifact) {
    if (!artifact || !artifact.id) return { ok: false, msg: '无此遗珍' };
    if ((state.artifacts || []).some((a) => a.id === artifact.id)) return { ok: false, msg: '已拥有该遗珍' };
    state.artifacts.push(Object.assign({}, artifact));
    log(state, '获得遗珍: ' + artifact.name);
    state.score = evalBoard(state).total;
    return { ok: true };
  }

  function upgradeCost(state) { return 3 + Math.floor(state.level / 3) + state.upgradeCount; }
  function upgradeCard(state, uid) {
    if (!state.shop) return { ok: false, msg: '当前不在匠作铺' };
    if (state.shop.upgraded) return { ok: false, msg: '本次匠作铺已精修过' };
    const c = state.owned.find((x) => x.uid === uid);
    if (!c) return { ok: false, msg: '卡不在牌组' };
    const cost = upgradeCost(state);
    if (state.coins < cost) return { ok: false, msg: `金币不足(需 ${cost})` };
    const inc = Math.max(3, Math.ceil(c.value * (c.type === 'special' ? 0.14 : 0.18)));
    state.coins -= cost;
    state.upgradeCount += 1;
    state.shop.upgraded = true;
    c.value += inc;
    c.upgrades = (c.upgrades || 0) + 1;
    state.score = evalBoard(state).total;
    log(state, `精修 ${c.name} +${inc}`);
    return { ok: true, cost, inc, card: c };
  }
  function buyPack(state, type, base) {
    const cost = D.PACK_COST[type];
    if (state.coins < cost) return { ok: false, msg: '金币不足' };
    state.coins -= cost;
    state.owned.push(makeInstance(base));
    return { ok: true };
  }

  /* ---------- 定性预览: 把某卡放某格会触发哪些机制(不返回数字) ---------- */
  function previewTriggers(state, uid, r, c) {
    const card = state.hand.find((x) => x.uid === uid);
    if (!card) return [];
    if (r < 0 || r >= state.boardH || c < 0 || c >= state.boardW) return [];
    if (state.board[r][c]) return [];           // 该格已占用
    const before = evalBoard(state).triggers;   // 当前盘触发
    state.board[r][c] = card;
    const after = evalBoard(state).triggers;    // 临时的盘触发
    state.board[r][c] = null;                   // 还原(预览不落子)
    // 返回新增的触发(差集), 去重
    const set = new Set(before);
    return after.filter((t) => !set.has(t));
  }

  /* ---------- 流派成型状态: 供 UI 显示 ---------- */
  function getArchetypeStatus(state) {
    if (!D.ARCHETYPES) return [];
    const out = [];
    for (const a of D.ARCHETYPES) {
      if (archetypeDone(state, a)) { out.push({ id: a.id, name: a.name, color: a.color, status: 'done', stamp: a.stamp }); continue; }
      const allCards = state.owned.concat(state.board.flat().filter(Boolean));
      const hasCore = allCards.some((c) => c.type === 'special' && a.core.includes(c.effect));
      if (!hasCore) continue;                   // 未持有核心营造物 → 不显示
      const count = state.owned.filter((c) => a.match(c)).length;
      out.push({ id: a.id, name: a.name, color: a.color, status: 'building', need: a.need - count });
    }
    return out;
  }

  function log(state, msg) { state.log.push(msg); if (state.log.length > 60) state.log.shift(); }

  const Engine = {
    createGame, chooseCharter, startLevel, drawTo, evalBoard, computePreview, previewTriggers, rankPlacements, describePlacements, getArchetypeStatus,
    applyPlace, applyDiscard,
    activateJoker, removeCard, checkWin, addProp, useProp,
    demolishBuilding, moveBuilding, retryLevel, archetypeDone,
    openShop, rerollShop, buyProp, lockShopItem,
    rollPackCandidates, openPack, acceptPackCard, buyPack, rollRewardCandidates, acceptReward, skipReward,
    rollArtifactChoices, acceptArtifact, upgradeCard, upgradeCost,
    makeInstance, shuffle, mulberry32, checkEdict, D,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  if (root) root.Engine = Engine;
})(typeof window !== 'undefined' ? window : null);
