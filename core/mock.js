// A fake Q-Booth Local API (v1) for building and testing without the real app. Same reply shapes,
// pages, phases and error codes as the real one (docs/API.md).
//   startMock({ port, password, eventId, eventName, templates, auto })
//   templates: [{ id, name }] (e.g. savedTemplates() of a real event: the covers then work too)
//   auto: true  -> a session plays by itself after the template is chosen (3 shots, review,
//                  processing, result, back to Welcome): good for overlay apps that only start it
//         false -> it waits for camera/capture, camera/process, session/end like the real booth
// Extra, mock only: POST /api/v1/mock/dialog {on} shows / hides a "dialog" (busy.dialog);
// POST /api/v1/mock/event {on} starts / stops the event.
import http from 'node:http';
import { listenRetry } from './listen.js';

const DEMO = ['Neon Party', 'Retro 80s', 'Golden Hour', 'Comic Pop', 'Space Trip', 'Under the Sea', 'Royal Gala', 'Candy Land']
  .map((name, i) => ({ id: 'demo_' + (i + 1), name }));

export function startMock({ port = 8749, password = 'mock', eventId = 'mock_EVENT', eventName = 'Mock Party', templates = DEMO, auto = true } = {}) {
  const TEMPLATES = templates.map((t, i) => ({ id: t.id, name: t.name, index: i + 1 }));
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
    app: { name: 'QBooth (mock)', version: '0.0.0', apiVersion: '1' },
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
    later(3500, () => { s.busy.processing = false; s.page = 'result'; s.camera = null; s.result = { index: 1, count: 1 }; if (auto) later(6000, endSession); });
  }
  function toCamera(t) {
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
    if (cmd === 'commands') return data({ apiVersion: '1', commands: ['status', 'events', 'templates', 'categories', ...available()] });
    if (cmd === 'events') return data([{ id: eventId, name: eventName, archived: false, templateCount: TEMPLATES.length, running: !!s.event }]);
    if (cmd === 'templates') return s.event ? data(TEMPLATES.map(t => ({ ...t, onScreen: s.page === 'templatePicker', selected: false }))) : fail('no_event', 409);
    if (cmd === 'categories') return data([]);
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
      if (!u.pathname.startsWith('/api/v1/')) r = fail('not_found', 404);
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
