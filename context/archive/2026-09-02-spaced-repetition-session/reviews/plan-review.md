<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Spaced Repetition Study Session Implementation Plan

- **Plan**: `context/changes/spaced-repetition-session/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-03
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical | 2 warnings | 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING (1 critical) |

## Grounding

7/7 paths ✓ · 5/5 symbols ✓ · brief↔plan ✓

**Research utilization:**
- `srs-library-research.md` — ✅ Used. Library choice, Cloudflare compat, schema rationale all grounded in it.
- `ts-fsrs-docs.md` — ✅ Used. All 10 Card fields, TypeConvert.card(), afterHandler, scheduler.next/repeat all sourced from it correctly.

## Findings

### F1 — Interval preview promised but not built anywhere

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness (internal contradiction)
- **Location**: Critical Implementation Details (line 53) vs Phase 2 API contract + Phase 3 hook/component contracts
- **Detail**: The "Critical Implementation Details" block promised `scheduler.repeat()` server-side with four interval previews; none appeared in any actual contract. ReviewResponse had only one scheduled_days, study.astro did a plain .select("*"), and hook/component had no interval display logic.
- **Decision**: FIXED via Fix B — ReviewRequest extended with next_flashcard_id, ReviewResponse extended with next_intervals, Zod schema updated, API route gets scheduler.repeat() for next card, hook exposes currentIntervals, button labels show Nd format.

### F2 — No atomicity between flashcard UPDATE and review_logs INSERT

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — API contract
- **Detail**: Sequential UPDATE+INSERT with no transaction wrapper. Silent inconsistency if INSERT fails after UPDATE succeeds.
- **Decision**: FIXED via Fix A — separate error variables, console.error on INSERT failure, gap documented in Migration Notes.

### F3 — API route Phase 2 code block skips the supabase null-check step

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — API contract
- **Detail**: Guard order bullet listed supabase null-check but the code block skipped it. Implementer could omit createClient().
- **Decision**: FIXED — added explicit createClient() + null-check bullet mirroring flashcards/index.ts.

### F4 — srs-library-research.md schema note understates FSRS columns

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness (research accuracy)
- **Location**: srs-library-research.md line 60
- **Detail**: Research doc listed 7 FSRS columns; actual Card interface requires 10.
- **Decision**: FIXED — research doc updated to list all 10 columns.

### F5 — study.astro double-checks user auth after middleware already guarantees it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — study.astro contract
- **Detail**: `Astro.locals.user` check is dead code on a PROTECTED_ROUTE.
- **Decision**: FIXED — removed user check, kept supabase null-check with explanatory comment.
