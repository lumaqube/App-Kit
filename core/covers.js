// Template and category covers, from the booth app's Local API (API 1.1): templates?covers=1 and
// categories?covers=1 send every cover inline, at the size the booth's own picker shows it
// ({ mime, width, height, video, hash, data: "data:image/jpeg;base64,..." }).
// Read once per event / template list (covers aren't polled) and kept here as Buffers, so the page
// asks /cover/<id> like any image. A booth app with API 1 sends no covers: every cover is null and
// the page draws its placeholder. Works the same for a booth on another PC (nothing is read from disk).
//   const covers = createCovers(client);
//   await covers.template(templateId, eventId?)   -> { type, data, width, height, video, hash } | null
//   await covers.category(categoryId, eventId?)   -> same
//   await covers.list(eventId?)                   -> { templates: [{ id, name, ..., cover }], categories: [...] }
//   covers.forget()                               drop everything (the template list changed)

// "data:image/jpeg;base64,...." -> { type, data (Buffer) }
export function decodeDataUri(uri) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri || '');
  if (!m) return null;
  return { type: m[1], data: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) };
}

export function createCovers(client) {
  const sets = new Map(); // eventId ('' = the running event) -> Promise<{ templates, categories, byTemplate, byCategory }>

  const toImage = c => {
    const img = c?.data ? decodeDataUri(c.data) : null;
    return img && { ...img, type: c.mime || img.type, width: c.width || 0, height: c.height || 0, video: !!c.video, hash: c.hash || '' };
  };

  async function load(eventId) {
    const [t, c] = await Promise.all([client.templates(eventId, { covers: 1 }), client.categories(eventId, { covers: 1 })]);
    const templates = t.ok ? t.data : [], categories = c.ok ? c.data : [];
    return {
      ok: t.ok, templates, categories,
      byTemplate: new Map(templates.map(x => [x.id, toImage(x.cover)])),
      byCategory: new Map(categories.map(x => [x.id, toImage(x.cover)])),
    };
  }
  function get(eventId = '') {
    let p = sets.get(eventId);
    if (!p) {
      p = load(eventId || undefined);
      sets.set(eventId, p);
      p.then(s => { if (!s.ok) sets.delete(eventId); }); // offline / no event: ask again next time
    }
    return p;
  }

  return {
    async template(id, eventId) { return (await get(eventId)).byTemplate.get(id) || null; },
    async category(id, eventId) { return (await get(eventId)).byCategory.get(id) || null; },
    async list(eventId) { const s = await get(eventId); return { templates: s.templates, categories: s.categories }; },
    forget() { sets.clear(); },
  };
}
