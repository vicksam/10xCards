# Integration Tests for Ownership and Auth Boundaries Implementation Plan

## Overview

We are implementing Phase 4 of the test rollout (`testing-integration-ownership-auth`), covering risks R5 (auth-expiry during study) and R6 (IDOR on generation review via finalize or delete). For R5, we will update the study session hook to properly handle 401 Unauthorized responses and surface a clear "Session Expired" error inline. For R6, we will verify the IDOR boundary at the API layer by mocking the Supabase fetch client, ensuring that ownership filters are applied and the proper generation IDs are passed to the security-definer RPC.

## Current State Analysis

Based on the research and codebase analysis:
- **R6 (IDOR on Generation Review):** The backend is already secure. The `finalize_generation_review` RPC explicitly checks ownership during the lock/retrieve process using the caller's `auth.uid()`. The DELETE endpoint explicitly filters by `user_id`. The application routes the calls correctly.
- **R5 (Auth Expiry During Study Session):** When the session cookie expires, the `/api/study/review` route returns a `401 Unauthorized`. However, `useStudySession.ts` parses this error and generically sets `submitError = "Unauthorized"`. The UI component `StudySession.tsx` renders this string blindly in an error box without providing a recovery path.

## Open Risks & Assumptions

- **Mocking Fidelity:** We chose an API layer mock test for R6. This assumes the PostgREST requests sent to Supabase accurately reflect the API's intent and that the Postgres `finalize_generation_review` RPC correctly enforces the `user_id` boundary internally.
- **UI State Management:** For R5, displaying an inline error state with a "Sign in" button that opens in a new tab allows the user to re-authenticate and then retry their action in the original tab, preserving their session state.

## Implementation Phases

- Phase 1: Update UI and Hook for R5 Auth Expiry - Modify `useStudySession.ts` to detect 401s and `StudySession.tsx` to display an inline "Session Expired" error state.
- Phase 2: Write Integration Test for R5 - Create `test/integration/auth-expiry.test.ts` to verify the hook and component behavior when the API returns a 401.
- Phase 3: Write Integration Test for R6 - Create `test/integration/ownership-boundary.test.ts` to mock Supabase fetch requests and verify that the DELETE endpoint appends the `user_id` filter and the POST endpoint correctly passes the `generation_id` to the finalize RPC.
- Phase 4: Update Test Plan Cookbook - Add the pattern for testing cross-user boundaries via mocked network (Phase 4) and mark Phase 4 as complete.

## Progress

- [x] 1.1 Update `useStudySession.ts` to detect 401 errors and set a specific `isAuthExpired` state alongside `submitError`.
- [x] 1.2 Update `StudySession.tsx` to render an inline "Session Expired" error state with a "Sign in" button that opens `/auth/signin` in a new tab when `isAuthExpired` is true.
- [ ] 2.1 Create `test/integration/auth-expiry.test.ts` and set up the `jsdom` environment.
- [ ] 2.2 Write a test that mounts the `StudySession` component (or uses `renderHook` on `useStudySession`), mocks the `fetch` to return a 401, and asserts that the specific auth expiry error UI is shown.
- [ ] 3.1 Create `test/integration/ownership-boundary.test.ts` using the API routing and mocking patterns from Phase 3.
- [ ] 3.2 Write a test for the `DELETE` generation endpoint to verify that `.eq("user_id", context.locals.user.id)` is appended to the Supabase fetch call.
- [ ] 3.3 Write a test for the `POST` (finalize) endpoint to verify that `supabase.rpc("finalize_generation_review", { generation_id })` is called with the correct generation ID.
- [ ] 4.1 Update `context/foundation/test-plan.md` Section 6.4 with the cookbook pattern for IDOR / cross-user ownership boundary integration tests.
- [ ] 4.2 Update `context/foundation/test-plan.md` Section 3 to change Phase 4 status to `complete`.
