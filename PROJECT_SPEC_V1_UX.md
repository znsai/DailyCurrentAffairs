# Daily Current Affairs — V1 UX Product Specification Addendum

**Status:** Approved V1 direction
**Applies to:** `PROJECT_SPEC.md` and `AI_RULES.md`
**Purpose:** Define the V1 student experience and prevent premature implementation of future learning features.

---

## 1. V1 Product Scope

V1 is intentionally focused on the core learning loop:

**Discover → Read → Understand → Recall → Test**

The primary experiences are:

1. Home
2. Current Affairs
3. Current Affairs Article
4. Daily Quiz
5. Quiz Result

The product should make the student feel that the platform has already filtered the noise and is telling them what matters for preparation.

The V1 product is **not** a full learning-management or analytics platform.

---

## 2. Explicitly Deferred from V1

Do not implement or expose these as V1 product areas unless separately approved:

- Progress Dashboard
- Revision Dashboard
- Smart Revision system
- Weak-topic analytics
- Personalized revision history
- Mock Tests
- Advanced gamification
- Leaderboards
- Performance analytics

The underlying architecture may remain extensible for these features, but V1 UI and navigation must not pretend that they already exist.

Future revision functionality is not the same thing as Daily/Weekly/Monthly content organization. Daily, weekly and monthly Current Affairs and Quiz views remain valid V1 capabilities where already supported by the existing product specification.

---

## 3. V1 Navigation

Keep the primary navigation deliberately small:

```text
Home
Current Affairs
Daily Quiz
```

Secondary controls may include:

```text
Search
Profile / account controls when available
```

Do not add Revision, Progress or Mock Tests to primary navigation in V1.

The existing separation between Current Affairs and Quiz remains mandatory: reading and testing are related but distinct experiences.

---

## 4. Home UX

The Home page must answer the question:

> **What should I study today?**

Do not turn Home into a large analytics dashboard.

Recommended structure:

```text
Header
  ↓
Greeting / date
  ↓
Today's Current Affairs
  - number of important items
  - estimated study load where available
  - Start / Continue action
  ↓
Continue Reading
  ↓
Today's Quiz
```

Avoid progress charts, revision queues and unnecessary metrics in V1.

---

## 5. Current Affairs UX

Current Affairs is the main product experience.

It should feel like a focused study feed, not a conventional news portal.

Each study card should make the following easy to scan:

```text
Subject / category
Title
Brief Summary
⭐ EXAM POINT
Read / Open article
```

If a quiz exists for the article, a subtle `Test Yourself` action may be shown. It must not dominate the reading experience.

The existing controlled subject categories remain authoritative.

---

## 6. Article Reading UX

The article page is a first-class learning experience.

Preferred hierarchy:

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

`Test Yourself` is an active-recall interaction and must not be interpreted as a requirement that every article has a quiz.

The original source link remains clearly accessible.

---

## 7. Active Recall

After reading, encourage the student to retrieve the key fact before revealing it.

Example:

```text
TEST YOURSELF
Which organization conducted the test?

[ Reveal Answer ]
```

The interaction should be concise and focused. It should not introduce a separate dashboard or attempt-tracking system in V1.

---

## 8. Daily Quiz UX

The Daily Quiz should directly reinforce the day's Current Affairs.

Preferred flow:

```text
Today's Quiz
  ↓
Question
  ↓
Select answer
  ↓
Check answer
  ↓
Correct / Incorrect
  ↓
Explanation
  ↓
Next question
  ↓
Quiz Result
```

Use a clear one-question-at-a-time interaction where appropriate, especially on mobile.

Quiz feedback must explain the answer rather than only showing a score.

The existing rule that quiz generation is selective remains unchanged: not every article must have a quiz.

---

## 9. Quiz Result V1

Keep results simple.

Show:

- Score
- Correct answers
- Incorrect answers
- Accuracy where meaningful

Provide actions such as:

- Review Answers
- Return to Today's Current Affairs

Do not turn the result screen into a full performance dashboard.

---

## 10. Reference UI Decision

The previously reviewed HTML/reference UI is approved as **UX inspiration only**.

Keep useful interaction patterns from the reference, especially:

- clear daily Current Affairs feed
- study-oriented article cards
- strong article information hierarchy
- exam relevance / key-fact emphasis
- focused one-question-at-a-time quiz interaction
- clear question position and answer feedback

Do **not** copy the reference product's branding, exact colors, typography, component styling or visual identity.

The repository's existing visual design direction remains authoritative.

---

## 11. Existing Visual Rules Remain Authoritative

All existing anti-AI-trope rules and approved visual identity in `PROJECT_SPEC.md` remain in force.

In particular, do not introduce:

- harsh gradients
- excessive glassmorphism
- excessive drop shadows
- rainbow coloring
- excessive rounded cards
- huge decorative hero sections
- decorative charts without purpose
- excessive icons
- generic stock imagery
- unnecessary gamification
- generic AI-generated SaaS dashboard styling

The current approved visual identity remains the sharp-edged study-notebook direction with scoped ruled writing zones, indigo + amber accents and the established typography system.

The reference HTML does not override those rules.

---

## 12. Responsive UX

Desktop may use a comfortable multi-card Current Affairs list.

Mobile should prioritize:

1. Today's Current Affairs
2. Article reading
3. Test Yourself
4. Daily Quiz

Where the existing mobile paging pattern is used, retain accessible position text such as `Article 2 of 10` or `Question 3 of 10` and respect `prefers-reduced-motion`.

---

## 13. Product Hierarchy

Every major UI decision should prioritize these questions in order:

1. **What should I study right now?**
2. **What happened?**
3. **Why does it matter?**
4. **What should I remember?**
5. **Can I recall it?**
6. **Can I answer a question about it?**

Do not prioritize analytics or gamification over learning clarity.

---

## 14. Future Extension Boundary

Future features may build on the V1 foundation:

```text
V1
Read → Understand → Recall → Test
              ↓
Future
Revision → Progress → Weak Topics → Personalization
```

Do not implement the future layer simply because the architecture can support it.

When future learning features are proposed, update the main product specification before implementation.
