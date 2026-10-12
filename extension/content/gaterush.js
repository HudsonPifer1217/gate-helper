// GateRush gate adapter (gaterush.me/<slug>).
// One step at a time inside #stepStage; #download gets `.ready` when every step is done.
//   email:      #nameInput (optional), #emailInput, [data-go] "Save & continue"
//   soundcloud: #commentInput (optional), [data-go].btn-soundcloud → OAuth popup (your click)
//   instagram / spotify: a row button (.list-btn) or [data-open] opens the profile; the
//     same button (list) or its [data-confirm] partner unlocks after ~5s as "Done".
//     Confirming every account records the step and advances on its own.

(() => {
  const { log, sleep, jitter, waitFor, visible, setValue, viaPopup, askUser, waitOutCaptcha } = GH;

  const stage = () => document.getElementById('stepStage');
  const dl = () => document.getElementById('download');
  const isGatePage = () => !!(stage() && dl());
  const currentStep = () => stage()?.querySelector('.step:not(.leaving)');
  const ready = () => dl()?.classList.contains('ready');

  const trackName = () => document.title.split(/\s+[|–—]\s+/)[0].trim();
  const stepTitle = (step) => step.querySelector('.step-title')?.childNodes[0]?.textContent.trim() || 'step';

  const waitForStepChange = (step, timeout = 10000) =>
    waitFor(() => ready() || (currentStep() && currentStep() !== step), { timeout });

  const handlers = {
    async email(step, s) {
      const name = step.querySelector('#nameInput');
      if (name && s.name) setValue(name, s.name);
      setValue(step.querySelector('#emailInput'), s.email);
      await jitter(300, 700);
      step.querySelector('[data-go]').click();
      return waitForStepChange(step);
    },

    async soundcloud(step, s) {
      const comment = step.querySelector('#commentInput');
      if (comment && !comment.value) setValue(comment, s.comment || 'fire');
      askUser(step.querySelector('[data-go]'),
        'Your turn: click “Connect SoundCloud” (first time: approve the popup).');
      return waitForStepChange(step, 180000);
    },

    async follow(step) {
      // Work through each account that isn't confirmed yet.
      for (let i = 0; i < 10; i++) {
        const open = [...step.querySelectorAll('.list-btn, [data-open]')]
          .find(b => !b.disabled && !b.classList.contains('done') && !b.classList.contains('waiting'));
        if (!open) break;
        const pair = open.closest('.follow-pair');
        await viaPopup(open, { action: 'visit' }); // open briefly and close — no real follow
        // GateRush holds the confirm for ~5s after the profile opens.
        const confirm = pair ? pair.querySelector('[data-confirm]') : open;
        const live = await waitFor(() => !confirm.disabled && !confirm.classList.contains('waiting') && confirm, { timeout: 12000 });
        if (!live) return false;
        await jitter(200, 500);
        live.click();
        log('✔ Done', 'ok');
        await jitter(300, 700);
      }
      return waitForStepChange(step);
    },
  };

  function kindOf(step) {
    if (step.querySelector('#emailInput')) return 'email';
    if (step.querySelector('.btn-soundcloud[data-go]')) return 'soundcloud';
    if (step.querySelector('.list-btn, [data-open]')) return 'follow';
    return '';
  }

  async function start(s) {
    for (let i = 0; i < 12; i++) {
      await waitOutCaptcha();
      if (ready()) {
        await chrome.runtime.sendMessage({ type: 'armDownload', title: trackName() });
        dl().click();
        log('Download started', 'ok');
        return;
      }
      const step = await waitFor(currentStep, { timeout: 10000 });
      if (!step) { log('Could not find the gate steps.', 'err'); return; }

      const title = stepTitle(step);
      const kind = kindOf(step);
      log(`${title}…`);
      let moved = false;
      if (handlers[kind]) moved = await handlers[kind](step, s);
      else {
        // Unknown step: use the gate's own Skip link if it offers one.
        const skip = step.querySelector('[data-skip]');
        if (skip) { skip.click(); moved = await waitForStepChange(step); }
      }
      if (!moved) {
        log(`Stuck on “${title}”. Finish it by hand, then press Get it again.`, 'err');
        return;
      }
      log(`✔ ${title}`, 'ok');
      await jitter();
    }
  }

  GH.boot(isGatePage, start);
})();
