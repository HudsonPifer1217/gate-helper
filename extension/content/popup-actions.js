// Runs inside popups that a gate opened (SoundCloud / Instagram / YouTube).
// Does nothing on normal browsing: it only acts when background.js sends a
// doTask message for this specific tab.

(() => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const visible = (el) => !!el && el.offsetParent !== null;

  async function waitFor(fn, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(300); }
    return null;
  }

  function setValue(input, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---------- SoundCloud ----------
  const scLoggedOut = () => visible(document.querySelector('.header__loginMenu, button.loginButton, .frontHero__loginButton'));
  // "On" = SoundCloud marks the button selected, or it already reads Reposted/Liked/Following.
  const selected = (b) => b.classList.contains('sc-button-selected') ||
    /^(reposted|liked|following)$/i.test((b.textContent || '').trim()) || /^un(repost|like|follow)/i.test(b.title || '');

  async function toggleOn(selector, label) {
    const b = await waitFor(() => [...document.querySelectorAll(selector)].find(visible));
    if (!b) return `${label}: button not found`;
    if (selected(b)) return null; // already done — clicking again would undo it
    b.click();
    await sleep(1000);
    if (!selected(b)) {
      // Newer UI can open a menu or confirm box ("Repost" / "Repost with caption").
      const item = [...document.querySelectorAll('button, a, [role=menuitem]')].find(e =>
        e !== b && visible(e) && e.textContent.trim().toLowerCase() === label &&
        e.closest('.modal, [role=dialog], .dropdownMenu, [role=menu], .sc-overlay'));
      item?.click();
      await waitFor(() => selected(b), 4000);
    }
    return selected(b) ? null : `${label}: click did not stick`;
  }

  const sc = {
    follow: () => toggleOn('.userInfoBar .sc-button-follow, .profileHeader .sc-button-follow, .sc-button-follow', 'follow'),
    like: () => toggleOn('.listenEngagement .sc-button-like', 'like'),
    repost: () => toggleOn('.listenEngagement .sc-button-repost', 'repost'),
    async comment(text) {
      const input = await waitFor(() => document.querySelector('.listenEngagement .commentForm__input'));
      if (!input) return 'comment: box not found';
      input.focus();
      input.click();
      setValue(input, text);
      await sleep(500);
      const submit = input.closest('form, .commentForm')?.querySelector('.commentForm__submitButton');
      if (submit && !submit.disabled) submit.click();
      else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      await sleep(1200);
      return input.value ? 'comment: not submitted' : null;
    },
  };

  async function soundcloud(actions, comment) {
    await waitFor(() => document.querySelector('.sc-button-follow, .listenEngagement'));
    if (scLoggedOut()) return { ok: false, detail: 'log in to SoundCloud in this Chrome profile' };
    const problems = [];
    for (const a of actions) {
      if (!sc[a]) continue;
      const err = await sc[a](comment);
      if (err) problems.push(err);
      await sleep(500 + Math.random() * 700);
    }
    return problems.length ? { ok: false, detail: problems.join('; ') } : { ok: true };
  }

  // ---------- Instagram ----------
  async function instagramFollow() {
    const b = await waitFor(() => [...document.querySelectorAll('header button, main header [role=button]')]
      .find(e => visible(e) && /^(follow|follow back|following|requested)$/i.test(e.textContent.trim())));
    if (!b) return { ok: false, detail: 'Instagram follow button not found (logged in?)' };
    if (/^follow( back)?$/i.test(b.textContent.trim())) { b.click(); await sleep(1500); }
    return { ok: true };
  }

  // ---------- YouTube ----------
  async function youtubeSubscribe() {
    const confirm = await waitFor(() => document.querySelector(
      'yt-confirm-dialog-renderer #confirm-button button, ytd-confirm-dialog-renderer #confirm-button button'), 8000);
    if (confirm) { confirm.click(); await sleep(1500); return { ok: true }; }
    const b = [...document.querySelectorAll('#subscribe-button button, yt-subscribe-button-view-model button')]
      .find(e => visible(e));
    if (!b) return { ok: false, detail: 'YouTube subscribe button not found' };
    if (/^subscribe$/i.test(b.textContent.trim())) { b.click(); await sleep(1500); }
    return { ok: true };
  }

  let handled = null;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'doTask') return;
    sendResponse(true); // ack, so background.js stops resending
    if (handled === msg.taskId) return;
    handled = msg.taskId;
    (async () => {
      let result;
      try {
        if (msg.action === 'igFollow') result = await instagramFollow();
        else if (msg.action === 'ytSubscribe') result = await youtubeSubscribe();
        else result = await soundcloud(msg.action.split('+'), msg.comment);
      } catch (e) {
        result = { ok: false, detail: e.message };
      }
      chrome.runtime.sendMessage({ type: 'taskDone', taskId: msg.taskId, ...result });
    })();
  });
})();
