// Hello Booth: the smallest complete QBoothKit app. Shows the running event's templates as cards
// with their covers; a tap starts a Q-Booth session with that template. Copy it to start your own
// (node tools/new-app.mjs <id> "<Name>") and change what you need.
import { startKit } from '/kit/kit.js';
import { Sound } from '/kit/audio.js';
import { Fx } from '/kit/fx.js';

// 1. Texts in the three languages (kit.t picks the one set in Settings)
const kit = await startKit({
  texts: {
    en: { headline: 'Pick your theme!', tap: 'Tap a card to start', ready: 'Get ready!', err: 'Q-Booth said: {code}' },
    id: { headline: 'Pilih temamu!', tap: 'Sentuh kartu untuk mulai', ready: 'Bersiap!', err: 'Kata Q-Booth: {code}' },
    zh: { headline: '选择你的主题！', tap: '点一张卡片开始', ready: '准备好！', err: 'Q-Booth 回复：{code}' },
  },
});
const { booth, t, cfg } = kit;
const $ = id => document.getElementById(id);
$('headline').textContent = cfg.headline || t('headline');

// 2. Sound (made by code) and confetti
const sound = new Sound();
sound.init({ bgmVolume: cfg.bgmVolume, sfxVolume: cfg.sfxVolume });
kit.onShown(v => v ? sound.startBgm() : sound.stopBgm()); // music only while the app shows
addEventListener('pointerdown', () => { sound.resume(); if (kit.shown) sound.startBgm(); });
sound.startBgm();
const fx = new Fx($('fx'));
(function frame(now) { fx.step(1 / 60, now / 1000); requestAnimationFrame(frame); })(performance.now());

// 3. Layout: the cards fill the screen, whatever its size or ratio
let templates = [];
function layout({ W, H, u }) {
  const head = $('head').getBoundingClientRect().height;
  const areaW = W - u * 6, areaH = H - head - u * 6, n = Math.max(1, templates.length);
  let best = { size: 0, cols: 1 };
  for (let cols = 1; cols <= n; cols++) { // the column count that gives the biggest cards
    const rows = Math.ceil(n / cols);
    const size = Math.min((areaW - (cols - 1) * u * 2) / cols, ((areaH - (rows - 1) * u * 2) / rows) / 1.22);
    if (size > best.size) best = { size, cols };
  }
  const g = $('grid');
  g.style.gridTemplateColumns = `repeat(${best.cols}, ${best.size}px)`;
  g.style.setProperty('--card', best.size + 'px');
  fx.resize();
}
const relayout = kit.fit(layout);

// 4. The cards, from the event's templates (covers come from /cover/<id>)
function render() {
  const g = $('grid');
  g.replaceChildren(...templates.map(tp => {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `<div class="pic"><span>${(tp.name || '?').trim().charAt(0).toUpperCase()}</span></div><div class="name"></div>`;
    card.querySelector('.name').textContent = tp.name;
    const img = new Image();
    img.onload = () => { card.querySelector('.pic').style.backgroundImage = `url("${img.src}")`; card.querySelector('.pic span').remove(); };
    img.src = booth.coverUrl(tp.id); // 404 (no cover on this PC): the letter stays
    card.onclick = () => choose(tp, card);
    return card;
  }));
  relayout();
}
booth.on('templates', list => { templates = list; render(); });
booth.on('event', ({ event }) => { $('event').textContent = event ? `${event.name} · ${t('tap')}` : ''; });

// 5. A tap: Q-Booth starts a session with that template
async function choose(tp, card) {
  sound.pop();
  const r = card.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, 120);
  sound.fanfare();
  booth.hold(1200);                            // stay up a moment for the confetti
  const res = await booth.startWithTemplate(tp.id);
  toast(res.ok ? t('ready') : t('err', { code: res.error?.code }));
  if (!res.ok) sound.error();
}
function toast(text) {
  $('toast').textContent = text; $('toast').hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { $('toast').hidden = true; }, 2500);
}

// 6. React to Q-Booth's flow (an example: a short tick on each countdown phase)
booth.on('phase', ({ to }) => { if (to === 'counting') sound.count(); });
