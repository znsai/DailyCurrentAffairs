/**
 * Daily Current Affairs - Daily Quiz (V1)
 *
 * Flow: select -> Check Answer -> Correct/Incorrect + explanation -> Next ->
 * Result. One question at a time on every viewport; position text
 * ("Question N of M") is always visible. The correct answer and explanation
 * are written to the page only when the student presses Check Answer
 * (client-side checking is the approved V1 approach; nothing is persisted).
 * Motion: one short slide/fade per question, skipped under reduced-motion.
 */
(function () {
  const stage = document.getElementById('quiz-stage');
  const statusRegion = document.getElementById('quiz-status');
  const dateLine = document.getElementById('quiz-date-line');
  const session = document.getElementById('quiz-session');
  const toolbar = document.getElementById('quiz-toolbar');
  const checkButton = document.getElementById('quiz-check');
  const feedback = document.getElementById('quiz-feedback');
  const prevButton = document.getElementById('quiz-prev');
  const nextButton = document.getElementById('quiz-next');
  const position = document.getElementById('quiz-position');
  const result = document.getElementById('quiz-result');
  const stats = document.getElementById('quiz-result-stats');
  const reviewToggle = document.getElementById('quiz-review-toggle');
  const review = document.getElementById('quiz-review');
  const announcer = document.getElementById('quiz-announcer');
  if (!stage || !session) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LETTERS = ['A', 'B', 'C', 'D'];
  let questions = [];
  let states = [];
  let index = 0;

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateLine(dateString) {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(`${dateString}T12:00:00`));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function correctLetter(question) {
    return String(question.correct_answer || '').trim().toUpperCase();
  }

  function optionRowHtml(question, state, letter) {
    const checked = state.selected === letter ? ' checked' : '';
    const disabled = state.checked ? ' disabled' : '';
    let rowClass = 'quiz-option-row';
    if (state.checked) {
      if (letter === correctLetter(question)) rowClass += ' is-correct';
      else if (letter === state.selected) rowClass += ' is-wrong';
    }
    return `<li><label class="${rowClass}">
        <input type="radio" name="daily-quiz" value="${letter}"${checked}${disabled}>
        <span class="quiz-option-text">${letter}. ${escapeHtml(optionText(question, letter))}</span>
      </label></li>`;
  }

  function feedbackHtml(question, state) {
    const correct = correctLetter(question);
    const ok = state.selected === correct;
    const lines = [
      `<p class="quiz-verdict ${ok ? 'is-correct' : 'is-wrong'}"><strong>${ok ? 'Correct' : 'Incorrect'}</strong></p>`,
      `<p class="quiz-answer-line">Your answer: ${state.selected}. ${escapeHtml(optionText(question, state.selected))}</p>`,
    ];
    if (!ok) {
      lines.push(`<p class="quiz-answer-line">Correct answer: ${correct}. ${escapeHtml(optionText(question, correct))}</p>`);
    }
    if (question.explanation) {
      lines.push(`<p class="quiz-explanation">Explanation: ${escapeHtml(question.explanation)}</p>`);
    }
    return lines.join('');
  }

  function updateControls() {
    const total = questions.length;
    position.textContent = `Question ${index + 1} of ${total}`;
    prevButton.disabled = index === 0;
    nextButton.textContent = index === total - 1 ? 'Finish' : 'Next';
    nextButton.disabled = !states[index].checked;
  }

  function renderQuestion(animate) {
    const question = questions[index];
    const state = states[index];
    const total = questions.length;
    const rows = LETTERS.map((letter) => optionRowHtml(question, state, letter)).join('');
    stage.innerHTML = `<article class="card ruled${animate && !reduceMotion ? ' page-enter' : ''}" aria-label="Question ${index + 1} of ${total}">
        <p class="study-eyebrow">${escapeHtml(question.subject || 'Daily Quiz')} <span class="study-date">Question ${index + 1} of ${total}</span></p>
        <h2 class="quiz-question">${escapeHtml(question.question)}</h2>
        <fieldset class="quiz-fieldset">
          <legend class="sr-only">Choose one answer for question ${index + 1} of ${total}</legend>
          <ul class="quiz-options">${rows}</ul>
        </fieldset>
      </article>`;
    if (state.checked) {
      feedback.hidden = false;
      feedback.innerHTML = state.feedbackHtml;
    } else {
      feedback.innerHTML = '';
      feedback.hidden = true;
    }
    toolbar.hidden = state.checked;
    checkButton.disabled = !state.selected;
    updateControls();
  }

  function checkAnswer() {
    const state = states[index];
    if (state.checked || !state.selected) return;
    const question = questions[index];
    const correct = correctLetter(question);
    state.checked = true;
    state.feedbackHtml = feedbackHtml(question, state);
    stage.querySelectorAll('.quiz-option-row').forEach((label) => {
      const input = label.querySelector('input');
      if (!input) return;
      input.disabled = true;
      if (input.value === correct) label.classList.add('is-correct');
      else if (input.value === state.selected) label.classList.add('is-wrong');
    });
    feedback.hidden = false;
    feedback.innerHTML = state.feedbackHtml;
    toolbar.hidden = true;
    updateControls();
    nextButton.focus();
  }

  function buildReview() {
    review.innerHTML = questions.map((question, i) => {
      const state = states[i];
      const correct = correctLetter(question);
      const ok = state.selected === correct;
      const verdict = ok ? 'Correct' : 'Incorrect';
      const chosenText = state.selected
        ? `${state.selected}. ${escapeHtml(optionText(question, state.selected))}`
        : 'Not answered';
      let html = `<li class="quiz-review-item">
        <p class="quiz-review-question">${escapeHtml(question.question)}</p>
        <p class="quiz-review-answer"><strong>${verdict}</strong> &middot; Your answer: ${chosenText}</p>`;
      if (!ok) {
        html += `<p class="quiz-review-answer">Correct answer: ${correct}. ${escapeHtml(optionText(question, correct))}</p>`;
      }
      if (question.explanation) {
        html += `<p class="quiz-review-explanation">Explanation: ${escapeHtml(question.explanation)}</p>`;
      }
      return `${html}</li>`;
    }).join('');
  }

  function finish() {
    const total = questions.length;
    let correct = 0;
    questions.forEach((question, i) => {
      if (states[i].checked && states[i].selected === correctLetter(question)) correct += 1;
    });
    const accuracy = Math.round((correct / total) * 100);
    session.hidden = true;
    stats.innerHTML = `
      <div><dt>Score</dt><dd>${correct} / ${total}</dd></div>
      <div><dt>Correct</dt><dd>${correct}</dd></div>
      <div><dt>Incorrect</dt><dd>${total - correct}</dd></div>
      <div><dt>Accuracy</dt><dd>${accuracy}%</dd></div>`;
    buildReview();
    review.hidden = true;
    reviewToggle.setAttribute('aria-expanded', 'false');
    reviewToggle.textContent = 'Review Answers';
    result.hidden = false;
    announcer.textContent = `Quiz complete. Score ${correct} out of ${total}. Accuracy ${accuracy} percent.`;
    result.focus();
  }

  stage.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="radio"]')) return;
    states[index].selected = event.target.value;
    checkButton.disabled = false;
  });

  checkButton.addEventListener('click', checkAnswer);

  prevButton.addEventListener('click', () => {
    if (index > 0) {
      index -= 1;
      renderQuestion(true);
    }
  });

  nextButton.addEventListener('click', () => {
    if (!states[index].checked) return;
    if (index < questions.length - 1) {
      index += 1;
      renderQuestion(true);
    } else {
      finish();
    }
  });

  reviewToggle.addEventListener('click', () => {
    const opening = review.hidden;
    review.hidden = !opening;
    reviewToggle.setAttribute('aria-expanded', String(opening));
    reviewToggle.textContent = opening ? 'Hide Review Answers' : 'Review Answers';
  });

  async function loadQuiz() {
    const today = localDateString(new Date());
    try {
      const response = await fetch(`/api/quiz?date=${today}&limit=50`);
      if (!response.ok) throw new Error('Unable to load today\'s quiz.');
      const data = await response.json();
      questions = data.questions || [];
      if (questions.length === 0) {
        dateLine.textContent = formatDateLine(today);
        statusRegion.innerHTML = `<div class="notice">
            <h2>No quiz today</h2>
            <p>Today's quiz isn't published yet. Read today's current affairs first; the quiz appears here once it is ready.</p>
            <p><a href="/current-affairs/">Go to Current Affairs</a></p>
          </div>`;
        return;
      }
      states = questions.map(() => ({ selected: null, checked: false, feedbackHtml: '' }));
      dateLine.textContent = `${formatDateLine(today)} · ${questions.length} questions`;
      statusRegion.hidden = true;
      session.hidden = false;
      renderQuestion(true);
    } catch (error) {
      statusRegion.innerHTML = `<div class="notice">
          <h2>Quiz unavailable</h2>
          <p>We couldn't load today's quiz. Please try again in a moment.</p>
          <p><a href="/current-affairs/">Go to Current Affairs</a></p>
        </div>`;
    }
  }

  loadQuiz();
})();