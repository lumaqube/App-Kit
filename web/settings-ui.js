// The operator's settings screen, built from the field list the server sends (core/settings.js):
// tabs Q-Booth / App / Screen / Security (a side menu on a landscape screen, a row on a portrait
// one), the same look as QBooth Avatar. kit.js wires it up; apps normally never touch this file.
// Open: the tray icon, Ctrl+Alt+Shift+S, S with the window focused, holding the top-left corner 3 s,
// or the Settings button on the waiting screen. With a settings PIN it is asked first.
const T = {
  en: { title: 'Settings', booth: 'Q-Booth', app: 'App', screen: 'Screen', security: 'Security', kept: 'saved (leave empty to keep)',
    test: 'Test connection', testing: 'Testing…', ok: '✓ Connected', noEvent: 'no event running',
    boothHint: 'Q-Booth: Settings → Advanced → Local API (Expert mode): switch it on, then copy its port and password here.',
    hide: 'Hide / show', clearPin: 'Remove the PIN', save: 'Save', cancel: 'Cancel', quit: 'Close the app', saving: 'Saving…',
    restarting: 'Saved, restarting…', restartManual: 'Saved. Takes effect after the app restarts.', file: 'Saved in', enterPin: 'Enter the settings PIN', wrongPin: 'Wrong PIN',
    keys: 'Ctrl+Alt+Shift+S settings · Ctrl+Alt+Shift+H hide / show · Ctrl+Alt+Shift+Q quit' },
  id: { title: 'Pengaturan', booth: 'Q-Booth', app: 'App', screen: 'Layar', security: 'Keamanan', kept: 'tersimpan (kosongkan = tetap)',
    test: 'Tes koneksi', testing: 'Mengetes…', ok: '✓ Terhubung', noEvent: 'belum ada event berjalan',
    boothHint: 'Di Q-Booth: Settings → Advanced → Local API (mode Expert): nyalakan, lalu salin port dan password-nya ke sini.',
    hide: 'Sembunyikan / tampilkan', clearPin: 'Hapus PIN', save: 'Simpan', cancel: 'Batal', quit: 'Tutup app', saving: 'Menyimpan…',
    restarting: 'Tersimpan, memulai ulang…', restartManual: 'Tersimpan. Berlaku setelah app dijalankan ulang.', file: 'Disimpan di', enterPin: 'Masukkan PIN pengaturan', wrongPin: 'PIN salah',
    keys: 'Ctrl+Alt+Shift+S pengaturan · Ctrl+Alt+Shift+H sembunyikan / tampilkan · Ctrl+Alt+Shift+Q keluar' },
  zh: { title: '设置', booth: 'Q-Booth', app: '应用', screen: '屏幕', security: '安全', kept: '已保存（留空则不变）',
    test: '测试连接', testing: '测试中…', ok: '✓ 已连接', noEvent: '没有正在运行的活动',
    boothHint: '在 Q-Booth 中：Settings → Advanced → Local API（Expert 模式）：打开，然后把端口和密码复制到这里。',
    hide: '隐藏 / 显示', clearPin: '删除 PIN', save: '保存', cancel: '取消', quit: '关闭应用', saving: '保存中…',
    restarting: '已保存，正在重启…', restartManual: '已保存。重启应用后生效。', file: '保存于', enterPin: '请输入设置 PIN 码', wrongPin: 'PIN 码错误',
    keys: 'Ctrl+Alt+Shift+S 设置 · Ctrl+Alt+Shift+H 隐藏 / 显示 · Ctrl+Alt+Shift+Q 退出' },
};
const TABS = ['booth', 'app', 'screen', 'security'];

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(k => k != null)); return e; };
const pick = (v, lang) => v == null ? '' : typeof v === 'string' ? v : (v[lang] ?? v.en ?? Object.values(v)[0] ?? '');

export function initSettings({ lang = 'en', locked = false } = {}) {
  const t = T[lang] || T.en;
  let overlay = null, pin = '';
  let root = document.getElementById('qbk-settings');
  if (!root) { root = el('div', { id: 'qbk-settings' }); document.body.append(root); }

  const peek = on => fetch('/app/peek', { method: 'POST', body: JSON.stringify({ on }) }).catch(() => { });
  function show(content) { overlay?.remove(); overlay = el('div', { className: 'set-overlay' }, content); root.append(overlay); }
  function close() { if (overlay) { overlay.remove(); overlay = null; peek(false); } }

  function askPin() {
    return new Promise(resolve => {
      const input = el('input', { type: 'password', inputMode: 'numeric', autocomplete: 'off' });
      const msg = el('div', { className: 'set-msg bad' });
      const ok = el('button', { className: 'set-primary', textContent: 'OK' });
      const cancel = el('button', { textContent: t.cancel });
      show(el('div', { className: 'set-panel set-pin' }, el('h2', { textContent: t.enterPin }), input, msg, el('div', { className: 'set-actions' }, cancel, ok)));
      ok.onclick = async () => {
        const r = await fetch('/settings/unlock', { method: 'POST', body: JSON.stringify({ pin: input.value }) });
        if (r.ok) { pin = input.value; resolve(true); } else { msg.textContent = t.wrongPin; input.select(); }
      };
      cancel.onclick = () => { close(); resolve(false); };
      input.onkeydown = e => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') cancel.click(); };
      input.focus();
    });
  }

  async function open() {
    if (overlay) return;
    await peek(true);
    if (locked && !(await askPin())) return;
    const r = await fetch('/settings', { headers: { 'x-settings-pin': pin } });
    if (!r.ok) { close(); peek(false); return; }
    show(form(await r.json()));
  }

  function form(s) {
    const v = s.values, read = {};
    const row = (label, input, hint) => el('label', { className: 'set-row' },
      el('span', { className: 'set-label', textContent: label }), input, hint ? el('small', { textContent: hint }) : null);

    function control(f) {
      const k = f.key;
      if (f.type === 'bool') { const i = el('input', { type: 'checkbox', checked: !!v[k] }); read[k] = () => i.checked; return i; }
      if (f.type === 'enum') { const i = el('select', {}, ...f.options.map(([val, label]) => el('option', { value: String(val), textContent: pick(label, lang) || String(val), selected: String(v[k]) === String(val) }))); read[k] = () => i.value; return i; }
      if (f.type === 'display') {
        if (!(s.displays?.length > 1)) return null;
        const i = el('select', {}, ...s.displays.map(d => el('option', { value: String(d.index), textContent: d.label, selected: String(v[k]) === String(d.index) })));
        read[k] = () => i.value; return i;
      }
      if (f.type === 'range') {
        const i = el('input', { type: 'range', min: 0, max: 100, value: v[k] ?? 50 }), out = el('b', { textContent: i.value });
        i.oninput = () => { out.textContent = i.value; };
        read[k] = () => i.value; return el('div', { className: 'set-inline' }, i, out);
      }
      if (f.type === 'secret') {
        const i = el('input', { type: 'password', autocomplete: 'off', placeholder: s.has[k] ? t.kept : '' });
        read[k] = () => i.value; return i;
      }
      const i = el('input', { type: f.type === 'int' ? 'number' : 'text', value: v[k] ?? '', min: f.min ?? '', max: f.max ?? '' });
      read[k] = () => i.value; return i;
    }

    const groups = Object.fromEntries(TABS.map(tab => [tab, []]));
    const inputs = {};
    for (const f of s.fields) {
      const c = control(f);
      if (!c) continue;
      inputs[f.key] = c;
      (groups[f.tab] || groups.app).push(row(pick(f.label, lang) || f.key, c, pick(f.hint, lang)));
    }

    // Q-Booth tab: a hint first, a connection test under the password
    const testMsg = el('span', { className: 'set-msg' });
    const testBtn = el('button', { type: 'button', textContent: t.test });
    testBtn.onclick = async () => {
      testMsg.className = 'set-msg'; testMsg.textContent = t.testing;
      const body = { host: inputs['qbooth.host']?.value, port: inputs['qbooth.port']?.value, password: inputs['qbooth.password']?.value };
      const r = await (await fetch('/settings/test', { method: 'POST', headers: { 'x-settings-pin': pin }, body: JSON.stringify(body) })).json();
      testMsg.className = 'set-msg ' + (r.ok ? 'good' : 'bad');
      testMsg.textContent = r.ok ? `${t.ok} · ${r.event ? r.event.name : t.noEvent}` : `✗ ${r.error?.code}${r.error?.message && r.error.message !== r.error.code ? ' (' + r.error.message + ')' : ''}`;
    };
    const passRow = groups.booth.findIndex(r => r.contains(inputs['qbooth.password']));
    groups.booth.splice(passRow + 1, 0, el('div', { className: 'set-row' }, el('span'), el('div', { className: 'set-inline' }, testBtn, testMsg)));
    groups.booth.unshift(el('small', { className: 'set-note', textContent: t.boothHint }));
    // Screen tab: hide / show and the keys
    const hideBtn = el('button', { type: 'button', textContent: t.hide });
    hideBtn.onclick = () => { close(); fetch('/app/hide', { method: 'POST', headers: { 'x-settings-pin': pin } }); };
    groups.screen.push(el('div', { className: 'set-row' }, el('span'), el('div', { className: 'set-inline' }, hideBtn)), el('small', { className: 'set-note', textContent: t.keys }));
    // Security tab: remove the PIN
    const clearPin = el('input', { type: 'checkbox' });
    if (s.has.settingsPin) groups.security.push(row(t.clearPin, clearPin));
    const pinRead = read.settingsPin;
    read.settingsPin = () => clearPin.checked ? null : pinRead();

    const tabName = { booth: t.booth, app: s.app?.name || t.app, screen: t.screen, security: t.security };
    const sections = TABS.filter(tab => groups[tab].length).map(tab => el('fieldset', {}, el('legend', { textContent: tabName[tab] }), ...groups[tab]));
    const nav = el('nav', { className: 'set-tabs' });
    const tabBtns = sections.map((fs, i) => { const b = el('button', { type: 'button', textContent: fs.querySelector('legend').textContent }); b.onclick = () => openTab(i); return b; });
    nav.append(...tabBtns);
    const pages = el('div', { className: 'set-pages' }, ...sections);
    function openTab(i) {
      sections.forEach((fs, k) => { fs.hidden = k !== i; tabBtns[k].classList.toggle('on', k === i); });
      pages.scrollTop = 0;
      try { sessionStorage.setItem('qbk.setTab', String(i)); } catch { }
    }
    let first = 0;
    try { first = Math.min(sections.length - 1, +sessionStorage.getItem('qbk.setTab') || 0); } catch { }
    openTab(first);

    const msg = el('div', { className: 'set-msg' });
    const save = el('button', { className: 'set-primary', textContent: t.save });
    const cancel = el('button', { textContent: t.cancel });
    const quit = el('button', { type: 'button', textContent: t.quit });
    cancel.onclick = close;
    quit.onclick = () => fetch('/app/quit', { method: 'POST', headers: { 'x-settings-pin': pin } });
    save.onclick = async () => {
      const changes = {};
      for (const f of s.fields) {
        if (!read[f.key]) continue;
        const now = read[f.key]();
        if (f.type === 'secret') { if (now === null || now) changes[f.key] = now; continue; }
        if (String(now) !== String(v[f.key] ?? '')) changes[f.key] = now;
      }
      save.disabled = true; msg.className = 'set-msg'; msg.textContent = t.saving;
      const r = await (await fetch('/settings', { method: 'POST', headers: { 'x-settings-pin': pin }, body: JSON.stringify(changes) })).json();
      if (!r.ok) { msg.className = 'set-msg bad'; msg.textContent = '✗ ' + (r.error?.message || r.error?.code); save.disabled = false; return; }
      if (r.restart) { msg.textContent = t.restarting; return; }
      if (r.restartNeeded) { msg.textContent = t.restartManual; setTimeout(() => location.reload(), 2500); return; }
      location.reload();
    };

    return el('div', { className: 'set-panel tabbed' },
      el('h2', { textContent: '⚙ ' + t.title + (s.app?.name ? ' · ' + s.app.name : '') }),
      nav, pages, msg,
      el('div', { className: 'set-actions' }, el('small', { className: 'set-file', textContent: `${t.file}: ${s.file}` }), s.desktop ? quit : null, cancel, save));
  }

  return { open, close, isOpen: () => !!overlay };
}
