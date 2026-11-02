// Which booth app is this? It comes in brand builds with different exe names:
//   QBooth.exe (product "QBooth") · BleepShare.exe ("BleepShareAI") · XBooth.exe ("XBooth")
// so nothing here guesses a name. The process that LISTENS on the Local API port is the booth app:
// its pid (to raise its event window) and its exe. Only for a booth on this PC (host 127.0.0.1 /
// localhost); Windows only. Its files are never read: covers and results come from the Local API.
import { spawn } from 'node:child_process';
import path from 'node:path';

export const BRAND_EXES = ['QBooth', 'BleepShare', 'XBooth'];

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
