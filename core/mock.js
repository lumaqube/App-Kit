// A fake booth app Local API (API 1.1) for building and testing without the real app. Same reply
// shapes, pages, phases and error codes as the real one (docs/API.md).
//   startMock({ port, password, eventId, eventName, templates, categories, auto, appName })
//   appName: the product name it reports ("QBooth (mock)", "XBooth (mock)", ...): brand tests
//   templates: [{ id, name, cover? }] (e.g. readEventFolder() of a real event: its own covers then);
//              without a cover the mock draws one (an SVG card with the name's first letter)
//   Covers (templates?covers=1) and results (result, result/file) as in API 1.1: the "photo" of a
//   session is its template's cover.
//   auto: true  -> a session plays by itself after the template is chosen (3 shots, review,
//                  processing, result, back to Welcome): good for overlay apps that only start it
//         false -> it waits for camera/capture, camera/process, session/end like the real booth
// Extra, mock only: POST /api/v1/mock/dialog {on} shows / hides a "dialog" (busy.dialog);
// POST /api/v1/mock/event {on} starts / stops the event.
import http from 'node:http';
import crypto from 'node:crypto';
import { listenRetry } from './listen.js';

const DEMO = ['Neon Party', 'Retro 80s', 'Golden Hour', 'Comic Pop', 'Space Trip', 'Under the Sea', 'Royal Gala', 'Candy Land']
  .map((name, i) => ({ id: 'demo_' + (i + 1), name }));

// a drawn cover for a template without one
const HUES = [330, 20, 45, 200, 260, 170, 290, 0];
function drawnCover(name, i) {
  const h = HUES[i % HUES.length], letter = String(name || '?').trim().charAt(0).toUpperCase().replace(/[<&>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h},85%,62%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},75%,42%)"/></linearGradient></defs>` +
    `<rect width="400" height="400" fill="url(#g)"/><text x="200" y="265" font-family="Segoe UI,Arial" font-size="190" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return { type: 'image/svg+xml', data: Buffer.from(svg) };
}
const coverJson = img => img && {
  mime: img.type, width: 400, height: 400, video: false, hash: crypto.createHash('sha1').update(img.data).digest('hex').slice(0, 16),
  data: `data:${img.type};base64,${img.data.toString('base64')}`,
};

export function startMock({ port = 8749, password = 'mock', eventId = 'mock_EVENT', eventName = 'Mock Party', templates = DEMO, categories = [], auto = true, appName = 'QBooth (mock)' } = {}) {
  const TEMPLATES = templates.map((t, i) => ({ id: t.id, name: t.name, index: i + 1, categoryId: t.categoryId || null, cover: t.cover || drawnCover(t.name, i) }));
  const CATEGORIES = categories.map((c, i) => ({ id: c.id, name: c.name, index: i + 1, cover: c.cover || null }));
  let results = null; // the latest guest's results: { id, template }, until the next guest starts
  const s = {
    event: { id: eventId, name: eventName },
    page: 'welcome',
    session: { active: false, templateId: null, templateName: null },
    camera: null, result: null,
    busy: { dialog: false, processing: false },
  };
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function available() {
    const a = [];
    if (s.busy.dialog || s.busy.processing) return s.event ? ['event/stop'] : [];
    if (!s.event) return ['event/start'];
    if (s.page === 'welcome') a.push('session/start', 'template/select');
    else a.push('session/end');
    if (s.page === 'templatePicker') a.push('template/select');
    const c = s.camera;
    if (c && (c.phase === 'liveIdle' || c.phase === 'shotDelay')) a.push('camera/capture');
    if (c && c.phase === 'review') { if (c.retakesLeft > 0) a.push('camera/retake'); a.push('camera/process'); }
    if (s.page === 'result') a.push('result/print', 'result/qr');
    a.push('event/stop');
    return a;
  }

  const status = () => ({
    app: { name: appName, version: '0.0.0', apiVersion: '1.1' },
    event: s.event, page: s.event ? s.page : 'none', session: s.session,
    camera: s.camera, result: s.result, busy: s.busy, available: available(),
  });

  // one shot: counting 3 s -> capturing -> reveal -> next shot (or review after the last)
  function shoot(isRetake) {
    const c = s.camera;
    c.phase = 'counting';
    if (!isRetake) c.shot = c.captured + 1;
    later(3000, () => { c.phase = 'capturing'; });
    later(3400, () => { c.phase = 'reveal'; if (!isRetake) c.captured++; });
    later(4600, () => {
      if (!isRetake && c.captured < c.shots) { c.phase = 'shotDelay'; later(1500, () => shoot(false)); }
      else { c.phase = 'review'; if (auto) later(2500, process); }
    });
  }
  function process() {
    if (s.camera?.phase !== 'review') return;
    s.busy.processing = true;
    later(3500, () => {
      results = { id: crypto.randomBytes(16).toString('hex'), template: TEMPLATES.find(t => t.id === s.session.templateId) };
      s.busy.processing = false; s.page = 'result'; s.camera = null; s.result = { index: 1, count: 1, id: results.id };
      if (auto) later(6000, endSession);
    });
  }
  function toCamera(t) {
    results = null; // a new guest: the last one's results are gone
    s.session = { active: true, templateId: t.id, templateName: t.name };
    s.page = 'camera';
    s.camera = { phase: 'liveIdle', shot: 0, shots: 3, captured: 0, feed: 'live', retakesLeft: 1 };
    if (auto) later(1500, () => shoot(false));
  }
  function endSession() {
    clearTimers();
    Object.assign(s, { page: 'welcome', camera: null, result: null, busy: { dialog: false, processing: false } });
    s.session = { active: false, templateId: null, templateName: null };
  }

  const fail = (code, http, message) => ({ http, body: { ok: false, error: { code, message: message || code } } });
  const accepted = cmd => ({ http: 202, body: { ok: true, accepted: cmd } });
  const data = d => ({ http: 200, body: { ok: true, data: d } });

  function handle(cmd, p) {
    if (cmd === 'status') return data(status());
    if (cmd === 'commands') return data({ apiVersion: '1.1', commands: ['status', 'events', 'templates', 'categories', 'result', 'result/file', ...available()] });
    if (cmd === 'events') return data([{ id: eventId, name: eventName, archived: false, templateCount: TEMPLATES.length, running: !!s.event }]);
    const withCover = x => ({ ...x, cover: p.covers && p.covers !== '0' ? coverJson(x.cover) : null });
    if (cmd === 'templates') return s.event || p.eventId ? data(TEMPLATES.map(t => ({ ...withCover(t), onScreen: s.page === 'templatePicker', selected: false }))) : fail('no_event', 409);
    if (cmd === 'categories') return s.event || p.eventId ? data(CATEGORIES.map(withCover)) : fail('no_event', 409);
    if (cmd === 'result') {
      if (!results) return fail('no_result', 409);
      const img = results.template.cover, q = `t=${results.id}&index=1`;
      return data({ id: results.id, onScreen: s.page === 'result', items: [{ index: 1, kind: 'photo', mime: img.type, bytes: img.data.length, canShare: true,
        url: `/api/v1/result/file?${q}`, thumbUrl: `/api/v1/result/file?${q}&thumb=1` }] });
    }
    if (cmd === 'mock/dialog') { s.busy.dialog = !!p.on; return accepted(cmd); }
    if (cmd === 'mock/event') { if (p.on) { s.event = { id: eventId, name: eventName }; endSession(); } else { endSession(); s.event = null; } return accepted(cmd); }
    if (!available().includes(cmd)) {
      if (s.busy.dialog) return fail('dialog_open', 409);
      if (s.busy.processing) return fail('processing', 409);
      if (!s.event) return fail('no_event', 409);
      return fail(cmd.startsWith('camera/') && s.page === 'camera' ? 'wrong_phase' : 'wrong_page', 409);
    }
    switch (cmd) {
      case 'event/start': s.event = { id: eventId, name: eventName }; endSession(); break;
      case 'event/stop': endSession(); s.event = null; break;
      case 'session/start': s.session.active = true; s.page = 'templatePicker'; break;
      case 'session/end': endSession(); break;
      case 'template/select': {
        const t = TEMPLATES.find(x => x.id === p.id) || TEMPLATES[(+p.index || 0) - 1];
        if (!t) return fail('unknown_template', 404);
        toCamera(t);
        break;
      }
      case 'camera/capture': shoot(false); break;
      case 'camera/retake': s.camera.retakesLeft--; shoot(true); break;
      case 'camera/process': process(); break;
      case 'result/print': break;
      case 'result/qr': s.busy.dialog = true; later(4000, () => { s.busy.dialog = false; }); break;
    }
    return accepted(cmd);
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let r;
      const key = req.headers.authorization === 'Bearer ' + password || req.headers['x-qbooth-key'] === password || u.searchParams.get('key') === password;
      // result/file: the file itself (t = the result id in place of the password), byte ranges
      if (u.pathname === '/api/v1/result/file') {
        const t = u.searchParams.get('t');
        if (!key && !t) r = fail('unauthorized', 401);
        else if (!results) r = fail('no_result', 409);
        else if (!key && t !== results.id) r = fail('expired', 410);
        else if (u.searchParams.get('index') !== '1') r = fail('unknown_result', 404);
        else {
          const img = results.template.cover, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
          const a = m && m[1] ? +m[1] : 0, b = m && m[2] ? Math.min(+m[2], img.data.length - 1) : img.data.length - 1;
          res.writeHead(m ? 206 : 200, { 'Content-Type': img.type, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes', ...(m ? { 'Content-Range': `bytes ${a}-${b}/${img.data.length}` } : {}) });
          return res.end(req.method === 'HEAD' ? undefined : img.data.subarray(a, b + 1));
        }
      }
      if (r) { /* answered above */ }
      else if (!u.pathname.startsWith('/api/v1/')) r = fail('not_found', 404);
      else if (u.pathname !== '/api/v1/commands' && !key) r = fail('unauthorized', 401);
      else {
        let p = Object.fromEntries(u.searchParams);
        try { if (chunks.length) p = { ...p, ...JSON.parse(Buffer.concat(chunks).toString() || '{}') }; } catch { }
        r = handle(u.pathname.slice('/api/v1/'.length), p);
      }
      res.writeHead(r.http, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(r.body));
    });
  });
  return listenRetry(server, port).catch(err => {
    throw new Error(err.code === 'EADDRINUSE' ? `Mock port ${port} is in use: another mock is probably running.` : err.message);
  });
}
