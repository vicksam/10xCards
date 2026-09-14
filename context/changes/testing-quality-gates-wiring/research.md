---
date: 2026-09-14T22:59:03+02:00
researcher: Antigravity
git_commit: 7ed6d765312daf4c2432a1693c23ce9023c1ffe0
branch: master
repository: 10xCards
topic: "testing-quality-gates-wiring"
tags: [research, codebase, ci, quality-gates, github-actions, vitest, typescript]
status: complete
last_updated: 2026-09-14
last_updated_by: Antigravity
---

# Research: testing-quality-gates-wiring

**Date**: 2026-09-14T22:59:03+02:00
**Researcher**: Antigravity
**Git Commit**: 7ed6d765312daf4c2432a1693c23ce9023c1ffe0
**Branch**: master
**Repository**: 10xCards

## Research Question

What is the current state of test, lint, and typecheck scripts, and how are they wired in the CI workflow? How can we properly wire them according to Phase 5 of the test plan ("Quality-gates wiring")?

## Summary

The repository has established testing frameworks (Vitest for unit/integration, Playwright for E2E), and relevant scripts are present in `package.json`. However, `.github/workflows/ci.yml` is currently only enforcing `lint` and `build`. Phase 5 of the testing rollout correctly identifies the gap: `typecheck` and `test` scripts are completely absent from CI. To lock the quality floor, the CI workflow must be updated to run `npm run typecheck` and `npm run test` (and potentially E2E tests, depending on resource constraints and scoping).

## Detailed Findings

### Current CI Configuration Gap

- The `.github/workflows/ci.yml` pipeline defines jobs for checkout, dependency installation, Astro type syncing, linting (`npm run lint`), and building (`npm run build`).
- **Missing gates**: There are no steps invoking type checking (`npm run typecheck`) or test execution (`npm run test` or Playwright).

### Testing Infrastructure Readiness

- **Scripts**: `package.json` correctly defines `"test": "vitest run"`, `"lint": "eslint ."`, and `"typecheck": "tsc --noEmit"`. No dedicated script exists for Playwright (it is run via `npx playwright test` per documentation).
- **Vitest Unit & Integration**: Configured via `vitest.config.ts`, operating on `test/`. Includes test environments for both Node and `jsdom` (React hooks).
- **Playwright E2E**: Configured via `playwright.config.ts` targeting `tests/e2e`. Playwright tests are specifically prioritized for critical paths like UI finalization failures, relying on session caching (`auth.setup.ts`).

## Code References

- `package.json:6-19` - Defines the testing, linting, and typechecking scripts.
- `.github/workflows/ci.yml:13-24` - Contains the existing CI execution steps (currently only linting and building).
- `vitest.config.ts:9-19` - Vitest configuration for the `test/` directory.
- `playwright.config.ts:11` - E2E configuration pointing to `./tests/e2e`.

## Architecture Insights

- **Phased Rollout**: The project intentionally delayed testing in CI to Phase 5 ("Quality-gates wiring"), prioritizing the establishment of mocking strategies and test patterns locally first.
- **Test Strategy ("Cost × signal")**: The focus is on executing the cheapest test that yields a reliable signal. Vitest handles unit and integration boundaries, while Playwright is reserved for full-stack E2E critical paths. Visual rendering regressions are explicitly excluded.
- **Build Step Requirements**: The current `build` step in CI requires `SUPABASE_URL` and `SUPABASE_KEY` secrets, suggesting that test executions (particularly E2E or integration) may similarly require environment secrets or a mocked backend if run in CI.

## Historical Context (from prior changes)

- `context/foundation/test-plan.md` - Outlines the testing rollout strategy, confirming that Phase 5 is specifically for wiring `npm test` alongside linting and typechecking in the CI workflow.
- `context/archive/2026-09-10-testing-bootstrap-critical-path/research.md` - Confirms Vitest 4.x was chosen due to Vite 7 compatibility and notes the planned CI wiring in Phase 4/5.
- `context/archive/2026-09-11-test-plan-refresh-2026-09-11/plan.md` - Documents the choice of Playwright for E2E testing to cover critical UI paths.

## Related Research

- `context/archive/2026-09-10-testing-bootstrap-critical-path/research.md`
- `context/archive/2026-09-11-test-plan-refresh-2026-09-11/plan.md`

## Open Questions

- Should Playwright E2E tests be run in the standard CI pipeline, or are they too resource-intensive/costly given the current setup? (E2E tests may require additional secrets or setup steps).
- Do Vitest integration tests require any database or API keys in the CI environment, or are all external calls mocked via established patterns?
