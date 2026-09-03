<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Spaced Repetition Study Session

- **Plan**: context/changes/spaced-repetition-session/plan.md
- **Scope**: All Phases (1–4 of 4)
- **Date**: 2026-09-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 5 warnings | 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Missing user_id scope on flashcard UPDATE

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/study/review.ts:86–101
- **Detail**: The `.update()` at line 86 only filters `.eq("id", result.data.flashcard_id)` — it does not repeat `.eq("user_id", context.locals.user.id)`. The SELECT on line 57–62 verifies ownership first, and Supabase RLS enforces `auth.uid() = user_id` on UPDATE, so this is safe in normal operation. However it is a defence-in-depth gap: disable or misconfigure RLS and any authenticated user who guesses a card UUID can overwrite its FSRS state. The next-card preview fetch (line 131–136) correctly adds `.eq("user_id", ...)` — inconsistency in the same file.
- **Fix A ⭐ Recommended**: Add `.eq("user_id", context.locals.user.id)` to the UPDATE chain at line 101, matching the pattern already used for the SELECT and the next-card fetch.
  - Strength: Makes card ownership verifiable at every DB layer independent of RLS; matches the guard pattern in the same file (line 61, 135).
  - Tradeoff: One extra predicate; no functional change in normal operation.
  - Confidence: HIGH — identical pattern already used twice in this file.
  - Blind spot: None significant.
- **Fix B**: Accept RLS as the sole guard, add a code comment documenting the dependency.
  - Strength: Zero code change; less noise in the update clause.
  - Tradeoff: Future RLS policy changes could silently open this up; maintainers need to understand the implicit dependency.
  - Confidence: MEDIUM — acceptable for MVP, but not defence-in-depth.
  - Blind spot: RLS can be disabled per-table by a superuser without touching app code.
- **Decision**: SKIPPED

---

### F2 — flashcard SELECT in study.astro missing user_id filter

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/study.astro:11–16
- **Detail**: The due-cards query does not include `.eq("user_id", Astro.locals.user.id)`. RLS enforces ownership so this is safe, but it is inconsistent with the API layer (`review.ts` line 61 explicitly scopes by user_id on the equivalent SELECT). If RLS is ever inadvertently disabled or the table accessed via a service-role client, all users' due cards become visible. Middleware guarantees `Astro.locals.user` is set for `/study`, but the page never asserts it before querying.
- **Fix**: Add `.eq("user_id", Astro.locals.user!.id)` to the supabase query at line 14, and add an explicit `if (!Astro.locals.user) return Astro.redirect("/auth/signin");` guard at the top of the frontmatter to match the API route pattern.
- **Decision**: SKIPPED

---

### F3 — All fetchErrors from .single() mapped to 404

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/study/review.ts:64–65
- **Detail**: `if (fetchError) return Response.json({ error: "Card not found" }, { status: 404 })` — Supabase `.single()` returns `PGRST116` when 0 rows match (genuine not-found) but also returns errors for network timeouts, RLS violations, and DB server errors. All are mapped to 404, masking real infrastructure failures and preventing correct retry behaviour by callers.
- **Fix**: Check `fetchError.code` — return 404 only for `PGRST116`, otherwise return 500: `const status = fetchError.code === "PGRST116" ? 404 : 500; return Response.json({ error: fetchError.message }, { status });`
- **Decision**: SKIPPED

---

### F4 — Layout.astro nav redesign not in plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/layouts/Layout.astro
- **Detail**: `Layout.astro` received a full sticky-header nav redesign (Study, Dashboard, Stats links, active-state highlighting, logo) that was not in the plan. The plan specified only adding a Study link to `Topbar.astro`. In practice the Layout nav has replaced Topbar for all Layout-using pages — `Topbar.astro` is now only imported by `Welcome.astro`, so there is no double-nav. The Study link is present and correct. This is unplanned scope creep, but the result is better UX than what the plan described.
- **Fix**: Document the Layout nav redesign as an addendum in `plan.md` (one-sentence note under Phase 3) so the plan remains the source of truth for future reviews.
- **Decision**: SKIPPED

---

### F5 — Migration backfill UPDATE not wrapped in a transaction

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260903000000_srs_schema.sql:15
- **Detail**: The `ALTER TABLE` DDL and the `UPDATE flashcards SET due = created_at` backfill DML run as separate implicit transactions. If the migration is interrupted between them (infra failure, timeout), all existing rows will have `due = now()` (from the DEFAULT) rather than `due = created_at`. This is already applied to local dev so is only a risk on future production deployment. The plan does not document this gap.
- **Fix**: Wrap the migration body in `BEGIN; ... COMMIT;` to make the ALTER + UPDATE atomic, or add a comment explicitly acknowledging the interruption risk.
- **Decision**: SKIPPED

---

### F6 — toISOString() called manually inside afterHandler (plan wording drift)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/study/review.ts:72–83
- **Detail**: The plan stated "afterHandler eliminates manual `.toISOString()` calls". The implementation uses the afterHandler callback correctly (dates converted in one centralised place), but still calls `.toISOString()` manually inside the callback. The plan's intent was centralisation (achieved), but the literal wording implied zero manual calls. Functionally correct; the plan wording was slightly misleading.
- **Fix**: No code change needed — note in the plan that "eliminates scattered calls" was the intent. OBSERVATION only.
- **Decision**: SKIPPED

---

### F7 — Double-submit window on network failure in useStudySession

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useStudySession.ts:59–108
- **Detail**: `isSubmitting` correctly prevents concurrent submits. However if a network request succeeds server-side but fails before the response reaches the client (TCP reset, edge timeout), `isSubmitting` resets to `false`, `submitError` is set, and the same card remains at `cards[0]`. A user retry re-rates the same card, potentially double-advancing its FSRS state. There is no idempotency key or deduplication.
- **Fix**: For MVP: add a code comment on the `rate()` function documenting this gap. Post-MVP: add a `review_id: uuid` generated client-side per rating attempt to `ReviewRequest`, with a UNIQUE constraint on `(flashcard_id, review_id)` in `review_logs`.
- **Decision**: SKIPPED

---

### F8 — review_logs absence of DELETE/UPDATE RLS policies undocumented

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260903000000_srs_schema.sql:33–41
- **Detail**: The plan correctly specifies no UPDATE or DELETE policy (append-only audit log). The migration implements this correctly. However there is no SQL comment explaining why these policies are absent — a future developer may add them thinking they were missed.
- **Fix**: Add a SQL comment: `-- No UPDATE or DELETE policy: review_logs is intentionally append-only (audit trail).`
- **Decision**: SKIPPED

---

### F9 — study.astro: no explicit user guard before DB query

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/study.astro:7–17
- **Detail**: The page relies on middleware for auth enforcement but does not assert `Astro.locals.user` before querying. The API route (`review.ts:32–34`) checks `context.locals.user` explicitly. Inconsistency between page and API patterns — if `/study` is ever removed from `PROTECTED_ROUTES`, the page silently serves empty cards instead of redirecting.
- **Fix**: Covered by F2 — adding the explicit user guard at the top of the frontmatter addresses both findings.
- **Decision**: SKIPPED
