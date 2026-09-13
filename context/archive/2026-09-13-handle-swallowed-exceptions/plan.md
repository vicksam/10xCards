# Handle Swallowed Exceptions Implementation Plan

## Overview

Properly handle two swallowed exceptions in the codebase by propagating server-side fetch errors to the UI on the cards page, surfacing network failures during flashcard generator cancellation, and implementing an automated synchronous database cleanup mechanism for orphaned records.

## Current State Analysis

- **`src/pages/cards.astro`**: When the server-side Supabase query fails during the initial flashcard fetch, the error is logged to the console, but the page continues to render with an empty card list. This can mislead the user into thinking their data is gone.
- **`src/components/hooks/useCardManager.ts`**: The hook manages flashcard state but currently only initializes its internal error state to `null`, meaning it cannot display server-side errors that occurred before hydration.
- **`src/components/hooks/useFlashcardGeneration.ts`**: The `cancel` function attempts to delete an unfinalized generation. If the network request fails, it catches the error, logs it, and silently transitions the state to `idle`, leaving an orphaned database row.
- **`src/pages/api/flashcards/generate.ts`**: The generation endpoint creates a new `generation_reviews` record but does not check for or clean up previous orphaned records for the user.

## Proposed Solution

Instead of failing silently, we will surface errors cleanly in the UI using existing error states. 
1. We will update `useCardManager` to accept an `initialError` prop so that `cards.astro` can pass the server-side error down to the client. The existing "Retry" button will seamlessly trigger a client-side refetch.
2. We will update `useFlashcardGeneration.ts` to transition to an `error` state rather than `idle` if the cancel deletion fails, forcing the user to acknowledge the failure.
3. We will modify the generation API endpoint to clean up any unfinalized generations for the user *before* creating a new one. This ensures database hygiene without requiring complex cron jobs.

## Implementation Phases

### Phase 1: Handle Cards Page Server Error
- Modify `src/components/hooks/useCardManager.ts`:
  - Update `useCardManager` signature to accept an `initialError` parameter (defaulting to `null`).
  - Initialize the `error` state with this `initialError`.
- Modify `src/components/CardManager.tsx`:
  - Add `initialError?: string | null` to `CardManagerProps`.
  - Pass `initialError` into the `useCardManager` hook call.
- Modify `src/pages/cards.astro`:
  - Pass the stringified Supabase error message (if any) to the `CardManager` component as `initialError`.

### Phase 2: Surface Generator Cancel Exceptions
- Modify `src/components/hooks/useFlashcardGeneration.ts`:
  - In the `cancel` function's `catch` block, instead of setting state to `idle`, set it to `error` with a message like "Failed to cancel cleanly. Please check your connection and try again."
  - Ensure the `lastAttemptTimeout` is managed appropriately.

### Phase 3: Synchronous Cleanup on Next Generation
- Modify `src/pages/api/flashcards/generate.ts`:
  - Before inserting a new record into `generation_reviews`, execute a `DELETE` query on `generation_reviews` where `user_id` matches the current user and `finalized_at IS NULL`.
  - We will not abort the generation if this cleanup delete fails (we will just log it), to ensure the user's primary action is not blocked by a background cleanup failure.

## Open Risks & Assumptions

- **Risk: Supabase delete fails during generation** → **Mitigation:** We will ensure the cleanup query does not return a blocking 500 error if it fails; it will log the error but allow the creation of the new flashcards to proceed.
- **Risk: Client-side refetch bypassing SSR** → **Mitigation:** The "Retry" button in `CardManager` already relies on the client-side `fetchCards` function, which fetches from the API and updates state locally. This is safe and provides a fast recovery path.

## Progress

- [x] Phase 1: Handle Cards Page Server Error — ac1ff3e
- [x] Phase 2: Surface Generator Cancel Exceptions — fb047c7
- [x] Phase 3: Synchronous Cleanup on Next Generation — 87d3787

### Addendum 1: UI Improvements for Cancellation
During implementation, it was identified that simply surfacing a cancellation error message was insufficient for a good user experience. Additional UI state was added to `src/components/FlashcardGenerator.tsx` to handle a dedicated cancellation retry flow (`handleRetryCancel`) and to show a success message upon clean cancellation.
