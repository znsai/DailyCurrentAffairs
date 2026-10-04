/**
 * Daily Current Affairs — UI states demo (Phase 1.5)
 * Demonstrates loading / content / empty / error using Phase 1.4 primitives.
 * No real API calls: data is simulated so states are reviewable without a backend.
 * Future Phase 2 replaces simulateState() with fetch('/api/current-affairs').
 */
(function () {
  const region = document.getElementById('states-demo-region');
  const buttons = document.querySelectorAll('[data-demo-state]');
  if (!region || !buttons.length) return;

  const TEMPLATES = {
    loading: `
      <div class="demo-row">
        <span class="spinner" role="status" aria-label="Loading"></span>
        <span class="card-meta">Loading today&rsquo;s current affairs&hellip;</span>
      </div>
      <div class="demo-grid" aria-hidden="true">
        <div class="skeleton skel-title"></div>
        <div class="skeleton skel-line"></div>
        <div class="skeleton skel-line skel-wide"></div>
      </div>`,
    content: `
      <article class="card">
        <div class="ruled">
          <p class="card-meta">POLITY &amp; GOVERNANCE &middot; 04 OCT</p>
          <h3>Example article title</h3>
          <p>Simulated content — proves the loaded state layout. Real articles arrive in Phase 2.</p>
        </div>
        <div class="exam-point stack-md">
          <p class="exam-point-title"><span aria-hidden="true">&#11088; </span>Exam Point</p>
          <p>Simulated exam fact — layout only.</p>
        </div>
      </article>`,
    empty: `
      <div class="notice" role="status">
        <h3>No current affairs found</h3>
        <p>No articles match this date or subject yet. Try another day or clear the filters.</p>
      </div>`,
    error: `
      <div class="notice notice-error" role="alert">
        <h3>Couldn&rsquo;t load content</h3>
        <p>Check your connection and <button type="button" class="btn btn-secondary" data-demo-state="loading">Try again</button></p>
      </div>`
  };

  function render(state) {
    region.innerHTML = TEMPLATES[state] || TEMPLATES.empty;
    const retry = region.querySelector('[data-demo-state]');
    if (retry) retry.addEventListener('click', () => render('loading'));
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => render(btn.dataset.demoState));
  });

  render('loading');
})();
