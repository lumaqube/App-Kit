// For the fake booth only (core/mock.js): a real event's templates and covers, read from an event
// folder the way the booth app stores it, so the mock can play that event (Settings → Test mode).
//   readEventFolder(dir) -> { id, name, templates: [{ id, name, studio, categoryId, cover }], categories } | null
// dir = a folder holding event.json (+ assets/, templates/): an extracted .qevent, or a COPY of
// <booth app folder>\events\<id>. Read only. cover = { type, data (Buffer) } or null: the file of
// templates[].cover, else the template file's own preview (event_info.preview_image[0]).
// Apps never read covers this way: they get them from the Local API (core/covers.js).
import fs from 'node:fs';
import path from 'node:path';

const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };

export function readEventFolder(dir) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(dir, 'event.json'), 'utf8')); } catch { return null; }
  const base = path.resolve(dir);
  const inside = p => { if (!p) return null; const abs = path.resolve(base, p); return abs.startsWith(base + path.sep) && fs.existsSync(abs) ? abs : null; };
  const image = file => file && { type: IMAGE_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(file) };
  const preview = file => {
    try {
      const p = JSON.parse(fs.readFileSync(file, 'utf8')).event_info?.preview_image?.[0];
      return p?.mBase64 ? { type: IMAGE_TYPES['.' + String(p.mFileExt || 'jpg').replace(/^\./, '').toLowerCase()] || 'image/jpeg', data: Buffer.from(p.mBase64, 'base64') } : null;
    } catch { return null; }
  };
  const cats = (doc.categories || []).filter(c => c.enabled !== false);
  const on = new Set(cats.map(c => c.id));
  return {
    id: doc.id || path.basename(base), name: doc.name || path.basename(base),
    // the booth's picker rule: switched on, and its category (if any) not switched off
    templates: (doc.templates || []).filter(t => t.enabled !== false && (!t.categoryId || on.has(t.categoryId))).map(t => {
      const tpl = inside(t.path);
      return { id: t.id, name: t.caption || t.defaultCaption || t.id, studio: t.studio || '', categoryId: t.categoryId || null,
        cover: image(inside(t.cover)) || (tpl ? preview(tpl) : null) };
    }),
    categories: cats.map(c => ({ id: c.id, name: c.name || c.id, cover: image(inside(c.cover)) })),
  };
}
