/**
 * Daily Current Affairs — Mobile pager demo (Phase 1.9/1.10)
 * One card per view with Previous/Next + position text + short slide/fade.
 * Quiz cards render question + one-per-line selectable radio options.
 * The card is a .ruled writing zone, so the rules follow the text rhythm.
 * Selections reset per card in this demo; Phase 3 will persist answers.
 * No real data yet: three static demo questions, motion off under reduced-motion.
 */
(function () {
  const stage = document.getElementById('pager-stage');
  const prev = document.getElementById('pager-prev');
  const next = document.getElementById('pager-next');
  const status = document.getElementById('pager-status');
  if (!stage || !prev || !next || !status) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = [
    {
      eyebrow: 'Polity & Governance',
      title: 'Which body prepares the example question?',
      options: ['A. Example option one', 'B. Example option two', 'C. Example option three', 'D. Example option four'],
    },
    {
      eyebrow: 'Economy & Banking',
      title: 'What does the example rate decision track?',
      options: ['A. Inflation first', 'B. Growth first', 'C. Reserves first', 'D. Credit first'],
    },
    {
      eyebrow: 'Science & Technology',
      title: 'Which system launched the example mission?',
      options: ['A. Example launcher', 'B. Example orbiter', 'C. Example lander', 'D. Example relay'],
    },
  ];
  let index = 0;

  function render() {
    const card = cards[index];
    const name = `demo-q${index + 1}`;
    const rows = card.options
      .map(
        (text, i) =>
          `<li><label class="quiz-option-row"><input type="radio" name="${name}" value="${'abcd'[i]}"><span class="quiz-option-text">${text}</span></label></li>`
      )
      .join('');
    stage.innerHTML = `
      <article class="card ruled${reduceMotion ? '' : ' page-enter'}" aria-label="Example question ${index + 1} of ${cards.length}">
        <p class="study-eyebrow">${card.eyebrow} <span class="study-date">Question ${index + 1} of ${cards.length}</span></p>
        <h3 class="quiz-question">${card.title}</h3>
        <fieldset class="quiz-fieldset">
          <legend class="sr-only">Choose one answer for question ${index + 1}</legend>
          <ul class="quiz-options">${rows}</ul>
        </fieldset>
      </article>`;
    status.textContent = `Question ${index + 1} of ${cards.length}`;
    prev.disabled = index === 0;
    next.disabled = index === cards.length - 1;
  }

  prev.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
  next.addEventListener('click', () => { if (index < cards.length - 1) { index += 1; render(); } });
  render();
})();
