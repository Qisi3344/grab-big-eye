// 规则与状态：抓取、槽位、三消、撤销、洗牌、San、捣乱节奏、胜负。
// 每一夜的槽位数 / 供品种类 / 捣乱配方来自 levels.js；夜的特殊机制挂在 rites.js 的钩子上。
(function () {
  const G = window.G;
  const ROT = -0.035;               // 祭盘随手摆歪一点
  G.BOARD_C = [0, 3.9];
  G.SP = 1.2;               // 供品间距
  G.TILE_HALF = 0.45;
  G.BOARD_TOP = 0.2;
  G.LAYER_H = 0.24;
  G.SLOT_N = 7;
  G.SLOT_Z = -1.55;
  G.SLOT_HALF = 0.42;

  G.boardToWorld = function (gx, gy) {
    const x = (gx - 2.5) * G.SP, z = G.BOARD_C[1] + (2 - gy) * G.SP;
    const dx = x - G.BOARD_C[0], dz = z - G.BOARD_C[1];
    const c = Math.cos(ROT), s = Math.sin(ROT);
    return [G.BOARD_C[0] + dx * c - dz * s, G.BOARD_C[1] + dx * s + dz * c];
  };
  G.boardRot = ROT;
  G.tileTopH = layer => G.BOARD_TOP + (layer + 1) * G.LAYER_H;
  G.slotX = i => (i - (G.SLOT_N - 1) / 2) * 1.08;
  G.curLevel = () => G.LEVELS[G.level - 1] || G.LEVELS[0];

  const S = (G.S = {});

  G.newGame = function () {
    const lv = G.curLevel();
    G.SLOT_N = lv.slot || 7;
    // 槽位轨变宽变窄时，让近景取景跟着走
    G.RAIL_HW = Math.max(3.9, ((G.SLOT_N - 1) / 2) * 1.08 + 0.75);
    if (G.fitCameraPending) { G.fitCameraPending = false; if (G.refitCamera) G.refitCamera(); }
    S.tiles = G.newBoard();
    S.slot = [];
    S.history = [];
    S.shuffles = lv.shuffles != null ? lv.shuffles : 3;
    S.san = 100;
    S.grabs = 0;
    S.matches = 0;
    S.state = 'play';
    S.endAt = 0;
    S.time = 0;
    const ev = lv.event || { first: [12, 3], gap: [4, 3] };
    S.nextEventAt = ev.first[0] + Math.floor(Math.random() * ev.first[1]);
    S.event = null;
    S.particles = [];
    S.msg = null;
    G.MON_Z = 10.6;
    G.SHAKE = 0;
    if (G.riteInit) G.riteInit(lv);
    if (G.monsterReset) G.monsterReset();
  };

  G.say = function (text, dur) { S.msg = { text, t: 0, dur: dur || 2.2 }; if (G.onMsg) G.onMsg(text, dur || 2.2); };

  G.boardLeft = () => S.tiles.filter(t => t.alive).length;

  G.canGrab = function (t) {
    if (S.state !== 'play' || !t.alive) return false;
    if (G.isCovered(t, S.tiles)) return false;
    if (G.pressBlocks && G.pressBlocks(t)) return false;
    if (G.riteBlocks && G.riteBlocks(t)) return false;
    return true;
  };

  function insertSlot(item) {
    let idx = -1;
    for (let i = 0; i < S.slot.length; i++) if (S.slot[i].type === item.type && !S.slot[i].dying) idx = i;
    if (idx >= 0) S.slot.splice(idx + 1, 0, item); else S.slot.push(item);
  }
  G.liveSlot = () => S.slot.filter(it => !it.dying);

  function checkTriples() {
    const live = G.liveSlot();
    const by = {};
    live.forEach(it => (by[it.type] = (by[it.type] || 0) + 1));
    for (const k in by) if (by[k] >= 3) {
      let n = 0;
      for (const it of S.slot) if (!it.dying && it.type == k && n < 3) { it.dying = 0.0001; n++; }
      S.san = Math.min(100, S.san + 4);
      S.matches++;
      if (G.onMatch) G.onMatch(+k);          // 献给夜的仪式（腐眼不祥、血月升高等）
      if (G.setMood && Math.random() < 0.5) G.setMood('angry', 1.4);   // 你凑成三个，它不高兴
      S.history = [];
      return true;
    }
    return false;
  }

  function checkEnd() {
    if (S.state !== 'play') return;
    if (G.liveSlot().length >= G.SLOT_N) { S.state = 'lose'; S.endAt = S.time + 0.9; return; }
    if (G.boardLeft() === 0 && G.liveSlot().length === 0 && !(S.event && S.event.carried)) { S.state = 'win'; S.endAt = S.time + 1.0; }
  }
  G.checkEnd = checkEnd;

  G.grab = function (t) {
    if (!G.canGrab(t)) return false;
    if (G.riteOnGrab && G.riteOnGrab(t)) return false;   // 仪式可以先咬你一口再放行/拦下
    t.alive = false;
    const [wx, wz] = G.boardToWorld(t.gx, t.gy);
    const item = { type: t.type, tile: t, x: wx, z: wz, h: G.baseH(t.layer), fly: 1 };
    insertSlot(item);
    S.history.push(item);
    S.grabs++;
    checkTriples();
    checkEnd();
    if (G.onGrab) G.onGrab(t);
    if (S.state === 'play' && !S.event && S.grabs >= S.nextEventAt && G.startEvent) {
      G.startEvent();
      const left = G.boardLeft() / G.TOTAL();            // 越往后越频繁
      const ev = G.curLevel().event || { gap: [4, 3] };
      const moon = G.moonHaste ? G.moonHaste() : 1;      // 血月升得越高，它越急
      S.nextEventAt = S.grabs + (ev.gap[0] + Math.floor(left * 4 + Math.random() * ev.gap[1])) * moon;
    }
    return true;
  };

  G.undo = function () {
    if (S.state !== 'play') return;
    const item = S.history.pop();
    if (!item || item.dying || !S.slot.includes(item)) { G.say('这一步收不回来了'); return; }
    S.slot.splice(S.slot.indexOf(item), 1);
    item.tile.alive = true;
    item.tile.pop = 1;
  };

  G.doShuffle = function () {
    if (S.state !== 'play') return;
    if (S.shuffles <= 0) { G.say('洗牌用完了'); return; }
    const board = S.tiles.filter(t => t.alive);
    if (!board.length) return;
    S.shuffles--;
    G.assignTypes(board, G.liveSlot().map(it => it.type), G.curLevel().types || G.TYPES.length);
    board.forEach(t => (t.pop = 1));
    S.history = [];
    if (G.A) G.A.sfx('shuffle');
  };

  // 被触手卷走：从槽里拿掉，稍后塞回盘里被压住的位置
  G.stealTargets = function () {
    const live = G.liveSlot();
    const by = {};
    live.forEach(it => (by[it.type] = by[it.type] || []).push(it));
    const pairs = Object.values(by).filter(a => a.length === 2);
    if (pairs.length) return pairs[Math.floor(Math.random() * pairs.length)];
    if (live.length) return [live[live.length - 1]];
    return [];
  };
  G.removeFromSlot = function (items) {
    items.forEach(it => { const i = S.slot.indexOf(it); if (i >= 0) S.slot.splice(i, 1); });
    S.history = [];
    S.san = Math.max(0, S.san - 10);
  };
  G.buryItems = function (items) {
    const pos = G.buryPositions(S.tiles, items.length);
    items.forEach((it, i) => {
      const p = pos[i], t = it.tile;
      t.gx = p.gx; t.gy = p.gy; t.layer = p.layer; t.type = it.type; t.alive = true; t.pop = 1;
    });
  };

  // 调包：触手把槽里两件供品换掉（第四夜的舌头）
  G.swapTargets = function () {
    const live = G.liveSlot();
    if (live.length < 2) return [];
    const by = {};
    live.forEach(it => (by[it.type] = (by[it.type] || 0) + 1));
    const paired = live.filter(it => by[it.type] === 2);
    const a = paired.length ? paired[Math.floor(Math.random() * paired.length)] : live[Math.floor(Math.random() * live.length)];
    const rest = live.filter(it => it !== a && it.type !== a.type);
    if (!rest.length) return [];
    const b = rest[Math.floor(Math.random() * rest.length)];
    return [a, b];
  };
  G.swapInSlot = function (a, b) {
    const ta = a.type; a.type = b.type; b.type = ta;
    a.twist = 0.0001; b.twist = 0.0001;   // 交换时抖一下
    S.history = [];
  };
})();
