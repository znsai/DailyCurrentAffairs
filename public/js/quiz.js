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
  // Daily Quiz session size (PROJECT_SPEC §10): the student takes at most 10
  // randomly selected questions for the day, never the full backlog.
  const QUIZ_SESSION_LIMIT = 10;
  let questions = [];
  let states = [];
  let index = 0;

  // Canonical app date (Asia/Kolkata): matches Worker fallbacks and Home.
  // Frontend callers always send this date explicitly to the API.
  function appToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function formatDateLine(dateString) {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).format(new Date(dateString));
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

  function optionText(question, letter) {
    return question[`option_${String(letter).toLowerCase()}`] || '';
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
    checkAnswer();
  });

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

  const urlParams = new URLSearchParams(window.location.search);
  const requestedDate = urlParams.get('date') || '';
  const isCustomDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && !Number.isNaN(Date.parse(requestedDate));
  const selectedDate = isCustomDate ? requestedDate : appToday();

  const backTodayWrap = document.getElementById('quiz-back-today-wrap');
  if (backTodayWrap) {
    backTodayWrap.hidden = selectedDate === appToday();
  }
  const caLink = document.getElementById('quiz-ca-link');
  const caLinkLabel = document.getElementById('quiz-ca-link-label');
  if (caLink) {
    caLink.href = `/current-affairs/?date=${encodeURIComponent(selectedDate)}`;
  }
  if (caLinkLabel) {
    caLinkLabel.textContent = isCustomDate ? `${formatDateLine(selectedDate)} Current Affairs` : "Today's Current Affairs";
  }
  const caResultLink = document.getElementById('quiz-result-ca-link');
  if (caResultLink) {
    caResultLink.href = `/current-affairs/?date=${encodeURIComponent(selectedDate)}`;
  }

  async function loadQuiz() {
    const today = selectedDate;
    if (isCustomDate) {
      document.title = `Daily Quiz for ${formatDateLine(today)} — Top Current Affairs`;
    }
    try {
      // Daily Quiz session (PROJECT_SPEC §10): 10 random questions for the day,
      // selected by the API. The UI only ever receives the session.
      const response = await fetch(`/api/quiz?date=${today}&limit=${QUIZ_SESSION_LIMIT}&session=1`);
      if (!response.ok) throw new Error('Unable to load quiz.');
      const data = await response.json();
      questions = data.questions || [];
      if (questions.length === 0) {
        dateLine.textContent = formatDateLine(today);
        statusRegion.innerHTML = `<div class="notice">
            <h2>No quiz for this day</h2>
            <p>Quiz for ${formatDateLine(today)} isn't available yet. Pick another day in the <a href="/archive/?type=quiz">Quiz Archive</a> or read current affairs.</p>
            <p><a href="/current-affairs/?date=${encodeURIComponent(today)}">Go to Current Affairs</a> &middot; <a href="/archive/?type=quiz">Quiz Archive</a></p>
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
          <p>We couldn't load the quiz for ${formatDateLine(today)}. Please try again in a moment.</p>
          <p><a href="/current-affairs/?date=${encodeURIComponent(today)}">Go to Current Affairs</a> &middot; <a href="/archive/?type=quiz">Quiz Archive</a></p>
        </div>`;
    }
  }

  loadQuiz();
})();