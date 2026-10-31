// Polls Q-Booth's status and turns its changes into events, so an app never compares states itself.
//   const w = watchBooth(client, { pollMs: 400 });
//   w.on('page', ({ from, to }) => ...)          welcome -> templatePicker -> camera -> result ...
//   w.on('phase', ({ from, to }) => ...)         camera phase: liveIdle, counting, capturing, review ...
//   w.on('session', ({ active, template }) => ...)   a session started (with its template) / ended
//   w.on('event', ({ event }) => ...)            an event started (event = { id, name }) or stopped (null)
//   w.on('templates', list => ...)               the running event's templates changed: [{ id, name, index? }]
//   w.on('busy', busy => ...)                    { dialog, processing } changed
//   w.on('online', () => ...) / w.on('offline', error => ...)   connection to the Local API
//   w.on('status', status => ...)                every successful poll
//   w.state -> { online, error, status, templates }
import { EventEmitter } from 'node:events';

export function watchBooth(client, { pollMs = 400, templatesEveryMs = 15000 } = {}) {
  const w = new EventEmitter();
  w.state = { online: false, error: null, status: null, templates: [] };
  let timer = null, stopped = false, templatesAt = 0;

  async function refreshTemplates(eventId) {
    templatesAt = Date.now();
    const t = eventId ? await client.templates() : null;
    const list = t?.ok ? t.data.map(x => ({ id: x.id, name: x.name, index: x.index ?? null, onScreen: !!x.onScreen, categoryId: x.categoryId ?? null })) : [];
    const key = l => l.map(x => x.id + ':' + x.name).join('|');
    if (!eventId || t?.ok) {
      if (key(list) !== key(w.state.templates)) { w.state.templates = list; w.emit('templates', list); }
      else w.state.templates = list; // onScreen / index may have moved
    }
  }

  async function poll() {
    const r = await client.status();
    if (!r.ok) {
      const was = w.state.online;
      w.state = { ...w.state, online: false, error: r.error.code, status: null };
      if (was || !w.state.seenOffline) { w.state.seenOffline = true; w.emit('offline', r.error); }
      return;
    }
    const s = r.data, prev = w.state.status;
    if (!w.state.online) { w.state.online = true; w.state.error = null; w.emit('online'); }
    w.state.status = s;
    const eventId = s.event?.id || null, prevEvent = prev?.event?.id || null;
    if (eventId !== prevEvent || (eventId && Date.now() - templatesAt > templatesEveryMs) || (eventId && !w.state.templates.length && Date.now() - templatesAt > 3000)
      || (s.page === 'templatePicker' && prev?.page !== 'templatePicker')) await refreshTemplates(eventId);
    if (eventId !== prevEvent) w.emit('event', { event: s.event || null });
    if (s.page !== prev?.page) w.emit('page', { from: prev?.page || null, to: s.page });
    const ph = s.camera?.phase || null, prevPh = prev?.camera?.phase || null;
    if (ph !== prevPh) w.emit('phase', { from: prevPh, to: ph, camera: s.camera });
    if (!!s.session?.active !== !!prev?.session?.active || s.session?.templateId !== prev?.session?.templateId)
      w.emit('session', { active: !!s.session?.active, template: s.session?.templateId ? { id: s.session.templateId, name: s.session.templateName } : null });
    if (JSON.stringify(s.busy || {}) !== JSON.stringify(prev?.busy || {})) w.emit('busy', s.busy || {});
    w.emit('status', s);
  }

  const loop = async () => {
    if (stopped) return;
    try { await poll(); w.state.polled = true; } catch (err) { if (w.listenerCount('error')) w.emit('error', err); else console.error('watch: ' + err.message); }
    timer = setTimeout(loop, Math.max(150, pollMs));
  };
  w.start = () => { stopped = false; loop(); return w; };
  w.stop = () => { stopped = true; clearTimeout(timer); };
  w.refreshTemplates = () => refreshTemplates(w.state.status?.event?.id || null);
  return w;
}
