# Quality-gates wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

We are locking the quality floor by updating the GitHub Actions CI workflow to run Vitest unit/integration tests and Playwright E2E tests alongside linting and typechecking. This corresponds to Phase 5 of the testing rollout, ensuring we automatically catch both logical and UI regressions before deployment.

## Starting Point

Currently, `.github/workflows/ci.yml` only enforces `lint` and `build`. While Vitest and Playwright are configured locally in `vitest.config.ts` and `playwright.config.ts` respectively, their execution is completely missing from the CI pipeline.

## Desired End State

Any PR or push to the main branch triggers a comprehensive CI pipeline that runs linting, typechecking, Vitest tests (without external secrets), the production build, and finally Playwright E2E tests against the development server, failing the build on any regression.

## Key Decisions Made

| Decision                       | Choice            | Why (1 sentence)  | Source           |
| ------------------------------ | ----------------- | ----------------- | ---------------- |
| E2E Scope | Include Playwright E2E | Provides the highest confidence against UI regressions despite increased CI time. | Plan |
| Ordering | Sequential fail-fast | Simplest configuration that saves resources by failing early on syntax/type errors. | Plan |
| Env Secrets | No secrets for Vitest | Ensures unit/integration tests mock external services and don't pollute real DBs. | Plan |
| Build Gate | Block build | Prevents deploying or building broken code. | Plan |

## Scope

**In scope:**
- Updating `.github/workflows/ci.yml` to add typecheck, Vitest, and Playwright execution.

**Out of scope:**
- Writing new test cases.
- Altering the test framework configurations.

## Architecture / Approach

The CI workflow will be updated to execute steps sequentially in a single job:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `npx playwright install --with-deps`
6. `npx playwright test` (using the existing `npm run dev` webServer command defined in `playwright.config.ts`, passing the necessary Supabase environment variables).

## Phases at a Glance

| Phase     | What it delivers       | Key risk                  |
| --------- | ---------------------- | ------------------------- |
| 1. CI Workflow Update | Fully gated CI pipeline | Missing env vars cause E2E tests to fail in CI |

**Prerequisites:** Testing frameworks (Vitest, Playwright) already installed and configured.
**Estimated effort:** ~1 session.

## Open Risks & Assumptions

- Playwright E2E tests may require the actual `SUPABASE_URL` and `SUPABASE_KEY` secrets to run against the dev server; we assume passing them to the E2E step is sufficient.

## Success Criteria (Summary)

- CI pipeline succeeds on a clean branch.
- CI pipeline correctly identifies and fails on a syntax, type, unit, or E2E error.
