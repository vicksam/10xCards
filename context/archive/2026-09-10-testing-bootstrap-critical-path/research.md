---
date: 2026-09-11T00:41:00+02:00
researcher: Antigravity
git_commit: 6206af7d21e174dd5131f194acb4fe1a322bedc0
branch: master
repository: 10xCards
topic: "Bootstrap + critical-path unit test coverage — Phase 1 (R1: LLM parsing, R4: retry state machine)"
tags: [research, codebase, testing, vitest, ai-generation, useFlashcardGeneration, retry, parsing]
status: complete
last_updated: 2026-09-11
last_updated_by: Antigravity
---

# Research: Bootstrap + Critical-Path Unit Tests — Phase 1

**Date**: 2026-09-11T00:41:00+02:00  
**Researcher**: Antigravity  
**Git Commit**: `6206af7d21e174dd5131f194acb4fe1a322bedc0`  
**Branch**: master  
**Repository**: 10xCards

---

## Research Question

What is the oracle contract for R1 (LLM response parsing in `ai-generation.ts`) and R4 (retry state machine in `useFlashcardGeneration.ts`), and what is required to bootstrap vitest in this Astro 6 + Cloudflare Workers project for pure-function and hook unit tests?

---

## Summary

Phase 1 targets two high-signal risks at zero infrastructure cost:

- **R1**: LLM response parsing — `cleanJsonString()` is fully pure and testable without any mocks. The parsing logic in `generateFlashcards()` is testable once the `openai` client and `astro:env/server` module are mocked. All 8 parsing branches have a clean oracle from the plan spec; there are **no behavioral discrepancies** between implementation and contract (4 minor config drifts documented but none affect parsing logic).
- **R4**: Retry state machine — Three distinct timeout tiers (30s → 45s → 60s, separate AbortControllers per attempt). Two pure helper functions (`isRetryableStatus`, `isAbortReasonCancel`) are testable directly. Full hook behavior requires `renderHook` + `vi.useFakeTimers()`. The Mode A/B bugs are most likely explained by stale `useCallback` closure over `state.status`.
- **Bootstrap**: `vitest@^4` is required (Vite 7.3.6 is installed; Vitest 3.x only supports Vite ≤6). The `astro:env/server` virtual module import in `ai-generation.ts` is the #1 landmine — must be aliased in vitest config or the parser extracted to a dependency-free file.

---

## Detailed Findings

### Area 1: LLM Response Parsing — R1 Oracle

#### Parsing Functions

| Function | File:Lines | Pure? | Mock needed |
|---|---|---|---|
| `cleanJsonString(content)` | `ai-generation.ts:28-37` | **Yes** | None |
| `generateFlashcards(text, signal?)` | `ai-generation.ts:50-108` | Once mocked | `openai` client, `astro:env/server` |

#### Limit Constants (inline literals — no shared constant)

| Limit | Value | Location |
|---|---|---|
| Max cards | **15** | `ai-generation.ts:107` |
| Max front length | **500 chars** | `ai-generation.ts:100` |
| Max back length | **2000 chars** | `ai-generation.ts:100` |
| Min front/back | **1 char** (after trim) | `ai-generation.ts:100` |

> **WARNING**: These limits are **inline magic numbers** — no named constant is shared across layers. Each layer (service, API route Zod schema, DB constraint, finalize RPC) re-states them independently. Tests must use the literal values, not a shared import.

#### Complete Parsing Branch Map

```
generateFlashcards(text, signal?)
  │
  ├─ L51-53:  !OPENROUTER_API_KEY  →  throw Error("OPENROUTER_API_KEY is not configured")
  │
  ├─ L55-68:  openai.chat.completions.create(...)  [async, network — mock this]
  │
  ├─ L70-73:  content null/empty/whitespace  →  throw Error("Empty response received from AI model")
  │
  ├─ L75:     cleanJsonString(content)
  │              ├─ starts with ``` AND last line is ```  →  strip fence, return interior
  │              └─ otherwise                             →  return trimmed as-is
  │
  ├─ L77-81:  JSON.parse fails  →  throw Error("Failed to parse AI response as JSON")
  │
  ├─ L83-88:  parsed is array?          →  rawCards = parsed           [BARE ARRAY path]
  │           parsed has .cards array?  →  rawCards = parsed.cards     [ENVELOPE path]
  │           neither                   →  rawCards = []               [EMPTY path]
  │
  ├─ L90-105: for each rawCard:
  │              {front: string, back: string}? trim → within [1,500] × [1,2000]? → push
  │              otherwise → skip silently
  │
  └─ L107:    return candidates.slice(0, 15)
```

#### Per-Case Oracle Table

| Case | Trigger | Oracle (should) | Implementation | Discrepancy |
|---|---|---|---|---|
| 1. Null/empty content | `content` is null, undefined, or whitespace-only | throw `Error("Empty response received from AI model")` | ✅ matches | None |
| 2. Fenced JSON | Content starts with ` ``` ` and ends with ` ``` ` | Strip fence, parse inner JSON | ✅ matches | Minor: unclosed fence cascades to JSON.parse failure rather than a dedicated fence error — acceptable per "strips *optional* fence" oracle |
| 3. Bare array | `JSON.parse` returns `[...]` directly | Use array as `rawCards`, apply per-card filtering | ✅ matches (explicit fallback) | None |
| 4. >15 cards | >15 valid cards pass filtering | Return exactly first 15 | ✅ `.slice(0, 15)` | None |
| 5. Over-limit front/back | `front.trim().length > 500` or back `> 2000` | Silently skip card (filter) | ✅ matches | None |
| 6. Malformed JSON | `JSON.parse` throws | throw `Error("Failed to parse AI response as JSON")` | ✅ original error swallowed — matches privacy NFR | None |
| 7. Happy path | Valid `{ cards: [{front, back}] }` | Return `CandidateCard[]` (1–15 items) | ✅ matches | None |
| 8. Empty candidate list | All cards filtered OR wrong JSON shape | Return `[]` (no throw) | ✅ matches | None |

#### Config Drift vs. Plan (non-behavioral — document for completeness)

| Parameter | Plan spec | Implementation | Impact on tests |
|---|---|---|---|
| Model | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` (L58) | None — tests mock the API response |
| SDK timeout | 25,000 ms | 65,000 ms (L42) | Document only — AbortSignal from hook is the real guard |
| Param name | `max_completion_tokens` | `max_tokens` (L64) | None — functionally equivalent for current SDK |
| Temperature | 0.3 | 0.2 (L63) | None — affects model output, not parsing |

#### Test-Purity Assessment

| Target | Strategy |
|---|---|
| `cleanJsonString()` | **Test directly** — no mocks at all. Pass raw strings, assert return value. |
| Parsing logic in `generateFlashcards()` | Mock `openai.chat.completions.create` to return `{ choices: [{ message: { content: "..." } }] }`. Mock `astro:env/server` module. |
| `OPENROUTER_API_KEY` guard | Mock env to `undefined`/`""` — verify the throw. |

---

### Area 2: Retry State Machine — R4 Oracle

#### Timeout Tier Structure

| Attempt | Timeout | Line | Trigger |
|---|---|---|---|
| Attempt 1 (auto) | **30,000 ms** | `useFlashcardGeneration.ts:144` | First `generate(text)` call with `isManual === false` |
| Attempt 2 (silent auto-retry) | **45,000 ms** | `useFlashcardGeneration.ts:178` | Attempt 1 fails with retryable condition |
| Manual retry | **60,000 ms** | `useFlashcardGeneration.ts:109` | `generate(text)` called when `isManual === true` |

> **IMPORTANT**: This is the **post-S-04** architecture. The original S-01 plan used a single shared 30s AbortController across both auto-attempts. S-04 (`ux-improvements`) changed it to separate, escalating controllers per attempt. Tests must use the tiered model (30s / 45s / 60s), NOT the original shared 30s design.

#### Retryable vs. Immediate-Fail HTTP Status Codes

```ts
// isRetryableStatus — useFlashcardGeneration.ts:10-12
status === 408 || status === 429 || (status >= 500 && status <= 599)

// Also retryable: AbortError/timeout, status === 0 (network error)

// Immediate failure (no retry): 400, 401, 403, 404, 422, and all other non-listed 4xx
```

#### AbortController Lifecycle — Critical for Mode A/B

**Key finding: AbortController is created fresh per attempt (L78), NOT shared.**

```ts
// executeAttempt(timeoutMs) — closure defined at L77-104
L78: const controller = new AbortController();       // ← fresh per attempt
L79: abortControllerRef.current = controller;         // ← overwrites previous
L80-82: setTimeout(() => controller.abort("TIMEOUT"), timeoutMs);
L85-90: fetch(url, { signal: controller.signal });    // ← fresh signal
```

| `abort()` call site | Line | Reason string | Triggered by |
|---|---|---|---|
| Timeout callback | L80-82 | `"TIMEOUT"` | `setTimeout` fires after `timeoutMs` ms |
| `reset()` | L31 | `"CANCEL"` | Hook cleanup / unmount |
| `cancel()` | L40 | `"CANCEL"` | User cancels (note: does NOT null the ref) |
| New `generate()` preamble | L60 | `"CANCEL"` | Second call while in-flight |

**Signal leakage verdict:** ✅ **No leakage** — each `executeAttempt` call creates an independent controller. Attempt N+1 always gets a fresh, non-aborted signal.

#### `isManual` Determination — Root of Mode A/B Bugs

```ts
// L64 — inside useCallback with dependency [state.status] (L210)
const isManual = manualRetry ?? state.status === "error";
```

This single line is the routing decision. If `state.status` in the captured closure is not `"error"` when the user triggers a manual retry, `isManual` evaluates to `false` and the call takes the **30s auto path** instead of the 60s manual path.

#### Mode A Root Cause Hypothesis ("resolves ~12s during 30s→45s window")

**Most testable hypothesis:** Attempt 1 fails fast with HTTP 5xx (not a timeout) — attempt 2 starts immediately, server responds at ~12s into attempt 2. Total wall-clock ≈ 12s. This is **correct behavior**, not a bug — the tiers are timeouts (upper bounds), not wait periods. The UI correctly stays in `loading` throughout.

**Secondary hypothesis:** `generate()` is called when `state.status === "error"` without explicit `manualRetry: false`, causing `isManual = true` → routes to 60s single-attempt path. If that 60s attempt resolves in ~12s, total is ~12s.

**Test assertion to pin this behavior:** Advance fake timers by 29,999ms → state must still be `"loading"`. Advance to 30,001ms → assert auto-retry starts (attempt 2 begins, not error state).

#### Mode B Root Cause Hypothesis ("60s manual retry returns error immediately")

**Most likely cause:** Stale `useCallback` closure. If `state.status` in the closure's captured snapshot is not `"error"` (because the memoized `generate` wasn't re-created after a re-render), `isManual` evaluates to `false` → routes to 30s auto path → that attempt fails or is aborted immediately → instant error.

**Concrete test to expose Mode B:** Set up hook in `"error"` state. Call `generate(text)` (no explicit `manualRetry` arg). Use fake timers to assert:
1. After 59,999ms: state is still `"loading"`
2. After 60,001ms: state is `"error"` with `lastAttemptTimeout: 60`

If the hook routes to the 30s path instead, the test will fail at step 1 (state becomes `"loading"`, then error after 30s), exposing Mode B.

#### Pure Helper Functions (Testable Without React)

| Function | Lines | Test approach |
|---|---|---|
| `isRetryableStatus(status)` | `useFlashcardGeneration.ts:10-12` | Direct call with status codes 200, 400, 408, 429, 500 — assert boolean |
| `isAbortReasonCancel(controller, err)` | `useFlashcardGeneration.ts:14-22` | Test with reason `"CANCEL"`, `"TIMEOUT"`, null controller |

#### Recommended Test Approach for Hook

```ts
// Use renderHook + fake timers — no code extraction needed
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
// @vitest-environment jsdom  ← docblock at top of test file

vi.useFakeTimers();
global.fetch = vi.fn();

// Trigger attempt 1:
act(() => { result.current.generate("study text"); });
expect(result.current.state.status).toBe("loading");

// Trigger 30s timeout → attempt 2 starts (state stays "loading"):
await act(() => vi.advanceTimersByTimeAsync(30_001));
expect(result.current.state.status).toBe("loading");

// Trigger 45s timeout → error state:
await act(() => vi.advanceTimersByTimeAsync(45_001));
expect(result.current.state.status).toBe("error");
expect(result.current.state.lastAttemptTimeout).toBe(45);
```

---

### Area 3: Vitest Bootstrap Requirements

#### Current State

- **No test runner** exists: no `test` script, no `vitest.config.*`, no `jest.config.*` (`package.json:5-15`)
- **Vite 7.3.6** is installed via override (`package.json:63-65`)

#### Critical Landmines

> **CAUTION — `astro:env/server` at `ai-generation.ts:1`**: This Astro virtual module only exists inside Astro's build pipeline. In vitest's node pool it will throw `Error: Cannot find module 'astro:env/server'`. Must be aliased in `vitest.config.ts` OR pure parsing functions extracted to a dependency-free file.

> **CAUTION — Vitest version**: Vitest 3.x peer dep is `vite ^5 || ^6`. With Vite 7.3.6 installed, **`vitest@^4`** is required. Using `vitest@^3` will produce peer dependency conflicts.

> **WARNING**: Do NOT import `astro.config.mjs` into `vitest.config.ts`. The Cloudflare adapter and Astro's Vite plugins require the Workers runtime.

#### Packages to Install

```bash
npm install -D \
  vitest@^4 \
  @testing-library/react@^16 \
  @testing-library/user-event@^14 \
  @testing-library/jest-dom@^6 \
  jsdom@^26 \
  @types/node@^22
```

#### Pool Strategy

| Test type | Environment | Rationale |
|---|---|---|
| Pure functions (`cleanJsonString`, card validator, `isRetryableStatus`) | `node` (default) | Zero overhead, no DOM needed |
| React hook (`useFlashcardGeneration`) | `jsdom` via per-file docblock | Use `// @vitest-environment jsdom` at top of hook test file |

#### Minimal `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Match tsconfig.json: "@/*" -> "./src/*"
      // Use new URL() form to avoid relative-path resolution bug
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',   // default; hook tests opt-in via // @vitest-environment jsdom
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.astro'],
    reporters: ['verbose'],
    // Mock astro:env/server virtual module
    alias: {
      'astro:env/server': new URL(
        './src/__mocks__/astro-env-server.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
```

**`src/test/setup.ts`:**
```ts
import '@testing-library/jest-dom';
```

**`src/__mocks__/astro-env-server.ts`:**
```ts
export const OPENROUTER_API_KEY = 'test-key';
export const SUPABASE_URL = 'http://localhost:54321';
export const SUPABASE_KEY = 'test-key';
```

**`package.json` scripts to add:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

#### CI Note

Per `test-plan.md §3`, adding `npm test` to CI is **Phase 4** work, not Phase 1. Phase 1 only bootstraps the runner and writes the first tests. The current `ci.yml` does not need changes during Phase 1.

---

### Area 4: Historical Context from Archived Plans

#### Top 5 Decisions Affecting Phase 1 Test Authoring

**1. Parser has two explicit fallback paths — both must be tested**
`ai-card-generation/plan.md:204` explicitly documents both: `{ cards: [...] }` envelope AND bare top-level array. The bare-array path is intentional. Test both.

**2. `maxRetries: 0` in OpenAI SDK — service is one-shot**
`ai-card-generation/plan.md:202`: SDK-level retries are explicitly disabled. `generateFlashcards()` makes exactly one HTTP call and either succeeds or throws. All retry logic lives exclusively in `useFlashcardGeneration`. Tests of the service must NOT expect any retry behavior from the function.

**3. Post-S-04 timeout tiers (30s / 45s / 60s) — not original shared 30s**
S-01 plan used a shared 30s AbortController across both auto-attempts. S-04 (`ux-improvements/plan.md:15-19`) changed to separate escalating timeouts with separate AbortControllers per attempt. Tests must target the S-04 model.

**4. Text privacy NFR is an explicit code comment**
`ai-card-generation/plan.md:205`: `// NFR: study text must not be logged or persisted` is placed in `ai-generation.ts`. Any test verifying logging behavior must assert `text` never appears in `console.log`/`console.error`.

**5. Zero-card result returns `[]` — no throw, no DB row**
`ai-card-generation/plan.md:231`: `generateFlashcards()` returns `[]` (not throws) when all cards are filtered. The service-layer contract is simply `Promise<CandidateCard[]>` — empty array is valid output.

---

## Code References

### R1 — ai-generation.ts
- `src/lib/services/ai-generation.ts:1` — `astro:env/server` import — **must be mocked in vitest**
- `src/lib/services/ai-generation.ts:28-37` — `cleanJsonString()` — **fully pure, no mocks**
- `src/lib/services/ai-generation.ts:50-68` — OpenAI client setup and API call — **mock target**
- `src/lib/services/ai-generation.ts:70-73` — null/empty content guard — Case 1
- `src/lib/services/ai-generation.ts:75` — `cleanJsonString` invocation — Case 2
- `src/lib/services/ai-generation.ts:77-81` — JSON.parse + catch — Case 6
- `src/lib/services/ai-generation.ts:83-88` — array vs. envelope routing — Cases 3, 8
- `src/lib/services/ai-generation.ts:90-105` — per-card validation loop — Cases 5, 7
- `src/lib/services/ai-generation.ts:107` — `.slice(0, 15)` — Case 4
- `src/types.ts:13-16` — `CandidateCard` type

### R4 — useFlashcardGeneration.ts
- `src/components/hooks/useFlashcardGeneration.ts:10-12` — `isRetryableStatus` — **pure, test directly**
- `src/components/hooks/useFlashcardGeneration.ts:14-22` — `isAbortReasonCancel` — **pure, test directly**
- `src/components/hooks/useFlashcardGeneration.ts:64` — `isManual` determination — **root of Mode A/B**
- `src/components/hooks/useFlashcardGeneration.ts:77-104` — `executeAttempt` closure — AbortController per call
- `src/components/hooks/useFlashcardGeneration.ts:78` — `new AbortController()` — per-attempt fresh instance
- `src/components/hooks/useFlashcardGeneration.ts:109` — `executeAttempt(60_000)` — manual retry
- `src/components/hooks/useFlashcardGeneration.ts:144` — `executeAttempt(30_000)` — attempt 1
- `src/components/hooks/useFlashcardGeneration.ts:178` — `executeAttempt(45_000)` — attempt 2
- `src/components/hooks/useFlashcardGeneration.ts:210` — `useCallback` dep `[state.status]` — stale closure risk

### Bootstrap
- `package.json:5-15` — no `test` script exists
- `package.json:63-65` — Vite override `^7.3.2` → requires vitest@^4
- `tsconfig.json:8-11` — `@/*` path alias
- `astro.config.mjs:29-35` — env schema (source of `astro:env/server`)
- `.github/workflows/ci.yml` — no test step (Phase 4 adds it)

---

## Architecture Insights

### Parsing — one-shot, defensive multi-path
`generateFlashcards()` is a single network call with defensive multi-path JSON parsing. `maxRetries: 0` is deliberate — retry responsibility delegated entirely to the calling hook. This makes the service simple to unit-test: one call in, one result out, no internal state.

### Retry — tiered AbortController per attempt (post-S-04)
Each attempt creates its own `AbortController` and `setTimeout`. No shared deadline across attempts. Fake timers can control each attempt's deadline independently — this is a clean, testable design.

### `isManual` stale closure — design tension
The `isManual` routing at L64 reads `state.status` from a `useCallback` closure re-created only when `state.status` changes (L210). This creates a TOCTOU window: if `state.status` changes between renders in a fast sequence, the wrong retry path can be taken. This is the most probable explanation for Mode B. Tests must ensure `state.status === "error"` is the closed-over value before calling `generate()`.

---

## Historical Context (from prior changes)

- `context/archive/2026-09-02-ai-card-generation/plan.md:77-84` — Original parsing spec: fence stripping, `parsed.cards` + bare array fallback, limits
- `context/archive/2026-09-02-ai-card-generation/plan.md:82` — "Null, empty, or invalid JSON produces a controlled service error"
- `context/archive/2026-09-02-ai-card-generation/plan.md:202` — `maxRetries: 0` on OpenAI SDK
- `context/archive/2026-09-08-ux-improvements/plan.md:15-19` — S-04 change: tiered timeout model (30s/45s/60s, separate AbortControllers)
- `context/archive/2026-09-02-ai-card-generation/plan.md:205` — Text privacy NFR comment placement

---

## Related Research

- `context/archive/2026-09-02-spaced-repetition-session/research.md` — SRS library selection; not relevant to Phase 1
- `context/changes/scaffold-cleanup/research.md` — Scaffold cleanup findings; no R1/R4 relevance

---

## Open Questions

1. **Extraction vs. alias for `astro:env/server`**: Extract pure parsing functions to `ai-generation-parser.ts` (no Astro dep), or alias the virtual module in vitest config? Extraction is cleaner; aliasing is faster to ship. **Decision needed before Phase 1 implementation begins.**

2. **Vitest 4.x + Vite 7 compatibility**: Verify `npm info vitest@4 peerDependencies` confirms Vite 7 support before installing.

3. **Mode A / Mode B reproduction**: If `renderHook` tests do not reproduce Mode B, the bug may require a more involved integration scenario (React batching edge cases). If no test reproduces it, document as "cannot be pinned by unit test alone."

4. **`isManual` API design**: Should `generate()` require explicit `manualRetry: boolean` (removing the `state.status` inference)? Eliminates stale-closure risk entirely. Out of scope for Phase 1 but worth flagging for a future change.
