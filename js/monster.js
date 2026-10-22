// 坐在对面的克苏鲁：七只琥珀竖瞳、九条面部触手、两条手臂触手、翅膀，外加背景眼墙。
// 以及两种捣乱：卷走供品、压盘遮挡；玩家可以戳、可以拖。
(function () {
  const G = window.G, S = G.S;
  const M = (G.M = {});
  const TAU = Math.PI * 2;

  const PAL_FACE = { out: '#050604', dark: '#121810', body: '#252e1f', light: '#56634a', sucker: '#6e5058' };
  const PAL_EVENT = { out: '#050306', dark: '#1a0c1e', body: '#3a2042', light: '#7c5a86', sucker: '#8f6670' };

  G.monsterReset = function () {
    M.faceSq = Array(9).fill(0).map(() => ({ t: 9 }));
    M.armSq = [{ t: 9 }, { t: 9 }];
    M.eyeBlink = 0; M.eyeSquint = { t: 9 };
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
    const rad = i => Math.max(0.6, G.lerp(r0, r1, i / (n - 1)) * (1 + 0.55 * sq) * (opt.thin ? opt.thin(i / (n - 1)) : 1));
    const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    for (let i = 0; i < n; i++) dot(P[i][0], P[i][1], rad(i) + 1, pal.out);
    for (let i = 0; i < n; i++) dot(P[i][0], P[i][1], rad(i), pal.dark);
    for (let i = 0; i < n; i++) { const r = rad(i); dot(P[i][0] - r * 0.15, P[i][1] - r * 0.22, r * 0.72, pal.body); }
    // 吸盘：沿路径一侧
    if (opt.suckers !== false) {
      const every = Math.max(3, Math.round(r0 * 1.6));
      for (let i = every; i < n - 2; i += every) {
        const r = rad(i);
        if (r < 1.6) continue;
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        if (ny < 0) { nx = -nx; ny = -ny; }
        const lift = opt.lift ? opt.lift(i / (n - 1)) : 0;
        const sx = P[i][0] + nx * r * 0.55, sy = P[i][1] + ny * r * 0.55 - lift;
        dot(sx, sy, Math.max(0.8, r * 0.3), pal.sucker);
        if (r > 3) dot(sx, sy, r * 0.12, pal.out);
      }
    }
    // 湿光
    for (let i = 0; i < n; i += 2) { const r = rad(i); if (r > 1.8) dot(P[i][0] - r * 0.38, P[i][1] - r * 0.48, Math.max(0.5, r * 0.18), pal.light); }
    return P;
  };

  // —— 头的位置（屏幕） ——
  M.layout = function () {
    const [hx, hy, s] = G.proj(0, 2.75, 10.2);
    M.hx = hx; M.hy = hy; M.u = s * 1.3;
  };

  // —— 背景石墙与眼墙 ——
  M.drawWall = function (ctx, W, H) {
    const bottom = G.proj(0, 0, 9.4)[1] + 2;
    M.wallBottom = bottom;
    const g = ctx.createLinearGradient(0, 0, 0, bottom);
    g.addColorStop(0, '#030403'); g.addColorStop(1, '#141811');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, bottom);
    // 石砖
    const r = G.mulberry(M.wallSeed);
    const bh = Math.max(6, Math.round(M.u * 0.55));
    for (let y = bottom - bh, row = 0; y > -bh; y -= bh, row++) {
      const bw = bh * 2.1, off = row % 2 ? bw / 2 : 0;
      const fade = G.clamp((y / bottom) * 1.3, 0, 1);
      for (let x = -off; x < W; x += bw) {
        const shade = Math.floor(9 + r() * 9);
        ctx.fillStyle = `rgba(${shade + 2},${shade + 5},${shade - 2},${0.25 + 0.6 * fade})`;
        ctx.fillRect(Math.round(x + 1), Math.round(y + 1), Math.round(bw - 2), bh - 2);
        if (r() < 0.25) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(Math.round(x + bw * r()), Math.round(y + 2), 1, bh - 4); }
        if (r() < 0.12) { ctx.fillStyle = 'rgba(40,20,14,0.6)'; ctx.fillRect(Math.round(x + bw * r()), Math.round(y + bh - 3), 1, 3 + Math.round(r() * 6)); }
      }
    }
    // 眼墙
    const san = S.san / 100;
    for (const e of M.wallEyes) {
      let x = e.u * W, y = 6 + e.v * (bottom - 22);
      const dx = (x - M.hx) / (M.u * 2.6), dy = (y - M.hy) / (M.u * 2.5);
      if (dx * dx + dy * dy < 1) x = dx < 0 ? M.hx - M.u * 2.7 - e.u * M.u : M.hx + M.u * 2.7 + e.u * M.u;
      e.sx = x; e.sy = y;
      drawWallEye(ctx, x, y, Math.max(4, M.u * 0.42 * e.size), e.open, san);
    }
    ctx.fillStyle = '#060705'; ctx.fillRect(0, bottom - 2, W, 3);
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

  // —— 翅膀与身体（在桌面之前画，让桌沿挡住身体下半截） ——
  M.drawBack = function (ctx, time) {
    const { hx, hy, u } = M;
    const flap = Math.sin(time * 0.8) * 0.12;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#090b08';
      ctx.strokeStyle = '#1b2217'; ctx.lineWidth = Math.max(1, u * 0.06);
      const sx = hx + sd * u * 1.1, sy = hy + u * 0.4;
      const tips = [[3.6, -2.2 - flap], [4.4, -0.9 - flap * 0.5], [4.2, 0.4], [3.4, 1.1]];
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(hx + sd * u * 2.6, hy - u * (2.6 + flap));
      tips.forEach(([tx, ty], i) => {
        const px = hx + sd * u * tx, py = hy + u * ty;
        const mx = hx + sd * u * (tx - 0.5), my = hy + u * (ty - 0.1);
        ctx.quadraticCurveTo(mx, my, px, py);
      });
      ctx.lineTo(sx, sy + u * 0.8); ctx.closePath(); ctx.fill();
      // 翼骨
      ctx.beginPath();
      tips.forEach(([tx, ty]) => { ctx.moveTo(hx + sd * u * 2.6, hy - u * (2.6 + flap)); ctx.lineTo(hx + sd * u * tx, hy + u * ty); });
      ctx.moveTo(sx, sy); ctx.lineTo(hx + sd * u * 2.6, hy - u * (2.6 + flap));
      ctx.stroke();
    }
    // 身体：肩膀与胸口隐在暗处
    const g = ctx.createRadialGradient(hx, hy + u * 1.4, u * 0.3, hx, hy + u * 1.4, u * 2.6);
    g.addColorStop(0, '#1c2417'); g.addColorStop(1, '#080a07');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(hx, hy + u * 1.7, u * 2.5, u * 1.5, 0, 0, TAU); ctx.fill();
  };

  // —— 头、七只眼、面部触手、手臂 ——
  function faceTentaclePts(i, time) {
    const { hx, hy, u } = M;
    const k = (i - 4) / 4;                       // -1..1
    const bx = hx + k * u * 1.15, by = hy + u * (0.7 + (1 - Math.abs(k)) * 0.25);
    const len = u * (1.6 + (1 - Math.abs(k)) * 1.1 + ((i * 37) % 5) * 0.08);
    const spread = k * u * 0.9;
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const t = j / 10;
      const sway = Math.sin(time * 1.2 + i * 1.9 + t * 3.2) * u * 0.28 * t;
      const curl = t > 0.75 ? Math.sin((t - 0.75) * 9 + i) * u * 0.25 : 0;
      pts.push([bx + spread * t + sway + curl, by + len * t + Math.cos(time * 0.9 + i + t * 2) * u * 0.06]);
    }
    return pts;
  }
  function armPts(sd, time, reachTo) {
    const { hx, hy, u } = M;
    const a = [hx + sd * u * 1.9, hy + u * 1.0];
    const tip = reachTo || G.proj(sd * 3.95, 0.25, 7.0);
    const c = [(a[0] + tip[0]) / 2 + sd * u * (0.6 + Math.sin(time * 0.7 + sd) * 0.25), Math.min(a[1], tip[1]) - u * 0.5 + Math.cos(time * 0.9 + sd) * u * 0.2];
    return G.bezier(a, c, [tip[0] + Math.sin(time * 1.3 + sd) * u * 0.15, tip[1]], 18);
  }

  M.drawFront = function (ctx, time, dt) {
    const { hx, hy, u } = M;
    const san = S.san / 100;
    // 手臂（垂到盘边）
    M.armPaths = [];
    [-1, 1].forEach((sd, k) => {
      const sq = squash(M.armSq[k].t); M.armSq[k].t += dt;
      const P = armPts(sd, time);
      M.armPaths.push(P);
      G.drawTentacle(ctx, P, u * 0.42, u * 0.12, PAL_FACE, { sq });
    });
    // 头：外套膜 + 面部
    const bob = Math.sin(time * 0.6) * u * 0.05;
    const g = ctx.createRadialGradient(hx - u * 0.6, hy - u * 1.4 + bob, u * 0.2, hx, hy - u * 0.5 + bob, u * 2.3);
    g.addColorStop(0, '#3c4833'); g.addColorStop(0.45, '#1e271a'); g.addColorStop(1, '#070906');
    ctx.fillStyle = '#060705';
    ctx.beginPath(); ctx.ellipse(hx, hy - u * 1.0 + bob, u * 1.62, u * 1.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx, hy + u * 0.15 + bob, u * 1.55, u * 1.0, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(hx, hy - u * 1.0 + bob, u * 1.55, u * 1.43, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx, hy + u * 0.15 + bob, u * 1.48, u * 0.94, 0, 0, TAU); ctx.fill();
    // 皮肤疙瘩
    const r = G.mulberry(4242);
    for (let k = 0; k < 40; k++) {
      const a = r() * TAU, d = Math.sqrt(r());
      const x = hx + Math.cos(a) * d * u * 1.4, y = hy - u * 0.7 + Math.sin(a) * d * u * 1.3 + bob;
      ctx.fillStyle = r() < 0.5 ? 'rgba(10,14,8,0.55)' : 'rgba(120,140,100,0.25)';
      ctx.fillRect(Math.round(x), Math.round(y), 1 + Math.round(r() * u * 0.08), 1);
    }
    // 斑驳的暗块与眉骨阴影
    const r2 = G.mulberry(919);
    for (let k = 0; k < 14; k++) {
      const a = r2() * TAU, d = Math.sqrt(r2()) * 1.25;
      ctx.fillStyle = `rgba(3,5,2,${0.18 + r2() * 0.25})`;
      ctx.beginPath(); ctx.ellipse(hx + Math.cos(a) * d * u, hy - u * 0.9 + Math.sin(a) * d * u + bob, u * (0.15 + r2() * 0.3), u * (0.1 + r2() * 0.2), r2() * 3, 0, TAU); ctx.fill();
    }
    const brow = ctx.createLinearGradient(0, hy - u * 1.6 + bob, 0, hy - u * 0.4 + bob);
    brow.addColorStop(0, 'rgba(0,0,0,0)'); brow.addColorStop(0.55, 'rgba(0,0,0,0.45)'); brow.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = brow; ctx.beginPath(); ctx.ellipse(hx, hy - u * 0.75 + bob, u * 1.5, u * 0.85, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,20,30,0.45)'; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const a = -2.6 + k * 0.5; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * u * 1.4, hy - u * 0.9 + Math.sin(a) * u * 1.3 + bob); ctx.quadraticCurveTo(hx + Math.cos(a) * u * 0.9, hy - u * 0.6 + bob, hx + Math.cos(a + 0.3) * u * 0.5, hy - u * 0.3 + bob); ctx.stroke(); }
    // 湿光
    ctx.fillStyle = 'rgba(150,170,130,0.22)';
    ctx.beginPath(); ctx.ellipse(hx - u * 0.75, hy - u * 1.85 + bob, u * 0.32, u * 0.12, -0.5, 0, TAU); ctx.fill();
    // 面部触手（盖住下巴，垂到桌上）
    M.facePaths = [];
    const order = [0, 8, 1, 7, 2, 6, 3, 5, 4];
    for (const i of order) {
      const sq = squash(M.faceSq[i].t); M.faceSq[i].t += dt;
      const P = faceTentaclePts(i, time);
      M.facePaths[i] = P;
      G.drawTentacle(ctx, P, u * 0.24, u * 0.05, PAL_FACE, { sq });
    }
    // 七只眼
    M.eyeSquint.t += dt;
    const squint = M.eyeSquint.t < 0.9 ? Math.sin(Math.min(1, M.eyeSquint.t / 0.9) * Math.PI) * 0.7 : 0;
    const blink = M.blinkAmt(time);
    const eyes = [[-0.9, -0.85, 0.3, -0.25], [0.05, -1.25, 0.26, 0.05], [0.95, -0.78, 0.33, 0.2], [-0.5, -0.25, 0.22, -0.1], [0.6, -0.18, 0.2, 0.15], [-1.2, 0.12, 0.15, -0.4], [1.17, 0.2, 0.17, 0.35]];
    const open = G.clamp(M.intro * 1.2 - 0.6, 0, 1) * (1 - blink) * (1 - squint) * 0.78;
    const almond = (x, y, R, k, tilt) => {
      ctx.beginPath();
      ctx.moveTo(x - R * Math.cos(tilt), y - R * Math.sin(tilt));
      ctx.quadraticCurveTo(x + R * 0.9 * Math.sin(tilt), y - R * 1.15 * k, x + R * Math.cos(tilt), y + R * Math.sin(tilt));
      ctx.quadraticCurveTo(x - R * 0.9 * Math.sin(tilt), y + R * 1.0 * k, x - R * Math.cos(tilt), y - R * Math.sin(tilt));
      ctx.closePath();
    };
    eyes.forEach(([ex, ey, er, tilt], i) => {
      const x = hx + ex * u, y = hy + ey * u + bob, R = er * u;
      ctx.fillStyle = '#030402'; almond(x, y, R * 1.3, 0.85, tilt); ctx.fill();
      ctx.fillStyle = '#1a120c'; almond(x, y, R * 1.12, 0.7, tilt); ctx.fill();
      if (open < 0.05) return;
      const ic = G.mixHex('#a8690e', '#a8120a', 1 - san);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, R * 2);
      glow.addColorStop(0, ic + '38'); glow.addColorStop(1, ic + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * 2, 0, TAU); ctx.fill();
      ctx.save();
      almond(x, y, R, open, tilt); ctx.clip();
      ctx.fillStyle = G.mixHex('#4a2e08', '#3a0604', 1 - san); ctx.fillRect(x - R, y - R, R * 2, R * 2);
      const [ox, oy] = lookOffset(x, y, R * 0.4);
      const ig = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, R * 0.85);
      ig.addColorStop(0, G.mixHex(ic, '#f0c050', 0.25)); ig.addColorStop(0.7, ic); ig.addColorStop(1, '#2a1404');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(x + ox, y + oy, R * 0.85, 0, TAU); ctx.fill();
      ctx.fillStyle = '#030201';
      ctx.beginPath(); ctx.ellipse(x + ox, y + oy, Math.max(0.6, R * 0.12), R * 0.7, tilt * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - R, y - R, R * 2, R * 0.55);
      ctx.fillStyle = 'rgba(255,230,190,0.55)'; ctx.fillRect(Math.round(x + ox - R * 0.35), Math.round(y + oy - R * 0.25), 1, 1);
      ctx.restore();
    });
    // 滴液
    M.dripT -= dt;
    if (M.dripT <= 0) {
      M.dripT = 0.4 + Math.random() * 0.9;
      const P = M.facePaths[Math.floor(Math.random() * 9)];
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
    if (M.facePaths) for (let i = 0; i < 9; i++) {
      const P = M.facePaths[i]; if (!P) continue;
      if (G.distToPolyline(x, y, P).d < M.u * 0.25 + 3) { M.faceSq[i].t = 0; M.eyeSquint.t = 0; return true; }
    }
    if (M.armPaths) for (let k = 0; k < 2; k++) if (G.distToPolyline(x, y, M.armPaths[k]).d < M.u * 0.3 + 3) { M.armSq[k].t = 0; return true; }
    const dx = (x - M.hx) / (M.u * 1.6), dy = (y - M.hy + M.u * 0.5) / (M.u * 1.6);
    if (dx * dx + dy * dy < 1) { M.eyeSquint.t = 0; return true; }
    return false;
  };

  // ============ 捣乱事件 ============
  G.startEvent = function () {
    const pairs = G.stealTargets();
    const canSteal = pairs.length >= 1;
    const steal = canSteal && (pairs.length === 2 ? Math.random() < 0.65 : Math.random() < 0.3);
    if (steal) S.event = { kind: 'steal', phase: 'reach', t: 0, dur: 2.3, sq: 9 };
    else {
      const zc = 2.4 + Math.random() * 2.2;
      const rest = [];
      for (let i = 0; i < 16; i++) { const t = i / 15; rest.push([-5.4 + t * 9.9, zc + Math.sin(t * 3.1 + zc) * 0.45 - t * 0.3]); }
      S.event = { kind: 'press', phase: 'slam', t: 0, rest, off: rest.map(() => [0, 0]), pokes: 0, sq: 9, drag: null };
    }
    G.say(steal ? '它伸手了……' : '一条触手压了下来', 1.6);
  };

  function evOrigin(sd) { return [M.hx + sd * M.u * 1.9, M.hy + M.u * 1.0]; }
  const PRESS_H = 1.02;

  function stealPath(ev) {
    const base = evOrigin(1);
    let tip;
    const tg = ev.targets && ev.targets.length ? ev.targets : G.stealTargets();
    if (tg.length) {
      let sx = 0, sy = 0;
      tg.forEach(it => { const p = G.proj(it.x, it.h, it.z); sx += p[0]; sy += p[1]; });
      tip = [sx / tg.length, sy / tg.length];
    } else tip = G.proj(G.slotX(3), 0.2, G.SLOT_Z);
    ev.tip = tip;
    const c = [(base[0] + tip[0]) / 2 + M.u * 2.2, Math.min(base[1], tip[1]) - M.u * 1.2];
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
    const base = evOrigin(-1), first = pts[0];
    const c = [base[0] - M.u * 0.8, (base[1] + first[1]) / 2 - M.u * 0.4];
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
    if (S.state !== 'play' && ev.phase !== 'retreat' && ev.phase !== 'slide') { ev.phase = ev.kind === 'steal' ? 'retreat' : 'slide'; ev.t = 0; ev.vel = [-6, 2]; ev.reachAt = ev.reachAt || 0.5; }
    if (ev.kind === 'steal') {
      if (ev.phase === 'reach' && ev.t >= ev.dur) {
        ev.targets = G.stealTargets();
        ev.phase = 'grab'; ev.t = 0; ev.reachAt = 1;
      } else if (ev.phase === 'grab' && ev.t >= 0.28) {
        const live = G.liveSlot();
        let tg = (ev.targets || []).filter(it => live.includes(it));
        if (!tg.length) tg = G.stealTargets();
        if (tg.length) { G.removeFromSlot(tg); ev.carried = tg; G.say(tg.length === 2 ? '它卷走了你凑好的一对，塞回了盘底' : '它卷走了一件供品', 2.2); }
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
        ev.h = G.lerp(4.2, PRESS_H, b);
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
    const tol = (ev.kind === 'press' ? M.ub * 0.5 : M.u * 0.35) + 5;
    if (hit.d > tol) return false;
    if (ev.kind === 'steal') {
      if (ev.phase === 'reach') {
        ev.reachAt = ev.t / ev.dur; ev.phase = 'hurt'; ev.t = 0; ev.sq = 0;
        G.say('它吃痛缩回去了', 1.4);
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
      if (ev.pokes >= 4) { ev.phase = 'retreat'; ev.t = 0; ev.vel = [-7, 3]; G.say('戳跑了！', 1.4); }
      else G.say(['它抖了一下', '再戳戳', '快不行了'][ev.pokes - 1], 1.1);
      return;
    }
    const L = d.dv ? Math.hypot(d.dv[0], d.dv[1]) : 0;
    if (L > 2.3) {
      ev.phase = 'slide'; ev.t = 0;
      ev.vel = [d.dv[0] / L * 9, d.dv[1] / L * 9];
      G.say('甩开了！它滑下了桌子', 1.6);
    } else {
      ev.phase = 'spring'; ev.t = 0; ev.off0 = ev.off.map(o => o.slice()); ev.lift0 = (ev.lift || ev.off.map(() => 0)).slice();
      G.say('再狠点，拖远点！', 1.4);
    }
  };

  // —— 画捣乱触手 ——
  G.drawEvent = function (ctx) {
    const ev = S.event; if (!ev) { return; }
    M.ub = G.proj(0, PRESS_H, 3.5)[2];
    const sq = squash(ev.sq);
    if (ev.kind === 'steal') {
      const P = stealPath(ev);
      ev.path = P;
      G.drawTentacle(ctx, P, M.u * 0.42, M.u * 0.14, PAL_EVENT, { sq });
      if (ev.carried && ev.phase === 'retreat') {
        const tip = P[P.length - 1];
        ev.carried.forEach((it, k) => {
          const s = M.u * 0.7;
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
        ev.rest.forEach(([x, z], i) => { const p = G.proj(x + ev.off[i][0] + 0.15, G.tileTopH(2), z + ev.off[i][1] - 0.2); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
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
