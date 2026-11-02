// Template covers of the booth app's events, through its Local API (API 1.1: templates?covers=1).
//   node tools/covers.mjs                                  list the events (id, name, templates)
//   node tools/covers.mjs <event id | name> --out <dir>    export its covers + manifest.json
// Connection: --host 127.0.0.1 --port 8730 --password <pw>, or --app <app> (that app's config.json),
// or --mock (the built-in fake booth). The covers come at the size the booth's own picker shows them.
// Files: 01_<template name>.jpg ... in the event's template order; manifest.json lists
// { index, id, name, studio, categoryId, file, width, height, video }.
import fs from 'node:fs';
import path from 'node:path';
import { appDir, args, die } from './common.mjs';
import { createClient } from '../core/qbooth.js';
import { decodeDataUri } from '../core/covers.js';
import { startMock } from '../core/mock.js';

const a = args();
let conn = { host: a.host || '127.0.0.1', port: +a.port || 8730, password: a.password || '' };
if (a.app) {
  const own = (() => { try { return JSON.parse(fs.readFileSync(path.join(appDir(a.app), 'config.json'), 'utf8')); } catch { return {}; } })();
  conn = { ...conn, ...own.qbooth };
}
let mock = null;
if (a.mock) { conn = { host: '127.0.0.1', port: 8749, password: 'mock' }; mock = await startMock(conn); }
const qb = createClient(conn);
const done = code => { mock?.close(); process.exit(code); };

const ev = await qb.events();
if (!ev.ok) { console.error(`The booth app's Local API answered: ${ev.error.code} (${ev.error.message})`); done(1); }
if (!a._[0]) {
  for (const e of ev.data) console.log(`${e.id.padEnd(28)} ${String(e.templateCount ?? '').padStart(3)} templates  ${e.name}${e.archived ? '  (archived)' : ''}${e.running ? '  (running)' : ''}`);
  console.log('\nExport: node tools/covers.mjs <event id | name> --out <folder>');
  done(0);
}

const want = a._[0];
const e = ev.data.find(x => x.id === want) || ev.data.find(x => x.name.toLowerCase() === want.toLowerCase());
if (!e) { console.error(`No event "${want}". Run without arguments for the list.`); done(1); }
if (!a.out || a.out === true) die('Where to? --out <folder>');
const out = path.resolve(a.out);
fs.mkdirSync(out, { recursive: true });

const t = await qb.templates(e.id, { covers: 1 });
if (!t.ok) { console.error(`templates: ${t.error.code} (${t.error.message})`); done(1); }
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
const manifest = { event: { id: e.id, name: e.name }, exported: new Date().toISOString(), templates: [] };
let n = 0;
t.data.forEach((x, i) => {
  const img = x.cover?.data ? decodeDataUri(x.cover.data) : null;
  const safe = String(x.name).replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || x.id;
  const file = img ? `${String(i + 1).padStart(2, '0')}_${safe}${EXT[img.type] || '.img'}` : null;
  if (img) { fs.writeFileSync(path.join(out, file), img.data); n++; }
  manifest.templates.push({ index: i + 1, id: x.id, name: x.name, studio: x.studio || '', categoryId: x.categoryId || null, file,
    width: x.cover?.width || 0, height: x.cover?.height || 0, video: !!x.cover?.video });
});
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${e.name}: ${n} of ${t.data.length} covers -> ${out}${n < t.data.length ? '  (a booth app before API 1.1 sends no covers)' : ''}`);
done(0);
