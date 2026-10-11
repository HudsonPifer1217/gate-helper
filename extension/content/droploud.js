// Droploud gate adapter.
// After "Free download", Droploud shows one card per step (.dtr-card-pane-step):
// a title like "Follow @x on Instagram", open-link buttons (.dtr-open-grid button),
// and an "I did it →" confirm (.dtr-confirm-btn) that unlocks once a link was opened.

(() => {
  const { log, sleep, jitter, waitFor, visible, setValue, viaPopup, askUser, waitOutCaptcha } = GH;

  const isGatePage = () => location.pathname.startsWith('/track/');
  const stepPane = () => document.querySelector('.dtr-card-pane-step');
  const buttonByText = (re, scope = document) =>
    [...scope.querySelectorAll('button, a')].find(b => visible(b) && re.test(b.textContent.trim()));

  function trackName() {
    // "<title> by <artist> | Free Download | Droploud"
    const m = document.title.match(/^(.*) by (.*?) \| Free Download/);
    return m ? `${m[2]} - ${m[1]}` : document.title.split('|')[0].trim();
  }

  // Work out which site and action a step card is asking for from its title.
  function classify(title, s) {
    const t = title.toLowerCase();
    if (t.includes('instagram')) return { host: 'instagram.com', action: s.igFollow ? 'igFollow' : 'visit' };
    if (t.includes('youtube')) return { host: 'youtube.com', action: s.ytSubscribe ? 'ytSubscribe' : 'visit' };
    if (t.includes('soundcloud') || /\b(repost|like|comment)\b/.test(t)) {
      // Droploud checks these against your SoundCloud account, so they must really
      // happen (force), even in quick mode.
      const wanted = ['follow', 'like', 'repost', 'comment'].filter(a => t.includes(a));
      return { host: 'soundcloud.com', action: wanted.join('+') || 'visit', force: wanted.length > 0 };
    }
    return { host: '', action: 'visit' };
  }

  async function handleStep(pane, s) {
    const title = pane.querySelector('.dtr-card-title')?.textContent.trim() || 'step';
    log(`${title}…`);

    const email = pane.querySelector('input[type=email]');
    const scConnect = buttonByText(/connect soundcloud/i, pane);
    if (scConnect) {
      // Droploud runs the SoundCloud actions itself after you connect; it wants a comment first.
      const box = pane.querySelector('textarea, input[type=text]');
      if (box && !box.value) setValue(box, s.comment || 'fire');
      await waitFor(() => !scConnect.disabled, { timeout: 5000 });
      askUser(scConnect, 'Your turn: click “Connect SoundCloud” (first time: approve the popup). Droploud then follows/likes/reposts for you.');
    } else if (email) {
      setValue(email, s.email);
      const name = pane.querySelector('input[name*=name i], input[placeholder*=name i]');
      if (name && s.name) setValue(name, s.name);
      await jitter(300, 700);
      buttonByText(/continue|submit|next|unlock|→/i, pane)?.click();
    } else {
      const { action, force } = classify(title, s);
      let opens = [...pane.querySelectorAll('.dtr-open-grid button, .dtr-open-grid a')];
      if (!opens.length) opens = [buttonByText(/↗/, pane)].filter(Boolean);
      for (const open of opens) {
        if (force) log(`Doing it on SoundCloud: ${action.replace(/\+/g, ', ')}…`);
        const res = await viaPopup(open, { action, force });
        if (!res?.ok) log(`• ${res?.detail || 'popup did not report back'}`, 'warn');
        await jitter();
      }
      const findConfirm = () => {
        const b = pane.querySelector('.dtr-confirm-btn') || buttonByText(/verify|i did it|i reposted|i liked|i followed/i, pane);
        return b && !b.disabled && b;
      };
      const confirm = await waitFor(findConfirm, { timeout: 15000 });
      if (confirm) {
        // Verified steps can lag behind SoundCloud by a few seconds; re-verify a few times.
        for (let i = 0; i < (force ? 4 : 1); i++) {
          (findConfirm() || confirm).click();
          if (await waitFor(() => stepPane() !== pane || pane.querySelector('.dtr-card-title')?.textContent.trim() !== title, { timeout: 5000 })) break;
          if (force) log('Not verified yet, checking again…');
          await sleep(2500);
        }
      } else {
        const other = buttonByText(/connect|continue|sign in|log in/i, pane);
        if (!other) return false;
        askUser(other, 'Your turn: click the highlighted button.');
      }
    }

    const moved = await waitFor(() => {
      const p = stepPane();
      return !p || p !== pane || p.querySelector('.dtr-card-title')?.textContent.trim() !== title;
    }, { timeout: 180000 });
    if (moved) log(`✔ ${title}`, 'ok');
    return !!moved;
  }

  async function start(s) {
    buttonByText(/^free download$/i)?.click();

    for (let i = 0; i < 12; i++) {
      await waitOutCaptcha();
      const pane = await waitFor(() => stepPane() || buttonByText(/^(download|get (the )?file)/i), { timeout: 15000 });
      if (!pane) { log('Could not find the next step.', 'err'); return; }

      if (!pane.classList.contains('dtr-card-pane-step')) {
        await chrome.runtime.sendMessage({ type: 'armDownload', title: trackName() });
        pane.click();
        log('Download started → ALL MUSIC/Free Downloads', 'ok');
        await sleep(1500);
        await waitOutCaptcha();
        return;
      }
      if (!(await handleStep(pane, s))) {
        log('Stuck on this step. Finish it by hand, then press Get it again.', 'err');
        return;
      }
      await jitter();
    }
  }

  GH.boot(isGatePage, start);
})();
