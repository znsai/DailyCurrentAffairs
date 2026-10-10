import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calendar = await readFile(new URL('../public/js/calendar.js', import.meta.url), 'utf8');
// Pure calendar math is deliberately testable without a browser or timezone.
const math = calendar.slice(calendar.indexOf('  const pad ='), calendar.indexOf('  let active ='));
const limits = calendar.slice(calendar.indexOf('  function bounds('), calendar.indexOf('  function label('));
const ctx = vm.createContext({});
vm.runInContext(`${math}\n${limits}\nthis.math = { isoDate, parseDate, parseMonth, isoMonth, addDays, addMonths, monthCells, allowed, allowedMonth };`, ctx);
const { isoDate, parseDate, parseMonth, isoMonth, addDays, addMonths, monthCells, allowed, allowedMonth } = ctx.math;

assert.equal(isoDate(2024, 2, 9), '2024-02-09');
assert.equal(parseDate('2024-02-29')?.getUTCDate(), 29);
assert.equal(parseDate('2025-02-29'), null);
assert.equal(parseDate('2026-04-31'), null);
assert.equal(parseDate('2026-13-01'), null);
assert.equal(addDays('2024-02-28', 1), '2024-02-29');
assert.equal(addDays('2024-02-29', 1), '2024-03-01');
assert.equal(addDays('2026-01-01', -1), '2025-12-31');
assert.equal(addMonths(2026, 1, -1).join('-'), '2025-12');
assert.equal(addMonths(2026, 12, 1).join('-'), '2027-1');
assert.equal(monthCells(2024, 2).length, 42);
assert.ok(monthCells(2024, 2).includes('2024-02-29'));
assert.equal(monthCells(2024, 2)[0], '2024-01-29');
const input = { min: '2024-02-20', max: '2024-03-03', dataset: { calendarMaxToday: 'false' } };
assert.equal(allowed(input, '2024-02-19'), false);
assert.equal(allowed(input, '2024-02-20'), true);
assert.equal(allowed(input, '2024-02-29'), true);
assert.equal(allowed(input, '2024-03-03'), true);
assert.equal(allowed(input, '2024-03-04'), false);
assert.equal(allowed(input, '2025-02-29'), false);
assert.equal(isoMonth(2024, 2), '2024-02');
assert.equal(parseMonth('2024-02')?.month, 2);
for (const invalid of ['', '0000-01', '2024-00', '2024-13', '2024-2']) assert.equal(parseMonth(invalid), null);
const monthInput = { min: '2024-02', max: '2026-10', dataset: { calendarMaxToday: 'false' } };
assert.equal(allowedMonth(monthInput, '2024-01'), false);
assert.equal(allowedMonth(monthInput, '2024-02'), true);
assert.equal(allowedMonth(monthInput, '2026-10'), true);
assert.equal(allowedMonth(monthInput, '2026-11'), false);

const quiz = await readFile(new URL('../public/js/quiz.js', import.meta.url), 'utf8');
const dayView = await readFile(new URL('../public/current-affairs/index.html', import.meta.url), 'utf8');
const quizPage = await readFile(new URL('../public/quiz/index.html', import.meta.url), 'utf8');
assert.match(quiz, /window\.TCACalendar\?\.enhance\(pickerFields\)/);
assert.match(quiz, /data-calendar-range="topic"/);
assert.match(quiz, /type === 'date' \? `data-calendar/);
assert.match(quiz, /type === 'month' \? 'data-month-picker/);
assert.match(quiz, /id="quiz-week-month"[^`]*data-month-picker/);
assert.match(dayView, /window\.TCACalendar\?\.enhance\(document\.getElementById\('study-date-picker'\)\)/);
for (const page of [dayView, quizPage]) {
  assert.match(page, /\/js\/calendar\.js/);
  assert.match(page, /\/css\/calendar\.css/);
}
console.log('calendar.test.mjs: passed date arithmetic, leap/month boundaries and integration wiring');
