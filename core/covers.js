// Template covers. The Local API gives template ids and names only; the covers are files in the
// event's own folder on the booth PC, read here READ ONLY (never write into Q-Booth's folder):
//   <qboothDir>\events\<eventId>\event.json -> templates[].cover   an image file inside the event folder
//   else templates[].path (.qso / .qsc, JSON)  -> event_info.preview_image[0].mBase64   the template's own preview
//   else categories[].cover for its category    (not used for templates; see categoryCover)
// A booth on another PC (Allow LAN) has no files here: coverOf() answers null, draw a placeholder.
// Also used by tools/covers.mjs (export all covers of an event).
import fs from 'node:fs';
import path from 'node:path';

export const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };
const cache = new Map();  // "dir|event|template" -> { type, data, from } | null
const events = new Map(); // "dir|event" -> { mtime, doc }

export const eventsDir = dir => path.join(dir, 'events');
const eventDir = (dir, eventId) => path.join(eventsDir(dir), String(eventId).replace(/[\\/:*?"<>|]/g, ''));

// event.json of an event (cached until the file changes), or null.
export function readEvent(dir, eventId) {
  const file = path.join(eventDir(dir, eventId), 'event.json');
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const k = dir + '|' + eventId, known = events.get(k);
  if (known && known.mtime === st.mtimeMs) return known.doc;
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    events.set(k, { mtime: st.mtimeMs, doc });
    for (const key of [...cache.keys()]) if (key.startsWith(k + '|')) cache.delete(key); // the event was edited
    return doc;
  } catch { return null; }
}

// Every event folder of this PC: [{ id, name, templates }] (archived / deleted ones too, flagged).
export function listEvents(dir) {
  let ids = [];
  try { ids = fs.readdirSync(eventsDir(dir)); } catch { return []; }
  return ids.map(id => {
    const d = readEvent(dir, id);
    return d && { id, name: d.name || id, archived: !!d.isArchived, deleted: !!d.pendingDelete, templates: (d.templates || []).filter(t => t.enabled !== false).length };
  }).filter(Boolean);
}

// The guest-pickable templates of a saved event, in the event's order:
// [{ id, name, studio, categoryId, cover (relative), path (relative) }]. Same rule as Q-Booth's
// picker: switched on, and its category (if any) not switched off.
export function savedTemplates(dir, eventId) {
  const d = readEvent(dir, eventId);
  if (!d) return null;
  const cats = new Map((d.categories || []).map(c => [c.id, c]));
  return (d.templates || [])
    .filter(t => t.enabled !== false && (!t.categoryId || cats.get(t.categoryId)?.enabled !== false))
    .map(t => ({ id: t.id, name: t.caption || t.defaultCaption || t.id, studio: t.studio || '', categoryId: t.categoryId || null, cover: t.cover || '', path: t.path || '' }));
}

// { type, data (Buffer), from: 'cover' | 'preview' } of a template's cover, or null.
export function coverOf(dir, eventId, templateId) {
  const key = dir + '|' + eventId + '|' + templateId;
  readEvent(dir, eventId); // refreshes the cache when event.json changed
  if (cache.has(key)) return cache.get(key);
  let found = null;
  const d = readEvent(dir, eventId);
  const t = (d?.templates || []).find(x => x.id === templateId);
  if (t) {
    const base = eventDir(dir, eventId);
    const inside = p => { if (!p) return null; const abs = path.resolve(base, p); return abs.startsWith(base + path.sep) && fs.existsSync(abs) ? abs : null; };
    const file = inside(t.cover);
    if (file) found = { type: IMAGE_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(file), from: 'cover' };
    else {
      const tpl = inside(t.path);
      if (tpl) {
        try {
          const p = JSON.parse(fs.readFileSync(tpl, 'utf8')).event_info?.preview_image?.[0];
          if (p?.mBase64) found = { type: IMAGE_TYPES['.' + String(p.mFileExt || 'jpg').replace(/^\./, '').toLowerCase()] || 'image/jpeg', data: Buffer.from(p.mBase64, 'base64'), from: 'preview' };
        } catch { }
      }
    }
  }
  cache.set(key, found);
  return found;
}

// A category's cover (category pickers), or null.
export function categoryCover(dir, eventId, categoryId) {
  const d = readEvent(dir, eventId);
  const c = (d?.categories || []).find(x => x.id === categoryId);
  if (!c?.cover) return null;
  const base = eventDir(dir, eventId), abs = path.resolve(base, c.cover);
  if (!abs.startsWith(base + path.sep) || !fs.existsSync(abs)) return null;
  return { type: IMAGE_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(abs), from: 'cover' };
}

// The event's own cover (event.json coverImage), or null.
export function eventCover(dir, eventId) {
  const d = readEvent(dir, eventId);
  if (!d?.coverImage) return null;
  const base = eventDir(dir, eventId), abs = path.resolve(base, d.coverImage);
  if (!abs.startsWith(base + path.sep) || !fs.existsSync(abs)) return null;
  return { type: IMAGE_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(abs), from: 'cover' };
}
