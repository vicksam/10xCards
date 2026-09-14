# Quality-gates wiring Implementation Plan

## Overview

We are locking the quality floor by updating the GitHub Actions CI workflow to run Vitest unit/integration tests and Playwright E2E tests alongside linting and typechecking. This is Phase 5 of the test rollout plan.

## Current State Analysis

Currently, `.github/workflows/ci.yml` defines jobs for checkout, dependency installation, Astro type syncing, linting (`npm run lint`), and building (`npm run build`). It lacks steps for typechecking (`npm run typecheck`), Vitest (`npm run test`), and Playwright E2E testing. 

## Desired End State

The CI workflow will enforce a strict quality gate running sequentially: Lint → Typecheck → Vitest → Build → Playwright. The build step is strictly gated by the tests.

### Key Discoveries:

- `package.json` correctly defines `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`.
- `playwright.config.ts` expects a local development server to run via `npm run dev`.

## What We're NOT Doing

- We are not writing new tests.
- We are not altering the underlying test configuration files unless necessary to fix CI execution.

## Implementation Approach

We will modify `.github/workflows/ci.yml` to insert the new checks. The Vitest step will deliberately NOT receive Supabase secrets to enforce mocking. The build and Playwright steps will receive the `SUPABASE_URL` and `SUPABASE_KEY` secrets from the repository.

## Phase 1: CI Workflow Update

### Overview

Update the GitHub Actions workflow to run typecheck, Vitest, and Playwright tests.

### Changes Required:

#### 1. `.github/workflows/ci.yml`

**Intent**: Add typecheck, vitest, build, and playwright steps in sequential order.

**Contract**: The `ci` job must include sequential steps executing `npm run typecheck`, `npm run test`, `npm run build` (with secrets), `npx playwright install --with-deps`, and `npx playwright test` (with secrets).

### Success Criteria:

#### Automated Verification:

- CI pipeline definition is valid yaml.
- Linting passes: `npm run lint`

#### Manual Verification:

- N/A

---

## Testing Strategy

### Unit Tests:

- N/A

### Integration Tests:

- N/A

### Manual Testing Steps:

1. Push the branch to GitHub.
2. Verify that the GitHub Actions run succeeds and executes all steps.
3. Verify that removing a type or injecting a test failure correctly fails the workflow at the respective step.

## Performance Considerations

Running Playwright and building the project will increase the CI run time. The sequential execution maximizes CI resource efficiency (failing early) at the cost of overall duration.

## References

- Related research: `context/changes/testing-quality-gates-wiring/research.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: CI Workflow Update

#### Automated

- [x] 1.1 CI pipeline definition is valid yaml.
- [x] 1.2 Linting passes: `npm run lint`
