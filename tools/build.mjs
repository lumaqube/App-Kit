// The exe of one app: node tools/build.mjs <app>   ->  dist/<App Name>-win32-x64/<App Name>.exe
// Stages the kit (core, shell, web) + the app (as app/) into .stage/<id>, then runs
// @electron/packager on it (--no-asar: plain files, patchable in resources/app). config.json and
// logs are never copied in: the packaged app keeps them next to its exe.
// Icon: <app>/icon.ico (+ icon.png for the tray) when present, else the kit's.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KIT, appDir, args, die } from './common.mjs';

const a = args();
const dir = appDir(a._[0]);
const m = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8'));
const stage = path.join(KIT, '.stage', m.id);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
const skip = src => !/[\\/](config\.json|logs|node_modules|\.git)$/.test(src);
for (const d of ['core', 'shell', 'web']) fs.cpSync(path.join(KIT, d), path.join(stage, d), { recursive: true, filter: skip });
fs.cpSync(dir, path.join(stage, 'app'), { recursive: true, filter: skip });
const electronVersion = JSON.parse(fs.readFileSync(path.join(KIT, 'node_modules', 'electron', 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: m.id, productName: m.name, version: m.version || '0.1.0', description: m.description || m.name,
  private: true, type: 'module', main: 'shell/main.js',
}, null, 2));

const icon = fs.existsSync(path.join(dir, 'icon.ico')) ? path.join(dir, 'icon.ico') : path.join(KIT, 'shell', 'icon.ico');
let packager;
try { ({ packager } = await import(pathToFileURL(path.join(KIT, 'node_modules', '@electron', 'packager', 'dist', 'index.js')).href)); }
catch { die('@electron/packager is not installed: run "npm install" in the kit folder first.'); }
try {
  const [out] = await packager({ dir: stage, name: m.name, platform: 'win32', arch: 'x64', electronVersion, out: path.join(KIT, 'dist'), overwrite: true, asar: false, icon });
  console.log(`built: ${path.relative(KIT, out)}\\${m.name}.exe`);
} catch (err) { die('packager failed: ' + err.message); }
finally { fs.rmSync(stage, { recursive: true, force: true }); }
