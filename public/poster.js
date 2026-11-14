// Gentle snowfall over the poster in Snow day, drawn on a canvas. Hike day
// has none. The gondola drifts by CSS alone. With prefers-reduced-motion no
// snow falls and the poster is a still picture. The loop pauses when the poster is off screen or the tab is
// hidden, so it costs nothing while you read the results.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const poster = document.querySelector('.poster');
const canvas = document.querySelector('.poster__snow');

if (poster && canvas) {
  const ctx = canvas.getContext('2d');
  let flakes = [];
  let w = 0;
  let h = 0;
  let frame = 0;
  let last = 0;
  let visible = true;

  const makeFlake = (anywhere) => {
    const near = Math.random(); // 0 = far and small, 1 = near and larger
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -6,
      r: 1.4 + near * 2.6,
      vy: 16 + near * 34,             // px per second
      sway: 8 + Math.random() * 18,   // px
      phase: Math.random() * Math.PI * 2,
      freq: 0.25 + Math.random() * 0.45,
      a: 0.6 + near * 0.4,
    };
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = poster.clientWidth;
    h = poster.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Steady snow: about one flake per 5,000 px², capped for big screens.
    const want = Math.min(240, Math.round((w * h) / 5000));
    while (flakes.length < want) flakes.push(makeFlake(true));
    flakes.length = want;
  };

  // Move every flake on by dt seconds and paint them.
  const paint = (dt) => {
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      f.y += f.vy * dt;
      f.phase += f.freq * dt * Math.PI * 2;
      if (f.y > h + 6) Object.assign(f, makeFlake(false));
      const x = (((f.x + Math.sin(f.phase) * f.sway) % w) + w) % w;
      // White flakes with a faint blue edge, so they read on beige and on snow.
      ctx.globalAlpha = f.a;
      ctx.beginPath();
      ctx.arc(x, f.y, f.r + 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(83, 120, 163, 0.4)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const snowMode = () => document.documentElement.dataset.mode !== 'hike';
  const wanted = () => snowMode() && !reduceMotion.matches;

  const draw = (now) => {
    frame = 0;
    if (!visible || document.hidden || !wanted()) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    paint(dt);
    frame = requestAnimationFrame(draw);
  };

  const start = () => {
    if (!wanted()) {
      cancelAnimationFrame(frame);
      frame = 0;
      ctx.clearRect(0, 0, w, h);
      return;
    }
    if (!frame) {
      last = 0;
      frame = requestAnimationFrame(draw);
    }
  };

  size();
  if (wanted()) paint(0); // snow is there from the first paint
  // Resizing a canvas clears it, so repaint straight away.
  new ResizeObserver(() => { size(); if (wanted()) paint(0); }).observe(poster);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(poster);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  reduceMotion.addEventListener('change', start);
  document.addEventListener('snowday:mode', () => { if (wanted()) paint(0); start(); });
  start();
}
