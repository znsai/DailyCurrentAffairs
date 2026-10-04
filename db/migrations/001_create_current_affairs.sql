-- Migration 001: Create the current_affairs table
-- Source of truth for published current-affairs articles (fed by n8n).
-- See AI_RULES.md section 4 for the conceptual structure.

CREATE TABLE IF NOT EXISTS public.current_affairs (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date              DATE NOT NULL,
    title             TEXT NOT NULL,
    url               TEXT NOT NULL,
    subject           TEXT NOT NULL,
    brief_summary     TEXT NOT NULL,
    what_is_important TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate articles (rule: same article must not be inserted twice)
CREATE UNIQUE INDEX IF NOT EXISTS current_affairs_url_key
    ON public.current_affairs (url);

-- Query support: browse by date (home page + date navigation)
CREATE INDEX IF NOT EXISTS current_affairs_date_idx
    ON public.current_affairs (date DESC);

-- Query support: filter by subject
CREATE INDEX IF NOT EXISTS current_affairs_subject_idx
    ON public.current_affairs (subject);
