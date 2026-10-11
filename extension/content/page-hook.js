// Runs in the gate page's own JS world (manifest "world": "MAIN").
// While Gate Helper is running (html[data-gh-active="1"]), window.open calls are
// handed to the extension instead of hitting Chrome's popup blocker, and the page
// gets a stand-in window object so its own "step done" bookkeeping still runs.

(() => {
  const realOpen = window.open;
  window.open = function (url, ...rest) {
    // Real clicks by you (e.g. "Connect SoundCloud" logins) open normally, so the
    // popup keeps its link back to this page.
    const byUser = window.event && window.event.isTrusted;
    if (byUser || document.documentElement.dataset.ghActive !== '1' || !url) return realOpen.call(this, url, ...rest);
    const abs = new URL(url, location.href).href;
    window.dispatchEvent(new CustomEvent('gh-open', { detail: abs }));
    return { closed: false, focus() {}, blur() {}, close() { this.closed = true; }, location: { href: abs }, document: {} };
  };
})();
