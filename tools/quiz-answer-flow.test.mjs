import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/js/quiz.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../public/quiz/index.html', import.meta.url), 'utf8');
const check = source.match(/  function checkAnswer\(\) \{[\s\S]*?(?=\r?\n  function buildReview)/)?.[0];
const change = source.match(/  stage\.addEventListener\('change',[\s\S]*?(?=\r?\n  prevButton\.addEventListener)/)?.[0];
assert.ok(check && change, 'quiz check and option-change flow should exist');
assert.doesNotMatch(page, /id="quiz-check"/);

const inputs = ['A', 'B', 'C', 'D'].map((value) => ({ value, disabled: false }));
const labels = inputs.map((input) => {
  const classes = [];
  return { querySelector: () => input, classes, classList: { add(className) { classes.push(className); } } };
});
const state = { checked: false, selected: null, feedbackHtml: '' };
const feedback = { hidden: true, innerHTML: '', scrollOptions: null,
  scrollIntoView(options) { this.scrollOptions = options; } };
const nextButton = { disabled: true, focused: false, focus() { this.focused = true; } };
const listeners = {};
const context = {
  index: 0,
  states: [state],
  questions: [{ correct_answer: 'B', explanation: 'Why B is correct' }],
  stage: {
    querySelectorAll: () => labels,
    addEventListener: (type, handler) => { listeners[type] = handler; },
  },
  feedback,
  nextButton,
  reduceMotion: false,
  correctLetter: (question) => question.correct_answer,
  feedbackHtml: (question, current) => `${current.selected === question.correct_answer ? 'Correct' : 'Incorrect'}: ${question.explanation}`,
  updateControls: () => { nextButton.disabled = !state.checked; },
};
vm.runInNewContext(`${check}\n${change}`, context);
const changeTo = (value) => listeners.change({ target: { value, matches: () => true } });
changeTo('A');
assert.equal(state.selected, 'A');
assert.equal(state.checked, true);
assert.equal(feedback.hidden, false);
assert.equal(feedback.innerHTML, 'Incorrect: Why B is correct');
assert.equal(nextButton.disabled, false);
assert.equal(nextButton.focused, true);
assert.equal(feedback.scrollOptions.block, 'nearest');
assert.equal(feedback.scrollOptions.behavior, 'smooth');
assert.ok(inputs.every((input) => input.disabled));
changeTo('B');
assert.equal(state.selected, 'A', 'answer stays locked after the first choice');
assert.equal(feedback.innerHTML, 'Incorrect: Why B is correct');
state.checked = false;
state.selected = null;
feedback.hidden = true;
nextButton.disabled = true;
inputs.forEach((input) => { input.disabled = false; });
context.reduceMotion = true;
changeTo('B');
assert.equal(state.checked, true);
assert.equal(feedback.innerHTML, 'Correct: Why B is correct');
assert.equal(nextButton.disabled, false);
assert.equal(feedback.scrollOptions.block, 'nearest');
assert.equal(feedback.scrollOptions.behavior, 'auto');
console.log('quiz-answer-flow.test.mjs: selecting an answer immediately reveals feedback and locks the answer');
