# UX Improvements — Plan Brief

> Full plan: `context/changes/ux-improvements/plan.md`

## What & Why

Implement S-04 UX improvements across the generation and study flows. This includes progressive generation timeouts, a hard-cancel for in-progress generations, and a full-page-reload restart for completed study sessions. These changes improve error handling, prevent hanging database records, and allow continuous studying.

## Starting Point

Currently, generation has a static 35s client timeout with generic error UI. The cancel action leaves unfinalized `generation_reviews` rows in the database. Completed study sessions force users back to the dashboard with no option to immediately study more cards.

## Desired End State

Users will experience escalating timeouts (30s, 45s, 60s) with clear error messaging if generation is slow. They can hard-cancel a generation cleanly, which removes any incomplete records from the database. After a study session, they can instantly restart to study newly-due cards without leaving the study flow.

## Key Decisions Made

| Decision                       | Choice            | Why (1 sentence)  | Source           |
| ------------------------------ | ----------------- | ----------------- | ---------------- |
| Cancel row cleanup             | Hard-delete       | Clean stats and explicit rejection of soft-delete or zero-card finalization. | Plan |
| Study session restart          | Full SSR reload   | Avoids needing FSRS logic or study queue adjustments on the client. | Plan |
| Timeout escalation             | 30s → 45s → 60s   | Balances early failure with longer allowances for manual retries. | Plan |

## Scope

**In scope:**
- Progressive timeouts (30s, 45s, 60s) and timeout UI updates
- Hard cancel UI and database endpoint for generation sessions
- "Study more cards" button for completed study sessions

**Out of scope:**
- Soft-deletes or "finalize with zero cards" logic
- FSRS logic or study queue adjustments on the client
- Progress-bar countdowns for the timeout

## Architecture / Approach

The implementation adds a new database policy and API route to allow hard-deletion of unfinalized `generation_reviews`. The client hook `useFlashcardGeneration` is refactored to support progressive timeouts and a manual retry flag. UI components are updated to include a "Cancel generation" button during loading/review and a "Study more cards" button on the study completion screen.

## Phases at a Glance

| Phase     | What it delivers       | Key risk                  |
| --------- | ---------------------- | ------------------------- |
| 1. Database & API Cancel Route | Endpoint to hard-delete unfinalized reviews | RLS issues preventing deletion |
| 2. Progressive Timeouts & Hook Refactor | Escalating timeouts and server timeout propagation | Abort signal not propagating properly |
| 3. Cancel UI | Cancel button and state cleanup during generation | Edge cases in state reset |
| 4. Study Session Reset | Restart button on study completion screen | Reloading without new cards ready |

**Prerequisites:** Existing generation and study flows are functional.
**Estimated effort:** ~1-2 sessions across 4 phases.

## Open Risks & Assumptions

- Assuming full SSR reload is fast enough to provide a seamless "Study more cards" experience.
- Assuming 65s server timeout is supported by the deployment platform (e.g. Cloudflare Workers).

## Success Criteria (Summary)

- Generation timeouts escalate correctly (30s, 45s, 60s) with clear UI.
- Canceling a generation successfully hard-deletes the unfinalized database row.
- Clicking "Study more cards" reloads the study session with new cards.
