// 抓大眼 · 通用小工具
(function () {
  const G = (window.G = window.G || {});

  G.mulberry = function (seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.shuffle = function (arr, r) {
    r = r || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  G.pointInPoly = function (px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  G.distToSeg = function (px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = G.clamp(t, 0, 1);
    const x = ax + dx * t - px, y = ay + dy * t - py;
    return Math.sqrt(x * x + y * y);
  };
  G.distToPolyline = function (px, py, pts) {
    let best = 1e9, idx = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = G.distToSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < best) { best = d; idx = i; }
    }
    return { d: best, i: idx };
  };
  G.mixHex = function (a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(G.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    const g = Math.round(G.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    const bl = Math.round(G.lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
  // 二次贝塞尔采样
  G.bezier = function (a, c, b, n, upto) {
    upto = upto == null ? 1 : upto;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * upto, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return out;
  };
})();
(function () {
  const G = window.G;
  if (!G.makeCanvas) G.makeCanvas = function (w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };
})();
