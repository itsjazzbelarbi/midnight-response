(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var qs = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var body = document.body, html = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fx = !!window.gsap && !reduce;                // all the choreography needs GSAP and motion allowed
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} }

  if (fx) { html.classList.add('gsap'); gsap.registerPlugin(ScrollTrigger); }

  /* ================= Audio (all synthesised) ================= */
  var A = {
    ctx: null, master: null, on: false, duck: 1,
    start: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        var c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
        var len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), last = 0;
        for (var i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        this.noiseBuf = buf;
        var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
        var lfo = c.createOscillator(); lfo.frequency.value = 0.07;
        var lg = c.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(lp.frequency);
        var wg = c.createGain(); wg.gain.value = 0.55;
        src.connect(lp); lp.connect(wg); wg.connect(this.master);
        [48, 50.3].forEach(function (f) {
          var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          var g = c.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(A.master); o.start();
        });
        src.start(); lfo.start();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    set: function (on) {
      this.on = on;
      if (!this.ctx) return;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(on ? 0.5 * this.duck : 0, this.ctx.currentTime + 0.8);
    },
    setDuck: function (v) { this.duck = v; if (this.on) this.set(true); },
    beat: function () {
      if (!this.on) return;
      var c = this.ctx, t = c.currentTime;
      [0, 0.2].forEach(function (off, i) {
        var o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(i ? 52 : 62, t + off); o.frequency.exponentialRampToValueAtTime(30, t + off + 0.16);
        g.gain.setValueAtTime(0.0001, t + off); g.gain.exponentialRampToValueAtTime(i ? 0.7 : 1, t + off + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.22);
        o.connect(g); g.connect(c.destination); o.start(t + off); o.stop(t + off + 0.3);
      });
    },
    burst: function (dur, freq, vol) {
      if (!this.on) return;
      var c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1800; f.Q.value = 0.7;
      var g = c.createGain(), t = c.currentTime;
      g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t, Math.random() * 2); s.stop(t + dur);
    },
    thud: function (strength) {
      if (!this.on) return;
      var c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(strength || 0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.35);
    },
    // rising whoosh used when the doors open
    swell: function (dur) {
      if (!this.on) return;
      var c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      var g = c.createGain(), t = c.currentTime;
      f.frequency.setValueAtTime(120, t); f.frequency.exponentialRampToValueAtTime(1800, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t, Math.random() * 2); s.stop(t + dur);
    }
  };

  var sndBtn = $('sound');
  function paintSnd() { sndBtn.textContent = A.on ? 'Sound on' : 'Sound off'; sndBtn.setAttribute('aria-pressed', A.on); }
  sndBtn.addEventListener('click', function () {
    if (!A.on) { if (!A.start()) return; A.set(true); store('mr-snd', '1'); } else { A.set(false); store('mr-snd', '0'); }
    paintSnd();
  });

  /* ================= Smooth scroll ================= */
  var lenis = null;
  if (fx && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  qsa('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var el = id === '#top' ? 0 : qs(id); if (el === null) return;
      if (lenis) { e.preventDefault(); lenis.scrollTo(el, { duration: 1.7, offset: id === '#top' ? 0 : -10 }); }
    });
  });

  /* ================= Hero state (shared by the intro) ================= */
  var hero = $('hero'), hint = $('hint'), found = $('found');
  var T = { k: reduce || !fx ? 1 : 0 };   // flashlight power, 0 = off, 1 = full

  if (fx) {
    gsap.set('h1 .l > span', { yPercent: 112 });
    gsap.set('[data-in]', { opacity: 0, y: 22 });
    gsap.set('#bar', { yPercent: -110 });
  }

  function heroIn(speed) {
    if (!fx) { return; }
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.scene img', { scale: 1.28 }, { scale: 1, duration: 3.4, ease: 'power3.out' }, 0)
      .to('#bar', { yPercent: 0, duration: 1 }, 0.4)
      .to('h1 .l > span', { yPercent: 0, duration: 1.4, stagger: 0.14 }, 0.25)
      .to('[data-in]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out' }, 0.7)
      .to(T, { k: 1, duration: 1.8, ease: 'power2.out' }, 0.5);
    tl.timeScale(speed || 1);
  }

  /* ================= Intro: the 911 call ================= */
  var intro = $('intro'), log = $('cad-log'), clock = $('clock'), skip = $('skip'), wave = $('wave');
  var script = [
    ['SYS', 'sys', 'Incoming call. Abandoned school, Ridge Road.', 900, 0.15],
    ['911', '', 'Nine one one, what is your emergency?', 1000, 0.5],
    ['', 'caller', "...I can't find the way out.", 1300, 0.9],
    ['', 'caller', "He's in the hallway. He keeps checking the doors.", 1400, 0.95],
    ['911', '', 'Stay on the line. Who is in the hallway?', 1000, 0.5],
    ['', 'caller', "Please don't be loud.", 1200, 0.55],
    ['SYS', 'sys', 'Call dropped. Unit Fourteen, you are closest.', 1300, 0.15]
  ];
  var timers = [], finished = false, started = false, introTl = null, wamp = 0.04;
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function setState(s) { intro.classList.remove('idle', 'calling', 'title', 'opening'); intro.classList.add(s); }

  /* voice waveform: bars follow how loud the current line is */
  (function () {
    var g = wave.getContext('2d'), N = 72, v = new Array(N).fill(0), t = 0;
    (function draw() {
      if (finished && intro.classList.contains('done')) return;
      var W = wave.width, H = wave.height;
      g.clearRect(0, 0, W, H); g.fillStyle = '#98a6aa';
      t += 0.12;
      for (var i = 0; i < N; i++) {
        var target = wamp * (0.25 + 0.75 * Math.abs(Math.sin(t * 1.3 + i * 0.7) * Math.sin(t * 0.7 + i * 0.23))) * (0.6 + Math.random() * 0.4);
        v[i] += (target - v[i]) * 0.35;
        var h = Math.max(1.5, v[i] * H * 0.95), x = i * (W / N);
        g.globalAlpha = 0.35 + Math.min(0.65, v[i] * 1.2);
        g.fillRect(x + 1, (H - h) / 2, W / N - 3, h);
      }
      requestAnimationFrame(draw);
    })();
  })();

  /* split the title card into letters */
  var letters = [];
  qsa('.tcr').forEach(function (row) {
    var s = row.getAttribute('data-t'); row.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < s.length; i++) { var sp = document.createElement('span'); sp.textContent = s[i]; row.appendChild(sp); letters.push(sp); }
  });

  function finishIntro() {
    intro.classList.add('done'); body.classList.remove('intro-on');
    if (lenis) lenis.start();
    $('tclock').classList.add('on');
    if (fine) $('glow').classList.add('on');
    document.dispatchEvent(new Event('intro-done'));
  }

  function openDoors(fast) {
    if (introTl) introTl.kill();
    timers.forEach(clearTimeout); timers = [];
    setState('opening'); skip.hidden = true; finished = true; store('mr-intro', '1');
    if (!fx) { finishIntro(); return; }
    A.thud(0.9); A.swell(fast ? 0.9 : 1.6);
    var tl = gsap.timeline({ onComplete: finishIntro });
    tl.to('#titlecard', { opacity: 0, duration: fast ? 0.15 : 0.6, ease: 'power1.in' }, 0)
      .to('.pl', { xPercent: -101, duration: fast ? 0.9 : 1.9, ease: 'power4.inOut' }, fast ? 0 : 0.25)
      .to('.pr', { xPercent: 101, duration: fast ? 0.9 : 1.9, ease: 'power4.inOut' }, '<');
    heroIn(fast ? 1.8 : 1);
    // start the hero while the doors are still opening
    if (!fast) { /* heroIn already runs its own timeline from t = 0 */ }
  }

  function titleSequence() {
    if (finished) return;
    setState('title'); wamp = 0.02;
    if (!fx) { later(function () { openDoors(true); }, 600); return; }
    A.thud(1); A.burst(0.5, 600, 0.5);
    introTl = gsap.timeline();
    var flick = function (o) { return [{ opacity: 1, duration: 0.04 }, { opacity: 0.08, duration: 0.05 }, { opacity: 1, duration: 0.04 }, { opacity: 0.3, duration: 0.07 }, { opacity: 1, duration: 0.05 }]; };
    introTl
      .to('#flash', { keyframes: [{ opacity: 0.85, duration: 0.04 }, { opacity: 0, duration: 0.09 }, { opacity: 0.45, duration: 0.03 }, { opacity: 0, duration: 0.25 }] }, 0)
      .fromTo('.tc', { scale: 0.92 }, { scale: 1, duration: 3.4, ease: 'power1.out' }, 0.1)
      .to(letters, { keyframes: flick(), stagger: { each: 0.05, from: 'random' }, ease: 'none' }, 0.25)
      .to('.tcline', { scaleX: 1, duration: 0.9, ease: 'power3.out' }, 0.9)
      .to('.tcsub', { opacity: 1, duration: 0.7 }, 1.15)
      .call(function () { A.beat(); }, null, 1.1)
      .call(function () { openDoors(false); }, null, 2.7);
  }

  function addLine(who, cls, text, instant, next) {
    var p = document.createElement('p');
    if (cls) p.className = cls;
    if (who && who !== 'SYS') { var w = document.createElement('span'); w.className = 'who'; w.textContent = who; p.appendChild(w); }
    var span = document.createElement('span'); p.appendChild(span); log.appendChild(p);
    A.burst(0.18, 2400, 0.1);
    if (instant) { span.textContent = text; return next(); }
    p.classList.add('cursor');
    var i = 0;
    (function type() {
      if (finished) return;
      span.textContent = text.slice(0, ++i);
      if (i < text.length) later(type, 28 + Math.random() * 30); else { p.classList.remove('cursor'); next(); }
    })();
  }
  function play(i) {
    if (finished) return;
    if (i >= script.length) { wamp = 0.04; return later(titleSequence, 500); }
    var s = script[i]; wamp = s[4];
    addLine(s[0], s[1], s[2], reduce, function () { wamp = 0.06; later(function () { play(i + 1); }, reduce ? 150 : s[3]); });
  }
  function begin(withSound) {
    if (started) return; started = true;
    if (withSound && A.start()) { A.set(true); store('mr-snd', '1'); paintSnd(); }
    setState('calling'); skip.hidden = false;
    var t0 = Date.now();
    var iv = setInterval(function () {
      if (finished) return clearInterval(iv);
      clock.textContent = new Date(new Date(2000, 0, 1, 23, 47, 12).getTime() + Date.now() - t0).toTimeString().slice(0, 8);
    }, 250);
    later(function () { play(0); }, 700);
  }
  $('pick-sound').addEventListener('click', function () { begin(true); });
  $('pick-quiet').addEventListener('click', function () { begin(false); });
  skip.addEventListener('click', function () { openDoors(true); });
  document.addEventListener('keydown', function (e) {
    if (finished) return;
    if (e.key === 'Escape') openDoors(true);
    else if (e.key === 'Enter' && !started) begin(true);
  });

  if (store('mr-intro') === '1') {
    intro.classList.add('done'); body.classList.remove('intro-on'); finished = true;
    $('tclock').classList.add('on'); if (fine) $('glow').classList.add('on');
    if (lenis) lenis.start();
    heroIn(1.5);
  } else {
    $('pick-sound').focus();
  }
  paintSnd();

  /* ================= Hero: flashlight ================= */
  var FIG = { x: 0.289, y: 0.68 }, IMG = { w: 2400, h: 1350 };
  var tx = 0.4, ty = 0.55, cx = tx, cy = ty, moved = false, torchOn = true, baseR = 280;

  function figurePx() {
    var W = hero.clientWidth, H = hero.clientHeight, bw = W >= 900 ? W * 0.74 : W, s = Math.max(bw / IMG.w, H / IMG.h), w = IMG.w * s, h = IMG.h * s;
    return { x: (W - bw) + (bw - w) * 0.35 + FIG.x * w, y: H - h + FIG.y * h };
  }
  function placeFound() { var f = figurePx(); found.style.setProperty('--fx', f.x + 'px'); found.style.setProperty('--fy', f.y + 'px'); }
  placeFound(); window.addEventListener('resize', placeFound);

  var seenFig = false, lastBeat = 0;
  function frame(now) {
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    var flick = reduce ? 1 : 1 + Math.sin(now / 90) * 0.012 + (Math.random() < 0.004 ? -0.12 : 0);
    var r = baseR * flick * T.k;
    hero.style.setProperty('--x', (cx * 100).toFixed(2) + '%');
    hero.style.setProperty('--y', (cy * 100).toFixed(2) + '%');
    hero.style.setProperty('--r', Math.max(0.1, r).toFixed(1) + 'px');
    if (torchOn && T.k > 0.85 && window.scrollY < 60) {
      var f = figurePx(), px = cx * hero.clientWidth, py = cy * hero.clientHeight, d = Math.hypot(px - f.x, py - f.y);
      if (d < r * 0.55 && !seenFig && now - lastBeat > 1500) {
        seenFig = true; lastBeat = now; found.classList.add('on'); A.beat(); setTimeout(function () { A.beat(); }, 650);
      } else if (d > r * 0.95 && seenFig) { seenFig = false; found.classList.remove('on'); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function aim(x, y) {
    var r = hero.getBoundingClientRect();
    tx = (x - r.left) / r.width; ty = (y - r.top) / r.height;
    if (!moved) { moved = true; if (fx) gsap.to(hint, { opacity: 0, duration: 0.6 }); else hint.classList.add('gone'); }
  }
  hero.addEventListener('pointermove', function (e) { aim(e.clientX, e.clientY); });
  hero.addEventListener('pointerdown', function (e) { aim(e.clientX, e.clientY); });
  if (!reduce) {
    (function idle(now) {
      if (moved) return;
      tx = 0.5 + Math.sin(now / 2400) * 0.2; ty = 0.58 + Math.sin(now / 1500) * 0.07;
      requestAnimationFrame(idle);
    })(0);
  }
  function setTorch(on) { torchOn = on; body.classList.toggle('torch-off', !on); A.burst(0.06, 3000, 0.25); if (!on) found.classList.remove('on'); }

  /* rain */
  var cv = $('rain');
  if (cv && !reduce) {
    var g = cv.getContext('2d'), drops = [], W = 0, H = 0;
    var size = function () { W = cv.width = hero.clientWidth; H = cv.height = hero.clientHeight; drops = []; for (var i = 0; i < Math.min(160, W / 8); i++) drops.push({ x: Math.random() * W, y: Math.random() * H, l: 10 + Math.random() * 18, v: 11 + Math.random() * 9 }); };
    size(); window.addEventListener('resize', size);
    (function rain() {
      if (!document.hidden && window.scrollY < H) {
        g.clearRect(0, 0, W, H); g.strokeStyle = 'rgba(170,190,200,.35)'; g.lineWidth = 1; g.beginPath();
        for (var i = 0; i < drops.length; i++) {
          var d = drops[i]; g.moveTo(d.x, d.y); g.lineTo(d.x - 2, d.y + d.l);
          d.y += d.v; d.x -= 0.6; if (d.y > H) { d.y = -20; d.x = Math.random() * W; }
        }
        g.stroke();
      }
      requestAnimationFrame(rain);
    })();
  }

  /* ================= Film grain, ambient glow, midnight clock ================= */
  (function () {
    var c = qs('#grain canvas'), x = c.getContext('2d'), img = x.createImageData(160, 160);
    function noise() {
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      x.putImageData(img, 0, 0);
    }
    noise();
    if (!reduce) setInterval(function () { if (!document.hidden) noise(); }, 110);
  })();

  if (fine) {
    var gl = $('glow'), gx = innerWidth / 2, gy = innerHeight / 2, gtx = gx, gty = gy;
    window.addEventListener('pointermove', function (e) { gtx = e.clientX; gty = e.clientY; });
    (function glowLoop() {
      gx += (gtx - gx) * 0.12; gy += (gty - gy) * 0.12;
      gl.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      requestAnimationFrame(glowLoop);
    })();
  }

  var tclock = $('tclock'), bar = $('bar');
  function onScroll() {
    var y = window.scrollY, max = Math.max(1, html.scrollHeight - innerHeight), p = Math.min(1, y / max);
    bar.classList.toggle('solid', y > 80);
    if (p > 0.985) { tclock.textContent = '00:00'; tclock.classList.add('mid'); }
    else { tclock.textContent = '23:' + (47 + Math.floor(p * 13)); tclock.classList.remove('mid'); }
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ================= Scroll choreography ================= */
  if (fx) {
    // headings slide up out of a mask
    qsa('.rv').forEach(function (el) {
      var s = el.firstElementChild; gsap.set(s, { yPercent: 108 });
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: function () { gsap.to(s, { yPercent: 0, duration: 1.2, ease: 'expo.out' }); } });
    });
    // blocks of text and rows arrive in sequence
    var fades = qsa('[data-fade]'); gsap.set(fades, { opacity: 0, y: 34 });
    ScrollTrigger.batch(fades, { start: 'top 92%', once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out' }); } });
    // key tiles pop in
    var keys = qsa('.key'); gsap.set(keys, { opacity: 0, y: 24, scale: 0.94 });
    ScrollTrigger.batch(keys, { start: 'top 94%', once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.07, ease: 'back.out(1.5)' }); } });

    // hero drifts away as you leave it
    gsap.to('.scene img', { yPercent: 9, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('#herocopy', { y: -90, opacity: 0.1, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '70% top', scrub: true } });

    // the lit window: scrolling pushes the camera toward the figure
    var band = gsap.timeline({ scrollTrigger: { trigger: '#band', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    band.fromTo('.band-img', { scale: 1.02 }, { scale: 3.1, ease: 'power2.in', duration: 1 }, 0)
        .to('.b1', { opacity: 0, y: -30, duration: 0.22 }, 0.12)
        .fromTo('.b2', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.2 }, 0.66);

    // trailer opens up from a letterbox as it arrives
    gsap.fromTo('#player', { clipPath: 'inset(16% 12% 16% 12%)', scale: 0.92 },
      { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, ease: 'none', scrollTrigger: { trigger: '#player', start: 'top 92%', end: 'top 36%', scrub: true } });

    // scenes slide sideways while the page is pinned
    ScrollTrigger.matchMedia({
      '(min-width: 701px)': function () {
        var track = $('track'), dist = function () { return Math.max(0, track.scrollWidth - innerWidth); };
        gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
          scrollTrigger: { trigger: '#hz', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: function (s) { gsap.set('#hzprog', { scaleX: s.progress }); } } });
      }
    });

    // closing image drifts
    gsap.fromTo('.play-sec > img', { yPercent: -7, scale: 1.12 }, { yPercent: 7, scale: 1, ease: 'none', scrollTrigger: { trigger: '.play-sec', start: 'top bottom', end: 'bottom top', scrub: true } });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  /* ================= Trailer ================= */
  var vid = $('vid'), vp = $('vidplay'), player = $('player');
  vp.addEventListener('click', function () { vid.play(); });
  vid.addEventListener('play', function () { player.classList.add('playing'); A.setDuck(0.12); });
  vid.addEventListener('pause', function () { A.setDuck(1); });
  vid.addEventListener('ended', function () { A.setDuck(1); player.classList.remove('playing'); });

  /* ================= Gallery lightbox ================= */
  var lb = $('lightbox'), lbi = lb.querySelector('img'), lbp = lb.querySelector('p');
  qsa('.track button').forEach(function (b) {
    b.addEventListener('click', function () {
      lbi.src = b.getAttribute('data-full'); lbi.alt = b.querySelector('img').alt; lbp.textContent = b.getAttribute('data-cap');
      if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    });
  });
  lb.addEventListener('click', function () { if (lb.close) lb.close(); else lb.removeAttribute('open'); });

  /* ================= Controls: keys light up when you press them ================= */
  var keyTiles = {}; qsa('.key').forEach(function (k) { keyTiles[k.getAttribute('data-k')] = k; });
  function hitKey(k) {
    var t = keyTiles[k]; if (!t) return;
    t.classList.add('hit'); A.burst(0.04, 2600, 0.14);
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('hit'); }, 420);
  }
  qsa('.key').forEach(function (t) { t.addEventListener('pointerdown', function () { hitKey(t.getAttribute('data-k')); if (t.getAttribute('data-k') === 'f') setTorch(!torchOn); }); });
  document.addEventListener('keydown', function (e) {
    if (!finished || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    var k = (e.key || '').toLowerCase();
    if (keyTiles[k]) hitKey(k);
    if (k === 'f') setTorch(!torchOn);
  });
})();
