// 祭盘：布局来自 levels.js（五个祭夜各有各的堆法）。只负责摆放、压住判定、可解的类型分配。
(function () {
  const G = window.G;

  const overlap = (a, b) => Math.abs(a.gx - b.gx) < 0.99 && Math.abs(a.gy - b.gy) < 0.99;
  G.overlap = overlap;

  // 当前夜的布局（main.js / game.js 在开局前已设好 G.level）
  G.curLayout = function () { const lv = G.LEVELS[G.level - 1]; return G.layoutFor(lv || G.LEVELS[0]); };
  G.TOTAL = function () { return G.curLayout().length; };

  G.isCovered = function (t, tiles) {
    for (const u of tiles) if (u.alive && u !== t && u.layer > t.layer && overlap(u, t)) return true;
    return false;
  };

  // 随机取一条合法的抓取顺序（每次只拿没被压住的）
  function removalOrder(list) {
    const alive = new Set(list), order = [];
    while (alive.size) {
      const arr = [...alive];
      const free = arr.filter(t => !arr.some(u => u !== t && u.layer > t.layer && overlap(u, t)));
      const pick = free[Math.floor(Math.random() * free.length)];
      order.push(pick); alive.delete(pick);
    }
    return order;
  }

  // 把成组的三张打散成两两交错，保证按 order 抓时槽位最多 5 格
  function interleave(triples) {
    const seq = [];
    for (let i = 0; i < triples.length; i += 2) {
      const chunk = [];
      for (let k = i; k < Math.min(i + 2, triples.length); k++) chunk.push(triples[k], triples[k], triples[k]);
      G.shuffle(chunk);
      seq.push(...chunk);
    }
    return seq;
  }

  // 给 boardTiles 分配类型：先补齐槽里已有的残组，再放整三张。保证存在一条通关顺序。
  // nT：这一夜用几种供品（腐眼宴之后的夜是 8 种）。
  G.assignTypes = function (boardTiles, slotTypes, nT) {
    nT = nT || G.TYPES.length;
    const counts = Array(nT).fill(0), inSlot = Array(nT).fill(0);
    if (slotTypes) slotTypes.forEach(t => inSlot[t]++);
    let needs = [];
    if (boardTiles.some(t => t.type != null)) {
      boardTiles.forEach(t => counts[t.type]++);
      for (let t = 0; t < nT; t++) {
        const need = (3 - (inSlot[t] % 3)) % 3;
        for (let k = 0; k < Math.min(need, counts[t]); k++) needs.push(t);
        counts[t] -= Math.min(need, counts[t]);
      }
    } else {
      const per = boardTiles.length / nT;
      counts.fill(per);
    }
    const triples = [];
    for (let t = 0; t < nT; t++) for (let k = 0; k < Math.floor(counts[t] / 3); k++) triples.push(t);
    G.shuffle(triples);
    // 残组按类型扎堆放在最前面
    needs.sort((a, b) => a - b);
    const seq = needs.concat(interleave(triples));
    // 触手正卷着的供品还没塞回来时，个别类型可能不是 3 的倍数：剩下的补在最后
    for (let t = 0; t < nT; t++) for (let k = 0; k < counts[t] % 3; k++) seq.push(t);
    const order = removalOrder(boardTiles);
    order.forEach((t, i) => (t.type = seq[i]));
  };

  G.newBoard = function () {
    const lv = G.LEVELS[G.level - 1] || G.LEVELS[0];
    const tiles = G.curLayout().map((p, i) => ({ id: i, gx: p.gx, gy: p.gy, layer: p.layer, type: null, alive: true, pop: 0, lift: 0 }));
    G.assignTypes(tiles, null, lv.types || G.TYPES.length);
    return tiles;
  };

  // 被卷走的供品要塞回「下层」：找空着、而且正被别的供品压住的位置
  G.buryPositions = function (tiles, n) {
    const L = G.curLayout();
    const alive = tiles.filter(t => t.alive);
    const vacant = L.filter(p => !alive.some(t => t.layer === p.layer && t.gx === p.gx && t.gy === p.gy));
    const covered = vacant.filter(p => alive.some(u => u.layer > p.layer && overlap(u, p)));
    G.shuffle(covered);
    covered.sort((a, b) => a.layer - b.layer);
    const pick = covered.slice(0, n);
    if (pick.length < n) {
      const rest = G.shuffle(vacant.filter(p => !pick.includes(p)));
      pick.push(...rest.slice(0, n - pick.length));
    }
    return pick;
  };
})();
