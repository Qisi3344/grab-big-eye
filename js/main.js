// 入口：画布缩放（低分辨率渲染再放大 = 真像素）、输入、界面按钮、主循环。
(function () {
  const G = window.G, S = G.S;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    san: document.getElementById('sanFill'), sanNum: document.getElementById('sanNum'),
    left: document.getElementById('left'), shuffle: document.getElementById('btnShuffle'),
    toast: document.getElementById('toast'), end: document.getElementById('end'),
    endTitle: document.getElementById('endTitle'), endText: document.getElementById('endText'),
    stage: document.getElementById('stage'),
  };
  let W = 0, H = 0, scale = 1, hover = null;
  G.pointer = null;

  function resize() {
    const r = ui.stage.getBoundingClientRect();
    const target = 440;
    scale = r.height / target;
    if (r.width / scale < 260) scale = r.width / 260;
    W = Math.max(200, Math.floor(r.width / scale));
    H = Math.max(200, Math.floor(r.height / scale));
    canvas.width = W; canvas.height = H;
    canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px';
    G.fitCamera(W, H);
    G.R.buildNoise(W, H);
  }

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  let toastTimer = 0;
  G.onMsg = function (text, dur) {
    ui.toast.textContent = text; ui.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), dur * 1000);
  };

  canvas.addEventListener('pointerdown', e => {
    const p = toLocal(e); G.pointer = p;
    canvas.setPointerCapture(e.pointerId);
    if (S.state !== 'play') return;
    if (G.eventPointerDown(p.x, p.y)) return;
    const q = G.R.hitTile(p.x, p.y);
    if (q) {
      if (q.free) G.grab(q.t);
      else if (G.pressBlocks(q.t)) G.say('被触手压住了：拖开它，或者连戳 4 下', 1.6);
      return;
    }
    G.M.pokeBody(p.x, p.y);
  });
  canvas.addEventListener('pointermove', e => {
    const p = toLocal(e); G.pointer = p;
    G.eventPointerMove(p.x, p.y);
    const q = G.R.hitTile(p.x, p.y);
    hover = q && q.free ? q.t : null;
    canvas.style.cursor = q && q.free ? 'pointer' : 'default';
  });
  const up = () => G.eventPointerUp();
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  document.getElementById('btnUndo').onclick = () => G.undo();
  ui.shuffle.onclick = () => G.doShuffle();
  document.getElementById('btnRestart').onclick = restart;
  document.getElementById('btnAgain').onclick = restart;
  function restart() { ui.end.classList.remove('show'); G.newGame(); }

  const WIN = ['祂合上了七只眼。', '供品献完了。今夜，你还活着。'];
  const LOSE = ['一条触手一把攥住了你。', '槽位满了。祂慢慢把你拖过桌面。'];

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    S.time += dt;
    G.M.update(dt);
    G.updateEvent(dt);
    G.R.frame(ctx, W, H, dt, hover);
    // 界面
    const san = S.san;
    ui.san.style.width = san + '%';
    ui.san.style.background = san > 60 ? G.mixHex('#8a5a1c', '#3f5a2c', (san - 60) / 40) : G.mixHex('#7a1414', '#8a5a1c', san / 60);
    ui.sanNum.textContent = Math.round(san);
    ui.left.textContent = G.boardLeft();
    ui.shuffle.querySelector('b').textContent = S.shuffles;
    document.body.classList.toggle('mad', san < 40);
    if ((S.state === 'win' || S.state === 'lose') && S.time >= S.endAt && !ui.end.classList.contains('show')) {
      const win = S.state === 'win';
      ui.endTitle.textContent = win ? '献祭完成' : '你被攥住了';
      ui.endText.textContent = (win ? WIN : LOSE)[Math.floor(Math.random() * 2)];
      ui.end.classList.toggle('lose', !win);
      ui.end.classList.add('show');
    }
    requestAnimationFrame(loop);
  }

  G.buildSprites();
  G.newGame();
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
})();
