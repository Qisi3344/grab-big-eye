// 场景绘制：沉在水底的祭台、圆形石供品盘、有体积的供品、凹陷石杯槽位、水下光束与录像带噪点。
(function () {
  const G = window.G, S = G.S, M = G.M;
  const R = (G.R = {});
  const P = (x, y, z) => G.proj(x, y, z);
  const TAU = Math.PI * 2;
  G.OBJ = 1.2;           // 供品贴图在世界里的宽度
  G.DISH_R = 4.55;
  G.DISH_TOP = 0.3;
  G.FLOOR_H = 0.22;       // 盘内底面
  G.LAYER_UP = 0.36;      // 每层供品往上叠的高度
  G.baseH = layer => G.FLOOR_H + layer * G.LAYER_UP;

  function poly(ctx, pts, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function ring(cx, cz, r, h, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; out.push(P(cx + Math.cos(a) * r, h, cz + Math.sin(a) * r)); }
    return out;
  }
  // 地面上的投影椭圆
  function groundEllipse(ctx, x, h, z, rx, rz, fill) {
    const c = P(x, h, z), a = P(x + rx, h, z), f = P(x, h, z + rz), n = P(x, h, z - rz);
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.ellipse(c[0], (f[1] + n[1]) / 2, Math.abs(a[0] - c[0]), Math.abs(n[1] - f[1]) / 2, 0, 0, TAU); ctx.fill();
  }

  // 长方体石块（祭台、槽位轨）
  function block(ctx, x0, x1, z0, z1, h, th, top, front, side) {
    poly(ctx, [P(x0, h, z0), P(x1, h, z0), P(x1, h - th, z0), P(x0, h - th, z0)], front);
    if (side) {
      poly(ctx, [P(x0, h, z1), P(x0, h, z0), P(x0, h - th, z0), P(x0, h - th, z1)], side);
      poly(ctx, [P(x1, h, z1), P(x1, h, z0), P(x1, h - th, z0), P(x1, h - th, z1)], side);
    }
    poly(ctx, [P(x0, h, z1), P(x1, h, z1), P(x1, h, z0), P(x0, h, z0)], top);
  }

  // —— 背景：深水、光束、残柱 ——
  R.drawSky = function (ctx, W, H, time) {
    const hz = G.proj(0, 0, 9.2)[1];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04100f'); g.addColorStop(0.45, '#0a2422'); g.addColorStop(1, '#030a09');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 地平线附近的一层薄雾
    const fog = ctx.createLinearGradient(0, hz - (M.u || 20) * 2, 0, hz + 4);
    fog.addColorStop(0, 'rgba(70,130,115,0)'); fog.addColorStop(1, 'rgba(70,130,115,0.18)');
    ctx.fillStyle = fog; ctx.fillRect(0, hz - (M.u || 20) * 2, W, (M.u || 20) * 2 + 4);
    // 残柱剪影
    const r = G.mulberry(55), u = M.u || 20;
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) {
      const cx = W / 2 + sd * (M.u * (3.4 + k * 2.1)) , w = u * (0.9 - k * 0.15), top = hz - u * (4.5 - k * 1.2) - r() * u;
      ctx.fillStyle = k ? '#06191a' : '#0a2224';
      ctx.fillRect(Math.round(cx - w / 2), Math.round(top), Math.round(w), Math.round(hz - top + 2));
      ctx.fillRect(Math.round(cx - w * 0.65), Math.round(top), Math.round(w * 1.3), Math.max(2, Math.round(u * 0.18)));
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let j = 1; j < 4; j++) ctx.fillRect(Math.round(cx - w / 2 + (w * j) / 4), Math.round(top + u * 0.2), 1, Math.round(hz - top));
      // 断口
      ctx.fillStyle = '#020807';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.65, top); ctx.lineTo(cx - w * 0.1, top + u * 0.3); ctx.lineTo(cx + w * 0.3, top - 1); ctx.lineTo(cx + w * 0.65, top + u * 0.2); ctx.lineTo(cx + w * 0.65, top - u); ctx.lineTo(cx - w * 0.65, top - u); ctx.fill();
    }
    M.wallBottom = hz;
  };

  R.drawRays = function (ctx, W, H, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x = W * (0.12 + k * 0.2) + Math.sin(time * 0.3 + k) * W * 0.04, w = W * (0.05 + (k % 3) * 0.025);
      const a = 0.022 + 0.012 * Math.sin(time * 0.5 + k * 2);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
      g.addColorStop(0, `rgba(110,230,200,${a * 1.6})`); g.addColorStop(1, 'rgba(110,230,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.6 + W * 0.12, H * 0.9); ctx.lineTo(x + W * 0.12, H * 0.9); ctx.fill();
    }
    ctx.restore();
  };

  // —— 祭台石面 ——
  R.drawAltar = function (ctx, W, H, time) {
    // 祭台外的地面：碎石地上积着浅浅的水
    const gq = [P(-30, -0.45, 9.2), P(30, -0.45, 9.2), P(30, -0.45, -6), P(-30, -0.45, -6)];
    poly(ctx, gq, '#0b1716');
    const rg = G.mulberry(77);
    for (let k = 0; k < 90; k++) {
      const x = (rg() - 0.5) * 30, z = -5 + rg() * 14, p = P(x, -0.45, z);
      ctx.fillStyle = rg() < 0.5 ? 'rgba(3,8,8,0.7)' : 'rgba(40,62,56,0.5)';
      ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 1 + Math.round(rg() * p[2] * 0.2), 1);
    }
    R.puddles(ctx, time, -0.45, [[-8.5, 2.5, 2.4, 1.6], [8.2, 4.5, 2.8, 1.8], [-7.5, 7.6, 1.8, 0.9], [9, -1.5, 2.2, 1.4], [-9.5, -2.5, 2.6, 1.6]]);
    block(ctx, -6.4, 6.4, -3.4, 9.2, 0, 0.45, '#17262a', '#0b1517', '#0d1a1c');
    // 石板接缝
    ctx.strokeStyle = 'rgba(3,8,8,0.8)'; ctx.lineWidth = 1;
    for (let x = -6.4; x <= 6.41; x += 1.6) { const a = P(x, 0, 9.2), b = P(x, 0, -3.4); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let z = -3.4; z <= 9.2; z += 1.4) { const a = P(-6.4, 0, z), b = P(6.4, 0, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // 苔藓与碎石
    const r = G.mulberry(31);
    for (let k = 0; k < 140; k++) {
      const x = -6.3 + r() * 12.6, z = -3.3 + r() * 12.4, p = P(x, 0, z);
      ctx.fillStyle = r() < 0.55 ? 'rgba(52,92,48,0.55)' : 'rgba(4,10,10,0.6)';
      ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 1 + Math.round(r() * p[2] * 0.12), 1);
    }
    // 石面上的小水洼
    R.puddles(ctx, time, 0.001, [[-4.9, 7.2, 1.0, 0.55], [5.0, 0.8, 0.9, 0.6], [-5.1, -1.6, 0.8, 0.5], [4.6, 7.8, 0.7, 0.4]]);
    // 发光符文边框
    const glow = 0.35 + 0.15 * Math.sin(time * 1.3);
    ctx.strokeStyle = `rgba(70,210,150,${glow})`; ctx.lineWidth = 1;
    ctx.beginPath();
    [[-5.9, 8.7], [5.9, 8.7], [5.9, -2.9], [-5.9, -2.9]].forEach(([x, z], i) => { const p = P(x, 0, z); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.stroke();
    for (let k = 0; k < 40; k++) {
      const t = k / 40, side = Math.floor(t * 4), f = (t * 4) % 1;
      const pos = [[-5.6 + f * 11.2, 8.4], [5.6, 8.4 - f * 11], [5.6 - f * 11.2, -2.6], [-5.6, -2.6 + f * 11]][side];
      const p = P(pos[0], 0, pos[1]);
      ctx.fillStyle = `rgba(90,240,170,${glow * (0.6 + 0.4 * Math.sin(time * 2 + k))})`;
      ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1);
    }
  };

  // 浅水洼：暗面 + 反光 + 偶尔被滴水荡开的涟漪
  R.puddles = function (ctx, time, h, list) {
    for (const [x, z, rx, rz] of list) {
      const c = P(x, h, z), a = P(x + rx, h, z), f = P(x, h, z + rz), n = P(x, h, z - rz);
      const RX = Math.abs(a[0] - c[0]), RY = Math.abs(n[1] - f[1]) / 2, cy = (f[1] + n[1]) / 2;
      if (RX < 1) continue;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(c[0], cy, RX, RY, 0, 0, TAU); ctx.clip();
      const g = ctx.createLinearGradient(0, cy - RY, 0, cy + RY);
      g.addColorStop(0, '#0f2a28'); g.addColorStop(1, '#06100f');
      ctx.fillStyle = g; ctx.fillRect(c[0] - RX, cy - RY, RX * 2, RY * 2);
      // 倒映的天光
      for (let k = 0; k < 4; k++) {
        const yy = cy - RY * 0.5 + k * RY * 0.35, ww = RX * (0.7 - k * 0.12);
        const sh = Math.sin(time * 1.6 + k + x) * RX * 0.08;
        ctx.fillStyle = `rgba(120,200,180,${0.16 - k * 0.03})`;
        ctx.fillRect(Math.round(c[0] - ww / 2 + sh), Math.round(yy), Math.round(ww), 1);
      }
      // 涟漪
      const ph = (((time * 0.45 + x * 0.37 + z * 0.21) % 1.6) + 1.6) % 1.6;
      if (ph < 1) {
        ctx.strokeStyle = `rgba(140,220,200,${0.35 * (1 - ph)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(c[0] + RX * 0.2, cy, RX * 0.15 + ph * RX * 0.5, (RY * 0.15 + ph * RY * 0.5), 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(150,210,190,0.18)';
      ctx.beginPath(); ctx.ellipse(c[0], cy, RX, RY, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
  };

  // —— 圆形石供品盘 ——
  R.drawDish = function (ctx, time) {
    const [cx, cz] = G.BOARD_C, Rr = G.DISH_R;
    groundEllipse(ctx, cx + 0.25, 0.01, cz - 0.3, Rr + 0.15, Rr + 0.1, 'rgba(0,0,0,0.6)');
    // 外侧壁
    const top = ring(cx, cz, Rr, G.DISH_TOP, 64), bot = ring(cx, cz, Rr, 0, 64);
    const side = [];
    for (let i = 0; i <= 32; i++) side.push(top[(i + 32) % 64]);
    for (let i = 32; i >= 0; i--) side.push(bot[(i + 32) % 64]);
    poly(ctx, side, '#1a2a28');
    // 侧壁上的竖刻纹
    for (let i = 33; i < 64; i += 3) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; const a = top[i], b = bot[i]; ctx.fillRect(Math.round(a[0]), Math.round(a[1]), 1, Math.max(1, Math.round(b[1] - a[1]))); }
    poly(ctx, top, '#355049');
    // 盘沿内圈
    const inner = ring(cx, cz, Rr - 0.42, G.DISH_TOP, 64);
    poly(ctx, inner, '#0f1a19');
    poly(ctx, ring(cx, cz - 0.06, Rr - 0.48, G.FLOOR_H, 64), '#22332f');
    // 盘沿高光
    ctx.strokeStyle = 'rgba(150,200,180,0.35)'; ctx.beginPath();
    for (let i = 32; i <= 64; i++) { const p = top[i % 64]; i === 32 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
    ctx.stroke();
    // 盘沿分格与漩涡刻纹
    const glow = 0.3 + 0.18 * Math.sin(time * 1.1);
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * TAU;
      const p1 = P(cx + Math.cos(a0) * (Rr - 0.42), G.DISH_TOP, cz + Math.sin(a0) * (Rr - 0.42)), p2 = P(cx + Math.cos(a0) * Rr, G.DISH_TOP, cz + Math.sin(a0) * Rr);
      ctx.strokeStyle = 'rgba(5,12,11,0.9)'; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      const am = a0 + TAU / 20, rm = Rr - 0.21;
      ctx.strokeStyle = `rgba(80,220,160,${glow})`;
      ctx.beginPath();
      for (let j = 0; j <= 14; j++) {
        const t = j / 14, aa = am + t * 7, rr = 0.15 * (1 - t);
        const p = P(cx + Math.cos(am) * rm + Math.cos(aa) * rr, G.DISH_TOP, cz + Math.sin(am) * rm + Math.sin(aa) * rr * 0.9);
        j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    // 盘底同心圆与中心大漩涡
    ctx.strokeStyle = 'rgba(4,10,9,0.7)';
    for (const rr of [1.5, 2.9]) { const pts = ring(cx, cz, rr, G.FLOOR_H, 48); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke(); }
    ctx.strokeStyle = `rgba(70,200,150,${glow * 0.8})`;
    ctx.beginPath();
    for (let j = 0; j <= 80; j++) { const t = j / 80, a = t * TAU * 3 + time * 0.2, rr = 0.1 + t * 1.2; const p = P(cx + Math.cos(a) * rr, G.FLOOR_H, cz + Math.sin(a) * rr); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
  };

  // —— 供品（有体积的贴图，立在盘里） ——
  function objectAt(ctx, type, x, h, z, size, dim, shadowH) {
    const p = P(x, h, z), s = p[2] * size;
    groundEllipse(ctx, x + 0.06, shadowH, z - 0.04, size * 0.36, size * 0.3, 'rgba(0,0,0,0.5)');
    const w = Math.max(4, Math.round(s));
    const X = Math.round(p[0] - w / 2), Y = Math.round(p[1] - w * 0.9);
    ctx.drawImage(dim ? G.SPRITES_DIM[type] : G.SPRITES[type], X, Y, w, w);
    return { x: X, y: Y, w };
  }

  R.drawTiles = function (ctx, hover) {
    const alive = S.tiles.filter(t => t.alive);
    alive.forEach(t => {
      const w = G.boardToWorld(t.gx, t.gy);
      const jr = G.mulberry(t.gx * 131 + t.gy * 17 + t.layer * 7 + 3);
      t.wx = w[0] + (jr() - 0.5) * 0.14; t.wz = w[1] + (jr() - 0.5) * 0.12;
    });
    alive.sort((a, b) => (b.wz - b.layer * 0.7) - (a.wz - a.layer * 0.7) || a.wx - b.wx);
    G.tileQuads = [];
    for (const t of alive) {
      const covered = G.isCovered(t, S.tiles);
      const blocked = !covered && G.pressBlocks(t);
      const free = !covered && !blocked;
      const lift = (t === hover && free ? 0.14 : 0) + Math.sin(t.pop * Math.PI) * 0.35;
      const bh = G.baseH(t.layer);
      const r = objectAt(ctx, t.type, t.wx, bh + lift, t.wz, G.OBJ, covered, bh);
      G.tileQuads.push({ t, rect: r, free, type: t.type });
    }
  };

  R.drawSlotRail = function (ctx, time) {
    const live = G.liveSlot().length;
    const danger = live >= 5 ? (live - 4) / 3 : 0;
    const z0 = G.SLOT_Z - 0.62, z1 = G.SLOT_Z + 0.62;
    block(ctx, -4.15, 4.15, z0, z1, 0.22, 0.22, '#2c403b', '#17231f', '#121c19');
    for (let i = 0; i < G.SLOT_N; i++) {
      const x = G.slotX(i);
      groundEllipse(ctx, x, 0.22, G.SLOT_Z, 0.46, 0.46, '#050a09');
      groundEllipse(ctx, x, 0.22, G.SLOT_Z + 0.06, 0.4, 0.36, '#0d1715');
      const e = P(x, 0.22, G.SLOT_Z - 0.46);
      ctx.fillStyle = 'rgba(140,190,170,0.3)'; ctx.fillRect(Math.round(e[0] - e[2] * 0.25), Math.round(e[1]), Math.round(e[2] * 0.5), 1);
      if (danger > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(time * (4 + danger * 6));
        groundEllipse(ctx, x, 0.22, G.SLOT_Z, 0.5, 0.5, `rgba(180,20,12,${0.15 + danger * 0.25 * pulse})`);
      }
    }
  };

  R.drawSlotItems = function (ctx, dt) {
    let i = 0;
    for (const it of S.slot) { it.tx = G.slotX(i); it.tz = G.SLOT_Z; i++; }
    const order = S.slot.slice().sort((a, b) => b.z - a.z);
    for (const it of order) {
      const k = Math.min(1, dt * 13);
      it.x += (it.tx - it.x) * k; it.z += (it.tz - it.z) * k;
      it.fly = Math.max(0, it.fly - dt * 3.6);
      it.h += (0.14 - it.h) * k;
      const arc = Math.sin(it.fly * Math.PI) * 1.3;
      let size = 1.0;
      if (it.dying) { it.dying += dt; size *= Math.max(0, 1 - it.dying / 0.35) * (1 + Math.sin(it.dying * 40) * 0.1); }
      if (size <= 0.02) continue;
      objectAt(ctx, it.type, it.x, it.h + arc, it.z, size, false, 0.15);
    }
    for (const it of S.slot.filter(s => s.dying && s.dying > 0.35)) {
      const p = P(it.x, 0.5, it.z);
      for (let k = 0; k < 12; k++) S.particles.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 60 - 10, life: 0.9, c: Math.random() < 0.6 ? '#7a140e' : '#3fbf8a' });
    }
    S.slot = S.slot.filter(s => !(s.dying && s.dying > 0.35));
    if (S.state === 'play') G.checkEnd();
  };

  R.drawParticles = function (ctx, dt) {
    for (const p of S.particles) {
      p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    S.particles = S.particles.filter(p => p.life > 0);
  };

  // 水中悬浮的「海雪」
  R.snow = null;
  R.drawSnow = function (ctx, W, H, dt) {
    // 空气里缓缓落下的尘与潮气
    if (!R.snow || R.snowW !== W) { R.snowW = W; R.snow = Array.from({ length: 28 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 1.5 + Math.random() * 3, a: 0.08 + Math.random() * 0.2 })); }
    for (const s of R.snow) {
      s.y += s.v * dt; s.x += Math.sin(S.time * 0.5 + s.v) * dt * 1.5;
      if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
      ctx.fillStyle = `rgba(170,210,195,${s.a})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
  };

  // —— 录像带：噪点、暗角、偶尔闪烁 ——
  R.noise = [];
  R.buildNoise = function (W, H) {
    R.noise = [];
    for (let f = 0; f < 4; f++) {
      const c = G.makeCanvas(W, H), x = c.getContext('2d');
      const img = x.createImageData(W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.random() < 0.5 ? 255 : 0;
      }
      x.putImageData(img, 0, 0);
      R.noise.push(c);
    }
  };
  R.drawFX = function (ctx, W, H, time) {
    const madness = 1 - S.san / 100;
    if (R.noise.length) {
      ctx.globalAlpha = 0.05 + madness * 0.13;
      ctx.drawImage(R.noise[Math.floor(time * 24) % 4], 0, 0);
      ctx.globalAlpha = 1;
    }
    const g = ctx.createRadialGradient(W / 2, H * 0.6, Math.min(W, H) * (0.32 - madness * 0.12), W / 2, H * 0.6, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,4,4,${0.7 + madness * 0.27})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (madness > 0.05) { ctx.fillStyle = `rgba(100,0,0,${madness * 0.18})`; ctx.fillRect(0, 0, W, H); }
    const band = (time * 0.37) % 1;
    if (band < 0.06) { ctx.fillStyle = 'rgba(200,230,220,0.05)'; ctx.fillRect(0, Math.round((band / 0.06) * H), W, 3); }
  };

  // 点选：贴图像素级判定（透明处不算）
  R.hitTile = function (x, y) {
    if (!G.tileQuads) return null;
    const N = G.SPR_N;
    for (let i = G.tileQuads.length - 1; i >= 0; i--) {
      const q = G.tileQuads[i], r = q.rect;
      if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.w) continue;
      const u = Math.floor(((x - r.x) / r.w) * N), v = Math.floor(((y - r.y) / r.w) * N);
      const m = G.SPRITE_MASK[q.type];
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) {
        const U = u + dx, V = v + dy;
        if (U >= 0 && V >= 0 && U < N && V < N && m[V * N + U]) hit = true;
      }
      if (hit) return q;
    }
    return null;
  };

  R.frame = function (ctx, W, H, dt, hover) {
    const time = S.time;
    ctx.imageSmoothingEnabled = false;
    M.layout(W, H);
    R.drawSky(ctx, W, H, time);
    M.drawWall(ctx, W, H);
    M.drawBack(ctx, time, W, H);
    R.drawAltar(ctx, W, H, time);
    M.drawFront(ctx, time, dt, W, H);
    R.drawRays(ctx, W, H, time);
    R.drawDish(ctx, time);
    R.drawTiles(ctx, hover);
    R.drawSlotRail(ctx, time);
    R.drawSlotItems(ctx, dt);
    G.drawEvent(ctx);
    R.drawParticles(ctx, dt);
    R.drawSnow(ctx, W, H, dt);
    S.tiles.forEach(t => (t.pop = Math.max(0, t.pop - dt * 3)));
    R.drawFX(ctx, W, H, time);
  };
})();
