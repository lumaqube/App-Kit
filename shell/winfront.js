// Brings a window to the front on Windows: Q-Booth's event (kiosk) window when the wheel hides,
// our own window when it comes back. Electron cannot raise another app's window, so one
// PowerShell process stays open with a few user32 calls compiled once (a new PowerShell per call
// would take a second or more); each request is one line on its stdin:
//   qbooth        -> the event window of QBooth.exe (its biggest visible window that is not the
//                    main "QBooth - Version ..." window), restored, foreground, top
//   self <hwnd>   -> that window (ours), foreground, top
// Windows only lets the foreground app hand the foreground over: the call joins the input of
// the current foreground thread first (AttachThreadInput), the usual way around that.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Diagnostics;
public static class Front {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool on);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  struct RECT { public int L, T, R, B; }

  public static string Raise(IntPtr h) {
    if (h == IntPtr.Zero) return "none";
    if (IsIconic(h)) ShowWindow(h, 9); // SW_RESTORE
    uint pid;
    uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out pid), me = GetCurrentThreadId();
    bool joined = fg != me && AttachThreadInput(me, fg, true);
    SetForegroundWindow(h); BringWindowToTop(h);
    if (joined) AttachThreadInput(me, fg, false);
    if (GetForegroundWindow() != h) { // still refused: a tap of Alt unlocks it
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
      SetForegroundWindow(h); BringWindowToTop(h);
    }
    return GetForegroundWindow() == h ? "ok" : "refused";
  }

  public static string QBooth() {
    IntPtr best = IntPtr.Zero; long area = 0;
    foreach (var p in Process.GetProcessesByName("QBooth")) {
      uint want = (uint)p.Id;
      EnumWindows((h, l) => {
        uint pid; GetWindowThreadProcessId(h, out pid);
        if (pid != want || !IsWindowVisible(h)) return true;
        var s = new StringBuilder(256); GetWindowText(h, s, 256);
        if (s.ToString().StartsWith("QBooth - Version")) return true; // the editor / main window
        RECT r; GetWindowRect(h, out r);
        long a = (long)(r.R - r.L) * (r.B - r.T);
        if (a > area) { area = a; best = h; }
        return true;
      }, IntPtr.Zero);
    }
    return Raise(best);
  }
}
"@
"ready"
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $p = $line.Trim() -split ' '
  if ($p[0] -eq 'qbooth') { "qbooth " + [Front]::QBooth() }
  elseif ($p[0] -eq 'self') { "self " + [Front]::Raise([IntPtr][long]$p[1]) }
}
`;

let ps = null;
function helper() {
  if (ps && ps.exitCode === null) return ps;
  // a script file (stdin stays free for the requests)
  const file = path.join(os.tmpdir(), 'qboothkit-front.ps1');
  fs.writeFileSync(file, SCRIPT);
  ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  ps.stdout.on('data', d => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) console.log('front: ' + l.trim()); });
  ps.on('error', err => console.error('front: ' + err.message));
  return ps;
}

export function startFront() { if (process.platform === 'win32') helper(); }
export function raiseQBooth() { if (process.platform === 'win32') helper().stdin.write('qbooth\n'); }
export function raiseSelf(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  const h = win.getNativeWindowHandle();
  const hwnd = h.length >= 8 ? h.readBigUInt64LE(0) : BigInt(h.readUInt32LE(0));
  helper().stdin.write(`self ${hwnd}\n`);
}
export function stopFront() { try { ps?.stdin.end(); ps?.kill(); } catch { } }
