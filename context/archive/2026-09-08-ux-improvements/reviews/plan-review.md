<!-- PLAN-REVIEW-REPORT -->
# Plan Review: UX Improvements

- **Plan**: context/changes/ux-improvements/plan.md
- **Mode**: Deep
- **Date**: 2026-09-08
- **Verdict**: REVISE
- **Findings**: 1 critical, 1 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding
Grounding: 7/7 paths ✓, brief↔plan ✓

## Findings

### F1 — Orphan rows on client-aborted generation

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Progressive Timeouts & Hook Refactor
- **Detail**: The plan states "Cancel during Loading: ... Check DB to ensure no row was created." However, aborting a fetch on the client does not automatically stop the server's OpenAI call unless `Astro.request.signal` is explicitly passed down. Without it, the server will finish generating, insert the `generation_reviews` row, and return 200 to a disconnected client. The client never gets the ID and the row becomes permanently orphaned.
- **Fix A ⭐ Recommended**: Update `generateFlashcards` to accept an `AbortSignal`, pass `context.request.signal` from the API route, wire it to the OpenAI SDK call, and catch `AbortError` in the route to skip the DB insert.
  - Strength: Stops expensive LLM generation early, preventing both API cost and the orphan row.
  - Tradeoff: Slight change to service signature.
  - Confidence: HIGH — standard practice for edge workers.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — Server timeout precedes client timeout, breaking error UI

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Progressive Timeouts & Hook Refactor
- **Detail**: The plan sets the server timeout to be 5s shorter than the client timeout (e.g., 25s server, 30s client). This guarantees the server will time out first, returning a 500 error. The client's `AbortController` will never fire for a timeout, so the hook won't be able to easily detect it was a timeout to show the requested `"Generation timed out (30s)"` message (it will just show the generic OpenAI 500 error).
- **Fix A ⭐ Recommended**: Reverse the relationship: remove the dynamic `timeout_ms` from the server API entirely, set the server SDK timeout to a flat 60s, and rely purely on the client's `AbortController` to enforce the 30s/45s/60s deadlines.
  - Strength: Vastly simplifies the API and service layer (no dynamic timeout parsing needed). Since F1 wires the `AbortSignal`, the server will cleanly stop exactly when the client `AbortController` fires. The client easily catches the `AbortError` to show the custom message.
  - Tradeoff: None; standard approach for client-driven timeouts.
  - Confidence: HIGH
  - Blind spot: None.
- **Decision**: PENDING

### F3 — Confusing RLS policy name

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Database & API Cancel Route
- **Detail**: The plan names the policy `"Users can delete their own unfinalized review logs"` on the `generation_reviews` table. This is confusing because S-02 introduced an actual `review_logs` table.
- **Fix**: Rename the policy to `"Users can delete their own unfinalized generation reviews"`.
- **Decision**: PENDING
