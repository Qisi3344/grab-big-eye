// 五个祭夜的仪式：腐眼、潮汐、血月、凝视锁定、黑暗终局。
// 以及整局都在的恐怖层：祂的凝视（凑近惊吓）、低语、供品蠕动。
// 全局量：G.MON_Z（怪物离镜头的距离）、G.RISE（血月满时祂起身）、G.SHAKE（震屏）、G.DIM（画面压暗）。
(function () {
  const G = window.G, S = G.S;
  const R = (G.RITE = {});
  const TAU = Math.PI * 2;

  // ———— 低语 ————
  const WHISPERS = [
    '不要数它的眼睛。',
    '它在学你手的动作。',
    '供品记得你的味道。',
    '水底下没有影子。',
    '第七只眼从来没有闭上过。',
    '祂喜欢听你数数。',
    '盘底的凉意，是从祂那边漫过来的。',
    '你以为你在挑它们？',
    '别回头看门口。',
    '今晚的月亮看过太多。',
    '它们排好了队，等你。',
    '槽满了的时候，别叫出声。',
    '潮水退去的地方，躺着一整座城。',
    '祂的饥饿没有形状。',
    '你抓东西的样子，越来越像它了。',
    '石缝里的眼睛在换班。',
    '祂数过你的手指。',
    '这些眼睛里，有一双是你认识的。',
    '蜡烛的火苗，一直朝着祂弯腰。',
    '腐掉的那几只，是故意的。',
    '祂等的从来不是供品。',
    '数到三。不要数到三。',
  ];
  let whispers = [];

  function spawnWhisper(text, urgent) {
    if (whispers.length >= 2) whispers.shift();
    const corner = Math.floor(Math.random() * 4);
    whispers.push({
      text: text || WHISPERS[Math.floor(Math.random() * WHISPERS.length)],
      x: corner % 2 ? 0.72 + Math.random() * 0.14 : 0.1 + Math.random() * 0.16,
      y: corner < 2 ? 0.1 + Math.random() * 0.2 : 0.62 + Math.random() * 0.22,
      rot: (Math.random() - 0.5) * 0.09,
      t: 0, dur: urgent ? 2.2 : 3.4, urgent: !!urgent,
    });
    if (G.A) G.A.sfx('whisper');
  }

  // ———— 咬 ————
  G.bite = function (n, why) {
    S.san = Math.max(0, S.san - n);
    G.SHAKE = Math.max(G.SHAKE, 2.6);
    G.say(why, 2);
    if (G.setMood) G.setMood('angry', 1.6);
    if (G.A) G.A.sfx('bite');
  };

  // ———— 状态 ————
  R.has = {};                 // 本夜有哪些仪式
  let nextWriggle = 6, nextWhisper = 20;
  const gaze = { phase: 'idle', t: 0, next: 0 };     // 凝视惊吓（全局）
  const lock = { phase: 'idle', t: 0, type: -1, next: 0 };   // 凝视锁定（第五夜）
  const tide = { t: 0, level: 0, wz: 99, shadow: -20 };
  const moon = { rise: 0, rest: 0, lit: 0, hit: null };

  G.riteInit = function (lv) {
    R.has = {};
    (lv.rites || []).forEach(k => (R.has[k] = true));
    whispers = [];
    nextWriggle = 5 + Math.random() * 4;
    nextWhisper = 12 + Math.random() * 10;
    gaze.phase = 'idle'; gaze.t = 0;
    gaze.next = (R.has.gazeLock ? 22 : 38) + Math.random() * 30;
    lock.phase = 'idle'; lock.type = -1; lock.next = 8 + Math.random() * 5;
    tide.t = Math.random() * 13; tide.level = 0; tide.wz = 99; tide.shadow = -20;
    moon.rise = 0; moon.rest = 0; moon.lit = 0; moon.hit = null;
    G.RISE = 0;
    S.moon = 0; S.moonProgress = 0;
    if (G.A) G.A.rite(R.has.blackRite ? 'black' : 'normal');
  };

  // 潮汐：淹没判定（远处先淹）
  const TIDE_PERIOD = 13;
  function tideCovers(t) {
    if (!R.has.tide || tide.level < 0.14) return false;
    const [, wz] = G.boardToWorld(t.gx, t.gy);
    return wz > tide.wz;
  }
  G.tideLevel = () => (R.has.tide ? tide.level : 0);

  // 凝视锁定：这一夜祂盯死的类型
  G.lockType = () => (lock.phase === 'lock' ? lock.type : -1);
  G.lockWarn = () => (lock.phase === 'warn' ? lock.type : -1);

  G.riteBlocks = function (t) {
    if (tideCovers(t)) return true;
    if (lock.phase === 'lock' && t.type === lock.type) return true;
    return false;
  };
  G.riteOnGrab = function (t) {
    if (lock.phase === 'lock' && t.type === lock.type) {
      G.bite(15, '祂正盯着这一只——你的手停在了半空');
      if (G.A) G.A.sfx('sting');
      return true;
    }
    return false;
  };

  // 献祭回调
  G.onMatch = function (type) {
    if (G.A) G.A.sfx('match');
    if (R.has.rotEye && type === G.ROTEYE) {
      S.san = Math.max(0, S.san - 6);
      G.say('腐眼在槽里瘪了下去……不祥', 2);
    }
    if (R.has.moon) {
      S.moonProgress++;
      if (S.moonProgress >= 3) {
        S.moonProgress = 0;
        if (S.moon < 3) {
          S.moon++;
          if (G.A) G.A.sfx('moon');
          G.say(['血月升起来了', '血月又高了一分', '血月快要全圆了'][S.moon - 1], 2);
          if (S.moon >= 3) spawnWhisper('月亮全圆了。抬头。', true);
        }
      }
    }
    if (R.has.gazeLock && lock.phase === 'lock' && Math.random() < 0.4) lock.t = Math.max(0.6, lock.t - 1.5);  // 多献祭能让祂移开视线
  };

  G.onGrab = function () {
    // 抓取本身偶尔惊动供品群：旁边轻轻动一下
    if (R.has.rotEye && Math.random() < 0.25) wriggleNear();
  };

  // 血月加速：升得越高，捣乱越勤
  G.moonHaste = function () {
    if (!R.has.moon) return 1;
    return Math.max(0.62, 1 - S.moon * 0.13 + (moon.rest > 0 ? 0.1 : 0));
  };
  G.moonRise = () => (R.has.moon ? moon.rise : 0);

  // 点击血月：让它垂下去一会儿
  R.moonHit = function (x, y) {
    if (!R.has.moon || S.moon <= 0 || moon.rest > 0) return false;
    const h = moon.hit;
    if (h && (x - h[0]) ** 2 + (y - h[1]) ** 2 < (h[2] + 6) ** 2) {
      moon.rest = 16;
      S.san = Math.max(0, S.san - 6);
      G.say('你逼月亮垂下眼。神智顺着月光流走了一点', 2.4);
      if (G.A) G.A.sfx('splash');
      return true;
    }
    return false;
  };

  // ———— 蠕动：供品偶尔自己动一下 ————
  function wriggleNear() {
    const alive = S.tiles.filter(t => t.alive && !G.isCovered(t, S.tiles));
    if (!alive.length) return;
    const t = alive[Math.floor(Math.random() * alive.length)];
    t.pop = Math.max(t.pop, 0.16);
  }
  function wriggle() {
    const alive = S.tiles.filter(t => t.alive);
    if (!alive.length) return;
    const t = alive[Math.floor(Math.random() * alive.length)];
    t.pop = Math.max(t.pop, R.has.rotEye && t.type === G.ROTEYE ? 0.3 : 0.14);
    if (Math.random() < 0.3 && G.A) G.A.sfx('squish');
  }

  // ———— 主更新 ————
  G.updateRites = function (dt) {
    if (S.state !== 'play') { updateGaze(dt, true); return; }
    // 低语
    nextWhisper -= dt;
    if (nextWhisper <= 0) {
      spawnWhisper();
      nextWhisper = (S.san < 40 ? 9 : 16) + Math.random() * (S.san < 40 ? 8 : 22);
    }
    for (const w of whispers) w.t += dt;
    whispers = whispers.filter(w => w.t < w.dur);
    // 蠕动
    nextWriggle -= dt * (R.has.rotEye ? 1.25 : 1);
    if (nextWriggle <= 0) { wriggle(); nextWriggle = 3.5 + Math.random() * 5; }
    // 潮汐
    if (R.has.tide) {
      tide.t += dt;
      tide.level = (1 - Math.cos((tide.t / TIDE_PERIOD) * TAU)) / 2;   // 0..1..0
      // 水线：淹掉世界 z > wz 的区域（远处先淹）。涨到顶时淹掉最远三排。
      tide.wz = 7.7 - tide.level * 6.2;
      if (tide.level > 0.55) {
        tide.shadow += dt * (1.5 + tide.level);
        if (tide.shadow > 20) tide.shadow = -20 - Math.random() * 10;
        if (Math.random() < dt * 0.12) wriggle();     // 水里有东西挤了一下
      }
    }
    // 血月
    if (R.has.moon) {
      moon.rest = Math.max(0, moon.rest - dt);
      const full = S.moon >= 3 && moon.rest <= 0;
      moon.rise += ((full ? 1 : S.moon / 3 * 0.55) - moon.rise) * Math.min(1, dt * 1.4);
      moon.lit = full ? Math.min(1, moon.lit + dt * 0.5) : Math.max(0, moon.lit - dt * 0.8);
      if (G.RISE != null) G.RISE += ((full ? 1 : 0) - G.RISE) * Math.min(1, dt * 1.1);
      // 血月挂得很低，就悬在祭盘上方
      moon.hit = null;
    }
    // 凝视锁定（第五夜）
    if (R.has.gazeLock) updateLock(dt);
    // 黑暗终局：抓空前九件，灯灭
    if (R.has.blackRite && !S.blackRite && G.boardLeft() <= 9) {
      S.blackRite = true;
      G.say('灯灭了。祂凑得越来越近', 3);
      spawnWhisper('把最后几件，放进祂手里。', true);
      if (G.A) G.A.rite('black');
      if (G.setMood) G.setMood('stare', 3);
    }
    if (S.blackRite) G.MON_Z += (8.6 - G.MON_Z) * Math.min(1, dt * 0.5);
    updateGaze(dt, false);
  };

  function updateGaze(dt, paused) {
    gaze.t += dt;
    if (paused && gaze.phase !== 'idle') { gaze.phase = 'idle'; gaze.next = 20; }
    if (gaze.phase === 'idle') {
      gaze.next -= dt;
      if (!paused && gaze.next <= 0) {
        gaze.phase = 'omen'; gaze.t = 0;
        spawnWhisper('祂在看你。', true);
        if (G.A) G.A.sfx('omen');
      }
    } else if (gaze.phase === 'omen' && gaze.t >= 1.3) {
      gaze.phase = 'on'; gaze.t = 0;
      G.SHAKE = Math.max(G.SHAKE, 3.2);
      S.san = Math.max(0, S.san - 5);
      if (G.A) G.A.sfx('sting');
      if (G.setMood) G.setMood('stare', 2);
    } else if (gaze.phase === 'on') {
      G.SHAKE = Math.max(G.SHAKE, 1.2);
      if (gaze.t >= 1.9) { gaze.phase = 'idle'; gaze.t = 0; gaze.next = (R.has.gazeLock ? 26 : 40) + Math.random() * 34; }
    }
    // MON_Z：惊吓时推近，其余时间回原位（不管是否在玩都要回落；结束后黑幕退去）
    const target = paused ? 10.6 : gaze.phase === 'on' ? 7.1 : S.blackRite ? 8.6 : 10.6;
    const speed = gaze.phase === 'on' ? 9 : 2.2;
    G.MON_Z += (target - G.MON_Z) * Math.min(1, dt * speed);
    G.DIM = paused ? 0 : (gaze.phase === 'omen' ? Math.min(0.5, gaze.t * 0.4) : 0) + (gaze.phase === 'on' ? 0.3 : 0) + (S.blackRite ? 0.32 : 0);
  }

  function updateLock(dt) {
    lock.t += dt;
    if (lock.phase === 'idle') {
      lock.next -= dt;
      if (lock.next <= 0) {
        // 挑盘中剩得最多的三种之一（别盯已被抓空的类型）
        const alive = S.tiles.filter(t => t.alive);
        const by = {};
        alive.forEach(t => (by[t.type] = (by[t.type] || 0) + 1));
        const top = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 3).map(Number);
        lock.type = top[Math.floor(Math.random() * top.length)];
        lock.phase = 'warn'; lock.t = 0;
        const name = G.TYPES[lock.type].name;
        G.say('眼墙齐齐转向了' + name + '……', 2.6);
        spawnWhisper('祂看上了' + name + '。', true);
        if (G.A) G.A.sfx('omen');
      }
    } else if (lock.phase === 'warn' && lock.t >= 3) {
      lock.phase = 'lock'; lock.t = 0;
      G.SHAKE = Math.max(G.SHAKE, 2);
      if (G.A) G.A.sfx('lock');
    } else if (lock.phase === 'lock' && lock.t >= 6.5) {
      lock.phase = 'idle'; lock.t = 0; lock.next = 7 + Math.random() * 6;
      G.say('祂的视线移开了', 1.6);
    }
  }

  // ———— 绘制 ————

  // 腐化之眼的活瞳孔：贴图上叠一只会转的小瞳（盘中与槽里都调用）
  R.drawRotPupil = function (ctx, rect) {
    const w = rect.w, cx = rect.x + w * 0.47, cy = rect.y + w * 0.46;
    const p = G.pointer || { x: cx - 30, y: cy - 10 };
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 140) * w * 0.1;
    const px = cx + (dx / d) * k, py = cy + (dy / d) * k * 0.8;
    ctx.fillStyle = '#0d0a04';
    ctx.beginPath(); ctx.ellipse(px, py, Math.max(0.8, w * 0.045), Math.max(2, w * 0.12), 0.35, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,150,0.5)';
    ctx.fillRect(Math.round(px - w * 0.03), Math.round(py - w * 0.07), 1, 1);
  };

  // 凝视锁定 / 预告的泛红脉冲（画在供品脚下）
  R.tileWarn = function (t) {
    if (lock.phase === 'lock' && t.type === lock.type) return 1;
    if (lock.phase === 'warn' && t.type === lock.type) return 0.45 + 0.25 * Math.sin(S.time * 6);
    return 0;
  };

  // 水面：只盖在盘内（世界坐标画）
  R.drawWater = function (ctx) {
    if (!R.has.tide || tide.level < 0.02) return;
    const alpha = Math.min(0.62, 0.14 + tide.level * 0.5);
    const a = G.proj(-4.35, G.FLOOR_H + 0.02, 8.45), b = G.proj(4.35, G.FLOOR_H + 0.02, 8.45);
    const c = G.proj(4.35, G.FLOOR_H + 0.02, tide.wz), d = G.proj(-4.35, G.FLOOR_H + 0.02, tide.wz);
    if (b[0] - a[0] < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(14,46,44,${alpha})`;
    ctx.fill();
    ctx.clip();
    // 水下晃动的光带
    for (let k = 0; k < 6; k++) {
      const yy = c[1] + Math.sin(S.time * 0.9 + k * 1.7) * 3 + k * 5;
      ctx.fillStyle = `rgba(120,200,180,${0.05 + 0.04 * Math.sin(S.time * 1.3 + k)})`;
      ctx.fillRect(a[0], yy, b[0] - a[0], 1);
    }
    ctx.restore();
    // 水线高光
    ctx.strokeStyle = `rgba(150,220,200,${0.25 + tide.level * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    // 水下的影子：涨潮时缓慢横移的一团黑
    if (tide.level > 0.55 && tide.shadow > -18) {
      const sx = tide.shadow, sz = tide.wz + 1.2;
      const p1 = G.proj(sx - 2.2, G.FLOOR_H + 0.03, sz), p2 = G.proj(sx + 2.2, G.FLOOR_H + 0.03, sz);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse((p1[0] + p2[0]) / 2, p1[1], Math.abs(p2[0] - p1[0]) / 2, Math.abs(p2[0] - p1[0]) / 5, 0, 0, TAU); ctx.fill();
    }
  };

  // 血月：挂在天空一角
  R.moonScreen = function (W) {
    return [W * 0.845, 34 + moon.rise * 10];
  };
  R.drawMoon = function (ctx, W, H) {
    if (!R.has.moon || moon.rise <= 0.01) { moon.hit = null; return; }
    const [x, y] = R.moonScreen(W);
    const r = 13 + moon.rise * 7;
    moon.hit = [x, y, r];
    const red = G.mixHex('#5a1410', '#c11812', moon.lit);
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
    g.addColorStop(0, G.mixHex('#3a0c0a', '#801510', moon.lit) + 'cc');
    g.addColorStop(1, 'rgba(20,4,4,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = red;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // 月面：一只闭合的眼，随血月升高缓缓睁开
    const open = moon.lit;
    ctx.fillStyle = '#2a0705';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.52, Math.max(0.6, r * 0.3 * open), 0, 0, TAU); ctx.fill();
    if (open > 0.1) {
      ctx.fillStyle = '#ff3020';
      ctx.beginPath(); ctx.arc(x, y, r * 0.16 * open, 0, TAU); ctx.fill();
    }
    // 月晕的环
    ctx.strokeStyle = `rgba(200,40,30,${0.14 + moon.lit * 0.2})`;
    ctx.beginPath(); ctx.arc(x, y, r * 1.5 + Math.sin(S.time * 0.8) * 1.5, 0, TAU); ctx.stroke();
    if (moon.rest > 0) {   // 被玩家按下去的时候，月面下移、发暗
      const k = Math.min(1, moon.rest / 2.5);
      ctx.fillStyle = `rgba(5,2,2,${k * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y + k * 6, r + 2, 0, TAU); ctx.fill();
    }
  };

  // 低语文字（屏幕层）
  R.drawWhispers = function (ctx, W, H) {
    for (const w of whispers) {
      const fade = w.t < 0.5 ? w.t / 0.5 : w.t > w.dur - 0.8 ? (w.dur - w.t) / 0.8 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade) * (w.urgent ? 0.85 : 0.5);
      ctx.fillStyle = w.urgent ? '#c8bfae' : '#8f9a8a';
      ctx.font = '9px Georgia, serif';
      ctx.translate(w.x * W, w.y * H);
      ctx.rotate(w.rot);
      // 字底一层黑晕，保证在亮背景上也可读
      const tw = ctx.measureText(w.text).width;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-3, -8, tw + 6, 13);
      ctx.fillStyle = w.urgent ? '#c8bfae' : '#8f9a8a';
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }
  };

  // 凝视惊吓的前兆罩（画面边缘向内压暗 + 轻微红）
  R.drawGazeVeil = function (ctx, W, H) {
    if (gaze.phase !== 'omen' && gaze.phase !== 'on') return;
    const k = gaze.phase === 'on' ? 1 : gaze.t / 1.3;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.44 - k * 0.1), W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(${gaze.phase === 'on' ? '26,0,0' : '0,0,0'},${0.5 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };

  R.whisperNow = spawnWhisper;
})();
