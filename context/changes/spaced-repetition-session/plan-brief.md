# Spaced Repetition Study Session — Plan Brief

> Full plan: `context/changes/spaced-repetition-session/plan.md`
> Research: `context/changes/spaced-repetition-session/research.md`

## What & Why

Implement S-02: add a spaced repetition study session to 10xCards using the `ts-fsrs` FSRS v6 algorithm. Users need a way to study their saved flashcards on an optimised schedule — cards recalled easily return later, cards recalled with difficulty return sooner — directly serving the PRD's "Regular Review Habit" success criterion and the "Study Session Reliability" guardrail KPI.

## Starting Point

F-01 and S-01 are complete: the `flashcards` table exists with RLS, AI card generation works, and the Astro/React/Supabase patterns are well-established. There is no SRS scheduling state anywhere in the codebase — `ts-fsrs` is not installed, no FSRS columns exist on `flashcards`, no `review_logs` table exists, and there is no study page.

## Desired End State

A signed-in user navigates to `/study`, sees their due flashcards (up to 20), flips each card to reveal the answer, clicks Again / Hard / Good / Easy to rate their recall, and the next review date is scheduled automatically. After all due cards are rated the session completes. If no cards are due, a friendly empty state links back to the dashboard.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| SR algorithm | FSRS v6 via `ts-fsrs` | 114k weekly DLs, pure TS/ESM, zero deps, Cloudflare Workers compatible, 81% better recall accuracy than SM-2 | Research |
| Scheduler placement | Server-side in API route | Prevents clock skew on `due` dates and matches the project's pattern of keeping business logic off the client | Research |
| Schema approach | `ALTER TABLE flashcards ADD COLUMN` (10 cols) | F-01 explicitly deferred SRS columns to S-02; single-table approach avoids a JOIN on every study queue query | Research |
| `due` backfill | `UPDATE flashcards SET due = created_at` | Existing cards surface in the study queue immediately after migration without any special-case handling | Plan |
| Empty deck UX | "No cards due" empty state with link to `/dashboard` | Keeps the user in context; a silent redirect to dashboard would obscure why they ended up there | Plan |
| Session size | Hardcoded `LIMIT 20` | MVP scope; configurable session size is a Non-Goal (#3: no custom algorithm behaviour) | Plan |
| `finalize_generation_review` RPC | No changes needed | DB-level FSRS column defaults (`due=now()`, numerics=0) produce correct FSRS initial state for new cards automatically | Research |
| Type regeneration | `npx supabase gen types typescript --local` | `Flashcard` type derives from generated `database.ts`; regeneration after migration gives all 10 FSRS fields for free | Research |

## Scope

**In scope:**
- `ts-fsrs` installation
- S-02 database migration (10 FSRS columns on `flashcards`, `review_logs` table with RLS, `due` backfill)
- `POST /api/study/review` API route
- `/study` added to `PROTECTED_ROUTES`
- `useStudySession` hook + `StudySession.tsx` component + `study.astro` page
- "Study" link in `Topbar.astro`
- shadcn `card`, `progress`, `badge` component installation

**Out of scope:**
- Custom FSRS parameters (default config only)
- Deck filtering, tags, sub-decks
- Session history / statistics page
- Changes to `finalize_generation_review` RPC
- Manual card creation (S-03)
- `GET /api/study/queue` endpoint (SSR fetch at page render instead)

## Architecture / Approach

The Astro study page (`study.astro`) fetches due cards server-side at render time using the Supabase SSR client and passes them as props to the `StudySession` React island (`client:load`). All FSRS scheduling runs server-side in `POST /api/study/review` (`TypeConvert.card()` → `scheduler.next()` → UPDATE `flashcards` + INSERT `review_logs`). The React component manages local UI state (flip, queue position, loading) through the `useStudySession` hook and calls the API on each rating. This keeps scheduling logic off the client and the initial page load fast via SSR.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema & Types | ts-fsrs installed, migration applied, types regenerated, DTOs added | Migration backfill could be slow on large datasets (acceptable at MVP scale) |
| 2. API Layer | `POST /api/study/review` route, `/study` protected | Type error if `database.ts` not regenerated before Phase 2 starts |
| 3. Study UI | Full study session UI: card flip, rating buttons, progress, empty/complete states, nav link | shadcn component installation may require manual style tweaks for Tailwind v4 |
| 4. Verification | End-to-end smoke test; containers stopped | — |

**Prerequisites:** Local Supabase running (`npx supabase start`), `.env` with `SUPABASE_URL` + `SUPABASE_KEY`, Node.js 22.14.0 (per `.nvmrc`)
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- `ts-fsrs` v5.4.1 targets FSRS v6 — any breaking API change in a patch release could affect the `afterHandler` overload. Pin the exact version if stability is a concern.
- shadcn `card`, `progress`, `badge` components may need minor Tailwind v4 style adjustments (the project uses Tailwind CSS v4, which shadcn was designed for but may have subtle class differences).
- `supabase gen types` requires a running local Supabase instance — Phase 2 is blocked until Phase 1 verification is complete.

## Success Criteria (Summary)

- A logged-in user can rate all due flashcards in a study session and each rating is persisted to `flashcards` + `review_logs`
- Cards rated "Easy" reappear later than cards rated "Again" (verified by comparing `due` values after rating)
- Navigating to `/study` while signed out redirects to `/auth/signin`
