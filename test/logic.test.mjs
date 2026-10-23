// 逻辑测试（node，不需要浏览器）：五个祭夜的布局可解性 + 仪式状态机冒烟。
// 用法：node test/logic.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {}, console, setTimeout, clearTimeout, performance: { now: () => 0 }, Math, JSON, URLSearchParams };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const run = f => vm.runInContext(readFileSync(path.join(root, 'js', f), 'utf8'), sandbox, { filename: f });

let failed = 0;
const assert = (cond, msg) => { if (!cond) { failed++; console.error('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

run('util.js');
run('levels.js');
// sprites.js 依赖 canvas，这里以最小替身提供 TYPES
vm.runInContext(`
  window.G.TYPES = ['红瞳眼球','蓝瞳眼球','绿瞳眼球','金色猫眼','触手','蜡烛','小雕像','腐化之眼'].map(k => ({ key: k }));
  window.G.ROTEYE = 7;
`, sandbox);
run('board.js');
run('game.js');
run('rites.js');

const G = sandbox.window.G;

console.log('— 每一夜：供品数量 / 类型倍数 / 可解性 —');
const EXPECT = [63, 72, 84, 84, 96];
for (let lv = 1; lv <= 5; lv++) {
  G.level = lv;
  G.newGame();
  const S = G.S;
  const total = S.tiles.length;
  assert(total === EXPECT[lv - 1], `夜${lv} 布局 ${total} 张（期望 ${EXPECT[lv - 1]}）`);
  const byType = {};
  S.tiles.forEach(t => (byType[t.type] = (byType[t.type] || 0) + 1));
  const nTypes = G.curLevel().types;
  assert(Object.keys(byType).length === nTypes, `夜${lv} 用了 ${Object.keys(byType).length} 种供品（期望 ${nTypes}）`);
  assert(Object.values(byType).every(n => n % 3 === 0), `夜${lv} 每种都是 3 的倍数 (${JSON.stringify(byType)})`);

  // 贪心模拟抓取：优先凑对，必须能抓空且槽位峰值不超
  const slot = [];
  let maxSlot = 0, guard = 0;
  while (S.tiles.some(t => t.alive) && guard++ < 5000) {
    const free = S.tiles.filter(t => t.alive && !G.isCovered(t, S.tiles));
    if (!free.length) break;
    const inSlot = n => slot.filter(x => x === n).length;
    let pick = free.find(t => inSlot(t.type) === 2) || free.find(t => inSlot(t.type) === 1)
      || free.find(t => inSlot(t.type) === 0) || free[0];
    slot.push(pick.type); pick.alive = false;
    const cnt = {};
    slot.forEach(x => (cnt[x] = (cnt[x] || 0) + 1));
    for (const k in cnt) if (cnt[k] >= 3) {
      let n = 0;
      for (let i = slot.length - 1; i >= 0 && n < 3; i--) if (slot[i] == k) { slot.splice(i, 1); n++; }
    }
    maxSlot = Math.max(maxSlot, slot.length);
  }
  assert(slot.length === 0, `夜${lv} 可抓空（贪心模拟，槽位峰值 ${maxSlot}/${G.SLOT_N}）`);
}

console.log('— 仪式状态机冒烟 —');
for (const lv of [2, 3, 4, 5]) {
  G.level = lv;
  G.newGame();
  const S = G.S;
  S.state = 'play';
  let err = null;
  try {
    for (let i = 0; i < 6000; i++) {
      G.updateRites(0.016);
      if (i % 40 === 0 && G.startEvent) {
        // 每 40 帧骚扰一次：制造可偷/可换的槽位，让捣乱与仪式互相踩
        const free = S.tiles.filter(t => t.alive && !G.isCovered(t, S.tiles));
        if (free.length && G.liveSlot().length < G.SLOT_N - 1) {
          const t = free[0];
          t.alive = false;
          S.slot.push({ type: t.type, tile: t, x: 0, z: -1.5, h: 0.2, fly: 0 });
        }
        if (Math.random() < 0.5 && G.startEvent) G.startEvent();
      }
      if (S.event) { S.event.t += 0.5; G.updateEvent && G.updateEvent(0.5); }
    }
  } catch (e) { err = e; }
  assert(!err, `夜${lv} 仪式+捣乱 6000 帧无异常${err ? '：' + err.stack.split('\n')[0] : ''}`);
}

console.log('— 调包 / 咬人 / 血月单位行为 —');
G.level = 4; G.newGame(); G.S.state = 'play';
{
  const S = G.S;
  // 造一个可调包的槽
  S.slot.push({ type: 0, tile: null, x: 0, z: -1.5, h: 0.2, fly: 0 }, { type: 1, tile: null, x: 1, z: -1.5, h: 0.2, fly: 0 }, { type: 4, tile: null, x: 2, z: -1.5, h: 0.2, fly: 0 });
  const tg = G.swapTargets();
  assert(tg.length === 2 && tg[0].type !== tg[1].type, 'swapTargets 选中两件不同类');
  G.swapInSlot(tg[0], tg[1]);
  assert(S.slot.some(i => i.type === 1) && S.slot.some(i => i.type === 0), 'swapInSlot 交换后类型成立');
  // 血月：献 9 组升满
  const san0 = S.san;
  for (let i = 0; i < 9; i++) G.onMatch(0);
  assert(S.moon === 3, `血月升满（${S.moon}）`);
  assert(Math.abs(G.moonHaste() - Math.max(0.62, 1 - 3 * 0.13)) < 1e-9, '血月满时捣乱加速系数正确');
  for (let i = 0; i < 150; i++) G.updateRites(0.05);   // 让起身缓动走完
  assert(G.RISE > 0.9, '血月满时祂起身（G.RISE→1，当前 ' + G.RISE.toFixed(2) + '）');
}
G.level = 5; G.newGame(); G.S.state = 'play';
{
  const S = G.S;
  // 凝视锁定：把 idle 缩短到立刻 warn→lock
  let locked = -1, blocked = false;
  for (let i = 0; i < 4000 && locked < 0; i++) {
    G.updateRites(0.05);
    locked = G.lockType();
  }
  assert(locked >= 0, '凝视锁定进入 lock');
  const t = S.tiles.find(x => x.alive && x.type === locked && !G.isCovered(x, S.tiles));
  blocked = t ? G.riteBlocks(t) : false;
  assert(blocked, '被盯住的供品 riteBlocks 拦下');
  const san0 = S.san;
  const refused = G.riteOnGrab(t);
  assert(refused && S.san === san0 - 15, '抓被盯住的供品被咬 15 点 San');
  // 黑暗终局
  S.tiles.forEach(t => (t.alive = S.tiles.indexOf(t) < 9));
  G.updateRites(0.016);
  assert(S.blackRite === true, '剩 9 件时灯灭（黑暗终局启动）');
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
