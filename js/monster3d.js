// 3D 克苏鲁：three.js 建模 + 程序骨骼（触手中心线每帧重算），
// 用和游戏完全一致的相机，在低分辨率画布上关掉抗锯齿渲染，再贴回像素画面并加一像素描边。
// 没有 WebGL / 没有 THREE 时，monster.js 里的 2D 画法自动兜底。
(function () {
  const G = window.G, S = G.S, M = G.M;
  const M3 = (G.M3 = { ok: false, tried: false });
  const U = 1.6;                       // 一个「u」= 1.6 世界单位（与 2D 版 M.u 对应）
  const C = [0, 2.6, 10.6];            // 克苏鲁的锚点（游戏坐标）
  const TAU = Math.PI * 2;
  let T, renderer, scene, camera, glc, tmpc, tmpx, group, gm, stoneMat, lastW = 0, lastH = 0;
  const P = {};

  // 游戏坐标 (x 右, y 上, z 向远) → three 坐标 (z 朝向镜头)
  const g2t = (x, y, z) => new T.Vector3(x, y, -z);
  const t2s = v => G.proj(v.x, v.y, -v.z);
  const hash = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

  M3.init = function () {
    M3.tried = true;
    T = window.THREE;
    if (!T || typeof document === 'undefined') return;
    try {
      glc = document.createElement('canvas');
      renderer = new T.WebGLRenderer({ canvas: glc, antialias: false, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
    } catch (e) { console.warn('WebGL 不可用，使用 2D 克苏鲁', e); return; }
    tmpc = document.createElement('canvas'); tmpx = tmpc.getContext('2d', { willReadFrequently: true });
    scene = new T.Scene();
    camera = new T.PerspectiveCamera();
    camera.matrixAutoUpdate = true;
    build();
    M3.ok = true;
  };

  // —— 材质 ——
  function toon(opts) { return new T.MeshToonMaterial(Object.assign({ gradientMap: gm }, opts)); }

  function stoneTexture() {
    // 头颅贴图：裂纹、苔藓斑、颗粒（球面 UV，上方是头顶）
    const w = 160, h = 80, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    const r = G.mulberry(4242);
    for (let i = 0; i < 900; i++) { const v = r(); x.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.5)'; x.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1); }
    // 苔藓
    for (let k = 0; k < 26; k++) {
      const px = r() * w, py = 6 + r() * h * 0.55;
      for (let j = 0; j < 30; j++) { x.fillStyle = r() < 0.5 ? '#5f9a45' : '#477a35'; x.fillRect(Math.floor(px + (r() - 0.5) * 9), Math.floor(py + (r() - 0.5) * 6), 1, 1); }
    }
    // 裂纹：从头顶往下爬、分叉
    x.lineWidth = 1;
    for (let k = 0; k < 22; k++) {
      let px = r() * w, py = r() * 6;
      const pts = [[px, py]];
      for (let j = 0; j < 7; j++) { px += (r() - 0.5) * 9; py += 2 + r() * 4.5; pts.push([px, py]); }
      x.strokeStyle = '#141a18';
      x.beginPath(); pts.forEach(([a, b], j) => (j ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke();
      if (r() < 0.6) { const [a, b] = pts[2 + Math.floor(r() * 4)]; x.beginPath(); x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 12, b + 4 + r() * 5); x.stroke(); }
    }
    // 额头上的刻印
    x.strokeStyle = '#2a3a34';
    x.beginPath(); x.moveTo(w * 0.25, h * 0.4); x.lineTo(w * 0.25 + 3, h * 0.46); x.lineTo(w * 0.25, h * 0.52); x.lineTo(w * 0.25 - 3, h * 0.46); x.closePath(); x.stroke();
    const t = new T.CanvasTexture(c);
    t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false;
    return t;
  }

  // 椭球：带一点凹凸，像风化的石头
  function blob(rx, ry, rz, mat, lump, seg) {
    const geo = new T.SphereGeometry(1, seg || 24, Math.round((seg || 24) * 0.7));
    const p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + (lump || 0) * (Math.sin(v.x * 5.3 + v.y * 2.1) * Math.sin(v.y * 4.7 + v.z * 3.3) + 0.5 * Math.sin(v.z * 9.1 + v.x * 7.7));
      p.setXYZ(i, v.x * rx * n, v.y * ry * n, v.z * rz * n);
    }
    geo.computeVertexNormals();
    return new T.Mesh(geo, mat);
  }

  // —— 触手：固定拓扑的锥形管，每帧按中心线重算顶点 ——
  const SEG = 30, RAD = 9;
  function Tent(seed, col) {
    this.seed = seed; this.col = new T.Color(col || '#3a4c45');
    const n = (SEG + 1) * RAD;
    const geo = new T.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3); this.clr = new Float32Array(n * 3);
    geo.setAttribute('position', new T.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(this.nrm, 3));
    geo.setAttribute('color', new T.BufferAttribute(this.clr, 3));
    const idx = [];
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
      const a = i * RAD + j, b = i * RAD + ((j + 1) % RAD), c = a + RAD, d = b + RAD;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new T.Mesh(geo, stoneMat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  const _t = [], _n = [];
  Tent.prototype.update = function (ctrl, r0, r1, opt) {
    opt = opt || {};
    const curve = new T.CatmullRomCurve3(ctrl);
    let pts = curve.getSpacedPoints(SEG);
    const sq = opt.sq || 0;
    if (sq) { const b = pts[0]; pts = pts.map(p => p.clone().sub(b).multiplyScalar(1 - 0.3 * sq).add(b)); }
    // 不许钻进祭台
    for (const p of pts) if (p.y < 0.12 && -p.z < 9.3) p.y = 0.12;
    this.pts = pts;
    // 平行移动标架
    const Tn = new T.Vector3(), N = new T.Vector3(), B = new T.Vector3(), tmp = new T.Vector3();
    const sd = opt.suck, base = this.col, moss = P.moss, suckC = opt.suckColor || P.suck;
    let prevN = null;
    for (let i = 0; i <= SEG; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(SEG, i + 1)];
      Tn.subVectors(b, a).normalize();
      if (!prevN) { N.set(0, 1, 0); if (Math.abs(Tn.y) > 0.9) N.set(1, 0, 0); N.sub(tmp.copy(Tn).multiplyScalar(N.dot(Tn))).normalize(); }
      else { N.copy(prevN).sub(tmp.copy(Tn).multiplyScalar(prevN.dot(Tn))).normalize(); }
      prevN = N.clone();
      B.crossVectors(Tn, N);
      const t = i / SEG;
      const r = (r0 + (r1 - r0) * Math.pow(t, 0.85)) * (1 + 0.55 * sq) * (1 + 0.05 * Math.sin(i * 1.3 + this.seed));
      for (let j = 0; j < RAD; j++) {
        const ang = (j / RAD) * TAU;
        const nx = N.x * Math.cos(ang) + B.x * Math.sin(ang), ny = N.y * Math.cos(ang) + B.y * Math.sin(ang), nz = N.z * Math.cos(ang) + B.z * Math.sin(ang);
        const k = (i * RAD + j) * 3;
        this.pos[k] = pts[i].x + nx * r; this.pos[k + 1] = pts[i].y + ny * r; this.pos[k + 2] = pts[i].z + nz * r;
        this.nrm[k] = nx; this.nrm[k + 1] = ny; this.nrm[k + 2] = nz;
        const h = hash(i, j, this.seed);
        let cr = base.r, cg = base.g, cb = base.b, f = 0.78 + 0.4 * h;
        if (sd && t > 0.08 && i % 2 === 0 && nx * sd.x + ny * sd.y + nz * sd.z > 0.6) { cr = suckC.r; cg = suckC.g; cb = suckC.b; f = 1; }
        else if (h > 0.9 && ny > 0.15 && opt.moss !== false) { cr = moss.r; cg = moss.g; cb = moss.b; f = 1; }
        this.clr[k] = cr * f; this.clr[k + 1] = cg * f; this.clr[k + 2] = cb * f;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeBoundingSphere();
    return pts;
  };
  Tent.prototype.screen = function () { return this.pts.map(t2s).map(p => [p[0], p[1]]); };

  function build() {
    const d = new Uint8Array([28, 28, 28, 255, 85, 85, 85, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
    gm = new T.DataTexture(d, 4, 1); gm.minFilter = gm.magFilter = T.NearestFilter; gm.generateMipmaps = false; gm.needsUpdate = true;
    stoneMat = toon({ vertexColors: true });
    P.moss = new T.Color('#3e6e2f'); P.suck = new T.Color('#7a4a44'); P.red = new T.Color('#c0301f');
    const headMat = toon({ color: '#4e5c57', map: stoneTexture() });
    const faceMat = toon({ color: '#47564f' });
    const darkMat = new T.MeshBasicMaterial({ color: '#020605' });

    // 光：幽暗的青色环境光 + 头顶的冷月光 + 眼睛的绿光 + 供盘方向的一点暖光
    scene.add(new T.AmbientLight('#2c4a43', 0.32));
    const moon = new T.DirectionalLight('#b4e2d2', 1.05); moon.position.set(-7, 13, 3); scene.add(moon); scene.add(moon.target); moon.target.position.set(0, 0, -11);
    const rim = new T.DirectionalLight('#5fb8a0', 0.55); rim.position.set(3, 8, -30); scene.add(rim); scene.add(rim.target); rim.target.position.set(0, 2, -10);
    const warm = new T.PointLight('#d08a40', 0.6, 18, 1.2); warm.position.copy(g2t(0, 1.5, 4)); scene.add(warm);

    group = new T.Group();
    group.position.copy(g2t(C[0], C[1], C[2]));
    group.scale.setScalar(U);
    scene.add(group);

    // 头颅（高圆顶）+ 下颌
    P.head = blob(1.62, 1.55, 1.3, headMat, 0.035, 32); P.head.position.set(0, 1.35, -0.35); group.add(P.head);
    P.jaw = blob(1.35, 0.95, 1.0, faceMat, 0.04); P.jaw.position.set(0, -0.05, 0.2); group.add(P.jaw);
    // 鳍耳
    for (const sd of [-1, 1]) {
      const sh = new T.Shape();
      sh.moveTo(0, 0.9); sh.lineTo(sd * 1.05, 1.15); sh.lineTo(sd * 0.95, -0.15); sh.lineTo(sd * 0.55, -0.75); sh.lineTo(0, -0.4); sh.closePath();
      const fin = new T.Mesh(new T.ShapeGeometry(sh), toon({ color: '#1d2e29', side: T.DoubleSide }));
      fin.position.set(sd * 1.05, 0.15, -0.35); fin.rotation.y = -sd * 0.5; group.add(fin);
    }
    // 鼻梁、两颊、眉骨（怒相：外高内低）
    const nose = blob(0.24, 0.55, 0.3, faceMat, 0.05, 16); nose.position.set(0, -0.25, 1.0); group.add(nose);
    for (const sd of [-1, 1]) {
      const cheek = blob(0.5, 0.38, 0.4, faceMat, 0.05, 16); cheek.position.set(sd * 0.66, -0.42, 0.82); group.add(cheek);
      const brow = blob(0.72, 0.21, 0.42, headMat, 0.06, 18); brow.position.set(sd * 0.6, 0.32, 1.08); brow.rotation.z = sd * 0.45; brow.rotation.x = 0.25; group.add(brow);
      const sock = blob(0.36, 0.22, 0.12, darkMat, 0, 14); sock.position.set(sd * 0.6, 0.04, 1.12); group.add(sock);
    }
    // 眼：发光的绿球 + 跟随指针的亮核
    P.eyes = [];
    for (const sd of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.17, 14, 10), new T.MeshBasicMaterial({ color: '#2fe37a' }));
      eye.position.set(sd * 0.6, 0.04, 1.18); eye.scale.set(1.25, 0.72, 0.5); group.add(eye);
      const core = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), new T.MeshBasicMaterial({ color: '#e6fff0' }));
      group.add(core);
      const lt = new T.PointLight('#3cff8c', 0.6, 2.2, 2); lt.position.set(sd * 0.6, -0.1, 1.5); group.add(lt);
      P.eyes.push({ sd, eye, core, lt });
    }

    // 触手们
    P.face = []; for (let i = 0; i < 6; i++) P.face.push(new Tent(i * 3 + 1, i % 2 ? '#52665d' : '#45574f'));
    P.back = []; for (let i = 0; i < 6; i++) P.back.push(new Tent(20 + i, '#26352f'));
    P.loops = []; for (let i = 0; i < 4; i++) P.loops.push(new Tent(40 + i, '#34463f'));
    P.curls = []; for (let i = 0; i < 4; i++) P.curls.push(new Tent(50 + i, '#24332e'));
    P.arms = []; for (let i = 0; i < 2; i++) P.arms.push(new Tent(60 + i, '#384a43'));
  }

  // 局部坐标（u 单位，y 向上，z 朝镜头）→ three 世界坐标
  function L(x, y, z) { return new T.Vector3(x, y, z).applyMatrix4(group.matrixWorld); }
  function dirL(x, y, z) { return new T.Vector3(x, y, z).applyQuaternion(group.quaternion).normalize(); }

  function bez(a, c, b, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return out; }

  M3.render = function (ctx, time, dt, W, H) {
    if (W !== lastW || H !== lastH) { renderer.setSize(W, H, false); tmpc.width = W; tmpc.height = H; lastW = W; lastH = H; }
    // 相机：与 G.proj 完全一致
    const cam = G.cam;
    camera.position.set(0, cam.ch, -cam.cz);
    camera.rotation.set(-cam.pitch, 0, 0);
    camera.updateMatrixWorld();
    const n = 0.5, f = 120;
    camera.projectionMatrix.makePerspective(-cam.cx / cam.f * n, (W - cam.cx) / cam.f * n, cam.cy / cam.f * n, -(H - cam.cy) / cam.f * n, n, f);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // 整只克苏鲁朝向镜头（否则 57° 俯角下会被压扁）
    const bob = Math.sin(time * 0.6) * 0.05;
    group.rotation.set(-cam.pitch, 0, 0);
    group.position.copy(g2t(C[0], C[1] + bob * U * 0.5, C[2]));
    group.updateMatrixWorld(true);
    const san = S.san / 100;

    // 眼
    M.eyeSquint.t += dt;
    const squint = M.eyeSquint.t < 0.9 ? Math.sin(Math.min(1, M.eyeSquint.t / 0.9) * Math.PI) * 0.7 : 0;
    const open = G.clamp(M.intro * 1.2 - 0.6, 0, 1) * (1 - M.blinkAmt(time)) * (1 - squint);
    const ic = new T.Color(G.mixHex('#2fe37a', '#ff3a2a', Math.max(0, 0.6 - san) / 0.6));
    M.eyeScreen = [];
    const ptr = G.pointer;
    for (const e of P.eyes) {
      e.eye.scale.y = Math.max(0.04, 0.72 * open);
      e.eye.material.color.copy(ic);
      e.lt.color.copy(ic); e.lt.intensity = 0.6 * open;
      const es = t2s(L(e.sd * 0.6, 0.06, 1.1));
      let ox = 0, oy = 0;
      if (ptr) { const dx = ptr.x - es[0], dy = ptr.y - es[1], dd = Math.hypot(dx, dy) || 1, k = Math.min(1, dd / 60) * 0.1; ox = (dx / dd) * k; oy = -(dy / dd) * k * 0.6; }
      e.core.position.set(e.sd * 0.6 + ox, 0.04 + oy * open, 1.27);
      e.core.visible = open > 0.15;
      M.eyeScreen.push([es[0], es[1], open]);
    }

    // 面部触手：从口鼻下方垂下，中间收拢、末端外翻，落到祭台上就顺着台面铺开
    M.facePaths = [];
    const order = [0, 5, 1, 4, 2, 3];
    for (const i of order) {
      const sq = squashOf(M.faceSq[i], dt);
      const k = (i - 2.5) / 2.5, ak = Math.abs(k);
      const len = 2.4 + (1 - ak) * 1.4 + ((i * 37) % 5) * 0.08;
      const ctrl = [];
      for (let j = 0; j <= 7; j++) {
        const t = j / 7;
        const sway = Math.sin(time * 1.0 + i * 1.9 + t * 3.2) * 0.18 * t;
        const pinch = -k * 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.3));
        const flare = k * (0.9 + ak * 0.6) * Math.pow(t, 3);
        const curl = ak > 0.6 ? Math.pow(Math.max(0, t - 0.7) / 0.3, 2) * 0.6 : 0;
        ctrl.push(L(k * 0.95 + pinch + flare + sway, -0.5 - (1 - ak) * 0.12 - len * t + curl, 0.95 + 0.25 * t + Math.cos(time * 0.9 + i + t * 2) * 0.05));
      }
      const tt = P.face[i];
      tt.update(ctrl, (0.5 - ak * 0.1) * U, 0.07 * U, { sq, suck: dirL(k < 0 ? 1 : -1, -0.2, 0.5), suckColor: P.red });
      M.facePaths[i] = tt.screen();
    }

    // 身后的粗触手：左右各三条，波浪着伸出屏幕
    const halfW = (W / 2) / M.u;
    let bi = 0;
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
      const a = [sd * (0.9 + k * 0.25), -(0.3 + k * 0.5)];
      const e = [sd * (halfW + 2 + k * 0.6), 1.8 - k * 1.6];
      const c = [sd * (2.4 + k * 0.6), -[-2.6, 2.2, -0.4][k]];
      const pts = bez(a, c, e, 9).map(([x, y], j) => {
        const t = j / 9, ph = k * 1.7 + sd;
        return L(x + Math.sin(time * 0.7 + ph + t * 5) * 0.5 * t, y + Math.cos(time * 0.6 + ph + t * 4) * 0.5 * t - Math.sin(t * Math.PI * 3 + k + time * 0.4) * 0.45 * Math.sin(t * Math.PI), -0.9 - k * 0.3);
      });
      P.back[bi++].update(pts, (0.5 - k * 0.04) * U, (0.22 - k * 0.02) * U, { suck: dirL(0, -1, 0.3) });
    }
    // 两侧盘成大圈的触手
    let li = 0;
    for (const sd of [-1, 1]) for (const [sy, R0, turns, z] of [[-0.75, 1.25, 1.05, -0.3], [-1.35, 0.95, -0.85, 0.15]]) {
      const a0 = sd < 0 ? 0 : Math.PI, sx = sd * (sy < -1 ? 1.0 : 1.15);
      const cx = sx - Math.cos(a0) * R0, cy = sy;
      const pts = [];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12, ph = sd + li;
        const a = a0 - sd * t * turns * TAU + Math.sin(time * 0.6 + ph) * 0.12 * t;
        const r = R0 * (1 - 0.62 * t) * (1 + Math.sin(time * 0.8 + ph + t * 4) * 0.04);
        pts.push(L(cx + Math.cos(a) * r, cy - Math.sin(a) * r, z + t * 0.2));
      }
      P.loops[li++].update(pts, 0.42 * U, 0.09 * U, { suck: dirL(0, 0, 1) });
    }
    // 头顶后面卷起的细触手（问号形）
    let ci = 0;
    for (const sd of [-1, 1]) for (const [bx, by, h, r0] of [[1.15, 1.3, 1.9, 0.3], [1.7, 0.5, 1.3, 0.26]]) {
      const ph = sd * (ci + 1), sw = Math.sin(time * 0.9 + ph) * 0.15, pts = [];
      for (let j = 0; j <= 5; j++) { const k = j / 5; pts.push(L(sd * (bx + 0.35 * k) + sw * k * k, by + h * k, -0.7)); }
      const top = [sd * (bx + 0.35) + sw, by + h], rc = 0.38, a0 = sd > 0 ? Math.PI : 0;
      for (let j = 1; j <= 6; j++) { const k = j / 6, a = a0 + sd * k * Math.PI * 1.7, r = rc * (1 - k * 0.45); pts.push(L(top[0] + sd * rc + Math.cos(a) * r, top[1] - Math.sin(a) * r, -0.7)); }
      P.curls[ci++].update(pts, r0 * U, 0.05 * U, { moss: false });
    }
    // 两条最粗的手臂：沿着祭台两侧爬出屏幕（世界坐标）
    M.armPaths = [];
    [-1, 1].forEach((sd, k) => {
      const sq = squashOf(M.armSq[k], dt);
      const a = L(sd * 1.3, -1.1, 0.5);
      const mid = g2t(sd * 5.2, 0.45, 5.5);
      const ex = G.unproj(sd > 0 ? W + M.u * 1.5 : -M.u * 1.5, G.proj(0, 0, 1.2)[1], 0.4);
      const end = g2t(ex[0], 0.4, ex[1]);
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10;
        const p = t < 0.5 ? a.clone().lerp(mid, t * 2) : mid.clone().lerp(end, (t - 0.5) * 2);
        p.y += Math.sin(t * Math.PI) * 0.9 * U * (t < 0.5 ? 1 : 0.4) + Math.sin(time * 0.6 + sd + t * 5) * 0.15 * U * t;
        p.x += sd * Math.sin(t * Math.PI) * 0.6 * U;
        pts.push(p);
      }
      const tt = P.arms[k];
      tt.update(pts, 0.55 * U, 0.42 * U, { sq, suck: new T.Vector3(sd, -0.6, 0).normalize() });
      M.armPaths.push(tt.screen());
    });

    renderer.render(scene, camera);

    // 贴回像素画面：二值化透明度 + 一像素暗描边
    tmpx.clearRect(0, 0, W, H);
    tmpx.drawImage(glc, 0, 0);
    const img = tmpx.getImageData(0, 0, W, H), d = img.data;
    const A = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) A[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, q = i * 4;
      if (A[i]) { d[q + 3] = 255; continue; }
      if ((x > 0 && A[i - 1]) || (x < W - 1 && A[i + 1]) || (y > 0 && A[i - W]) || (y < H - 1 && A[i + W])) { d[q] = 3; d[q + 1] = 8; d[q + 2] = 7; d[q + 3] = 255; }
      else d[q + 3] = 0;
    }
    tmpx.putImageData(img, 0, 0);
    ctx.drawImage(tmpc, 0, 0);

    // 眼睛的辉光（2D 叠加）
    const hex = '#' + ic.getHexString();
    for (const [x, y, o] of M.eyeScreen) {
      if (o < 0.05) continue;
      const R = M.u * 0.2, fl = 0.85 + 0.15 * Math.sin(time * 7 + x);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 3);
      g.addColorStop(0, hex + Math.round(0x50 * o * fl).toString(16).padStart(2, '0')); g.addColorStop(1, hex + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 3, 0, TAU); ctx.fill();
    }
    M.drawDrips(ctx, dt);
  };

  function squashOf(o, dt) { const t = o.t; o.t += dt; return t > 1.2 ? 0 : Math.exp(-5 * t) * Math.sin(16 * t + 0.6) * 0.9; }
})();
