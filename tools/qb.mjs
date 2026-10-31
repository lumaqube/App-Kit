// Talk to Q-Booth's Local API from the terminal (no app needed).
//   node tools/qb.mjs status                         the status (page, camera, busy, available ...)
//   node tools/qb.mjs events | templates | categories
//   node tools/qb.mjs send <action> ['{"id":"..."}'] e.g. send session/start, send template/select '{"index":2}'
//   node tools/qb.mjs watch                          print every change (page, phase, session ...) until Ctrl+C
// Connection: --host 127.0.0.1 --port 8730 --password <pw>, or --app <app> (that app's config.json),
// or --mock (starts the built-in fake booth on 8749 for the duration).
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '../core/qbooth.js';
import { watchBooth } from '../core/watch.js';
import { startMock } from '../core/mock.js';
import { appDir, args, die } from './common.mjs';

const a = args();
const [what, cmd, json] = a._;
if (!what) die('Usage: node tools/qb.mjs status | events | templates | categories | send <action> [json] | watch   [--app <app> | --host --port --password | --mock]');
let conn = { host: a.host || '127.0.0.1', port: +a.port || 8730, password: a.password || '' };
if (a.app) {
  const dir = appDir(a.app);
  const own = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch { return {}; } })();
  conn = { ...conn, ...own.qbooth };
}
let mock = null;
if (a.mock) { conn = { host: '127.0.0.1', port: 8749, password: 'mock' }; mock = await startMock({ ...conn, auto: !a.manual }); }
const qb = createClient(conn);
const show = r => console.log(JSON.stringify(r, null, 2));

if (what === 'watch') {
  const w = watchBooth(qb, { pollMs: 300 });
  const t = () => new Date().toISOString().slice(11, 23);
  for (const ev of ['online', 'offline', 'event', 'page', 'phase', 'session', 'templates', 'busy']) w.on(ev, d => console.log(`${t()} ${ev.padEnd(9)} ${JSON.stringify(d ?? '')}`));
  w.start();
} else {
  let r;
  if (what === 'send') { if (!cmd) die('send <action> [json]'); r = await qb.send(cmd, json ? JSON.parse(json) : {}); }
  else if (['status', 'events', 'templates', 'categories', 'commands'].includes(what)) r = await qb[what]();
  else die(`Unknown: ${what}`);
  show(r);
  mock?.close();
  process.exit(r.ok ? 0 : 2);
}
