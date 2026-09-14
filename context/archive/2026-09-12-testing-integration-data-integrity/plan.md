# Phase 3 Integration Tests: Data Integrity & Error Paths

## Overview

Implement Phase 3 of the test rollout to cover data integrity (R3) and error paths (R7). We will use Vitest to ensure unfinalized review sessions (orphaned rows) do not corrupt KPI stats, and that sensitive study text never leaks into logs or response bodies on API failure paths.

## Current State Analysis

- The KPI query in `src/pages/stats.astro` uses `.not("finalized_at", "is", null)` to exclude unfinalized rows.
- The `src/pages/api/flashcards/generate.ts` route wraps the AI service call in a try/catch, but currently logs `error` and returns `error.message` to the client. This means upstream errors can potentially leak sensitive text.
- `useFlashcardGeneration.ts` handles manual cancellation, but there is no automatic cleanup for tab closure, meaning orphaned rows rely entirely on query-time exclusion (R3).

## Open Risks & Assumptions

- Assuming the AI service mock accurately reflects how the real `generateFlashcards` function propagates errors.
- Assuming Supabase fetch mocking will accurately simulate the postgREST response structure expected by `@supabase/ssr`.

## Implementation Phases

### 1. Setup and Mock Utilities
- Create a test file `test/integration/data-integrity.test.ts`.
- Set up `global.fetch` mocks for Supabase to intercept queries and simulate database responses, continuing the pattern established in Phase 1.

### 2. R3: KPI Orphaned Row Test
- Write a test replicating the KPI query built in `src/pages/stats.astro`.
- Spy on `global.fetch` to intercept the outgoing request.
- Execute the query using the Supabase client.
- Assert that the constructed network request URL contains the correct PostgREST filter `finalized_at=not.is.null`, proving that the exclusion of orphaned rows happens at the database edge.

### 3. R7: Text Leakage Error Path Test
- Write a test for the POST handler in `src/pages/api/flashcards/generate.ts`.
- Mock `generateFlashcards` to throw an error containing a known sensitive study text string.
- Spy on `console.error`.
- Execute the API route.
- Implement the fix in `generate.ts`: update the catch block to log a sanitized error and return a generic generic message (e.g., "Internal server error during generation") instead of echoing `error.message`.
- Assert that the response body does not contain the sensitive text.
- Assert that the intercepted `console.error` calls do not contain the sensitive text.

## Progress

- [x] 1. Setup and Mock Utilities — c63a2b5
- [x] 2. R3: KPI Orphaned Row Test — feb192b
- [x] 3. R7: Text Leakage Error Path Test — d4cfc19
