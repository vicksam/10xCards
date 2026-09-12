---
date: 2026-09-12T13:20:00+02:00
researcher: Antigravity
git_commit: d02e9e64e69ef41ad1b0e1a1f9a9dce1c7675a84
branch: master
repository: 10xCards
topic: "E2E Critical Path Finalization (Phase 2 - R2)"
tags: [research, codebase, testing, e2e, playwright, useCardReview, FlashcardGenerator]
status: complete
last_updated: 2026-09-12
last_updated_by: Antigravity
---

# Research: E2E Critical Path Finalization (Phase 2 - R2)

**Date**: 2026-09-12T13:20:00+02:00
**Researcher**: Antigravity
**Git Commit**: d02e9e64e69ef41ad1b0e1a1f9a9dce1c7675a84
**Branch**: master
**Repository**: 10xCards

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` (Risk R2). Verify the finalization failure path, UI error handling, and Playwright setup to ensure an E2E test can accurately protect against silently dropped cards on RPC failure.

## Summary

The E2E finalization failure path is ready to be tested, but the Playwright infrastructure requires minor scaffolding before the E2E test can run. 
1. **Hook correction**: The test-plan cited `useFlashcardGeneration.ts`, but the actual review/save logic lives in `useCardReview.ts`. The `saveAccepted` function behaves correctly: it preserves the cards in state and simply sets `saveError` on failure, allowing a safe retry.
2. **UI Implementation**: `FlashcardGenerator.tsx` correctly renders the `saveError` along with the "Retry save" and "Discard" options. 
3. **Playwright harness gap**: `playwright.config.ts` exists but lacks a `webServer` block to boot the dev server. Additionally, `auth.setup.ts` is referenced but does not exist on disk, and there is no `tests/e2e/` folder. The implementation plan must first scaffold the auth fixture and webServer config.

## Detailed Findings

### Playwright Infrastructure & Test Runner
- **Finding**: `playwright.config.ts` specifies a `setup` project matching `/auth\.setup\.ts/` and a `chromium` project depending on it via `playwright/.auth/user.json`.
- **Finding**: Neither `auth.setup.ts` nor the `playwright/.auth` directory exist yet.
- **Finding**: There is no `webServer` block in `playwright.config.ts` to spin up the Astro/Cloudflare dev server automatically.
- **Implication**: The E2E execution will fail at startup. The implementation plan must include a step to write `tests/e2e/auth.setup.ts` and add the `webServer` config block before generating the R2 spec. `/10x-e2e` will handle the creation of `seed.spec.ts` automatically as per its own rules.

### React Hook State (`useCardReview.ts`)
- **Finding**: The finalization logic actually lives in `src/components/hooks/useCardReview.ts:101-144`. (The plan initially suspected `useFlashcardGeneration.ts`).
- **Behavior**: The `saveAccepted` function filters `cards` to those accepted, resets `saveError`, and posts to `/api/flashcards`. If it receives a 400/500, it safely updates `saveError` with the API error message without clearing the `cards` state.
- **Retry Mechanics**: Because `cards` state is preserved, clicking "Retry save" re-runs the exact same logic, safely reinvoking the API with the un-lost cards.

### UI Error Rendering (`FlashcardGenerator.tsx`)
- **Finding**: `src/components/FlashcardGenerator.tsx:295-326` displays the error state.
- **Behavior**: It renders the "Save failed" banner with the exact `saveError` string and mounts two explicit action buttons: "Retry save" (triggering `saveAccepted`) and "Discard / Generate more".

### API Endpoint (`/api/flashcards/index.ts`)
- **Behavior**: Returns 400, 401, 500, or 503 depending on schema validation, auth state, or RPC failure (`finalize_generation_review`). 

## Code References

- `playwright.config.ts:4-11` - Playwright projects configuration specifying the missing `auth.setup.ts`.
- `src/components/hooks/useCardReview.ts:101-144` - `saveAccepted` implementation handling network failures and HTTP errors.
- `src/components/FlashcardGenerator.tsx:295-326` - UI error banner and interactive retry/discard buttons.

## Architecture Insights

The architecture cleanly decouples the AI generation phase from the review phase into two distinct hooks (`useFlashcardGeneration` and `useCardReview`). The review hook follows a robust error-recovery pattern where the source of truth (the cards) is untouched during network synchronization, ensuring data is never silently dropped on RPC failure.

## Open Questions

None. The path is fully clear for `/10x-plan`.
