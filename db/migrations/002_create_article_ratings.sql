-- Migration 002: Create the article_ratings table
-- Anonymous editorial-quality feedback on current-affairs articles
-- (PROJECT_SPEC §11). One row per submission; no accounts, no PII.
--
-- NOT applied automatically. Review and apply to Neon with:
--   neon psql production < db/migrations/002_create_article_ratings.sql
--
-- The Worker degrades gracefully when this table is absent: POST
-- /api/article-rating returns 503 "Ratings are not available" and the article
-- page leaves the rating selectable so the student can retry later.

CREATE TABLE IF NOT EXISTS public.article_ratings (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    article_id  BIGINT NOT NULL REFERENCES public.current_affairs(id) ON DELETE CASCADE,
    anonymous_id UUID NOT NULL,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT article_ratings_article_anonymous_key UNIQUE (article_id, anonymous_id)
);

-- Lookups by article for editorial reporting, oldest-first.
CREATE INDEX IF NOT EXISTS article_ratings_article_id_idx
    ON public.article_ratings (article_id, created_at);
