/**
 * Monthly export — PDF generation (pdf-lib).
 *
 * One PDF per month, organized by topic: a cover page with month/counts, then
 * one section per canonical subject containing that subject's articles in
 * date order. Articles are never duplicated across sections — the grouping is
 * a query-time ORDER BY subject, date, not stored data.
 *
 * Layout is deliberately typographic (no images, no fonts embedded beyond
 * pdf-lib's standard fonts) so the Worker stays dependency-light and the PDF
 * stays small enough to email/print.
 */

import { PDFFont, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { monthLabel } from "./monthly.js";

// Design tokens mirrored from public/css/tokens.css so the PDF reads like the site.
const INK = rgb(0.082, 0.224, 0.263); // --color-brand-ink #153e43
const TEXT = rgb(0.11, 0.098, 0.09); // --color-text #1c1917
const MUTED = rgb(0.278, 0.333, 0.412); // --color-muted #475569
const ACCENT = rgb(0.573, 0.251, 0.055); // --color-accent #92400e
const RULE = rgb(0.906, 0.898, 0.894); // --color-border #e7e5e4
const ACCENT_BG = rgb(0.996, 0.953, 0.78); // --color-accent-bg #fef3c7

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, in pt
const MARGIN = 56;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const FONT_SIZE_TITLE = 24;
const FONT_SIZE_H1 = 18;
const FONT_SIZE_H2 = 13;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SMALL = 8.5;
const LEADING = 14;

/** Wrap text to a width in points using pdf-lib's per-font width measurement. */
function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      // A single word longer than the line is hard-wrapped by character.
      if (!line && font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
        continue;
      }
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/**
 * Build the monthly PDF.
 *
 * @param {object} args
 * @param {string} args.month       "YYYY-MM" being exported
 * @param {Array}  args.articles    [{ date, title, url, subject, brief_summary, what_is_important }]
 * @param {string} [args.siteName]  Cover-page brand line
 * @returns {Promise<Uint8Array>}   PDF bytes
 */
export async function buildMonthlyPdf({ month, articles, siteName = "topcurrentaffairs.in" }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Current Affairs — ${monthLabel(month)}`);
  doc.setSubject("Monthly current affairs, organized by topic");
  doc.setCreator(siteName);
  doc.setCreationDate(new Date());

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let cursor = PAGE.height - MARGIN;

  /** Start a new page and return the fresh cursor. */
  function newPage() {
    page = doc.addPage([PAGE.width, PAGE.height]);
    return PAGE.height - MARGIN;
  }

  /** Ensure `needed` points of vertical space remain, else start a new page. */
  function ensureSpace(needed) {
    if (cursor - needed < MARGIN) cursor = newPage();
  }

  function drawRule(y, color = RULE, thickness = 0.75) {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness, color });
  }

  function drawWrapped(text, { font = regular, size = FONT_SIZE_BODY, color = TEXT, indent = 0, gapAfter = 0 } = {}) {
    const lines = wrapText(text, font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      ensureSpace(LEADING);
      page.drawText(line, { x: MARGIN + indent, y: cursor - size, size, font, color });
      cursor -= LEADING;
    }
    cursor -= gapAfter;
    return lines.length;
  }

  // ---- Cover page -------------------------------------------------------
  cursor -= FONT_SIZE_TITLE * 1.2;
  page.drawText(siteName, { x: MARGIN, y: cursor, size: FONT_SIZE_SMALL, font: bold, color: ACCENT });
  cursor -= FONT_SIZE_TITLE * 1.6;
  page.drawText("Monthly Current Affairs", { x: MARGIN, y: cursor, size: FONT_SIZE_TITLE, font: bold, color: INK });
  cursor -= FONT_SIZE_H1 * 1.8;
  page.drawText(monthLabel(month), { x: MARGIN, y: cursor, size: FONT_SIZE_H1, font: regular, color: MUTED });
  cursor -= 18;
  drawRule(cursor);
  cursor -= 26;

  const topicCount = new Set(articles.map((a) => a.subject)).size;
  const stats = [
    `${articles.length} article${articles.length === 1 ? "" : "s"}`,
    `${topicCount} topic${topicCount === 1 ? "" : "s"}`,
  ];
  page.drawText(stats.join("   •   "), { x: MARGIN, y: cursor, size: FONT_SIZE_BODY, font: regular, color: TEXT });
  cursor -= LEADING * 2;
  page.drawText(
    "Organized by topic for revision. Each entry lists the date, headline, summary and the exam point.",
    { x: MARGIN, y: cursor, size: FONT_SIZE_SMALL, font: italic, color: MUTED }
  );

  // ---- Topic sections ---------------------------------------------------
  // Grouping is derived from the article's subject (canonical subjects, AI_RULES.md §7).
  const byTopic = new Map();
  for (const article of articles) {
    if (!byTopic.has(article.subject)) byTopic.set(article.subject, []);
    byTopic.get(article.subject).push(article);
  }

  for (const [subject, group] of byTopic) {
    // A topic always starts on a fresh page so sections stay whole and printable.
    if (cursor < PAGE.height - MARGIN) cursor = newPage();

    cursor -= FONT_SIZE_H1 * 0.6;
    page.drawText(subject, { x: MARGIN, y: cursor, size: FONT_SIZE_H1, font: bold, color: INK });
    cursor -= 10;
    drawRule(cursor, ACCENT, 1.5);
    cursor -= LEADING * 1.5;

    page.drawText(
      `${group.length} article${group.length === 1 ? "" : "s"}`,
      { x: MARGIN, y: cursor, size: FONT_SIZE_SMALL, font: regular, color: MUTED }
    );
    cursor -= LEADING * 2;

    for (const article of group) {
      ensureSpace(LEADING * 5);
      // Headline
      const headlineLines = wrapText(article.title, bold, FONT_SIZE_H2, CONTENT_WIDTH);
      for (const line of headlineLines) {
        ensureSpace(LEADING);
        page.drawText(line, { x: MARGIN, y: cursor - FONT_SIZE_H2, size: FONT_SIZE_H2, font: bold, color: TEXT });
        cursor -= LEADING;
      }
      cursor -= 2;
      // Date + source domain
      const domain = domainOf(article.url);
      page.drawText(`${article.date}   ${domain}`, { x: MARGIN, y: cursor - FONT_SIZE_SMALL, size: FONT_SIZE_SMALL, font: regular, color: MUTED });
      cursor -= LEADING * 1.4;
      // Summary
      drawWrapped(article.brief_summary, { gapAfter: 4 });
      // Exam point panel
      const panelLines = wrapText(article.what_is_important, regular, FONT_SIZE_BODY, CONTENT_WIDTH - 18);
      const panelHeight = panelLines.length * LEADING + 12;
      ensureSpace(panelHeight + 6);
      page.drawRectangle({
        x: MARGIN, y: cursor - panelHeight + 4, width: CONTENT_WIDTH, height: panelHeight,
        color: ACCENT_BG, borderColor: rgb(0.961, 0.588, 0.043), borderWidth: 0.75,
      });
      page.drawText("EXAM POINT", { x: MARGIN + 9, y: cursor - FONT_SIZE_SMALL, size: FONT_SIZE_SMALL - 1, font: bold, color: ACCENT });
      cursor -= LEADING;
      for (const line of panelLines) {
        ensureSpace(LEADING);
        page.drawText(line, { x: MARGIN + 9, y: cursor - FONT_SIZE_BODY, size: FONT_SIZE_BODY, font: regular, color: TEXT });
        cursor -= LEADING;
      }
      cursor -= 16;
    }
  }

  return doc.save();
}

/** Host of a source URL, for a compact source line (full URL stays in the PDF metadata). */
function domainOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
