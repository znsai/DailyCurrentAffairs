/**
 * Daily Current Affairs - Daily Quiz (V1)
 *
 * Flow: select -> Correct/Incorrect + explanation -> Next ->
 * Result. One question at a time on every viewport; position text
 * ("Question N of M") is always visible. The correct answer and explanation
 * are written to the page only when the student selects an answer
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
  const landing = document.getElementById('quiz-landing');
  const picker = document.getElementById('quiz-picker');
  const pickerFields = document.getElementById('quiz-picker-fields');
  const pickerError = document.getElementById('quiz-picker-error');
  const availability = document.getElementById('quiz-availability');
  const startButton = document.getElementById('quiz-start');
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

  // Weekly periods are calendar-month buckets, rather than rolling seven-day
  // windows. Keep this self-contained so it can be extracted and tested in a
  // small Node vm without needing the page DOM.
  function weeklyPeriods(month, today) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000-')) return [];
    const [year, monthNumber] = month.split('-').map(Number);
    const monthEnd = new Date(0);
    monthEnd.setUTCFullYear(year, monthNumber, 0);
    const daysInMonth = monthEnd.getUTCDate();
    const todayIsValid = /^\d{4}-\d{2}-\d{2}$/.test(today || '');
    const monthStart = new Date(0);
    monthStart.setUTCFullYear(year, monthNumber - 1, 1);
    const monthName = new Intl.DateTimeFormat('en-IN', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(monthStart);
    const pad = (day) => String(day).padStart(2, '0');
    const periods = [];
    [1, 8, 15, 22, 29].forEach((start, index) => {
      if (start > daysInMonth) return;
      const end = Math.min(start + 6, daysInMonth);
      const from = `${month}-${pad(start)}`;
      const fullTo = `${month}-${pad(end)}`;
      const disabled = !todayIsValid || from > today;
      const isCurrent = !disabled && today >= from && today <= fullTo;
      const to = isCurrent ? today : fullTo;
      const label = `Week ${index + 1} · ${start}–${Number(to.slice(-2))} ${monthName}${isCurrent ? ' · through today' : ''}`;
      periods.push({ week: index + 1, from, to, label, disabled });
    });
    return periods;
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

  function isValidDateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function validationError(message, fieldId) {
    const error = new Error(message);
    error.fieldId = fieldId;
    return error;
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
    const firstOption = stage.querySelector('input[type="radio"]');
    if (firstOption) firstOption.focus({ preventScroll: true });
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
    nextButton.focus({ preventScroll: true });
    // Reveal just enough of the new explanation. Use a short, controlled
    // animation instead of native smooth scrolling, whose duration varies by
    // browser and can feel like a one-second delay.
    if (reduceMotion || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      feedback.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    } else {
      const rect = feedback.getBoundingClientRect();
      const edge = 16;
      const delta = rect.bottom > window.innerHeight - edge
        ? rect.bottom - (window.innerHeight - edge)
        : rect.top < edge ? rect.top - edge : 0;
      if (delta) {
        const startY = window.scrollY;
        const duration = 240;
        const started = performance.now();
        const animate = (now) => {
          const progress = Math.min(1, (now - started) / duration);
          const eased = 1 - ((1 - progress) ** 3);
          window.scrollTo(0, startY + delta * eased);
          if (progress < 1) window.requestAnimationFrame(animate);
        };
        window.requestAnimationFrame(animate);
      }
    }
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
    if (!states[index].checked) {
      states[index].selected = event.target.value;
      checkAnswer();
    }
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
  const isCustomDate = isValidDateValue(requestedDate);
  const selectedDate = isCustomDate ? requestedDate : appToday();
  let mode = urlParams.get('mode') || (isCustomDate ? 'daily' : 'daily');
  if (!['daily', 'weekly', 'monthly', 'topic'].includes(mode)) mode = 'daily';

  function input(id, label, type, value, extra) {
    const calendar = type === 'date' ? `data-calendar data-calendar-max-today="true"${mode === 'topic' ? ` data-calendar-optional data-calendar-range="topic" data-calendar-edge="${id === 'quiz-from' ? 'start' : 'end'}"` : ''}`
      : type === 'month' ? 'data-month-picker data-calendar-max-today="true"' : '';
    return `<label for="${id}"><span>${label}</span><input id="${id}" name="${id}" type="${type}" value="${value || ''}" aria-describedby="quiz-picker-error" ${calendar} ${extra || ''}></label>`;
  }
  function renderPicker() {
    const today = appToday();
    picker.noValidate = mode === 'weekly';
    pickerFields.innerHTML = mode === 'daily' ? `${input('quiz-date', 'Study date', 'date', isCustomDate ? selectedDate : today, `max="${today}"`)}<p class="quiz-picker-help">Choose a published edition. Future dates are not available yet.</p>`
      : mode === 'weekly' ? `<label for="quiz-week-month"><span>Study month</span><input id="quiz-week-month" name="quiz-week-month" type="month" data-month-picker data-calendar-max-today="true" value="${today.slice(0, 7)}" max="${today.slice(0, 7)}" aria-describedby="quiz-picker-error"></label><label for="quiz-week"><span>Week</span><select id="quiz-week" name="quiz-week" aria-describedby="quiz-picker-error"></select></label><p class="quiz-picker-help">Weeks follow the calendar month: 1–7, 8–14, 15–21, 22–28, and 29–month end where present.</p>`
      : mode === 'monthly' ? `${input('quiz-month', 'Study month', 'month', today.slice(0, 7), `max="${today.slice(0, 7)}"`)}<p class="quiz-picker-help">Only published questions in the selected calendar month are included.</p>`
      : `<label for="quiz-subject"><span>Subject <em class="quiz-required">Required</em></span><select id="quiz-subject" name="quiz-subject"><option value="">Choose a subject</option><option>Polity &amp; Governance</option><option>Economy &amp; Banking</option><option>National Affairs</option><option>International Relations</option><option>Defence &amp; Security</option><option>Science &amp; Technology</option><option>Environment</option><option>Health</option><option>Agriculture</option><option>Government Schemes</option><option>Social Issues</option><option>Sports</option><option>Awards &amp; Honours</option><option>Appointments</option><option>Reports &amp; Indices</option><option>Books &amp; Authors</option><option>Art &amp; Culture</option><option>Geography</option><option>Important Days</option><option>Other</option></select></label>${input('quiz-from', 'From date (optional)', 'date', '', `max="${today}"`)}${input('quiz-to', 'To date (optional)', 'date', '', `max="${today}"`)}<p class="quiz-picker-help">Add a start date, an end date, or both. A start date includes through the latest edition; an end date includes questions up to that date. Leave both blank for all published questions.</p>`;
    window.TCACalendar?.enhance(pickerFields);
    if (mode === 'weekly') {
      const weekMonth = document.getElementById('quiz-week-month');
      const weekSelect = document.getElementById('quiz-week');
      const rebuildWeeklyOptions = (month) => {
        const periods = weeklyPeriods(month, appToday());
        const monthIsValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && !month.startsWith('0000-');
        const monthIsFuture = monthIsValid && month > appToday().slice(0, 7);
        weekSelect.innerHTML = '<option value="">Choose a week</option>';
        periods.forEach((period) => {
          const option = document.createElement('option');
          option.value = String(period.week);
          option.textContent = period.label;
          option.disabled = period.disabled;
          weekSelect.appendChild(option);
        });
        weekSelect.disabled = !monthIsValid || monthIsFuture || periods.length === 0;
        if (!weekSelect.disabled) {
          const currentMonth = appToday().slice(0, 7);
          const defaultPeriod = month === currentMonth
            ? periods.find((period) => !period.disabled && period.to >= appToday())
            : periods.find((period) => !period.disabled);
          if (defaultPeriod) weekSelect.value = String(defaultPeriod.week);
        }
      };
      rebuildWeeklyOptions(weekMonth.value);
      weekMonth.addEventListener('input', () => rebuildWeeklyOptions(weekMonth.value));
      weekMonth.addEventListener('change', () => rebuildWeeklyOptions(weekMonth.value));
    }
    document.querySelectorAll('.quiz-mode').forEach((button) => { const active = button.dataset.mode === mode; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); });
  }
  const modeButtons = Array.from(document.querySelectorAll('.quiz-mode'));
  modeButtons.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    pickerError.hidden = true;
    pickerError.textContent = '';
    if (availability) availability.textContent = '';
    statusRegion.hidden = true;
    statusRegion.innerHTML = '';
    renderPicker();
  }));
  modeButtons.forEach((button, buttonIndex) => button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? modeButtons.length - 1
        : (buttonIndex + (event.key === 'ArrowRight' ? 1 : -1) + modeButtons.length) % modeButtons.length;
    modeButtons[nextIndex].focus();
    modeButtons[nextIndex].click();
  }));
  renderPicker();

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

  function selection() {
    const value = (id) => document.getElementById(id)?.value || '';
    const today = appToday();
    if (mode === 'daily') {
      const date = value('quiz-date');
      if (!isValidDateValue(date)) throw validationError('Choose a valid study date.', 'quiz-date');
      if (date > today) throw validationError('Future editions are not available yet.', 'quiz-date');
      return { params: { date }, label: formatDateLine(date) };
    }
    if (mode === 'monthly') {
      const month = value('quiz-month');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000-')) throw validationError('Choose a valid study month.', 'quiz-month');
      if (month > today.slice(0, 7)) throw validationError('Future editions are not available yet.', 'quiz-month');
      return { params: { month }, label: month };
    }
    if (mode === 'topic') {
      const subject = value('quiz-subject');
      const from = value('quiz-from'), to = value('quiz-to');
      if (!subject) throw validationError('Choose a subject.', 'quiz-subject');
      if (from && !isValidDateValue(from)) throw validationError('Choose a valid start date.', 'quiz-from');
      if (to && !isValidDateValue(to)) throw validationError('Choose a valid end date.', 'quiz-to');
      if (from && to && to < from) throw validationError('End date must be on or after the start date.', 'quiz-to');
      if (from > today) throw validationError('Future editions are not available yet.', 'quiz-from');
      if (to > today) throw validationError('Future editions are not available yet.', 'quiz-to');
      const range = from && to ? { from, to } : from ? { from } : to ? { to } : {};
      const rangeLabel = from && to ? `${from} to ${to}` : from ? `${from} to latest` : to ? `up to ${to}` : '';
      return { params: { subject, ...range }, label: rangeLabel ? `${subject} · ${rangeLabel}` : subject };
    }
    if (mode === 'weekly') {
      const month = value('quiz-week-month');
      const week = value('quiz-week');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000-')) throw validationError('Choose a valid study month.', 'quiz-week-month');
      if (month > today.slice(0, 7)) throw validationError('Future editions are not available yet.', 'quiz-week-month');
      const period = weeklyPeriods(month, today).find((candidate) => String(candidate.week) === week);
      if (!period || period.disabled) throw validationError('Choose an available week.', 'quiz-week');
      return { params: { from: period.from, to: period.to }, label: period.label };
    }
    let from = value('quiz-from'), to = value('quiz-to') || from;
    if (!isValidDateValue(from)) throw validationError('Choose a valid start date.', 'quiz-from');
    if (!isValidDateValue(to)) throw validationError('Choose a valid end date.', 'quiz-to');
    if (to < from) throw validationError('End date must be on or after the start date.', 'quiz-to');
    if (to > today) throw validationError('Future editions are not available yet.', 'quiz-to');
    return { params: { from, to, ...(mode === 'topic' ? { subject: value('quiz-subject') } : {}) }, label: `${from} to ${to}` };
  }
  async function loadQuiz() {
    let chosen;
    try { chosen = selection(); } catch (error) {
      pickerError.textContent = error.message;
      pickerError.hidden = false;
      const field = error.fieldId ? document.getElementById(error.fieldId) : null;
      document.querySelectorAll('#quiz-picker-fields [aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
      }
      return;
    }
    pickerError.hidden = true;
    document.querySelectorAll('#quiz-picker-fields [aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
    startButton.disabled = true; startButton.textContent = 'Finding questions…';
    statusRegion.hidden = false; statusRegion.innerHTML = '<div class="demo-row"><span class="spinner" aria-hidden="true"></span><span class="card-meta">Loading questions…</span></div>';
    try {
      const query = new URLSearchParams({ mode, countOnly: '1', ...chosen.params });
      const countResponse = await fetch(`/api/quiz?${query}`);
      if (!countResponse.ok) throw new Error('Unable to count quiz questions.');
      const countData = await countResponse.json();
      if (!countData.count) {
        if (availability) availability.textContent = '0 questions available for this selection.';
        landing.hidden = false; dateLine.textContent = chosen.label;
        statusRegion.innerHTML = `<div class="notice"><h2>No questions found</h2><p>There are no questions for this practice selection yet. Try another date, month, or subject.</p></div>`;
        return;
      }
      query.delete('countOnly');
      query.set('session', '1'); // session=1 keeps the browser response bounded to the server-selected session.
      query.set('limit', String(QUIZ_SESSION_LIMIT));
      const response = await fetch(`/api/quiz?${query}`);
      if (!response.ok) throw new Error('Unable to load quiz.');
      const data = await response.json();
      questions = (data.questions || []).slice(0, QUIZ_SESSION_LIMIT);
      if (availability) availability.textContent = `${countData.count} questions available; this session contains up to ${QUIZ_SESSION_LIMIT}.`;
      const today = chosen.params.date || chosen.params.from || appToday();
      if (questions.length === 0) {
        landing.hidden = false; dateLine.textContent = chosen.label;
        statusRegion.innerHTML = `<div class="notice">
            <h2>No questions found</h2>
            <p>There are no questions for this practice selection yet. Try another date, month, or subject.</p>
            <p><a href="/current-affairs/?date=${encodeURIComponent(today)}">Go to Current Affairs</a> &middot; <a href="/archive/?type=quiz">Quiz Archive</a></p>
          </div>`;
        return;
      }
      states = questions.map(() => ({ selected: null, checked: false, feedbackHtml: '' }));
      landing.hidden = true; document.title = `${mode[0].toUpperCase() + mode.slice(1)} Quiz & Practice — Top Current Affairs`;
      dateLine.textContent = `${chosen.label} · ${questions.length} questions (up to 10)`;
      statusRegion.hidden = true;
      session.hidden = false;
      renderQuestion(true);
    } catch (error) {
      landing.hidden = false;
      statusRegion.innerHTML = `<div class="notice">
          <h2>Quiz unavailable</h2>
          <p>We couldn't load these questions. Please try again in a moment.</p>
          <p><a href="/current-affairs/">Go to Current Affairs</a> &middot; <a href="/archive/?type=quiz">Quiz Archive</a></p>
        </div>`;
    } finally { startButton.disabled = false; startButton.textContent = 'Find questions'; }
  }
  picker.addEventListener('submit', (event) => { event.preventDefault(); loadQuiz(); });
  picker.addEventListener('input', (event) => {
    if (!event.target.matches('input, select')) return;
    event.target.removeAttribute('aria-invalid');
    pickerError.hidden = true;
  });
  if (isCustomDate) { landing.hidden = true; loadQuiz(); }
})();
