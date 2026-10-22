// 规则与状态：抓取、7 格槽、三消、撤销、洗牌、San、捣乱节奏、胜负。
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
  G.slotX = i => (i - 3) * 1.08;

  const S = (G.S = {});

  G.newGame = function () {
    S.tiles = G.newBoard();
    S.slot = [];
    S.history = [];
    S.shuffles = 3;
    S.san = 100;
    S.grabs = 0;
    S.state = 'play';
    S.endAt = 0;
    S.time = 0;
    S.nextEventAt = 12 + Math.floor(Math.random() * 3);
    S.event = null;
    S.particles = [];
    S.msg = null;
    if (G.monsterReset) G.monsterReset();
  };

  G.say = function (text, dur) { S.msg = { text, t: 0, dur: dur || 2.2 }; if (G.onMsg) G.onMsg(text, dur || 2.2); };

  G.boardLeft = () => S.tiles.filter(t => t.alive).length;

  G.canGrab = function (t) {
    if (S.state !== 'play' || !t.alive) return false;
    if (G.isCovered(t, S.tiles)) return false;
    if (G.pressBlocks && G.pressBlocks(t)) return false;
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
    t.alive = false;
    const [wx, wz] = G.boardToWorld(t.gx, t.gy);
    const item = { type: t.type, tile: t, x: wx, z: wz, h: G.baseH(t.layer), fly: 1 };
    insertSlot(item);
    S.history.push(item);
    S.grabs++;
    checkTriples();
    checkEnd();
    if (S.state === 'play' && !S.event && S.grabs >= S.nextEventAt && G.startEvent) {
      G.startEvent();
      const left = G.boardLeft() / G.TOTAL;            // 越往后越频繁
      S.nextEventAt = S.grabs + 4 + Math.floor(left * 4 + Math.random() * 3);
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
    G.assignTypes(board, G.liveSlot().map(it => it.type));
    board.forEach(t => (t.pop = 1));
    S.history = [];
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
})();
