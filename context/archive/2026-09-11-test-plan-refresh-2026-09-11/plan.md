# Test Plan Refresh Implementation Plan

## Overview

Update `context/foundation/test-plan.md` to reflect the completion of Phase 1, update the test-base profile, and elevate the R2 (finalization failure) risk to require an end-to-end (e2e) test. Based on the seed brief, the rollout roadmap will be split to isolate the e2e layer into its own phase.

## Current State Analysis

- Phase 1 in `test-plan.md` is marked as "not started" / "complete" without updating the test-base profile.
- The test-base profile in §4 is marked as "none", but `vitest` and 2 test files exist. It should be "sparse".
- R2 in §2 currently recommends "Integration (hook + mocked API)" as the cheapest layer.
- Phase 2 in §3 currently bundles R2, R3, and R7 together into an integration testing phase.

## Desired End State

A refreshed `test-plan.md` that correctly reflects the current state of the codebase (Phase 1 complete, sparse test-base) and realigns the testing strategy to mandate an e2e test for R2. The phased rollout (§3) is restructured to handle the e2e test separately from the integration tests.

### Key Discoveries:

- R2 is considered an absolute critical path requiring full-stack confidence over the standard integration layer, superseding previous "cheapest layer" guidance.
- `@playwright/test` is already in `package.json`, making it the clear choice for the e2e tool in §4.
- The `test-plan.md` relies on cross-references (e.g., "see §3 Phase 2") that must be updated when phases are renumbered.

## What We're NOT Doing

- We are not writing the actual e2e or integration tests in this change.
- We are not altering the risk definitions or adding new risks.
- We are not touching the exclusions in §7.

## Implementation Phases

### Phase 1: Update Strategy & Risk Map

- Update §1 or §4 to reflect the new test-base profile: 'sparse'.
- In §2 (Risk Map), update R2's "Likely cheapest layer" to `e2e (Playwright)` and note that this is explicit user direction superseding cost-signal guidance.
- In §4 (Stack), add Playwright to the e2e row, noting it's required for Phase 2. Remove the "No e2e tooling planned" note.
- Update §8 (Freshness Ledger) with today's date for strategy review.

### Phase 2: Restructure Phased Rollout

- In §3 (Phased Rollout), mark Phase 1 as `complete`.
- Split Phase 2 into two phases:
  - Phase 2: e2e — critical path finalization. Covers R2. Test type: e2e (Playwright). Status: not started.
  - Phase 3: Integration — data integrity & error paths. Covers R3, R7. Test type: integration (mocked Supabase + API). Status: not started.
- Shift existing Phase 3 (ownership & auth) to Phase 4.
- Shift existing Phase 4 (Quality-gates wiring) to Phase 5.
- Scan and update all cookbook references in §6 to point to the new phase numbers (e.g., updating §6.2 to reference Phase 3 instead of 2, §6.3 to reference Phase 4 instead of 3, etc.).

## Progress

- [x] Phase 1: Update Strategy & Risk Map — 4ca3f94
- [x] Phase 2: Restructure Phased Rollout — 34364da
