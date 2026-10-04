# Daily Current Affairs — Product & Development Specification

**Status:** Living source of truth  
**Target:** Indian competitive-exam current-affairs platform  
**Repository:** `znsai/DailyCurrentAffairs`  
**Primary stack:** Cloudflare + Neon + modern web frontend  

---

## 1. Product Vision

Build a fast, trustworthy, student-friendly current-affairs platform for people preparing for UPSC, SSC, RRB, Banking, TNPSC, State PSC, Defence and other Indian government competitive examinations.

The product must also work well for ordinary readers who simply want to read concise current-affairs content. **Current-affairs reading and quizzes are separate experiences.** Not every article should have a quiz.

### North-star learning loop

**Discover → Read → Remember → Test → Revise**

The product should feel like a focused study platform, not a generic news portal and not an overloaded coaching website.

---

## 2. Core Product Principles

1. **Reading comes first.** Current affairs must be useful even when a user never takes a quiz.
2. **Quiz is selective.** Only important/selected current affairs should generate quiz questions.
3. **One article does not automatically mean one quiz.** A quiz may exist for some articles and not others.
4. **Concise exam usefulness.** Highlight facts and concepts students should remember.
5. **Source transparency.** Preserve and expose the original article URL where appropriate.
6. **Mobile-first and responsive.** Students must be able to read and revise comfortably on phones.
7. **Accessibility by default.** Keyboard, screen-reader, contrast, focus, reduced motion and readable typography are requirements.
8. **Privacy/legal requirements are part of the product, not an afterthought.**
9. **Performance matters.** Avoid unnecessary JavaScript, animations, dependencies and network requests.
10. **AI coding agents must follow this document before changing architecture or UX.**

---

## 3. Current Affairs vs Quiz Architecture

### Current Affairs

The Current Affairs section can contain all relevant processed articles that pass the content pipeline.

Example:

```text
15 current-affairs articles
├── Article 1 → Quiz
├── Article 2 → No Quiz
├── Article 3 → No Quiz
├── Article 4 → Quiz
└── ...
```

### Quiz

Quiz is an independent revision experience containing questions selected from important current affairs.

A quiz question must be associated with its source current affair, but the article page must not force the user to answer a question.

### Desired relationship

```text
Current Affairs
      │
      ├── Article A ── Quiz exists
      ├── Article B ── No quiz
      ├── Article C ── Quiz exists
      └── Article D ── No quiz
```

Later, the preferred relational model is a `current_affairs_id` foreign key. Until that migration is intentionally approved, the existing URL relationship can remain.

---

## 4. Content Categories

Use these controlled subjects consistently:

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

Do not invent new categories casually. If a new category is genuinely required, update this specification first.

---

## 5. Current Affairs Content Model

Current-affairs records currently contain or are expected to contain:

```text
id
Date
Title
URL
Subject
Brief Summary
What is Important
created_at
```

### Content rules

- Preserve the original URL exactly.
- Do not invent facts.
- Summary should normally be 2–3 concise sentences.
- `What is Important` should be a concise exam-relevant fact/concept.
- Content must remain factual and useful for competitive exams.
- Avoid essay-style writing.
- Do not reproduce source articles wholesale.

### Exam Point UX

In the UI, `What is Important` should be visually presented as:

**⭐ EXAM POINT**

This is a key product pattern. A student with limited time should be able to scan the Exam Points quickly.

---

## 6. Quiz Content Model

Current quiz table structure:

```text
id
 date
 url
 subject
 question
 option_a
 option_b
 option_c
 option_d
 correct_answer
 explanation
 created_at
```

### Quiz rules

- Quiz is optional per article.
- Exactly one question may be generated per selected article in the MVP.
- Four options: A, B, C, D.
- Exactly one correct answer.
- Explanation must be concise and based on available current-affairs information.
- Never invent facts.
- Preserve the source URL.
- Do not duplicate questions for the same article when the product rule is one question per selected article.
- The database should prevent duplicate quiz records for the same URL where that uniqueness rule is active.

### Future quiz capabilities

The architecture should leave room for:

- Multiple questions per article
- Difficulty levels
- Larger question banks
- Topic-specific revision
- Weak-area quizzes
- Exam-specific quizzes

Do not implement these in the MVP unless explicitly approved.

---

## 7. AI / n8n Content Pipeline

The current content workflow uses n8n and AI processing.

Target conceptual flow:

```text
Article sources
    ↓
Article links/titles
    ↓
Relevance filter
    ↓
Article fetch/extraction
    ↓
AI current-affairs processing
    ↓
Current Affairs → Neon
    │
    └── optional quiz generation/selection
                ↓
             Quiz → Neon
```

### Important

The AI should not automatically force a quiz onto every article.

The future preferred pipeline is:

```text
Article
  ↓
Current Affairs processing
  ↓
Save CA
  ↓
Determine whether quiz is warranted
  ├── No → finish
  └── Yes → generate one MCQ → save Quiz
```

Retry behavior should handle transient AI/network/database failures without creating duplicate content.

---

## 8. Database Direction

### Current infrastructure

Neon PostgreSQL is the primary database.

Current core entities:

- `current_affairs`
- `quizzes`

### Data integrity

- URLs must be treated carefully to avoid duplicate content.
- Quiz uniqueness should prevent accidental duplicate questions for the same article under the MVP one-question rule.
- Use database constraints rather than relying only on frontend logic.
- Do not expose database credentials in frontend code.

### Future relational improvement

Preferred future design:

```text
current_affairs
    id
     │
     └────────< quizzes.current_affairs_id
```

This should be implemented only as an intentional migration with compatibility considerations.

---

## 9. Site Information Architecture

Initial pages:

```text
/
  Dashboard / Home

/current-affairs
  Current-affairs listing

/current-affairs/[id]
  Article reading page

/quiz
  Quiz listing and filters

/quiz/[date] or quiz session route
  Quiz experience

/revision
  Daily / Weekly / Monthly revision

/legal/privacy-policy
/legal/cookie-policy
/legal/terms
/legal/disclaimer
```

Avoid creating many unnecessary pages in the MVP.

---

## 10. Homepage / Dashboard UX

The homepage should let a student understand the day's preparation status within approximately five seconds.

Suggested structure:

```text
Header
  ↓
Greeting / date
  ↓
Today's pulse
  - Current-affairs count
  - Available quiz count
  - Optional progress
  ↓
Current-affairs feed
  ↓
Quick access to quiz
  ↓
Revision shortcuts
```

The dashboard must not imply that every current affair has a quiz.

---

## 11. Current Affairs UI

Current affairs should feel like **study cards**, not ordinary news cards.

A card should generally communicate:

```text
Subject
Title
Brief Summary
⭐ EXAM POINT
Read Source
```

Possible visual structure:

```text
┌────────────────────────────────────────────┐
│ POLITY & GOVERNANCE                 04 OCT │
│                                            │
│ Article title                              │
│                                            │
│ QUICK SUMMARY                              │
│ Concise summary...                         │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ ⭐ EXAM POINT                          │ │
│ │ Important fact/concept...              │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Read Source →                              │
└────────────────────────────────────────────┘
```

If a quiz exists, a subtle `Test Yourself` action may appear, but it must not dominate the reading experience.

---

## 12. Current Affairs Filters

Provide independent filtering for Current Affairs.

Initial filters:

- All
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

Desktop can use compact filter controls; mobile should support horizontally scrollable chips or an accessible filter drawer.

---

## 13. Quiz UI

Quiz is a separate destination.

Suggested flow:

```text
Quiz landing
   ↓
Select date/category
   ↓
Start quiz
   ↓
Question
   ↓
Select answer
   ↓
Check answer
   ↓
Explanation
   ↓
Next question
   ↓
Final score
```

Example:

```text
Question 1 of 12

Question text...

○ A. Option
○ B. Option
○ C. Option
○ D. Option

[ Check Answer ]
```

After answering, show clear text feedback such as `Correct` / `Incorrect`; never rely on color alone.

---

## 14. Quiz Filters

Quiz filters must be independent from Current Affairs filters.

Support:

- All
- Subject/category
- Day
- Week
- Month

Future filters may include:

- Difficulty
- Exam
- Topic
- Attempted/unattempted
- Incorrect questions

Do not implement future filters until required.

---

## 15. Daily / Weekly / Monthly Revision

Revision is a major product feature.

### Daily

```text
Today
Current Affairs: N
Questions: N
[Read Today's CA]
[Start Today's Quiz]
```

### Weekly

```text
Week 40
28 Sep – 04 Oct
Current Affairs: N
Questions: N
[Read Week]
[Start Weekly Quiz]
```

### Monthly

```text
October 2026
Current Affairs: N
Questions: N
[Read October]
[Start Monthly Quiz]
```

The same current-affairs content can therefore be discovered through daily, weekly and monthly views without duplicating records.

---

## 16. Reading Experience

Article reading is a first-class experience.

Requirements:

- Comfortable content width
- Large, readable heading
- Strong hierarchy
- Good line height
- Clear paragraph spacing
- Easy source access
- Prominent Exam Point
- Optional reading progress
- No unnecessary animations

Potential future reading controls:

- Text size
- Reading theme
- Reader mode

---

## 17. Search

Plan for global search across Current Affairs and Quiz.

Examples:

```text
RBI
Madras High Court
Space
Budget
India China
```

Search results should clearly separate:

- Current Affairs
- Quiz

Do not implement a complex search engine in the MVP unless required; design the interface so it can evolve.

---

## 18. Navigation

### Desktop

Potential sidebar:

```text
Daily CA

Dashboard
Current Affairs
Quiz
Revision

----------------
Search

----------------
Settings
```

### Mobile

Use compact top navigation plus bottom navigation where appropriate:

```text
Home | CA | Quiz | Revision
```

Navigation labels must remain understandable without icons.

### Mobile paging pattern

On small screens the reading and quiz experiences use one-card-per-view paging:

- Current Affairs mobile: one article per view with Previous/Next pager controls.
- Quiz mobile: one question per view with Previous/Next pager controls.
- Page changes use a single short slide/fade transition, disabled under `prefers-reduced-motion`.
- Pager buttons expose position text (for example "Article 2 of 10") so progress is never color-only.
- Desktop keeps the comfortable multi-card list; paging is a mobile progressive enhancement, not a separate codebase.

---

## 19. Visual Design Direction

The product should not look like a generic newspaper or government portal.

Design goal:

**Calm academic + modern technology + exam-focused clarity.**

Suggested palette direction:

- Warm/off-white background
- White content cards
- Deep indigo primary
- Amber/gold accent
- Dark charcoal text
- Slate muted text
- Green for positive feedback

Do not hard-code a palette before validating accessibility contrast.

### Brand feel

A subtle bee-inspired visual language may connect to the broader MyBeezNus ecosystem, but the current-affairs site must remain professional and suitable for serious exam preparation.

The approved identity is a **sharp-edged study notebook**: square paper surfaces, **scoped ruled writing zones** (the ruled lines are drawn by the text block itself and align exactly to the text line grid), underline-style fields, indigo + amber ink accents, Sanchez display type for headings and exam stamps (§20), and readable Sanchez body text sized up to preserve legibility.

Ruled lines belong to **writing zones only** (`.ruled`), never to the page as a whole: header, footer, cards, buttons, badges, panels and form fields stay plain paper, so a ruled line can never cut across text that is not on the grid. The contract for anything inside a `.ruled` zone is:

- `line-height` must equal `--ruled-line` (the rule spacing), so line *n*'s rule always sits under line *n*.
- all vertical spacing inside the zone must be a whole multiple of `--ruled-line`; a partial offset shifts the rules off the text.
- `.ruled` must never nest inside `.ruled` (two gradients at different phases draw two sets of rules).
- panels (Exam Point, notices) and interactive chrome stay outside zones; when they sit between zones their own spacing keeps the notebook rhythm.
- vertical margins on block elements (headings, paragraphs, list items, fields) must be `0` or a whole multiple of `--ruled-line` so that the text block's top and bottom rules align with the grid.

`--ruled-rule-offset` is the single tuning knob for where the rule ink sits inside a line box (web fonts vary by platform fallback, so this value is tuned rather than derived). Recommended value: `0.68em` (sets the rule ink centered within the x-height of the body font).

The body font line-height (`--leading-body`, currently 1.7) multiplies with the body font size (1.2rem — both are applied to `body` in base.css, and the token is the single source of truth for the leading) to produce `--ruled-line` (currently 1.7 × 1.2rem = 2.04rem). This product must be maintained: changing the font size or line-height requires recalculating `--ruled-line` to preserve grid alignment.

Avoid childish illustrations, excessive gradients, excessive glassmorphism and decorative animation. Page-change motion is limited to one short, subtle slide/fade for article and quiz paging, and is fully disabled under `prefers-reduced-motion`.

---

## 20. Typography

Prioritize readability.

Use Sanchez for headings, article body, summaries, and exam-point text. Keep system sans-serif for UI chrome, labels, and buttons.

Load Sanchez with `display=swap` and only the available regular weight. If font loading hurts performance on low-end networks, fall back to system stacks without breaking layout.

---

## 21. Accessibility Requirements

Accessibility is part of Definition of Done.

### Keyboard

- Full keyboard navigation
- Visible focus states
- Logical tab order
- Enter/Space support for controls

### Screen readers

- Semantic HTML
- Correct heading hierarchy
- Accessible labels
- Meaningful button text
- Decorative icons marked appropriately

### Visual

- WCAG-conscious contrast
- Do not communicate information using color alone
- Visible focus indicators
- Adequate text size

### Reading

- Comfortable line height
- Adjustable text size where useful
- Maximum reading width
- Clear spacing

### Motion

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms;
    transition-duration: 0.01ms;
    scroll-behavior: auto;
  }
}
```

Avoid unnecessary animation by default.

### Mobile

- Touch targets must be comfortable
- No horizontal overflow
- Quiz options must be easy to tap
- Filters must remain usable on small screens

---

## 22. Privacy / Cookies / Legal

Legal and privacy requirements must be planned from the beginning.

Required pages:

- Privacy Policy
- Cookie Policy
- Terms of Use
- Disclaimer

### Cookie approach

Do not add a cookie banner merely because it is common.

Only use a consent mechanism appropriate to the actual cookies/trackers implemented.

Distinguish:

- Essential cookies
- Optional analytics/personalization/advertising cookies if introduced

Where consent is legally required, obtain appropriate consent before non-essential tracking.

### Disclaimer

The platform is an educational/informational resource and is not an official government source. Exam outcomes and question appearances cannot be guaranteed.

### Source attribution

Original publishers retain rights to their original material. The product should link to original sources and avoid reproducing entire articles.

Legal copy must accurately describe the actual services and data practices implemented. Do not use generic claims that are not true.

---

## 23. Security

Minimum requirements:

- Never expose Neon credentials in frontend code.
- Keep secrets in environment variables / Cloudflare secret management as appropriate.
- Validate server-side inputs.
- Use parameterized database queries.
- Avoid exposing unnecessary database errors to users.
- Protect administrative/write endpoints.
- Apply rate limiting where public write endpoints exist.
- Do not trust client-provided authorization information.
- Review external dependencies before adding them.

---

## 24. Cloudflare Deployment Direction

Target architecture:

```text
User
  ↓
Cloudflare
  ↓
Web application / API
  ↓
Neon PostgreSQL
```

The frontend and backend/API architecture may use Cloudflare Pages/Workers or the current Cloudflare-supported deployment approach chosen during implementation.

Do not introduce unnecessary hosting providers unless there is a clear requirement.

---

## 25. Performance

The site should be fast on ordinary Indian mobile networks and desktop connections.

Priorities:

- Minimal client-side JavaScript where possible
- Server-render content when appropriate
- Lazy-load non-critical content
- Optimize images
- Avoid large UI libraries unless justified
- Avoid unnecessary dependencies
- Cache read-heavy content where appropriate
- Use database indexes for date/subject/filter queries

Target UX should remain responsive even when daily content grows substantially.

---

## 26. SEO

Public Current Affairs pages should be discoverable by search engines where appropriate.

Plan for:

- Unique page titles
- Useful meta descriptions
- Canonical URLs
- Semantic headings
- Open Graph metadata
- Structured data where appropriate
- Sitemap
- Robots configuration

Do not create duplicate indexable pages for the same content merely because of filters.

---

## 27. Product Roadmap

### Phase 1 — Foundation

- Frontend project setup
- Design system
- Routing
- Neon connection/API layer
- Cloudflare deployment foundation
- Error/loading/empty states

### Phase 2 — Current Affairs

- Dashboard
- Current-affairs listing
- Subject filters
- Date/day browsing
- Article reading page
- Exam Point presentation
- Source link

### Phase 3 — Quiz

- Independent quiz section
- Subject filters
- Daily quiz
- Question/answer flow
- Explanation
- Score

### Phase 4 — Revision

- Daily revision
- Weekly revision
- Monthly revision
- Weekly/monthly quiz aggregation

### Phase 5 — Student Features

Potential future features:

- Search
- Bookmarks
- Reading progress
- Quiz history
- Accuracy
- Streaks
- Incorrect-question revision
- Weak-topic revision
- Exam-specific views

### Phase 6 — Advanced Content

Potential future capabilities:

- Multiple questions per article
- Difficulty levels
- Larger question banks
- Personalized revision
- Exam-specific content targeting

Do not prematurely implement Phase 5/6 features during MVP development.

---

## 28. MVP Definition of Done

The MVP is complete when:

- Current Affairs can be read without taking quizzes.
- Quiz exists as an independent section.
- Not every article has a quiz.
- Current Affairs and Quiz have independent filters.
- Daily content can be viewed.
- Weekly/monthly revision architecture is supported or cleanly planned.
- Neon is the source of application data.
- Duplicate content is protected by database constraints where appropriate.
- UI is responsive.
- Basic accessibility requirements pass review.
- Legal pages exist before public launch.
- Cookie behavior matches actual tracking implementation.
- No secrets are exposed to the browser.
- Loading, empty and error states exist.
- The application can be deployed through the selected Cloudflare architecture.

---

## 29. AI Coding Agent Rules

Any AI coding agent (Antigravity, Copilot, Cline, Codex, etc.) working in this repository must follow these rules.

### Before coding

1. Read `PROJECT_SPEC.md` completely or at least the sections relevant to the requested change.
2. Inspect the existing repository structure.
3. Inspect existing implementation before proposing replacement architecture.
4. Identify the current milestone.
5. Explain conflicts between the request and this specification before changing product direction.

### While coding

1. Make the smallest coherent change needed.
2. Reuse existing components/utilities before creating duplicates.
3. Do not introduce a new framework or major dependency without justification.
4. Do not invent database fields without checking the current schema.
5. Do not expose secrets.
6. Preserve accessibility.
7. Preserve responsive behavior.
8. Keep Current Affairs and Quiz as separate product experiences.
9. Do not attach a quiz to every article merely because quiz infrastructure exists.
10. Do not silently change content semantics or database relationships.

### After coding

1. Run appropriate tests/build/type checks.
2. Check mobile and desktop behavior.
3. Check accessibility basics.
4. Check loading/error/empty states.
5. Review the change against this document.
6. Report exactly what changed and what remains.

### Important

Do not treat AI-generated code as automatically correct. Verify assumptions against the repository and database.

---

## 30. Change Control for This Specification

This is a **living document**.

When a product or architectural decision changes:

1. Discuss the reason.
2. Update this document.
3. Implement the change.
4. Test it.
5. Keep the document aligned with the actual product.

The specification must never describe a materially different product from the codebase.

---

## 31. Immediate Development Order

The next implementation sequence should be:

```text
1. Read PROJECT_SPEC.md
2. Inspect repository
3. Establish frontend architecture
4. Establish design tokens/components
5. Build application shell/navigation
6. Connect Current Affairs read API/data layer
7. Build Current Affairs listing + filters
8. Build article reading page
9. Build independent Quiz section
10. Add revision views
11. Add legal/accessibility foundations
12. Test and deploy to Cloudflare
```

Do not skip directly to advanced personalization.

---

## 32. Product North Star

The platform should make a student feel:

> **“I can understand today's important current affairs quickly, know exactly what I should remember, and come back later to revise and test myself.”**

For regular readers, it should feel like:

> **“I can read concise, useful current affairs without being forced into exam quizzes.”**

That balance is central to the product.
