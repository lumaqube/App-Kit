// A new app from the template (templates/hello):
//   node tools/new-app.mjs <id> "<Name>" [--port 3950]
// <id>: lower-case letters, digits and dashes (the folder apps/<id>). The port is the next free one
// after the other apps' when not given.
import fs from 'node:fs';
import path from 'node:path';
import { KIT, APPS, listApps, args, die } from './common.mjs';

const a = args();
const [id, name] = a._;
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) die('Usage: node tools/new-app.mjs <id> "<Name>"   (id: lower-case letters, digits, dashes)');
const dest = path.join(APPS, id);
if (fs.existsSync(dest)) die(`apps/${id} exists already.`);
const used = listApps().map(d => { try { return JSON.parse(fs.readFileSync(path.join(APPS, d, 'app.json'), 'utf8')).port; } catch { return 0; } });
let port = +a.port || 3940;
if (!a.port) while (used.includes(port)) port++;
else if (used.includes(port)) die(`Port ${port} is used by another app.`);

fs.cpSync(path.join(KIT, 'templates', 'hello'), dest, { recursive: true, filter: src => !/[\\/](config\.json|logs)$/.test(src) });
const mf = path.join(dest, 'app.json');
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
Object.assign(m, { id, name: name || id, port });
fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
for (const f of ['public/index.html']) {
  const p = path.join(dest, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<title>[^<]*<\/title>/, `<title>${m.name}</title>`));
}
console.log(`apps/${id} made ("${m.name}", port ${port}).
Next:
  node tools/serve.mjs ${id} --mock      the page in a browser: http://127.0.0.1:${port}/
  node tools/run.mjs ${id} --mock        the desktop app
  node tools/build.mjs ${id}             the exe (dist/)
Edit apps/${id}/app.json (window rules, settings) and apps/${id}/public/ (the page). See docs/GUIDE.md.`);
