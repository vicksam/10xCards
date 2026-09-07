# UX Improvements Implementation Plan

## Overview

Implement S-04 UX improvements across the generation and study flows: progressive generation timeouts (30s → 45s → 60s), a hard-cancel for in-progress generation that aborts the fetch and cleans up the database, and a full-page-reload restart for completed study sessions.

## Current State Analysis

- **Generation Timeouts**: The client hook applies a static 35s `AbortController` timeout, wrapping the server SDK's 25s timeout. The hook attempts one silent retry on network/5xx/408/429 errors, but it shares the initial 35s deadline. The error UI is generic.
- **Generation Cancel**: The `reset()` function aborts the fetch, but if candidates were already received, a `generation_reviews` row remains in the database unfinalized indefinitely. The table has `using (false)` for DELETE operations.
- **Study Session Restart**: When a study session completes, the queue is exhausted and the only option is to return to the dashboard.

## Desired End State

1. **Progressive Timeouts**: 
   - Attempt 1: 30s client timeout (25s server timeout).
   - Silent Attempt 2 (on retryable error): 45s client timeout (40s server timeout).
   - Manual Attempt 3 ("Try again" button): 60s client timeout (55s server timeout).
   - Error messages explicitly show the timeout duration, and the "Try again" button displays the next timeout ceiling.
2. **Hard Cancel**: A "Cancel generation" button in the top-right corner during loading and review phases. Clicking it aborts the fetch and calls a new endpoint to hard-delete the unfinalized `generation_reviews` row, leaving no trace in stats.
3. **Session Reset**: A "Restart session" button on the study completion screen that triggers a full page reload to fetch newly-due cards.

### Key Discoveries:

- Delete operations on `generation_reviews` currently have `using (false)`, requiring an RLS update.
- Client timeout dictates server timeout via `AbortSignal`, but OpenAI client must have a higher base timeout.

## What We're NOT Doing

- No soft-deletes or "finalize with zero cards" logic (explicitly rejected in favor of hard-delete for cleaner stats).
- No new FSRS logic or study queue adjustments; we rely on full SSR reload.
- No progress-bar countdowns for the timeout.

## Implementation Approach

Four phases in dependency order: (1) Database and API delete route; (2) Hook refactoring for progressive timeouts and server timeout propagation; (3) Cancel UI integration; (4) Study session reset UI.

## Phase 1: Database & API Cancel Route

### Overview

Allow users to hard-delete their own unfinalized generation sessions by introducing an RLS policy and an API endpoint.

### Changes Required:

#### 1. Database Migration

**File**: `supabase/migrations/20260908000000_generation_reviews_delete.sql`

**Intent**: Drop the existing `using (false)` DELETE policy on `generation_reviews` and allow users to delete their unfinalized rows.

**Contract**: 
```sql
CREATE POLICY "Users can delete their own unfinalized generation reviews"
  ON generation_reviews FOR DELETE
  USING (auth.uid() = user_id AND finalized_at IS NULL);
```

#### 2. Cancel API Route

**File**: `src/pages/api/flashcards/generation/[id].ts`

**Intent**: Provide a `DELETE` endpoint to securely hard-delete unfinalized generation reviews.

**Contract**: `export const prerender = false; export const DELETE: APIRoute;`. Execute Supabase delete where `id = params.id`, `user_id = user.id`, and `finalized_at IS NULL`. Return `204 No Content`.

### Success Criteria:

#### Automated Verification:

- 1.1 Migration applies cleanly: `npx supabase migration up`
- 1.2 Type generation passes: `npx supabase gen types typescript --local`

#### Manual Verification:

- 1.3 Endpoint respects RLS (cannot delete finalized rows or other users' rows).

---

## Phase 2: Progressive Timeouts & Hook Refactor

### Overview

Implement escalating timeouts and propagate them to the server SDK, allowing longer processing times for manual retries.

### Changes Required:

#### 1. AI Generation Service & Route

**File**: `src/lib/services/ai-generation.ts` & `src/pages/api/flashcards/generate.ts`

**Intent**: Accept dynamic timeouts from the client and ensure `AbortSignal` correctly cancels the OpenAI request and prevents row insertion.

**Contract**: Update `generateFlashcards` to accept `AbortSignal`. Set OpenAI client timeout to `65000`. Pass `context.request.signal` in the API route. Return early if `AbortError` is caught.

#### 2. Flashcard Generation Hook

**File**: `src/components/hooks/useFlashcardGeneration.ts`

**Intent**: Manage escalating timeouts per retry and expose a `cancel` method that cleans up the database.

**Contract**: 
- Track `lastAttemptTimeout` for UI.
- Use 30000ms for attempt 1, 45000ms for silent retry, 60000ms for manual retry.
- Add `cancel(generationId?: string)` method firing a DELETE request to `/api/flashcards/generation/${generationId}`.

### Success Criteria:

#### Automated Verification:

- 2.1 TypeScript type checks pass: `npx tsc --noEmit`
- 2.2 ESLint passes: `npm run lint`

#### Manual Verification:

- 2.3 Simulated slow generation aborts at 30s, silent retries for 45s, and manual retry allows 60s.

---

## Phase 3: Cancel UI

### Overview

Place a "Cancel generation" button consistently during the generation loading and review phases.

### Changes Required:

#### 1. Flashcard Generator Component

**File**: `src/components/FlashcardGenerator.tsx`

**Intent**: Display a cancel button during active generation and update error messages to reflect timeouts.

**Contract**: Render cancel button when `status === 'loading'` or reviewing. Clicking it invokes `cancel(state.generationId)` and resets the UI. Update "Try again" button to reflect up to 60s timeout.

### Success Criteria:

#### Automated Verification:

- 3.1 Build succeeds: `npm run build`

#### Manual Verification:

- 3.2 Clicking cancel during loading resets UI and no database row is created.
- 3.3 Clicking cancel during review resets UI and deletes the unfinalized database row.

---

## Phase 4: Study Session Reset

### Overview

Allow continuous studying without returning to the dashboard by offering a full page reload.

### Changes Required:

#### 1. Study Session Component

**File**: `src/components/StudySession.tsx`

**Intent**: Provide a convenient way to study newly-due cards immediately after finishing a session.

**Contract**: Add "Study more cards" button on `sessionDone` view. `onClick={() => window.location.reload()}`.

### Success Criteria:

#### Automated Verification:

- 4.1 Build succeeds: `npm run build`

#### Manual Verification:

- 4.2 Clicking "Study more cards" reloads the page and presents the next batch of cards (or empty state if none are due).

---

## Testing Strategy

### Unit Tests:
- Ensure the `useFlashcardGeneration` hook handles timeouts appropriately (if test suite exists).

### Integration Tests:
- End-to-end testing of the `DELETE` API route with simulated user sessions.

### Manual Testing Steps:
1. Trigger generation, wait for it to hang, observe timeout behavior.
2. Cancel generation mid-flight, verify database state in Supabase Studio.
3. Finish a study session and verify the reload functionality.

## Performance Considerations

- Relying on full page reload for study sessions is lightweight and relies on standard Astro SSR, avoiding client-side FSRS complexity.
- Cloudflare Workers execution timeouts (max 30s on free tier, higher on paid/unbound) must not prematurely kill the 60s generation request; ensure Cloudflare is configured for higher timeouts if necessary.

## Migration Notes

- Database migration applies a new RLS policy; no data migration is necessary.

## References

- Implementation builds upon existing components in `FlashcardGenerator.tsx` and `StudySession.tsx`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database & API Cancel Route

#### Automated

- [x] 1.1 Migration applies cleanly: npx supabase migration up — 1b6dc27
- [x] 1.2 Type generation passes: npx supabase gen types typescript --local — 1b6dc27

#### Manual

- [x] 1.3 Endpoint respects RLS — 1b6dc27

### Phase 2: Progressive Timeouts & Hook Refactor

#### Automated

- [x] 2.1 TypeScript type checks pass: npx tsc --noEmit
- [x] 2.2 ESLint passes: npm run lint

#### Manual

- [x] 2.3 Simulated slow generation escalates timeouts properly

### Phase 3: Cancel UI

#### Automated

- [ ] 3.1 Build succeeds: npm run build

#### Manual

- [ ] 3.2 Cancel during loading resets UI and DB
- [ ] 3.3 Cancel during review resets UI and DB

### Phase 4: Study Session Reset

#### Automated

- [ ] 4.1 Build succeeds: npm run build

#### Manual

- [ ] 4.2 Study more cards reloads correctly
