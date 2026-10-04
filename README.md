# Daily Current Affairs

A lightweight, fast, mobile-friendly current affairs website for students preparing for Indian competitive and government exams.

## Architecture

```
n8n  ->  Neon PostgreSQL  ->  Cloudflare Worker (API)  ->  Frontend  ->  Students
```

- **Database:** Neon PostgreSQL (source of truth; fed by an existing n8n automation)
- **API:** Cloudflare Worker — the only layer that talks to the database
- **Frontend:** Plain HTML + CSS + JavaScript (no frameworks)
- **Hosting:** Cloudflare

## Project Structure

```
public/    Frontend (HTML, CSS, JS) — served by Cloudflare
worker/    Cloudflare Worker API — database access layer
db/        SQL schema and migrations for Neon PostgreSQL
```

## Development

```bash
npm install
npm run dev      # run Cloudflare Worker locally via wrangler
```

## Rules

See [AI_RULES.md](AI_RULES.md) for the full development rules. Key points:

- Build in small, verified steps
- Never expose database credentials or secrets (frontend never talks to Neon directly)
- Do not implement future features (auth, bookmarks, MCQs, etc.) unless explicitly requested
