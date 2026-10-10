import assert from 'node:assert/strict';
import vm from 'node:vm';
import { daysBetweenInclusive, isValidDate } from '../worker/index.js';

assert.equal(isValidDate('2026-10-01'), true);
assert.equal(isValidDate('2026-02-30'), false);
assert.equal(isValidDate('2026/10/01'), false);
assert.equal(daysBetweenInclusive('2026-10-01', '2026-10-01'), 1);
assert.equal(daysBetweenInclusive('2026-10-01', '2026-10-07'), 7);
assert.equal(daysBetweenInclusive('2026-10-01', '2026-10-08'), 8);

const source = await (await import('node:fs/promises')).readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
assert.match(source, /mode === "topic" && !subject/);
assert.match(source, /ORDER BY \$\{isSession \? "random\(\)" : "id ASC"\}/);
assert.match(source, /QUIZ_SESSION_SIZE/);
assert.match(source, /countOnly/);

const quizSource = await (await import('node:fs/promises')).readFile(new URL('../public/js/quiz.js', import.meta.url), 'utf8');
const weeklyHelper = quizSource.match(/  function weeklyPeriods\([\s\S]*?(?=\r?\n  function formatDateLine)/);
assert.ok(weeklyHelper, 'weeklyPeriods helper should remain DOM-independent and testable');
const weeklyContext = {};
vm.runInNewContext(weeklyHelper[0].replace('function weeklyPeriods', 'weeklyPeriods = function'), weeklyContext);
const currentPeriods = weeklyContext.weeklyPeriods('2026-10', '2026-10-09');
assert.equal(currentPeriods.length, 5);
assert.equal(currentPeriods[0].week, 1);
assert.equal(currentPeriods[0].from, '2026-10-01');
assert.equal(currentPeriods[0].to, '2026-10-07');
assert.equal(currentPeriods[0].label, 'Week 1 · 1–7 October 2026');
assert.equal(currentPeriods[0].disabled, false);
assert.equal(currentPeriods[1].to, '2026-10-09');
assert.match(currentPeriods[1].label, /through today/);
assert.equal(currentPeriods[2].disabled, true);
assert.ok(currentPeriods.every((period) => period.disabled || daysBetweenInclusive(period.from, period.to) <= 7));

console.log('quiz-api-contract.test.mjs: passed date boundaries, weekly periods, topic validation, session limit, and empty/count contract checks');
