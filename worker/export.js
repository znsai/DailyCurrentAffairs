/**
 * Monthly export — generation runner.
 *
 * One job = one month. The job is idempotent: rerunning a month regenerates
 * the PDF, stores it under the same key (monthly/<YYYY-MM>.pdf) and upserts
 * the metadata row, so a retry never produces duplicate exports.
 *
 * Flow: query the month's articles ordered by subject/date -> build the
 * topic-grouped PDF -> put it in R2 -> upsert monthly_exports. The R2 write
 * happens before the metadata upsert so a metadata row only exists for a PDF
 * that is already stored and downloadable.
 */

import { buildMonthlyPdf } from "./pdf.js";
import {
  PDF_CONTENT_TYPE, adjacentMonths, monthLabel, monthRange, pdfKey,
} from "./monthly.js";

/**
 * Fetch a month's articles ordered for topic grouping.
 * Ordering by subject then date means the PDF builder can stream the rows
 * into sections without a second pass, and articles never need a topic column.
 */
async function fetchMonthArticles(databaseUrl, month) {
  const { start, next } = monthRange(month);
  const sql = `
    SELECT to_char(date, 'YYYY-MM-DD') AS date, title, url, subject, brief_summary, what_is_important
    FROM current_affairs
    WHERE date >= $1 AND date < $2
    ORDER BY subject ASC, date ASC, id ASC
  `;
  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(sql, [start, next]);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

/** Grouped article counts per topic, for the index page and metadata. */
function topicCounts(articles) {
  const counts = new Map();
  for (const article of articles) counts.set(article.subject, (counts.get(article.subject) ?? 0) + 1);
  return [...counts.entries()].map(([subject, count]) => ({ subject, count })).sort((a, b) => a.subject.localeCompare(b.subject));
}

/**
 * Generate and store one month's PDF.
 *
 * @param {object} args
 * @param {string} args.month        "YYYY-MM"
 * @param {string} args.databaseUrl  Neon pooled connection string
 * @param {object} args.bucket       R2 bucket binding (env.MONTHLY_EXPORTS)
 * @param {object} [args.env]        Worker env, used to record metadata when present
 * @returns {Promise<object>}        { month, storageKey, articleCount, topicCount, byteSize }
 */
export async function generateMonthlyExport({ month, databaseUrl, bucket, env }) {
  if (!bucket) throw new Error("R2 bucket binding MONTHLY_EXPORTS is not configured");

  const articles = await fetchMonthArticles(databaseUrl, month);
  const pdfBytes = await buildMonthlyPdf({ month, articles });
  const storageKey = pdfKey(month);

  // Store the finished PDF before recording any metadata, so a metadata row
  // only ever points at an object that is already downloadable.
  await bucket.put(storageKey, pdfBytes, {
    httpMetadata: { contentType: PDF_CONTENT_TYPE },
    customMetadata: {
      month,
      "article-count": String(articles.length),
      "topic-count": String(new Set(articles.map((a) => a.subject)).size),
      generated_at: new Date().toISOString(),
    },
  });

  const summary = {
    month,
    storageKey,
    articleCount: articles.length,
    topicCount: new Set(articles.map((a) => a.subject)).size,
    byteSize: pdfBytes.byteLength,
  };

  if (env?.DATABASE_URL) {
    await recordExport(env.DATABASE_URL, summary);
  }

  return summary;
}

/** Upsert the export metadata. Reruns replace the same month's row. */
async function recordExport(databaseUrl, summary) {
  const sql = `
    INSERT INTO monthly_exports (month, storage_key, article_count, topic_count, byte_size, status, generated_at)
    VALUES ($1, $2, $3, $4, $5, 'ready', now())
    ON CONFLICT (month) DO UPDATE
    SET storage_key = EXCLUDED.storage_key,
        article_count = EXCLUDED.article_count,
        topic_count = EXCLUDED.topic_count,
        byte_size = EXCLUDED.byte_size,
        status = 'ready',
        generated_at = now()
  `;
  const { Client } = await import("pg");
  const optionalClient = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await optionalClient.connect();
  try {
    await optionalClient.query(sql, [
      summary.month, summary.storageKey, summary.articleCount, summary.topicCount, summary.byteSize,
    ]);
  } finally {
    await optionalClient.end().catch(() => {});
  }
}

export { fetchMonthArticles, topicCounts, monthLabel, adjacentMonths };
