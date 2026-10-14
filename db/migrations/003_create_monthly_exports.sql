-- Migration 003: Track monthly PDF exports
--
-- The monthly export runs on the 2nd of each month (Cloudflare Cron Trigger)
-- and produces one topic-grouped PDF of the previous month's current affairs.
-- This table is the job's durable state: what was exported, where it is
-- stored, and whether it succeeded. It is NOT applied automatically.
--
-- Apply to Neon with:
--   neon psql production < db/migrations/003_create_monthly_exports.sql
--
-- The Worker degrades gracefully when this table is absent: the Cron job
-- still generates and stores the PDF, and GET /api/monthly-exports returns
-- an empty list (the index page then shows "No monthly exports yet").

CREATE TABLE IF NOT EXISTS public.monthly_exports (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    month        CHAR(7) NOT NULL UNIQUE,
    -- 'monthly/<YYYY-MM>.pdf' inside the R2 bucket (see pdfKey() in worker/monthly.js)
    storage_key  TEXT NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0 CHECK (article_count >= 0),
    topic_count  INTEGER NOT NULL DEFAULT 0 CHECK (topic_count >= 0),
    byte_size    BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
    status       TEXT NOT NULL DEFAULT 'ready'
                 CHECK (status IN ('ready', 'failed', 'superseded')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per month: a rerun of the same month replaces the export instead of
-- adding a duplicate. The application upserts with ON CONFLICT (month).

-- Newest-first listing for the export index page.
CREATE INDEX IF NOT EXISTS monthly_exports_generated_at_idx
    ON public.monthly_exports (generated_at DESC);
