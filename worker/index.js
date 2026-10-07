/**
 * Daily Current Affairs — Cloudflare Worker API
 *
 * Architecture (AI_RULES.md): Frontend -> this Worker -> Neon PostgreSQL.
 * This Worker is the ONLY layer that talks to the database.
 *
 * Endpoints (minimal set per AI_RULES.md section 8):
 *   GET /api/health                 -> liveness check
 *   GET /api/current-affairs        -> current-day articles by default (?date=YYYY-MM-DD & ?subject= & ?page= & ?limit=)
 *   GET /api/current-affairs/:ref   -> one article by opaque public reference (article.html reads it)
 *   GET /api/search?q=keyword       -> search titles/summaries
 *   GET /api/quiz?date=YYYY-MM-DD   -> Daily Quiz questions for one day (V1)
 *   GET /api/quiz/article?url=...   -> the question linked to one article, if any (V1)
 *   GET /api/archive?month=YYYY-MM  -> month metadata: dates with article counts (Phase 4)
 *   POST /api/article-rating        -> anonymous 1-5 article feedback (PROJECT_SPEC §11)
 *
 * Canonical app date: Asia/Kolkata. The frontend always sends explicit local
 * dates/months; server fallbacks use appToday() so behavior never depends on
 * UTC versus browser date.
 *
 * DATABASE_URL is provided via Cloudflare secrets/vars — never hardcoded.
 */

const DEFAULT_LIMIT = 20;
// API ceiling only — UI callers pin small limits (home 10, daily 20, search 20, quiz 50).
const MAX_LIMIT = 200;
// Student-facing Daily Quiz session size (PROJECT_SPEC §10): the backend may
// hold many questions per day, but the quiz the student takes is 10 random ones.
const QUIZ_SESSION_SIZE = 10;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

function errorResponse(message, status = 400) {
  return json({ error: message }, status);
}

/** Canonical application date (Asia/Kolkata) for server-side defaults.
 *  The frontend always sends explicit local dates; this is a fallback only,
 *  so normal behavior never depends on UTC versus browser date. */
function appToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Public article references are opaque, non-sequential identifiers.
// They are reversible only by the Worker; the database primary key stays internal.
const ARTICLE_REF_PREFIX = "ca-";
const ARTICLE_REF_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ARTICLE_REF_A = 1103515245;
const ARTICLE_REF_C = 12345;
const ARTICLE_REF_A_INV = 4005161829;

function articleRefFromId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > 0xffffffff) return null;
  let n = (Math.imul(value, ARTICLE_REF_A) + ARTICLE_REF_C) >>> 0;
  let encoded = "";
  do {
    encoded = ARTICLE_REF_ALPHABET[n % ARTICLE_REF_ALPHABET.length] + encoded;
    n = Math.floor(n / ARTICLE_REF_ALPHABET.length);
  } while (n > 0);
  return ARTICLE_REF_PREFIX + encoded;
}

function articleIdFromRef(ref) {
  if (typeof ref !== "string" || !ref.startsWith(ARTICLE_REF_PREFIX)) return null;
  const encoded = ref.slice(ARTICLE_REF_PREFIX.length);
  if (!encoded || encoded.length > 8) return null;

  let n = 0;
  for (const char of encoded) {
    const digit = ARTICLE_REF_ALPHABET.indexOf(char);
    if (digit < 0) return null;
    n = n * ARTICLE_REF_ALPHABET.length + digit;
    if (n > 0xffffffff) return null;
  }

  const id = Math.imul((n - ARTICLE_REF_C) >>> 0, ARTICLE_REF_A_INV) >>> 0;
  return id >= 1 ? id : null;
}

/** Validate YYYY-MM-DD */
function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Parse and clamp pagination params */
function parsePagination(url) {
  let page = parseInt(url.searchParams.get("page") ?? "1", 10);
  let limit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS for API routes (frontend may be served from same origin, but keep it permissive for now)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }

    if (pathname === "/api/health" && request.method === "GET") {
      return json({
        status: "ok",
        hasDatabase: Boolean(env.DATABASE_URL),
        time: new Date().toISOString(),
      });
    }

    if (pathname === "/api/current-affairs" && request.method === "GET") {
      return handleCurrentAffairs(url, env);
    }

    const articleIdMatch = pathname.match(/^\/api\/current-affairs\/(ca-[A-Za-z0-9]+)\/?$/);
    if (articleIdMatch && request.method === "GET") {
      return handleArticle(articleIdMatch[1], env);
    }

    if (pathname === "/api/search" && request.method === "GET") {
      return handleSearch(url, env);
    }

    if (pathname === "/api/quiz" && request.method === "GET") {
      return handleQuizList(url, env);
    }

    if (pathname === "/api/quiz/article" && request.method === "GET") {
      return handleQuizForArticle(url, env);
    }

    if (pathname === "/api/archive" && request.method === "GET") {
      return handleArchive(url, env);
    }

    if (pathname === "/api/article-rating" && request.method === "POST") {
      return handleArticleRating(request, env);
    }

    // Clean article URLs (/current-affairs/ca-1Ok3oB) serve the article shell, and any
    // other /current-affairs/* path falls through to static assets — the assets
    // config routes that prefix to the Worker first (see wrangler.toml).
    if (request.method === "GET" || request.method === "HEAD") {
      const articleSlug = pathname.match(/^\/current-affairs\/(ca-[A-Za-z0-9]+)\/?$/);
      if (articleSlug) {
        return env.ASSETS.fetch(new Request(new URL("/current-affairs/article.html", url)));
      }
      if (pathname.startsWith("/current-affairs/")) {
        return env.ASSETS.fetch(request);
      }
    }

    return errorResponse("Not found", 404);
  },
};

/** Build filter conditions from the app-day default + optional subject param */
function buildCurrentAffairsWhere(url) {
  const conditions = [];
  const params = [];

  const date = url.searchParams.get("date") || appToday();
  if (!isValidDate(date)) {
    return { error: "Invalid date format, expected YYYY-MM-DD", sql: "", params: [] };
  }
  params.push(date);
  conditions.push(`date = $${params.length}`);

  const subject = url.searchParams.get("subject");
  if (subject) {
    params.push(subject);
    conditions.push(`subject = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return { error: null, sql: where, params };
}

/**
 * GET /api/current-affairs?date=YYYY-MM-DD&subject=Economy&page=1&limit=20
 * `date` defaults to the canonical app date (Asia/Kolkata); frontend callers
 * send it explicitly.
 * Server-side filtering + pagination (AI_RULES.md section 10).
 */
async function handleCurrentAffairs(url, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  const { error, sql, params } = buildCurrentAffairsWhere(url);
  if (error) {
    return errorResponse(error, 400);
  }

  const { page, limit, offset } = parsePagination(url);

  params.push(limit, offset);

  // Day-scoped requests get an exact total (bounded to one day's index scan).
  const dateScoped = (url.searchParams.get("date") ?? "") !== "";

  const sqlFull = `
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important, created_at,
           EXISTS (SELECT 1 FROM quizzes q WHERE q.url = current_affairs.url) AS has_quiz${dateScoped ? ", COUNT(*) OVER() AS total" : ""}
    FROM current_affairs
    ${sql}
    ORDER BY date DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  try {
    const rows = await query(env.DATABASE_URL, sqlFull, params);
    let total;
    if (dateScoped) {
      total = rows.length > 0 ? Number(rows[0].total) : 0;
      for (const row of rows) delete row.total;
    }
    return json({
      page, limit, count: rows.length,
      ...(dateScoped ? { total } : {}),
      articles: rows.map(({ id, ...article }) => ({
        ...article,
        public_id: articleRefFromId(id),
      })),
    });
  } catch (err) {
    console.error("current-affairs query failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * GET /api/current-affairs/:ref -> one article by its opaque public reference.
 */
async function handleArticle(ref, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  const id = articleIdFromRef(ref);
  if (!id) {
    return errorResponse("Invalid article reference", 400);
  }

  const sql = `
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important, created_at,
           EXISTS (SELECT 1 FROM quizzes q WHERE q.url = current_affairs.url) AS has_quiz
    FROM current_affairs
    WHERE id = $1
  `;

  try {
    const rows = await query(env.DATABASE_URL, sql, [id]);
    if (rows.length === 0) {
      return errorResponse("Article not found", 404);
    }
    const { id: internalId, ...article } = rows[0];
    return json({ ...article, public_id: articleRefFromId(internalId) });
  } catch (err) {
    console.error("article query failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * GET /api/search?q=keyword&page=1&limit=20
 * Case-insensitive search over title, brief_summary, what_is_important.
 */
async function handleSearch(url, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return errorResponse("Missing required query parameter: q");
  }
  if (q.length > 100) {
    return errorResponse("Search query too long (max 100 chars)");
  }

  const { page, limit, offset } = parsePagination(url);
  const params = [`%${q}%`];

  const sql = `
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important, created_at,
           EXISTS (SELECT 1 FROM quizzes q WHERE q.url = current_affairs.url) AS has_quiz
    FROM current_affairs
    WHERE title ILIKE $1
       OR brief_summary ILIKE $1
       OR what_is_important ILIKE $1
    ORDER BY date DESC, id DESC
    LIMIT $2 OFFSET $3
  `;
  params.push(limit, offset);

  try {
    const rows = await query(env.DATABASE_URL, sql, params);
    return json({ query: q, page, limit, count: rows.length, articles: rows.map(({ id, ...article }) => ({ ...article, public_id: articleRefFromId(id) })) });
  } catch (err) {
    console.error("search query failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * GET /api/quiz?date=YYYY-MM-DD&limit=10&session=1
 * Daily Quiz questions for one day (V1). `date` defaults to the canonical app
 * date (Asia/Kolkata) when omitted; the frontend always sends it explicitly.
 *
 * `session=1` selects the student-facing Daily Quiz session: at most 10
 * questions, chosen at random for that day (PROJECT_SPEC §10). Randomness is
 * done in the database with ORDER BY random() so the Worker never fetches
 * rows it will discard, and the same fixed first 10 are never repeated.
 * Without `session=1` the endpoint stays a bounded, id-ordered list.
 */
async function handleQuizList(url, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  let date = url.searchParams.get("date");
  if (!date) {
    date = appToday();
  } else if (!isValidDate(date)) {
    return errorResponse("Invalid date format, expected YYYY-MM-DD");
  }

  const isSession = url.searchParams.get("session") === "1";
  const { page, limit, offset } = parsePagination(url);
  const params = [date];

  let sql;
  if (isSession) {
    // One query, no offset: the database picks the session.
    sql = `
      SELECT id, to_char(date, 'YYYY-MM-DD') AS date, url, subject, question,
             option_a, option_b, option_c, option_d, correct_answer, explanation
      FROM quizzes
      WHERE date = $1
      ORDER BY random()
      LIMIT ${QUIZ_SESSION_SIZE}
    `;
  } else {
    params.push(limit, offset);
    sql = `
      SELECT id, to_char(date, 'YYYY-MM-DD') AS date, url, subject, question,
             option_a, option_b, option_c, option_d, correct_answer, explanation
      FROM quizzes
      WHERE date = $1
      ORDER BY id ASC
      LIMIT $2 OFFSET $3
    `;
  }

  try {
    const rows = await query(env.DATABASE_URL, sql, params);
    return json({ date, page, limit, count: rows.length, questions: rows });
  } catch (err) {
    console.error("quiz query failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * GET /api/quiz/article?url=https%3A%2F%2F...
 * The question associated with one article's source URL, if any.
 * Absence is a normal state (not every article has a quiz), so a miss
 * returns 200 with { question: null } instead of a 404.
 */
async function handleQuizForArticle(url, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  const target = (url.searchParams.get("url") ?? "").trim();
  if (!target) {
    return errorResponse("Missing required query parameter: url");
  }
  if (target.length > 2048) {
    return errorResponse("url query parameter too long");
  }

  const sql = `
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, url, subject, question,
           option_a, option_b, option_c, option_d, correct_answer, explanation
    FROM quizzes
    WHERE url = $1
    LIMIT 1
  `;

  try {
    const rows = await query(env.DATABASE_URL, sql, [target]);
    return json({ question: rows[0] ?? null });
  } catch (err) {
    console.error("quiz article lookup failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * GET /api/archive?month=YYYY-MM
 * Month metadata for the Archive calendar: dates with article counts only.
 * Never returns articles. `month` defaults to the canonical app month
 * (Asia/Kolkata) when omitted; the frontend always sends it explicitly.
 */
async function handleArchive(url, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  let month = url.searchParams.get("month");
  if (!month) {
    month = appToday().slice(0, 7);
  } else if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return errorResponse("Invalid month format, expected YYYY-MM");
  }

  const monthNum = Number(month.slice(5, 7));
  const yearNum = Number(month.slice(0, 4));
  const nextMonth = monthNum === 12
    ? `${yearNum + 1}-01`
    : `${month.slice(0, 5)}${String(monthNum + 1).padStart(2, "0")}`;
  const params = [`${month}-01`, `${nextMonth}-01`];

  const sql = `
    SELECT to_char(date, 'YYYY-MM-DD') AS date, COUNT(*) AS count
    FROM current_affairs
    WHERE date >= $1 AND date < $2
    GROUP BY date
    ORDER BY date ASC
  `;

  try {
    const rows = await query(env.DATABASE_URL, sql, params);
    return json({
      month,
      days: rows.map((row) => ({ date: row.date, count: Number(row.count) })),
    });
  } catch (err) {
    console.error("archive query failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * POST /api/article-rating  { articleRef: "ca-...", rating: 1..5 }
 * Anonymous editorial-quality feedback (PROJECT_SPEC §11). No accounts, no
 * PII — the body carries only the article id and a 1-5 score. Duplicate
 * guarding is client-side (localStorage) by design; this endpoint stays
 * permissive so a cleared store can still submit. The response is always a
 * fixed shape so the widget never leaks whether a row was stored.
 */
async function handleArticleRating(request, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const articleId = articleIdFromRef(body?.articleRef);
  const rating = Number(body?.rating);

  if (!Number.isInteger(articleId) || articleId < 1) {
    return errorResponse("articleRef must be a valid article reference", 400);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorResponse("rating must be an integer between 1 and 5", 400);
  }

  try {
    await query(
      env.DATABASE_URL,
      `INSERT INTO article_ratings (article_id, rating) VALUES ($1, $2)`,
      [articleId, rating]
    );
  } catch (err) {
    // The table may not be provisioned yet, or the article may not exist.
    // Feedback is optional: never break the article page over it.
    console.error("article rating insert failed:", err);
    return json({ ok: true, stored: false });
  }

  return json({ ok: true, stored: true });
}

/**
 * Minimal Postgres query helper using node-postgres over TCP.
 * Cloudflare Workers support nodejs_compat for the `pg` driver.
 * Kept dependency-light; a pool is created lazily and reused.
 */
let clientPromise = null;

async function query(databaseUrl, sql, params) {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}
