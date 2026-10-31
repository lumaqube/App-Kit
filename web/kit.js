// One call gets an app page going:
//   import { startKit } from '/kit/kit.js';
//   const kit = await startKit({ texts: { en: {...}, id: {...}, zh: {...} } });
//   kit.cfg        the app's public settings (language, overlay, the app's own public fields ...)
//   kit.lang       'en' | 'id' | 'zh';  kit.t('key', { name: 'x' }) -> the text in that language ({name} filled)
//   kit.booth      Q-Booth: events, state, send(), startWithTemplate(), coverUrl() ... (web/qbooth.js)
//   kit.onShown(v => ...)   the desktop window was shown (true) / hidden (false): start / stop music here
//   kit.settings.open()     the operator settings (normally opened by the operator's keys)
//   kit.fit(fn), kit.place(...)   layout helpers (web/layout.js)
// It also: loads kit.css, puts a "Waiting for Q-Booth…" screen with a Settings button over the app
// while Q-Booth is not reachable or runs no event (startKit({ waiting: false }) to draw your own),
// and wires the operator's ways into the settings (hold the top-left corner 3 s, the S key).
import { booth, startPolling } from './qbooth.js';
import { initSettings, fillBooth, setBoothName } from './settings-ui.js';
import { fit, place, contain } from './layout.js';
export { booth, fit, place, contain };

const KIT_TEXT = {
  en: { waiting: 'Waiting for {booth}…', offline: '{booth} is not answering. Is it running, with its Local API on (Settings → Advanced)?', unauthorized: 'Wrong Local API password: set it in Settings', noEvent: 'Run an event in {booth} to start', settings: '⚙ Settings' },
  id: { waiting: 'Menunggu {booth}…', offline: '{booth} belum menjawab. Sudah jalan, dan Local API-nya aktif (Settings → Advanced)?', unauthorized: 'Password Local API salah: isi di Pengaturan', noEvent: 'Jalankan event di {booth} untuk mulai', settings: '⚙ Pengaturan' },
  zh: { waiting: '正在等待{booth}…', offline: '{booth}没有响应。它在运行吗？Local API 打开了吗（Settings → Advanced）？', unauthorized: 'Local API 密码错误：请在设置中填写', noEvent: '请在{booth}中运行活动', settings: '⚙ 设置' },
};

let currentBrand = null;
function setBrand(b) { if (b && b !== currentBrand) { currentBrand = b; setBoothName(b); } }

export async function startKit({ texts = {}, waiting = true, pollMs = 300 } = {}) {
  if (!document.querySelector('link[data-qbk]')) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/kit/kit.css' });
    link.setAttribute('data-qbk', '1');
    document.head.append(link);
  }
  const cfg = await (await fetch('/config.json')).json();
  const lang = ['en', 'id', 'zh'].includes(cfg.language) ? cfg.language : 'en';
  document.documentElement.lang = lang;
  // texts: {name} from vars; {booth} = the booth app's brand (kit.brand), or a neutral word
  const t = (key, vars = {}) => {
    const s = texts[lang]?.[key] ?? texts.en?.[key] ?? key;
    return typeof s === 'string' ? fillBooth(s.replace(/\{(\w+)\}/g, (m, k) => k === 'booth' ? m : (vars[k] ?? m)), lang) : s;
  };

  const settings = initSettings({ lang, locked: cfg.settingsLocked });
  fetch('/app/peek', { method: 'POST', body: JSON.stringify({ on: false }) }).catch(() => { }); // a fresh page: no settings open

  // the desktop shell calls these
  const shownFns = [];
  let shown = true;
  window.__qbk = {
    settings: () => settings.open(),
    shown(v) { shown = v; shownFns.forEach(fn => { try { fn(v); } catch (err) { console.error(err); } }); },
  };

  // operator's ways in: hold the top-left corner 3 s, or S (with the window focused)
  const corner = Object.assign(document.createElement('div'), { className: 'qbk-corner' });
  document.body.append(corner);
  let hold = null;
  corner.addEventListener('pointerdown', () => { hold = setTimeout(() => settings.open(), 3000); });
  addEventListener('pointerup', () => clearTimeout(hold));
  addEventListener('keydown', e => { if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.altKey && !settings.isOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) settings.open(); });

  // the waiting screen
  if (waiting) {
    const k = KIT_TEXT[lang];
    const box = document.createElement('div');
    box.className = 'qbk-wait'; box.hidden = true;
    box.innerHTML = '<div class="qbk-wait-box"><div class="qbk-wait-icon"></div><h2></h2><p></p><button type="button"></button></div>';
    box.querySelector('button').textContent = k.settings;
    box.querySelector('button').onclick = () => settings.open();
    document.body.append(box);
    booth.on('state', s => {
      setBrand(s.brand);
      const why = !s.online ? (s.error === 'unauthorized' ? k.unauthorized : k.offline) : !s.event ? k.noEvent : null;
      box.hidden = !why;
      if (why) { box.querySelector('.qbk-wait-icon').textContent = s.online ? '🎪' : '🔌'; box.querySelector('h2').textContent = fillBooth(k.waiting, lang); box.querySelector('p').textContent = fillBooth(why, lang); }
    });
  }

  booth.on('state', s => setBrand(s.brand));
  startPolling(pollMs);
  return {
    cfg, lang, t, booth, settings, fit, place, contain,
    get brand() { return currentBrand; },   // the booth app's name (Q-Booth, BleepShareAI, XBooth) or null
    get shown() { return shown; },
    onShown(fn) { shownFns.push(fn); },
  };
}
