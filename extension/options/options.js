// Settings page: reads/writes chrome.storage.sync. Keep DEFAULTS in sync with content/common.js.
const DEFAULTS = {
  name: '', email: '', comment: 'fire', autoStart: false,
  sc: { follow: true, like: true, repost: true, comment: true },
  igFollow: true, ytSubscribe: true, quickMode: true,
};

const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.sync.get(null);
  const v = { ...DEFAULTS, ...s, sc: { ...DEFAULTS.sc, ...(s.sc || {}) } };
  for (const k of ['name', 'email', 'comment']) $(k).value = v[k];
  for (const k of ['igFollow', 'ytSubscribe', 'autoStart', 'quickMode']) $(k).checked = v[k];
  for (const k of Object.keys(DEFAULTS.sc)) $(`sc.${k}`).checked = v.sc[k];
}

async function save() {
  const sc = {};
  for (const k of Object.keys(DEFAULTS.sc)) sc[k] = $(`sc.${k}`).checked;
  await chrome.storage.sync.set({
    name: $('name').value.trim(),
    email: $('email').value.trim(),
    comment: $('comment').value.trim() || 'fire',
    igFollow: $('igFollow').checked,
    ytSubscribe: $('ytSubscribe').checked,
    autoStart: $('autoStart').checked,
    quickMode: $('quickMode').checked,
    sc,
  });
  $('saved').style.opacity = 1;
  setTimeout(() => ($('saved').style.opacity = 0), 1500);
}

$('save').addEventListener('click', save);
load();
