// 坐在对面的克苏鲁：裂纹石颅、压低的眉骨、两只绿光眼、八条面部触手、两侧盘圈的触手、两条手臂，外加背景眼墙。
// 以及两种捣乱：卷走供品、压盘遮挡；玩家可以戳、可以拖。
(function () {
  const G = window.G, S = G.S;
  const M = (G.M = {});
  const TAU = Math.PI * 2;

  const PAL_FACE = { out: '#030807', dark: '#101c19', body: '#33453e', light: '#8aa59a', sucker: '#7a4a44', red: '#c0301f', moss: '#4f8a3a' };
  const PAL_FACE2 = { out: '#030807', dark: '#0c1714', body: '#2a3a34', light: '#7c968b', sucker: '#7a4a44', red: '#b02a1c', moss: '#4f8a3a' };
  const PAL_BACK = { out: '#020605', dark: '#0a1412', body: '#1c2b27', light: '#557067', sucker: '#55302c', moss: '#355f2b' };
  const PAL_EVENT = { out: '#030807', dark: '#11221d', body: '#2b4438', light: '#6f9480', sucker: '#82322a', moss: '#4a7e3a' };

  // 表情：angry 恼怒 / smug 得意 / hurt 吃痛；stare（盯着你）由槽位快满时自动出现
  G.setMood = function (kind, dur) { if (M.mood) { M.mood.kind = kind; M.mood.t = 0; M.mood.dur = dur || 1.8; } };
  G.monsterReset = function () {
    M.faceSq = Array(9).fill(0).map(() => ({ t: 9 }));
    M.armSq = [{ t: 9 }, { t: 9 }];
    M.eyeBlink = 0; M.eyeSquint = { t: 9 }; M.mood = { kind: '', t: 9, dur: 0 };
    M.drips = []; M.dripT = 0;
    const r = G.mulberry(777);
    M.wallEyes = [];
    M.wallSeed = 99;
    for (let i = 0; i < 16; i++) M.wallEyes.push({ u: r(), v: r(), size: 0.7 + r() * 0.6, open: 0, delay: 0.25 + i * 0.11 + r() * 0.2, blink: 2 + r() * 5, bt: 0 });
    M.intro = 0;
  };

  // —— 通用：Q 弹值（压扁再弹回） ——
  const squash = t => (t > 1.2 ? 0 : Math.exp(-5 * t) * Math.sin(16 * t + 0.6) * 0.9);

  // —— 通用：画一条像素触手 ——
  function resample(pts, step) {
    const out = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const L = Math.hypot(bx - ax, by - ay);
      let d = step - acc;
      while (d <= L) { const t = d / L; out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); d += step; }
      acc = (acc + L) % step;
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  G.drawTentacle = function (ctx, pts, r0, r1, pal, opt) {
    opt = opt || {};
    if (pts.length < 2) return;
    let P = resample(pts, 0.9);
    const n = P.length, sq = opt.sq || 0, base = P[0];
    if (sq) P = P.map(([x, y]) => [base[0] + (x - base[0]) * (1 - 0.3 * sq), base[1] + (y - base[1]) * (1 - 0.3 * sq)]);
    const rad = i => Math.max(0.6, G.lerp(r0, r1, Math.pow(i / (n - 1), 0.85)) * (1 + 0.55 * sq) * (opt.thin ? opt.thin(i / (n - 1)) : 1));
    const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    const nrm = i => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1; return [nx / l, ny / l];
    };
    for (let i = 0; i < n; i++) dot(P[i][0], P[i][1], rad(i) + 1, pal.out);
    for (let i = 0; i < n; i++) dot(P[i][0], P[i][1], rad(i), pal.dark);
    for (let i = 0; i < n; i++) { const r = rad(i); dot(P[i][0] - r * 0.12, P[i][1] - r * 0.2, r * 0.7, pal.body); }
    // 石质斑点：亮暗像素点撒在皮上，去掉“塑料管”的感觉
    const rr = G.mulberry(31 + (opt.seed || 0) * 7);
    for (let i = 0; i < n; i++) {
      const r = rad(i); if (r < 1.5) continue;
      const cnt = r > 5 ? 3 : 1;
      for (let k = 0; k < cnt; k++) {
        const [nx, ny] = nrm(i), o = (rr() - 0.5) * 1.6 * r;
        const v = rr();
        ctx.fillStyle = v < 0.45 ? pal.dark : v < 0.8 ? pal.light + '66' : pal.out + 'aa';
        ctx.fillRect(Math.round(P[i][0] + nx * o), Math.round(P[i][1] + ny * o), 1, 1);
      }
    }
    // 边缘的冷光（朝上那侧）
    for (let i = 1; i < n - 1; i++) {
      const r = rad(i); if (r < 1.6) continue;
      let [nx, ny] = nrm(i); if (ny > 0) { nx = -nx; ny = -ny; }
      ctx.fillStyle = pal.light + 'aa';
      ctx.fillRect(Math.round(P[i][0] + nx * r * 0.78), Math.round(P[i][1] + ny * r * 0.78), 1, 1);
    }
    // 吸盘：一排小方块，贴在一侧边缘
    if (opt.suckers !== false) {
      const every = Math.max(3, Math.round(Math.max(r0, 3) * 1.1));
      const sc = opt.suckerColor || pal.sucker;
      for (let i = Math.round(n * 0.12); i < n - 2; i += every) {
        const r = rad(i);
        if (r < 1.4) continue;
        let [nx, ny] = nrm(i);
        if (opt.sideX ? Math.sign(nx || 1) !== opt.sideX : ny < 0) { nx = -nx; ny = -ny; }
        const lift = opt.lift ? opt.lift(i / (n - 1)) : 0;
        const sx = P[i][0] + nx * r * 0.82, sy = P[i][1] + ny * r * 0.82 - lift;
        const sz = Math.max(1, Math.round(r * 0.24));
        if (sz >= 2) { ctx.fillStyle = pal.out; ctx.fillRect(Math.round(sx - sz / 2) - 1, Math.round(sy - sz / 2) - 1, sz + 2, sz + 2); }
        ctx.fillStyle = sc; ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
        if (sz >= 3) { ctx.fillStyle = pal.out; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
      }
    }
    // 缠在上面的藤蔓水草：一条细线绕着触手打转
    if (pal.moss && opt.moss !== false && r0 > 3) {
      ctx.strokeStyle = pal.moss + 'cc'; ctx.lineWidth = 1;
      const ph = rr() * TAU, from = Math.floor(rr() * n * 0.3), to = Math.min(n - 1, from + Math.floor(n * (0.25 + rr() * 0.3)));
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const r = rad(i), [nx, ny] = nrm(i), w = Math.sin(i * 0.09 + ph) * r * 0.8;
        const x = P[i][0] + nx * w, y = P[i][1] + ny * w;
        i === from ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = pal.moss;
      for (let k = 0; k < 4; k++) {           // 垂下的几缕
        const i = from + Math.floor(rr() * (to - from + 1)), r = rad(i);
        const L = 2 + Math.round(rr() * r);
        for (let j = 0; j < L; j++) ctx.fillRect(Math.round(P[i][0] + (rr() - 0.5) * r), Math.round(P[i][1] + r * 0.6 + j), 1, 1);
      }
    }
    return P;
  };

  // —— 头的位置（屏幕）。凝视惊吓/黑暗终局会把祂推近（G.MON_Z），血月满时祂会起身（G.RISE） ——
  M.layout = function () {
    const [hx, hy, s] = G.proj(0, 2.6, G.MON_Z || 10.6);
    const rise = G.RISE || 0;
    M.hx = hx; M.hy = hy - s * 1.6 * rise * 0.85; M.u = s * 1.6 * (1 + rise * 0.1);
    M.ub = G.proj(0, 1.6, 3.5)[2];
  };

  // —— 背景石墙与眼墙 ——
  M.drawWall = function (ctx, W, H) {
    const bottom = G.proj(0, 0, 9.2)[1];
    M.wallBottom = bottom;
    // 眼墙
    const san = S.san / 100;
    for (const e of M.wallEyes) {
      let x = e.u * W, y = 6 + e.v * (bottom - 22);
      const dx = (x - M.hx) / (M.u * 2.2), dy = (y - M.hy) / (M.u * 2.4);
      if (dx * dx + dy * dy < 1) x = dx < 0 ? M.hx - M.u * 2.3 - e.u * M.u : M.hx + M.u * 2.3 + e.u * M.u;
      e.sx = x; e.sy = y;
      drawWallEye(ctx, x, y, Math.max(4, M.u * 0.3 * e.size), e.open, san);
    }
  };

  function lookOffset(x, y, max) {
    const p = G.pointer || { x: x, y: y + 40 };
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 60) * max;
    return [(dx / d) * k, (dy / d) * k];
  }

  function drawWallEye(ctx, x, y, r, open, san) {
    // 嵌在石缝里的眼：肉色眼睑、发黄的眼白、浑浊的虹膜
    ctx.fillStyle = '#1b100c';
    ctx.beginPath(); ctx.ellipse(x, y, r + 1.5, r * 0.62 + 1.2, 0, 0, TAU); ctx.fill();
    if (open < 0.04) { ctx.fillStyle = '#3a221b'; ctx.fillRect(Math.round(x - r), Math.round(y), Math.round(r * 2), 1); return; }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, r, Math.max(0.6, r * 0.55 * open), 0, 0, TAU); ctx.clip();
    ctx.fillStyle = G.mixHex('#5a523f', '#5a2f26', 1 - san); ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - r, y - r, r * 2, r * 0.45);
    ctx.strokeStyle = 'rgba(110,18,14,0.9)'; ctx.lineWidth = 0.7;
    for (let k = 0; k < 6; k++) { const a = k * 1.13 + 0.3, sd = Math.cos(a) > 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(x + sd * r, y + Math.sin(a) * r * 0.3); ctx.lineTo(x + sd * r * 0.4, y + Math.sin(a * 2) * r * 0.15); ctx.stroke(); }
    const [ox, oy] = lookOffset(x, y, r * 0.42);
    ctx.fillStyle = G.mixHex('#4a3b1c', '#7a120d', 1 - san);
    ctx.beginPath(); ctx.arc(x + ox, y + oy * 0.4, r * 0.36, 0, TAU); ctx.fill();
    ctx.fillStyle = '#020101';
    ctx.beginPath(); ctx.ellipse(x + ox, y + oy * 0.4, r * 0.08 + 0.4, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(210,200,170,0.55)'; ctx.fillRect(Math.round(x + ox - r * 0.2), Math.round(y + oy * 0.4 - r * 0.2), 1, 1);
    ctx.restore();
    // 上眼睑的阴影
    ctx.strokeStyle = '#2d1913'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r, Math.max(0.6, r * 0.55 * open), 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  }

  function waveBezier(a, c, b, n, time, amp, ph, u) {
    const P = G.bezier(a, c, b, n);
    return P.map(([x, y], i) => {
      const t = i / n;
      return [x + Math.sin(time * 0.7 + ph + t * 5) * amp * u * t, y + Math.cos(time * 0.6 + ph + t * 4) * amp * u * t];
    });
  }
  // 盘成大圈的触手：从肩部出发，向外、向上、再卷回来
  function spiralPts(sx, sy, sd, R0, turns, a0, time, ph) {
    const u = M.u, pts = [];
    const cx = sx - Math.cos(a0) * R0, cy = sy - Math.sin(a0) * R0;
    const N = 34;
    for (let j = 0; j <= N; j++) {
      const t = j / N;
      const a = a0 - sd * t * turns * TAU + Math.sin(time * 0.6 + ph) * 0.12 * t;
      const r = R0 * (1 - 0.62 * t) * (1 + Math.sin(time * 0.8 + ph + t * 4) * 0.04);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }
  // 头顶后面卷起的细触手（问号形）
  function curlPts(sx, sy, sd, h, time, ph) {
    const u = M.u, pts = [], rc = u * 0.38;
    const sw = Math.sin(time * 0.9 + ph) * u * 0.15;
    for (let j = 0; j <= 14; j++) { const k = j / 14; pts.push([sx + sd * u * 0.35 * k + sw * k * k, sy - h * k]); }
    const top = pts[pts.length - 1], cx = top[0] + sd * rc, cy = top[1];
    const a0 = sd > 0 ? Math.PI : 0;
    for (let j = 1; j <= 16; j++) {
      const k = j / 16, a = a0 + sd * k * Math.PI * 1.7, r = rc * (1 - k * 0.45);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }

  // 有 WebGL 时用 three.js 的 3D 克苏鲁（monster3d.js），否则用下面的 2D 画法
  function use3D() {
    const M3 = G.M3;
    if (!M3 || (typeof location !== 'undefined' && /[?&]2d\b/.test(location.search))) return false;
    if (!M3.tried) M3.init();
    return M3.ok;
  }
  M.drawBack = function (ctx, time, W, H) {
    if (use3D()) return;
    const { hx, hy, u } = M;
    // 身后暗沉的一团触手肉
    const g = ctx.createRadialGradient(hx, hy + u * 0.8, u * 0.3, hx, hy + u * 1.0, u * 3.2);
    g.addColorStop(0, '#16261f'); g.addColorStop(1, 'rgba(4,10,9,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(hx, hy + u * 1.0, u * 3.4, u * 2.2, 0, 0, TAU); ctx.fill();
    // 头顶后面卷起的细触手
    for (const sd of [-1, 1]) {
      G.drawTentacle(ctx, curlPts(hx + sd * u * 1.15, hy - u * 1.3, sd, u * 1.9, time, sd), u * 0.3, u * 0.05, PAL_BACK, { seed: 40 + sd, suckers: false, moss: false });
      G.drawTentacle(ctx, curlPts(hx + sd * u * 1.7, hy - u * 0.5, sd, u * 1.3, time, sd * 2 + 1), u * 0.26, u * 0.05, PAL_BACK, { seed: 44 + sd, suckers: false, moss: false });
    }
    // 身后的粗触手：左右各三条，波浪着伸出屏幕
    M.backPaths = [];
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
      const a = [hx + sd * u * (0.9 + k * 0.25), hy + u * (0.3 + k * 0.5)];
      const endX = sd > 0 ? W + u * (1.2 + k * 0.4) : -u * (1.2 + k * 0.4);
      const endY = hy + u * (-1.8 + k * 1.6);
      const c = [hx + sd * u * (2.4 + k * 0.6), hy + u * [-2.6, 2.2, -0.4][k]];
      const P = waveBezier(a, c, [endX, endY], 30, time, 0.5, k * 1.7 + sd, u).map(([x, y], i) => {
        const t = i / 30; return [x, y + Math.sin(t * Math.PI * 3 + k + time * 0.4) * u * 0.45 * Math.sin(t * Math.PI)];
      });
      M.backPaths.push(P);
      G.drawTentacle(ctx, P, u * (0.5 - k * 0.04), u * (0.22 - k * 0.02), PAL_BACK, { seed: k * 3 + sd });
    }
    // 鳍状的耳朵（在头后面）
    for (const sd of [-1, 1]) {
      const bx = hx + sd * u * 1.05, by = hy - u * 0.15;
      ctx.fillStyle = '#030807';
      ctx.beginPath(); ctx.moveTo(bx, by - u * 0.9); ctx.lineTo(bx + sd * u * 1.05, by - u * 1.15); ctx.lineTo(bx + sd * u * 0.95, by + u * 0.15); ctx.lineTo(bx + sd * u * 0.55, by + u * 0.75); ctx.lineTo(bx, by + u * 0.4); ctx.fill();
      ctx.fillStyle = '#14231e';
      ctx.beginPath(); ctx.moveTo(bx, by - u * 0.8); ctx.lineTo(bx + sd * u * 0.95, by - u * 1.02); ctx.lineTo(bx + sd * u * 0.86, by + u * 0.1); ctx.lineTo(bx + sd * u * 0.5, by + u * 0.62); ctx.lineTo(bx, by + u * 0.32); ctx.fill();
      ctx.strokeStyle = '#2b4038'; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(bx + sd * u * 0.1, by - u * 0.2 + k * u * 0.2); ctx.lineTo(bx + sd * u * (0.9 - k * 0.12), by - u * (0.9 - k * 0.45)); ctx.stroke(); }
    }
    // 两侧盘成大圈的触手
    M.loopPaths = [];
    for (const sd of [-1, 1]) {
      const P1 = spiralPts(hx + sd * u * 1.15, hy + u * 0.75, sd, u * 1.25, 1.05, sd < 0 ? 0 : Math.PI, time, sd);
      G.drawTentacle(ctx, P1, u * 0.44, u * 0.1, PAL_FACE, { seed: 50 + sd, sideX: undefined });
      M.loopPaths.push(P1);
      const P2 = spiralPts(hx + sd * u * 1.0, hy + u * 1.35, sd, u * 0.95, -0.85, sd < 0 ? 0 : Math.PI, time, sd + 3);
      G.drawTentacle(ctx, P2, u * 0.38, u * 0.09, PAL_FACE, { seed: 53 + sd });
      M.loopPaths.push(P2);
    }
  };

  // 面部触手：从口鼻下方垂下，中间收拢、末端外翻
  function faceTentaclePts(i, time) {
    const { hx, hy, u } = M;
    const k = (i - 2.5) / 2.5;                       // -1..1
    const ak = Math.abs(k);
    const bx = hx + k * u * 0.95, by = hy + u * (0.5 + (1 - ak) * 0.15);
    const len = u * (2.2 + (1 - ak) * 1.3 + ((i * 37) % 5) * 0.08);
    const pts = [];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14;
      const sway = Math.sin(time * 1.0 + i * 1.9 + t * 3.2) * u * 0.18 * t;
      const pinch = -k * u * 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.3));
      const flare = k * u * (0.9 + ak * 0.6) * Math.pow(t, 3);
      const curlUp = ak > 0.6 ? -Math.pow(Math.max(0, t - 0.7) / 0.3, 2) * u * 0.6 : 0;
      pts.push([bx + pinch + flare + sway, by + len * t + curlUp]);
    }
    return pts;
  }
  // 两条最粗的手臂：沿着祭台两侧爬出屏幕
  function armPts(sd, time, W, H) {
    const { hx, hy, u } = M;
    const a = [hx + sd * u * 1.3, hy + u * 1.1];
    const mid = G.proj(sd * 5.2, 0.4, 5.5);
    const end = [sd > 0 ? W + u * 1.0 : -u * 1.0, G.proj(0, 0, 1.2)[1] + Math.sin(time * 0.5 + sd) * u * 0.2];
    const P1 = waveBezier(a, [a[0] + sd * u * 1.4, a[1] + u * 0.1], mid, 12, time, 0.2, sd, u);
    const P2 = waveBezier(mid, [mid[0] + sd * u * 0.4, (mid[1] + end[1]) / 2 + u * 0.6], end, 14, time, 0.15, sd * 2, u);
    return P1.concat(P2.slice(1));
  }

  // 头：高耸的裂纹石颅
  function drawHead(ctx, hx, hy, u, bob, time) {
    const cy = hy - u * 1.25 + bob;
    const RX = u * 1.62, RY = u * 1.55;
    ctx.fillStyle = '#030807';
    ctx.beginPath(); ctx.ellipse(hx, cy, RX + 1.5, RY + 1.5, 0, 0, TAU); ctx.fill();
    // 头底下连到脸的部分（略宽的下颌）
    ctx.beginPath(); ctx.ellipse(hx, hy + u * 0.05 + bob, u * 1.35 + 1.5, u * 0.95 + 1.5, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(hx - u * 0.45, cy - u * 0.9, u * 0.15, hx, cy + u * 0.3, RY * 1.15);
    g.addColorStop(0, '#71837b'); g.addColorStop(0.3, '#4c5d56'); g.addColorStop(0.7, '#25332e'); g.addColorStop(1, '#0a1210');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(hx, cy, RX, RY, 0, 0, TAU); ctx.fill();
    const g2 = ctx.createLinearGradient(0, hy - u * 0.8, 0, hy + u * 0.9);
    g2.addColorStop(0, '#3a4a44'); g2.addColorStop(1, '#101a17');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.ellipse(hx, hy + u * 0.05 + bob, u * 1.35, u * 0.95, 0, 0, TAU); ctx.fill();
    // 石面颗粒
    const r = G.mulberry(4242);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(hx, cy, RX, RY, 0, 0, TAU); ctx.clip();
    for (let k = 0; k < RX * RY * 0.12; k++) {
      const x = hx + (r() - 0.5) * RX * 2, y = cy + (r() - 0.5) * RY * 2, v = r();
      ctx.fillStyle = v < 0.4 ? 'rgba(4,10,9,0.35)' : v < 0.7 ? 'rgba(170,190,180,0.14)' : 'rgba(40,60,52,0.4)';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // 裂纹：从头顶往下爬、带分叉的石缝
    ctx.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      let x = hx + (r() - 0.5) * RX * 1.6, y = cy - RY * (0.75 + r() * 0.2);
      const pts = [[x, y]];
      for (let j = 0; j < 6; j++) { x += (r() - 0.5) * u * 0.45; y += u * (0.18 + r() * 0.2); pts.push([x, y]); }
      ctx.strokeStyle = 'rgba(2,6,5,0.9)';
      ctx.beginPath(); pts.forEach(([a, b], j) => j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,170,160,0.25)';
      ctx.beginPath(); pts.forEach(([a, b], j) => j ? ctx.lineTo(a + 1, b) : ctx.moveTo(a + 1, b)); ctx.stroke();
      if (r() < 0.7) {
        const [bx, by] = pts[2 + Math.floor(r() * 3)];
        ctx.strokeStyle = 'rgba(2,6,5,0.8)';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + (r() < 0.5 ? -1 : 1) * u * 0.4, by + u * 0.25); ctx.stroke();
      }
    }
    // 苔藓斑块
    for (let k = 0; k < 9; k++) {
      const px = hx + (r() - 0.5) * RX * 1.5, py = cy - RY * 0.2 + (r() - 0.5) * RY * 1.2;
      for (let j = 0; j < 14; j++) {
        ctx.fillStyle = r() < 0.5 ? '#3f6b30' : '#2b4d24';
        ctx.fillRect(Math.round(px + (r() - 0.5) * u * 0.35), Math.round(py + (r() - 0.5) * u * 0.25), 1, 1);
      }
    }
    // 额头上一枚暗淡的刻印
    const fx = hx, fy = cy + RY * 0.12;
    const pulse = 0.25 + 0.15 * Math.sin(time * 1.3);
    ctx.strokeStyle = `rgba(90,200,150,${pulse})`;
    ctx.beginPath(); ctx.moveTo(fx, fy - u * 0.16); ctx.lineTo(fx + u * 0.13, fy); ctx.lineTo(fx, fy + u * 0.16); ctx.lineTo(fx - u * 0.13, fy); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = `rgba(90,200,150,${pulse})`; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    // 头顶受光的一抹湿光
    ctx.fillStyle = 'rgba(190,230,215,0.16)';
    ctx.beginPath(); ctx.ellipse(hx - u * 0.45, cy - RY * 0.72, u * 0.45, u * 0.16, -0.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 脸：压低的眉骨、深眼窝、鼻梁、两颊
  function drawFace(ctx, hx, hy, u, bob) {
    const ey = hy - u * 0.05 + bob;
    // 眼窝
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#040908';
      ctx.beginPath(); ctx.ellipse(hx + sd * u * 0.6, ey, u * 0.44, u * 0.3, sd * 0.25, 0, TAU); ctx.fill();
    }
    // 鼻梁 / 口鼻
    const ng = ctx.createLinearGradient(hx - u * 0.25, 0, hx + u * 0.25, 0);
    ng.addColorStop(0, '#18241f'); ng.addColorStop(0.45, '#4d5f57'); ng.addColorStop(1, '#141f1b');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.moveTo(hx - u * 0.12, ey - u * 0.25); ctx.lineTo(hx + u * 0.12, ey - u * 0.25); ctx.lineTo(hx + u * 0.3, ey + u * 0.62); ctx.lineTo(hx - u * 0.3, ey + u * 0.62); ctx.fill();
    // 两颊鼓起
    for (const sd of [-1, 1]) {
      const cg = ctx.createRadialGradient(hx + sd * u * 0.6, ey + u * 0.3, 1, hx + sd * u * 0.62, ey + u * 0.4, u * 0.5);
      cg.addColorStop(0, '#4a5b54'); cg.addColorStop(1, 'rgba(16,26,23,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(hx + sd * u * 0.62, ey + u * 0.42, u * 0.5, u * 0.38, 0, 0, TAU); ctx.fill();
    }
    // 眉骨：粗重、向中间压下（怒相）
    for (const sd of [-1, 1]) {
      const pts = [[hx + sd * u * 0.06, ey - u * 0.14], [hx + sd * u * 1.15, ey - u * 0.55], [hx + sd * u * 1.22, ey - u * 0.28], [hx + sd * u * 0.9, ey - u * 0.2], [hx + sd * u * 0.2, ey + u * 0.03]];
      ctx.fillStyle = '#030807';
      ctx.beginPath(); pts.forEach(([a, b], j) => j ? ctx.lineTo(a, b + 1.5) : ctx.moveTo(a, b + 1.5)); ctx.closePath(); ctx.fill();
      const bg = ctx.createLinearGradient(0, ey - u * 0.45, 0, ey + u * 0.05);
      bg.addColorStop(0, '#7d8f87'); bg.addColorStop(0.5, '#4b5d55'); bg.addColorStop(1, '#1d2b26');
      ctx.fillStyle = bg;
      ctx.beginPath(); pts.forEach(([a, b], j) => j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fill();
      // 眉间的皱褶
      ctx.strokeStyle = 'rgba(3,8,7,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx + sd * u * 0.1, ey - u * 0.35); ctx.lineTo(hx + sd * u * 0.05, ey - u * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + sd * u * 0.35, ey - u * 0.5); ctx.quadraticCurveTo(hx + sd * u * 0.6, ey - u * 0.55, hx + sd * u * 0.85, ey - u * 0.5); ctx.stroke();
    }
  }

  M.drawFront = function (ctx, time, dt, W, H) {
    if (use3D()) { G.M3.render(ctx, time, dt, W, H); return; }
    const { hx, hy, u } = M;
    const san = S.san / 100;
    const bob = Math.sin(time * 0.6) * u * 0.05;
    drawHead(ctx, hx, hy, u, bob, time);
    drawFace(ctx, hx, hy, u, bob);
    // 两只发光的眼
    M.eyeSquint.t += dt;
    const squint = M.eyeSquint.t < 0.9 ? Math.sin(Math.min(1, M.eyeSquint.t / 0.9) * Math.PI) * 0.7 : 0;
    const blink = M.blinkAmt(time);
    const open = G.clamp(M.intro * 1.2 - 0.6, 0, 1) * (1 - blink) * (1 - squint);
    const ey = hy - u * 0.05 + bob;
    const ic = G.mixHex('#3cff8c', '#ff3a2a', Math.max(0, 0.6 - san) / 0.6);
    for (const sd of [-1, 1]) {
      const x = hx + sd * u * 0.6, y = ey + u * 0.04, R = u * 0.25;
      if (open < 0.05) { ctx.fillStyle = '#1d2b26'; ctx.fillRect(Math.round(x - R), Math.round(y), Math.round(R * 2), 1); continue; }
      const flick = 0.85 + 0.15 * Math.sin(time * 7 + sd * 2);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, R * 3);
      glow.addColorStop(0, ic + Math.round(0x48 * open * flick).toString(16).padStart(2, '0')); glow.addColorStop(1, ic + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * 3, 0, TAU); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.15, Math.max(0.6, R * 0.82 * open), sd * 0.18, 0, TAU); ctx.clip();
      const [ox, oy] = lookOffset(x, y, R * 0.45);
      const ig = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, R * 1.2);
      ig.addColorStop(0, '#f2fff6'); ig.addColorStop(0.3, G.mixHex(ic, '#ffffff', 0.45)); ig.addColorStop(0.75, ic); ig.addColorStop(1, G.mixHex(ic, '#000000', 0.7));
      ctx.fillStyle = ig; ctx.fillRect(x - R * 1.3, y - R * 1.3, R * 2.6, R * 2.6);
      ctx.restore();
      // 被眉骨压住的上眼睑阴影
      ctx.fillStyle = 'rgba(3,8,7,0.55)';
      ctx.beginPath(); ctx.moveTo(x - R * 1.2, y - R * (sd > 0 ? 0.9 : 0.35)); ctx.lineTo(x + R * 1.2, y - R * (sd > 0 ? 0.35 : 0.9)); ctx.lineTo(x + R * 1.2, y - R * 1.3); ctx.lineTo(x - R * 1.2, y - R * 1.3); ctx.fill();
    }
    // 手臂
    M.armPaths = [];
    [-1, 1].forEach((sd, k) => {
      const sq = squash(M.armSq[k].t); M.armSq[k].t += dt;
      const P = armPts(sd, time, W, H);
      M.armPaths.push(P);
      G.drawTentacle(ctx, P, u * 0.55, u * 0.42, PAL_FACE, { sq, seed: 9 + k });
    });
    // 面部触手（盖住下巴，垂到祭台上）；外侧先画，中间的在最前
    M.facePaths = [];
    const order = [0, 5, 1, 4, 2, 3];
    for (const i of order) {
      const sq = squash(M.faceSq[i].t); M.faceSq[i].t += dt;
      const P = faceTentaclePts(i, time);
      M.facePaths[i] = P;
      const k = (i - 2.5) / 2.5;
      G.drawTentacle(ctx, P, u * (0.46 - Math.abs(k) * 0.1), u * 0.07, i % 2 ? PAL_FACE : PAL_FACE2, { sq, seed: i, sideX: k < 0 ? 1 : -1, suckerColor: PAL_FACE.red });
    }
    M.drawDrips(ctx, dt);
  };

  M.drawDrips = function (ctx, dt) {
    const u = M.u;
    // 滴液
    M.dripT -= dt;
    if (M.dripT <= 0) {
      M.dripT = 0.4 + Math.random() * 0.9;
      const P = M.facePaths[Math.floor(Math.random() * 6)];
      if (P) { const tip = P[P.length - 1]; M.drips.push({ x: tip[0], y: tip[1], vy: 0, y0: tip[1], life: 1 }); }
    }
    for (const d of M.drips) {
      d.vy += 60 * dt; d.y += d.vy * dt;
      if (d.y > d.y0 + u * 0.5) d.life -= dt * 3;
      ctx.fillStyle = `rgba(120,150,90,${Math.max(0, d.life) * 0.8})`;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
    }
    M.drips = M.drips.filter(d => d.life > 0);
  };

  M.blinkAmt = function (time) {
    const p = (time % 6.3) / 6.3;
    return p > 0.97 ? Math.sin(((p - 0.97) / 0.03) * Math.PI) : 0;
  };

  M.update = function (dt) {
    M.intro = Math.min(2, M.intro + dt);
    for (const e of M.wallEyes) {
      if (M.intro < e.delay) { e.open = 0; continue; }
      e.blink -= dt;
      if (e.blink < 0) { e.bt = 0.22; e.blink = 2.5 + Math.random() * 6; }
      if (e.bt > 0) { e.bt -= dt; e.open = Math.abs(e.bt / 0.11 - 1); }
      else e.open = Math.min(1, e.open + dt * 1.6);
    }
  };

  // 点到克苏鲁身上的触手：纯趣味 Q 弹
  M.pokeBody = function (x, y) {
    if (M.facePaths) for (let i = 0; i < 6; i++) {
      const P = M.facePaths[i]; if (!P) continue;
      if (G.distToPolyline(x, y, P).d < M.u * 0.28 + 3) { M.faceSq[i].t = 0; M.eyeSquint.t = 0; G.setMood('angry', 1.2); return true; }
    }
    if (M.armPaths) for (let k = 0; k < 2; k++) if (G.distToPolyline(x, y, M.armPaths[k]).d < M.u * 0.5 + 3) { M.armSq[k].t = 0; return true; }
    const dx = (x - M.hx) / (M.u * 1.6), dy = (y - M.hy + M.u * 0.5) / (M.u * 1.6);
    if (dx * dx + dy * dy < 1) { M.eyeSquint.t = 0; return true; }
    return false;
  };

  // ============ 捣乱事件 ============
  // 三种捣乱按当夜的配方抽：卷走供品 / 压盘遮挡 / 调包（第四夜的舌头）。
  G.startEvent = function () {
    const mix = (G.curLevel().event || {}).mix || {};
    const canSteal = G.stealTargets().length >= 1;
    const canSwap = G.swapTargets().length === 2;
    const pool = [['steal', mix.steal != null ? mix.steal : 0.65], ['press', mix.press != null ? mix.press : 0.35]];
    if (mix.swap && canSwap) pool.push(['swap', mix.swap]);
    const usable = pool.filter(([k, w]) => w > 0 && (k !== 'steal' || canSteal));
    const tot = usable.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * tot, kind = 'press';
    for (const [k, w] of usable) { r -= w; if (r <= 0) { kind = k; break; } }
    if (kind === 'steal') {
      S.event = { kind: 'steal', phase: 'reach', t: 0, dur: 2.3, sq: 9 };
      G.say('它伸手了……', 1.6);
    } else if (kind === 'swap') {
      S.event = { kind: 'swap', phase: 'reach', t: 0, dur: 2.0, sq: 9 };
      G.say('一条细长的东西探向了槽位……', 1.8);
    } else {
      const zc = 2.4 + Math.random() * 2.2;
      const rest = [];
      for (let i = 0; i < 16; i++) { const t = i / 15; rest.push([-6.0 + t * 11.0, zc + Math.sin(t * 4.2 + zc) * 0.6 - t * 0.4]); }
      S.event = { kind: 'press', phase: 'slam', t: 0, rest, off: rest.map(() => [0, 0]), pokes: 0, sq: 9, drag: null };
      G.say('一条触手压了下来', 1.6);
    }
    if (G.A) G.A.sfx('event');
  };

  const offscreen = () => !!(G.M3 && G.M3.model) || G.EV_OFFSCREEN;
  function evOrigin(sd) { return [M.hx + sd * M.u * 1.3, M.hy + M.u * 0.9]; }
  const PRESS_H = 1.75;

  function stealPath(ev) {
    let base = evOrigin(1);
    let tip;
    if (ev.kind === 'swap') {
      // 舌头扫向槽位轨中段
      tip = G.proj(G.slotX((G.SLOT_N - 1) / 2), 0.35, G.SLOT_Z + 0.2);
    } else {
      const tg = ev.targets && ev.targets.length ? ev.targets : G.stealTargets();
      if (tg.length) {
        let sx = 0, sy = 0;
        tg.forEach(it => { const p = G.proj(it.x, it.h, it.z); sx += p[0]; sy += p[1]; });
        tip = [sx / tg.length, sy / tg.length];
      } else tip = G.proj(G.slotX(3), 0.2, G.SLOT_Z);
    }
    ev.tip = tip;
    // 有模型时从镜头外（右侧屏幕外）伸进来，不从克苏鲁身上长出来（她 2026-10-22）
    if (offscreen()) base = [G.cam.cx * 2 + M.u * 1.4, tip[1] - M.u * 0.6];
    const c = offscreen() ? [(base[0] + tip[0]) / 2, Math.min(base[1], tip[1]) - M.u * 1.1] : [(base[0] + tip[0]) / 2 + M.u * 1.6, Math.min(base[1], tip[1]) - M.u * 0.8];
    let upto = 0;
    if (ev.phase === 'reach') upto = ev.t / ev.dur;
    else if (ev.phase === 'grab' || ev.phase === 'hurt') upto = ev.reachAt || 1;
    else if (ev.phase === 'retreat') upto = (ev.reachAt || 1) * (1 - ev.t / 0.9);
    upto = upto < 0.5 ? 2 * upto * upto : 1 - Math.pow(-2 * upto + 2, 2) / 2;
    const P = G.bezier(base, c, tip, 26, Math.max(0.02, upto));
    const time = S.time;
    return P.map(([x, y], i) => { const k = i / 26; return [x + Math.sin(time * 6 + k * 9) * M.u * 0.12 * k, y + Math.cos(time * 5 + k * 7) * M.u * 0.08 * k]; });
  }

  function pressPts(ev) {
    const h = ev.h == null ? PRESS_H : ev.h;
    const pts = ev.rest.map(([x, z], i) => {
      const o = ev.off[i], lift = ev.lift ? ev.lift[i] : 0;
      const w = Math.sin(S.time * 2 + i * 0.7) * 0.05;
      return G.proj(x + o[0], h + lift, z + o[1] + w);
    });
    const first = pts[0];
    const base = offscreen() ? [-M.u * 1.4, first[1] - M.u * 0.4] : evOrigin(-1);
    const c = offscreen() ? [(base[0] + first[0]) / 2, Math.min(base[1], first[1]) - M.u * 0.5] : [base[0] - M.u * 0.8, (base[1] + first[1]) / 2 - M.u * 0.4];
    return G.bezier(base, c, first, 10).concat(pts.slice(1).map(p => [p[0], p[1]]));
  }

  G.pressBlocks = function (t) {
    const ev = S.event;
    if (!ev || ev.kind !== 'press' || ev.phase === 'slide' || ev.phase === 'retreat') return false;
    if (ev.phase === 'slam' && ev.t < 0.35) return false;
    const [x, z] = G.boardToWorld(t.gx, t.gy);
    const P = ev.rest.map(([rx, rz], i) => [rx + ev.off[i][0], rz + ev.off[i][1]]);
    return G.distToPolyline(x, z, P).d < 0.82;
  };

  G.updateEvent = function (dt) {
    const ev = S.event; if (!ev) return;
    ev.t += dt; ev.sq += dt;
    if (S.state !== 'play' && ev.phase !== 'retreat' && ev.phase !== 'slide') { ev.phase = ev.kind !== 'press' ? 'retreat' : 'slide'; ev.t = 0; ev.vel = [-6, 2]; ev.reachAt = ev.reachAt || 0.5; }
    if (ev.kind === 'steal' || ev.kind === 'swap') {
      if (ev.phase === 'reach' && ev.t >= ev.dur) {
        if (ev.kind === 'swap') {
          const tg = G.swapTargets();
          if (tg.length === 2) {
            G.swapInSlot(tg[0], tg[1]);
            G.say('舌尖扫过槽位——两件供品换了个样', 2.2);
            G.setMood('smug', 2.6);
            if (G.A) G.A.sfx('squish');
          }
          ev.phase = 'retreat'; ev.t = 0;
        } else {
          ev.targets = G.stealTargets();
          ev.phase = 'grab'; ev.t = 0; ev.reachAt = 1;
        }
      } else if (ev.kind === 'steal' && ev.phase === 'grab' && ev.t >= 0.28) {
        const live = G.liveSlot();
        let tg = (ev.targets || []).filter(it => live.includes(it));
        if (!tg.length) tg = G.stealTargets();
        if (tg.length) { G.removeFromSlot(tg); ev.carried = tg; G.say(tg.length === 2 ? '它卷走了你凑好的一对，塞回了盘底' : '它卷走了一件供品', 2.2); G.setMood('smug', 2.6); }
        ev.phase = 'retreat'; ev.t = 0;
      } else if (ev.phase === 'hurt' && ev.t >= 0.35) { ev.phase = 'retreat'; ev.t = 0; }
      else if (ev.phase === 'retreat' && ev.t >= 0.9) {
        if (ev.carried && ev.carried.length) G.buryItems(ev.carried);
        S.event = null;
      }
    } else {
      if (ev.phase === 'slam') {
        const k = Math.min(1, ev.t / 0.55);
        const b = k < 0.7 ? Math.pow(k / 0.7, 2) : 1 - Math.sin(((k - 0.7) / 0.3) * Math.PI) * 0.12;
        ev.h = G.lerp(5.2, PRESS_H, b);
        if (k >= 1) { ev.phase = 'hold'; ev.h = PRESS_H; }
      } else if (ev.phase === 'spring') {
        const e = Math.exp(-5 * ev.t) * Math.cos(14 * ev.t);
        ev.off = ev.off0.map(([x, z]) => [x * e, z * e]);
        ev.lift = ev.lift0.map(l => Math.max(0, l * e));
        if (ev.t > 1.0) { ev.phase = 'hold'; ev.off = ev.rest.map(() => [0, 0]); ev.lift = null; }
      } else if (ev.phase === 'slide' || ev.phase === 'retreat') {
        ev.off = ev.off.map(([x, z]) => [x + ev.vel[0] * dt, z + ev.vel[1] * dt]);
        ev.h = (ev.h || PRESS_H) + dt * 1.2;
        if (ev.t > 0.7) S.event = null;
      }
    }
  };

  // —— 输入：返回 true 表示这次按下被触手吃掉了 ——
  G.eventPointerDown = function (x, y) {
    const ev = S.event; if (!ev || S.state !== 'play') return false;
    const P = ev.path; if (!P) return false;
    const hit = G.distToPolyline(x, y, P);
    const tol = (ev.kind === 'press' ? M.ub * 0.55 : M.ub * 0.5) + 5;
    if (hit.d > tol) return false;
    if (ev.kind !== 'press') {
      if (ev.phase === 'reach') {
        ev.reachAt = ev.t / ev.dur; ev.phase = 'hurt'; ev.t = 0; ev.sq = 0;
        G.say('它吃痛缩回去了', 1.4); G.setMood('angry', 2.2);
      }
      return true;
    }
    if (ev.phase !== 'hold' && ev.phase !== 'spring' && ev.phase !== 'slam') return true;
    const gi = Math.max(0, Math.min(15, hit.i - 10));
    const w = G.unproj(x, y, PRESS_H);
    ev.drag = { sx: x, sy: y, gi, w0: w, moved: false };
    return true;
  };
  G.eventPointerMove = function (x, y) {
    const ev = S.event; if (!ev || !ev.drag) return;
    const d = ev.drag;
    if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 5) { d.moved = true; ev.phase = 'drag'; }
    if (!d.moved) return;
    const w = G.unproj(x, y, PRESS_H);
    let dv = [w[0] - d.w0[0], w[1] - d.w0[1]];
    const L = Math.hypot(dv[0], dv[1]);
    if (L > 4) dv = [dv[0] * 4 / L, dv[1] * 4 / L];
    d.dv = dv;
    ev.off = ev.rest.map((_, i) => { const f = Math.exp(-((i - d.gi) ** 2) / 22); return [dv[0] * f, dv[1] * f]; });
    ev.lift = ev.off.map(([a, b]) => Math.min(0.6, Math.hypot(a, b) * 0.22));
  };
  G.eventPointerUp = function () {
    const ev = S.event; if (!ev || !ev.drag) return;
    const d = ev.drag; ev.drag = null;
    if (!d.moved) {
      ev.pokes++; ev.sq = 0;
      if (ev.pokes >= 4) { ev.phase = 'retreat'; ev.t = 0; ev.vel = [-7, 3]; G.say('戳跑了！', 1.4); G.setMood('angry', 2.2); }
      else { G.say(['它抖了一下', '再戳戳', '快不行了'][ev.pokes - 1], 1.1); G.setMood('hurt', 0.6); }
      return;
    }
    const L = d.dv ? Math.hypot(d.dv[0], d.dv[1]) : 0;
    if (L > 2.3) {
      ev.phase = 'slide'; ev.t = 0;
      ev.vel = [d.dv[0] / L * 9, d.dv[1] / L * 9];
      G.say('甩开了！它滑下了桌子', 1.6); G.setMood('angry', 2.4);
    } else {
      ev.phase = 'spring'; ev.t = 0; ev.off0 = ev.off.map(o => o.slice()); ev.lift0 = (ev.lift || ev.off.map(() => 0)).slice();
      G.say('再狠点，拖远点！', 1.4);
    }
  };

  // —— 画捣乱触手 ——
  G.drawEvent = function (ctx) {
    const ev = S.event; if (!ev) { return; }
    const sq = squash(ev.sq);
    if (ev.kind !== 'press') {
      const P = stealPath(ev);
      ev.path = P;
      G.drawTentacle(ctx, P, M.ub * (ev.kind === 'swap' ? 0.45 : 0.7), M.ub * 0.18, PAL_EVENT, { sq });
      if (ev.carried && ev.phase === 'retreat') {
        const tip = P[P.length - 1];
        ev.carried.forEach((it, k) => {
          const s = M.ub * 1.1;
          ctx.drawImage(G.SPRITES[it.type], Math.round(tip[0] - s / 2 + k * s * 0.5), Math.round(tip[1] - s / 2 - k * 3), Math.round(s), Math.round(s));
        });
      }
    } else {
      const P = pressPts(ev);
      ev.path = P;
      const alpha = ev.phase === 'slide' || ev.phase === 'retreat' ? Math.max(0, 1 - ev.t / 0.7) : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      // 先画压在盘上的阴影
      if (ev.phase !== 'slam' || ev.t > 0.3) {
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineCap = 'round'; ctx.lineWidth = M.ub * 0.9;
        ctx.beginPath();
        ev.rest.forEach(([x, z], i) => { const p = G.proj(x + ev.off[i][0] + 0.15, G.FLOOR_H, z + ev.off[i][1] - 0.2); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        ctx.stroke();
      }
      const n = P.length;
      const liftF = ev.lift ? t => { const i = Math.round(t * (n - 1)) - 10; return i >= 0 && ev.lift[i] ? ev.lift[i] * M.ub * 0.8 : 0; } : null;
      G.drawTentacle(ctx, P, M.ub * 0.62, M.ub * 0.2, PAL_EVENT, {
        sq, lift: liftF,
        thin: ev.off ? t => { const i = Math.round(t * (n - 1)) - 10; const o = i >= 0 ? ev.off[i] : null; return o ? 1 / (1 + Math.hypot(o[0], o[1]) * 0.18) : 1; } : null,
      });
      ctx.restore();
    }
  };
})();
