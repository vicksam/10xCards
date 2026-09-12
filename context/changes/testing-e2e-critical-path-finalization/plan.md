# Testing e2e critical path finalization Implementation Plan

## Overview

Implementing Phase 2 of the test rollout to cover Risk R2 (finalization failure). This includes scaffolding the Playwright infrastructure (dev server start and auth fixture) using a full UI login with a dedicated test user, and defining the E2E test contract that verifies the UI's error recovery state when the finalization RPC fails.

## Current State Analysis

- **Playwright Config**: Currently lacks a `webServer` block and the referenced `auth.setup.ts` is missing. The user has manually dumped auth state, but we will formalize this with a robust UI login flow.
- **Application Logic**: The review logic in `useCardReview.ts` handles failures cleanly by preserving state and exposing `saveError`. `FlashcardGenerator.tsx` renders this error state correctly with "Retry" and "Discard" options.
- **Risk R2**: A network or RPC failure during `POST /api/flashcards` must not silently drop cards. The UI must explicitly surface the error and provide recovery options.

## Open Risks & Assumptions

- **Test User Credentials**: We assume a dedicated test user exists in the local Supabase instance (e.g., `test@example.com` / `password123`) for the UI login automation.
- **Auth Fixture Locators**: We assume standard login form locators (`getByRole('textbox', { name: /email/i })`, etc.) are available on the `/auth/signin` page.

## Implementation Phases

### Phase 1: Scaffold Playwright Infrastructure
- Update `playwright.config.ts`:
  - Add a `webServer` block to run `npm run dev` at `http://localhost:4321`.
  - Ensure the `chromium` project properly depends on the `setup` project.
- Create `tests/e2e/auth.setup.ts`:
  - Implement a full UI login flow (navigating to the login page, entering credentials for a dedicated test user, and submitting).
  - Save the resulting state to `playwright/.auth/user.json`.
- Ensure `playwright/.auth/` is ignored in `.gitignore`.

### Phase 2: Implement Finalization E2E Test (Risk R2)
- Create `tests/e2e/seed.spec.ts`.
- **Setup**: Use the authenticated context (`playwright/.auth/user.json`). Navigate to `/dashboard` where `FlashcardGenerator` is mounted.
- **Mocking**: Use `page.route('**/api/flashcards')` to intercept the finalization POST request and fulfill it with a 500 status code.
- **Action**: Trigger the save flow (e.g., generate cards, accept them to enter the review phase, then click finalize).
- **Assertions**:
  - Wait for the "Save failed" banner to be visible.
  - Assert the "Retry save" button is visible and enabled.
  - Assert the "Discard" button is visible.
  - Click "Retry save" and verify it triggers another network request to `/api/flashcards`.

## Progress
- [x] Phase 1: Scaffold Playwright Infrastructure — fe2de65
- [x] Phase 2: Implement Finalization E2E Test (Risk R2) — 0396772
