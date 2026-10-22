// 16×16 像素供品：程序化点阵绘制，暗哑、潮湿、带血丝，不走卡通路线。
(function () {
  const G = window.G;
  const N = 16;
  const OUT = '#0d0a08';

  function grid() { return Array.from({ length: N }, () => Array(N).fill(null)); }
  function toCanvas(g) {
    const c = G.makeCanvas(N, N), x = c.getContext('2d');
    for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) if (g[y][i]) { x.fillStyle = g[y][i]; x.fillRect(i, y, 1, 1); }
    return c;
  }
  // 给形状描黑边
  function outline(g) {
    const o = grid();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== OUT) { o[y][x] = OUT; break; }
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (o[y][x]) g[y][x] = o[y][x];
  }

  // 眼球：pupil = round | slit | triple | ring
  function eye(seed, iris, irisDark, pupil, veinCount) {
    const r = G.mulberry(seed), g = grid();
    const cx = 7.5, cy = 7.5;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d <= 6.6) {
        let c = '#958c75';
        if (dx + dy > 3.5) c = '#6e6754';
        if (d > 5.6) c = dx + dy > 0 ? '#4c4638' : '#7b735f';
        if (dx + dy < -6) c = '#a69d85';
        g[y][x] = c;
      }
    }
    // 血丝：从边缘往里爬
    for (let v = 0; v < veinCount; v++) {
      const a = r() * Math.PI * 2;
      let x = cx + Math.cos(a) * 6, y = cy + Math.sin(a) * 6;
      const len = 3 + Math.floor(r() * 3);
      for (let k = 0; k < len; k++) {
        const X = Math.round(x), Y = Math.round(y);
        if (g[Y] && g[Y][X]) g[Y][X] = k < 2 ? '#6e1a16' : '#8a2a22';
        x += (cx - x) * 0.28 + (r() - 0.5) * 1.4;
        y += (cy - y) * 0.28 + (r() - 0.5) * 1.4;
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d <= 3.7) {
        g[y][x] = d > 2.8 ? irisDark : iris;
        let p = false;
        if (pupil === 'round') p = d <= 1.6;
        if (pupil === 'slit') p = Math.abs(dx) <= 0.6 && Math.abs(dy) <= 3.3;
        if (pupil === 'ring') p = (d > 1.0 && d <= 2.1) || (Math.abs(dx) <= 0.6 && Math.abs(dy) <= 0.6);
        if (pupil === 'triple') p = [[-1.5, -1], [1.5, -1], [0, 1.5]].some(([px, py]) => Math.hypot(dx - px, dy - py) <= 0.8);
        if (p) g[y][x] = '#050404';
      }
    }
    g[5][5] = '#d6cfbb'; g[5][6] = '#bfb8a3'; g[6][5] = '#bfb8a3';
    g[11][10] = '#a9a08a';
    outline(g);
    return toCanvas(g);
  }

  function tentacle() {
    const g = grid();
    const mask = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
    // 一段卷曲的触手：螺旋取点，圆形印章
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = 0.4 + t * 5.4, rad = 5.8 - t * 4.3;
      pts.push([7.5 + Math.cos(a) * rad, 8 + Math.sin(a) * rad * 0.9, 2.3 - t * 1.6]);
    }
    for (const [px, py, pr] of pts)
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
        if (Math.hypot(x - px, y - py) <= pr) mask(x, y, '#4e2d55');
    // 受光与背光
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!g[y][x]) continue;
      const up = y > 0 && !g[y - 1][x], dn = y < N - 1 && !g[y + 1][x];
      if (up) g[y][x] = '#7a5283';
      else if (dn) g[y][x] = '#2c1830';
    }
    // 吸盘
    for (let i = 4; i < 36; i += 5) {
      const [px, py] = pts[i];
      const a = 0.4 + (i / 40) * 5.4;
      const X = Math.round(px - Math.cos(a) * 1.1), Y = Math.round(py - Math.sin(a) * 1.0);
      if (g[Y] && g[Y][X]) g[Y][X] = '#b58a8c';
    }
    // 湿光
    mask(4, 5, '#c7a9c9'); mask(12, 9, '#a184a5');
    outline(g);
    return toCanvas(g);
  }

  function candle() {
    const g = grid();
    for (let y = 6; y <= 14; y++) for (let x = 5; x <= 10; x++) g[y][x] = x <= 6 ? '#a59872' : x >= 9 ? '#5f5640' : '#8a7e5c';
    // 蜡泪
    [[4, 8], [4, 9], [11, 10], [11, 11], [11, 12]].forEach(([x, y]) => (g[y][x] = '#7d7253'));
    g[6][4] = '#8a7e5c'; g[6][11] = '#8a7e5c';
    // 烛台
    for (let x = 2; x <= 13; x++) { g[14][x] = '#3a2f26'; g[15][x] = x > 2 && x < 13 ? '#241c16' : null; }
    // 嵌着的眼睛
    for (let y = 8; y <= 12; y++) for (let x = 6; x <= 9; x++) {
      const d = Math.hypot(x - 7.5, y - 10);
      if (d <= 2.1) g[y][x] = d <= 1.0 ? '#060404' : '#8c1f19';
    }
    g[9][6] = '#c9c1a8'; g[10][7] = '#060404'; g[10][8] = '#060404';
    // 烛芯与火苗（暗橙）
    g[5][7] = '#1a1410'; g[5][8] = '#1a1410';
    [[7, 4], [8, 4], [7, 3], [8, 3], [8, 2], [7, 1]].forEach(([x, y]) => (g[y][x] = y >= 4 ? '#b5651d' : '#d99a3a'));
    g[3][7] = '#e9c46a';
    outline(g);
    return toCanvas(g);
  }

  function statue(seed) {
    const r = G.mulberry(seed), g = grid();
    for (let y = 1; y < N; y++) for (let x = 0; x < N; x++) {
      const head = Math.hypot((x - 7.5) / 3.2, (y - 4.5) / 3.4) <= 1;
      const body = y >= 7 && y <= 13 && Math.abs(x - 7.5) <= 2.2 + (y - 7) * 0.45;
      const base = y >= 13 && Math.abs(x - 7.5) <= 6;
      if (head || body || base) g[y][x] = x < 6 ? '#7a7a70' : x > 9 ? '#3e3e38' : '#5c5c54';
    }
    // 头上的小触须
    [[5, 8], [6, 9], [9, 9], [10, 8], [7, 9], [8, 10]].forEach(([x, y]) => (g[y][x] = '#4a4a43'));
    // 裂纹
    let x = 9, y = 2;
    for (let k = 0; k < 11; k++) {
      if (g[y] && g[y][x]) g[y][x] = '#1c1c19';
      y++; x += r() < 0.5 ? -1 : r() < 0.6 ? 0 : 1; x = G.clamp(x, 3, 12);
    }
    g[14][4] = '#1c1c19'; g[13][5] = '#1c1c19'; g[14][11] = '#1c1c19';
    // 两只发绿光的小眼
    g[4][6] = '#7fae5a'; g[4][9] = '#7fae5a'; g[5][6] = '#3d5a2a'; g[5][9] = '#3d5a2a';
    outline(g);
    return toCanvas(g);
  }

  G.TYPES = [
    { key: 'red', name: '红瞳眼球' },
    { key: 'blue', name: '蓝瞳眼球' },
    { key: 'green', name: '绿瞳眼球' },
    { key: 'gold', name: '金色猫眼' },
    { key: 'tentacle', name: '触手' },
    { key: 'candle', name: '蜡烛' },
    { key: 'statue', name: '小雕像' },
  ];

  G.buildSprites = function () {
    // 三种眼球不只靠瞳色区分：红=圆瞳+重血丝，蓝=三瞳，绿=环瞳，金=竖瞳
    G.SPRITES = [
      eye(11, '#8e231c', '#5a120e', 'round', 9),
      eye(23, '#3f5f86', '#24384f', 'triple', 4),
      eye(37, '#4f7a3a', '#2d4a22', 'ring', 4),
      eye(41, '#c48a1c', '#7c520c', 'slit', 3),
      tentacle(),
      candle(),
      statue(5),
    ];
  };
})();
