// 桌面透视机位：玩家坐在桌前，从前上方看向桌子深处。
// 世界坐标：x 向右，y 向上（桌面 y=0），z 向远处。
(function () {
  const G = window.G;
  const cam = (G.cam = { pitch: 1.0, ch: 9.6, cz: -6.4, f: 100, cx: 0, cy: 0, sp: 0, cp: 0 });

  G.proj = function (x, y, z) {
    const Y = y - cam.ch, Z = z - cam.cz;
    const zc = -Y * cam.sp + Z * cam.cp;
    const yc = Y * cam.cp + Z * cam.sp;
    const s = cam.f / zc;
    return [cam.cx + x * s, cam.cy - yc * s, s];
  };

  // 屏幕点 → 高度 h 平面上的世界点
  G.unproj = function (sx, sy, h) {
    const dx = (sx - cam.cx) / cam.f, dy = -(sy - cam.cy) / cam.f;
    const wy = dy * cam.cp - cam.sp;
    const wz = dy * cam.sp + cam.cp;
    const t = (h - cam.ch) / (wy || -1e-6);
    return [t * dx, cam.cz + t * wz];
  };

  // 让「槽位轨近边 ~ 怪物头顶」正好装进画面
  G.fitCamera = function (W, H) {
    cam.sp = Math.sin(cam.pitch); cam.cp = Math.cos(cam.pitch);
    cam.cx = W / 2; cam.cy = 0; cam.f = 100;
    // 宽度：近边槽位轨占列宽的 94%（槽位格数随祭夜变化）
    const colW = Math.min(W, H * 0.78);
    const railHW = (G.RAIL_HW || 4.0) + 0.35;
    let a = G.proj(-railHW, 0, -2.3), b = G.proj(railHW, 0, -2.3);
    cam.f *= (colW * 0.94) / (b[0] - a[0]);
    // 高度：近边到克苏鲁头顶
    let top = G.proj(0, 7.0, 10.6)[1], bot = G.proj(0, 0, -2.35)[1];
    const span = bot - top, avail = H * 0.985;
    if (span > avail) cam.f *= avail / span;
    top = G.proj(0, 7.0, 10.6)[1]; bot = G.proj(0, 0, -2.35)[1];
    cam.cy = H - 3 - bot;
  };
})();
