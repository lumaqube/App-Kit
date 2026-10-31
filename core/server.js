// The kit's server: one per app, on localhost. It talks to Q-Booth (the Local API password stays
// here), serves the app's page and the kit's browser modules, and decides when the window shows.
//
//   GET  /                      the app's public/index.html (and any file in the app's public/)
//   GET  /kit/<file>            the kit's browser modules (web/): qbooth.js, layout.js, audio.js ...
//   GET  /config.json           the app's public settings + { app, mock, desktop, settingsLocked }
//   GET  /state                 { online, error, mode, event, page, session, camera, result, busy, available, templates }
//   GET  /cover/<templateId>    a template's cover image (404: none on this PC -> draw a placeholder)
//   GET  /category-cover/<id>   a category's cover;  GET /event-cover  the event's own cover
//   GET  /qb/<read>             events | templates | categories   (?eventId=...)
//   POST /qb/<action>           any Local API action, e.g. /qb/template/select {id}; event/start|stop need the PIN
//   POST /booth/start-with-template {id}   start a session with that template from wherever Q-Booth is
//   POST /app/hold {ms}         keep the window up for ms (an animation after the hand-over), max 20 s
//   POST /app/peek {on}         the settings are open: show the window whatever the page
//   POST /app/menu              the always-on-top menu button (shell/fab.js) was tapped: open the settings
//   GET/POST /settings, /settings/unlock, /settings/test, /app/hide, /app/quit   (operator, PIN)
//
// An app may add its own server side in <app>/server.js:  export default function (kit) { ... }
// kit = { cfg(), client, watch, state, route(method, path, handler), covers, log }  (see docs/GUIDE.md)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listenRetry } from './listen.js';
import { createClient, ACTIONS, READS } from './qbooth.js';
import { watchBooth } from './watch.js';
import { startMock } from './mock.js';
import * as covers from './covers.js';
import { loadConfig, readSettings, saveSettings, publicValues, configFile } from './settings.js';

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(KIT, 'web');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};

export function readManifest(appDir) {
  const m = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8'));
  m.window = { mode: 'overlay', showOn: ['welcome'], hideOnDialog: true, ...(m.window || {}) };
  return m;
}

export async function createAppServer({ appDir, mock } = {}) {
  const manifest = readManifest(appDir);
  let cfg = loadConfig(appDir, manifest);
  const MOCK = mock ?? !!cfg.mock;
  const PUBLIC = path.join(appDir, 'public');
  const listening = [];
  const extraRoutes = [];
  let hooks = { desktop: false, displays: [], visible: null, quit: null, restart: null };

  // ---- Q-Booth ----
  let conn = { ...cfg.qbooth };
  if (MOCK) {
    const real = cfg.mockEvent && covers.savedTemplates(cfg.qboothDir, cfg.mockEvent);
    const ev = real?.length ? covers.readEvent(cfg.qboothDir, cfg.mockEvent) : null;
    conn = { host: '127.0.0.1', port: 8749, password: 'mock' };
    listening.push(await startMock({ ...conn, auto: manifest.mock?.auto ?? true, ...(real?.length ? { eventId: cfg.mockEvent, eventName: ev?.name || cfg.mockEvent, templates: real } : {}) }));
  }
  const client = createClient(conn);
  const watch = watchBooth(client, { pollMs: cfg.pollMs });

  // ---- the window's mode ----
  //   full   the app, full screen (on top of Q-Booth in overlay mode)
  //   setup  not connected (Q-Booth off, Local API off, wrong password): a normal window saying why
  //   hidden Q-Booth's own pages / no event / a Q-Booth dialog that must be seen
  const state = { mode: null, hidden: false, peek: false, holdUntil: 0 };
  function computeMode() {
    const s = watch.state.status, w = manifest.window;
    if (state.peek) return 'full';
    if (state.hidden) return 'hidden';
    if (!cfg.overlay) return 'full';
    if (!watch.state.online) return 'setup';
    if (Date.now() < state.holdUntil) return 'full';
    if (!s?.event) return w.showWhenNoEvent ? 'full' : 'hidden';
    if (w.hideOnDialog !== false && s.busy?.dialog) return 'hidden';
    return w.showOn.includes(s.page) ? 'full' : 'hidden';
  }
  function statusText() {
    if (!watch.state.online) return watch.state.error === 'unauthorized' ? 'Wrong Local API password' : 'Waiting for Q-Booth (Local API)';
    const s = watch.state.status;
    return s?.event ? `Event: ${s.event.name} · ${s.page}` : 'Connected · waiting for an event';
  }
  function updateMode() {
    if (!watch.state.polled && !state.peek) return; // not before the first status answer (no flash of "setup")
    const m = computeMode();
    if (m !== state.mode) { state.mode = m; hooks.visible?.(m, statusText()); }
  }
  watch.on('status', updateMode);
  watch.on('offline', updateMode);
  setInterval(updateMode, 500); // hold time-outs

  // Start a session with a template from wherever Q-Booth is: Welcome takes template/select
  // directly (Q-Booth skips its pickers but keeps its gates: Start PIN, payment); on a picker the
  // card may not be on screen, so back to Welcome first.
  async function startWithTemplate(id) {
    let s = (await client.status()).data;
    if (!s?.event) return { ok: false, error: { code: 'no_event', message: 'No event is running' } };
    if (s.page !== 'welcome' && s.session?.active) {
      const end = await client.endSession();
      if (!end.ok) return end;
      for (let i = 0; i < 25 && s?.page !== 'welcome'; i++) { await new Promise(r => setTimeout(r, 200)); s = (await client.status()).data; }
    }
    return client.selectTemplate(id);
  }

  // ---- HTTP ----
  const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const readBody = req => new Promise(resolve => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch { resolve({}); } }); });
  const sendImage = (res, img) => { if (!img) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': img.type, 'Cache-Control': 'max-age=300' }); res.end(img.data); };
  const pinOk = pin => !cfg.settingsPin || String(pin || '') === String(cfg.settingsPin);
  const sendFile = (res, base, rel) => {
    const file = path.resolve(base, '.' + path.sep + rel);
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  };

  async function route(req, res) {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    for (const r of extraRoutes) if (r.method === req.method && (r.path === p || (r.path.endsWith('*') && p.startsWith(r.path.slice(0, -1))))) return r.handler(req, res, { url: u, body: () => readBody(req), json: (code, obj) => sendJson(res, code, obj) });
    if (p === '/config.json') return sendJson(res, 200, { ...publicValues(cfg, manifest), app: { id: manifest.id, name: manifest.name }, mock: MOCK, desktop: hooks.desktop, settingsLocked: !!cfg.settingsPin });
    if (p === '/state') {
      const s = watch.state.status;
      return sendJson(res, 200, {
        online: watch.state.online, error: watch.state.error, mode: state.mode, overlay: !!cfg.overlay,
        event: s?.event || null, page: s?.page || 'none', session: s?.session || null, camera: s?.camera || null,
        result: s?.result || null, busy: s?.busy || null, available: s?.available || [], templates: watch.state.templates,
      });
    }
    if (p.startsWith('/cover/')) return sendImage(res, (u.searchParams.get('event') || watch.state.status?.event?.id) && covers.coverOf(cfg.qboothDir, u.searchParams.get('event') || watch.state.status.event.id, p.slice(7)));
    if (p.startsWith('/category-cover/')) return sendImage(res, watch.state.status?.event && covers.categoryCover(cfg.qboothDir, watch.state.status.event.id, p.slice(16)));
    if (p === '/event-cover') return sendImage(res, watch.state.status?.event && covers.eventCover(cfg.qboothDir, watch.state.status.event.id));
    if (p.startsWith('/qb/')) {
      const cmd = p.slice(4);
      if (req.method === 'GET' && READS.includes(cmd)) {
        const q = Object.fromEntries(u.searchParams);
        return sendJson(res, 200, cmd === 'templates' ? await client.templates(q.eventId) : cmd === 'categories' ? await client.categories(q.eventId) : cmd === 'events' ? await client.events() : cmd === 'commands' ? await client.commands() : await client.status());
      }
      if (req.method === 'POST' && ACTIONS.includes(cmd)) {
        if (cmd.startsWith('event/') && !pinOk(req.headers['x-settings-pin'])) return sendJson(res, 403, { ok: false, error: { code: 'pin' } });
        return sendJson(res, 200, await client.send(cmd, await readBody(req)));
      }
      return sendJson(res, 404, { ok: false, error: { code: 'not_found' } });
    }
    if (req.method === 'POST' && p === '/booth/start-with-template') {
      const { id } = await readBody(req);
      if (!id) return sendJson(res, 400, { ok: false, error: { code: 'bad_request', message: 'id needed' } });
      const r = await startWithTemplate(id);
      log(`start with template ${id}: ${r.ok ? 'accepted' : r.error.code}`);
      return sendJson(res, 200, r);
    }
    if (req.method === 'POST' && p === '/app/hold') {
      const { ms } = await readBody(req);
      state.holdUntil = Date.now() + Math.max(0, Math.min(20000, +ms || 0));
      updateMode();
      return sendJson(res, 200, { ok: true });
    }
    // the always-on-top menu button was tapped (no PIN here: the settings ask for it)
    if (req.method === 'POST' && p === '/app/menu') { hooks.menu?.(); return sendJson(res, 200, { ok: !!hooks.menu }); }
    if (req.method === 'POST' && p === '/app/peek') {
      const { on } = await readBody(req);
      state.peek = !!on;
      updateMode();
      return sendJson(res, 200, { ok: true, mode: state.mode });
    }
    if (req.method === 'POST' && p === '/settings/unlock') {
      const { pin } = await readBody(req);
      return sendJson(res, pinOk(pin) ? 200 : 403, { ok: pinOk(pin) });
    }
    if (p === '/settings' || p.startsWith('/settings/') || p === '/app/hide' || p === '/app/quit') {
      if (!pinOk(req.headers['x-settings-pin'])) return sendJson(res, 403, { ok: false, error: { code: 'pin' } });
      if (req.method === 'GET' && p === '/settings') return sendJson(res, 200, { ...readSettings(cfg, manifest), file: configFile(appDir), displays: hooks.displays, desktop: hooks.desktop, app: { id: manifest.id, name: manifest.name }, shortcuts: manifest.shortcuts || [] });
      if (req.method === 'POST' && p === '/settings') {
        try {
          const r = saveSettings(appDir, manifest, cfg, await readBody(req));
          cfg = loadConfig(appDir, manifest);
          hooks.configChanged?.(cfg); // the shell applies what it can live (the menu button)
          if (!MOCK) client.set(cfg.qbooth);
          watch.refreshTemplates();
          const restart = r.restart && !!hooks.restart;
          if (restart) setTimeout(() => hooks.restart(), 400);
          return sendJson(res, 200, { ok: true, restart, restartNeeded: r.restart && !hooks.restart });
        } catch (err) { return sendJson(res, 500, { ok: false, error: { code: 'save', message: err.message } }); }
      }
      if (req.method === 'POST' && p === '/settings/test') {
        const b = await readBody(req);
        const r = await createClient({ host: b.host || cfg.qbooth.host, port: +b.port || cfg.qbooth.port, password: b.password || cfg.qbooth.password }).status();
        return sendJson(res, 200, r.ok ? { ok: true, event: r.data.event, app: r.data.app } : r);
      }
      if (req.method === 'POST' && p === '/app/hide') { state.hidden = !state.hidden; updateMode(); return sendJson(res, 200, { ok: true, hidden: state.hidden }); }
      if (req.method === 'POST' && p === '/app/quit') { sendJson(res, 200, { ok: !!hooks.quit }); if (hooks.quit) setTimeout(hooks.quit, 200); return; }
      return sendJson(res, 404, { ok: false });
    }
    if (p.startsWith('/kit/')) return sendFile(res, WEB, p.slice(5));
    return sendFile(res, PUBLIC, p === '/' ? 'index.html' : p.slice(1));
  }

  function log(...a) { console.log(`[${manifest.id}]`, ...a); }

  // the app's own server side
  const appServer = path.join(appDir, 'server.js');
  if (fs.existsSync(appServer)) {
    const mod = await import(pathToFileURL(appServer).href);
    await mod.default?.({
      cfg: () => cfg, client, watch, state: watch.state, covers, log, manifest,
      appDir, dataDir: process.env.QBK_CONFIG_DIR || appDir, // where to keep the app's own files (next to the exe when packaged)
      startWithTemplate,
      route: (method, p, handler) => extraRoutes.push({ method, path: p, handler }),
    });
  }

  return {
    manifest, client, watch,
    get cfg() { return cfg; },
    setHooks(h) { hooks = { ...hooks, ...h }; },
    toggleHidden() { state.hidden = !state.hidden; updateMode(); },
    statusText,
    async start() {
      const server = http.createServer((req, res) => route(req, res).catch(err => { console.error(err); try { sendJson(res, 500, { ok: false, error: { code: 'server', message: err.message } }); } catch { } }));
      try { await listenRetry(server, cfg.port); }
      catch (err) { throw new Error(err.code === 'EADDRINUSE' ? `Port ${cfg.port} is in use: ${manifest.name} is probably already running.` : err.message); }
      listening.push(server);
      log(`${manifest.name}: http://127.0.0.1:${cfg.port}/  (${MOCK ? 'MOCK booth' : `Q-Booth ${conn.host}:${conn.port}`})`);
      watch.start();
      return { port: cfg.port, cfg };
    },
    stop() { watch.stop(); for (const s of listening.splice(0)) { s.close(); s.closeAllConnections?.(); } },
  };
}
