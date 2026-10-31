// Template covers of Q-Booth events, from the booth PC's own files (read only).
//   node tools/covers.mjs                                  list the events (id, name, templates)
//   node tools/covers.mjs <event id | name> --out <dir>    export its covers + manifest.json
//   options: --qbooth <Q-Booth folder>  (default C:\QBoothPro)
// Files: 01_<template name>.jpg ... in the event's template order; manifest.json lists
// { index, id, name, studio, categoryId, file, from: "cover" | "preview" | null }.
import fs from 'node:fs';
import path from 'node:path';
import { args, die } from './common.mjs';
import { listEvents, savedTemplates, coverOf, readEvent, IMAGE_TYPES } from '../core/covers.js';

const a = args();
const dir = a.qbooth || 'C:\\QBoothPro';
const events = listEvents(dir);
if (!events.length) die(`No events found in ${path.join(dir, 'events')}.`);

if (!a._[0]) {
  for (const e of events.filter(e => !e.deleted)) console.log(`${e.id.padEnd(28)} ${String(e.templates).padStart(3)} templates  ${e.name}${e.archived ? '  (archived)' : ''}`);
  console.log('\nExport: node tools/covers.mjs <event id | name> --out <folder>');
  process.exit(0);
}

const want = a._[0];
const ev = events.find(e => e.id === want) || events.find(e => e.name.toLowerCase() === want.toLowerCase());
if (!ev) die(`No event "${want}". Run without arguments for the list.`);
if (!a.out || a.out === true) die('Where to? --out <folder>');
const out = path.resolve(a.out);
if (path.resolve(out).toLowerCase().startsWith(path.resolve(dir).toLowerCase())) die('Never write into the Q-Booth folder: choose another --out.');
fs.mkdirSync(out, { recursive: true });

const ext = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([e, t]) => [t, e]));
const list = savedTemplates(dir, ev.id) || [];
const manifest = { event: { id: ev.id, name: readEvent(dir, ev.id)?.name || ev.name }, exported: new Date().toISOString(), templates: [] };
let n = 0;
list.forEach((t, i) => {
  const c = coverOf(dir, ev.id, t.id);
  const safe = t.name.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || t.id;
  const file = c ? `${String(i + 1).padStart(2, '0')}_${safe}${ext[c.type] === '.jpeg' ? '.jpg' : ext[c.type] || '.img'}` : null;
  if (c) { fs.writeFileSync(path.join(out, file), c.data); n++; }
  manifest.templates.push({ index: i + 1, id: t.id, name: t.name, studio: t.studio, categoryId: t.categoryId, file, from: c?.from || null });
});
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${ev.name}: ${n} of ${list.length} covers -> ${out}`);
