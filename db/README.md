# Database

SQL schema and migrations for the Neon PostgreSQL database.

This directory is intentionally empty for now — the schema will be created in a later phase, after inspecting the existing Neon project.

Planned primary table (from `AI_RULES.md`):

```
current_affairs
- id
- date
- title
- url            (UNIQUE — prevents duplicate articles)
- subject
- brief_summary
- what_is_important
- created_at
```

Rules (from `AI_RULES.md`):

- Inspect the existing Neon project/branch/schema before creating anything
- Use migrations or clearly reproducible SQL
- No extra tables unless actually required
