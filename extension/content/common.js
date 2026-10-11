// Shared helpers for gate-site content scripts: settings, waiting, popups, and
// the on-page progress panel. Exposes a single global: GH.

const GH = (() => {
  const DEFAULTS = {
    name: '', email: '', comment: 'fire', autoStart: false,
    sc: { follow: true, like: true, repost: true, comment: true },
    igFollow: true, ytSubscribe: true, quickMode: true,
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const jitter = (min = 600, max = 1400) => sleep(min + Math.random() * (max - min));

  async function settings() {
    const s = await chrome.storage.sync.get(null);
    return { ...DEFAULTS, ...s, sc: { ...DEFAULTS.sc, ...(s.sc || {}) } };
  }

  const visible = (el) => !!el && el.offsetParent !== null && !el.classList.contains('hide');

  async function waitFor(fn, { timeout = 15000, interval = 300 } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (state.stopped) throw new Error('stopped');
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  // React/jQuery-safe value setter.
  function setValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Click a step button. page-hook.js catches the window.open it triggers and
  // hands us the URL; background.js opens that popup (quick visit, or does the
  // action in full mode) and resolves once it's closed.
  let pendingOpen = null;
  window.addEventListener('gh-open', (e) => {
    if (pendingOpen) { pendingOpen(e.detail); pendingOpen = null; }
    else chrome.runtime.sendMessage({ type: 'openTab', url: e.detail }); // e.g. download host
  });

  async function viaPopup(button, { action, force = false }) {
    const caught = new Promise(r => { pendingOpen = r; setTimeout(() => r(null), 2000); });
    button.click();
    const url = (await caught) || button.dataset.url || (button.href?.startsWith('http') ? button.href : null);
    pendingOpen = null;
    if (!url) return { ok: false, detail: 'button did not open a link' };
    return chrome.runtime.sendMessage({ type: 'openPopup', url, action, force });
  }

  // Some steps need your own click: Chrome only opens login popups (Connect
  // SoundCloud / Spotify) from a real click, and granting access should be yours.
  function askUser(button, text) {
    button.scrollIntoView({ block: 'center', behavior: 'smooth' });
    button.style.outline = '4px solid #c6ff3d';
    button.style.outlineOffset = '3px';
    button.style.boxShadow = '0 0 0 10px rgba(198,255,61,.35)';
    log(text, 'warn');
  }

  // A visible reCAPTCHA/hCaptcha challenge needs a human. Wait for it to go away.
  function captchaShowing() {
    return [...document.querySelectorAll('iframe[src*="recaptcha/api2/bframe"], iframe[src*="recaptcha/enterprise/bframe"], iframe[src*="hcaptcha.com"]')]
      .some(f => { const r = f.getBoundingClientRect(); return r.width > 50 && r.height > 50 && getComputedStyle(f).visibility !== 'hidden'; });
  }
  async function waitOutCaptcha() {
    if (!captchaShowing()) return;
    log('CAPTCHA showing — solve it and I’ll keep going.', 'warn');
    while (captchaShowing()) { if (state.stopped) throw new Error('stopped'); await sleep(1000); }
    log('CAPTCHA cleared.');
  }

  // ---------- progress panel ----------
  const state = { stopped: false, running: false };
  let root, logEl, btn;

  function panel(onStart) {
    if (root) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        .box{font:13px/1.4 -apple-system,system-ui,sans-serif;background:#111;color:#eee;border:1px solid #333;
             border-radius:12px;width:300px;box-shadow:0 8px 30px rgba(0,0,0,.5);overflow:hidden}
        .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2a2a2a}
        .hd b{flex:1}
        button{font:600 13px system-ui;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;background:#c6ff3d;color:#111}
        button.stop{background:#333;color:#eee}
        .gear{background:none;color:#aaa;padding:4px 6px}
        .log{max-height:220px;overflow:auto;padding:8px 12px;margin:0;list-style:none}
        .log li{padding:2px 0}
        .warn{color:#ffcc4d}.err{color:#ff6b6b}.ok{color:#8be28b}
      </style>
      <div class="box">
        <div class="hd"><b>⚡ Gate Helper</b><button class="gear" title="Settings">⚙︎</button><button class="go">Get it</button></div>
        <ul class="log"></ul>
      </div>`;
    document.documentElement.appendChild(host);
    logEl = root.querySelector('.log');
    btn = root.querySelector('.go');
    root.querySelector('.gear').onclick = () => chrome.runtime.sendMessage({ type: 'openOptions' });
    btn.onclick = () => {
      if (state.running) { state.stopped = true; log('Stopping…', 'warn'); return; }
      run(onStart);
    };
  }

  async function run(onStart) {
    const s = await settings();
    if (!s.email) { log('Add your email in settings first (⚙︎).', 'err'); return; }
    state.running = true; state.stopped = false;
    document.documentElement.dataset.ghActive = '1';
    btn.textContent = 'Stop'; btn.className = 'stop';
    try { await onStart(s); }
    catch (e) { if (e.message !== 'stopped') log('Error: ' + e.message, 'err'); }
    finally { delete document.documentElement.dataset.ghActive; state.running = false; btn.textContent = 'Get it'; btn.className = 'go'; }
  }

  function log(text, cls = '') {
    if (!logEl) return console.log('[GateHelper]', text);
    const li = document.createElement('li');
    li.textContent = text; li.className = cls;
    logEl.appendChild(li); logEl.scrollTop = logEl.scrollHeight;
  }

  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'ghLog') log(msg.text, msg.cls); });

  async function boot(isGatePage, onStart) {
    if (!isGatePage()) return;
    panel(onStart);
    log('Gate detected. Press “Get it”.');
    if ((await settings()).autoStart) run(onStart);
  }

  return { sleep, jitter, settings, visible, waitFor, setValue, viaPopup, askUser, waitOutCaptcha, log, boot, state };
})();
