# Cloudflare Deployment

This project deploys to Cloudflare via **Git integration** (Workers Builds): pushing to `main` triggers a build & deploy.

## How it works

- `wrangler.toml` defines the Worker (`daily-current-affairs`) and static assets (`public/`)
- Static files are served first; `/api/*` routes go to the Worker (`run_worker_first`)
- The Worker is the only layer that talks to Neon PostgreSQL

## Required: set the database secret

After connecting the repo in the Cloudflare dashboard, add the secret:

**Dashboard → Workers & Pages → daily-current-affairs → Settings → Variables and Secrets**

| Type | Name | Value |
|------|------|-------|
| Secret | `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...neon.tech/neondb?sslmode=require`) |

Get the pooled string with: `neon connection-string --pooled`

> Use the **pooled** URL for Workers (serverless). The direct (non-pooled) URL is only for migrations.

## Local development

```bash
cp .dev.vars.example .dev.vars   # then fill in the real pooled DATABASE_URL
npm run dev                      # wrangler dev on http://localhost:8787
```

## Endpoints

| Method | Path | Query params |
|--------|------|--------------|
| GET | `/api/health` | — |
| GET | `/api/current-affairs` | `date=YYYY-MM-DD`, `subject`, `page`, `limit` (max 50) |
| GET | `/api/search` | `q` (required), `page`, `limit` |

## Build configuration (if the dashboard asks)

- **Build command:** none needed (plain JS Worker)
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** repository root
