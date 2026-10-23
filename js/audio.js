// 程序化音效：WebAudio 全合成，没有任何音频文件。
// 低频 drone 打底，心跳随 San 加快，抓取是湿黏的短噪声，献祭是不谐和的钟。
// 浏览器要求首次用户手势后才能出声：main.js 在点「开始献祭」时调 G.A.init()。
(function () {
  const G = window.G, S = G.S;
  const A = (G.A = { ok: false, muted: false });

  let ctx = null, master = null, droneGain = null, droneFilter = null, droneOsc = [], noiseBuf = null;
  let heartT = 0, heartOn = false;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 8;
    master.connect(comp); comp.connect(ctx.destination);
    // 噪声源（2 秒白噪声，反复用）
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 深渊底噪：两只失谐的锯齿沉在水底，LFO 推着滤波器呼吸
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass'; droneFilter.frequency.value = 90; droneFilter.Q.value = 6;
    droneGain = ctx.createGain(); droneGain.gain.value = 0.0;
    droneFilter.connect(droneGain); droneGain.connect(master);
    [41.2, 41.9, 82.4].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = i === 2 ? 0.12 : 0.3;
      o.connect(og); og.connect(droneFilter);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.037;
      const lg = ctx.createGain(); lg.gain.value = f * 0.012;
      lfo.connect(lg); lg.connect(o.frequency);
      o.start(); lfo.start();
      droneOsc.push(o);
    });
    droneGain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 4);
    A.ok = true;
  };

  A.toggle = function () {
    A.muted = !A.muted;
    if (master) master.gain.value = A.muted ? 0 : 0.85;
    return A.muted;
  };

  function noise(dur, filterType, freq, q, vol, decay, pan) {
    if (!A.ok || A.muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (decay || dur));
    let last = g;
    if (pan !== undefined && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
    src.connect(f); f.connect(g); last.connect(master);
    src.start(t); src.stop(t + dur);
  }

  function tone(freq, dur, vol, type, slideTo, when) {
    if (!A.ok || A.muted) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const sfx = A.sfx = function (kind) {
    if (!A.ok || A.muted) return;
    switch (kind) {
      case 'grab':
        noise(0.14, 'bandpass', 520 + Math.random() * 260, 2.2, 0.16, 0.12);
        tone(150 + Math.random() * 40, 0.08, 0.05, 'sine', 90);
        break;
      case 'match': {
        // 献祭钟：不谐和的三只分音，慢慢沉下去
        [196, 293.5, 441].forEach((f, i) => tone(f * (1 + (Math.random() - 0.5) * 0.006), 1.6 - i * 0.3, 0.09 - i * 0.02, 'sine'));
        noise(0.5, 'highpass', 3000, 1, 0.02, 0.4);
        break;
      }
      case 'event':
        tone(55, 0.7, 0.22, 'sawtooth', 100);
        noise(0.7, 'lowpass', 220, 1, 0.1, 0.6);
        break;
      case 'omen':
        [55, 58.3].forEach(f => tone(f, 1.4, 0.13, 'sine'));
        noise(1.4, 'bandpass', 900, 3, 0.03, 1.2);
        break;
      case 'sting':
        // 惊吓点：音量克制，靠突然而不是靠响
        noise(0.28, 'highpass', 1400, 0.8, 0.3, 0.22);
        tone(660, 0.5, 0.14, 'sawtooth', 130);
        tone(46, 0.9, 0.3, 'sine', 30);
        break;
      case 'whisper':
        noise(0.9, 'bandpass', 1100 + Math.random() * 700, 4, 0.05, 0.8, (Math.random() - 0.5) * 1.6);
        noise(0.5, 'bandpass', 1900, 6, 0.03, 0.45, (Math.random() - 0.5) * 1.6);
        break;
      case 'bite':
        noise(0.06, 'lowpass', 900, 1, 0.3, 0.05);
        tone(70, 0.25, 0.3, 'sine', 35);
        tone(340, 0.07, 0.12, 'square', 200, 0.03);
        break;
      case 'shuffle':
        noise(0.45, 'bandpass', 420, 1.4, 0.14, 0.42);
        break;
      case 'splash':
        noise(0.6, 'lowpass', 1400, 1, 0.16, 0.55);
        tone(210, 0.3, 0.05, 'sine', 70);
        break;
      case 'moon':
        [98, 147.6].forEach((f, i) => tone(f, 2.2, 0.12 - i * 0.03, 'triangle'));
        noise(1.2, 'lowpass', 300, 1, 0.08, 1.1);
        break;
      case 'squish':
        noise(0.09, 'lowpass', 380, 2, 0.09, 0.08);
        break;
      case 'lock':
        tone(65, 0.8, 0.26, 'sine', 40);
        tone(92.5, 0.8, 0.1, 'sine', 60);   // 小二度拍频：不安
        noise(0.4, 'lowpass', 260, 1, 0.12, 0.4);
        break;
      case 'win':
        [130.8, 155.6, 98].forEach((f, i) => tone(f, 2.6 - i * 0.4, 0.12, 'triangle', null, i * 0.55));
        break;
      case 'lose':
        tone(52, 2.4, 0.3, 'sawtooth', 26);
        noise(1.8, 'lowpass', 160, 1, 0.2, 1.6);
        tone(37, 2.2, 0.2, 'sine', 20, 0.3);
        break;
    }
  };

  // 氛围随关卡与 San 演化：黑祭夜 drone 更沉，San 低加心跳
  A.rite = function (mode) {
    if (!A.ok || !droneFilter) return;
    const t = ctx.currentTime;
    droneFilter.frequency.cancelScheduledValues(t);
    droneFilter.frequency.linearRampToValueAtTime(mode === 'black' ? 55 : 90, t + 3);
  };

  A.update = function (dt) {
    if (!A.ok || A.muted || !droneGain) return;
    const san = S.san == null ? 100 : S.san;
    const mad = 1 - san / 100;
    droneGain.gain.value = 0.13 + mad * 0.1 + (S.blackRite ? 0.06 : 0);
    // 心跳：San < 55 开始，越低越急越响
    heartOn = san < 55 && S.state === 'play';
    if (heartOn) {
      heartT -= dt;
      if (heartT <= 0) {
        const gap = 0.55 + (san / 55) * 0.75;
        heartT = gap;
        const v = 0.1 + mad * 0.16;
        tone(52, 0.16, v, 'sine', 34);
        tone(48, 0.13, v * 0.7, 'sine', 30, gap * 0.32);
      }
    }
  };
})();
