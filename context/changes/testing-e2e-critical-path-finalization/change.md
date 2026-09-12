---
change_id: testing-e2e-critical-path-finalization
title: Testing e2e critical path finalization
status: impl_reviewed
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

Phase #2 from `context/foundation/test-plan.md` ("e2e — critical path finalization").

### Rollout Scope & Target Risk
- **Risk R2**: User finalizes a generation session; the finalize RPC fails (network, RLS, 5xx, or already-finalized path) — accepted cards are lost without a visible error to the user.
- **Observable User Outcome**: When `/api/flashcards` finalization fails, the UI must transition to a visible error state displaying "Save failed", the error message, and both action options:
  - **Retry save** (`Button` invoking `saveAccepted` with loader spinner `isSaving`)
  - **Discard / Generate more** (`Button` invoking `onCancel ?? onReset`)
- **Key Anti-Pattern to Avoid**: Asserting the React state variable (`saveError`) in isolation without asserting rendered UI presence, accessibility roles, and retry interactivity in the browser.

### Architectural Anchors & Integration Points
- **UI Container**: [`src/components/FlashcardGenerator.tsx`](file:///home/awiacek/version-control/10xCards/src/components/FlashcardGenerator.tsx#L260-L326) handles review completion, save error banner, retry, and discard triggers.
- **Hook State**: [`src/components/hooks/useFlashcardGeneration.ts`](file:///home/awiacek/version-control/10xCards/src/components/hooks/useFlashcardGeneration.ts) manages generation lifecycle and reviews.
- **Finalize Endpoint**: [`src/pages/api/flashcards/index.ts`](file:///home/awiacek/version-control/10xCards/src/pages/api/flashcards/index.ts#L13-L50) receives `{ generation_id, cards }` and executes Supabase RPC `finalize_generation_review`.
- **Database RPC**: `finalize_generation_review` security-definer function in `supabase/migrations/` setting `finalized_at` timestamp.

### Playwright E2E Setup & Levers
- **Config**: [`playwright.config.ts`](file:///home/awiacek/version-control/10xCards/playwright.config.ts) defines `setup` project (`auth.setup.ts`) and authenticated `chromium` project using `playwright/.auth/user.json`.
- **Simulation Strategy**: Intercept POST `/api/flashcards` using `page.route()` to simulate network / 500 error on finalization, verifying UI transition and retry mechanics against the real client.
- **Quality Levers needed**:
  - Seed test: `tests/e2e/seed.spec.ts` (role-based locators `getByRole`, wait-for-state, isolated test state).
  - E2E rules: project rules in `AGENTS.md` covering Playwright conventions and anti-pattern avoidance.

### Execution Chain
1. `/10x-research` → investigate failure handling, Playwright test harness, and auth fixtures in `research.md`.
2. `/10x-plan` → author implementation contract in `plan.md` with explicit `## Progress` rows.
3. `/10x-e2e` → generate, review, and break-verify Playwright specs against the running app.
