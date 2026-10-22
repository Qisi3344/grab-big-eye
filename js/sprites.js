// 有体积的像素供品（24×24）：球体打光的眼球、圆柱蜡烛、盘卷的触手、小神像。
// 光从左上方的水面斜照下来；边缘硬切 + 黑描边，保持像素感。
(function () {
  const G = window.G;
  const N = 24;
  const OUT = [6, 10, 9];
  const L = (() => { const v = [-0.45, -0.6, 0.66]; const l = Math.hypot(...v); return v.map(x => x / l); })();

  function blank() { return Array.from({ length: N }, () => Array(N).fill(null)); }
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const shade = (rgb, k) => rgb.map(c => Math.round(G.clamp(c * k, 0, 255)));
  // 量化成几档明暗，像素画的「色阶」
  const band = k => (k > 1.05 ? 1.25 : k > 0.78 ? 1 : k > 0.52 ? 0.74 : k > 0.3 ? 0.52 : 0.36);

  function finish(g) {
    // 黑描边
    const o = blank();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== OUT) { o[y][x] = OUT; break; }
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (o[y][x]) g[y][x] = o[y][x];
    const c = G.makeCanvas(N, N), ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N), mask = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = g[y][x]; if (!p) continue;
      const i = (y * N + x) * 4;
      img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = 255;
      mask[y * N + x] = 1;
    }
    ctx.putImageData(img, 0, 0);
    // 暗版本（被压住时用）
    const d = G.makeCanvas(N, N), dc = d.getContext('2d');
    const di = dc.createImageData(N, N);
    for (let i = 0; i < img.data.length; i += 4) {
      di.data[i] = img.data[i] * 0.3; di.data[i + 1] = img.data[i + 1] * 0.36 + 4; di.data[i + 2] = img.data[i + 2] * 0.38 + 6; di.data[i + 3] = img.data[i + 3];
    }
    dc.putImageData(di, 0, 0);
    return { img: c, dim: d, mask };
  }

  // 球面法线打光
  function sphere(g, cx, cy, r, colorAt) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lam = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
      const k = band(0.25 + lam * 1.0);
      const base = colorAt(dx, dy, nz, x, y);
      g[y][x] = shade(base, k);
      // 镜面高光
      if (lam > 0.97) g[y][x] = [228, 236, 222];
    }
  }

  function eye(seed, irisHex, pupil, veins) {
    const r = G.mulberry(seed), g = blank();
    const cx = 11.5, cy = 11, R = 9.2;
    const iris = hex(irisHex), sclera = hex('#9c9178'), vein = hex('#7a1e18');
    // 视神经：一截暗红的筋拖在右下
    for (let t = 0; t < 1; t += 0.04) {
      const x = Math.round(cx + 6 + t * 5 + Math.sin(t * 6) * 1), y = Math.round(cy + 6 + t * 5);
      for (let k = -1; k <= 1; k++) if (y + k < N && x < N) g[y + k][x] = shade(hex('#5e1914'), 0.7 + (k < 0 ? 0.4 : 0));
    }
    const veinMap = new Set();
    for (let v = 0; v < veins; v++) {
      const a = r() * Math.PI * 2; let x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      for (let k = 0; k < 6; k++) { veinMap.add(Math.round(x) + ',' + Math.round(y)); x += (cx - x) * 0.2 + (r() - 0.5) * 1.6; y += (cy - y) * 0.2 + (r() - 0.5) * 1.6; }
    }
    sphere(g, cx, cy, R, (dx, dy, nz, x, y) => {
      // 虹膜朝向玩家（略偏下，像在看你的手）
      const ix = dx - 0.02, iy = dy - 0.12, id = Math.hypot(ix, iy);
      if (id < 0.42) {
        let p = false;
        if (pupil === 'round') p = id < 0.18;
        if (pupil === 'slit') p = Math.abs(ix) < 0.07 && Math.abs(iy) < 0.36;
        if (pupil === 'ring') p = (id > 0.12 && id < 0.24) || id < 0.05;
        if (pupil === 'triple') p = [[-0.16, -0.08], [0.16, -0.08], [0, 0.17]].some(([a, b]) => Math.hypot(ix - a, iy - b) < 0.09);
        if (p) return [8, 6, 6];
        return id > 0.34 ? shade(iris, 0.55) : iris;
      }
      if (veinMap.has(x + ',' + y)) return vein;
      return sclera;
    });
    return finish(g);
  }

  function tentacle() {
    const g = blank();
    const body = hex('#5a3363'), suck = hex('#c08c90');
    // 一段砍下来的触手尖：粗端在左下，卷成问号
    const pts = [];
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const a = Math.PI * 0.95 - t * Math.PI * 1.9;
      const rad = 8.6 * (1 - t * 0.82);
      pts.push([12.5 + Math.cos(a) * rad, 11 + Math.sin(a) * rad * 0.95, 3.9 - t * 3.0, a]);
    }
    // 从细尖往粗端印，粗端在最前面
    for (let i = pts.length - 1; i >= 0; i--) { const [px, py, pr] = pts[i]; sphere(g, px, py, pr, () => body); }
    // 截断面：粗端露出暗红的切口
    const [bx, by] = pts[0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot((x + 0.5 - bx + 1.5) / 1.6, (y + 0.5 - by) / 3.6) <= 1 && g[y][x]) g[y][x] = Math.hypot(x + 0.5 - bx + 1.5, y + 0.5 - by) < 1.6 ? hex('#a03a32') : hex('#6a1f1c');
    // 吸盘：在卷的内侧
    for (let i = 6; i < 60; i += 5) {
      const [px, py, pr, a] = pts[i];
      const x = Math.round(px - Math.cos(a) * pr * 0.7), y = Math.round(py - Math.sin(a) * pr * 0.7);
      if (g[y] && g[y][x]) { g[y][x] = suck; if (pr > 2.4 && g[y + 1] && g[y + 1][x]) g[y + 1][x] = shade(suck, 0.55); }
    }
    return finish(g);
  }

  function candle() {
    const g = blank();
    const wax = hex('#a2946c');
    // 圆柱体：横向用余弦打光
    for (let y = 8; y <= 21; y++) for (let x = 7; x <= 16; x++) {
      const u = (x + 0.5 - 12) / 5; if (Math.abs(u) > 1) continue;
      const nz = Math.sqrt(1 - u * u), lam = Math.max(0, u * L[0] + nz * L[2] * 0.9 + 0.15);
      g[y][x] = shade(wax, band(0.3 + lam));
    }
    // 顶面蜡池（椭圆）
    for (let y = 6; y <= 10; y++) for (let x = 7; x <= 16; x++) if (Math.hypot((x + 0.5 - 12) / 5, (y + 0.5 - 8) / 1.8) <= 1) g[y][x] = shade(wax, Math.hypot((x - 12) / 5, (y - 8) / 1.8) < 0.6 ? 0.8 : 1.15);
    // 蜡泪
    [[7, 11], [7, 12], [7, 13], [16, 10], [16, 11], [16, 12], [16, 13], [16, 14], [11, 10]].forEach(([x, y]) => (g[y][x] = shade(wax, 0.85)));
    // 烛台（铜绿）
    for (let y = 20; y <= 23; y++) for (let x = 3; x <= 20; x++) if (Math.hypot((x + 0.5 - 12) / 9, (y + 0.5 - 21.5) / 2.2) <= 1) g[y][x] = shade(hex('#3c5a4e'), y <= 20 ? 1.2 : y >= 22 ? 0.5 : 0.85);
    // 嵌着的眼
    for (let y = 12; y <= 17; y++) for (let x = 9; x <= 14; x++) {
      const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 14.5);
      if (d <= 2.6) g[y][x] = d <= 1.1 ? [8, 5, 5] : d <= 2 ? hex('#8a1d16') : hex('#7d7356');
    }
    g[13][10] = [214, 206, 186];
    // 烛芯与火苗
    g[6][12] = [20, 14, 10]; g[5][12] = [20, 14, 10];
    [[11, 4], [12, 4], [12, 3], [11, 3], [12, 2], [12, 1], [13, 3]].forEach(([x, y]) => (g[y][x] = y >= 4 ? hex('#c26a1e') : hex('#e2a43c')));
    g[3][12] = hex('#f2d27a');
    return finish(g);
  }

  function statue(seed) {
    const r = G.mulberry(seed), g = blank();
    const stone = hex('#6d7a72');
    for (let y = 1; y < N; y++) for (let x = 0; x < N; x++) {
      let nx = null;
      const hd = Math.hypot((x + 0.5 - 12) / 4.6, (y + 0.5 - 6.5) / 5);
      if (hd <= 1) nx = (x + 0.5 - 12) / 4.6;
      const bw = 3.4 + (y - 11) * 0.45;
      if (y >= 11 && y <= 19 && Math.abs(x + 0.5 - 12) <= bw) nx = (x + 0.5 - 12) / bw;
      if (y >= 19 && Math.abs(x + 0.5 - 12) <= 8) nx = (x + 0.5 - 12) / 8;
      if (nx == null) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
      g[y][x] = shade(stone, band(0.3 + Math.max(0, nx * L[0] + nz * L[2] + (y < 4 ? 0.2 : 0))));
    }
    // 小翅膀
    for (let y = 9; y <= 15; y++) for (const sd of [-1, 1]) for (let k = 0; k < 4 - Math.abs(y - 11) * 0.6; k++) { const x = 12 + sd * (5 + k); if (x >= 0 && x < N && !g[y][x]) g[y][x] = shade(stone, 0.55); }
    // 胡须触手
    for (const x of [9, 11, 13, 15]) for (let y = 9; y <= 12 + (x % 3); y++) g[y][x] = shade(stone, 0.6);
    // 裂纹
    let x = 14, y = 2;
    for (let k = 0; k < 18; k++) { if (g[y] && g[y][x]) g[y][x] = [22, 28, 26]; y++; x += r() < 0.4 ? -1 : r() < 0.6 ? 0 : 1; x = G.clamp(x, 6, 18); }
    // 底座青苔
    for (let k = 0; k < 10; k++) { const X = 4 + Math.floor(r() * 16), Y = 19 + Math.floor(r() * 4); if (g[Y] && g[Y][X]) g[Y][X] = hex('#3f6a32'); }
    // 发绿光的小眼
    g[6][10] = hex('#8fe06a'); g[6][14] = hex('#8fe06a'); g[7][10] = hex('#3d7a2a'); g[7][14] = hex('#3d7a2a');
    return finish(g);
  }

  G.SPR_N = N;
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
    const S = [
      eye(11, '#9a2a20', 'round', 10),
      eye(23, '#41648c', 'triple', 4),
      eye(37, '#527e3c', 'ring', 4),
      eye(41, '#d0951f', 'slit', 3),
      tentacle(),
      candle(),
      statue(5),
    ];
    G.SPRITES = S.map(s => s.img);
    G.SPRITES_DIM = S.map(s => s.dim);
    G.SPRITE_MASK = S.map(s => s.mask);
  };
})();
