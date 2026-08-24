<!-- PLAN-REVIEW-REPORT -->
# Plan Review: AI Flashcard Generation Implementation Plan

- **Plan**: `context/changes/ai-card-generation/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-24
- **Verdict**: SOUND
- **Pre-triage verdict**: RETHINK
- **Findings**: 2 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 paths ✓, 5/5 symbols ✓, brief↔plan ✓. Final mechanical check: exactly one `## Progress` block, 5/5 matching phase headings, and 46/46 matching verification checks.

## Findings

### F1 — Progress block cannot be parsed by /10x-implement

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase headings, Phase 5 checklist, and `## Progress`
- **Detail**: The original plan used non-canonical phase headings, phase-level Progress checkboxes, and manual checkboxes outside Progress, preventing `/10x-implement` from parsing it.
- **Fix**: Normalize phase headings and mirror every automated/manual verification bullet as a numbered Progress check.
- **Decision**: FIXED — phase names now match and every verification criterion has a canonical Progress entry.

### F2 — Review outcomes are neither measurable nor always completable

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Overview; Phase 2 save API; Phase 3 review state
- **Detail**: Persisting only accepted cards lost the generated/rejected denominator required by the acceptance KPI. Rejecting every candidate also produced an empty request rejected by the original save API.
- **Fix**: Persist aggregate review outcomes without source text, finalize accepted cards and review counts atomically and idempotently, allow zero-card outcomes, and expose current-user KPI cards plus an acceptance trend on `/stats`.
- **Decision**: FIXED — custom approach selected during triage. The plan now includes `generation_reviews`, an authenticated finalization function, zero-card finalization, current-user stats, and cross-user verification.

### F3 — AI calls lack the bounds needed for cost and latency control

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phases 1 and 3
- **Detail**: The brief mentioned about 15 cards while the original prompt and parser enforced no limit. Output tokens, timeout behavior, retry eligibility, and the documented parser fallback were also inconsistent.
- **Fix**: Bound each MVP request to 10,000 input characters, 2,500 completion tokens, and 15 validated cards; use a shared 30-second client deadline, disable SDK retries, retry only transient failures, and define the actual JSON fallback.
- **Decision**: FIXED via recommended per-request bounds. Per-user quotas remain explicitly deferred.

### F4 — Review editing permits invalid values and trapped errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 save schema; Phase 3 review state
- **Detail**: Empty or whitespace edits could advance and fail only during finalization, while persistent save failure had no exit and reset did not explicitly clear the textarea.
- **Fix**: Enforce shared trimmed card limits, keep invalid edits open, disable pending finalization controls, provide retry/discard recovery, and clear both hook and text state on reset.
- **Decision**: FIXED — front/back limits are 500/2,000 characters across AI filtering, UI, API, SQL function, and database constraints.

### F5 — Phase 1 verification omits generated env types and lockfile changes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 files and verification
- **Detail**: The original phase omitted `package-lock.json` and `npx astro sync`, and incorrectly described an optional OpenRouter key as build-required.
- **Fix**: Include the lockfile, regenerate Astro env declarations before type checking, and distinguish build-time optionality from runtime generation requirements.
- **Decision**: FIXED.

### F6 — OpenRouter bypasses the existing configuration-status pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 env wiring; Phase 4 page integration
- **Detail**: OpenRouter was omitted from the central missing-service registry and production secret setup, so users would discover missing configuration only after a generation failure.
- **Fix**: Register OpenRouter in `config-status.ts`, pass a server-derived configured boolean to the React island, disable generation with a clear message, and document the production secret command.
- **Decision**: FIXED.

## Triage Summary

- **Fixed**: F1, F2 (custom), F3 (recommended option), F4, F5, F6
- **Skipped**: None
- **Accepted risk**: None
- **Dismissed**: None
- **Post-triage verdict**: SOUND
