// Which booth app is this, and where is it installed? The booth app comes in brand builds with
// different exe names and install folders:
//   QBooth.exe (product "QBooth", default folder C:\QBoothAIV5) · BleepShare.exe ("BleepShareAI",
//   C:\BleepShareV5) · XBooth.exe ("XBooth", C:\XBoothV5)
// so nothing here guesses a name. The process that LISTENS on the Local API port is the booth app:
// its pid (to raise its event window), its exe and its folder (<folder>\events holds the event
// files and covers). Only for a booth on this PC (host 127.0.0.1 / localhost); Windows only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const BRAND_EXES = ['QBooth', 'BleepShare', 'XBooth'];
export const FOLDER_GUESSES = ['C:\\QBoothPro', 'C:\\QBoothAIV5', 'C:\\BleepShareV5', 'C:\\XBoothV5', 'C:\\QBoothAI'];

// The product name the Local API reports (status.app.name) as people write it.
export function brandName(appName) {
  const n = String(appName || '').replace(/\s*\(mock\)\s*$/i, '').trim();
  if (!n) return null;
  return n === 'QBooth' ? 'Q-Booth' : n;
}

const isLocal = host => ['127.0.0.1', 'localhost', '::1', ''].includes(String(host || '').toLowerCase());

// { pid, exe, dir } of the process listening on `port`, or null. About a second (PowerShell).
export function locateBooth(host, port) {
  if (process.platform !== 'win32' || !isLocal(host)) return Promise.resolve(null);
  const ps = `$c = Get-NetTCPConnection -State Listen -LocalPort ${+port} -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
    `if ($c) { $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; if ($p) { "$($p.Id)|$($p.Path)" } }`;
  return new Promise(resolve => {
    let out = '';
    const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true });
    const t = setTimeout(() => p.kill(), 15000);
    p.stdout.on('data', d => { out += d; });
    p.on('error', () => { clearTimeout(t); resolve(null); });
    p.on('close', () => {
      clearTimeout(t);
      const [pid, exe] = out.trim().split('|');
      resolve(+pid && exe ? { pid: +pid, exe, dir: path.dirname(exe) } : null);
    });
  });
}

// The booth app's folder for covers: the setting when given, else the located app's folder,
// else the first usual install folder that has an events folder.
export function resolveBoothDir(setting, located) {
  if (setting) return setting;
  if (located?.dir && fs.existsSync(path.join(located.dir, 'events'))) return located.dir;
  return FOLDER_GUESSES.find(d => fs.existsSync(path.join(d, 'events'))) || FOLDER_GUESSES[0];
}
