// The desktop shell, the same for every app: one exe that runs the app's server (core/server.js)
// and shows its page in a frameless full-screen window.
//   dev:       node tools/run.mjs <app> [--mock]   (QBK_APP = apps/<app>)
//   packaged:  "<App Name>.exe" [--mock]           (the app sits in resources/app/app, see tools/build.mjs)
// Window modes (from the server, rules in app.json "window"):
//   full   the app, full screen; in overlay mode on top of Q-Booth's event screen
//   setup  not connected to Q-Booth yet: a normal window in the middle saying why (with Settings)
//   hidden Q-Booth's own pages, no event, or a Q-Booth dialog: Q-Booth's event window is raised
// A tray icon has Settings / Hide-show / Quit; opening the exe again opens Settings.
// Secret keys, from anywhere: Ctrl+Alt+Shift+S settings · Ctrl+Alt+Shift+H hide / show · Ctrl+Alt+Shift+Q quit.
// With the window focused: F12 developer tools, Ctrl+Q quit.
import { app, BrowserWindow, screen, dialog, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFront, raiseQBooth, raiseSelf, stopFront } from './winfront.js';

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = process.env.QBK_APP ? path.resolve(process.env.QBK_APP) : path.join(KIT, 'app');
// config.json and logs next to the exe when packaged (the app folder is replaced on an update)
if (app.isPackaged) process.env.QBK_CONFIG_DIR = path.dirname(process.execPath);
const DATA_DIR = process.env.QBK_CONFIG_DIR || APP_DIR;
const { createAppServer, readManifest } = await import('../core/server.js');
const manifest = readManifest(APP_DIR);
app.setName(manifest.name);

// No console in the packaged app: messages go to logs/app.log.
fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true });
const logPath = path.join(DATA_DIR, 'logs', 'app.log');
for (const level of ['log', 'warn', 'error']) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    try { fs.appendFileSync(logPath, `${new Date().toISOString().slice(11, 23)} [${process.pid}] ${args.join(' ')}\n`); } catch { }
    orig(...args);
  };
}
console.log(`--- start ${manifest.name}`);

async function getLock() {
  const tries = process.argv.includes('--relaunch') ? 80 : 1; // our own restart waits for the old copy
  for (let i = 0; i < tries; i++) {
    if (app.requestSingleInstanceLock()) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

function restart() {
  const args = process.argv.slice(1).filter(a => a !== '--mock' && a !== '--relaunch').concat('--relaunch');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(process.execPath, args, { detached: true, stdio: 'ignore', env }).unref();
  app.quit();
}

if (!(await getLock())) {
  app.quit(); // already running: that copy opens its settings (second-instance)
} else {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); // sound without a first tap
  let win = null, tray = null, server = null;

  app.whenReady().then(async () => {
    const primary = screen.getPrimaryDisplay();
    let mode = 'setup', ready = false, box = primary.bounds, overlay = true;
    const page = js => win && !win.isDestroyed() && win.webContents.executeJavaScript(js).catch(() => { });
    const openSettings = () => page('window.__qbk?.settings()');
    const iconFile = [path.join(APP_DIR, 'icon.png'), path.join(KIT, 'shell', 'icon.png')].find(f => fs.existsSync(f));

    const applyMode = () => {
      if (!win || win.isDestroyed() || !ready) return;
      if (mode === 'hidden') {
        // hand the screen back: Q-Booth's event window first, or the window that was in front before would show
        if (win.isVisible()) { if (overlay) raiseQBooth(); setTimeout(() => { if (mode === 'hidden' && win && !win.isDestroyed()) win.hide(); }, 150); }
      } else if (mode === 'full') {
        win.setAlwaysOnTop(overlay, 'screen-saver');
        win.setBounds(box);
        if (!win.isVisible()) win.show();
        win.focus();
        if (overlay) raiseSelf(win);
      } else {
        win.setAlwaysOnTop(false);
        const w = Math.min(1100, Math.round(box.width * 0.7)), h = Math.min(720, Math.round(box.height * 0.75));
        win.setBounds({ x: box.x + Math.round((box.width - w) / 2), y: box.y + Math.round((box.height - h) / 2), width: w, height: h });
        if (!win.isVisible()) win.show();
      }
      page(`window.__qbk?.shown(${mode !== 'hidden'})`);
    };

    try {
      server = await createAppServer({ appDir: APP_DIR, mock: process.argv.includes('--mock') || undefined });
      server.setHooks({
        restart, quit: () => app.quit(), desktop: true,
        displays: screen.getAllDisplays().map((d, i) => ({ index: i, label: `${i + 1}: ${d.size.width}×${d.size.height}${d.id === primary.id ? ' (main)' : ''}` })),
        visible: (m, text) => { mode = m; console.log(`window: ${m} (${text})`); applyMode(); tray?.setToolTip(`${manifest.name} · ${text}`); },
      });
      await server.start();
    } catch (err) {
      dialog.showErrorBox(manifest.name, err.message);
      app.quit();
      return;
    }
    const cfg = server.cfg;
    overlay = !!cfg.overlay;
    box = (screen.getAllDisplays()[cfg.display ?? 0] || primary).bounds;

    win = new BrowserWindow({
      ...box, show: false, frame: false, resizable: false, hasShadow: true,
      backgroundColor: manifest.window.background || '#1b1f3a', title: manifest.name,
      icon: iconFile, webPreferences: { backgroundThrottling: false },
    });
    win.setMenu(null);
    if (overlay) {
      // Q-Booth raises its kiosk window when an event opens: take the top back while showing
      setInterval(() => {
        if (!win || win.isDestroyed() || !win.isVisible() || mode !== 'full') return;
        const b = win.getBounds();
        if (b.x !== box.x || b.y !== box.y || b.width !== box.width || b.height !== box.height) win.setBounds(box);
        win.setAlwaysOnTop(true, 'screen-saver');
        win.moveTop();
      }, 1500);
      startFront();
    }
    console.log(`screen: ${box.width}x${box.height} at ${box.x},${box.y}, ${overlay ? 'overlay' : 'window'} mode`);

    tray = new Tray(nativeImage.createFromPath(iconFile).resize({ width: 16, height: 16 }));
    tray.setToolTip(`${manifest.name} · ${server.statusText()}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Settings', click: openSettings },
      { label: 'Hide / show', click: () => server.toggleHidden() },
      { type: 'separator' },
      { label: `Quit ${manifest.name}`, click: () => app.quit() },
    ]));
    tray.on('click', openSettings);

    globalShortcut.register('Control+Alt+Shift+S', openSettings);
    globalShortcut.register('Control+Alt+Shift+H', () => server.toggleHidden());
    globalShortcut.register('Control+Alt+Shift+Q', () => app.quit());
    app.on('second-instance', openSettings);
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
      else if (input.control && input.key.toLowerCase() === 'q') { app.quit(); e.preventDefault(); }
    });
    win.on('closed', () => { win = null; app.quit(); });
    win.once('ready-to-show', () => {
      ready = true;
      applyMode();
      if (overlay) tray.displayBalloon?.({ title: `${manifest.name} is running`, content: 'It appears on top of Q-Booth when an event shows the right page. Settings: this icon, or Ctrl+Alt+Shift+S.' });
    });
    const wc = win.webContents;
    wc.on('render-process-gone', (e, d) => { console.error(`page process gone: ${d.reason}, reloading`); setTimeout(() => win?.reload(), 1000); });
    wc.on('did-fail-load', () => setTimeout(() => win?.loadURL(`http://127.0.0.1:${cfg.port}/`), 1500));
    wc.on('console-message', e => { if (e.level === 'error' || e.level === 'warning') console.error(`page ${e.level}: ${e.message} (${e.sourceId}:${e.lineNumber})`); });
    win.loadURL(`http://127.0.0.1:${cfg.port}/`);
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    tray?.destroy();
    stopFront();
    server?.stop();
    app.releaseSingleInstanceLock();
    const helpers = app.getAppMetrics().map(m => m.pid).filter(pid => pid !== process.pid);
    for (const pid of helpers) try { process.kill(pid); } catch { }
    process.kill(process.pid);
  });
}
