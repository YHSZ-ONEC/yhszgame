/* =====================================================================
 * data.js — 《营造司》v1.5 城市营造盘 静态数据层
 * 建筑(普通)/营造物(紫红,带区域技能)/道具/五行表/邻接表/关卡曲线
 * 所有未验证数值标 [PLACEHOLDER], 待 playtest 调。
 * 同时支持浏览器(window.GAME_DATA)与 node(module.exports)。
 * ===================================================================== */

(function (root) {
  'use strict';

  const ELEMENTS = ['金', '木', '水', '火', '土'];
  // 五行相生: 木→火→土→金→水→木
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  // 五行相克(写成 "a克b" 的两字串, 仅 5 条单向, 与规则弹窗克链一致)
  // 木克土·土克水·水克火·火克金·金克木
  const KE = new Set(['木土', '土水', '水火', '火金', '金木']);

  // 化解相克的种类(放置这类建筑可中和相邻相克惩罚)
  const RESOLVE_KINDS = ['园林', '礼制'];

  /* ---------- 地势(棋盘格地形): 直接扩展方格, 落子契合地形得乘率 ---------- */
  // mult: 该地形对 kinds 内建筑的基础值乘率; 非匹配建筑落在地形上无加成也无惩罚。
  // 显示: icon 角标 + 底色; 生成概率随关卡缓升(见 engine.expandTerrain)。
  const TERRAIN = {
    plain:  { name: '空地', icon: '',   kinds: [],                       mult: 1 },
    marsh:  { name: '水泽', icon: '🌊', kinds: ['水利', '园林'],          mult: 1.3 },
    hill:   { name: '山地', icon: '⛰️', kinds: ['防御', '衙门', '礼制'], mult: 1.3 },
    fertile:{ name: '沃壤', icon: '🌾', kinds: ['民居'],                 mult: 1.3 },
    road:   { name: '通衢', icon: '🛣️', kinds: ['市集', '道路'],         mult: 1.3 },
  };

  /* ---------- 营造诏令(每关独特目标, 达标额外赏金): 让 24 关不雷同 ---------- */
  // kind: pillar(某栏≥target) / pairs(相邻同类≥need 对) / count(盘上同类≥need 座)
  //       / cycle(五行相生闭环) / fullrow(某行或列全满)
  // frac: pillar 类目标 = round(quota*frac); reward: 达标额外金币
  const EDICTS = {
    min_sheng: { id: 'min_sheng', name: '安民诏', kind: 'pillar', pillar: '民生', frac: 0.34, reward: 2, desc: '民生栏达 {X}' },
    jing_ji:   { id: 'jing_ji',   name: '理财诏', kind: 'pillar', pillar: '经济', frac: 0.38, reward: 2, desc: '经济栏达 {X}' },
    zhi_an:    { id: 'zhi_an',    name: '靖边诏', kind: 'pillar', pillar: '治安', frac: 0.40, reward: 2, desc: '治安栏达 {X}' },
    li_zhi:    { id: 'li_zhi',    name: '礼制诏', kind: 'pairs',  kindName: '礼制', need: 2, reward: 3, desc: '相邻礼制建筑 ≥ 2 对' },
    shui_li:   { id: 'shui_li',   name: '水利诏', kind: 'count',  kindName: '水利', need: 3, reward: 3, desc: '盘上 ≥ 3 座水利' },
    man_fang:  { id: 'man_fang',  name: '营坊诏', kind: 'fullrow',                                  reward: 3, desc: '存在一行或一列铺满' },
    huan_sheng:{ id: 'huan_sheng',name: '环生诏', kind: 'cycle',                                   reward: 4, desc: '五行相生闭环(五色俱全成链)' },
  };
  // 逐关诏令(显式、可微调): 早期简单(pillar), 中期 pairs/count/fullrow, 后期 cycle
  const EDICT_BY_LEVEL = [
    'min_sheng', 'jing_ji', 'zhi_an', 'min_sheng', 'shui_li', 'li_zhi',
    'jing_ji', 'man_fang', 'zhi_an', 'shui_li', 'min_sheng', 'li_zhi',
    'man_fang', 'jing_ji', 'shui_li', 'zhi_an', 'li_zhi', 'man_fang',
    'min_sheng', 'shui_li', 'huan_sheng', 'li_zhi', 'man_fang', 'huan_sheng',
  ];

  /* ---------- 灾异关隘(v2 P1): 每 3 关的关隘=Boss 仪式化, 机制突变而非数值跃升 ---------- */
  // pillarMult: 该栏 ×系数; marshBoost: 本关水泽生成概率 ×系数; waterDead: 水利不触发资源链路
  // L3/6/9/12 固定单一灾异; L15/18/21/24 复合灾异(从 COMPOUND_CATA 确定性轮换, 不引入随机, 便于测试复现)
  const CATASTROPHES = {
    flood:  { id: 'flood',  name: '洪涝', icon: '🌊', pillarMult: { 民生: 0.9 }, marshBoost: 1.5, desc: '水泽格增多，民生栏 ×0.9' },
    bandit: { id: 'bandit', name: '流寇', icon: '⚔️', pillarMult: { 治安: 0.85 }, desc: '治安栏 ×0.85' },
    drought:{ id: 'drought',name: '大旱', icon: '☀️', waterDead: true, desc: '水利建筑不触发资源链路' },
    route:  { id: 'route',  name: '商路中断', icon: '🚧', pillarMult: { 经济: 0.85 }, desc: '经济栏 ×0.85' },
  };
  const CATA_BY_LEVEL = [null, null, 'flood', null, null, 'bandit', null, null, 'drought', null, null, 'route'];
  // 复合灾异(确定性轮换): 每项 = [cat1, cat2]
  const COMPOUND_CATA = [
    ['flood', 'bandit'], ['drought', 'route'], ['bandit', 'drought'], ['flood', 'route'],
  ];
  function catastropheForLevel(level) {
    if (level % 3 !== 0) return null;                 // 仅关隘触发
    if (level <= 12) {
      const c = CATA_BY_LEVEL[level - 1];
      return c ? CATASTROPHES[c] : null;
    }
    // L15+ 复合灾异(轮换)
    const pair = COMPOUND_CATA[Math.floor((level - 15) / 3) % COMPOUND_CATA.length];
    return { id: 'compound', name: pair.map((c) => CATASTROPHES[c].name).join('+'), icon: '⛈️',
             parts: pair.map((c) => CATASTROPHES[c]),
             desc: pair.map((c) => CATASTROPHES[c].desc).join('；') };
  }

  /* ---------- 普通建筑: 30 张, 6 类, 带五行+栏+值 ---------- */
  // B(name, kind, pillar, value, element, desc)
  function B(name, kind, pillar, value, element, desc) {
    return { name, kind, pillar, value, element, desc, type: 'normal', rarity: '白' };
  }

  const normalCards = [
    // 民居(民生) ×8 — 白卡基准: 28~34, 均值≈30.4
    B('客家土楼', '民居', '民生', 30, '土', '闽粤赣山区巨型夯土围楼，御匪聚族。'),
    B('北京四合院', '民居', '民生', 30, '木', '中轴对称、北房为尊，帝都礼制微缩。'),
    B('湘西吊脚楼', '民居', '民生', 30, '木', '依山临水、木柱撑楼，人与自然共生。'),
    B('陕北窑洞', '民居', '民生', 30, '土', '黄土崖壁掘洞为室，冬暖夏凉。'),
    B('山西大院', '民居', '民生', 32, '金', '晋商深宅，高墙套院，富而不露。'),
    B('徽派民居', '民居', '民生', 30, '水', '马头墙、天井、三雕，耕读传家。'),
    B('广府镬耳屋', '民居', '民生', 28, '木', '山墙高耸如官帽，"耳高官显"。'),
    B('藏族碉房', '民居', '民生', 34, '金', '片石垒墙、平顶晒场，高原依靠。'),

    // 市集(经济) ×6 — 白卡基准: 22~26, 均值≈23
    B('钱局', '市集', '经济', 22, '金', '各省宝×局铸制钱，经济血脉。'),
    B('市舶司', '市集', '经济', 26, '水', '掌海外贸易，通蕃舶之利。'),
    B('票号', '市集', '经济', 26, '金', '汇通天下，晋商金融创举。'),
    B('草市', '市集', '经济', 22, '木', '乡野自发集市，日中为市。'),
    B('瓦市', '市集', '经济', 24, '火', '宋时勾栏瓦舍，百艺骈集。'),
    B('榷场', '市集', '经济', 24, '土', '边境互市，茶马帛盐交汇。'),

    // 衙门(治安) ×6 — 白卡基准: 18~22, 均值≈19.3
    B('衙门', '衙门', '治安', 20, '土', '州县官署，天下治乱之本。'),
    B('警巡院', '衙门', '治安', 20, '金', '城市治安机构，夜巡晨鼓。'),
    B('巡检司', '衙门', '治安', 20, '水', '关津要隘巡检，诘奸弭盗。'),
    B('关隘', '衙门', '治安', 22, '金', '锁钥之地，一夫当关。'),
    B('烽燧', '衙门', '治安', 18, '火', '烽烟告警，军情迅捷。'),
    B('逻城', '衙门', '治安', 18, '土', '外城卫所，拱卫腹心。'),

    // 园林(民生,兼化解) ×4 — 白卡基准: 26~30
    B('私园', '园林', '民生', 28, '木', '文人写意山水，咫尺乾坤。'),
    B('寺观园林', '园林', '民生', 28, '木', '禅境与园景合一，清修之所。'),
    B('公共园林', '园林', '民生', 26, '水', '郡圃衙园，与民同乐。'),
    B('皇家苑囿', '园林', '民生', 30, '土', '离宫别苑，四海献瑞。'),

    // 水利(经济) ×3 — 白卡基准: 22~26
    B('坎儿井', '水利', '经济', 22, '水', '吐鲁番引潜流百里，荒漠成绿洲。'),
    B('它山堰', '水利', '经济', 24, '水', '唐重力滚水坝，泽被二十万亩。'),
    B('白起渠', '水利', '经济', 26, '水', '战国军转民，最古灌溉渠。'),

    // 道路(经济) ×3 — 白卡基准: 18~22
    B('驰道', '道路', '经济', 22, '土', '秦直道通衢，车同轨。'),
    B('驿道', '道路', '经济', 18, '金', '九州驿传，政令朝发夕至。'),
    B('栈道', '道路', '经济', 20, '木', '缘崖架木，天险通途。'),
  ];

  /* ---------- 营造物(黄/紫/红): placement 区域技能 / 主动技 ---------- */
  // S(name, kind, pillar, value, element, rarity, effect, skill, active?, cost?)
  // 普通建筑也能带 effect(弱被动), 营造物多为强效果。
  function S(name, kind, pillar, value, element, rarity, effect, skill, active, cost) {
    return {
      name, kind, pillar, value, element, rarity,
      type: 'special', effect: effect || null, skill: skill || '',
      active: !!active, cost: cost || 0,
    };
  }

  /* ---------- 圜丘(v2 P1): 地形大师黄卡, 让后期盘满时地形仍有决策价值 ---------- */
  // 同地形契合建筑 ≥3 座时, 所有契合建筑基础值 ×1.1(固定乘率, 不随数量爆炸)
  const YUANQIU = S('圜丘', '礼制', '治安', 26, '土', '黄', 'yuanqiu',
    '同地形契合建筑 ≥3 座时，所有契合建筑基础值 ×1.1。', false);

  const specialCards = [
    YUANQIU,
    /* ================================================================
     * 黄 (Uncommon): 基础值 ≥ 同栏白卡均值
     * 设计理由: 黄卡有 build-around 被动效果, 需要投资同类别建筑才能兑现,
     *           所以基础值不能低于白卡, 否则抽到黄卡=惩罚而非奖励。
     * 民生黄 ≥ 30(白均30.4), 经济黄 ≥ 24(白均23), 治安黄 ≥ 20(白均19.3)
     * ================================================================ */
    S('西安城墙', '防御', '治安', 26, '土', '黄', 'xian_wall',
      '本盘每有 1 座防御类建筑，治安 +4。', false),
    S('洛阳桥', '道路', '经济', 28, '水', '黄', 'luoyang_qiao',
      '本盘每有 1 座道路，经济 +4。', false),
    S('个园', '园林', '民生', 34, '木', '黄', 'ge_yuan',
      '本盘每有 1 座园林，民生 +5。', false),
    S('留园', '园林', '民生', 34, '水', '黄', 'liu_yuan',
      '本盘相邻两座园林，额外 民生 +8。', false),
    S('古莲花池', '园林', '民生', 32, '水', '黄', 'lianhua',
      '本盘每座水属性建筑，民生 +3。', false),
    S('恭王府', '礼制', '治安', 24, '木', '黄', 'gong_wang',
      '本盘每有 1 座礼制建筑，治安 +6。', false),

    /* ================================================================
     * 紫 (Rare): 强被动 / 主动技, 基础值 > 黄卡
     * 主动技卡可略低(灵感成本已是对价), 但仍不低于同栏白卡均值
     * ================================================================ */
    // 紫被动: 强力区域效果
    S('赵州桥', '道路', '经济', 32, '水', '紫', 'zhaozhou',
      '本盘所有道路，经济 +10。', false),
    S('承德避暑山庄', '园林', '民生', 38, '土', '紫', 'chengde',
      '本盘每有 1 座园林，全部民生建筑 +8。', false),
    S('山海关', '防御', '治安', 32, '金', '紫', 'shanhai',
      '本盘金/土元素建筑 ≥3 座时，治安 +30。', false),
    S('都江堰', '水利', '经济', 34, '水', '紫', 'dujiangyan',
      '本盘水属性建筑经济 ×1.5。', false),
    S('颐和园', '园林', '民生', 38, '水', '紫', 'yihe',
      '本盘民生类建筑民生 ×1.3。', false),
    S('含嘉仓', '仓储', '经济', 28, '土', '紫', 'hanjiacang',
      '本盘三栏均有建筑时，总分 ×1.25。', false),
    // 紫主动: 灵感成本是对价, 基础值≈同栏白均
    S('观星台', '礼制', '治安', 24, '金', '紫', 'guanxing',
      '主动(灵感2): 本回合任意两格视为相邻，可触发跨盘连锁。', true, 2),
    S('鲁班锁', '工具', '民生', 24, '木', '紫', 'luban',
      '主动(灵感2): 本关 +1 次放置。', true, 2),
    S('瞿塘烽燧', '防御', '治安', 26, '火', '紫', 'qutang',
      '主动(灵感2): 本回合下一张放置得分 ×2。', true, 2),
    S('清辉园', '园林', '民生', 30, '木', '紫', 'qinghui',
      '主动(灵感1): 本回合放置无视相克惩罚。', true, 1),

    /* ================================================================
     * 红 (Legendary): 极强效果 + 最高基础值
     * ================================================================ */
    S('万里长城', '防御', '治安', 48, '土', '红', 'wanli',
      '本盘所有防御建筑治安 +15；每对相邻防御额外 治安 +10。', false),
    S('大运河', '水利', '经济', 42, '水', '红', 'dayunhe',
      '本盘所有水属性建筑经济 ×1.4，且互相视为相邻成相生链。', false),
  ];

  /* ---------- 道具: 10 个, 无一键通关 ---------- */
  const PROPS = [
    { id: 'p_yuan_gui', name: '圆规', cost: 5, effect: 'yuangui', prob: 0.10, desc: '使用后获得 8 枚金币。' },
    { id: 'p_bao_zi', name: '刨子', cost: 8, effect: 'baozi', prob: 0.15, desc: '选择一张建筑永久 +6 民生值。' },
    { id: 'p_ju_zi', name: '锯子', cost: 8, effect: 'juzi', prob: 0.15, desc: '选择一张建筑永久 +5 经济值。' },
    { id: 'p_zuan_zi', name: '钻子', cost: 8, effect: 'zuanzi', prob: 0.15, desc: '选择一张建筑永久 +4 治安值。' },
    { id: 'p_chui_zi', name: '锤子', cost: 10, effect: 'chuizi', prob: 0.10, desc: '使用后，全部民生建筑 +4 值。' },
    { id: 'p_ben_zi', name: '锛子', cost: 10, effect: 'benzi', prob: 0.10, desc: '使用后，全部经济建筑 +3 值。' },
    { id: 'p_cuo_dao', name: '锉刀', cost: 10, effect: 'cuodao', prob: 0.10, desc: '使用后，全部治安建筑 +2 值。' },
    { id: 'p_mo_dou', name: '墨斗', cost: 18, effect: 'modou', prob: 0.05, desc: '复制盘上一张营造物，加入牌组。' },
    { id: 'p_hua_lun', name: '滑轮组', cost: 5, effect: 'hualun', prob: 0.05, desc: '使用后，本关 +1 次放置。' },
    { id: 'p_ying_zao', name: '营造尺', cost: 6, effect: 'yingzao', prob: 0.05, desc: '使用后，本关首次放置得分 ×1.25。' },
  ];

  /* ---------- 关卡曲线: 24 关, 城盘 3→9 增长(城市持久积累), 配额递增 ---------- */
  // 城盘边长 = min(3 + floor((level-1)/2), 9)
  // 配额曲线 [v1.8 重构]: 基准从"贪心下限×0.80"改为"地形感知 bot 产能"——
  //   原曲线实测(10 种子): 贪心 bot 全通但末关余量仅 1.5%, 而"只看地形的普通玩家"
  //   平均只能到第 6 关(与贪心产能差 13~15%), 曲线对真人零容忍。
  //   推导(无幸存者偏差探针): L1-7 按 terrain min×0.95, L8-12(城盘扩张期)按 terrain avg×0.85,
  //   保新手期宽容; L13+ 按 terrain avg×0.95(策略区, 前 12 关认真玩即可进入)。
  //   实测验收: terrainBot L1-12 全过线, greedyBot 10 种子全通关且末关余量 30%。
  // [v3.2] 重校准: 修复"盘上卡回手"bug 后, 旧曲线基于 bug 版 terrainBot(复制建筑虚高)推导,
  //   真实产能(地形+弃牌+过关奖励+买卡, 10 种子)重推: L1-7 min×0.95, L8-12 avg×0.85, L13+ avg×0.95
  const LEVEL_QUOTA = [72,152,267,339,463,557,713,781,869,1003,1132,1167,1499,1639,1624,1871,2010,2024,2280,2414,2489,2566,2562,2316];
  function boardSize(level) { return Math.min(3 + Math.floor((level - 1) / 2), 9); }
  function getLevelConfig(level) {
    const size = boardSize(level);
    const isBoss = level % 3 === 0;
    const quota = LEVEL_QUOTA[level - 1] || LEVEL_QUOTA[LEVEL_QUOTA.length - 1];
    const coinTier = 2 + Math.floor((level - 1) / 3) + (isBoss ? 1 : 0);
    const edictDef = EDICTS[EDICT_BY_LEVEL[(level - 1) % EDICT_BY_LEVEL.length]];
    const edict = Object.assign({}, edictDef);
    if (edict.kind === 'pillar') edict.target = Math.round(quota * edict.frac);
    // [v2 P1] 放置次数: L7 拆建解锁后普通关 3→4(容量出口成立); 关隘恒 4。
    const placements = (isBoss || level >= 7) ? 4 : 3;
    return { level, size, isBoss, quota, coinTier, edict, maxLevel: 24, placements,
             catastrophe: catastropheForLevel(level) };
  }

  const GAME_DATA = {
    ELEMENTS, SHENG, KE, RESOLVE_KINDS, TERRAIN, EDICTS, EDICT_BY_LEVEL,
    CATASTROPHES, catastropheForLevel,
    normalCards, specialCards,
    PROPS,
    getLevelConfig, boardSize,
    // 计分常量 [v1.8]
    SCORE: {
      CHAIN_PAIR: 6,      // 每对相生相邻 → 被生方栏 +6
      KE_PEN_FRAC: 0.4,   // 相克惩罚 = 被克建筑基础值 ×40%: 白卡被克≈-12, 红卡≈-19, 随卡价值膨胀
      KE_PEN_MIN: 8,      // 相克惩罚下限(低价值卡保护)
      // 设计注: 曾试纯乘法 -8%(整栏)与 clamp(6~40)——都会把"不看相克乱放"的 bot 从 L19 砍到 L10,
      // 对普通玩家过狠; 最终改为与被克卡自身价值挂钩, 惩罚≈相邻加成的 1.5~2 倍, 形成真实取舍。
      RES_LINK: 12,       // 水利&市集同盘 → 经济 +12
      RES_LINK_ADJ: 20,   // 水利与市集相邻 → 经济 +20
      SCORE_CAP_MULT: 5,  // 总分硬上限 = 配额 ×5(防爆炸, 留余量)
      SCORE_CAP_OVER_MULT: 0.5, // 超上限部分按 50% 计入(衰减而非截断, 保留极限 build 的反馈)
      // [v2 P1] 相生链乘率: 五行从加法引擎升级为乘法主轴
      CHAIN_MULT_LEN: 3,  // 连续顺生链 ≥3 座 → 整条链栏值 ×1.25
      CHAIN_MULT: 1.25,
      CHAIN_MULT2_LEN: 5, // 链长 ≥5(五格闭环天然享受) → ×1.5
      CHAIN_MULT2: 1.5,
      // [v2 P1] 坊 9/9 全同栏 → 该栏 ×1.2(坊从加法奖励升级为后期乘率入口)
      WARD9_MULT: 1.2,
      // [v2 P1] 圜丘: 契合建筑 ≥3 座 → 契合基础值 ×1.1
      YUANQIU_FIT_NEED: 3,
      YUANQIU_MULT: 1.1,
    },
    // [v2 P1] 拆建/迁建: 把"放置次数"与"城盘容量"解绑, 后期盘满仍有决策
    DEMOLISH_UNLOCK: 7,   // L7 解锁拆建
    DEMOLISH_BASE: 3,     // 拆建花费 = 3 + 2×已拆数
    DEMOLISH_STEP: 2,
    DEMOLISH_INSP: 1,     // 拆建返还灵感(半张向上取整)
    MOVE_UNLOCK: 13,      // L13 解锁迁建
    MOVE_COST: 2,         // 迁建花费
    MOVES_PER_LEVEL: 1,   // 每关迁建次数
    // [v2 P1] 灵感溢出池: 满灵感后溢出存"余烬", 每 3 点换 1 次免费主动技
    EMBER_FREE_COST: 3,
    // [v2 P1] 诏令印记: 每达成诏令 +1 印记, 集齐 SEAL_NEED 枚可"圣旨重开"当前关
    SEAL_NEED: 3,
    ADJ: {
      // 无序对 "a|b"(已排序) → 栏加成
      // v1.8 精简: 10 条 → 6 条高价值组合(总值 51→54 基本持平), 其余并入五行系统,
      //            降低记忆负担, 让玩家专注 6 个"招牌组合"。
      '衙门|民居': { 治安: 8 },
      '市集|民居': { 民生: 6, 经济: 6 },
      '园林|民居': { 民生: 8 },
      '水利|市集': { 经济: 10 },
      '道路|市集': { 经济: 10 },
      '道路|民居': { 民生: 6 },
    },

  /* ---------- 牌组流派(6 种): 用于构建提示、商店标签、成型检测 ---------- */
  // match(card): 该卡是否属于此流派配套(普通建筑判定)
  // core: 该流派核心营造物的 effect 名(玩家需持有其一才"开流派")
  // need: 成型所需配套建筑数(在牌组内统计)
  // stamp: [v2 P1] 成型后每次 evalBoard 给主栏的额外加分("流派印", 放置即见回报)
  ARCHETYPES: [
    {
      id: 'wuxing', name: '五行环生流', color: '#7d3c98',
      core: ['guanxing'], coreNames: ['观星台'],
      match: (c) => c.type === 'normal' && ELEMENTS.includes(c.element),
      need: 5,
      stamp: { pillar: '治安', n: 2 },
      desc: '靠观星台与五行相生链，把五色建筑摆成闭环，连环加分。',
    },
    {
      id: 'dense', name: '邻接密铺流', color: '#b9770e',
      core: ['hanjiacang'], coreNames: ['含嘉仓'],
      match: (c) => ['衙门', '民居', '市集', '道路', '园林'].includes(c.kind),
      need: 6,
      stamp: { pillar: '经济', n: 2 },
      desc: '靠含嘉仓与大量功能互补建筑填满棋盘，越满总分越高。',
    },
    {
      id: 'hydro', name: '水利商脉流', color: '#2471a3',
      core: ['dujiangyan', 'dayunhe'], coreNames: ['都江堰', '大运河'],
      match: (c) => c.kind === '水利' || c.kind === '市集',
      need: 4,
      stamp: { pillar: '经济', n: 3 },
      desc: '靠都江堰/大运河让水利与市集相邻，经济栏爆炸。',
    },
    {
      id: 'wall', name: '长城铁壁流', color: '#922b21',
      core: ['wanli'], coreNames: ['万里长城'],
      match: (c) => c.type === 'normal' && (c.kind === '防御' || c.kind === '衙门'),
      need: 4,
      stamp: { pillar: '治安', n: 3 },
      desc: '靠万里长城与密集防御建筑，治安栏封顶。',
    },
    {
      id: 'inspire', name: '灵感爆发流', color: '#1e8449',
      core: ['qutang', 'guanxing', 'luban', 'qinghui'], coreNames: ['瞿塘烽燧', '观星台', '鲁班锁', '清辉园'],
      match: (c) => c.type === 'normal',
      need: 4,
      stamp: { pillar: '民生', n: 2 },
      desc: '靠主动技营造物攒灵感，一波放置得分翻倍连锁。',
    },
    {
      id: 'living', name: '民生颐和流', color: '#117a65',
      core: ['yihe', 'chengde'], coreNames: ['颐和园', '承德避暑山庄'],
      match: (c) => c.pillar === '民生',
      need: 5,
      stamp: { pillar: '民生', n: 3 },
      desc: '靠颐和园/承德与民生建筑，民生栏倍率叠到离谱。',
    },
  ],
    HAND_SIZE: 5,
    PLAY_MAX: 3,          // 单回合最多放置数
    DISCARD_MAX: 3,
    DISCARDS_PER_LEVEL: 3,
    PROP_SLOTS: 3,
    JOKER_SLOTS: 6,
    INSP_PER_PLACE: 1,    // 每放置 1 张得 1 灵感
    INSP_CAP: 6,
    PACK_COST: { normal: 2, mixed: 5, special: 10 },
    PACK_PROB: {
      mixed: { normal: 0.55, yellow: 0.3, purple: 0.13, red: 0.02 },
      special: { yellow: 0.5, purple: 0.38, red: 0.12 },
    },
    REMOVE_BASE: 4,       // 删牌/拆建筑基础花费
    REMOVE_STEP: 2,       // 每次删牌后花费 +2
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GAME_DATA;
  if (root) root.GAME_DATA = GAME_DATA;
})(typeof window !== 'undefined' ? window : null);
