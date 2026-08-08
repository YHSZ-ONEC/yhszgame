/* =====================================================================
 * main.js — UI 渲染 / 棋盘交互 / 右键放大 / 营造物主动技 / 商店
 * 严格对接 engine.js 纯逻辑接口, 不在此写规则。
 * ===================================================================== */
(function () {
  'use strict';
  const E = window.Engine;
  const D = E.D;
  const $ = (s) => document.querySelector(s);

  const EL_COLOR = { 金: '#c79a3a', 木: '#3a7d44', 水: '#2b6cb0', 火: '#c0392b', 土: '#8b5a2b' };
  const RAR_COLOR = { 白: '#8a8270', 黄: '#c79a3a', 紫: '#8e44ad', 红: '#c0392b' };
  const PILLAR_COLOR = { 民生: '#3a7d44', 经济: '#c79a3a', 治安: '#b03a2e' };

  let state = null;
  let heldUid = null;           // 拾起待落的手牌
  let pending = [];             // [{uid,r,c}] 待确认落子
  let discardSel = new Set();   // 弃牌模式选中的 uid
  let mode = 'place';           // 'place' | 'discard' | 'demolish' | 'move'
  let moveSel = null;           // 迁建模式选中的源格 {r,c}
  let archNotified = {};        // 已提醒成型的流派 id(每局一次)
  let shopOpen = false;
  let shopView = null;
let rewardView = null;  // [v3] 过关奖励三选一候选
  let propPick = null;

  /* ---------- 工具 ---------- */
  const colorOf = (c) => EL_COLOR[c.element] || '#888';
  const rarColor = (c) => RAR_COLOR[c.rarity] || '#888';
  const instByUid = (uid) => {
    if (state.hand) { const h = state.hand.find((c) => c.uid === uid); if (h) return h; }
    if (state.board) { for (const row of state.board) for (const c of row) if (c && c.uid === uid) return c; }
    if (shopView && shopView.candidates) { const c = shopView.candidates.find((x) => x.uid === uid); if (c) return c; }
if (rewardView && rewardView.candidates) { const c = rewardView.candidates.find((x) => x.uid === uid); if (c) return c; }
    return state.owned.find((c) => c.uid === uid);
  };
  const pointsStr = (c) => {
    const p = []; if (c.pillar === '民生') p.push('民+' + c.value);
    else if (c.pillar === '经济') p.push('经+' + c.value); else p.push('治+' + c.value);
    return p.join(' ');
  };
  const emojiOf = (c) => {
    if (c.type === 'special') return c.kind === '防御' ? '🛡️' : c.kind === '园林' ? '🌿' : c.kind === '水利' ? '💧' : c.kind === '道路' ? '🛣️' : c.kind === '礼制' ? '⚜️' : c.kind === '仓储' ? '🏺' : '🏛️';
    return c.pillar === '民生' ? '🏯' : c.pillar === '经济' ? '💰' : '🏛️';
  };
  const kindLabel = (c) => c.type === 'special' ? (c.kind + (c.active ? '·主动' : '')) : c.kind;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1700);
  }

  /* ---------- 音效反馈(§12): 懒加载 AudioContext, 落子/达标/失败短音 ---------- */
  let audioCtx = null;
  let audioOn = true;
  function sfx(type) {
    if (!audioOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const now = audioCtx.currentTime;
      let freq = 440, dur = 0.12;
      if (type === 'place') { freq = 520; dur = 0.10; }
      else if (type === 'win') { freq = 680; dur = 0.24; }
      else if (type === 'lose') { freq = 180; dur = 0.32; }
      o.type = 'sine'; o.frequency.value = freq;
      const vol = 0.06; // 低音量, 不打扰
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(now); o.stop(now + dur);
    } catch (e) { /* 音频不可用时静默降级 */ }
  }

  /* ---------- 卡牌 HTML ---------- */
  function cardHTML(c, opts) {
    opts = opts || {};
    const ec = colorOf(c), rc = rarColor(c);
    const cls = 'card' + (heldUid === c.uid ? ' held' : '') + (discardSel.has(c.uid) ? ' sel' : '') + (opts.clickable ? ' pack-card' : '');
    const arch = (c.archetype && c.archetype.length) ? c.archetype.map((id) => {
      const a = D.ARCHETYPES.find((x) => x.id === id);
      return `<span class="arch-tag" style="background:${a.color}">${a.name.slice(0, 2)}</span>`;
    }).join('') : '';
    return `<div class="${cls}" data-uid="${c.uid}" style="--ec:${ec}">
      <div class="el" style="background:${ec}">${c.element}</div>
      <div class="rar" style="color:${rc}">${c.rarity}</div>
      <div class="img" style="background:${ec}1f">${emojiOf(c)}</div>
      <div class="nm">${c.name}</div>
      <div class="pt">${pointsStr(c)}</div>
      <div class="tp">${kindLabel(c)}</div>
      ${arch ? `<div class="arch">${arch}</div>` : ''}
    </div>`;
  }
  function miniHTML(c) {
    const ec = colorOf(c);
    return `<div class="mini" data-uid="${c.uid}" style="background:${ec}22">
      <div class="el" style="background:${ec}">${c.element}</div>
      <div class="rar" style="color:${rarColor(c)}">${c.rarity}</div>
      <div class="v" style="color:${PILLAR_COLOR[c.pillar]}">${c.value}</div>
      <div>${c.name.slice(0, 4)}</div>
    </div>`;
  }

  /* ===================================================================
   * 渲染
   * =================================================================== */
  function render() {
    if (!state) return;
    renderCataBar(); renderHud(); renderArche(); renderEdict(); renderBoard(); renderSide(); renderHand(); renderControls(); renderHelptip(); renderLog();
  }

  /* [v2 P1] 灾异横幅: 本关灾异常驻顶部, 醒目提示 */
  function renderCataBar() {
    const bar = $('#cata-bar'); if (!bar) return;
    const cat = state.cfg && state.cfg.catastrophe;
    if (!cat) { bar.classList.remove('show'); bar.innerHTML = ''; return; }
    bar.classList.add('show');
    bar.innerHTML = `⚠️ 灾异：${cat.icon}${cat.name} — ${cat.desc}`;
  }

  function renderHud() {
    const cfg = state.cfg;
    const reached = state.score >= cfg.quota;
    const emberTxt = state.ember ? `<span style="font-size:10px;opacity:.8"> 余烬${state.ember}</span>` : '';
    $('#hud').innerHTML = `
      <div class="hud-item"><span class="k">关卡</span><span class="v">${cfg.level}<span class="seal" style="margin-left:4px;font-size:10px">${cfg.isBoss ? '关隘' : '第' + cfg.size + '城'}</span></span></div>
      <div class="hud-item"><span class="k">配额</span><span class="v">${cfg.quota}</span></div>
      <div class="hud-item ${reached ? 'boom' : ''}"><span class="k">当前分</span><span class="v">${state.score}</span></div>
      <div class="hud-item"><span class="k">金币</span><span class="v">${state.coins}</span></div>
      <div class="hud-item"><span class="k">营造</span><span class="v">${state.placementsLeft}/${cfg.placements}</span></div>
      <div class="hud-item"><span class="k">灵感</span><span class="v">${state.inspiration}/${D.INSP_CAP}${emberTxt}</span></div>
      <div class="hud-item"><span class="k">印记</span><span class="v">${state.sealCount}/${D.SEAL_NEED}</span></div>`;
    const dc = $('#deck-count'); if (dc) dc.textContent = state.owned.length;
  }

  function renderEdict() {
    const el = $('#edict'); if (!el) return;
    const e = state.cfg && state.cfg.edict;
    if (!e) { el.innerHTML = ''; return; }
    const ev = E.evalBoard(state);
    let prog = '';
    if (e.kind === 'pillar') {
      prog = `（${Math.round(ev.pillars[e.pillar])} / ${e.target}）`;
    } else if (e.kind === 'pairs') {
      let cnt = 0; const b = state.board;
      for (let r = 0; r < state.boardH; r++)
        for (let c = 0; c < state.boardW; c++) {
          const x = b[r][c]; if (!x || x.kind !== e.kindName) continue;
          if (c + 1 < state.boardW && b[r][c + 1] && b[r][c + 1].kind === e.kindName) cnt++;
          if (r + 1 < state.boardH && b[r + 1][c] && b[r + 1][c].kind === e.kindName) cnt++;
        }
      prog = `（${cnt} / ${e.need} 对）`;
    } else if (e.kind === 'count') {
      let cnt = 0; state.board.forEach((row) => row.forEach((x) => { if (x && x.kind === e.kindName) cnt++; }));
      prog = `（${cnt} / ${e.need} 座）`;
    } else if (e.kind === 'cycle') {
      prog = '（五行相生闭环）';
    } else if (e.kind === 'fullrow') {
      prog = '（满行/列）';
    }
    const ok = E.checkEdict(state, ev);
    const desc = e.desc.replace('{X}', e.target != null ? e.target : '');
    el.innerHTML = `<span class="edict-name">📜 ${e.name}</span><span class="edict-desc">${desc}</span><span class="edict-prog ${ok ? 'done' : ''}">${prog}${ok ? ' ✓' : ''}</span>`;
  }

  function renderArche() {
    const el = $('#arche'); if (!el) return;
    const list = E.getArchetypeStatus(state);
    // [v2 P1] 成型 toast: 每局每个流派只提醒一次, 附流派印说明
    list.forEach((a) => {
      if (a.status === 'done' && !archNotified[a.id]) {
        archNotified[a.id] = true;
        toast(`🏛️ 流派成型：${a.name}！${a.stamp ? `流派印 +${a.stamp.n}${a.stamp.pillar}` : ''}`);
      }
    });
    if (!list.length) {
      el.innerHTML = '<span class="arch-none">尚未形成流派 · 在商店收集核心营造物（观星台 / 含嘉仓 / 都江堰…）开启</span>';
      return;
    }
    el.innerHTML = list.map((a) =>
      `<span class="arch-pill ${a.status}" style="border-color:${a.color}">
        <span class="dot" style="background:${a.color}"></span>${a.name}
        ${a.status === 'done' ? `<span class="ok">✓成型${a.stamp ? ` +${a.stamp.n}${a.stamp.pillar}` : ''}</span>` : `<span class="need">还差${a.need}张</span>`}
      </span>`
    ).join('');
  }

  function renderBoard() {
    const b = $('#board');
    b.style.gridTemplateColumns = `repeat(${state.boardW}, 46px)`;
    const showWard = state.boardW >= 5;
    let html = '';
    for (let r = 0; r < state.boardH; r++) {
      for (let c = 0; c < state.boardW; c++) {
        const inst = state.board[r][c];
        const terr = state.terrain[r] && state.terrain[r][c];
        const pend = pending.find((p) => p.r === r && p.c === c);
        const mvSel = mode === 'move' && moveSel && moveSel.r === r && moveSel.c === c;
        const terrCls = (terr && terr !== 'plain') ? ' t-' + terr : '';
        const terrMark = (terr && terr !== 'plain') ? `<span class="terr" title="${D.TERRAIN[terr].name}">${D.TERRAIN[terr].icon}</span>` : '';
        const wardCls = showWard ? ((r % 3 === 0 ? ' ward-top' : '') + (c % 3 === 0 ? ' ward-left' : '')) : '';
        if (inst) {
          const dCls = mode === 'demolish' ? ' demolishable' : '';
          html += `<div class="cell${terrCls}${wardCls}${dCls}${mvSel ? ' mv-sel' : ''}" data-r="${r}" data-c="${c}" title="${terr && terr !== 'plain' ? D.TERRAIN[terr].name : ''}">${miniHTML(inst)}${terrMark}${mvSel ? '<span class="mv-mark">📦</span>' : ''}</div>`;
        } else if (pend) {
          const card = state.hand.find((x) => x.uid === pend.uid);
          html += `<div class="cell pending target${terrCls}${wardCls}" data-r="${r}" data-c="${c}">${card ? miniHTML(card) : ''}${terrMark}</div>`;
        } else {
          const isTut = state.tutCell && state.tutCell.r === r && state.tutCell.c === c;
          const cls = (mode === 'place' && heldUid) ? 'cell empty target' : 'cell empty';
          const tutCls = isTut ? ' tut' : '';
          const tutMark = isTut ? '<span class="tut-mark">👆</span>' : '';
          html += `<div class="${cls}${terrCls}${wardCls}${tutCls}" data-r="${r}" data-c="${c}">${terrMark}${tutMark}</div>`;
        }
      }
    }
    b.innerHTML = html;
  }

  function renderSide() {
    const ev = E.evalBoard(state);
    $('#cols').innerHTML = `
      <div class="col"><h3>民生</h3><div class="pts" style="color:var(--mu)">${Math.round(ev.pillars['民生'])}</div><div class="sub">民居/园林</div></div>
      <div class="col"><h3>经济</h3><div class="pts" style="color:var(--gold)">${Math.round(ev.pillars['经济'])}</div><div class="sub">市集/水利/道路</div></div>
      <div class="col"><h3>治安</h3><div class="pts" style="color:var(--seal)">${Math.round(ev.pillars['治安'])}</div><div class="sub">衙门/防御</div></div>`;
    // 预览
    const uids = pending.map((p) => p.uid).concat(heldUid ? [heldUid] : []);
    const pv = $('#preview');
    if (uids.length) {
      const proj = E.computePreview(state, uids);
      pv.innerHTML = `<span>落子后预计总分</span><div class="pv-score">${proj.total}</div><div style="margin-top:2px">当前 ${state.score} / 配额 ${state.cfg.quota}</div>`;
    } else {
      pv.innerHTML = `<span>当前总分 ${state.score} / 配额 ${state.cfg.quota}${state.score >= state.cfg.quota ? ' ✓达标' : ''}</span>`;
    }
    // 营造物 / 主动技
    const specials = state.board.flat().filter((c) => c && c.type === 'special');
    let jh = '<h3 style="font-size:14px;margin-bottom:4px">营造物（盘上）</h3>';
    if (!specials.length) jh += '<div class="ds" style="font-size:11px;color:var(--ink2)">尚无营造物落盘。</div>';
    specials.forEach((c) => {
      jh += `<div class="jk"><div class="nm" style="color:${rarColor(c)}">${c.name} <span style="font-weight:400;color:var(--ink2)">${c.kind}</span></div>`;
      jh += `<div class="sk">${c.skill}</div>`;
      if (c.active) jh += `<button class="act" data-act="joker" data-uid="${c.uid}" ${state.inspiration < c.cost ? 'disabled' : ''}>施展（灵感${c.cost}）</button>`;
      jh += `</div>`;
    });
    $('#jokers').innerHTML = jh;
  }

  function renderHand() {
    $('#hand').innerHTML = state.hand.map((c) => cardHTML(c)).join('');
  }

  function renderControls() {
    const cfg = state.cfg;
    let html = '';
    if (mode === 'place') {
      html += `<button class="btn seal" id="btn-confirm" ${pending.length ? '' : 'disabled'}>确认营造（${pending.length}）</button>`;
      if (pending.length) html += `<button class="btn ghost" id="btn-clear">取消</button>`;
      html += `<button class="btn ghost" id="btn-discard-mode">弃牌</button>`;
      // [v2 P1] 拆建/迁建入口: 花金币修正盘面, 是后期金币真 sink
      if (state.level >= D.DEMOLISH_UNLOCK) {
        const dCost = D.DEMOLISH_BASE + state.demolishCount * D.DEMOLISH_STEP;
        html += `<button class="btn ghost" id="btn-demolish" ${state.coins < dCost ? 'disabled' : ''}>拆建(${dCost}金)</button>`;
      }
      if (state.level >= D.MOVE_UNLOCK) {
        html += `<button class="btn ghost" id="btn-move" ${state.movesLeft <= 0 || state.coins < D.MOVE_COST ? 'disabled' : ''}>迁建(${D.MOVE_COST}金·${state.movesLeft})</button>`;
      }
      html += `<button class="btn ghost" id="btn-prop">道具（${state.props.length}）</button>`;
      html += `<button class="btn ghost" id="btn-end">结束本关</button>`;
    } else if (mode === 'discard') {
      html += `<span style="align-self:center;font-size:13px;color:var(--ink2)">弃牌模式：点选手牌，再确认（剩 ${state.discardsLeft} 次）</span>`;
      html += `<button class="btn seal" id="btn-discard-do" ${discardSel.size ? '' : 'disabled'}>确认弃牌（${discardSel.size}）</button>`;
      html += `<button class="btn ghost" id="btn-discard-cancel">取消</button>`;
    } else if (mode === 'demolish') {
      const dCost = D.DEMOLISH_BASE + state.demolishCount * D.DEMOLISH_STEP;
      html += `<span style="align-self:center;font-size:13px;color:var(--ink2)">拆建模式：点盘上一座建筑拆掉（${dCost}金，返还灵感，拆下的卡回到牌组循环）</span>`;
      html += `<button class="btn ghost" id="btn-mode-cancel">取消</button>`;
    } else if (mode === 'move') {
      html += `<span style="align-self:center;font-size:13px;color:var(--ink2)">迁建模式：先点建筑再点空位（${D.MOVE_COST}金，剩 ${state.movesLeft} 次）</span>`;
      html += `<button class="btn ghost" id="btn-mode-cancel">取消</button>`;
    }
    $('#controls').innerHTML = html;
    if ($('#btn-confirm')) $('#btn-confirm').onclick = doConfirm;
    if ($('#btn-clear')) $('#btn-clear').onclick = () => { pending = []; heldUid = null; render(); };
    if ($('#btn-discard-mode')) $('#btn-discard-mode').onclick = () => { mode = 'discard'; discardSel.clear(); render(); };
    if ($('#btn-demolish')) $('#btn-demolish').onclick = () => { mode = 'demolish'; render(); };
    if ($('#btn-move')) $('#btn-move').onclick = () => { mode = 'move'; moveSel = null; render(); };
    if ($('#btn-mode-cancel')) $('#btn-mode-cancel').onclick = () => { mode = 'place'; moveSel = null; render(); };
    if ($('#btn-prop')) $('#btn-prop').onclick = openProps;
    if ($('#btn-end')) $('#btn-end').onclick = doEnd;
    if ($('#btn-discard-do')) $('#btn-discard-do').onclick = doDiscard;
    if ($('#btn-discard-cancel')) $('#btn-discard-cancel').onclick = () => { mode = 'place'; discardSel.clear(); render(); };
  }

  function renderHelptip() {
    const cfg = state.cfg;
    let tip = `第 ${cfg.level} 关 · 配额 ${cfg.quota} · 剩余营造 ${state.placementsLeft} 次。把建筑拖到城盘上，靠相邻与五行生克凑分。`;
    if (cfg.isBoss) tip += ' 关隘，配额跃升。';
    // [v2 P1] 本关灾异 + 下一关预告(提前 1 关告知, 让手牌与购买决策有方向)
    if (cfg.catastrophe) tip += ` ⚠️ 灾异：${cfg.catastrophe.icon}${cfg.catastrophe.name}（${cfg.catastrophe.desc}）`;
    const nxt = D.getLevelConfig(cfg.level + 1);
    if (nxt && nxt.catastrophe) tip += ` ｜ 预告：下一关 ${nxt.catastrophe.icon}${nxt.catastrophe.name}`;
    $('#helptip').textContent = tip;
  }
  function renderLog() {
    $('#log').innerHTML = state.log.slice().reverse().map((l) => '· ' + l).join('<br>');
  }

  /* ===================================================================
   * 交互
   * =================================================================== */
  function handClick(uid) {
    if (shopOpen) return;
    if (mode === 'discard') {
      if (discardSel.has(uid)) discardSel.delete(uid); else discardSel.add(uid);
      render(); return;
    }
    // place 模式: 拾起 / 放下
    if (heldUid === uid) { heldUid = null; render(); return; }
    if (pending.length >= D.PLAY_MAX) { toast('单次最多营造 ' + D.PLAY_MAX + ' 座'); return; }
    if (pending.some((p) => p.uid === uid)) { toast('该卡已在落子区'); return; }
    heldUid = uid; render();
  }

  function cellClick(r, c) {
    if (shopOpen) return;
    const inst = state.board[r][c];
    // [v2 P1] 拆建模式: 点盘上建筑直接拆(花金币, 返还灵感)
    if (mode === 'demolish') {
      if (!inst) return;
      const res = E.demolishBuilding(state, r, c);
      if (!res.ok) { toast(res.msg); return; }
      toast(`拆建 -${res.cost}金`);
      if (state.over || state.won) { mode = 'place'; }
      render(); return;
    }
    // [v2 P1] 迁建模式: 先选建筑(源), 再点空位(目标)
    if (mode === 'move') {
      if (inst) { moveSel = { r, c }; render(); return; } // 换选源
      if (!moveSel) return;
      const res = E.moveBuilding(state, moveSel.r, moveSel.c, r, c);
      if (!res.ok) { toast(res.msg); return; }
      moveSel = null; toast('迁建完成'); render(); return;
    }
    const pend = pending.find((p) => p.r === r && p.c === c);
    if (pend) { // 撤回待确认落子
      pending = pending.filter((p) => !(p.r === r && p.c === c));
      heldUid = null; render(); return;
    }
    if (inst) return; // 已落定的建筑不可移动(迁建走模式)
    if (mode !== 'place' || !heldUid) return;
    pending.push({ uid: heldUid, r, c });
    heldUid = null; render();
  }

  function doConfirm() {
    if (!pending.length) return;
    if (state.placementsLeft <= 0) { toast('营造次数已用完'); return; }
    const res = E.applyPlace(state, pending);
    if (!res.ok) { toast(res.msg); return; }
    pending = []; heldUid = null;
    if (state.tutCell) state.tutCell = null; // 首关引导高亮在首次落子后消失
    if (res.win === true) sfx('win');
    else if (res.win === 'lose') sfx('lose');
    else sfx('place');
    toast('+' + res.score);
    if (res.win === true) return onWin();
    if (res.win === 'lose') return onLose();
    render();
  }
  function doEnd() {
    if (state.score >= state.cfg.quota) { sfx('win'); return onWin(); }
    sfx('lose'); onLose();
  }
  function doDiscard() {
    if (discardSel.size < 1) return;
    const idxs = [...discardSel].map((u) => state.hand.findIndex((c) => c.uid === u)).filter((i) => i >= 0);
    const res = E.applyDiscard(state, idxs);
    if (!res.ok) { toast(res.msg); return; }
    discardSel.clear(); mode = 'place'; render();
  }

  /* ---------- 右键放大看技能 ---------- */
  function openZoom(uid) {
    const c = instByUid(uid);
    if (!c) return;
    const ec = colorOf(c);
    const big = `<div class="card big" style="--ec:${ec}">
      <div class="el" style="background:${ec}">${c.element}</div>
      <div class="rar" style="color:${rarColor(c)}">${c.rarity}</div>
      <div class="img" style="background:${ec}1f">${emojiOf(c)}</div>
      <div class="nm">${c.name}</div>
      <div class="pt">${pointsStr(c)}</div>
      <div class="tp">${kindLabel(c)}</div>
    </div>`;
    const info = `<div class="info">
      <div><span class="tag" style="background:${ec}">${c.element}行</span><span class="tag">${c.kind}</span><span class="tag">${c.rarity}</span></div>
      <div style="margin-top:6px"><b>归属：</b>${c.pillar} · 基础值 ${c.value}</div>
      ${c.type === 'special' ? `<div class="skill"><b>营造技能：</b>${c.skill}</div>` : ''}
      <div class="flavor">${c.desc || ''}</div>
    </div>`;
    showZoom(`<div id="zoom"><div>${big}</div><div>${info}</div></div>`);
  }
  function showZoom(html) {
    let ov = $('#zoom-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'zoom-ov'; ov.className = 'zoom-ov';
      ov.innerHTML = '<div class="zoom-box"></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('show'); });
    }
    ov.querySelector('.zoom-box').innerHTML = html;
    ov.classList.add('show');
  }

  /* 牌组查看器 */
  function showDeck() {
    const owned = state.owned;
    if (!owned.length) { openModal('<h2>牌组</h2><p>牌组空空如也——去商店抽几匣吧。</p><div class="row"><button class="btn seal" data-act="close">好的</button></div>', true); return; }
    // 按类型分组: 普通 / 营造物(黄/紫/红)
    const normal = owned.filter(c => c.type !== 'special');
    const special = owned.filter(c => c.type === 'special');
    const byRarity = { 黄: special.filter(c => c.rarity === '黄'), 紫: special.filter(c => c.rarity === '紫'), 红: special.filter(c => c.rarity === '红') };
    let html = '<h2>牌组 · ' + owned.length + ' 张</h2>';
    if (normal.length) {
      html += '<h3 style="margin:10px 0 4px">普通建筑 (' + normal.length + ')</h3><div class="deck-grid">';
      normal.forEach(c => { html += `<div data-deckuid="${c.uid}">${cardHTML(c)}</div>`; });
      html += '</div>';
    }
    ['黄','紫','红'].forEach(r => {
      const list = byRarity[r];
      if (!list.length) return;
      html += `<h3 style="margin:10px 0 4px">${r}色营造物 (${list.length})</h3><div class="deck-grid">`;
      list.forEach(c => { html += `<div data-deckuid="${c.uid}">${cardHTML(c)}</div>`; });
      html += '</div>';
    });
    html += '<p class="ds" style="margin-top:8px">💡 右键任意卡放大看技能详情。</p>';
    openModal(html, true);
  }

  /* ---------- 道具 ---------- */
  function openProps() {
    if (state.props.length === 0) { toast('暂无道具'); return; }
    let html = `<h2>持有道具（${state.props.length}/${D.PROP_SLOTS}）</h2><div class="row">`;
    state.props.forEach((p) => {
      html += `<div class="shop-prop" style="flex-direction:column;align-items:flex-start;cursor:pointer" data-act="useprop" data-uid="${p.uid}">
        <div><span class="nm">${p.base.name}</span></div><div class="ds">${p.base.desc}</div></div>`;
    });
    html += `</div><div class="row"><button class="btn ghost" data-act="close">关闭</button></div>`;
    openModal(html, true);
  }
  function usePropFlow(uid) {
    const p = state.props.find((x) => x.uid === uid);
    if (!p) return;
    const eff = p.base.effect;
    if (eff === 'baozi' || eff === 'juzi' || eff === 'zuanzi') {
      propPick = uid;
      let html = `<h2>${p.base.name} · 选一张建筑永久强化</h2><div class="pack-cands">`;
      state.owned.forEach((c) => { html += cardHTML(c); });
      html += `</div><div class="row"><button class="btn ghost" data-act="close">取消</button></div>`;
      openModal(html, true); return;
    }
    if (eff === 'modou') {
      const sp = state.board.flat().filter((c) => c && c.type === 'special');
      if (!sp.length) { toast('盘上暂无营造物'); return; }
      propPick = uid;
      let html = `<h2>墨斗 · 选一张盘上营造物复制</h2><div class="pack-cands">`;
      sp.forEach((c) => { html += `<div data-act="pickmodou" data-uid="${c.uid}">${cardHTML(c)}</div>`; });
      html += `</div><div class="row"><button class="btn ghost" data-act="close">取消</button></div>`;
      openModal(html, true); return;
    }
    const r = E.useProp(state, uid);
    if (!r.ok) { toast(r.msg); return; }
    closeModal(); render();
  }
  function applyPropToCard(uid) {
    const r = E.useProp(state, propPick, { uid });
    propPick = null;
    if (!r.ok) { toast(r.msg); return; }
    closeModal(); render();
  }
  function applyModou(uid) {
    const r = E.useProp(state, propPick, { uid });
    propPick = null;
    if (!r.ok) { toast(r.msg); return; }
    closeModal(); render();
  }

  /* ---------- 胜负 ---------- */
  function onWin() {
    if (state.level >= state.cfg.maxLevel) return showVictory();
    E.openShop(state); shopOpen = true; shopView = null;
    // [v3] 过关奖励: 先三选一免费拿卡(每关都有新反馈), 再进商店
    rewardView = { candidates: E.rollRewardCandidates(state) };
    renderReward();
  }
  function onLose() {
    const ev = E.evalBoard(state);
    const diff = state.cfg.quota - state.score;
    // [v2 P1] 失败诊断: 找最弱栏, 给出建筑类型建议, 让失败"差一点"而非"全盘皆输"
    const cols = [['民生', ev.pillars['民生'], '民居/园林'], ['经济', ev.pillars['经济'], '市集/水利/道路'], ['治安', ev.pillars['治安'], '衙门/防御']];
    cols.sort((a, b) => a[1] - b[1]);
    const weakest = cols[0];
    let html = `<h2 style="border-color:var(--seal)">营造中止</h2>
      <p>本局于第 <b>${state.level}</b> 关力竭——配额 ${state.cfg.quota}，实得 ${state.score}，差 <b>${diff}</b> 分。</p>
      <p class="ds">诊断：<b>${weakest[0]}栏</b>最弱（${Math.round(weakest[1])}），建议优先补 ${weakest[2]}类建筑。</p>
      <p class="ds">牌组 ${state.owned.length} 张，金币 ${state.coins}，诏令印记 ${state.sealCount}/${D.SEAL_NEED}。</p>
      <div class="row">`;
    // [v2 P1] 圣旨重开: 集齐 3 枚印记可重开当前关(保留牌组/金币/城市)
    if (state.sealCount >= D.SEAL_NEED) html += `<button class="btn" data-act="seal-retry">圣旨重开（消耗 ${D.SEAL_NEED} 印记）</button>`;
    html += `<button class="btn seal" data-act="restart">新游戏</button></div>`;
    openModal(html, false);
  }
  function showVictory() {
    let html = `<h2>营造大成 🏯</h2><p>二十四关全数达成，万象营毕。</p>
      <p class="ds">最终牌组 ${state.owned.length} 张，余金 ${state.coins}。</p>
      <div class="row"><button class="btn seal" data-act="restart">再开一局</button></div>`;
    openModal(html, false);
  }

  /* ---------- 商店 ---------- */
    /* [v3] 过关奖励三选一: 免费拿 1 张入牌组(杀戮尖塔式节奏) */
    function renderReward() {
      if (!rewardView) return;
      let html = `<h2>🎁 工部犒赏 · 过关奖励</h2>
        <p class="ds" style="margin-bottom:8px">三选一，免费收入牌组（也可跳过直接进商店）。</p><div class="pack-cands" id="pack-cands">`;
      rewardView.candidates.forEach((c, i) => {
        html += `<div data-act="reward-pick" data-i="${i}" data-uid="${c.uid}" oncontextmenu="event.preventDefault();event.stopPropagation();return false">${cardHTML(c, { clickable: true })}</div>`;
      });
      html += `</div><div class="row"><button class="btn ghost" data-act="reward-skip">跳过，进商店</button></div>`;
      openModal(html, true);
    }
  function renderShop() {
    const cfg = state.cfg;
    let edictNote = '';
    if (state.lastEdict) edictNote = state.lastEdict.satisfied
      ? ` · 诏令「${state.lastEdict.name}」达成 +${state.lastEdict.reward}金`
      : ` · 诏令「${state.lastEdict.name}」未达成`;
    let html = `<h2>第 ${cfg.level} 关达成 · 获金 ${state.lastReward}${edictNote}</h2>`;
    html += `<h3 style="margin:10px 0 4px">匠作铺（金币 ${state.coins}）</h3><div class="row">`;
    state.shop.props.forEach((p, i) => {
      if (!p) { html += `<div class="shop-prop"><span class="ds">已购</span></div>`; return; }
      const canBuy = state.coins >= p.cost && state.props.length < D.PROP_SLOTS;
      const locked = state.shop.locked.includes(i);
      html += `<div class="shop-prop" style="flex-direction:column;align-items:flex-start">
        <div><span class="nm">${p.name}</span> <span class="tag">${p.cost}金</span></div>
        <div class="ds">${p.desc}</div>
        <div class="row" style="margin-top:4px">
          <button class="btn" data-act="buyprop" data-i="${i}" ${canBuy ? '' : 'disabled'}>购入</button>
          <button class="btn ghost" data-act="lockprop" data-i="${i}" ${locked ? 'disabled' : ''}>锁定(${2 + state.shop.locked.length * 2})</button>
        </div></div>`;
    });
    html += `</div><div class="row"><button class="btn ghost" data-act="reroll" ${state.coins >= state.rerollCost ? '' : 'disabled'}>重抽匠作（${state.rerollCost}金）</button></div>`;

    html += `<h3 style="margin:12px 0 4px">营造匣（抽建筑/营造物）</h3><div class="row">`;
    html += `<button class="btn" data-act="pack" data-type="normal" ${state.coins >= D.PACK_COST.normal ? '' : 'disabled'}>普通匣 ${D.PACK_COST.normal}金</button>`;
    html += `<button class="btn" data-act="pack" data-type="mixed" ${state.coins >= D.PACK_COST.mixed ? '' : 'disabled'}>混元匣 ${D.PACK_COST.mixed}金</button>`;
    html += `<button class="btn" data-act="pack" data-type="special" ${state.coins >= D.PACK_COST.special ? '' : 'disabled'}>奇巧匣 ${D.PACK_COST.special}金</button>`;
    html += `</div>`;

    if (shopView) {
      html += `<h3 style="margin:10px 0 4px">三选一（${shopView.type}匣）<span style="float:right;font-weight:400;font-size:12px"><span data-act="shop-deck-peek" style="color:var(--accent);cursor:pointer">📋 查看牌组(${state.owned.length})</span></h3><div class="pack-cands" id="pack-cands">`;
      shopView.candidates.forEach((c, i) => {
        // 终极防线: 外层 div 带 data-uid + 内联阻止默认右键菜单
        html += `<div data-act="pickpack" data-i="${i}" data-uid="${c.uid}" oncontextmenu="event.preventDefault();event.stopPropagation();return false">${cardHTML(c, { clickable: true })}</div>`;
      });
      html += `</div><div class="row"><button class="btn ghost" data-act="packcancel">跳过</button></div>`;
    }

    // 删牌付费(真 sink)
    const rmCost = D.REMOVE_BASE + state.removedCount * D.REMOVE_STEP;
    html += `<details style="margin-top:10px"><summary style="cursor:pointer">删牌（每次花费 ${rmCost} 金，精简牌组）</summary><div class="pack-cands" style="margin-top:8px">`;
    state.owned.forEach((c) => {
      html += `<div style="position:relative" data-act="remove" data-uid="${c.uid}">${cardHTML(c)}<div class="sellflag">删</div></div>`;
    });
    html += `</div></details>`;

    html += `<div class="row" style="margin-top:14px"><button class="btn seal" data-act="next">进入下一关 →</button></div>`;
    openModal(html, false);
  }
  function shopAct(act, data) {
    switch (act) {
      case 'buyprop': { const r = E.buyProp(state, +data.i); if (!r.ok) toast(r.msg); else renderShop(); break; }
      case 'lockprop': { const r = E.lockShopItem(state, +data.i); if (!r.ok) toast(r.msg); else renderShop(); break; }
      case 'reroll': { const r = E.rerollShop(state); if (!r.ok) toast(r.msg); else renderShop(); break; }
      case 'pack': {
        const type = data.type;
        if (state.coins < D.PACK_COST[type]) { toast('金币不足'); return; }
        shopView = { type, candidates: E.rollPackCandidates(state, type) };
        renderShop(); break;
      }
      case 'pickpack': {
        const cand = shopView.candidates[+data.i];
        const r = E.buyPack(state, shopView.type, cand);
        if (!r.ok) { toast(r.msg); return; }
        shopView = null; toast('收入牌组：' + cand.name); renderShop(); break;
      }
      case 'packcancel': shopView = null; renderShop(); break;
      case 'remove': {
        const r = E.removeCard(state, data.uid);
        if (!r.ok) { toast(r.msg); return; }
        toast('删牌 -' + r.cost + '金'); renderShop(); break;
      }
      case 'next': shopOpen = false; closeModal(); enterLevel(); break;
    }
  }

  /* ===================================================================
   * 模态 / 全局事件
   * =================================================================== */
  function openModal(html, dismissable) {
    const x = dismissable ? '<button class="modal-x" data-act="close" aria-label="关闭">✕</button>' : '';
    $('#modal').innerHTML = x + html;
    $('#modal').dataset.dismiss = dismissable ? '1' : '0';
    $('#overlay').classList.add('show');
  }
  function closeModal() { $('#overlay').classList.remove('show'); }

  function showHelp() {
    const D = E.D, S = D.SCORE;
    const adjRows = Object.keys(D.ADJ).map((k) => {
      const [a, b] = k.split('|');
      const parts = Object.keys(D.ADJ[k]).map((p) => `${p}+${D.ADJ[k][p]}`).join('、');
      return `<tr><td>${a} ↔ ${b}</td><td>${parts}</td></tr>`;
    }).join('');
    const specRows = D.specialCards.map((c) =>
      `<tr><td><span class="rarity-${c.rarity}">${c.name}</span></td><td>${c.skill || c.desc || '—'}</td></tr>`
    ).join('');
    const html = `<div class="help-doc">
      <h2>营造司 · 怎么凑分</h2>
      <p class="lead"><b>目标</b>：在限定放置次数内，把建筑摆上城盘，让「民生 + 经济 + 治安」三栏总分 ≥ 本关配额。城盘逐关长大，共 24 关。</p>

      <h3>① 基础分 · 每座建筑归它自己的栏</h3>
      <p>每张建筑卡标注<strong>归属栏</strong>与<strong>基础值</strong>，摆上盘直接给该栏加分。<br>例：衙门（治安·值22）→ 治安 +22；市集（经济·值24）→ 经济 +24。</p>

      <h3>①·地势 · 把建筑落在合适的地上</h3>
      <p>城盘上有些格子带<strong>地形</strong>（角标 🌊水泽 / ⛰️山地 / 🌾沃壤 / 🛣️通衢）。把<strong>契合地形</strong>的建筑摆在上面，该建筑基础值 <strong>×1.3</strong>：</p>
      <table class="help-tbl"><thead><tr><th>地形</th><th>契合建筑</th><th>效果</th></tr></thead><tbody>
        <tr><td>🌊 水泽</td><td>水利、园林</td><td>基础值 ×1.3</td></tr>
        <tr><td>⛰️ 山地</td><td>防御、衙门、礼制</td><td>基础值 ×1.3</td></tr>
        <tr><td>🌾 沃壤</td><td>民居</td><td>基础值 ×1.3</td></tr>
        <tr><td>🛣️ 通衢</td><td>市集、道路</td><td>基础值 ×1.3</td></tr>
      </tbody></table>
      <p>不契合的建筑落在地形上<strong>不扣也不加</strong>——地形是「加分选项」，不是惩罚。地形随城盘长大而增多，是每关布局的主要空间变量。</p>

      <h3>② 相邻功能加成 · 挨着就加分</h3>
      <p>两座建筑<strong>上下左右相邻</strong>时，若属于下方组合，触发加成（无序，谁在左都行）：</p>
      <table class="help-tbl"><thead><tr><th>相邻组合</th><th>加成</th></tr></thead><tbody>${adjRows}</tbody></table>
      <p>例：把「衙门」放在「民居」旁边 → 这一对给治安 +8。</p>

      <h3>③ 五行生克 · 属性关系决定加减</h3>
      <p><b>相生（加分）</b>：顺着箭头<strong>正交相邻</strong>，后一座归属栏 <strong>+${S.CHAIN_PAIR}</strong>；观星台激活时隔空也按半效(+${S.CHAIN_PAIR * 0.5})。</p>
      <p class="chain">木 → 火 → 土 → 金 → 水 → 木</p>
      <p><b>相克（扣分）</b>：顺着箭头<strong>正交相邻</strong>，被克建筑归属栏扣 <strong>其基础值 ×${(S.KE_PEN_FRAC * 100).toFixed(0)}%</strong>（至少 ${S.KE_PEN_MIN}，白卡约 −12，核心营造物被克更痛）；观星台激活时隔空半效。谁克谁看这条链：</p>
      <p class="chain chain-ke">${(() => { const step = (e) => D.SHENG[D.SHENG[e]]; let c = '木'; const arr = [c]; for (let i = 0; i < 5; i++) { c = step(c); arr.push(c); } return arr.join(' → '); })()}</p>
      <p>即：<b>木克土 · 土克水 · 水克火 · 火克金 · 金克木</b>。化解：只要这对里有<strong>园林</strong>或<strong>礼制</strong>类建筑，就不扣分。<br>例：木(民居)隔壁是火建筑 → 火方栏 +${S.CHAIN_PAIR}（木生火，加分）；木(园林)隔壁是土建筑 → 木克土本要扣，但园林化解，不扣分。</p>
      <p><b>相生链乘率</b>：沿相生方向（木→火→土→金→水→木）首尾相接的正交长链，链上建筑基础值 <strong>×${S.CHAIN_MULT}</strong>（链长 ≥${S.CHAIN_MULT_LEN}）或 <strong>×${S.CHAIN_MULT2}</strong>（链长 ≥${S.CHAIN_MULT2_LEN}，元素不重复）。摆一条贯穿盘面的长链，是中期最大的一次性加分。</p>

      <h3>④ 资源链路 · 水利 + 市集</h3>
      <p>盘上<strong>同时有水利类与市集类</strong>：相邻 → 经济 +${S.RES_LINK_ADJ}；同盘不相邻也有 → 经济 +${S.RES_LINK}。</p>

      <h3>⑤ 营造物（紫/红卡）· 战略建筑，落盘常驻</h3>
      <p>不放手牌，是永久区域技能。<strong>右键任意卡可放大看单卡说明</strong>。区域技能一览：</p>
      <table class="help-tbl"><thead><tr><th>营造物</th><th>区域技能</th></tr></thead><tbody>${specRows}</tbody></table>

      <h3>⑥ 灵感 / 主动技</h3>
      <p>每放 1 张得 1 灵感（上限 ${D.INSP_CAP}）。主动营造物在右侧栏点「施展」消耗灵感：</p>
      <ul>
        <li>观星台（灵感2）：本回合任意两格视为相邻，可跨盘连锁</li>
        <li>鲁班锁（灵感2）：本关 +1 次放置</li>
        <li>瞿塘烽燧（灵感2）：本回合下一张放置得分 ×2</li>
        <li>清辉园（灵感1）：本回合放置无视相克惩罚</li>
      </ul>

      <h3>⑦ 总分乘率 &amp; 上限</h3>
      <p>含嘉仓（三栏都有）→ ×1.25；营造尺道具 → ×1.25；观星台主动 → ×1.5；瞿塘主动 → ×2。<br>总分<strong>上限 = 配额 × ${S.SCORE_CAP_MULT}</strong>，超出部分按 <strong>50% 折算</strong>计入（防失控，但极限组合仍有反馈）。</p>

      <h3>⑦·坊 · 棋盘分块，密集主题建造奖励</h3>
      <p>城盘 ≥ 5×5 时，棋盘自动划分为 <strong>3×3 的「坊」</strong>（自左上平铺，灰色分隔线可见）。当某坊 <strong>9 格全满</strong>且其中 <strong>≥7 格同属一栏</strong>，该栏额外 <strong>+20</strong>；若 <strong>9 格全同栏</strong>，该栏再 <strong>×${S.WARD9_MULT}</strong>。<br>这是后期「堆满一片同主题街区」的 payoff，与「四处铺开吃相邻」是两条并行的空间策略。</p>

      <h3>⑧ 牌组流派（构建方向）</h3>
      <p>持有某流派<strong>核心营造物</strong>后，HUD 顶部会显示流派进度。凑齐配套建筑即「成型」，build 质变——这是「组合性」的来源：</p>
      <table class="help-tbl"><thead><tr><th>流派</th><th>思路</th><th>核心营造物</th><th>流派印</th></tr></thead><tbody>${D.ARCHETYPES.map((a) => `<tr><td><span style="color:${a.color};font-weight:600">${a.name}</span></td><td>${a.desc}</td><td>${a.coreNames.join(' / ')}</td><td>${a.stamp ? `${a.stamp.pillar}+${a.stamp.n}` : '—'}</td></tr>`).join('')}      </tbody></table>
      <p>流派<strong>成型</strong>后，每关流派核心都会在对应栏盖下「流派印」（固定加分），成型当关立刻生效——build 越早成型，越早开始印分。</p>

      <h3>⑨ 营造诏令 · 每关独特目标</h3>
      <p>顶部「📜 诏令」条显示本关<strong>额外目标</strong>，达标即在过关奖励上 <strong>再加金币</strong>（不影响过关，是可选挑战，让 24 关各不相同）：</p>
      <table class="help-tbl"><thead><tr><th>诏令</th><th>达成条件</th><th>赏金</th></tr></thead><tbody>
        ${Object.values(D.EDICTS).map((e) => `<tr><td>${e.name}</td><td>${e.desc.replace('{X}', '目标值')}</td><td>+${e.reward}金</td></tr>`).join('')}
      </tbody></table>

      <h3>⑩ 灾异 · 关隘的环境变量</h3>
      <p>每逢<b>关隘</b>（L3/6/9/12 单灾异，L15 起双灾叠加轮换）整关生效，顶部横幅常驻提示，并提前一关预告：</p>
      <table class="help-tbl"><thead><tr><th>灾异</th><th>效果</th></tr></thead><tbody>
        <tr><td>🌊 洪涝</td><td>水泽格增多，民生栏 ×0.9</td></tr>
        <tr><td>⚔️ 流寇</td><td>治安栏 ×0.85</td></tr>
        <tr><td>☀️ 大旱</td><td>水利建筑不触发资源链路</td></tr>
        <tr><td>🚧 商路中断</td><td>经济栏 ×0.85</td></tr>
      </tbody></table>
      <p>灾异是「本关怎么打」的约束而非数值墙——洪涝多水泽、流寇/商路压栏、大旱断水利链，提前调整手牌与购买方向即可。</p>

      <h3>⑪ 拆建 / 迁建 · 修正盘面</h3>
      <p>第 ${D.DEMOLISH_UNLOCK} 关起可<b>拆建</b>：花 ${D.DEMOLISH_BASE} 金（每拆一次 +${D.DEMOLISH_STEP}）拆掉盘上一座建筑，卡回牌组循环、返还 ${D.DEMOLISH_INSP} 灵感；第 ${D.MOVE_UNLOCK} 关起可<b>迁建</b>：${D.MOVE_COST} 金移动一座建筑，每关 ${D.MOVES_PER_LEVEL} 次。第 ${D.DEMOLISH_UNLOCK} 关起普通关放置次数升至 <b>4 次</b>——拆建/迁建是后期金币的「真 sink」，也是布局失误的后悔药。</p>

      <h3>⑫ 余烬 / 印记 · 资源回收</h3>
      <p><b>余烬</b>：灵感满 ${D.INSP_CAP} 后再获得灵感会溢出为余烬；施展主动技灵感不足时，可用 <b>${D.EMBER_FREE_COST} 余烬</b>代偿一次。<b>诏令印记</b>：每达成一条诏令 +1 印记，集齐 <b>${D.SEAL_NEED}</b> 枚后，失败时可<b>圣旨重开</b>本关（保留牌组、金币与城市，但本关已落的建筑回手）。</p>

      <p class="lead">💡 <b>右键</b>任意卡放大看技能；<b>商店删牌</b>花金币（第1次 ${D.REMOVE_BASE}，逐次 +${D.REMOVE_STEP}），用来精简牌组。</p>
      <div class="row"><button class="btn seal" data-act="close">明白了</button></div>
    </div>`;
    openModal(html, true);
  }

  function bindGlobal() {
    $('#hand').addEventListener('click', (ev) => {
      const el = ev.target.closest('.card'); if (!el) return;
      handClick(el.dataset.uid);
    });
    $('#hand').addEventListener('contextmenu', (ev) => {
      const el = ev.target.closest('.card'); if (!el) return;
      ev.preventDefault(); openZoom(el.dataset.uid);
    });
    $('#board').addEventListener('click', (ev) => {
      const el = ev.target.closest('.cell'); if (!el) return;
      cellClick(+el.dataset.r, +el.dataset.c);
    });
    $('#board').addEventListener('contextmenu', (ev) => {
      const el = ev.target.closest('.cell'); if (!el) return;
      const inst = state.board[+el.dataset.r][+el.dataset.c];
      if (inst) { ev.preventDefault(); openZoom(inst.uid); }
    });
    // 悬停空格: 定性预览"放这里触发哪些机制"(不显示数字)
    $('#board').addEventListener('mouseover', (ev) => {
      if (mode !== 'place' || !heldUid) return;
      const cell = ev.target.closest('.cell.empty');
      if (!cell || cell.querySelector('.preview-tip')) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;
      const trigs = E.previewTriggers(state, heldUid, r, c);
      if (!trigs.length) return;
      const tip = document.createElement('div');
      tip.className = 'preview-tip';
      tip.innerHTML = '放这里触发：' + trigs.slice(0, 8).map((t) => `<span>${t}</span>`).join('') + (trigs.length > 8 ? `<span>+${trigs.length - 8}</span>` : '');
      cell.appendChild(tip);
    });
    $('#board').addEventListener('mouseout', (ev) => {
      const cell = ev.target.closest('.cell');
      if (cell) { const t = cell.querySelector('.preview-tip'); if (t) t.remove(); }
    });
    $('#jokers').addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act="joker"]'); if (!el) return;
      const r = E.activateJoker(state, el.dataset.uid);
      if (!r.ok) toast(r.msg); else render();
    });
    $('#overlay').addEventListener('click', (ev) => {
      if (ev.target.id === 'overlay') {
        if ($('#modal').dataset.dismiss === '1' && !shopOpen) closeModal();
        return;
      }
      if (propPick && !ev.target.closest('[data-act="close"]')) {
        const cardEl = ev.target.closest('.card');
        if (cardEl) { applyPropToCard(cardEl.dataset.uid); return; }
        const modouEl = ev.target.closest('[data-act="pickmodou"]');
        if (modouEl) { applyModou(modouEl.dataset.uid); return; }
        if (!ev.target.closest('[data-act]')) return;
      }
      const el = ev.target.closest('[data-act]'); if (!el) return;
      const act = el.dataset.act, data = el.dataset;
      if (act === 'close') { propPick = null; closeModal(); if (shopOpen) renderShop(); return; }
      if (act === 'shop-deck-peek') { showDeck(); return; }
      if (act === 'restart') { closeModal(); newGame(); return; }
      // [v2 P1] 圣旨重开: retryLevel 内部已 startLevel, UI 只复位状态并重渲染
      if (act === 'seal-retry') {
        const r = E.retryLevel(state);
        if (!r.ok) { toast(r.msg); return; }
        closeModal(); heldUid = null; pending = []; discardSel.clear(); mode = 'place'; moveSel = null; render();
        return;
      }
      if (act === 'useprop') { usePropFlow(data.uid); return; }
      if (act === 'joker') { const r = E.activateJoker(state, data.uid); if (!r.ok) toast(r.msg); else { render(); } return; }
      if (rewardView) {
        if (act === 'reward-pick') {
          const cand = rewardView.candidates[+data.i];
          E.acceptReward(state, cand);
          rewardView = null;
          toast('收入牌组：' + cand.name);
          sfx('win');
          renderShop(); return;
        }
        if (act === 'reward-skip') { rewardView = null; renderShop(); return; }
      }
      if (shopOpen) { shopAct(act, data); return; }
    });
    $('#btn-help').onclick = showHelp;
    $('#btn-deck').onclick = showDeck;
    $('#btn-audio').onclick = () => {
      audioOn = !audioOn;
      $('#btn-audio').textContent = audioOn ? '🔊' : '🔇';
      if (audioOn) sfx('place'); // 开启时给一声反馈
    };
    $('#btn-new').onclick = () => { if (confirm('放弃本局，开始新游戏？')) newGame(); };
    // 模态框内卡牌右键放大(覆盖: 牌组查看器 / 商店三选一 / 删牌列表)
    // 匹配优先级: .card[data-uid] > 外层 [data-deckuid] > 外层 [data-uid](三选一包装)
    // 防线1: overlay 冒泡阶段委托
    $('#overlay').addEventListener('contextmenu', (ev) => {
      let uid = null;
      const cardEl = ev.target.closest('.card');
      if (cardEl) uid = cardEl.dataset.uid;
      if (!uid) {
        const deckEl = ev.target.closest('[data-deckuid]');
        if (deckEl) uid = deckEl.dataset.deckuid;
      }
      if (!uid) {
        const wrapEl = ev.target.closest('[data-uid]');
        if (wrapEl && wrapEl !== ev.target.closest('.modal')) uid = wrapEl.dataset.uid;
      }
      if (!uid) return;
      ev.stopPropagation();
      ev.preventDefault();
      // 确保浏览器不弹默认菜单
      if (ev.returnValue !== false) ev.returnValue = false;
      openZoom(uid);
    });
    // 防线2: 捕获阶段(document级别), 在浏览器默认菜单处理之前拦截 .pack-card 右键
    // 这解决某些浏览器中冒泡阶段 preventDefault 不生效的问题
    document.addEventListener('contextmenu', (ev) => {
      const packCard = ev.target.closest('.pack-card');
      if (!packCard) return;
      const uid = packCard.dataset.uid;
      if (!uid) return;
      ev.stopPropagation();
      ev.preventDefault();
      if (ev.returnValue !== false) ev.returnValue = false;
      openZoom(uid);
    }, true); // true = capture phase
  }

  /* ===================================================================
   * 启动
   * =================================================================== */
  function newGame(seed) {
    state = E.createGame(seed || (Date.now() & 0xffffffff));
    heldUid = null; pending = []; discardSel.clear(); mode = 'place';
    moveSel = null; archNotified = {};
    shopOpen = false; shopView = null; propPick = null; rewardView = null;
    closeModal();
    enterLevel();
  }
  function enterLevel() {
    E.startLevel(state);
    heldUid = null; pending = []; discardSel.clear(); mode = 'place';
    render();
    if (state.level === 1 && !state.tutorialShown) showTutorial();
  }

  /* ---------- 首关引导弹窗(§11): 保证第一次落子必见回响 ---------- */
  function showTutorial() {
    state.tutorialShown = true;
    const html = `<div class="help-doc">
      <h2>第一关 · 营造引导</h2>
      <p class="lead">把那张高亮的 <strong>民居</strong> 从手牌点起，拖到 <span style="font-size:15px">🌾</span> <b>沃壤格</b>（下方那座衙门旁边）。落子后你会同时看到 <strong>地形 ×1.3</strong> 与 <strong>相邻功能加成（治安+6）</strong> 两条回响——这就是本游戏的核心：「落子见回响」。</p>
      <p>操作：点手牌拾起 → 点空格落子 → 点「确认营造」。<b>悬停</b>空格可看会触发哪些机制，<b>右键</b>任意卡放大看技能。</p>
      <p class="ds">本关配额很低，先感受落子的即时反馈，不必追求高分。顶部「📜 诏令」是每关额外小目标，达标多拿金币。</p>
      <div class="row"><button class="btn seal" data-act="close">开始营造</button></div>
    </div>`;
    openModal(html, true);
  }

  bindGlobal();
  newGame();
})();
