(() => {
  const MAX_CLAPS_PER_BROWSER = 10;
  const apiBase = document.documentElement.dataset.clapApiBase?.replace(/\/$/, '');
  if (!apiBase) return;

  for (const box of document.querySelectorAll('[data-clap-key]')) {
    const slug = box.dataset.clapKey;
    const value = box.querySelector('.clap-value');
    const buttons = box.querySelectorAll('[data-clap-delta]');
    const storageKey = `jayinlab:claps:${slug}`;
    let mine = Number(localStorage.getItem(storageKey) || 0);
    let busy = false;

    const setDisabled = () => {
      for (const button of buttons) {
        const delta = Number(button.dataset.clapDelta);
        button.disabled = busy || (delta === 1 && mine >= MAX_CLAPS_PER_BROWSER) || (delta === -1 && mine <= 0);
      }
    };

    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/api/claps?slug=${encodeURIComponent(slug)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        value.textContent = String(data.count ?? 0);
        box.dataset.ready = 'true';
      } catch (error) {
        console.warn('Could not load claps', error);
        box.dataset.error = 'true';
      }
      setDisabled();
    };

    for (const button of buttons) {
      button.addEventListener('click', async () => {
        if (busy) return;
        const delta = Number(button.dataset.clapDelta);
        if ((delta === 1 && mine >= MAX_CLAPS_PER_BROWSER) || (delta === -1 && mine <= 0)) return;

        busy = true;
        setDisabled();
        try {
          const response = await fetch(`${apiBase}/api/claps`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ slug, delta }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          mine += delta;
          localStorage.setItem(storageKey, String(mine));
          value.textContent = String(data.count ?? 0);
          box.dataset.error = 'false';
        } catch (error) {
          console.warn('Could not update claps', error);
          box.dataset.error = 'true';
        } finally {
          busy = false;
          setDisabled();
        }
      });
    }

    setDisabled();
    load();
  }
})();
