/**
 * Monthly export — month arithmetic (Asia/Kolkata canonical time).
 *
 * The export runs on the 2nd of every month and covers the PREVIOUS calendar
 * month, so the scheduled handler never needs to know how many days a month
 * has: it derives the reporting month from the scheduled time and this module
 * turns that month into a half-open date range.
 *
 * Pure and dependency-free so the boundaries can be unit-tested without a
 * Worker runtime (see tools/monthly-export.test.mjs).
 */

/** Canonical application timezone (AI_RULES.md / PROJECT_SPEC — same as appToday()). */
export const APP_TIMEZONE = "Asia/Kolkata";

/** "September 2026" style label for the PDF cover and file names. */
export function monthLabel(month) {
  if (!isValidMonth(month)) throw new Error(`Invalid month: ${month}`);
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(date);
}

/** True for a "YYYY-MM" string with month 01-12. */
export function isValidMonth(month) {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/**
 * The month that a scheduled/export run should report on.
 *
 * The job runs on the 2nd of each month and exports the previous month, so a
 * run on 2026-10-02 reports on 2026-09. Accepts a Date or an ISO instant; the
 * date is first converted to Asia/Kolkata so a UTC-side timestamp near
 * midnight cannot shift the month by one.
 */
export function monthForRun(now) {
  const instant = now instanceof Date ? now.toISOString() : String(now);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type) => parts.find((part) => part.type === type).value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  // Any day on/after the 2nd reports on the month that is ending; the 1st is
  // left as a safety margin for the ingestion workflow to finish.
  const offset = day >= 2 ? -1 : -2;
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Half-open [start, next) date range for a month, as ISO dates.
 * `next` is exclusive, matching how /api/archive bounds a month, so a
 * month is always [first day, first day of the following month).
 */
export function monthRange(month) {
  if (!isValidMonth(month)) throw new Error(`Invalid month: ${month}`);
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const start = `${month}-01`;
  const next = monthNum === 12
    ? `${year + 1}-01-01`
    : `${month.slice(0, 5)}${String(monthNum + 1).padStart(2, "0")}-01`;
  return { start, next };
}

/** Previous and next month keys, for the export index's navigation. */
export function adjacentMonths(month) {
  if (!isValidMonth(month)) throw new Error(`Invalid month: ${month}`);
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const prev = monthNum === 1 ? `${year - 1}-12` : `${month.slice(0, 5)}${String(monthNum - 1).padStart(2, "0")}`;
  const next = monthNum === 12 ? `${year + 1}-01` : `${month.slice(0, 5)}${String(monthNum + 1).padStart(2, "0")}`;
  return { prev, next };
}

/** R2/storage key for a month's PDF, e.g. monthly/2026-09.pdf. */
export function pdfKey(month) {
  if (!isValidMonth(month)) throw new Error(`Invalid month: ${month}`);
  return `monthly/${month}.pdf`;
}

/** Content-Type for the stored/exported artifact. */
export const PDF_CONTENT_TYPE = "application/pdf";
