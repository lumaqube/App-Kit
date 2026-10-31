// The always-on-top menu button: a small round window of its own in a corner of the screen,
// above everything (Q-Booth's kiosk window and the app's own overlay included), visible in every
// window mode, also while the app is hidden. A tap opens the settings (the PIN first, when set).
// Settings: menuButton (on / off), menuCorner (top-left | top-right | bottom-left | bottom-right).
//   const fab = createFab({ url, onTap });  fab.update({ on, corner, box });  fab.raise();  fab.destroy();
// url: a page of the app's server showing the button (it POSTs /app/menu on a tap).
import { BrowserWindow } from 'electron';

const SIZE = 64, MARGIN = 18;

export function createFab({ url }) {
  let win = null, state = { on: false, corner: 'top-right', box: null };

  function place() {
    if (!win || !state.box) return;
    const b = state.box, [v, h] = state.corner.split('-');
    const x = h === 'left' ? b.x + MARGIN : b.x + b.width - SIZE - MARGIN;
    const y = v === 'top' ? b.y + MARGIN : b.y + b.height - SIZE - MARGIN;
    win.setBounds({ x, y, width: SIZE, height: SIZE });
  }

  function make() {
    win = new BrowserWindow({
      width: SIZE, height: SIZE, show: false, frame: false, transparent: true, resizable: false, movable: false,
      skipTaskbar: true, hasShadow: false, alwaysOnTop: true, focusable: false, minimizable: false, maximizable: false,
      backgroundColor: '#00000000', title: 'Menu',
    });
    win.setMenu(null);
    win.setAlwaysOnTop(true, 'screen-saver', 1); // one level above the app's own overlay
    win.on('closed', () => { win = null; });
    win.loadURL(url);
    win.once('ready-to-show', () => { place(); if (state.on) win.showInactive(); });
  }

  return {
    update(next) {
      state = { ...state, ...next };
      if (!['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(state.corner)) state.corner = 'top-right';
      if (state.on) {
        if (!win) make();
        else { place(); if (!win.isVisible()) win.showInactive(); }
      } else if (win?.isVisible()) win.hide();
    },
    // after the overlay re-asserts itself on top: the button stays above it
    raise() { if (win && state.on && win.isVisible()) { win.setAlwaysOnTop(true, 'screen-saver', 1); win.moveTop(); } },
    destroy() { try { win?.destroy(); } catch { } win = null; },
  };
}
