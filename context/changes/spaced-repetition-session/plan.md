# Spaced Repetition Study Session Implementation Plan

## Overview

Implement S-02: integrate `ts-fsrs` (FSRS v6 algorithm) into 10xCards so a logged-in user can start a spaced repetition study session. Cards recalled easily appear later; cards recalled with difficulty appear sooner. The feature spans four phases: database schema extension, an API review endpoint, the study UI, and local verification.

## Current State Analysis

The F-01 baseline `flashcards` table has 7 content columns (`id`, `user_id`, `front`, `back`, `source`, `created_at`, `updated_at`) and full RLS. S-01 added a `generation_reviews` table and the `finalize_generation_review` RPC. There is no SRS state, no `review_logs` table, no study page, no `/study` protected route, and `ts-fsrs` is not installed.

## Desired End State

When this plan is complete a signed-in user can:
1. Navigate to `/study` and see their due flashcards (up to 20, ordered by `due ASC`).
2. View each card's front, flip to see the back, and click one of four rating buttons (Again / Hard / Good / Easy) that show how many days until the next review.
3. After rating, the card's FSRS state is persisted to `flashcards` and a row is appended to `review_logs`.
4. When all due cards have been rated the session ends with a completion screen that links back to the dashboard.
5. If there are no due cards, a friendly empty state with a link to `/dashboard` is shown.

### Key Discoveries

- `flashcards` has zero FSRS columns — entire schema extension is net-new (`supabase/migrations/20260823150404_flashcard_schema.sql:8-16`).
- No `review_logs` table exists in any migration file.
- `ts-fsrs` is not in `package.json`; must be installed before anything else.
- `TypeConvert.card(dbRow)` accepts Supabase row shapes directly (ISO strings, numeric `state`) — no adapter layer needed (`ts-fsrs-docs.md:202-227`).
- The scheduler should run server-side in the API route (not in the React hook) to prevent clock skew affecting `due` dates and to match the project's existing pattern of keeping all business logic in API routes/services.
- DB-level defaults on the new FSRS columns (`due = now()`, numerics = 0, `last_review = null`) produce correct FSRS initial state for new cards without any changes to the existing `finalize_generation_review` RPC.
- Existing cards will get `due = migration timestamp` unless explicitly backfilled — migration must set `due = created_at` for all existing rows.
- Topbar already has a nav link pattern (`src/components/Topbar.astro:13-15`) — add "Study" link next to "Dashboard".
- `PROTECTED_ROUTES` is at `src/middleware.ts:4` — one-line addition for `/study`.
- API route guard order is canonical: auth → JSON parse → Zod → supabase null-check → DB (`src/pages/api/flashcards/index.ts:18-54`).
- Only `Button` shadcn component is installed; `card`, `progress`, and `badge` must be added.

## What We're NOT Doing

- No custom FSRS parameter tuning — `fsrs()` with default config only (PRD Non-Goal #3).
- No deck-level filtering, tags, or sub-decks — single flat queue per user.
- No session history or statistics page — that is a future milestone.
- No offline support (PRD Non-Goal #5).
- No changes to the `finalize_generation_review` RPC — DB defaults handle FSRS initialization.
- No `GET /api/study/queue` endpoint — due cards are fetched server-side in the Astro page at render time.
- No manual card creation (S-03).
- No changes to existing `flashcards` RLS policies — the existing UPDATE policy already covers the FSRS field writes.

## Implementation Approach

**Schema first, then API, then UI.** Each phase has clear success criteria before the next starts. The FSRS library call lives entirely on the server (`POST /api/study/review`) — the React component receives preview intervals as props passed through the hook, rates a card by calling the API, and updates local state from the response. This keeps scheduling off the client and prevents clock skew.

## Critical Implementation Details

**Migration backfill ordering**: The backfill `UPDATE flashcards SET due = created_at` must run *before* adding a `NOT NULL` constraint (if any). The column is defined `timestamptz` with `DEFAULT now()` and no NOT NULL, so ordering is not critical here — but the UPDATE must run in the same migration as the ADD COLUMN, not a later one.

**`scheduler.repeat()` for button labels vs `scheduler.next()` for applying**: `repeat()` returns all four outcomes without mutating state and is safe to call client-side (it is pure math). However, to keep the architecture clean, the plan calls `repeat()` server-side inside the review API and returns the four `scheduled_days` values alongside the applied result. The React component displays these from the API response on the *next* card. For the current card's button labels (before the user rates), the Astro page SSR-fetches the due cards and passes pre-computed interval previews as props.

**`afterHandler` eliminates manual `.toISOString()` calls**: Use the `afterHandler` overload of `scheduler.next()` (ts-fsrs-docs.md:163-178) to get ISO strings directly from the scheduler rather than calling `.toISOString()` on every Date field in the UPDATE payload.

**Type regeneration is a hard prerequisite for Phase 2**: `src/types.ts` derives `Flashcard` from the generated `database.ts`. The new FSRS columns won't appear in TypeScript until `npx supabase gen types typescript --local > src/types/database.ts` is run after migration. Phase 2 cannot start until this is done.

---

## Phase 1: Schema & Types

### Overview

Install `ts-fsrs`, apply the S-02 database migration (10 FSRS columns on `flashcards` + `review_logs` table with RLS), backfill existing card `due` dates, and regenerate TypeScript types. Add study-specific DTO types to `src/types.ts`.

### Changes Required

#### 1. Install `ts-fsrs`

**File**: `package.json` (via npm)

**Intent**: Add `ts-fsrs` as a runtime dependency so it is available in both the Cloudflare Workers edge runtime and the local dev server.

**Contract**: Run `npm install ts-fsrs`. The package appears in `dependencies` (not `devDependencies`) because it is called at request time in API routes.

#### 2. S-02 database migration

**File**: `supabase/migrations/20260903000000_srs_schema.sql`

**Intent**: Extend `flashcards` with all 10 FSRS scheduling columns and create the `review_logs` table. Backfill `due = created_at` so existing cards surface in the study queue immediately. Enable RLS on `review_logs` with SELECT and INSERT policies scoped to `auth.uid() = user_id`.

**Contract**: The migration is structured as:

```sql
-- 1. Add FSRS scheduling columns to flashcards
ALTER TABLE flashcards
  ADD COLUMN due            timestamptz DEFAULT now(),
  ADD COLUMN stability      float8      DEFAULT 0,
  ADD COLUMN difficulty     float8      DEFAULT 0,
  ADD COLUMN elapsed_days   int4        DEFAULT 0,
  ADD COLUMN scheduled_days int4        DEFAULT 0,
  ADD COLUMN learning_steps int4        DEFAULT 0,
  ADD COLUMN reps           int4        DEFAULT 0,
  ADD COLUMN lapses         int4        DEFAULT 0,
  ADD COLUMN state          int2        DEFAULT 0,
  ADD COLUMN last_review    timestamptz DEFAULT null;

-- 2. Backfill due for existing cards so they surface immediately
UPDATE flashcards SET due = created_at;

-- 3. Create review_logs table
CREATE TABLE review_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id   uuid        NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id),
  rating         int2        NOT NULL,
  state          int2        NOT NULL,
  scheduled_days int4        NOT NULL,
  due            timestamptz NOT NULL,
  review         timestamptz NOT NULL,
  stability      float8      NOT NULL,
  difficulty     float8      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 4. RLS on review_logs
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own review logs"
  ON review_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review logs"
  ON review_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

No UPDATE or DELETE policy on `review_logs` — review history is append-only.

#### 3. Apply migration locally

**Intent**: Bring the local Supabase instance in sync with the new migration. Per `context/foundation/lessons.md:12-17`, use `migration up` not `db reset`.

**Contract**: Run `npx supabase migration up`.

#### 4. Regenerate TypeScript types

**Intent**: Refresh `src/types/database.ts` so the `Flashcard` type gains the 10 FSRS fields and the `review_logs` table type is available.

**Contract**: Run `npx supabase gen types typescript --local > src/types/database.ts`. The `Flashcard` type (derived in `src/types.ts:3`) will automatically gain all new columns after regeneration.

#### 5. Add study DTOs to `src/types.ts`

**File**: `src/types.ts`

**Intent**: Add the request/response types for the `POST /api/study/review` endpoint and a re-export of `ReviewLog` from the generated database types.

**Contract**: Append to `src/types.ts` below the existing AI generation DTOs:

```typescript
export type ReviewLog = Database["public"]["Tables"]["review_logs"]["Row"];
export type ReviewLogInsert = Database["public"]["Tables"]["review_logs"]["Insert"];

// Study session DTOs
export interface ReviewRequest {
  flashcard_id: string;       // uuid — card being rated
  rating: 1 | 2 | 3 | 4;     // Again | Hard | Good | Easy
  next_flashcard_id?: string; // uuid — next card in queue (omit if last card)
}

export interface ReviewResponse {
  due: string;            // ISO timestamp — next review date
  state: number;          // 0-3 FSRS State enum
  scheduled_days: number; // days until next review (applied result)
  next_intervals: {       // preview intervals for the *next* card's buttons
    again: number;        // days if rated Again
    hard: number;         // days if rated Hard
    good: number;         // days if rated Good
    easy: number;         // days if rated Easy
  } | null;               // null when queue is exhausted (no next card)
}
```

### Success Criteria

#### Automated Verification

- `npx supabase migration up` exits with code 0 and no errors
- `npx supabase gen types typescript --local > src/types/database.ts` completes without error
- `npm run lint` passes with no new errors
- `npm run build` succeeds (requires `SUPABASE_URL` + `SUPABASE_KEY` in `.env`)

#### Manual Verification

- Supabase Studio (http://localhost:54323) shows `flashcards` has 17 columns including all 10 FSRS fields
- Supabase Studio shows `review_logs` table with correct columns and RLS enabled
- Existing flashcard rows have `due` populated with their `created_at` value (not the migration timestamp)
- New flashcard rows (via `finalize_generation_review` RPC) have FSRS columns set to defaults: `state=0`, `reps=0`, `lapses=0`, `due≈now`, numerics=0

**Pause after Phase 1 manual verification before proceeding to Phase 2.**

---

## Phase 2: API Layer

### Overview

Add the `POST /api/study/review` route that fetches the card, runs `TypeConvert.card()` + `scheduler.next()` server-side, persists the updated FSRS state to `flashcards`, appends a row to `review_logs`, and returns the next due date. Add `/study` to `PROTECTED_ROUTES`.

### Changes Required

#### 1. Add `/study` to `PROTECTED_ROUTES`

**File**: `src/middleware.ts`

**Intent**: Redirect unauthenticated users away from the study page to the sign-in page.

**Contract**: Add `"/study"` to the `PROTECTED_ROUTES` array at line 4. The array becomes `["/dashboard", "/generate", "/stats", "/study"]`.

#### 2. Create `src/pages/api/study/review.ts`

**File**: `src/pages/api/study/review.ts` (new file)

**Intent**: Server-side endpoint that applies a user's rating to a flashcard using the FSRS scheduler and persists the result. Follows the canonical guard order established in `src/pages/api/flashcards/index.ts`.

**Contract**:

- `export const prerender = false`
- `export const POST: APIRoute`
- Guard order: auth → JSON parse → Zod → supabase null-check → fetch card → FSRS → DB writes → 200
- Zod schema: `z.object({ flashcard_id: z.uuid(), rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), next_flashcard_id: z.uuid().optional() })`
- Supabase null-check: `const supabase = createClient(context.request.headers, context.cookies); if (!supabase) return Response.json({ error: "Supabase is not configured" }, { status: 503 })` — mirrors the guard in `src/pages/api/flashcards/index.ts:42-44`
- Fetch the card row: `supabase.from('flashcards').select('*').eq('id', flashcard_id).eq('user_id', user.id).single()` — the `eq('user_id', ...)` guard prevents rating another user's card even if RLS is misconfigured
- If card not found: return 404 `{ error: "Card not found" }`
- Deserialize: `TypeConvert.card(cardRow)` from `ts-fsrs`
- Apply rating with afterHandler to get ISO strings:

```typescript
const scheduler = fsrs()
const now = new Date()
const { card: updatedCard, log } = scheduler.next(
  card,
  now,
  rating as Rating,
  ({ card, log }) => ({
    card: {
      ...card,
      due: card.due.toISOString(),
      last_review: card.last_review?.toISOString() ?? null,
    },
    log: {
      ...log,
      due: log.due.toISOString(),
      review: log.review.toISOString(),
    },
  })
)
```

- Persist card update: `const { error: updateError } = await supabase.from('flashcards').update({ due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review }).eq('id', flashcard_id)`. If `updateError`: return 500.
- Persist review log: `const { error: insertError } = await supabase.from('review_logs').insert({ flashcard_id, user_id: user.id, rating: log.rating, state: log.state, scheduled_days: log.scheduled_days, due: log.due, review: log.review, stability: log.stability, difficulty: log.difficulty })`. If `insertError`: log `console.error('review_logs insert failed after card update', insertError)` and return 500 (the card state is already updated — the inconsistency is acceptable at MVP scale; see Migration Notes).
- After successful DB writes, optionally compute preview intervals for the next card. The caller passes the `next_card` row in the request body as an optional field (`next_flashcard_id?: string`). If provided, fetch it, run `scheduler.repeat(TypeConvert.card(nextRow), now)` and include the four `scheduled_days` values in the response. If not provided (last card in session), return `next_intervals: null`.
- On success: return 200 `{ due: updatedCard.due, state: updatedCard.state, scheduled_days: updatedCard.scheduled_days, next_intervals }` — shape matches `ReviewResponse`
- Use `console.error` only at genuine error boundaries; no debug `console.log` (per S-01 impl-review F3)

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` succeeds
- TypeScript type-checks pass (no `any` casts; `Rating` enum import from `ts-fsrs` resolves correctly)

#### Manual Verification

- `curl -X POST http://localhost:4321/api/study/review` with a valid session cookie, `flashcard_id` of a due card, and `rating: 3` returns 200 with `{ due, state, scheduled_days }`
- The `flashcards` row's `reps` increments by 1, `state` updates, and `due` moves forward
- A new row appears in `review_logs` with the correct `rating`, `review` timestamp, `user_id`, and `flashcard_id`
- Calling with no auth cookie returns 401
- Calling with an invalid `rating` (e.g. 5) returns 400
- Calling with another user's `flashcard_id` returns 404 (not 403 — the card "doesn't exist" from the requester's perspective)

**Pause after Phase 2 manual verification before proceeding to Phase 3.**

---

## Phase 3: Study UI

### Overview

Install missing shadcn/ui components, build the `useStudySession` hook, the `StudySession` React component, and the `study.astro` Astro page. Add a "Study" link to the Topbar. The Astro page fetches due cards server-side at render time so the React island receives them as props.

### Changes Required

#### 1. Install missing shadcn/ui components

**Intent**: Add `Card`, `Progress`, and `Badge` components for the flashcard surface, session progress bar, and state label.

**Contract**: Run `npx shadcn@latest add card progress badge`. Components land in `src/components/ui/` following the project's "new-york" style convention.

#### 2. Create `src/components/hooks/useStudySession.ts`

**File**: `src/components/hooks/useStudySession.ts` (new file)

**Intent**: Encapsulate all study session state and the API call to `POST /api/study/review`. No `"use client"` directive — hooks live in `src/components/hooks/` per AGENTS.md.

**Contract**: The hook signature:

```typescript
export function useStudySession(initialCards: Flashcard[])
```

State managed: `cards` (queue remaining), `currentCard`, `currentIntervals` (`{ again, hard, good, easy }` — interval days for the current card's buttons, sourced from the API's `next_intervals` on the previous rating; for the first card, computed via `scheduler.repeat()` from the initial card's FSRS state in the hook initializer), `isFlipped` (boolean for card flip), `isSubmitting` (rating in-flight), `submitError`, `sessionDone` (boolean).

Exposes:
- `currentCard: Flashcard | undefined`
- `currentIntervals: { again: number; hard: number; good: number; easy: number } | null` — interval previews for the current card's rating buttons
- `isFlipped: boolean`
- `isSubmitting: boolean`
- `submitError: string | null`
- `sessionDone: boolean`
- `totalCount: number` — initial queue length
- `remainingCount: number` — cards not yet rated
- `flip(): void` — toggle `isFlipped`
- `rate(rating: 1 | 2 | 3 | 4): Promise<void>` — calls `POST /api/study/review` with `{ flashcard_id, rating, next_flashcard_id: cards[1]?.id }` (the second card in queue is the next), advances to next card on success, updates `currentIntervals` from the API's `next_intervals`, sets `submitError` on failure. Follow `useCardReview.ts:101-143` for the fetch/error/finally pattern.

After a successful rate: remove the rated card from the front of the queue, reset `isFlipped` to `false`. If queue is now empty, set `sessionDone = true`.

#### 3. Create `src/components/StudySession.tsx`

**File**: `src/components/StudySession.tsx` (new file)

**Intent**: React component that renders the full study session UI. No `"use client"` directive. Uses `useStudySession` hook for all state. Uses `cn()` from `@/lib/utils` for conditional classes.

**Contract**: Props: `{ cards: Flashcard[] }`.

Renders three distinct views based on state:
1. **Empty state** (no cards passed — `cards.length === 0`): message "You have no cards due for review" + `Button` linking to `/dashboard`.
2. **Session complete** (`sessionDone === true`): congratulatory message + `Button` linking to `/dashboard`.
3. **Active session**: card display + rating buttons.

Active session layout:
- `Progress` bar: `value={(totalCount - remainingCount) / totalCount * 100}`, label showing `N of M reviewed`
- Card surface using `Card` component: shows `currentCard.front` always; shows `currentCard.back` only when `isFlipped === true`
- "Show answer" `Button` (variant `outline`) — visible when `!isFlipped`, calls `flip()`
- Four rating `Button`s — visible when `isFlipped`, disabled when `isSubmitting`, each calls `rate(1|2|3|4)`. Labels show the rating name and the corresponding interval from `currentIntervals`: e.g. `Again (${currentIntervals?.again ?? '—'}d)`, `Hard (${currentIntervals?.hard ?? '—'}d)`, `Good (${currentIntervals?.good ?? '—'}d)`, `Easy (${currentIntervals?.easy ?? '—'}d)`. Use `'—'` as the fallback when `currentIntervals` is null (first card before any API response).
- `Badge` showing current card state label: `{ 0: "New", 1: "Learning", 2: "Review", 3: "Relearning" }[currentCard.state]`
- Error display if `submitError` is set

#### 4. Create `src/pages/study.astro`

**File**: `src/pages/study.astro` (new file)

**Intent**: Server-rendered study page. Fetches due cards for the current user at render time and passes them as props to the `StudySession` React island. Protected by middleware (covered in Phase 2).

**Contract**:

```astro
---
import Layout from "@/layouts/Layout.astro";
import StudySession from "@/components/StudySession";
import { createClient } from "@/lib/supabase";

const supabase = createClient(Astro.request.headers, Astro.cookies);

let dueCards = [];
if (supabase) {  // Astro.locals.user is guaranteed non-null by middleware (PROTECTED_ROUTES)
  const { data } = await supabase
    .from("flashcards")
    .select("*")
    .lte("due", new Date().toISOString())
    .order("due", { ascending: true })
    .limit(20);
  dueCards = data ?? [];
}
---

<Layout title="Study">
  <main ...>
    <StudySession cards={dueCards} client:load />
  </main>
</Layout>
```

If `supabase` is null (misconfiguration), `dueCards` stays `[]` — the empty state component handles it gracefully.

#### 5. Add "Study" link to `src/components/Topbar.astro`

**File**: `src/components/Topbar.astro`

**Intent**: Give signed-in users a navigation shortcut to the study session from any page.

**Contract**: Add an `<a href="/study">` link styled identically to the existing Dashboard link (lines 13-15), positioned between Dashboard and Sign out. The text is `"Study"`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` succeeds
- TypeScript type-checks pass (no implicit `any`)

#### Manual Verification

- Navigating to `/study` while signed out redirects to `/auth/signin`
- Navigating to `/study` while signed in with due cards shows the session UI with a progress bar and the first card's front
- Clicking "Show answer" reveals the card back
- Clicking "Good" (rating 3): the next card appears, progress bar advances, `isFlipped` resets to false
- Clicking "Again" (rating 1) on a learning card: card's `due` is updated to a short interval (minutes), next card appears
- After rating all cards in the queue, the completion screen appears with a link back to the dashboard
- Signing in with a fresh account (no cards) navigating to `/study` shows the empty state with a dashboard link
- Topbar shows "Study" link for signed-in users; link is absent for signed-out users (the topbar already guards on `user`)

**Pause after Phase 3 manual verification before proceeding to Phase 4.**

---

## Phase 4: Verification

### Overview

End-to-end smoke test of the full S-02 flow on the local Cloudflare workerd runtime. Confirm schema correctness, FSRS defaults on new cards, and the complete study session cycle. Stop containers when done (per `context/foundation/lessons.md:5-9`).

### Changes Required

No code changes in this phase — it is pure verification.

### Success Criteria

#### Automated Verification

- `npm run lint` passes on the full repo (no regressions)
- `npm run build` succeeds (with `SUPABASE_URL` + `SUPABASE_KEY` in `.env`)

#### Manual Verification

- Full session smoke test on `npm run dev`:
  1. Sign in → navigate to `/study` → cards due → flip a card → click "Good" → row updated in `flashcards` (check Supabase Studio) + new row in `review_logs`
  2. Generate new AI cards via `/dashboard` → navigate to `/study` → new cards appear with `state=0` (New) and `due ≤ now`
  3. Rate all 20 (or fewer) cards → completion screen appears
  4. Immediately re-visit `/study` → the just-rated cards no longer appear (their `due` is now in the future) → empty state shown

- Existing card backfill confirmed: pick an existing flashcard in Supabase Studio → confirm `due = created_at` (not the migration timestamp)
- `finalize_generation_review` RPC produces correct FSRS defaults: generate cards → save → check a new row in `flashcards` → `state = 0`, `reps = 0`, `lapses = 0`, `due ≈ now`
- Stop local Supabase after testing: `npx supabase stop`

---

## Testing Strategy

### Unit Tests

No unit test harness is currently installed in the project. If one is added in the future, priority test targets are:

- `useStudySession` hook: queue advancement, `isFlipped` reset, `sessionDone` transition, error propagation from API
- `POST /api/study/review`: happy path, 401 on no auth, 404 on wrong user's card, 400 on invalid rating, 500 on DB error

### Integration Tests

Manual end-to-end test in Phase 4 serves as the integration test for MVP.

### Manual Testing Steps

1. Sign in with a test account that has existing flashcards → navigate to `/study` → session loads
2. Flip a card → rate it "Again" → confirm next card appears and `due` of rated card is very soon (minutes)
3. Rate all cards → completion screen → navigate away → return to `/study` → empty state
4. Open Supabase Studio → verify `review_logs` has one row per rating action with correct `user_id`, `flashcard_id`, `rating`, and `review` timestamp

## Performance Considerations

- Study queue is `LIMIT 20` — no pagination, constant DB load per session request.
- `scheduler.next()` and `TypeConvert.card()` are pure CPU operations (microseconds) — no performance concern on Cloudflare Workers.
- Due cards are fetched at SSR render time; no client-side data fetching for the initial load.

## Migration Notes

The S-02 migration (`20260903000000_srs_schema.sql`) is additive:
- `ALTER TABLE flashcards ADD COLUMN` — safe on any Postgres version, non-blocking with default values.
- `UPDATE flashcards SET due = created_at` — updates all existing rows; on a production DB with many rows this could be slow. For MVP scale this is acceptable.
- `CREATE TABLE review_logs` — net new, no conflict risk.
- Rollback strategy (if needed): `ALTER TABLE flashcards DROP COLUMN due, DROP COLUMN stability, ...` and `DROP TABLE review_logs`. No existing application code depends on these columns prior to this plan.
- **Known gap — non-atomic review write**: `POST /api/study/review` updates `flashcards` and inserts into `review_logs` sequentially (no transaction). If the INSERT fails after a successful UPDATE, the card's FSRS state advances but no log is recorded. At MVP scale this window is negligible. If data integrity becomes a concern post-launch, wrap both writes in a `record_review` Postgres RPC.

## References

- Research: `context/changes/spaced-repetition-session/research.md`
- ts-fsrs API reference: `context/changes/spaced-repetition-session/ts-fsrs-docs.md`
- Library selection rationale: `context/changes/spaced-repetition-session/srs-library-research.md`
- Reference API route: `src/pages/api/flashcards/index.ts`
- Reference hook: `src/components/hooks/useCardReview.ts`
- F-01 migration: `supabase/migrations/20260823150404_flashcard_schema.sql`
- Lessons: `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema & Types

#### Automated

- [x] 1.1 `npx supabase migration up` exits 0 with no errors — a477fc1
- [x] 1.2 `npx supabase gen types typescript --local` completes without error — a477fc1
- [x] 1.3 `npm run lint` passes with no new errors — a477fc1
- [x] 1.4 `npm run build` succeeds — a477fc1

#### Manual

- [x] 1.5 Supabase Studio shows `flashcards` with 17 columns including all 10 FSRS fields — a477fc1
- [x] 1.6 Supabase Studio shows `review_logs` table with RLS enabled — a477fc1
- [x] 1.7 Existing flashcard rows have `due = created_at` — a477fc1
- [x] 1.8 New flashcard rows (via RPC) have correct FSRS defaults (`state=0`, `reps=0`, `due≈now`) — a477fc1

### Phase 2: API Layer

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` succeeds
- [x] 2.3 TypeScript type-checks pass (no `any` casts)

#### Manual

- [x] 2.4 Valid POST to `/api/study/review` returns 200 with `{ due, state, scheduled_days }`
- [x] 2.5 `flashcards` row updates correctly after rating
- [x] 2.6 New row appears in `review_logs` with correct fields
- [x] 2.7 No auth cookie → 401
- [x] 2.8 Invalid rating (e.g. 5) → 400
- [x] 2.9 Other user's `flashcard_id` → 404

### Phase 3: Study UI

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` succeeds
- [ ] 3.3 TypeScript type-checks pass

#### Manual

- [ ] 3.4 `/study` while signed out redirects to `/auth/signin`
- [ ] 3.5 `/study` with due cards shows progress bar and first card front
- [ ] 3.6 "Show answer" reveals card back
- [ ] 3.7 Rating a card advances to the next, resets flip state
- [ ] 3.8 Rating all cards shows completion screen with dashboard link
- [ ] 3.9 No due cards → empty state with dashboard link
- [ ] 3.10 Topbar shows "Study" link for signed-in users

### Phase 4: Verification

#### Automated

- [ ] 4.1 `npm run lint` passes (full repo, no regressions)
- [ ] 4.2 `npm run build` succeeds

#### Manual

- [ ] 4.3 Full session smoke test: flip → rate → DB updated → review_logs row created
- [ ] 4.4 New AI-generated cards appear in study queue with `state=0` and `due ≤ now`
- [ ] 4.5 After rating all cards, re-visiting `/study` shows empty state
- [ ] 4.6 Existing card backfill confirmed: `due = created_at`
- [ ] 4.7 `finalize_generation_review` RPC produces correct FSRS defaults on new rows
- [ ] 4.8 Local Supabase stopped after testing (`npx supabase stop`)
