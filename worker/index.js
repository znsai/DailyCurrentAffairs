/**
 * Daily Current Affairs — Cloudflare Worker API
 *
 * Architecture (AI_RULES.md): Frontend -> this Worker -> Neon PostgreSQL.
 * This Worker is the ONLY layer that talks to the database.
 *
 * Endpoints (minimal set per AI_RULES.md section 8):
 *   GET /api/health                 -> liveness check
 *   GET /api/current-affairs        -> latest articles (?date=YYYY-MM-DD & ?subject= & ?page= & ?limit=)
 *   GET /api/current-affairs/:id    -> one article (article.html reads it; /current-affairs/:id serves the shell)
 *   GET /api/search?q=keyword       -> search titles/summaries
 *
 * DATABASE_URL is provided via Cloudflare secrets/vars — never hardcoded.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

    const articleIdMatch = pathname.match(/^\/api\/current-affairs\/(\d+)\/?$/);
    if (articleIdMatch && request.method === "GET") {
      return handleArticle(Number(articleIdMatch[1]), env);
    }

    if (pathname === "/api/search" && request.method === "GET") {
      return handleSearch(url, env);
    }

    // Clean article URLs (/current-affairs/15) serve the article shell, and any
    // other /current-affairs/* path falls through to static assets — the assets
    // config routes that prefix to the Worker first (see wrangler.toml).
    if (request.method === "GET" || request.method === "HEAD") {
      const articleSlug = pathname.match(/^\/current-affairs\/(\d+)\/?$/);
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

/** Build filter conditions from optional date + subject params */
function buildCurrentAffairsWhere(url) {
  const conditions = [];
  const params = [];

  const date = url.searchParams.get("date");
  if (date) {
    if (!isValidDate(date)) {
      return { error: "Invalid date format, expected YYYY-MM-DD", sql: "", params: [] };
    }
    params.push(date);
    conditions.push(`date = $${params.length}`);
  }

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

  const sqlFull = `
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important, created_at
    FROM current_affairs
    ${sql}
    ORDER BY date DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  try {
    const rows = await query(env.DATABASE_URL, sqlFull, params);
    return json({ page, limit, count: rows.length, articles: rows });
  } catch (err) {
    console.error("current-affairs query failed:", err);
    return errorResponse("Database query failed", 500);
  }
}

/**
 * GET /api/current-affairs/:id -> one article as a raw row (article.html renders it directly).
 */
async function handleArticle(id, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  const sql = `
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important, created_at
    FROM current_affairs
    WHERE id = $1
  `;

  try {
    const rows = await query(env.DATABASE_URL, sql, [id]);
    if (rows.length === 0) {
      return errorResponse("Article not found", 404);
    }
    return json(rows[0]);
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
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important, created_at
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
    return json({ query: q, page, limit, count: rows.length, articles: rows });
  } catch (err) {
    console.error("search query failed:", err);
    return errorResponse("Database query failed", 500);
  }
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
