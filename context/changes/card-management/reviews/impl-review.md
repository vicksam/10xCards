<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manual card creation and flashcard management

- **Plan**: context/changes/card-management/plan.md
- **Scope**: Phase 1 to 5 of 5
- **Date**: 2026-09-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings (all fixed), 3 observations (2 fixed, 1 reverted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unsafe JSON parsing on API errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useCardManager.ts
- **Detail**: When the API returns a non-2xx response (e.g. 500, gateway timeout), the hook blindly calls `await res.json()`. If the response is HTML, this throws a SyntaxError and crashes the error handler, masking the real issue.
- **Fix**: Wrap `res.json()` in a try/catch or parse text first: `const text = await res.text(); try { const data = JSON.parse(text); ... } catch { ... }`
  - Strength: Prevents unhandled client-side crashes on infrastructure errors.
  - Tradeoff: Slightly more verbose error handling code.
  - Confidence: HIGH — standard robust fetch pattern.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Unplanned SSR pre-fetching and global nav

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/cards.astro, src/layouts/Layout.astro
- **Detail**: The implementation added SSR pre-fetching in `cards.astro` and a global navigation link in `Layout.astro` (plan only specified `Topbar.astro`). These are beneficial additions but technically unplanned.
- **Fix**: Document in the plan as an addendum
- **Decision**: FIXED

### F3 — SSR Supabase query ignores error

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/cards.astro:13
- **Detail**: The server-side initial fetch query (`const { data, count } = ...`) ignores the returned `error` object. If the database fails, it silently returns an empty state.
- **Fix**: Destructure `error` and log it: `if (error) console.error(error);`
- **Decision**: FIXED

### F4 — Zod UUID validation syntax

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/flashcards/[id].ts:8
- **Detail**: Uses `z.uuid()` instead of the more standard `z.string().uuid()`.
- **Fix**: Replace `z.uuid("...")` with `z.string().uuid("...")`.
- **Decision**: REVERTED (Original implementation `z.uuid()` was correct; `z.string().uuid()` is deprecated in Zod 3.24+)

### F5 — Invisible Cancel and navigation buttons (white-on-white)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/CardManager.tsx
- **Detail**: Outline buttons defaulted to `bg-background` (white) combined with `text-white`, rendering text invisible on Cancel, Retry, and Previous/Next buttons.
- **Fix**: Add explicit dark glass styling (`border-white/10 bg-white/5 text-white hover:bg-white/15`) and add `class="dark"` to `Layout.astro`.
- **Decision**: FIXED

### F6 — Delete dialog text overflow

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/CardManager.tsx:496
- **Detail**: Delete dialog preview used `truncate` with `p` tags in a grid container, preventing wrapping and allowing long lines to blow out popup dialog boundaries.
- **Fix**: Replace `truncate` with `break-words whitespace-pre-wrap [overflow-wrap:anywhere]` and add `min-w-0 max-w-full max-h-60 overflow-y-auto`.
- **Decision**: FIXED
