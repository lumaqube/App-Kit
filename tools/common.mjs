// Shared bits of the tools.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APPS = path.join(KIT, 'apps');

// "hello" -> <kit>/apps/hello (or a path to an app folder)
export function appDir(nameOrPath) {
  if (!nameOrPath) die('Which app? e.g. hello (a folder in apps/)');
  const p = fs.existsSync(path.join(APPS, nameOrPath, 'app.json')) ? path.join(APPS, nameOrPath) : path.resolve(nameOrPath);
  if (!fs.existsSync(path.join(p, 'app.json'))) die(`No app.json in ${p}. Apps: ${listApps().join(', ') || '(none yet: node tools/new-app.mjs <id> "<Name>")'}`);
  return p;
}

export function listApps() {
  try { return fs.readdirSync(APPS).filter(d => fs.existsSync(path.join(APPS, d, 'app.json'))); } catch { return []; }
}

export function die(msg) { console.error(msg); process.exit(1); }

// --name value / --flag
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; } }
    else out._.push(a);
  }
  return out;
}
