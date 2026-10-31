// Settings: one list of fields (the kit's + the app's own from app.json "settings") drives
// everything: the defaults, config.json, what the page may read, and the settings screen
// (web/settings-ui.js builds its tabs from this list).
// A field: { key: 'qbooth.port', type, default, tab, label: { en, id, zh }, hint?: { en, id, zh },
//            options?: [[value, label | { en, id, zh }]], min?, max?, restart?: true, public?: true }
//   type: string | int | bool | enum | secret (write-only, never sent to the page) | range (0-100) | display
//   tab:  booth | app | screen | security   (the app's own fields normally go to "app")
//   public: the page gets its value in /config.json (secrets never)
//   restart: saving it restarts the desktop app
import fs from 'node:fs';
import path from 'node:path';

const L = (en, id, zh) => ({ en, id, zh });

export const KIT_FIELDS = [
  { key: 'qbooth.host', type: 'string', default: '127.0.0.1', tab: 'booth', label: L('Q-Booth address', 'Alamat QBooth', 'QBooth 地址'), hint: L('127.0.0.1 = this PC', '127.0.0.1 = PC ini', '127.0.0.1 = 本机') },
  { key: 'qbooth.port', type: 'int', default: 8730, min: 1, max: 65535, tab: 'booth', label: L('Local API port', 'Port Local API', 'Local API 端口') },
  { key: 'qbooth.password', type: 'secret', default: '', tab: 'booth', label: L('Local API password', 'Password Local API', 'Local API 密码') },
  { key: 'qboothDir', type: 'string', default: 'C:\\QBoothPro', tab: 'booth', label: L('Q-Booth folder', 'Folder Q-Booth', 'Q-Booth 文件夹'), hint: L('Template covers are read from here (read only)', 'Cover template dibaca dari sini (hanya dibaca)', '从这里读取模板封面（只读）') },
  { key: 'mock', type: 'bool', default: false, tab: 'booth', restart: true, label: L('Test mode (fake Q-Booth)', 'Mode uji (Q-Booth tiruan)', '测试模式（模拟 Q-Booth）') },
  { key: 'mockEvent', type: 'string', default: '', tab: 'booth', restart: true, label: L('Test mode: borrow an event', 'Mode uji: pinjam event', '测试模式：借用活动'), hint: L('An event id from <Q-Booth folder>\\events: the fake booth uses its templates and covers', 'Id event dari <folder Q-Booth>\\events: Q-Booth tiruan memakai template dan covernya', '<Q-Booth 文件夹>\\events 中的活动 id：模拟器使用它的模板和封面') },
  { key: 'language', type: 'enum', default: 'en', tab: 'app', public: true, label: L('Language', 'Bahasa', '语言'), options: [['en', 'English'], ['id', 'Bahasa Indonesia'], ['zh', '中文']] },
  { key: 'overlay', type: 'bool', default: true, tab: 'screen', restart: true, public: true, label: L('Overlay on top of Q-Booth', 'Tampil di atas Q-Booth', '显示在 Q-Booth 上方'), hint: L('Shows only on the Q-Booth pages the app is made for. Off = a normal full-screen window (e.g. a second screen). Restarts the app.', 'Hanya muncul di page Q-Booth yang ditentukan app. Mati = jendela layar penuh biasa (mis. layar kedua). App dimulai ulang.', '只在应用指定的 Q-Booth 页面显示。关闭 = 普通全屏窗口（如第二屏）。会重启应用。') },
  { key: 'display', type: 'display', default: 0, tab: 'screen', restart: true, label: L('Screen', 'Layar', '屏幕') },
  { key: 'settingsPin', type: 'secret', default: '', tab: 'security', label: L('Settings PIN', 'PIN pengaturan', '设置 PIN 码'), hint: L('Empty = keep (no PIN when none is set)', 'Kosong = tetap (tanpa PIN kalau belum diisi)', '留空 = 不变（未设置则无 PIN）') },
];

// Not on the settings screen, but in config.json.
export const HIDDEN_DEFAULTS = { pollMs: 400 };

const get = (o, k) => k.split('.').reduce((a, p) => a?.[p], o);
const set = (o, k, v) => { const ps = k.split('.'); const last = ps.pop(); let a = o; for (const p of ps) a = a[p] ??= {}; a[last] = v; };

export function fieldsFor(manifest) {
  const own = (manifest.settings || []).map(f => ({ tab: 'app', public: true, ...f }));
  // the manifest decides the overlay default (window.mode)
  const overlay = (manifest.window?.mode || 'overlay') === 'overlay';
  return [...KIT_FIELDS.map(f => f.key === 'overlay' ? { ...f, default: overlay } : f), ...own];
}

export function defaultsFor(manifest) {
  const d = { port: manifest.port || 3940, ...HIDDEN_DEFAULTS };
  for (const f of fieldsFor(manifest)) set(d, f.key, f.default);
  return d;
}

// config.json: next to the exe when packaged (QBK_CONFIG_DIR, set by the desktop shell), else in the app folder.
export const configFile = appDir => path.join(process.env.QBK_CONFIG_DIR || appDir, 'config.json');

export function loadOwn(appDir) {
  try { return JSON.parse(fs.readFileSync(configFile(appDir), 'utf8')); } catch { return {}; }
}

export function loadConfig(appDir, manifest) {
  return merge(defaultsFor(manifest), loadOwn(appDir));
}

function merge(base, own) {
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const out = { ...base };
  for (const [k, v] of Object.entries(own || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

// What the settings screen gets: the fields (labels, no defaults of secrets), the values (no secrets).
export function readSettings(cfg, manifest) {
  const fields = fieldsFor(manifest);
  const values = {}, has = {};
  for (const f of fields) {
    if (f.type === 'secret') has[f.key] = !!get(cfg, f.key);
    else values[f.key] = get(cfg, f.key);
  }
  return { fields: fields.map(({ default: _d, ...f }) => f), values, has };
}

// Writes only the changed keys into config.json (the owner's own file, defaults stay out of it).
// Secrets: '' or undefined = keep, null = remove. Answers { restart } when a restart field changed.
export function saveSettings(appDir, manifest, cfg, changes) {
  const fields = new Map(fieldsFor(manifest).map(f => [f.key, f]));
  const own = loadOwn(appDir);
  let restart = false;
  for (const [k, raw] of Object.entries(changes || {})) {
    const f = fields.get(k);
    if (!f) continue;
    let v;
    if (f.type === 'secret') { if (raw === '' || raw === undefined) continue; v = raw === null ? '' : String(raw); }
    else if (f.type === 'int' || f.type === 'range' || f.type === 'display') {
      v = Math.round(+raw || 0);
      if (f.min != null) v = Math.max(f.min, v);
      if (f.max != null) v = Math.min(f.max, v);
      if (f.type === 'range') v = Math.max(0, Math.min(100, v));
    } else if (f.type === 'bool') v = raw === true || raw === 'true';
    else if (f.type === 'enum') { if (!f.options.some(([o]) => String(o) === String(raw))) continue; v = raw; }
    else v = raw == null ? '' : String(raw);
    if (f.restart && String(get(cfg, k)) !== String(v)) restart = true;
    set(own, k, v);
  }
  fs.mkdirSync(path.dirname(configFile(appDir)), { recursive: true });
  fs.writeFileSync(configFile(appDir), JSON.stringify(own, null, 2));
  return { restart };
}

// The values the page may read (public fields), for /config.json.
export function publicValues(cfg, manifest) {
  const out = {};
  for (const f of fieldsFor(manifest)) if (f.public && f.type !== 'secret') set(out, f.key, get(cfg, f.key));
  return out;
}
