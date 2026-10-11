// Hypeddit gate adapter.
// Gates are a carousel of slides whose first class names the step: email, sc, ig,
// yt, sp, dw (download), etc. Hypeddit never moves `.current-slide`; finishing a
// step toggles `.move-left` on it, so the live slide is the first one without it.

(() => {
  const { log, sleep, jitter, waitFor, visible, setValue, viaPopup, askUser, waitOutCaptcha } = GH;

  const isGatePage = () => !!document.querySelector('#downloadProcess, .hype-download-gate-steps-wrapper');
  const currentSlide = () => [...document.querySelectorAll('#all_steps > .fangate-slider-content')]
    .find(el => !el.classList.contains('move-left'));
  const slideKey = (el) => el?.classList[0] || '';

  function trackName() {
    // "<title> by <artist> | Free Download on Hypeddit"
    const m = document.title.match(/^(.*) by (.*?) \| Free Download/);
    return m ? `${m[2]} - ${m[1]}` : document.title.split('|')[0].trim();
  }

  async function waitForSlideChange(from, timeout = 10000) {
    return waitFor(() => currentSlide() !== from && currentSlide(), { timeout });
  }

  async function clickNext(slide) {
    // Hypeddit's Next *toggles* the slide, so a second click on an already
    // advanced slide would move it back. Only retry while it's clearly still here.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (slide.classList.contains('move-left')) return true;
      const buttons = [...slide.querySelectorAll('.button-next')].filter(visible);
      const next = buttons.find(b => /_next$/.test(b.id)) || buttons[0];
      if (!next) break;
      next.click();
      if (await waitForSlideChange(slide, 5000)) return true;
    }
    return false;
  }

  async function popupStep(slide, selector, actionFor) {
    const buttons = [...slide.querySelectorAll(selector)];
    for (const b of buttons) {
      const action = actionFor(b);
      if (!action) continue;
      const label = b.textContent.trim().replace(/\s+/g, ' ');
      log(`${label}…`);
      const res = await viaPopup(b, { action });
      log(res?.ok ? `✔ ${label}` : `• ${label} (${res?.detail || 'no response'})`, res?.ok ? 'ok' : 'warn');
      await jitter();
    }
  }

  const handlers = {
    async email(slide, s) {
      const name = slide.querySelector('#email_name');
      const email = slide.querySelector('#email_address');
      if (name && s.name) setValue(name, s.name);
      if (email) setValue(email, s.email);
      await jitter(300, 700);
      slide.querySelector('#email_to_downloads_next')?.click();
      log('✔ Email entered', 'ok');
      return !!(await waitForSlideChange(slide));
    },

    async sc(slide, s) {
      const steps = slide.querySelectorAll('#soundcloud_status a[data-step]');
      if (steps.length) {
        await popupStep(slide, '#soundcloud_status a[data-step]',
          b => (s.sc[b.dataset.step] ? b.dataset.step : 'visit'));
        return clickNext(slide);
      }
      // API-style gate: "Connect with SoundCloud" OAuth. First time you approve it yourself.
      const connect = [...slide.querySelectorAll('a,button')].find(b => visible(b) && /connect|log ?in|sign ?in/i.test(b.textContent));
      if (!connect) return false;
      askUser(connect, 'Your turn: click the highlighted SoundCloud button (first time: approve the popup).');
      return !!(await waitForSlideChange(slide, 120000));
    },

    async ig(slide, s) {
      await popupStep(slide, '#instagram_status a[onclick*="PopupCenterDual"]',
        () => (s.igFollow ? 'igFollow' : 'visit'));
      return clickNext(slide);
    },

    async yt(slide, s) {
      await popupStep(slide, '#youtube_status a',
        () => (s.ytSubscribe ? 'ytSubscribe' : 'visit'));
      return clickNext(slide);
    },

    async sp(slide) {
      const connect = slide.querySelector('#login_to_sp') || [...slide.querySelectorAll('a,button')].find(b => visible(b) && /connect/i.test(b.textContent));
      if (!connect) return false;
      askUser(connect, 'Your turn: click the highlighted Spotify “Connect” (first time: approve the popup).');
      return !!(await waitForSlideChange(slide, 120000));
    },

    async dw(slide) {
      await chrome.runtime.sendMessage({ type: 'armDownload', title: trackName() });
      slide.querySelector('#gateDownloadButton')?.click();
      log('Download started → ALL MUSIC/Free Downloads', 'ok');
      await sleep(1500);
      await waitOutCaptcha();
      return 'done';
    },
  };

  // Steps we haven't written a handler for: open any popups as plain visits, then Next.
  async function generic(slide) {
    await popupStep(slide, 'a[onclick*="PopupCenterDual"]', () => 'visit');
    return clickNext(slide);
  }

  async function start(s) {
    const open = document.querySelector('#downloadProcess');
    if (visible(open)) open.click();
    let slide = await waitFor(() => visible(currentSlide()?.querySelector('.hype-sidebar-step-form')) && currentSlide());
    if (!slide) { log('Could not find the gate steps.', 'err'); return; }

    for (let i = 0; i < 15; i++) {
      await waitOutCaptcha();
      slide = currentSlide();
      const key = slideKey(slide);
      log(`Step: ${key}`);
      const handler = handlers[key] || generic;
      const result = await handler(slide, s);
      if (result === 'done') return;
      if (!result) {
        log(`Stuck on “${key}”. Finish this step by hand, then press Get it again.`, 'err');
        return;
      }
      await jitter();
    }
  }

  GH.boot(isGatePage, start);
})();
