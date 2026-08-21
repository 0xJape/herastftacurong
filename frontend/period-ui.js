(() => {
  const DAY_MS = 86400000;

  async function decorateHistory() {
    const rows = [...document.querySelectorAll('.cycle-history-row:not([data-duration-ready])')];
    if (!rows.length) return;
    const response = await fetch('/api/cycles/1?limit=100', { cache: 'no-store' });
    if (!response.ok) return;
    const { cycles, summary } = await response.json();
    const disclaimer = document.querySelector('.cycle-disclaimer');
    if (disclaimer && summary.phaseModel === 'provisional-28-day') disclaimer.textContent = 'Phase colors use a provisional 28-day model until enough personal history exists. They are estimates only—not medical advice, fertility guidance, or contraception guidance. Personalized period prediction still needs at least three valid period starts.';
    rows.forEach(row => {
      row.dataset.durationReady = 'true';
      const id = Number(row.querySelector('[data-cycle-edit]')?.dataset.cycleEdit);
      const cycle = cycles.find(item => item.id === id);
      if (!cycle) return;
      const detail = document.createElement('small');
      detail.className = 'cycle-duration';
      if (!cycle.endDate) detail.textContent = 'Ongoing · add end date when menstruation finishes';
      else {
        const days = Math.round((Date.parse(`${cycle.endDate}T00:00:00Z`) - Date.parse(`${cycle.startDate}T00:00:00Z`)) / DAY_MS) + 1;
        detail.textContent = `${days} menstruation day${days === 1 ? '' : 's'}`;
      }
      row.firstElementChild.append(detail);
    });
  }

  function enhance() {
    decorateHistory().catch(() => {});
    const form = document.getElementById('cycle-form');
    if (!form || form.dataset.enhanced) return;
    form.dataset.enhanced = 'true';

    const start = form.elements.startDate;
    const end = form.elements.endDate;
    const startLabel = start.closest('label');
    const endLabel = end.closest('label');

    startLabel.querySelector('.card-label').textContent = 'PERIOD START';
    endLabel.querySelector('.card-label').innerHTML = 'PERIOD END <em>OPTIONAL</em>';
    start.insertAdjacentHTML('afterend', '<small>First day bleeding started</small>');
    end.insertAdjacentHTML('afterend', '<small>Add later when bleeding ends</small>');
    const today = new Date().toLocaleDateString('en-CA');
    start.max = today;
    end.max = today;
    form.querySelector('h2 + p').textContent = 'Log the first day now. Add the end date later when menstruation finishes.';

    const fields = document.createElement('div');
    fields.className = 'period-date-fields';
    startLabel.before(fields);
    fields.append(startLabel, endLabel);
    fields.insertAdjacentHTML('afterend', '<div class="period-duration" id="period-duration" aria-live="polite"></div>');

    const updateDuration = () => {
      const output = document.getElementById('period-duration');
      end.min = start.value;
      if (!start.value) output.textContent = 'Choose a start date. End date can be added later.';
      else if (!end.value) output.textContent = 'Period is ongoing · end date not logged yet.';
      else {
        const days = Math.round((Date.parse(`${end.value}T00:00:00Z`) - Date.parse(`${start.value}T00:00:00Z`)) / DAY_MS) + 1;
        output.textContent = days > 0 ? `Menstruation duration: ${days} day${days === 1 ? '' : 's'}.` : 'End date must be on or after start date.';
      }
    };

    start.addEventListener('change', updateDuration);
    end.addEventListener('change', updateDuration);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-cycle-edit]')) setTimeout(updateDuration);
    });
    form.addEventListener('reset', () => setTimeout(updateDuration));
    updateDuration();
  }

  new MutationObserver(enhance).observe(document.getElementById('page-content'), { childList: true, subtree: true });
  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-cycle-edit]');
    if (!edit) return;
    setTimeout(() => {
      const form = document.getElementById('cycle-form');
      if (!form) return;
      form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      form.elements.endDate.focus();
    });
  });
  enhance();
})();
