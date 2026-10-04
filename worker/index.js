/**
 * Daily Current Affairs — Cloudflare Worker API
 *
 * Architecture (AI_RULES.md): Frontend -> this Worker -> Neon PostgreSQL.
 * This Worker is the ONLY layer that talks to the database.
 *
 * Endpoints (minimal set per AI_RULES.md section 8):
 *   GET /api/health                 -> liveness check
 *   GET /api/current-affairs        -> latest articles (?date=YYYY-MM-DD & ?subject= & ?page= & ?limit=)
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

    if (pathname === "/api/search" && request.method === "GET") {
      return handleSearch(url, env);
    }

    return errorResponse("Not found", 404);
  },
};

/**
 * GET /api/current-affairs?date=YYYY-MM-DD&subject=Economy&page=1&limit=20
 * Server-side filtering + pagination (AI_RULES.md section 10).
 */
async function handleCurrentAffairs(url, env) {
  if (!env.DATABASE_URL) {
    return errorResponse("DATABASE_URL is not configured", 500);
  }

  const date = url.searchParams.get("date");
  const subject = url.searchParams.get("subject");
  if (date && !isValidDate(date)) {
    return errorResponse("Invalid date format, expected YYYY-MM-DD");
  }

  const { page, limit, offset } = parsePagination(url);

  // Build parameterized query (no string interpolation of user input)
  const conditions = [];
  const params = [];
  if (date) {
    params.push(date);
    conditions.push(`date = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    conditions.push(`subject = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);

  const sql = `
    SELECT id, date, title, url, subject, brief_summary, what_is_important, created_at
    FROM current_affairs
    ${where}
    ORDER BY date DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  try {
    const rows = await query(env.DATABASE_URL, sql, params);
    return json({ page, limit, count: rows.length, articles: rows });
  } catch (err) {
    console.error("current-affairs query failed:", err);
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
    SELECT id, date, title, url, subject, brief_summary, what_is_important, created_at
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
