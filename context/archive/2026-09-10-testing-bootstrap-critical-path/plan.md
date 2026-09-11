# Bootstrap + Critical-Path Unit Tests — Phase 1 Implementation Plan

## Overview

Install vitest and write the first unit tests for the two highest-signal risks at zero infrastructure cost:

- **R1** — LLM response parsing in `src/lib/services/ai-generation.ts`: all 8 parsing branches, oracle-grounded from the PRD and archived S-01 plan.
- **R4** — Retry state machine in `src/components/hooks/useFlashcardGeneration.ts`: timeout tiers (30s → 45s → 60s), retryable status classification, AbortController per-attempt lifecycle, and the Mode B stale-closure regression.

Test files live under `test/` (root-level, mirroring `src/` hierarchy). No production source changes — the `astro:env/server` import blocker is resolved via a vitest alias to `src/__mocks__/astro-env-server.ts`.

---

## Current State Analysis

- No test runner exists: no `test` script, no `vitest.config.*` (`package.json` has only `dev/build/preview/astro/lint/format` scripts).
- Vite **7.3.6** installed via override — requires `vitest@^4` (≥4.1.0 added `vite ^7` peer dep; latest stable: `vitest@4.1.11`).
- `src/lib/services/ai-generation.ts:1` imports `astro:env/server` — Astro virtual module that only exists inside Astro's build pipeline; vitest node pool cannot resolve it. Solved by a test-only alias (no production change).
- `src/components/hooks/useFlashcardGeneration.ts` has no Astro imports — needs `jsdom` environment for `renderHook`.
- `tsconfig.json` declares `@/*` → `./src/*` path alias; vitest must replicate this via `resolve.alias`.
- No `test/` directory exists yet.

### Key Discoveries

- [`ai-generation.ts:28-37`](file:///home/awiacek/version-control/10xCards/src/lib/services/ai-generation.ts#L28-L37) — `cleanJsonString()` is fully pure: no imports, no side effects. Zero mocks needed.
- [`ai-generation.ts:39-48`](file:///home/awiacek/version-control/10xCards/src/lib/services/ai-generation.ts#L39-L48) — OpenAI client is a **module-level singleton** constructed at import time using `OPENROUTER_API_KEY`. Mocking requires `vi.mock('astro:env/server', ...)` + `vi.mock('openai', ...)` to prevent the constructor from running.
- [`ai-generation.ts:83-88`](file:///home/awiacek/version-control/10xCards/src/lib/services/ai-generation.ts#L83-L88) — Parser has two explicit fallback paths: `parsed.cards` envelope AND bare top-level array — both intentional (S-01 plan:204), both must be tested.
- [`useFlashcardGeneration.ts:64`](file:///home/awiacek/version-control/10xCards/src/components/hooks/useFlashcardGeneration.ts#L64) — `const isManual = manualRetry ?? state.status === "error"` inside `useCallback([state.status])` — routing decision reads from closure; stale closure when `state.status` isn't re-captured is the Mode B root-cause hypothesis.
- [`useFlashcardGeneration.ts:10-12`](file:///home/awiacek/version-control/10xCards/src/components/hooks/useFlashcardGeneration.ts#L10-L12) and [`L14-22`](file:///home/awiacek/version-control/10xCards/src/components/hooks/useFlashcardGeneration.ts#L14-L22) — `isRetryableStatus` and `isAbortReasonCancel` are module-level pure functions — testable directly without React.
- Per S-01 plan (archived): `maxRetries: 0` on the SDK — service is one-shot; NO SDK-level retries to test.
- Per S-04 plan (archived): timeout tiers are **separate AbortControllers per attempt** (30s / 45s / 60s), NOT the original shared 30s from S-01.

---

## Desired End State

After this plan completes:

1. `npm test` runs and exits green with no failures.
2. `test/lib/services/ai-generation.test.ts` covers all 8 parsing branches for `generateFlashcards` plus `cleanJsonString` edge cases.
3. `test/components/hooks/useFlashcardGeneration.test.ts` covers the two pure helpers and the full hook timeout-tier state machine (30s → 45s → error; 60s manual path; immediate-fail on non-retryable status; Mode B regression).
4. `test-plan.md §6.1` cookbook is filled in with the established patterns.
5. `test-plan.md §3` Phase 1 status advances to `complete`.

### Verification

```bash
npm test        # all tests pass, no skips
```

---

## Implementation Phases

### Phase 1 — Bootstrap vitest

Install packages, create config and support files, add npm scripts. No test files yet — goal is `npm test` runs (with 0 test files, exits green).

**Files to create/modify:**

- `vitest.config.ts` (create)
- `src/__mocks__/astro-env-server.ts` (create)
- `test/setup.ts` (create)
- `package.json` — add `"test"` and `"test:watch"` scripts

**Steps:**

- Install dev dependencies:
  ```bash
  npm install -D vitest@^4 @testing-library/react@^16 @testing-library/jest-dom@^6 jsdom@^26 @types/node@^22
  ```
  > Note: `@testing-library/user-event` is deferred — Phase 1 hook tests use `act()` + `renderHook`, not user events.

- Create `vitest.config.ts`:
  ```ts
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
    test: {
      environment: 'node',
      setupFiles: ['./test/setup.ts'],
      include: ['test/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules', 'dist', '.astro'],
      reporters: ['verbose'],
      alias: {
        'astro:env/server': new URL('./src/__mocks__/astro-env-server.ts', import.meta.url).pathname,
      },
    },
  });
  ```
  > `resolve.alias` handles `@/*` imports in source under test. `test.alias` handles the Astro virtual module. Both are needed.

- Create `src/__mocks__/astro-env-server.ts`:
  ```ts
  export const OPENROUTER_API_KEY = 'test-key';
  export const SUPABASE_URL = 'http://localhost:54321';
  export const SUPABASE_KEY = 'test-key';
  ```

- Create `test/setup.ts`:
  ```ts
  import '@testing-library/jest-dom';
  ```

- Add to `package.json` scripts:
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```

- Verify: `npm test` runs and exits 0 (no test files yet → passes trivially).

---

### Phase 2 — R1: LLM Parsing Unit Tests

Create `test/lib/services/ai-generation.test.ts` covering all 8 oracle cases plus `cleanJsonString`.

**Oracle source:** research.md §Area 1, archived `2026-09-02-ai-card-generation/plan.md:77-84, 204`.

**Mock strategy:** `vi.mock('openai')` to prevent the module-level singleton from making real network calls; `vi.mock('astro:env/server', ...)` is handled globally by the vitest alias. The `openai` mock's `chat.completions.create` is configured per test to return `{ choices: [{ message: { content: '...' } }] }`.

**Test structure:**

```
describe('cleanJsonString', () => {
  it('returns trimmed string unchanged when no fence')
  it('strips ``` fence when content is wrapped')
  it('strips ```json fence when content is wrapped')
  it('does NOT strip when closing fence is missing')    ← documents the cascade-to-JSON.parse behavior
})

describe('generateFlashcards', () => {
  describe('Case 1 — null/empty/whitespace content', () => {
    it('throws "Empty response received from AI model" when content is null')
    it('throws "Empty response received from AI model" when content is whitespace-only')
  })
  describe('Case 2 — fenced JSON', () => {
    it('parses JSON successfully when wrapped in ```json fence')
    it('parses JSON successfully when wrapped in plain ``` fence')
  })
  describe('Case 3 — bare array response', () => {
    it('accepts a top-level JSON array (no .cards wrapper)')
  })
  describe('Case 4 — >15 cards', () => {
    it('returns exactly 15 candidates when LLM returns 20 valid cards')
  })
  describe('Case 5 — over-limit front/back', () => {
    it('silently drops cards with front > 500 chars')
    it('silently drops cards with back > 2000 chars')
    it('silently drops cards with empty front after trim')
    it('silently drops cards with empty back after trim')
  })
  describe('Case 6 — malformed JSON', () => {
    it('throws "Failed to parse AI response as JSON" on invalid JSON')
  })
  describe('Case 7 — happy path', () => {
    it('returns CandidateCard[] with trimmed front and back')
    it('accepts cards at the exact limit boundaries (front=500, back=2000)')
  })
  describe('Case 8 — empty candidate list', () => {
    it('returns [] when JSON has no .cards key and is not an array')
    it('returns [] when all cards fail validation')
    it('returns [] (does not throw) when valid JSON has zero valid entries')
  })
  describe('text privacy NFR', () => {
    it('does not log the study text on success')
    it('does not log the study text when AI returns empty content')
    it('does not log the study text when JSON parse fails')
  })
})
```

**Constraints:**
- Assert against literal oracle values (`"Empty response received from AI model"`, `"Failed to parse AI response as JSON"`) — NOT implementation-derived.
- Do NOT test that `generateFlashcards` retries — `maxRetries: 0`, service is one-shot.
- Text privacy tests: use `vi.spyOn(console, 'log')` and `vi.spyOn(console, 'error')` and assert the study text string never appears in any call argument.

---

### Phase 3 — R4: Retry State Machine Unit Tests

Create `test/components/hooks/useFlashcardGeneration.test.ts` covering the two pure helpers and the hook's full state machine.

Add `// @vitest-environment jsdom` docblock at the top of the file.

**Mock strategy:**
- `global.fetch = vi.fn()` — intercept all fetch calls; configure per test to return specific HTTP responses or hang indefinitely.
- `vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach` — control `setTimeout` for AbortController timeout callbacks.
- Use `renderHook(() => useFlashcardGeneration())` from `@testing-library/react`.
- Use `await act(() => vi.advanceTimersByTimeAsync(ms))` to advance time and flush React state updates.

**Test structure:**

```
describe('isRetryableStatus', () => {
  it.each([408, 429, 500, 503, 599])('returns true for %i', status => ...)
  it.each([200, 201, 400, 401, 403, 404, 422])('returns false for %i', status => ...)
})

describe('isAbortReasonCancel', () => {
  it('returns true when err is the string "CANCEL"')
  it('returns true when controller.signal.reason === "CANCEL"')
  it('returns false when controller.signal.reason === "TIMEOUT"')
  it('returns false when controller is null')
})

describe('useFlashcardGeneration — timeout tier state machine', () => {
  describe('Attempt 1 → Attempt 2 path (timeout on attempt 1)', () => {
    it('stays "loading" after 29,999 ms')
    it('stays "loading" after 30,001 ms (attempt 2 starts silently)')
    it('transitions to "error" with lastAttemptTimeout=45 after attempt 2 times out at 45s')
    it('transitions to "success" if attempt 2 resolves before timeout')
    it('stays "loading" through the full 30s+45s window = 75s before error')
  })

  describe('Attempt 1 → Attempt 2 path (retryable HTTP error on attempt 1)', () => {
    it.each([408, 429, 500])('triggers attempt 2 when attempt 1 returns %i', status => ...)
    it('stays "loading" through attempt 2 when attempt 1 returns 503')
  })

  describe('Immediate fail — non-retryable HTTP error', () => {
    it.each([400, 401, 403, 404])('transitions to "error" immediately (no attempt 2) when attempt 1 returns %i', ...)
    it('sets lastAttemptTimeout=30 on immediate non-retryable fail')
  })

  describe('Manual retry path (60s timeout)', () => {
    it('uses 60s timeout when called with state.status === "error" (isManual=true)')
    it('stays "loading" at 59,999 ms on manual retry')
    it('transitions to "error" with lastAttemptTimeout=60 after 60,001 ms on manual retry')
    it('transitions to "success" if 60s attempt resolves before timeout')
  })

  describe('Mode B regression — stale closure routing', () => {
    // Hook starts fresh (idle), first call fails (error state), second call (manual retry)
    // must route to the 60s path, not the 30s path.
    // If this test passes green, the bug is not present; keep as regression guard.
    it('routes to 60s timeout on second generate() call when state.status is "error"', async () => {
      // Setup: hook in "error" state after a first failed attempt
      // Action: call generate(text) again (no explicit manualRetry arg)
      // Assert: at 30,001ms state is still "loading" (not yet errored — proves 60s path taken)
    })
  })

  describe('Cancel', () => {
    it('transitions to "idle" when cancel() is called during loading')
    it('does not trigger a state "error" when fetch is cancelled via cancel()')
  })
})
```

**Constraints:**
- All timing assertions use `vi.advanceTimersByTimeAsync` — do NOT use `setTimeout` in tests.
- Assert the actual `state.lastAttemptTimeout` value alongside `state.status` — this is the observable that distinguishes which tier ran.
- Mode B test: if it fails (green unexpectedly) document with a comment. If it cannot reproduce the bug in the `renderHook` environment, annotate with `// Mode B: stale closure not reproducible in isolated renderHook — behavior confirmed correct in this context` and mark the test as documenting intent.
- Do NOT assert `fetch` call count alone — always pair with timer or state assertion to verify actual elapsed behavior.

---

### Phase 4 — Green run + Cookbook update

Run the full suite, fix any failures, then fill in `test-plan.md §6.1` with the established patterns.

**Steps:**

1. Run `npm test` — all tests must pass (no `skip`, no `todo` left unmarked).
2. If Mode B test cannot reproduce the stale-closure bug in `renderHook` (test passes green immediately regardless of state routing): annotate the test body as documented above and leave it green.
3. Update `context/foundation/test-plan.md §6.1`:
   ```markdown
   ### 6.1 Adding a unit test (pure function or hook)

   **File location**: `test/` mirroring `src/` hierarchy.
   e.g. `src/lib/services/foo.ts` → `test/lib/services/foo.test.ts`

   **Environment**:
   - Pure functions (no DOM): default `node` pool — no docblock needed.
   - React hooks: add `// @vitest-environment jsdom` as first line of the test file.

   **Mock patterns established in Phase 1:**
   - `astro:env/server`: aliased globally in `vitest.config.ts` → `src/__mocks__/astro-env-server.ts`. No per-test mock needed.
   - OpenAI SDK: `vi.mock('openai')` at top of file; configure `chat.completions.create` per test with `vi.mocked(...).mockResolvedValueOnce(...)`.
   - `fetch`: `global.fetch = vi.fn()` in `beforeEach`; configure per test with `.mockResolvedValueOnce(new Response(...))`.
   - Timers: `vi.useFakeTimers()` / `vi.useRealTimers()` in `beforeEach` / `afterEach`; advance with `await act(() => vi.advanceTimersByTimeAsync(ms))`.

   **Oracle rule**: assertion values come from PRD, archived plans, or explicit spec — never from reading the implementation output and asserting it back.

   **Fixture convention**: inline fixtures (string literals) for parsing tests; no fixture files needed for Phase 1 scope.
   ```
4. Advance `test-plan.md §3` Phase 1 status to `complete`.
5. Update `context/changes/testing-bootstrap-critical-path/change.md`: set `status: complete`, `updated: <today>`.

---

## Open Risks & Assumptions

| Risk | Likelihood | Mitigation |
|---|---|---|
| `vi.mock('openai')` doesn't prevent the module-level `new OpenAI(...)` singleton from running | Medium | The singleton runs at module-load time before `vi.mock` hoisting in some setups. If this occurs, restructure `ai-generation.ts` to lazily initialize the client (wrap in a function), or use `vi.isolateModules`. |
| Mode B stale closure cannot be reliably reproduced with `renderHook` | Medium | `renderHook` in a single test creates a fresh React context — re-renders are synchronous and the closure is always up-to-date. If so, annotate the test and document in the cookbook. The regression guard still provides value if the hook is ever refactored to use a shared reference. |
| `vi.advanceTimersByTimeAsync` and `act()` interaction produces React warnings about state updates outside `act` | Low | Wrap all timer advances in `await act(() => vi.advanceTimersByTimeAsync(ms))`. If warnings appear, switch to `await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); })`. |
| `@testing-library/jest-dom` matchers not recognized by TypeScript | Low | Add `"@testing-library/jest-dom"` to `tsconfig.json`'s `types` array, or add `/// <reference types="@testing-library/jest-dom" />` to `test/setup.ts`. |
| Lesson: stop containers after testing — no containers used in Phase 1 | n/a | Phase 1 is pure unit tests with zero DB or external service access. Lesson does not apply. |

---

## Progress

- [x] Phase 1 — Bootstrap vitest (install + config + mock files + scripts) — bc53782
- [x] Phase 2 — R1: `test/lib/services/ai-generation.test.ts` (all 8 parsing cases) — 11cbd66
- [x] Phase 3 — R4: `test/components/hooks/useFlashcardGeneration.test.ts` (helpers + tiers + Mode B) — 498e3bd
- [x] Phase 4 — Green run + test-plan §6.1 cookbook + status to complete
