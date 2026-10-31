// Q-Booth in the page: the app's own server (core/server.js) polls the Local API; this polls that
// server (/state) and fires events when something changes. No password here: the server adds it.
//   import { booth } from '/kit/qbooth.js';
//   booth.on('page', ({ from, to }) => ...);       booth.on('phase', ({ from, to, camera }) => ...);
//   booth.on('session', ({ active, template }) => ...);   booth.on('event', ({ event }) => ...);
//   booth.on('templates', list => ...);           booth.on('online' | 'offline' | 'state', ...);
//   booth.state                                   the last /state (page, event, templates, busy, available ...)
//   await booth.send('template/select', { id })   any Local API action -> { ok, accepted } | { ok:false, error }
//   await booth.startWithTemplate(id)             a session with that template, from wherever Q-Booth is
//   booth.can('camera/capture')                   is that action accepted right now (status.available)
//   booth.coverUrl(templateId)                    the cover image URL (404 when none: use a placeholder)
//   booth.hold(ms)                                keep the window up a little after the hand-over (max 20 s)
const handlers = {};
const emit = (name, data) => (handlers[name] || []).forEach(fn => { try { fn(data); } catch (err) { console.error(err); } });

export const booth = {
  state: null,
  on(name, fn) { (handlers[name] ||= []).push(fn); if (name === 'state' && this.state) fn(this.state); return () => this.off(name, fn); },
  off(name, fn) { handlers[name] = (handlers[name] || []).filter(f => f !== fn); },
  can(cmd) { return !!this.state?.available?.includes(cmd); },
  async send(cmd, params = {}) {
    try { return await (await fetch('/qb/' + cmd, { method: 'POST', body: JSON.stringify(params) })).json(); }
    catch { return { ok: false, error: { code: 'offline' } }; }
  },
  async read(what, params) { // events | templates | categories
    try { return await (await fetch('/qb/' + what + (params ? '?' + new URLSearchParams(params) : ''))).json(); }
    catch { return { ok: false, error: { code: 'offline' } }; }
  },
  async startWithTemplate(id) {
    try { return await (await fetch('/booth/start-with-template', { method: 'POST', body: JSON.stringify({ id }) })).json(); }
    catch { return { ok: false, error: { code: 'offline' } }; }
  },
  coverUrl: id => '/cover/' + encodeURIComponent(id),
  categoryCoverUrl: id => '/category-cover/' + encodeURIComponent(id),
  eventCoverUrl: () => '/event-cover',
  hold: ms => fetch('/app/hold', { method: 'POST', body: JSON.stringify({ ms }) }).catch(() => { }),
};

let started = false;
export function startPolling(ms = 300) {
  if (started) return;
  started = true;
  let prev = null, prevKey = '';
  const tick = async () => {
    let s = null;
    try { s = await (await fetch('/state', { cache: 'no-store' })).json(); } catch { }
    if (s) {
      booth.state = s;
      if (!prev || s.online !== prev.online) emit(s.online ? 'online' : 'offline', s.error);
      if ((s.event?.id || null) !== (prev?.event?.id || null)) emit('event', { event: s.event });
      if (s.page !== prev?.page) emit('page', { from: prev?.page || null, to: s.page });
      const ph = s.camera?.phase || null, pph = prev?.camera?.phase || null;
      if (ph !== pph) emit('phase', { from: pph, to: ph, camera: s.camera });
      if (!!s.session?.active !== !!prev?.session?.active || s.session?.templateId !== prev?.session?.templateId)
        emit('session', { active: !!s.session?.active, template: s.session?.templateId ? { id: s.session.templateId, name: s.session.templateName } : null });
      const key = s.templates.map(t => t.id + ':' + t.name).join('|');
      if (key !== prevKey) { prevKey = key; emit('templates', s.templates); }
      if (JSON.stringify(s.busy) !== JSON.stringify(prev?.busy)) emit('busy', s.busy || {});
      emit('state', s);
      prev = s;
    }
    setTimeout(tick, ms);
  };
  tick();
}
