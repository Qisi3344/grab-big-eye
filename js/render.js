// 场景绘制：旧木桌、石祭盘、厚石板供品、凹陷槽位轨、录像带噪点。
(function () {
  const G = window.G, S = G.S, M = G.M;
  const R = (G.R = {});

  function quad(ctx, pts, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }
  const P = (x, y, z) => G.proj(x, y, z);

  // 把 16×16 贴图仿射到透视顶面上（单张很小，仿射误差可忽略）
  function drawSpriteOnQuad(ctx, img, tl, tr, bl, inset) {
    const ax = (tr[0] - tl[0]) / 16, ay = (tr[1] - tl[1]) / 16;
    const bx = (bl[0] - tl[0]) / 16, by = (bl[1] - tl[1]) / 16;
    ctx.save();
    ctx.setTransform(ax, ay, bx, by, tl[0] + (ax + bx) * inset, tl[1] + (ay + by) * inset);
    ctx.drawImage(img, 0, 0, 16 - inset * 2, 16 - inset * 2);
    ctx.restore();
  }

  // 一块厚石板（世界中心 x,z，顶面高 h，半边长 hs，厚 th，绕 y 旋转 rot）
  function slab(ctx, x, z, h, hs, th, rot, opt) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = Array.isArray(hs) ? hs[0] : hs, hz = Array.isArray(hs) ? hs[1] : hs;
    const corner = (dx, dz, y) => P(x + dx * c - dz * s, y, z + dx * s + dz * c);
    const TL = corner(-hx, hz, h), TR = corner(hx, hz, h), BR = corner(hx, -hz, h), BL = corner(-hx, -hz, h);
    const BRb = corner(hx, -hz, h - th), BLb = corner(-hx, -hz, h - th), TRb = corner(hx, hz, h - th);
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // 硬偏移投影
    if (opt.shadow) {
      const sh = (dx, dz) => P(x + dx * c - dz * s + 0.13, h - th, z + dx * s + dz * c - 0.16);
      quad(ctx, [sh(-hx, hz), sh(hx, hz), sh(hx, -hz), sh(-hx, -hz)], 'rgba(0,0,0,0.5)');
    }
    // 右侧（压暗）
    quad(ctx, [TR, BR, BRb, TRb], opt.right || '#1a1915');
    // 前侧：两层深色厚度
    const m1 = mid(BL, BLb), m2 = mid(BR, BRb);
    quad(ctx, [BL, BR, m2, m1], opt.front1 || '#3a3830');
    quad(ctx, [m1, m2, BRb, BLb], opt.front2 || '#24221d');
    quad(ctx, [TL, TR, BR, BL], opt.top || '#57534a');
    // 顶面高光边
    ctx.strokeStyle = opt.edge || 'rgba(170,160,140,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BL[0], BL[1] - 0.5); ctx.lineTo(TL[0], TL[1]); ctx.lineTo(TR[0], TR[1]); ctx.stroke();
    return { TL, TR, BR, BL };
  }
  R.slab = slab;

  R.drawTable = function (ctx, W, H) {
    const far = 9.4, near = -4;
    quad(ctx, [P(-16, 0, far), P(16, 0, far), P(16, 0, near), P(-16, 0, near)], '#2a1c13');
    // 木板接缝（沿 z 方向延伸）
    for (let x = -15; x <= 15; x += 1.35) {
      const a = P(x, 0, far), b = P(x, 0, near);
      ctx.strokeStyle = 'rgba(8,4,2,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // 木纹
    const r = G.mulberry(31);
    for (let k = 0; k < 260; k++) {
      const x = -15 + r() * 30, z = near + r() * (far - near), L = 0.4 + r() * 1.6;
      const a = P(x, 0, z), b = P(x + (r() - 0.5) * 0.08, 0, z + L);
      ctx.strokeStyle = r() < 0.5 ? 'rgba(70,46,28,0.55)' : 'rgba(14,8,4,0.5)';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // 桌沿
    const e1 = P(-16, 0, far), e2 = P(16, 0, far);
    ctx.fillStyle = '#120b07'; ctx.fillRect(0, Math.round(e1[1]) - 1, W, 2);
    // 顶部一池暗光：其余地方压黑
    const c = P(0, 0, 3.2);
    const g = ctx.createRadialGradient(c[0], c[1], c[2] * 1.5, c[0], c[1], c[2] * 9);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = g; ctx.fillRect(0, Math.round(e1[1]), W, H);
  };

  R.drawBoard = function (ctx) {
    const rot = G.boardRot, [cx, cz] = G.BOARD_C;
    // 盘底在桌面压出的厚影子
    slab(ctx, cx + 0.18, cz - 0.25, 0.02, [3.95, 3.4], 0.02, rot, { top: 'rgba(0,0,0,0.6)', front1: 'rgba(0,0,0,0)', front2: 'rgba(0,0,0,0)', right: 'rgba(0,0,0,0)', edge: 'rgba(0,0,0,0)' });
    const q = slab(ctx, cx, cz, G.BOARD_TOP, [3.85, 3.3], G.BOARD_TOP, rot, { top: '#3b3a33', front1: '#2b2a24', front2: '#1b1a16', right: '#141310' });
    // 内圈刻槽
    const c = Math.cos(rot), s = Math.sin(rot);
    const pt = (dx, dz) => P(cx + dx * c - dz * s, G.BOARD_TOP, cz + dx * s + dz * c);
    ctx.strokeStyle = 'rgba(10,10,8,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath();
    [[-3.6, 2.95], [3.6, 2.95], [3.6, -2.95], [-3.6, -2.95]].forEach(([a, b], i) => { const p = pt(a, b); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.stroke();
    // 刻在盘沿的符文
    const r = G.mulberry(8);
    ctx.fillStyle = 'rgba(120,30,24,0.55)';
    for (let k = 0; k < 26; k++) {
      const t = k / 26, side = Math.floor(t * 4), f = (t * 4) % 1;
      const pos = [[-3.72 + f * 7.44, 3.15], [3.72, 3.15 - f * 6.3], [3.72 - f * 7.44, -3.15], [-3.72, -3.15 + f * 6.3]][side];
      const p = pt(pos[0], pos[1]);
      ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 1 + Math.round(r()), 1 + Math.round(r()));
    }
    return q;
  };

  R.drawTiles = function (ctx, hover) {
    const alive = S.tiles.filter(t => t.alive);
    alive.forEach(t => { const w = G.boardToWorld(t.gx, t.gy); t.wx = w[0]; t.wz = w[1]; });
    alive.sort((a, b) => a.layer - b.layer || b.wz - a.wz || a.wx - b.wx);
    G.tileQuads = [];
    for (const t of alive) {
      const covered = G.isCovered(t, S.tiles);
      const blocked = !covered && G.pressBlocks(t);
      const free = !covered && !blocked;
      const lift = (t === hover && free ? 0.1 : 0) + Math.sin(t.pop * Math.PI) * 0.25;
      const h = G.tileTopH(t.layer) + lift;
      const q = slab(ctx, t.wx, t.wz, h, G.TILE_HALF, G.LAYER_H * 0.92, G.boardRot, { shadow: true, top: '#403d34', front1: '#2b2924', front2: '#191814', right: '#121110' });
      drawSpriteOnQuad(ctx, G.SPRITES[t.type], q.TL, q.TR, q.BL, 1.2);
      if (covered) quad(ctx, [q.TL, q.TR, q.BR, q.BL], 'rgba(4,5,3,0.62)');
      else if (blocked) quad(ctx, [q.TL, q.TR, q.BR, q.BL], 'rgba(20,4,24,0.35)');
      G.tileQuads.push({ t, poly: [q.TL, q.TR, q.BR, q.BL], free });
    }
  };

  R.drawSlotRail = function (ctx, time) {
    const live = G.liveSlot().length;
    const danger = live >= 5 ? (live - 4) / 3 : 0;
    slab(ctx, 0, G.SLOT_Z, 0.16, [3.85, 0.62], 0.16, 0, { top: '#34322b', front1: '#25231e', front2: '#161512', right: '#121110' });
    const rail = (x0, x1, z0, z1) => [P(x0, 0.16, z1), P(x1, 0.16, z1), P(x1, 0.16, z0), P(x0, 0.16, z0)];
    for (let i = 0; i < G.SLOT_N; i++) {
      const x = G.slotX(i), hs = 0.47;
      // 凹陷石孔：内壁亮一点、底部更黑
      quad(ctx, rail(x - hs, x + hs, G.SLOT_Z - hs, G.SLOT_Z + hs), '#0b0a08');
      quad(ctx, rail(x - hs + 0.06, x + hs - 0.06, G.SLOT_Z - hs + 0.06, G.SLOT_Z + hs - 0.14), '#16140f');
      const a = P(x - hs, 0.16, G.SLOT_Z - hs), b = P(x + hs, 0.16, G.SLOT_Z - hs);
      ctx.fillStyle = 'rgba(150,140,120,0.35)'; ctx.fillRect(Math.round(a[0]), Math.round(a[1]), Math.round(b[0] - a[0]), 1);
      if (danger > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(time * (4 + danger * 6));
        quad(ctx, rail(x - hs, x + hs, G.SLOT_Z - hs, G.SLOT_Z + hs), `rgba(170,16,10,${0.12 + danger * 0.22 * pulse})`);
      }
    }
  };

  R.drawSlotItems = function (ctx, dt) {
    // 目标位置
    let i = 0;
    for (const it of S.slot) {
      it.tx = G.slotX(i); it.tz = G.SLOT_Z; i++;
    }
    for (const it of S.slot) {
      const k = Math.min(1, dt * 13);
      it.x += (it.tx - it.x) * k; it.z += (it.tz - it.z) * k;
      const baseH = 0.12;
      it.fly = Math.max(0, it.fly - dt * 3.6);
      it.h += (baseH - it.h) * k;
      const arc = Math.sin(it.fly * Math.PI) * 1.1;
      let hs = G.SLOT_HALF;
      if (it.dying) { it.dying += dt; hs *= Math.max(0, 1 - it.dying / 0.35) * (1 + Math.sin(it.dying * 40) * 0.08); }
      if (hs <= 0.01) continue;
      const q = slab(ctx, it.x, it.z, it.h + arc + 0.12, hs, 0.14, 0, { shadow: true, top: it.dying ? '#6a1a14' : '#403d34', front1: '#2b2924', front2: '#191814', right: '#121110' });
      drawSpriteOnQuad(ctx, G.SPRITES[it.type], q.TL, q.TR, q.BL, 1.2);
    }
    // 消除完的从槽里拿掉，溅出暗红碎屑
    for (const it of S.slot.filter(s => s.dying && s.dying > 0.35)) {
      const p = P(it.x, 0.3, it.z);
      for (let k = 0; k < 9; k++) S.particles.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 60 - 10, life: 0.8, c: Math.random() < 0.6 ? '#6a0f0b' : '#2a1a10' });
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
    const g = ctx.createRadialGradient(W / 2, H * 0.62, Math.min(W, H) * (0.3 - madness * 0.12), W / 2, H * 0.62, Math.max(W, H) * 0.68);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.72 + madness * 0.25})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (madness > 0.05) { ctx.fillStyle = `rgba(90,0,0,${madness * 0.16})`; ctx.fillRect(0, 0, W, H); }
    // 偶尔的抖动横条
    const band = (time * 0.37) % 1;
    if (band < 0.06) { ctx.fillStyle = 'rgba(200,200,180,0.05)'; ctx.fillRect(0, Math.round(band / 0.06 * H), W, 3); }
  };

  R.hitTile = function (x, y) {
    if (!G.tileQuads) return null;
    for (let i = G.tileQuads.length - 1; i >= 0; i--) {
      const q = G.tileQuads[i];
      if (G.pointInPoly(x, y, q.poly)) return q;
    }
    return null;
  };

  R.frame = function (ctx, W, H, dt, hover) {
    const time = S.time;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    M.layout();
    M.drawWall(ctx, W, H);
    M.drawBack(ctx, time);
    R.drawTable(ctx, W, H);
    M.drawFront(ctx, time, dt);
    // 怪物一侧沉在暗处
    const fe = G.proj(0, 0, 9.4)[1];
    const dk = ctx.createLinearGradient(0, 0, 0, fe + 30);
    dk.addColorStop(0, 'rgba(0,0,0,0.55)'); dk.addColorStop(0.75, 'rgba(0,0,0,0.25)'); dk.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dk; ctx.fillRect(0, 0, W, fe + 30);
    R.drawBoard(ctx);
    R.drawTiles(ctx, hover);
    R.drawSlotRail(ctx, time);
    R.drawSlotItems(ctx, dt);
    G.drawEvent(ctx);
    R.drawParticles(ctx, dt);
    S.tiles.forEach(t => (t.pop = Math.max(0, t.pop - dt * 3)));
    R.drawFX(ctx, W, H, time);
  };
})();
