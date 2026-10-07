/**
 * Daily Current Affairs — Phase 1.12 verification: ruled writing zones.
 *
 * Guards the "notes on the page" contract (PROJECT_SPEC.md §19) that keeps the
 * ruled lines aligned to the text:
 *   1. every CSS file has balanced braces;
 *   2. the ruled tokens exist and --ruled-line matches the body line grid;
 *   3. the page itself is plain paper (no page-wide ruled gradient);
 *   4. .ruled draws rules at --ruled-line and lifts them by --ruled-rule-offset;
 *   5. zones snap text line-height and block margins to --ruled-line;
 *   6. quiz options inside a zone keep whole-rule row heights;
 *   7. no page nests .ruled inside .ruled;
 *   8. panels (Exam Point, notices) and form fields stay outside zones;
 *   9. every page loads tokens/base/layout/components CSS plus the Sanchez web font.
 *
 * Run: node verify-1-12-check.js
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CSS_DIR = join('public', 'css');
const PROBLEMS = [];
const PASSES = [];

function pass(message) {
  PASSES.push(message);
}

function fail(message) {
  PROBLEMS.push(message);
}

function check(condition, okMessage, failMessage) {
  if (condition) pass(okMessage);
  else fail(failMessage);
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Returns the declaration block for the first exact selector match. */
function blockFor(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^{}]*)\\}`));
  return match ? match[1] : null;
}

function cssFiles() {
  return readdirSync(CSS_DIR)
    .filter((name) => name.endsWith('.css'))
    .sort();
}

function htmlFiles(dir = 'public') {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) found.push(full);
  }
  return found.sort();
}

/* -- 1. CSS braces ------------------------------------------------------ */
for (const name of cssFiles()) {
  const css = stripCssComments(readFileSync(join(CSS_DIR, name), 'utf8'));
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  check(
    open === close && open > 0,
    `${name}: braces balanced (${open} blocks)`,
    `${name}: unbalanced braces (${open} open vs ${close} close)`
  );
}

/* -- 2. Tokens + body grid -------------------------------------------- */
const tokens = stripCssComments(readFileSync(join(CSS_DIR, 'tokens.css'), 'utf8'));
const ruledLine = (tokens.match(/--ruled-line:\s*([\d.]+)rem/) || [])[1];
check(Boolean(ruledLine), `tokens: --ruled-line = ${ruledLine}rem`, 'tokens: --ruled-line missing (rem value expected)');
check(/--ruled-color:\s*#/.test(tokens), 'tokens: --ruled-color present', 'tokens: --ruled-color missing');
check(
  /--ruled-rule-offset:\s*[\d.]+em/.test(tokens),
  'tokens: --ruled-rule-offset present (em value)',
  'tokens: --ruled-rule-offset missing (em value expected)'
);

const base = stripCssComments(readFileSync(join(CSS_DIR, 'base.css'), 'utf8'));
const body = blockFor(base, 'body') || '';
const bodyFont = parseFloat((body.match(/font-size:\s*([\d.]+)rem/) || [])[1]);
// body may declare line-height literally or via var(--leading-body) from tokens.
const leadingSource = body.match(/line-height:\s*var\(--leading-body\)/)
  ? (tokens.match(/--leading-body:\s*([\d.]+)/) || [])[1]
  : (body.match(/line-height:\s*([\d.]+)\s*;/) || [])[1];
const bodyLeading = parseFloat(leadingSource);
const bodyGrid = bodyFont * bodyLeading;
check(
  Math.abs(bodyGrid - Number(ruledLine)) < 0.0001,
  `body grid: ${bodyFont}rem x ${bodyLeading} = ${bodyGrid}rem = --ruled-line`,
  `body grid: ${bodyFont}rem x ${bodyLeading} = ${bodyGrid}rem does not match --ruled-line (${ruledLine}rem)`
);

/* -- 3. Page stays plain paper ---------------------------------------- */
check(
  !/background-image/.test(body),
  'base: body has no ruled gradient (rules live in .ruled zones only)',
  'base: body still paints a page-wide ruled gradient — rules must come from .ruled zones'
);
/* -- 4./5./6. Zone contract ------------------------------------------- */
const components = stripCssComments(readFileSync(join(CSS_DIR, 'components.css'), 'utf8'));
const zone = blockFor(components, '.ruled') || '';
check(
  /repeating-linear-gradient\(/.test(zone) && /transparent 0 calc\(var\(--ruled-line\) - 1px\)/.test(zone),
  'components: .ruled paints repeating rules at --ruled-line',
  'components: .ruled is missing the repeating-linear-gradient at --ruled-line'
);
check(
  /background-position-y:\s*calc\(-1 \* var\(--ruled-rule-offset\)\)/.test(zone),
  'components: .ruled lifts rules with --ruled-rule-offset',
  'components: .ruled does not apply --ruled-rule-offset (rules stay in the descender space)'
);
check(
  /line-height:\s*var\(--ruled-line\)/.test(zone),
  'components: .ruled sets line-height = --ruled-line',
  'components: .ruled does not set line-height = --ruled-line'
);
check(
  /\.ruled\s*>\s*p\s*\{[^}]*margin-block:\s*var\(--ruled-line\)/.test(components),
  'components: zone block margins snap to whole rules',
  'components: zone block margins are not snapped to --ruled-line'
);
check(
  /\.ruled\s*>\s*:last-child\s*\{[^}]*margin-block-end:\s*0/.test(components) &&
    /\.ruled\s*>\s*:first-child\s*\{[^}]*margin-block-start:\s*0/.test(components),
  'components: zone edges are flush (first/last child margins removed)',
  'components: zone edge margins are not reset — the first and last rules can drift'
);
check(
  /\.ruled \.quiz-options\s*\{[^}]*gap:\s*0/.test(components) &&
    /\.ruled \.quiz-option-row\s*\{[^}]*min-height:\s*calc\(2 \* var\(--ruled-line\)\)/.test(components),
  'components: quiz rows inside a zone keep zero gap and two-rule heights',
  'components: quiz rows inside a zone can leave the grid (gap or min-height not snapped)'
);
/* -- 7./8. Zone nesting + panel placement ----------------------------- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BANNED_IN_ZONE = ['exam-point', 'notice', 'field', 'test-yourself'];

function classesOf(attrs) {
  const match = attrs.match(/class\s*=\s*"([^"]*)"/);
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
}

for (const file of htmlFiles()) {
  const html = readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const stack = [];
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let violations = 0;
  let zones = 0;
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const closing = match[1];
    const name = match[2].toLowerCase();
    const attrs = match[3];

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    if (VOID.has(name)) continue;

    const classes = classesOf(attrs);
    const insideZone = stack.some((open) => open.classes.includes('ruled'));

    if (classes.includes('ruled')) {
      zones += 1;
      if (insideZone) {
        violations += 1;
        fail(`${file}: .ruled nested inside .ruled (<${name}>) — two rule phases would overlap`);
      }
    }

    if (insideZone) {
      for (const banned of BANNED_IN_ZONE) {
        if (classes.includes(banned)) {
          violations += 1;
          fail(`${file}: .${banned} placed inside a .ruled zone — panels and fields stay on plain paper`);
        }
      }
    }

    stack.push({ name, classes });
  }

  check(zones > 0, `${file}: ${zones} writing zone(s)`, `${file}: no .ruled writing zone found`);
  check(
    violations === 0,
    `${file}: zone nesting/placement ok`,
    `${file}: ${violations} zone contract violation(s)`
  );
}

/* -- 9. Shared head: stylesheets + fonts ------------------------------ */
const REQUIRED_CSS = ['/css/tokens.css', '/css/base.css', '/css/layout.css', '/css/components.css'];
const FONT_HREF = 'family=Sanchez&display=swap';

for (const file of htmlFiles()) {
  const html = readFileSync(file, 'utf8');
  const missingCss = REQUIRED_CSS.filter((href) => !html.includes(`href="${href}"`));
  check(
    missingCss.length === 0,
    `${file}: loads all 4 stylesheets`,
    `${file}: missing stylesheet link(s): ${missingCss.join(', ')}`
  );
  check(
    html.includes(FONT_HREF),
    `${file}: loads Sanchez (display=swap, the family --font-hand/--font-display declare)`,
    `${file}: font link missing (a system fallback changes metrics and shifts the text grid)`
  );
}

/* -- JS-generated zones ---------------------------------------------- */
const pager = readFileSync(join('public', 'js', 'pager-demo.js'), 'utf8');
check(
  /class="card ruled/.test(pager) && /class="quiz-fieldset"/.test(pager),
  'js: pager card renders as a .ruled zone with a borderless fieldset',
  'js: pager card does not render as a .ruled zone (rules would miss the generated text)'
);

const states = readFileSync(join('public', 'js', 'states-demo.js'), 'utf8');
const statesZone = states.split('<div class="ruled">')[1] || '';
check(
  /<div class="ruled">/.test(states) && !/exam-point/.test(statesZone.split('</div>')[0]),
  'js: simulated content state renders an aligned article zone',
  'js: simulated content state is not an aligned zone (or holds a panel inside it)'
);

/* -- 10. V1 navigation + quiz contracts -------------------------------- */
/* Primary/mobile navs must show Home / Current Affairs / Daily Quiz and must
   not link Revision, Progress or Mock Tests (PROJECT_SPEC_V1_UX.md §3). */
for (const file of htmlFiles()) {
  const html = readFileSync(file, 'utf8');
  const navBlocks = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi) || [];
  const primaryNavs = navBlocks.filter((block) => /site-nav|mobile-nav/.test(block));
  if (primaryNavs.length === 0) continue;
  const hasRevision = primaryNavs.some((block) => block.includes('href="/revision/"'));
  check(
    !hasRevision,
    `${file}: primary nav has no Revision link`,
    `${file}: primary nav still links /revision/ (V1 keeps Revision out of navigation)`
  );
  const hasDailyQuiz = primaryNavs.some((block) => block.includes('/quiz/') && />Daily Quiz</.test(block));
  check(
    hasDailyQuiz,
    `${file}: primary nav links Daily Quiz`,
    `${file}: primary nav does not link Daily Quiz (V1: Home / Current Affairs / Daily Quiz)`
  );
  const hasArchive = primaryNavs.some((block) => block.includes('href="/archive/"'));
  check(
    hasArchive,
    `${file}: primary nav links Archive`,
    `${file}: primary nav does not link /archive/ (Phase 4: + Archive)`
  );
  const hasHome = primaryNavs.some((block) => block.includes('href="/"'));
  check(
    hasHome,
    `${file}: primary nav links Home`,
    `${file}: primary nav does not link Home (V1: Home / Current Affairs / Daily Quiz)`
  );
}

/* Worker quiz routes (V1): list + article lookup. */
const workerSource = readFileSync(join('worker', 'index.js'), 'utf8');
check(
  /pathname === "\/api\/quiz" && request\.method === "GET"/.test(workerSource),
  'worker: GET /api/quiz route registered (V1 Daily Quiz)',
  'worker: GET /api/quiz route missing (V1 needs the Daily Quiz endpoint)'
);
check(
  /pathname === "\/api\/quiz\/article" && request\.method === "GET"/.test(workerSource),
  'worker: GET /api/quiz/article route registered (V1 Test Yourself lookup)',
  'worker: GET /api/quiz/article route missing (V1 needs the article question lookup)'
);

/* Quiz page wires the quiz session script (V1). */
const quizPage = readFileSync(join('public', 'quiz', 'index.html'), 'utf8');
check(
  quizPage.includes('src="/js/quiz.js"'),
  'quiz: page loads /js/quiz.js (V1 Daily Quiz session)',
  'quiz: page does not load /js/quiz.js (V1 needs the Daily Quiz session script)'
);

/* -- 11. Phase 4: archive route + canonical date + bounded UI ----------- */
check(
  /pathname === "\/api\/archive" && request\.method === "GET"/.test(workerSource),
  'worker: GET /api/archive route registered (Phase 4)',
  'worker: GET /api/archive route missing (Phase 4 needs month metadata)'
);
check(
  /MAX_LIMIT = 200/.test(workerSource),
  'worker: MAX_LIMIT is a 200 API ceiling',
  'worker: MAX_LIMIT is not 200'
);

/* One canonical application date (Asia/Kolkata) everywhere: Home, Current
   Affairs, Archive, Daily Quiz and Worker fallbacks must agree (Phase 4). */
const DATE_CONVENTION_FILES = [
  'worker/index.js',
  'public/index.html',
  'public/current-affairs/index.html',
  'public/js/quiz.js',
  'public/archive/index.html',
];
for (const rel of DATE_CONVENTION_FILES) {
  const source = readFileSync(join(...rel.split('/')), 'utf8');
  check(
    source.includes('Asia/Kolkata'),
    `${rel}: canonical app date Asia/Kolkata (Phase 4)`,
    `${rel}: missing Asia/Kolkata — UTC/browser-local drift is not allowed`
  );
}

/* Bounded daily UI: the 200-row ceiling must never become a render size. */
const homeSource = readFileSync(join('public', 'index.html'), 'utf8');
check(
  /PREVIEW_LIMIT = 10/.test(homeSource),
  'home: today preview capped at 10 cards',
  'home: PREVIEW_LIMIT is not 10 (Home must stay a compact preview)'
);
check(
  /QUIZ_SESSION_LIMIT = 10/.test(homeSource),
  'home: quiz probe uses the 10-question session limit',
  'home: QUIZ_SESSION_LIMIT is not 10 (Home must advertise the real session size)'
);
check(
  /session=1/.test(homeSource),
  'home: quiz probe requests the random session endpoint',
  'home: quiz probe does not request session=1 (Home would count the full backlog)'
);
const caSource = readFileSync(join('public', 'current-affairs', 'index.html'), 'utf8');
check(
  /PAGE_SIZE = 20/.test(caSource),
  'current-affairs: daily page size 20 with paging',
  'current-affairs: PAGE_SIZE is not 20 (daily UI must page, never render 200)'
);
check(
  caSource.includes('date: selectedDate'),
  'current-affairs: fetch is explicitly day-scoped (date param)',
  'current-affairs: fetch does not send an explicit date param'
);
check(
  /id="start-day"/.test(caSource),
  'current-affairs: day page has a Start Today Study entry point',
  'current-affairs: day page is missing the Start Today Study CTA (PROJECT_SPEC §6)'
);

/* -- 12. Daily Quiz session: 10 random questions (PROJECT_SPEC §10) -------- */
check(
  /QUIZ_SESSION_SIZE = 10/.test(workerSource),
  'worker: QUIZ_SESSION_SIZE is 10',
  'worker: QUIZ_SESSION_SIZE is not 10 (the student session must be 10 questions)'
);
check(
  /ORDER BY random\(\)/.test(workerSource),
  'worker: quiz session is randomly ordered',
  'worker: quiz session is not random (ORDER BY random() missing — the same fixed questions repeat)'
);
check(
  /get\("session"\) === "1"/.test(workerSource),
  'worker: quiz session is opt-in via session=1',
  'worker: quiz session flag missing (the list endpoint must stay available)'
);

const quizJs = readFileSync(join('public', 'js', 'quiz.js'), 'utf8');
check(
  /QUIZ_SESSION_LIMIT = 10/.test(quizJs),
  'quiz: session limited to 10 questions',
  'quiz: QUIZ_SESSION_LIMIT is not 10 (the UI must render a 10-question session)'
);
check(
  /session=1/.test(quizJs),
  'quiz: page requests the random session endpoint',
  'quiz: page does not request session=1 (it would render the full backlog)'
);

/* -- 13. Anonymous article rating (PROJECT_SPEC §11) --------------------- */
check(
  /POST \/api\/article-rating/.test(workerSource),
  'worker: POST /api/article-rating route registered',
  'worker: POST /api/article-rating route missing (§11 needs a submission endpoint)'
);
check(
  /INSERT INTO article_ratings/.test(workerSource),
  'worker: rating insert targets article_ratings',
  'worker: rating insert is missing the article_ratings write'
);
check(
  /isUuid\(anonymousId\)/.test(workerSource) &&
    /ON CONFLICT \(article_id, anonymous_id\) DO NOTHING/.test(workerSource),
  'worker: validates anonymous UUID and dedupes conflicts server-side',
  'worker: rating lacks UUID validation or database conflict deduplication'
);
const ratingMigration = readFileSync(join('db', 'migrations', '002_create_article_ratings.sql'), 'utf8');
check(
  /rating BETWEEN 1 AND 5/.test(ratingMigration),
  'migration 002: rating constrained to 1-5',
  'migration 002: rating CHECK constraint missing'
);
check(
  /article_id\s+BIGINT NOT NULL REFERENCES public\.current_affairs\(id\) ON DELETE CASCADE/.test(ratingMigration) &&
    /anonymous_id\s+UUID NOT NULL/.test(ratingMigration) &&
    /UNIQUE \(article_id, anonymous_id\)/.test(ratingMigration),
  'migration 002: enforces article ownership and one anonymous rating per article',
  'migration 002: foreign key, UUID identity, or unique rating constraint missing'
);
const articleSource = readFileSync(join('public', 'current-affairs', 'article.html'), 'utf8');
check(
  /article-rating-star/.test(articleSource),
  'article: rating widget present (5 star buttons)',
  'article: rating widget missing (§11 anonymous feedback)'
);
check(
  /RATING_KEY = 'dca-article-ratings'/.test(articleSource),
  'article: rating dedupes repeat submissions client-side',
  'article: rating has no client-side dedupe (accidental repeat submissions)'
);
check(
  /ANONYMOUS_ID_KEY = 'dca-anonymous-id'/.test(articleSource) &&
    /crypto\.randomUUID\(\)/.test(articleSource) &&
    /anonymousId: getAnonymousId\(\)/.test(articleSource),
  'article: rating submits a browser-scoped anonymous UUID',
  'article: rating does not send a persistent anonymous UUID'
);
/* §11 is anonymous: the rating form must not collect identity. The word
   "account"/"email" in prose ("no account or PII") is fine; an input that
   asks for them is not. */
const ratingForm = articleSource.match(
  /<section class="article-rating"[\s\S]*?<\/section>/
) || [];
check(
  !/<input\b[^>]*\b(name|email|password|account)\b/i.test(ratingForm[0] || ''),
  'article: rating collects no personal data',
  'article: rating form appears to request personal data (§11 requires anonymous)'
);

/* -- Report ----------------------------------------------------------- */
for (const message of PASSES) console.log(`  ok   ${message}`);
if (PROBLEMS.length) {
  console.log('');
  for (const message of PROBLEMS) console.error(`  FAIL ${message}`);
  console.error(`\nPhase 1.12 check: ${PROBLEMS.length} problem(s), ${PASSES.length} passed.`);
  process.exit(1);
}
console.log(`\nPhase 1.12 check: all ${PASSES.length} checks passed.`);


