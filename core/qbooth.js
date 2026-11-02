// Q-Booth Local API client (Node). Every call answers the same shape as the API itself:
//   { ok: true, data }                 reads (status, events, templates, categories, result)
//   { ok: true, accepted: "<cmd>" }    actions (202): the effect shows up in the next status
//   { ok: false, error: { code, message } }
// Network problems come back as error code "offline" (never thrown), so callers branch on .ok only.
// The full API: docs/API.md. Q-Booth: Settings -> Advanced -> Local API (Expert mode).

export const PAGES = ['none', 'welcome', 'survey', 'categoryPicker', 'templatePicker', 'input', 'camera', 'result'];
export const PHASES = ['liveIdle', 'counting', 'recording', 'capturing', 'reveal', 'shotDelay', 'review'];
export const READS = ['status', 'commands', 'events', 'templates', 'categories', 'result'];
export const ACTIONS = ['event/start', 'event/stop', 'session/start', 'session/end', 'category/select', 'template/select',
  'camera/capture', 'camera/retake', 'camera/process', 'result/print', 'result/qr'];

export function createClient(conn) {
  let c = { host: '127.0.0.1', port: 8730, password: '', timeoutMs: 4000, ...conn };

  async function call(method, cmd, params, timeoutMs = c.timeoutMs) {
    let url = `http://${c.host}:${c.port}/api/v1/${cmd}`;
    if (method === 'GET' && params && Object.keys(params).length) url += '?' + new URLSearchParams(params);
    try {
      const r = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + c.password, 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(params || {}) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const j = await r.json().catch(() => ({ ok: false, error: { code: 'bad_reply', message: 'HTTP ' + r.status } }));
      return j.ok ? j : { ok: false, error: j.error || { code: 'http_' + r.status, message: 'HTTP ' + r.status } };
    } catch (err) {
      return { ok: false, error: { code: 'offline', message: err.cause?.code || err.message } };
    }
  }

  return {
    get conn() { return { ...c, password: c.password ? '***' : '' }; },
    set(conn) { c = { ...c, ...conn }; },
    // reads
    status: () => call('GET', 'status'),
    events: () => call('GET', 'events'),
    // { covers: 1 } (API 1.1): every item's cover inline, { mime, width, height, video, hash, data: "data:..." }
    templates: (eventId, opt = {}) => call('GET', 'templates', { ...(eventId ? { eventId } : {}), ...opt }, opt.covers ? 30000 : undefined),
    categories: (eventId, opt = {}) => call('GET', 'categories', { ...(eventId ? { eventId } : {}), ...opt }, opt.covers ? 30000 : undefined),
    // the latest guest's results (API 1.1): { id, onScreen, items: [{ index, kind, mime, bytes, canShare, url, thumbUrl }] }
    result: () => call('GET', 'result'),
    // one result file (or its thumbnail) as the raw fetch Response, for streaming on; headers = { range }
    resultFile: (index, thumb, headers = {}) => fetch(`http://${c.host}:${c.port}/api/v1/result/file?` + new URLSearchParams({ index, ...(thumb ? { thumb: 1 } : {}) }),
      { headers: { Authorization: 'Bearer ' + c.password, ...headers }, signal: AbortSignal.timeout(30000) }),
    commands: () => call('GET', 'commands'),
    // any action by name: send('template/select', { id })
    send: (cmd, params) => call('POST', cmd, params),
    // the common ones, spelled out
    startSession: () => call('POST', 'session/start'),
    endSession: () => call('POST', 'session/end'),
    selectTemplate: idOrIndex => call('POST', 'template/select', typeof idOrIndex === 'number' ? { index: idOrIndex } : { id: idOrIndex }),
    capture: () => call('POST', 'camera/capture'),
    retake: () => call('POST', 'camera/retake'),
    process: () => call('POST', 'camera/process'),
    print: () => call('POST', 'result/print'),
    qr: (type = 'web') => call('POST', 'result/qr', { type }),
    startEvent: id => call('POST', 'event/start', { id }),
    stopEvent: () => call('POST', 'event/stop'),
  };
}
