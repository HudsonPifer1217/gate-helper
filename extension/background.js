// Gate Helper service worker.
// - Opens the popups a gate asks for (SoundCloud/Instagram/YouTube). Gate pages
//   can't open them themselves: Chrome's popup blocker stops window.open calls
//   that come from scripted clicks, but an extension may open windows freely.
// - Quick mode (default): the popup loads briefly and closes, like clicking and
//   closing the tab by hand. Full mode: popup-actions.js follows/likes/etc. first.
// - Routes downloads that start right after a gate's Download click into
//   Downloads/GateDrops/ (symlinked to ~/Music/ALL MUSIC/Free Downloads by setup.sh).

const DOWNLOAD_SUBDIR = 'GateDrops';
const DOWNLOAD_WINDOW_MS = 3 * 60 * 1000;
const POPUP_TIMEOUT_MS = 45 * 1000;
const QUICK_VISIT_MS = 1200;

let nextTaskId = 1;
const tasks = new Map(); // id -> { action, tabId, windowId, gateTabId, force, waitingForUser, resolve, timer }
let downloadArmedAt = 0;
let downloadTitle = '';
let downloadTabId = null;          // gate tab to report download progress to
const gateDownloads = new Set();   // download ids we routed

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function finishTask(id, result, { closeTab = true } = {}) {
  const t = tasks.get(id);
  if (!t) return;
  tasks.delete(id);
  clearTimeout(t.timer);
  if (closeTab) chrome.tabs.remove(t.tabId).catch(() => {});
  t.resolve(result);
}

function tellGate(t, text, cls = '') {
  if (t.gateTabId != null) chrome.tabs.sendMessage(t.gateTabId, { type: 'ghLog', text, cls }).catch(() => {});
}

// Verified steps (force) that we couldn't do automatically: leave the popup open,
// let you do it there, and carry on as soon as you close it.
function handOverToUser(id, why) {
  const t = tasks.get(id);
  if (!t || t.waitingForUser) return;
  t.waitingForUser = true;
  clearTimeout(t.timer);
  chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
  tellGate(t, `Couldn’t do it automatically (${why}). Do it in the SoundCloud window, then close it — I’ll verify.`, 'warn');
}

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [id, t] of tasks) {
    if (t.tabId !== tabId) continue;
    finishTask(id, t.waitingForUser ? { ok: true, detail: 'done by you' } : { ok: false, detail: 'popup closed' }, { closeTab: false });
  }
});

async function sendTaskToTab(id, comment) {
  const t = tasks.get(id);
  const msg = { type: 'doTask', taskId: id, action: t.action, comment };
  // Keep trying until popup-actions.js is injected and answers; don't depend on
  // catching the tab's "complete" event, which can fire before we're listening.
  for (let i = 0; i < 40 && tasks.has(id); i++) {
    try { if (await chrome.tabs.sendMessage(t.tabId, msg)) return; } catch {}
    await sleep(500);
  }
}

async function openPopup({ url, action, force }, sender, sendResponse) {
  const settings = await chrome.storage.sync.get(null);
  const quick = settings.quickMode !== false;
  const host = hostOf(url);
  // `force`: the gate verifies the action (e.g. Droploud checks reposts), so do it even in quick mode.
  const scripted = (!quick || force) && action !== 'visit' && /(^|\.)(soundcloud|instagram|youtube)\.com$/.test(host);

  // Scripted popups open in front at desktop width: Chrome throttles hidden windows,
  // and SoundCloud needs the wide layout for its track header buttons.
  const win = await chrome.windows.create({ url, type: 'popup', width: scripted ? 1200 : 820, height: scripted ? 860 : 640, focused: scripted });
  const id = nextTaskId++;
  tasks.set(id, { action, tabId: win.tabs[0].id, windowId: win.id, gateTabId: sender.tab?.id, force: !!force, resolve: sendResponse,
    timer: setTimeout(() => (force ? handOverToUser(id, 'took too long') : finishTask(id, { ok: false, detail: 'popup timed out' })), POPUP_TIMEOUT_MS) });

  if (scripted) {
    sendTaskToTab(id, settings.comment || 'fire');
  } else {
    await sleep(QUICK_VISIT_MS + Math.random() * 600);
    finishTask(id, { ok: true, detail: 'opened' });
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return;
  // Dropbox share links: force direct download.
  if (Date.now() - downloadArmedAt < DOWNLOAD_WINDOW_MS && hostOf(tab.url) === 'dropbox.com') {
    const u = new URL(tab.url);
    if (u.searchParams.get('dl') === '0') { u.searchParams.set('dl', '1'); chrome.tabs.update(tabId, { url: u.toString() }); }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'openPopup') {
    // Held open until the popup has been visited (or acted on) and closed.
    openPopup(msg, sender, sendResponse).catch(e => sendResponse({ ok: false, detail: e.message }));
    return true;
  }
  if (msg.type === 'openTab') {
    // A link the gate tried to open outside a step (e.g. the download host).
    chrome.tabs.create({ url: msg.url, openerTabId: sender.tab?.id });
    return false;
  }
  if (msg.type === 'taskDone') {
    const t = tasks.get(msg.taskId);
    if (t && !msg.ok && t.force) handOverToUser(msg.taskId, msg.detail || 'unknown');
    else finishTask(msg.taskId, { ok: msg.ok, detail: msg.detail });
    return false;
  }
  if (msg.type === 'armDownload') {
    downloadArmedAt = Date.now();
    downloadTitle = msg.title || '';
    downloadTabId = sender.tab?.id ?? null;
    const armedAt = downloadArmedAt;
    setTimeout(() => {
      if (downloadArmedAt === armedAt && !gateDownloads.size) report('No download started within 20s — check for a new tab or a CAPTCHA.', 'warn');
    }, 20000);
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'openOptions') {
    chrome.runtime.openOptionsPage();
    return false;
  }
});

function sanitize(name) {
  return name.replace(/[\/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180);
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (Date.now() - downloadArmedAt > DOWNLOAD_WINDOW_MS) { suggest(); return; }
  const original = item.filename.split('/').pop();
  const ext = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
  // Hosts often name files "download.mp3" or a hash; use the gate's track title then.
  const generic = /^(download|file|track|audio|[0-9a-f-]{16,})(\s*\(\d+\))?\.[a-z0-9]+$/i.test(original);
  const base = generic && downloadTitle ? sanitize(downloadTitle) + ext : sanitize(original);
  gateDownloads.add(item.id);
  report(`Saving “${base}”…`);
  suggest({ filename: `${DOWNLOAD_SUBDIR}/${base}`, conflictAction: 'uniquify' });
});

function report(text, cls = '') {
  if (downloadTabId != null) chrome.tabs.sendMessage(downloadTabId, { type: 'ghLog', text, cls }).catch(() => {});
}

// Tell the gate tab whether the file actually landed.
chrome.downloads.onChanged.addListener(async (d) => {
  if (!gateDownloads.has(d.id) || !d.state) return;
  if (d.state.current === 'complete') {
    const [item] = await chrome.downloads.search({ id: d.id });
    report(`✔ Saved: ${item?.filename || 'done'}`, 'ok');
    gateDownloads.delete(d.id);
  } else if (d.state.current === 'interrupted') {
    const [item] = await chrome.downloads.search({ id: d.id });
    report(`Download failed: ${item?.error || 'unknown error'}`, 'err');
    gateDownloads.delete(d.id);
  }
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
