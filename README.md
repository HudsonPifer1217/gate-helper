# ⚡ Gate Helper

A Chrome extension for DJs that clicks through **Hypeddit** and **Droploud** free-download gates for you.

Open a gate, press **Get it**, and it:

- fills in your name and email
- clicks through the SoundCloud, Instagram and YouTube steps
- clicks **Download** at the end

What used to be a dozen clicks per track becomes one or two.

---

## What it does on each site

### Hypeddit
| Step | What Gate Helper does |
|---|---|
| Email | Fills your name + email and continues |
| SoundCloud (follow / like / comment / repost) | Opens each popup for ~1 second and closes it (**Quick mode**) |
| Instagram / YouTube | Same: opens the link briefly and closes it |
| Spotify "Connect" | Highlights the button for **you** to click (Chrome only allows login popups from a real click) |
| Download | Clicks it. Chrome then saves the file (see [Where files go](#where-files-go)) |

### Droploud
| Step | What Gate Helper does |
|---|---|
| Instagram follow | Opens the link briefly, then clicks "I did it →" |
| "Connect SoundCloud" | Types your comment, then highlights **Connect SoundCloud** for you to click. Droploud then follows/likes/reposts/comments **for real** from your account. That's how Droploud works, so it can't be skipped. |
| "Repost on SoundCloud" (verified) | Droploud checks that the repost really happened, so Gate Helper opens the track and **actually reposts it**, then clicks "I reposted, verify". If it can't, it tells you to repost in that window and close it, and it verifies for you. |
| Download | Clicks it |

> **Quick mode** (on by default) only opens and closes popups; Hypeddit only checks that you clicked each button. Turn it off in settings if you'd rather Gate Helper actually follow, like, repost and comment on SoundCloud for every gate.

---

## Install (about 2 minutes)

You need **Google Chrome** (Brave, Arc and Edge should work too) on a **Mac**. The setup script is for macOS; on Windows, skip step 2.

### 1. Download the code
On this GitHub page, click the green **Code** button → **Download ZIP**, then unzip it somewhere permanent (e.g. `~/Projects/gate-helper`).
Don't delete the folder afterwards: Chrome loads the extension from it.

Or with git:
```bash
git clone git@github.com:HudsonPifer1217/gate-helper.git ~/Projects/gate-helper
```

### 2. (Optional) Pick a download folder
Chrome extensions can only save inside your Downloads folder, so Gate Helper saves into `~/Downloads/GateDrops`. The setup script turns that into a shortcut to your music folder.

Open **Terminal** and run one of these:

```bash
cd ~/Projects/gate-helper
./setup.sh                                    # → ~/Music/ALL MUSIC/Free Downloads
./setup.sh "$HOME/Music/My DJ Folder/Free"    # → or any folder you like
```

Skip this and files simply land in `~/Downloads/GateDrops`.

### 3. Load the extension in Chrome
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top-right switch)
3. Click **Load unpacked** and choose the **`extension`** folder inside the project
4. (Recommended) Click the puzzle-piece icon in Chrome's toolbar and pin **Gate Helper**

### 4. Fill in your settings
The settings page opens automatically (or click the pinned Gate Helper icon):
- **Name** and **Email**: what gates ask for
- **SoundCloud comment**: used when a gate needs a comment (default: `fire`)
- **Quick mode**: leave on for speed
- **Start automatically**: run as soon as a gate page opens, without pressing Get it

Click **Save**.

### 5. Log in to SoundCloud
Be logged in to **SoundCloud** in the same Chrome profile. Droploud's repost steps happen on your real account.

---

## Use it

1. Open any `hypeddit.com/...` or `droploud.com/track/...` gate.
2. A **⚡ Gate Helper** panel appears bottom-right. Press **Get it**.
3. Watch the log. If it says **"Your turn"**, click the button it highlights. That's only for login popups (Connect SoundCloud / Spotify), and after the first time they usually go through by themselves.
4. If a **CAPTCHA** appears, solve it; Gate Helper waits and then continues.
5. Press **Stop** in the panel at any time.

### Where files go
- If Chrome's **"Ask where to save each file before downloading"** setting is **on**, you'll get a save dialog at the end. Pick your folder and you're done.
- If it's **off** (`chrome://settings/downloads`), files save straight into `~/Downloads/GateDrops` (or the folder you linked in step 2), named `Artist - Title`.

---

## Troubleshooting

| Panel says | What to do |
|---|---|
| `Add your email in settings first` | Click ⚙︎ in the panel, fill in Email, Save |
| `Stuck on "…"` | The site changed something. Finish that step by hand and press **Get it** again, then send a screenshot of the panel to whoever shared this with you |
| `log in to SoundCloud in this Chrome profile` | Log in at soundcloud.com, then retry |
| `Couldn't do it automatically (…)` | Do the repost in the SoundCloud window that's open, then close it. Gate Helper verifies for you |
| `No download started within 20s` | Hypeddit may limit repeat downloads of the same track; try again later or on another track |
| Nothing happens / no panel | `chrome://extensions` → Gate Helper → reload ↻, then refresh the gate page |

**Updating:** download the new ZIP (or `git pull`), then click reload ↻ on Gate Helper in `chrome://extensions`.

---

## Privacy
- Your name, email and comment are stored only in your Chrome profile (`chrome.storage.sync`). Nothing is sent anywhere except to the gate you're unlocking.
- The extension only runs on hypeddit.com, droploud.com, and the SoundCloud / Instagram / YouTube popups a gate opens.
- No passwords are stored. It uses the accounts you're already logged into.

---

## How it works (for the curious)

```
extension/
├── manifest.json            Chrome extension config (Manifest V3)
├── background.js            Opens/closes gate popups, routes downloads into GateDrops/
├── content/
│   ├── page-hook.js         Catches the gate's popup links so Chrome's popup blocker doesn't stop them
│   ├── common.js            Shared helpers + the on-page ⚡ panel
│   ├── hypeddit.js          Hypeddit steps (email, sc, ig, yt, sp, download)
│   ├── droploud.js          Droploud step cards (open link → "I did it" / verify)
│   └── popup-actions.js     Inside SoundCloud/Instagram/YouTube popups: follow, like, repost, comment
└── options/                 Settings page
setup.sh                     Links ~/Downloads/GateDrops to your music folder
```

Each gate site has its own adapter file, so when a site changes its layout usually only that one file needs fixing.

Built for personal use. Gate sites can change at any time, and this isn't affiliated with Hypeddit, Droploud or SoundCloud.
