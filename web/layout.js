// Layout for any screen size and ratio (landscape, portrait, square, ultrawide).
//   import { fit, place } from '/kit/layout.js';
//   fit(({ W, H, u, land }) => { ... place(el, x, y, w, h) ... });
// fit() calls back now and on every resize with the window size, u = 1% of its SHORT side (also
// set as the CSS variable --u, so CSS can size text as calc(var(--u) * 5)), and land = W / H >= 1.08.
// Size things in u (or fractions of W / H) and choose the arrangement by `land`, never by pixels.
export function fit(fn) {
  const run = () => {
    const W = innerWidth, H = innerHeight, u = Math.min(W, H) / 100;
    document.documentElement.style.setProperty('--u', u + 'px');
    document.documentElement.classList.toggle('land', W / H >= 1.08);
    document.documentElement.classList.toggle('port', W / H < 1.08);
    fn?.({ W, H, u, land: W / H >= 1.08 });
  };
  addEventListener('resize', run);
  document.fonts?.ready.then(run);
  run();
  return run;
}

// Absolute position and size in CSS pixels (h null = auto height).
export function place(el, x, y, w, h = null) {
  Object.assign(el.style, { position: 'absolute', left: x + 'px', top: y + 'px', width: w + 'px' });
  if (h != null) el.style.height = h + 'px';
}

// The biggest box of ratio r (w / h) that fits in W x H.
export function contain(W, H, r) {
  return W / H > r ? { w: H * r, h: H } : { w: W, h: W / r };
}
