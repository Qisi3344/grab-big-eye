// 3D 克苏鲁：three.js 建模 + 程序骨骼（触手中心线每帧重算），
// 用和游戏完全一致的相机，在低分辨率画布上关掉抗锯齿渲染，再贴回像素画面并加一像素描边。
// 没有 WebGL / 没有 THREE 时，monster.js 里的 2D 画法自动兜底。
(function () {
  const G = window.G, S = G.S, M = G.M;
  const M3 = (G.M3 = { ok: false, tried: false, fog: 1 });
  const U = 1.6;                       // 一个「u」= 1.6 世界单位（与 2D 版 M.u 对应）
  const C = [0, 2.6, 10.6];            // 克苏鲁的锚点（游戏坐标）
  const TAU = Math.PI * 2;
  let T, renderer, scene, camera, glc, tmpc, tmpx, idc, idx2, hideMat, group, gm, stoneMat, lastW = 0, lastH = 0;
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
    idc = document.createElement('canvas'); idx2 = idc.getContext('2d', { willReadFrequently: true });
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
    tagId(this.mesh);
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

  // 每个部件一个编号色，用来画部件之间的内描边
  let nextId = 1;
  function tagId(mesh, id) {
    id = id || nextId++;
    mesh.userData.idMat = new T.MeshBasicMaterial({ color: new T.Color(((id * 3) % 8) * 32 / 255 + 16 / 255, ((id * 5 + 2) % 8) * 32 / 255 + 16 / 255, (Math.floor(id / 8) % 8) * 32 / 255 + 16 / 255), side: T.DoubleSide });
    mesh.userData.id = id;
    return id;
  }
  function build() {
    const d = new Uint8Array([28, 28, 28, 255, 85, 85, 85, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
    gm = new T.DataTexture(d, 4, 1); gm.minFilter = gm.magFilter = T.NearestFilter; gm.generateMipmaps = false; gm.needsUpdate = true;
    stoneMat = toon({ vertexColors: true });
    hideMat = new T.MeshBasicMaterial({ color: 0x000000 });
    P.moss = new T.Color('#3e6e2f'); P.suck = new T.Color('#7a4a44'); P.red = new T.Color('#c0301f');
    const headMat = toon({ color: '#47554f', map: stoneTexture() });
    const faceMat = toon({ color: '#3d4d47' });
    const darkFace = toon({ color: '#1c2824' });
    const darkMat = new T.MeshBasicMaterial({ color: '#020605' });

    // 光：幽暗的青色环境光 + 头顶的冷月光 + 眼睛的绿光 + 供盘方向的一点暖光
    scene.add(new T.AmbientLight('#2c4a43', 0.32));
    const moon = new T.DirectionalLight('#b4e2d2', 1.05); moon.position.set(-5, 15, -1); scene.add(moon); scene.add(moon.target); moon.target.position.set(0, 0, -11);
    const rim = new T.DirectionalLight('#5fb8a0', 0.55); rim.position.set(3, 8, -30); scene.add(rim); scene.add(rim.target); rim.target.position.set(0, 2, -10);
    const warm = new T.PointLight('#d08a40', 0.6, 18, 1.2); warm.position.copy(g2t(0, 1.5, 4)); scene.add(warm);

    group = new T.Group();
    group.position.copy(g2t(C[0], C[1], C[2]));
    group.scale.setScalar(U);
    scene.add(group);

    // 头颅（高圆顶）+ 下颌
    P.head = blob(1.62, 1.55, 1.3, headMat, 0.035, 32); P.head.position.set(0, 1.35, -0.35); group.add(P.head);
    const FACE = tagId(P.head), BROW = nextId++, CHEEK = nextId++;
    // 下半张脸是暗的肉，几乎全被面须盖住
    P.jaw = blob(1.2, 0.8, 0.9, darkFace, 0.05); P.jaw.position.set(0, -0.35, 0.15); group.add(P.jaw); tagId(P.jaw);
    // 鳍耳
    for (const sd of [-1, 1]) {
      const sh = new T.Shape();
      sh.moveTo(0, 0.9); sh.lineTo(sd * 1.05, 1.15); sh.lineTo(sd * 0.95, -0.15); sh.lineTo(sd * 0.55, -0.75); sh.lineTo(0, -0.4); sh.closePath();
      const fin = new T.Mesh(new T.ShapeGeometry(sh), toon({ color: '#16241f', side: T.DoubleSide }));
      fin.position.set(sd * 1.05, 0.15, -0.35); fin.rotation.y = -sd * 0.5; group.add(fin); tagId(fin);
    }
    // 面部：V 字眉骨在鼻根处汇合压低，鼻梁一路下来，颧骨突出
    const nose = blob(0.16, 0.5, 0.22, faceMat, 0.05, 16); nose.position.set(0, -0.12, 1.08); group.add(nose); tagId(nose, FACE);
    const glab = blob(0.2, 0.2, 0.25, headMat, 0.04, 14); glab.position.set(0, 0.2, 1.12); group.add(glab); tagId(glab, BROW);
    for (const sd of [-1, 1]) {
      const cheek = blob(0.42, 0.28, 0.36, faceMat, 0.05, 16); cheek.position.set(sd * 0.72, -0.28, 0.86); cheek.rotation.z = -sd * 0.3; group.add(cheek); tagId(cheek, CHEEK);
      const brow = blob(0.66, 0.16, 0.36, headMat, 0.07, 18); brow.position.set(sd * 0.5, 0.36, 1.12); brow.rotation.z = sd * 0.5; brow.rotation.y = -sd * 0.25; group.add(brow); tagId(brow, BROW);
      const sock = blob(0.3, 0.13, 0.1, darkMat, 0, 14); sock.position.set(sd * 0.55, 0.12, 1.12); sock.rotation.z = sd * 0.42; group.add(sock);
    }
    // 眼：斜着眯起的绿光细眼 + 跟随指针的亮核
    P.eyes = [];
    for (const sd of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), new T.MeshBasicMaterial({ color: '#2fe37a' }));
      eye.position.set(sd * 0.55, 0.12, 1.17); eye.rotation.z = sd * 0.42; eye.scale.set(1.35, 0.42, 0.5); group.add(eye);
      const core = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), new T.MeshBasicMaterial({ color: '#e6fff0' }));
      group.add(core);
      const lt = new T.PointLight('#3cff8c', 0.9, 1.6, 2); lt.position.set(sd * 0.55, 0.0, 1.45); group.add(lt);
      P.eyes.push({ sd, eye, core, lt, base: new T.Vector3(sd * 0.55, 0.12, 1.17), es: 1 });
    }

    // 触手们
    P.face = []; for (let i = 0; i < 6; i++) P.face.push(new Tent(i * 3 + 1, i % 2 ? '#4a6158' : '#3e544b'));
    P.back = []; for (let i = 0; i < 6; i++) P.back.push(new Tent(20 + i, '#26352f'));
    P.loops = []; for (let i = 0; i < 4; i++) P.loops.push(new Tent(40 + i, '#34463f'));
    P.curls = []; for (let i = 0; i < 4; i++) P.curls.push(new Tent(50 + i, '#24332e'));
    P.arms = []; for (let i = 0; i < 2; i++) P.arms.push(new Tent(60 + i, '#384a43'));
    // 手捏的头和小触手先记下来：外部模型载入后就藏起来
    P.proc = group.children.filter(o => o.isMesh && !P.eyes.some(e => e.eye === o || e.core === o));
    P.procTents = [...P.face, ...P.back, ...P.loops, ...P.curls];
    loadModel();
  }

  // —— 外部模型（Tripo 生成的半身克苏鲁，assets/cthulhu.glb）——
  // 自己解析 GLB（单网格 + 一张底色贴图），省掉 GLTFLoader
  const MODEL_TILT = 0.4, MS = 17, MODEL_HEAD = [0, 0.44, 0.3], MODEL_EYE = [0.022, 0.352, 0.462], ANCHOR = [0.03, 0.40, 0.425];
  function mpos(x, y, z) { return new T.Vector3(x, y, z).multiplyScalar(MS).add(P.model.position).applyEuler(P.pivot.rotation).add(P.pivot.position); }
  async function loadModel() {
    if (typeof fetch === 'undefined' || /[?&]proc\b/.test(location.search)) return;
    // 载入期间先藏起手捏的头，免得闪一下旧脸
    // 手机上旧版会露出手捏的光头 + 程序手臂（她 2026-10-22 截图）：载入期间整只藏起来，只留黑雾里的眼光
    for (const t of P.procTents) t.mesh.visible = false;
    for (const o of P.proc) o.visible = false;
    for (const t of P.arms) t.mesh.visible = false;
    M3.loading = true; M3.progress = 0;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const killer = setTimeout(() => { M3.timedOut = true; if (ctl) ctl.abort(); }, 45000);
    try {
      const res = await fetch(window.GBE_MODEL_URL || 'assets/cthulhu.glb', ctl ? { signal: ctl.signal } : undefined);
      if (!res.ok) throw new Error('下载失败 ' + res.status);
      let buf;
      const total = +res.headers.get('content-length') || 0;
      if (res.body && res.body.getReader && total) {
        const rd = res.body.getReader(), all = new Uint8Array(total); let got = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; if (got + value.length > all.length) throw new Error('长度不符'); all.set(value, got); got += value.length; M3.progress = got / total; }
        buf = all.buffer.slice(0, got);
      } else buf = await res.arrayBuffer();
      M3.progress = 1;
      const dv = new DataView(buf);
      const jl = dv.getUint32(12, true);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
      const binOff = 20 + jl + 8;
      const view = i => { const bv = json.bufferViews[i]; return [binOff + (bv.byteOffset || 0), bv.byteLength]; };
      const acc = i => {   // 支持交错存储（byteStride）
        const a = json.accessors[i], bv = json.bufferViews[a.bufferView], k = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
        const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType], B = C.BYTES_PER_ELEMENT;
        const off = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || k * B;
        if (stride === k * B) return new C(buf.slice(off, off + a.count * k * B));
        const out = new C(a.count * k), src = new DataView(buf);
        const get = { 5126: 'getFloat32', 5125: 'getUint32', 5123: 'getUint16', 5121: 'getUint8' }[a.componentType];
        for (let n = 0; n < a.count; n++) for (let c = 0; c < k; c++) out[n * k + c] = src[get](off + n * stride + c * B, true);
        return out;
      };
      const pr = json.meshes[0].primitives[0];
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(acc(pr.attributes.POSITION), 3));
      if (pr.attributes.NORMAL != null) geo.setAttribute('normal', new T.BufferAttribute(acc(pr.attributes.NORMAL), 3)); else geo.computeVertexNormals();
      geo.setAttribute('uv', new T.BufferAttribute(acc(pr.attributes.TEXCOORD_0), 2));
      geo.setIndex(new T.BufferAttribute(acc(pr.indices), 1));
      const im = json.images[0], [io, il] = view(im.bufferView);
      const blob = new Blob([new Uint8Array(buf, io, il)], { type: im.mimeType });
      // 老 Safari 的 createImageBitmap 不稳，退回 <img> 解码
      const bmp = await new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(blob); img.onload = () => res(img); img.onerror = () => rej(new Error('贴图解码失败')); img.src = u; });
      const tex = new T.Texture(bmp); tex.flipY = false; tex.needsUpdate = true;
      const mat = toon({ map: tex, color: '#a9c4b8' });
      mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = P.uTime; sh.uniforms.uPoke = P.uPoke; sh.uniforms.uArm = P.uArm; sh.uniforms.uBrow = P.uBrow;
        sh.vertexShader = 'uniform float uTime; uniform float uPoke; uniform vec2 uArm; uniform float uBrow;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
          vec3 transformed = vec3(position);
          float ax = abs(position.x), sx = position.x < 0.0 ? -1.0 : 1.0;
          // 头部保持 Tripo 原模型的形状，不做变形
          // 表情：眉骨（眼睛上方、鼻根两侧）压低成 V 字是怒，抬起是得意；越靠中间动得越多
          float brw = (1.0 - smoothstep(0.03, 0.075, ax)) * smoothstep(0.355, 0.37, position.y) * (1.0 - smoothstep(0.39, 0.415, position.y)) * smoothstep(0.40, 0.44, position.z);
          transformed.y -= uBrow * brw * (1.0 - ax / 0.075) * 0.03;
          transformed.z += max(uBrow, 0.0) * brw * 0.01;
          // 蝠翼：绕肩慢慢开合
          float ww = smoothstep(0.08, 0.22, ax) * smoothstep(0.24, 0.36, position.y) * (1.0 - smoothstep(0.12, 0.3, position.z));
          float ang = ww * (sin(uTime * 0.8) * 0.10 + 0.02) * sx;
          vec2 piv = vec2(sx * 0.08, 0.33), r = transformed.xy - piv;
          transformed.xy = piv + vec2(cos(ang) * r.x - sin(ang) * r.y, sin(ang) * r.x + cos(ang) * r.y);
          transformed.z -= ww * sin(uTime * 0.8 + 0.6) * 0.02 * (ax - 0.08) * 6.0;
          // 面须：越往下晃得越厉害，被戳时乱颤
          float bw = (1.0 - smoothstep(0.34, 0.38, position.y)) * smoothstep(0.24, 0.32, position.z) * (1.0 - smoothstep(0.1, 0.16, ax));
          float dep = clamp((0.37 - position.y) / 0.22, 0.0, 1.0);
          transformed.x += bw * dep * (sin(uTime * 1.3 + position.y * 40.0 + position.x * 30.0) * 0.007 + uPoke * sin(uTime * 15.0 + position.y * 60.0) * 0.012);
          transformed.z += bw * dep * cos(uTime * 1.1 + position.y * 30.0 + position.x * 20.0) * 0.006;
          // 模型自带的两侧触手：慢慢游动，越往外摆得越大；戳中哪边哪边乱颤
          float sw = smoothstep(0.12, 0.2, ax) * (1.0 - smoothstep(0.30, 0.36, position.y)) * smoothstep(0.2, 0.3, position.z);
          float rr = clamp((ax - 0.12) / 0.3, 0.0, 1.0);
          float pk = sx < 0.0 ? uArm.x : uArm.y;
          transformed.y += sw * rr * (sin(uTime * 0.7 + ax * 18.0 + sx) * 0.012 + pk * sin(uTime * 14.0 + ax * 50.0) * 0.012);
          transformed.z += sw * rr * cos(uTime * 0.6 + ax * 14.0) * 0.008;`);
      };
      P.uTime = { value: 0 }; P.uPoke = { value: 0 }; P.uArm = { value: new T.Vector2() }; P.uBrow = { value: 0 }; P.mood = { a: 0, s: 0, w: 0, h: 0 };
      // 编号通道里模型改写深度（r/g 两字节，b=255 作记号），描边时按深度跳变找出触手之间的轮廓
      const dmat = new T.MeshBasicMaterial();
      dmat.onBeforeCompile = sh => {
        mat.onBeforeCompile(sh);
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vDep;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n vDep = -mvPosition.z;');
        sh.fragmentShader = 'varying float vDep;\n' + sh.fragmentShader.replace(/}\s*$/, ' float dq = clamp(vDep / 100.0, 0.0, 1.0) * 255.0; gl_FragColor = vec4(floor(dq) / 255.0, fract(dq), 1.0, 1.0);\n}');
      };
      const DBG = window.GBE_DBG || '';
      const m = new T.Mesh(geo, mat);
      m.frustumCulled = false;
      m.scale.setScalar(MS);
      m.position.set(-ANCHOR[0] * 0, -ANCHOR[1] * MS, -ANCHOR[2] * MS);
      // 绕眼睛所在的点前倾：相机在克苏鲁下方偏前，不前倾的话圆颅顶会被眉骨挡住，看着像扁头
      const pivot = new T.Group(); pivot.position.set(0, 0.12, 1.17);
      const tm = /tilt(-?[\d.]+)/.exec(DBG); pivot.rotation.x = tm ? +tm[1] : MODEL_TILT;
      pivot.add(m); P.pivot = pivot;
      tagId(m); m.userData.idMat = dmat;
      if (DBG === 'basic') m.material = new T.MeshBasicMaterial({ map: tex });
      P.model = m; if (DBG !== 'noadd') group.add(pivot);
      // 头就用 Tripo 模型自带的（她 2026-10-22 明确：不许改模型的头）；?prochead 才换回手捏石颅
      const tripoHead = !/[?&]prochead\b/.test(location.search);
      for (const o of P.proc) o.visible = !tripoHead;
      for (const t of P.procTents) t.mesh.visible = false;
      // 两侧程序做的大手臂和模型画风对不上，有模型时藏起来，用模型自带的触手（她 2026-10-22）
      for (const t of P.arms) t.mesh.visible = false;
      if (tripoHead) for (const e of P.eyes) { e.base.copy(mpos(e.sd * MODEL_EYE[0], MODEL_EYE[1], MODEL_EYE[2])); e.es = 0.45; e.eye.rotation.z = e.sd * 0.35; }
      M3.fog = /nofog/.test(DBG) ? 0 : 0.3;
      if (/noeyes/.test(DBG)) for (const e of P.eyes) { e.eye.visible = false; e.core.visible = false; }
      clearTimeout(killer);
      M3.model = true;
      M3.loading = false;
    } catch (e) {
      console.warn('克苏鲁模型载入失败，用手捏版', e);
      clearTimeout(killer);
      M3.loading = false; M3.modelErr = M3.timedOut ? '网络太慢，超时了' : String(e && e.message || e).slice(0, 60);
      for (const t of P.arms) t.mesh.visible = true;
      if (P.pivot) group.remove(P.pivot); P.model = null;
      for (const o of P.proc) o.visible = true;
      for (const t of P.procTents) t.mesh.visible = true;
    }
  }

  // 局部坐标（u 单位，y 向上，z 朝镜头）→ three 世界坐标
  function L(x, y, z) { return new T.Vector3(x, y, z).applyMatrix4(group.matrixWorld); }
  function dirL(x, y, z) { return new T.Vector3(x, y, z).applyQuaternion(group.quaternion).normalize(); }

  function bez(a, c, b, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return out; }

  M3.render = function (ctx, time, dt, W, H) {
    if (W !== lastW || H !== lastH) { renderer.setSize(W, H, false); tmpc.width = idc.width = W; tmpc.height = idc.height = H; lastW = W; lastH = H; }
    // 相机：与 G.proj 完全一致
    const cam = G.cam;
    camera.position.set(0, cam.ch, -cam.cz);
    camera.rotation.set(-cam.pitch, 0, 0);
    camera.updateMatrixWorld();
    const n = 0.5, f = 120;
    camera.projectionMatrix.makePerspective(-cam.cx / cam.f * n, (W - cam.cx) / cam.f * n, cam.cy / cam.f * n, -(H - cam.cy) / cam.f * n, n, f);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // 整只克苏鲁朝向镜头（否则 57° 俯角下会被压扁）；凝视/黑暗终局推近（G.MON_Z），血月满时起身（G.RISE）
    const bob = Math.sin(time * 0.6) * 0.05;
    const rise = G.RISE || 0;
    group.rotation.set(-cam.pitch, 0, 0);
    group.position.copy(g2t(C[0], C[1] + bob * U * 0.5 + rise * 1.6, G.MON_Z || C[2]));
    group.scale.setScalar(1 + rise * 0.1);
    group.updateMatrixWorld(true);
    const san = S.san / 100;

    // 眼
    M.eyeSquint.t += dt;
    const squint = M.eyeSquint.t < 0.9 ? Math.sin(Math.min(1, M.eyeSquint.t / 0.9) * Math.PI) * 0.7 : 0;
    // 表情：各成分平滑过渡。San 低时基础就带点怒
    const md = M.mood || { kind: '', t: 9, dur: 0 }; md.t += dt;
    const fm = /mood(\w+)/.exec(window.GBE_DBG || ''), on = k => (fm ? (fm[1] === k ? 1 : 0) : (md.kind === k && md.t < md.dur ? 1 : 0));
    const live = G.liveSlot ? G.liveSlot().length : 0;
    const PM = P.mood || (P.mood = { a: 0, s: 0, w: 0, h: 0 }), ease = (v, tg, sp) => v + (tg - v) * Math.min(1, dt * sp);
    PM.a = ease(PM.a, Math.max(on('angry'), Math.max(0, 0.5 - san) * 1.2), 6);
    PM.s = ease(PM.s, on('smug'), 4);
    PM.w = ease(PM.w, fm ? on('stare') : S.state === 'play' && live >= 5 && PM.s < 0.3 ? 1 : 0, 3);
    PM.h = ease(PM.h, on('hurt'), 14);
    M.moodNow = PM;
    if (P.uBrow) P.uBrow.value = PM.a - PM.s * 0.7 - PM.w * 0.3;
    const lid = 1 - PM.a * 0.4 - PM.s * 0.6 - PM.h * 0.85 + PM.w * 0.9;
    const open = G.clamp(M.intro * 1.2 - 0.6, 0, 1) * (1 - M.blinkAmt(time)) * (1 - squint) * Math.max(0.05, lid);
    const ic = new T.Color(G.mixHex(G.mixHex('#2fe37a', '#ff3a2a', Math.max(0, 0.6 - san) / 0.6), '#ff3020', PM.a * 0.8));
    if (PM.w > 0.01) ic.lerp(new T.Color('#c8ffd8'), PM.w * 0.35);
    M.eyeScreen = [];
    const ptr = G.pointer;
    for (const e of P.eyes) {
      e.eye.position.copy(e.base); e.eye.scale.set(1.35 * e.es * (1 + PM.w * 0.1 + PM.a * 0.15), Math.max(0.04, 0.42 * open) * e.es, 0.5 * e.es);
      e.eye.rotation.z = e.sd * (P.model ? 0.35 : 0.42) + e.sd * (PM.a * 0.45 - PM.s * 0.4);
      if (PM.s > 0.05) e.eye.position.y += PM.s * 0.03 * e.es;
      e.eye.material.color.copy(ic);
      e.lt.color.copy(ic); e.lt.intensity = 0.9 * open;
      const es = t2s(L(e.base.x, e.base.y, e.base.z));
      let ox = 0, oy = 0;
      if (ptr) { const dx = ptr.x - es[0], dy = ptr.y - es[1], dd = Math.hypot(dx, dy) || 1, k = Math.min(1, dd / 60) * 0.08; ox = (dx / dd) * k; oy = -(dy / dd) * k * 0.3; }
      e.core.position.set(e.base.x + ox * e.es, e.base.y + oy * open * e.es, e.base.z + 0.07 * e.es); e.core.scale.setScalar(e.es * (1 - PM.w * 0.4));
      e.lt.position.set(e.base.x, e.base.y - 0.12 * e.es, e.base.z + 0.28 * e.es);
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
        ctrl.push(L(k * 0.78 + pinch + flare + sway, -0.28 - (1 - ak) * 0.1 - ak * 0.12 - len * t + curl, 1.0 + 0.3 * t - ak * 0.12 + Math.cos(time * 0.9 + i + t * 2) * 0.05));
      }
      const tt = P.face[i];
      tt.update(ctrl, (0.4 - ak * 0.06) * U, 0.07 * U, { sq, suck: dirL(k < 0 ? 1 : -1, -0.2, 0.5), suckColor: P.red });
      M.facePaths[i] = tt.screen();
    }

    if (P.model) {
      // 模型的面须：用 6 条竖线当点击区域，戳中时整把面须乱颤
      let pk = 0;
      for (let i = 0; i < 6; i++) {
        const mx = [-0.06, -0.035, -0.012, 0.012, 0.035, 0.06][i], pts = [];
        for (let j = 0; j <= 5; j++) { const y = 0.37 - j * 0.045; const v = mpos(mx, y, 0.43 - j * 0.01); pts.push(t2s(L(v.x, v.y, v.z))); }
        M.facePaths[i] = pts.map(p => [p[0], p[1]]);
        pk = Math.max(pk, Math.max(0, 1.2 - M.faceSq[i].t) / 1.2);
      }
      P.uPoke.value = Math.max(pk, PM.a * 0.45 + PM.h * 0.8); P.uTime.value = time;
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
    if (P.model) {
      // 模型两侧触手的点击区域：沿着触手从脸侧往外的折线
      [-1, 1].forEach((sd, k) => {
        const sq = Math.max(0, 1.2 - M.armSq[k].t) / 1.2; M.armSq[k].t += dt;
        P.uArm.value.setComponent(k, sq);
        const pts = [];
        for (let j = 0; j <= 6; j++) { const t = j / 6; const v = mpos(sd * (0.13 + t * 0.27), 0.3 - t * 0.12 - Math.sin(t * Math.PI) * 0.02, 0.4 - t * 0.08); pts.push(t2s(L(v.x, v.y, v.z))); }
        M.armPaths.push(pts.map(p => [p[0], p[1]]));
      });
    } else [-1, 1].forEach((sd, k) => {
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
    // 编号色再渲染一遍：相邻像素属于不同部件时压暗，得到像素画式的内描边
    const swap = [];
    scene.traverse(o => { if (o.isMesh) { swap.push([o, o.material]); o.material = o.userData.idMat || hideMat; } });
    renderer.render(scene, camera);
    for (const [o, m] of swap) o.material = m;
    idx2.clearRect(0, 0, W, H); idx2.drawImage(glc, 0, 0);
    const id = idx2.getImageData(0, 0, W, H).data;
    // WebGL 有抖动，编号色按 32 一档取整
    const dep = i => id[i * 4] * 255 + id[i * 4 + 1];
    const DT = 0.5 / 100 * 65025;
    const key = i => { if (id[i * 4 + 3] < 100) return -1; if (id[i * 4 + 2] > 247) return 99999; const r = id[i * 4] >> 5, g = id[i * 4 + 1] >> 5, b = id[i * 4 + 2] >> 5; return (r | g | b) ? (r << 6) | (g << 3) | b : -1; };
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x; if (!A[i]) continue;
      const a = key(i); if (a < 0) continue;
      const r = key(i + 1), b = key(i + W);
      let edge = (r >= 0 && r !== a) || (b >= 0 && b !== a);
      if (!edge && a === 99999) { const d0 = dep(i); edge = (r === a && Math.abs(dep(i + 1) - d0) > DT) || (b === a && Math.abs(dep(i + W) - d0) > DT); }
      if (edge) { const q = i * 4; d[q] = d[q] * 0.3 + 2; d[q + 1] = d[q + 1] * 0.3 + 6; d[q + 2] = d[q + 2] * 0.3 + 5; }
    }
    // 黑雾：脸藏在会飘动的阴影里（拜耳抖动成像素点），只留眼睛的光
    const fc = t2s(L(0, 0.0, 1.0)), uu = M.u;
    const blobs = [[fc[0], fc[1] + uu * 0.3, uu * 2.1, uu * 2.3, 1.35], [fc[0], fc[1] - uu * 1.4, uu * 1.9, uu * 1.4, 0.55]];
    for (let k = 0; k < 6; k++) {
      const ph = k * 1.9;
      blobs.push([fc[0] + Math.sin(time * 0.23 + ph) * uu * 1.6, fc[1] + uu * (0.4 + Math.cos(time * 0.17 + ph * 1.3) * 0.9), uu * (0.9 + 0.3 * Math.sin(ph)), uu * 0.8, 0.45]);
    }
    const BY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const x0 = Math.max(0, Math.floor(fc[0] - uu * 3.4)), x1 = Math.min(W, Math.ceil(fc[0] + uu * 3.4));
    const y0 = Math.max(0, Math.floor(fc[1] - uu * 2.8)), y1 = Math.min(H, Math.ceil(fc[1] + uu * 3.2));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x; if (!A[i]) continue;
      const q = i * 4;
      let f = 0;
      for (const [bx, by, rx, ry, a] of blobs) { const dx = (x - bx) / rx, dy = (y - by) / ry, r2 = dx * dx + dy * dy; if (r2 < 1) f += a * (1 - r2) * (1 - r2); }
      // 眼睛周围雾渐薄，眼光透出来
      for (const [ex, ey] of M.eyeScreen) { const dx = (x - ex) / (uu * 0.3), dy = (y - ey) / (uu * 0.15), r = Math.sqrt(dx * dx + dy * dy); if (r < 1.6) f *= Math.max(0, (r - 0.6) / 1.0); }
      f = Math.min(1, f) * M3.fog * (1 + (M.moodNow ? M.moodNow.w * 0.7 : 0));
      const lv = Math.min(4, Math.floor(f * 4 + BY[(y & 3) * 4 + (x & 3)] / 16)) / 4;
      if (lv > 0) { const m = 1 - 0.92 * lv; d[q] = d[q] * m + 1 * lv; d[q + 1] = d[q + 1] * m + 4 * lv; d[q + 2] = d[q + 2] * m + 4 * lv; }
    }
    tmpx.putImageData(img, 0, 0);
    ctx.drawImage(tmpc, 0, 0);
    if (M3.modelErr) { ctx.save(); ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,120,110,0.8)'; ctx.fillText('模型载入失败：' + M3.modelErr, 6, H - 6); ctx.restore(); }

    // 眼睛的辉光（2D 叠加）
    const hex = '#' + ic.getHexString();
    for (const [x, y, o] of M.eyeScreen) {
      if (o < 0.05) continue;
      const R = M.u * 0.2 * (1 + (M.moodNow ? M.moodNow.w * 0.6 + M.moodNow.a * 0.3 : 0)), fl = 0.85 + 0.15 * Math.sin(time * 7 + x);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 3);
      g.addColorStop(0, hex + Math.round(0x50 * o * fl).toString(16).padStart(2, '0')); g.addColorStop(1, hex + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 3, 0, TAU); ctx.fill();
    }
    M.drawDrips(ctx, dt);
  };

  function squashOf(o, dt) { const t = o.t; o.t += dt; return t > 1.2 ? 0 : Math.exp(-5 * t) * Math.sin(16 * t + 0.6) * 0.9; }
})();
