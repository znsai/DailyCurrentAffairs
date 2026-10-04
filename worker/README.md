# Worker (API)

Cloudflare Worker — the secure API layer between the frontend and Neon PostgreSQL.

This directory is intentionally empty for now — the Worker will be implemented in a later phase.

Rules (from `AI_RULES.md`):

- The ONLY layer allowed to connect to Neon PostgreSQL
- Credentials via Cloudflare secrets / environment variables, never in code
- Minimal API surface: only endpoints that are actually needed
