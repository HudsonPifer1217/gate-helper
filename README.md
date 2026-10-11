# Gate Helper

Chrome extension that clicks through Hypeddit and Droploud free-download gates for you:
fills your name/email, follows/likes/reposts/comments on SoundCloud, handles Instagram and
YouTube steps, and saves the file to `~/Music/ALL MUSIC/Free Downloads`.

## Install

1. Run `./setup.sh` once (links `~/Downloads/GateDrops` → `ALL MUSIC/Free Downloads`).
2. Chrome → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick the `extension/` folder.
3. The settings page opens: enter your name and email, Save.
4. Make sure you're logged in to SoundCloud (and Instagram/YouTube if you want those steps automated) in this Chrome profile.

## Use

Open a gate page. A **⚡ Gate Helper** panel appears bottom-right; press **Get it**.
(Or tick "Start automatically" in settings.)

It stops and tells you when a human is needed: CAPTCHAs, and the first-time
"Connect with Spotify/SoundCloud" approval popups.

After editing code: `chrome://extensions` → Gate Helper → reload ↻, then refresh the gate page.

## Layout

- `extension/content/hypeddit.js`, `droploud.js` — one adapter per gate site
- `extension/content/popup-actions.js` — does the follow/like/repost/comment inside popups
- `extension/background.js` — matches popups to tasks, closes them, routes downloads
- `extension/content/common.js` — shared helpers + on-page panel
