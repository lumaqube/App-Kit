// An app as the desktop app (Electron), from the source:
//   node tools/run.mjs <app> [--mock]
// ELECTRON_RUN_AS_NODE is removed first (some shells set it; Electron would then run as plain Node).
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { KIT, appDir, args, die } from './common.mjs';

const a = args();
const dir = appDir(a._[0]);
const exe = path.join(KIT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
if (!fs.existsSync(exe)) die('Electron is not installed: run "npm install" in the kit folder first.');
const env = { ...process.env, QBK_APP: dir };
delete env.ELECTRON_RUN_AS_NODE;
const p = spawn(exe, [path.join(KIT, 'shell', 'main.js'), ...(a.mock ? ['--mock'] : [])], { env, stdio: 'inherit' });
p.on('exit', code => process.exit(code ?? 0));
