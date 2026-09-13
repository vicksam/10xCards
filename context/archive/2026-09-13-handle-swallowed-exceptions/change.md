---
change_id: handle-swallowed-exceptions
title: Handle swallowed exceptions
status: archived
created: 2026-09-13
updated: 2026-09-13
archived_at: 2026-09-13T19:39:29Z
---

## Notes

The user wants to address two instances of swallowed/unhandled exceptions:

1. **Swallowed Exception in `useFlashcardGeneration` Hook:**
   In `src/components/hooks/useFlashcardGeneration.ts` (inside the `cancel` function), when attempting to delete an unfinalized generation, a `fetch` network exception is caught, logged, and then execution silently ignores the failure, resetting the state to idle.

2. **Swallowed Supabase Fetch Error on Cards Page:**
   In `src/pages/cards.astro`, a database query error from the Supabase SDK during server-side pre-fetching is logged, but the page execution simply falls back to an empty array rather than handling the failure state.
