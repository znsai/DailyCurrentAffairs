# Daily Current Affairs — AI Development Rules

## 1. Project Goal

Build a lightweight, fast, mobile-friendly Current Affairs and Quiz platform for students preparing for Indian government competitive exams.

The system will receive current-affairs articles from an existing n8n automation and store structured content in Neon PostgreSQL.

The platform must be designed from the beginning for:

- UPSC
- SSC
- RRB
- Banking
- TNPSC
- State PSC exams
- Defence exams
- Other Indian government competitive exams

The V1 goal is a focused student learning experience, not a full learning-management or analytics platform.

### V1 learning loop

**Discover → Read → Understand → Recall → Test**

The product should feel like a focused study companion rather than a news-reading website, overloaded coaching website, or generic SaaS dashboard.

The approved V1 UX details are defined in `PROJECT_SPEC_V1_UX.md` and must be followed together with `PROJECT_SPEC.md`.

## 2. V1 Product Scope

V1 primary experiences are:

1. Home
2. Current Affairs
3. Current Affairs Article
4. Daily Quiz
5. Quiz Result

The primary navigation should remain intentionally small:

```text
Home
Current Affairs
Daily Quiz
```

Search and profile/account controls may exist as secondary controls when implemented.

Do NOT expose these as V1 product areas unless separately approved:

- Progress Dashboard
- Revision Dashboard
- Smart Revision
- Weak-topic analytics
- Personalized revision history
- Mock Tests
- Advanced gamification
- Leaderboards
- Performance analytics

The architecture may remain extensible for these later features, but do not implement them prematurely.

Daily, weekly and monthly Current Affairs/Quiz organization may remain supported where already defined by the existing product requirements. This organizational period is not the same thing as a personalized Revision Dashboard.

## 3. Core Architecture

Planned architecture:

n8n → Neon PostgreSQL → Cloudflare API / Worker → Frontend → Students

Neon is the primary data store.

Google Sheets is NOT the application database.

The frontend must NOT connect directly to Neon using database credentials. Database access must happen through a secure API/server layer.

## 4. Technology Direction

Use simple, lightweight, maintainable technologies.

Preferred stack:

- Frontend: HTML + CSS + JavaScript unless there is a strong reason to use a framework
- Backend/API: Cloudflare Worker
- Database: Neon PostgreSQL
- Source control: GitHub
- Content ingestion: existing n8n workflow
- Hosting: Cloudflare

Avoid unnecessary frameworks and dependencies.

The website should be inexpensive to operate and suitable for Cloudflare's free/low-cost infrastructure.

## 5. Product Structure

The application has TWO primary product sections:

### A. Current Affairs

This is the reading and learning section.

It must support, where implemented by the product requirements:

- Daily current affairs
- Weekly current affairs
- Monthly current affairs
- Date-wise archive
- Search
- Subject filtering
- Exam filtering where appropriate

### B. Quiz

This is the testing section.

It must remain separate from the article-reading experience.

It can support:

- Daily Quiz
- Weekly Quiz
- Monthly Quiz
- Subject-wise Quiz
- Exam-wise Quiz

Future custom quizzes remain future scope.

A user should be able to finish reading Current Affairs and then navigate to a relevant quiz separately.

Do NOT force a quiz inside every current-affairs article unless explicitly requested.

## 6. Current Affairs Organization

Current Affairs should be organized by period where supported:

### Daily

Users can view current affairs for a specific date.

### Weekly

Users can view a complete week's important current affairs.

### Monthly

Users can view a complete month's current affairs.

The database and API should make these views possible without duplicating the same article unnecessarily.

## 7. Current Affairs Filters

Current Affairs must support combinations of filters where practical.

### Date / Period

- Today
- Yesterday
- Specific date
- Date range
- This week
- This month
- Daily
- Weekly
- Monthly

### Subject

Use the following canonical subject categories:

- Polity & Governance
- Economy & Banking
- National Affairs
- International Relations
- Defence & Security
- Science & Technology
- Environment
- Health
- Agriculture
- Government Schemes
- Social Issues
- Sports
- Awards & Honours
- Appointments
- Reports & Indices
- Books & Authors
- Art & Culture
- Geography
- Important Days
- Other

Do not create duplicate or slightly different spellings of these categories.

### Exam

The system should eventually support multiple exam tags because one current-affairs item can be relevant to more than one exam.

Supported exam categories include:

- UPSC
- SSC
- RRB
- Banking
- TNPSC
- State PSC
- Defence
- Other Government Exams

Do NOT assume that every article belongs to only one exam.

## 8. Quiz Organization

Quiz is a separate product section from Current Affairs.

### Quiz periods

- Daily Quiz
- Weekly Quiz
- Monthly Quiz
- Custom Quiz (future)

### Quiz filters

Quiz should support independent filters for:

- Date
- Week
- Month
- Subject
- Exam
- Difficulty (future-ready)

The filtering system should be designed so multiple filters can be combined efficiently.

## 9. Question Model

Questions must be separate entities from current-affairs articles.

Initial conceptual structure:

current_affairs

- id
- date
- title
- url
- subject
- brief_summary
- what_is_important
- created_at

questions

- id
- current_affairs_id
- question
- option_a
- option_b
- option_c
- option_d
- correct_answer
- explanation
- date
- subject
- created_at

Initially, the n8n/AI pipeline may generate one MCQ per selected article.

The database must NOT assume that an article can only ever have one question. One important article may have multiple questions in the future.

A question belongs to a current-affairs article through `current_affairs_id`.

Do not duplicate the article content into the question record unless there is a clear technical reason.

## 10. Exam Relevance Model

A question or current-affairs article may be relevant to multiple exams.

Do not design the core data model around a single `exam` field if that would prevent multiple exam associations.

If exam-specific filtering requires a relational mapping table, use a normalized design such as an exam/tag mapping table rather than duplicating records.

The exact implementation should be proposed and approved before adding unnecessary tables.

## 11. Current Affairs Content

Current affairs are generated by the existing n8n automation.

The AI must NOT invent current-affairs articles.

Neon is the source of truth for published current-affairs content.

The original source URL must always be preserved exactly.

The website must provide a clear way to open the original article.

The current-affairs article should contain:

- Title
- Date
- Subject
- Brief Summary
- What is Important
- Original Source

### Article UX hierarchy

Where the content is available, the preferred learning hierarchy is:

```text
Headline
  ↓
Date / Category
  ↓
Quick Summary
  ↓
Why This Matters
  ↓
Key Facts
  ↓
Exam Perspective
  ↓
Important Names / Dates / Numbers
  ↓
One-Line Takeaway
  ↓
Test Yourself
```

The article must remain useful even when no quiz exists.

`Test Yourself` is an active-recall interaction. It must not be interpreted as a requirement that every article has a quiz.

## 12. Question Content

Questions should be generated from the current-affairs content and must remain factually grounded in the source article.

A question should contain:

- Question
- Four options
- Correct answer
- Explanation
- Subject
- Date
- Associated current-affairs article

Questions should be useful for government competitive exams and should not be ambiguous or artificially tricky.

Quiz feedback should explain the answer, not merely show a score.

## 13. Website Navigation

The main product navigation must clearly separate Current Affairs and Quiz while remaining intentionally small for V1.

V1 primary navigation:

```text
Home
Current Affairs
Daily Quiz
```

Do not add these to V1 primary navigation:

- Revision
- Progress
- Mock Tests

The exact visual design can evolve, but the separation between reading and testing must remain clear.

## 14. Initial Website Requirements

The first working version should provide:

### Home

- Clear today's study starting point
- Today's Current Affairs access
- Continue Reading where supported
- Today's Quiz access

The Home page must answer:

> What should I study today?

Do not turn Home into a large analytics dashboard.

### Current Affairs

- Latest/current-day articles
- Previous-date navigation
- Date filtering
- Subject filtering
- Search
- Article details
- Original source link
- Exam Point / important fact emphasis

### Quiz foundation

The architecture should support the quiz section and question data model from the beginning, but do not overbuild analytics or advanced quiz systems before the basic data flow works.

## 15. Mobile Support

The website must work properly on:

- Desktop
- Mobile
- Tablet

Mobile usability is important because many students will access the platform from phones.

For small screens, prioritize:

1. Today's Current Affairs
2. Article reading
3. Test Yourself
4. Daily Quiz

Where mobile paging is used, expose accessible position text such as `Article 2 of 10` or `Question 3 of 10`. Respect `prefers-reduced-motion`.

## 16. UI Principles

Keep the design:

- Clean
- Professional
- Fast
- Easy to read
- Student focused
- Modern but not distracting
- Minimal where possible

The core UX loop is:

**Read → Understand → Recall → Test**

The interface should answer these questions in order:

1. What should I study right now?
2. What happened?
3. Why does it matter?
4. What should I remember?
5. Can I recall it?
6. Can I answer a question about it?

Avoid excessive animations, heavy libraries, unnecessary dashboards, cluttered layouts, and large assets that slow down the page.

Do not use generic AI-generated SaaS/dashboard patterns simply because they are visually convenient.

The previously reviewed reference HTML is UX inspiration only. Preserve useful interaction patterns such as the clear daily feed, study cards, strong article hierarchy and focused quiz interaction, but do NOT copy its branding, exact colors, typography or visual identity.

The existing visual identity and anti-AI-trope rules in `PROJECT_SPEC.md` remain authoritative.

## 17. API Design

The frontend should communicate with the Cloudflare API.

Possible API structure:

GET /api/current-affairs
GET /api/current-affairs?date=YYYY-MM-DD
GET /api/current-affairs?subject=Economy%20%26%20Banking
GET /api/current-affairs?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/search?q=keyword
GET /api/questions
GET /api/questions?date=YYYY-MM-DD
GET /api/questions?subject=Economy%20%26%20Banking
GET /api/questions?month=2026-10

The exact API design may be improved during implementation.

Do not create APIs that are not needed.

Filtering should happen server-side where appropriate rather than downloading the entire database to the browser.

## 18. Database Design Principles

Neon is the production data store.

Before creating tables:

1. Inspect the existing Neon project.
2. Confirm the active branch/database.
3. Review the existing schema.
4. Only then create the required schema.

Do not delete or modify existing Neon resources without explicit approval.

Use migrations or a clearly reproducible SQL schema.

Database changes must be safe and reproducible.

Use appropriate indexes for common filters such as date, subject, URL, and relationships.

Use a UNIQUE constraint on the original article URL so duplicate articles are not inserted.

Do not create tables merely because they might be useful someday. Prefer a minimal normalized design that supports the planned product.

## 19. Security Rules

Never expose:

- Neon database credentials
- API keys
- Cloudflare secrets
- n8n credentials
- GitHub tokens

Never put database credentials inside frontend JavaScript.

Use environment variables / Cloudflare secrets where appropriate.

Do not commit `.env` files containing secrets.

Create/update `.gitignore` appropriately.

## 20. Performance Rules

The site should be lightweight.

Prefer:

- Server-side filtering
- PostgreSQL indexes
- Pagination
- Small JavaScript bundles
- Minimal dependencies
- Browser caching where appropriate
- Efficient queries

Do not load thousands of current-affairs articles or questions into the browser unnecessarily.

## 21. Development Method

IMPORTANT: Work ONE STEP AT A TIME.

For every major stage:

1. Inspect the current project.
2. Explain what you plan to change.
3. Make only that change.
4. Run the appropriate validation/test.
5. Show the result.
6. Stop and wait for approval before continuing.

Never assume the next step is approved.

Do not implement multiple major architectural layers in one step.

## 22. Before Writing Code

First inspect:

- Repository structure
- package.json
- existing configuration
- Git status
- available Neon configuration
- Cloudflare configuration if present

Do not overwrite existing files blindly.

Do not create duplicate configuration files.

Reuse existing configuration when appropriate.

## 23. Git Rules

Use Git properly.

Create meaningful commits.

Examples:

- feat: initialize current affairs application
- feat: add current affairs schema
- feat: add question schema
- feat: add current affairs api
- feat: add quiz api
- feat: add daily current affairs page
- feat: add quiz filters
- fix: correct article search

Do not make huge commits containing unrelated changes.

Before modifying the project, check `git status`.

Never discard existing user changes without permission.

## 24. Cloudflare Rules

Cloudflare will eventually host:

- Frontend
- API / Worker

Do not deploy anything until the local application works.

First make the application work locally.

Then connect GitHub to Cloudflare.

Then configure environment variables/secrets.

Then deploy.

## 25. Testing

Every implementation step should be validated.

At minimum:

- Application starts successfully
- API responds correctly
- Database queries work
- Search works
- Date filtering works
- Subject filtering works
- Current Affairs filters can be combined where supported
- Quiz filters can be combined where supported
- Questions map correctly to current-affairs articles
- Mobile layout works
- No secrets are exposed

For UX work, also verify:

- Home immediately communicates today's study action
- Current Affairs cards remain scannable
- Article hierarchy supports understanding and recall
- Test Yourself does not force a quiz where none exists
- Quiz remains a separate experience
- V1 does not expose Progress, Revision Dashboard or Mock Tests
- Accessibility is preserved

Fix errors before proceeding to the next stage.

## 26. Future Features

These are intentionally postponed unless explicitly requested:

- Authentication
- User accounts
- Saved articles
- Bookmarks
- Revision Dashboard
- Revision history
- Question attempts
- Scores and leaderboards
- Personalized revision
- Weak-topic analysis
- Difficulty classification
- Advanced question types
- Mock Tests
- Payments
- Ads
- Analytics

The architecture should remain extensible enough to support these later without unnecessary complexity now.

## 27. AI Behavior

Act as a senior full-stack architect and developer.

Before making architectural decisions:

- Prefer simplicity
- Prefer fewer dependencies
- Prefer maintainability
- Prefer Cloudflare-compatible solutions
- Prefer Neon-native PostgreSQL features
- Avoid over-engineering
- Preserve the separation between Current Affairs and Quiz
- Design daily, weekly and monthly content organization without confusing it with a personalized Revision Dashboard
- Design filters as first-class features
- Follow `PROJECT_SPEC_V1_UX.md` for the approved V1 UX direction

If there are multiple valid approaches, explain the trade-offs briefly and recommend one.

Do not make major architectural changes without approval.

Do not silently change requirements.

If something is unclear, stop and ask.

## 28. Current Development Phase

We are currently at:

PHASE 0 — PROJECT INITIALIZATION

The repository has been created on GitHub.

Repository:

znsai/DailyCurrentAffairs

Neon project has also been created.

The approved V1 product direction is:

**Current Affairs + Daily Quiz**

with a focused Home experience, separate Current Affairs and Quiz sections, daily/weekly/monthly content organization, and independent filtering.

Progress Dashboard, Revision Dashboard and Mock Tests are explicitly deferred.

Next objective:

Inspect the existing repository and establish the basic local development environment.

Do NOT start implementing the full website yet.

## 29. Golden Rule

BUILD IN SMALL VERIFIED STEPS.

Never generate the entire application in one response.

After completing each step:

- Show what changed
- Show validation result
- Explain the next step
- WAIT for approval
