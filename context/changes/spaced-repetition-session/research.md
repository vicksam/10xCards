---
date: 2026-09-03T00:08:00+02:00
researcher: Antigravity
git_commit: 6c80776
branch: master
repository: 10xCards
topic: "ts-fsrs compatibility with 10xCards codebase for S-02 spaced repetition session"
tags: [research, codebase, ts-fsrs, spaced-repetition, flashcards, supabase, schema]
status: complete
last_updated: 2026-09-03
last_updated_by: Antigravity
---

# Research: ts-fsrs Compatibility with 10xCards Codebase (S-02)

**Date**: 2026-09-03T00:08:00+02:00  
**Researcher**: Antigravity  
**Git Commit**: 6c80776  
**Branch**: master  
**Repository**: 10xCards

---

## Research Question

Is the `ts-fsrs` API reference at `context/changes/spaced-repetition-session/ts-fsrs-docs.md` compatible with the 10xCards codebase? What needs to happen to implement S-02 (spaced repetition study session from `context/foundation/roadmap.md`)?

---

## Summary

**`ts-fsrs` is fully compatible with the 10xCards stack.** Zero compatibility blockers exist — the library is pure TypeScript, ESM-native, zero runtime deps, and runs on Cloudflare Workers edge runtime. However, **nothing for S-02 is yet in place in the codebase**: `ts-fsrs` is not installed, no FSRS columns exist on the `flashcards` table, no `review_logs` table exists, no study page/route exists, and no TypeScript types cover SRS state. Everything must be built from scratch following well-established codebase patterns.

**Compatibility verdict: ✅ Compatible — net-new implementation required**

---

## Detailed Findings

### 1. Library Compatibility

| Compatibility Gate | Status | Evidence |
|---|---|---|
| TypeScript (first-class) | ✅ | `ts-fsrs` written in TS, ships `.d.ts` |
| ESM + CJS | ✅ | Both formats supported |
| Cloudflare Workers (edge runtime) | ✅ | Pure math — no Node I/O, no native bindings |
| Zero runtime dependencies | ✅ | `ts-fsrs` v5.4.1 has zero deps |
| Node.js dev environment ≥ 20 | ✅ | `.nvmrc` specifies Node.js 22.14.0 |
| Already installed | ❌ | Not in `package.json` — needs `npm install ts-fsrs` |

**Source:** `package.json:16-39`, `srs-library-research.md:28-56`

---

### 2. Database Schema — Gap Analysis

The F-01 baseline `flashcards` table has **7 columns only**. None of the 10 FSRS scheduling columns exist yet.

**Current `flashcards` columns** (`20260823150404_flashcard_schema.sql:8-16`):

| Column | Type | Status for S-02 |
|---|---|---|
| `id` | `uuid PK` | ✅ present |
| `user_id` | `uuid NOT NULL FK` | ✅ present |
| `front` | `text NOT NULL` (1–500 chars) | ✅ present |
| `back` | `text NOT NULL` (1–2000 chars) | ✅ present |
| `source` | `card_source enum` | ✅ present |
| `created_at` | `timestamptz` | ✅ present |
| `updated_at` | `timestamptz` | ✅ present (moddatetime trigger) |

**FSRS columns to ADD** (none exist — confirmed by exhaustive grep):

| Column | Postgres type | Default | ts-fsrs field |
|---|---|---|---|
| `due` | `timestamptz` | `now()` | `Card.due` |
| `stability` | `float8` | `0` | `Card.stability` |
| `difficulty` | `float8` | `0` | `Card.difficulty` |
| `elapsed_days` | `int4` | `0` | `Card.elapsed_days` |
| `scheduled_days` | `int4` | `0` | `Card.scheduled_days` |
| `learning_steps` | `int4` | `0` | `Card.learning_steps` |
| `reps` | `int4` | `0` | `Card.reps` |
| `lapses` | `int4` | `0` | `Card.lapses` |
| `state` | `int2` | `0` | `Card.state` (0=New…3=Relearning) |
| `last_review` | `timestamptz` | `null` | `Card.last_review` |

**Also needed — new `review_logs` table** (does not exist in any migration):

| Column | Postgres type | Notes |
|---|---|---|
| `id` | `uuid PK` | `gen_random_uuid()` |
| `flashcard_id` | `uuid FK` | `→ flashcards.id ON DELETE CASCADE` |
| `user_id` | `uuid FK` | `→ auth.users.id` |
| `rating` | `int2` | 1=Again, 2=Hard, 3=Good, 4=Easy |
| `state` | `int2` | State at review time |
| `scheduled_days` | `int4` | |
| `due` | `timestamptz` | Due date before this review |
| `review` | `timestamptz` | When this review happened |
| `stability` | `float8` | |
| `difficulty` | `float8` | |

RLS required on `review_logs` (same `auth.uid() = user_id` pattern from `flashcards`).

**Key decision from F-01**: The scheduling columns extend the `flashcards` table — they are NOT a separate table. Explicitly decided in `context/archive/2026-08-23-flashcard-schema/plan.md:40-47`: *"No scheduling columns — S-02 adds these when needed."* The ts-fsrs-docs schema matches this decision exactly.

---

### 3. TypeScript Types — Gap Analysis

**Current state** (`src/types.ts:1-16`):

```ts
export type Flashcard = Database["public"]["Tables"]["flashcards"]["Row"];
export type FlashcardInsert = ...
export type FlashcardUpdate = ...
export type CardSource = Database["public"]["Enums"]["card_source"];
```

Types are derived from the generated `src/types/database.ts`. After the S-02 migration is applied and `npx supabase gen types typescript --local > src/types/database.ts` is run, the `Flashcard` type will automatically gain all 10 FSRS fields. **No manual type surgery needed** — but the regeneration step is required.

**Additional types to declare manually in `src/types.ts`**:
- A `ReviewRequest` / `ReviewResponse` DTO for `POST /api/study/review`

**ts-fsrs types to import** (`ts-fsrs-docs.md:18-37`):
```ts
import { fsrs, createEmptyCard, TypeConvert, State, Rating, type Card, type RecordLogItem } from 'ts-fsrs'
```

---

### 4. API Route Integration Points

**Pattern is fully established** — S-02 needs 1-2 new API routes:

**`POST /api/study/review`** — Apply rating, persist updated card state + log entry:
- Follows the exact guard order from `src/pages/api/flashcards/index.ts`: auth → JSON → Zod → supabase null-check → DB → 200
- Input: `{ flashcard_id: uuid, rating: 1|2|3|4 }`
- Logic: `TypeConvert.card(dbRow)` → `scheduler.next(card, new Date(), rating)` → UPDATE flashcards + INSERT review_logs
- Output: `{ due: string, state: number, scheduled_days: number }`

**Due cards** — Fetch server-side in the Astro study page (SSR), not via a separate API route:
- Query: `SELECT * FROM flashcards WHERE user_id = auth.uid() AND due <= NOW() ORDER BY due ASC LIMIT 20`
- Same pattern as `stats.astro` (data-fetching Astro page that renders a React island)

**Supabase client pattern** (`src/lib/supabase.ts`):
```ts
const supabase = createClient(context.request.headers, context.cookies);
if (!supabase) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
```
`TypeConvert.card(dbRow)` from ts-fsrs accepts Supabase row shapes directly (ISO strings, numeric `state`) — **no adapter layer needed**.

---

### 5. UI Components — Gap Analysis

**Available in `src/components/ui/`**:
- `button.tsx` — `Button` with variants (default, outline, ghost, etc.) ✅ sufficient for rating buttons

**Not yet installed (will need)**:
- `npx shadcn@latest add card` — for the flashcard display surface
- `npx shadcn@latest add progress` — for session progress bar
- `npx shadcn@latest add badge` — for card state label (New / Learning / Review)

**Component architecture pattern** (from `FlashcardGenerator.tsx`):
- One Astro page (`src/pages/study.astro`) fetches due cards server-side, renders a React island with `client:load`
- One React component (`src/components/StudySession.tsx`) manages card-flip + rating state via hooks
- Hooks extracted to `src/components/hooks/` (hard rule: no `"use client"`, no hooks inline in `.tsx` files)
- `cn()` from `@/lib/utils` for all conditional Tailwind classes

**Study flow maps cleanly to ts-fsrs API** (`ts-fsrs-docs.md:184-199`):
```ts
// Preview intervals for button labels (before user rates)
const preview = scheduler.repeat(card, new Date())
// preview[Rating.Again].log.scheduled_days  →  show on "Again" button
// preview[Rating.Good].log.scheduled_days   →  show on "Good" button

// On button click: apply rating (server-side in API route)
const { card: updatedCard, log } = scheduler.next(card, new Date(), rating)
```

---

### 6. Middleware — Protected Route

`src/middleware.ts:4`:
```ts
const PROTECTED_ROUTES = ["/dashboard", "/generate", "/stats"];
```

`/study` is **not** in this list. It must be added when `src/pages/study.astro` is created. One-line change.

---

### 7. `createEmptyCard()` Integration Point

When a flashcard is first saved (via the `finalize_generation_review` RPC from S-01), the FSRS fields need correct initial values. Since DB-level defaults are defined (`due = now()`, all numerics = 0, `last_review = null`), new rows will auto-populate correct FSRS starting state — matching what `createEmptyCard()` would produce. **The existing RPC requires no changes.**

---

## Code References

| File | Description |
|---|---|
| `supabase/migrations/20260823150404_flashcard_schema.sql` | F-01 flashcards table (7 columns, RLS policies, moddatetime trigger) |
| `supabase/migrations/20260824000000_generation_reviews.sql` | S-01 generation_reviews table + `finalize_generation_review` RPC |
| `src/types.ts` | Flashcard, FlashcardInsert, FlashcardUpdate, CardSource re-exports |
| `src/types/database.ts` | Auto-generated Supabase types — must be regenerated after S-02 migration |
| `src/lib/supabase.ts` | `createClient()` factory — pattern for every API route and page |
| `src/middleware.ts:4` | PROTECTED_ROUTES — add `/study` here |
| `src/pages/api/flashcards/index.ts` | Reference API route (auth→JSON→Zod→supabase→DB guard pattern) |
| `src/components/FlashcardGenerator.tsx` | Reference React component architecture (discriminated state, hooks pattern) |
| `src/components/hooks/useCardReview.ts` | Reference hook: `isSaving`, `savedCount`, `saveError` state pattern |
| `src/components/ui/button.tsx` | Only installed shadcn component — sufficient for rating buttons |
| `context/changes/spaced-repetition-session/ts-fsrs-docs.md` | ts-fsrs API reference (all types, scheduler API, session flow) |
| `context/archive/2026-08-23-flashcard-schema/plan.md:40-47` | F-01 explicit decision: "no scheduling columns — S-02 adds these" |

---

## Architecture Insights

### ts-fsrs ↔ Supabase row mapping is seamless
`TypeConvert.card(dbRow)` accepts Supabase's native output format — ISO strings for `due`/`last_review`, numeric `state` — without any adapter. This is the critical integration point documented in `ts-fsrs-docs.md:202-227`.

### Server-side scheduler call recommended over client-side
Running `scheduler.next()` in the `POST /api/study/review` handler (server-side) rather than in the React component keeps scheduling logic off the client. This matches the existing pattern (all business logic in API routes/services, not in hooks) and prevents clock skew affecting `due` dates.

### DB-level defaults eliminate `createEmptyCard()` call on insert
Since F-01's `finalize_generation_review` RPC inserts only `(user_id, front, back, source)`, and the S-02 migration adds FSRS columns with DB-level defaults, new cards will automatically start as `state=0` (New), `due=now` — correct FSRS initial state — without touching the existing RPC.

### `afterHandler` pattern for date serialization
The `scheduler.next()` `afterHandler` in ts-fsrs docs converts `Date` objects to ISO strings inline (`ts-fsrs-docs.md:163-178`). In the API route, this means the Supabase `UPDATE` call can receive correctly-typed strings directly, avoiding manual `.toISOString()` calls on every field.

### Study queue is a simple SQL filter — no pagination complexity for MVP
`WHERE due <= NOW() ORDER BY due ASC LIMIT 20` surfaces all card states (New cards have `due = created_at ≈ now` and appear immediately). No special handling for new vs. due cards needed.

---

## Historical Context (from prior changes)

- `context/archive/2026-08-23-flashcard-schema/plan.md:40-47` — F-01 explicitly deferred SRS columns to S-02. The S-02 migration must use `ALTER TABLE flashcards ADD COLUMN` (not recreate the table).
- `context/archive/2026-09-02-ai-card-generation/plan.md:225-243` — S-01 established the canonical API route pattern (auth→JSON→Zod→supabase→DB). S-02 must follow this exactly.
- `context/archive/2026-09-02-ai-card-generation/reviews/impl-review.md` — F3 finding: no debug `console.log` in production routes; only `console.error` at genuine error boundaries. Apply to S-02 API routes.
- `context/foundation/lessons.md:12-17` — Use `npx supabase migration up` (not `db reset`) to apply the S-02 migration locally.

---

## Related Research

- `context/changes/spaced-repetition-session/srs-library-research.md` — Library selection rationale (ts-fsrs vs supermemo vs others)
- `context/changes/spaced-repetition-session/ts-fsrs-docs.md` — Full ts-fsrs API reference used as basis for this compatibility check

---

## S-02 Implementation Checklist

Everything required to implement S-02, in dependency order:

### Phase 1 — Schema
- [ ] `npm install ts-fsrs`
- [ ] Create `supabase/migrations/<timestamp>_srs_schema.sql`:
  - `ALTER TABLE flashcards ADD COLUMN ...` (10 FSRS columns with defaults)
  - `UPDATE flashcards SET due = created_at` (backfill existing cards so they surface immediately)
  - `CREATE TABLE review_logs (...)` with RLS (SELECT/INSERT scoped to `auth.uid() = user_id`)
- [ ] `npx supabase migration up` (per lessons.md — not `db reset`)
- [ ] `npx supabase gen types typescript --local > src/types/database.ts`
- [ ] Add `ReviewRequest`, `ReviewResponse` types to `src/types.ts`

### Phase 2 — API
- [ ] Create `src/pages/api/study/review.ts` (POST — apply rating, persist card + log)
  - Input: `{ flashcard_id: uuid, rating: 1|2|3|4 }`
  - Logic: fetch card row → `TypeConvert.card(dbRow)` → `scheduler.next(card, now, rating)` → UPDATE flashcards + INSERT review_logs
  - Output: `{ due: string, state: number, scheduled_days: number }`
- [ ] Add `/study` to `PROTECTED_ROUTES` in `src/middleware.ts:4`

### Phase 3 — UI
- [ ] `npx shadcn@latest add card progress badge` (install missing components)
- [ ] Create `src/components/hooks/useStudySession.ts` — manages queue, current card, flip state, rating submission, session-complete detection
- [ ] Create `src/components/StudySession.tsx` — card-flip UI, Again/Hard/Good/Easy buttons with interval previews from `scheduler.repeat()`, progress indicator
- [ ] Create `src/pages/study.astro` — SSR-fetch due cards via `supabase.from('flashcards').select('*').lte('due', now).order('due').limit(20)`, render `<StudySession client:load cards={dueCards} />`

### Phase 4 — Verification
- [ ] Install `ts-fsrs` locally and verify import in a test route
- [ ] Run migration locally with `npx supabase migration up`
- [ ] Confirm existing flashcards have `due = created_at` after backfill
- [ ] Confirm `finalize_generation_review` RPC creates new cards with correct FSRS defaults
- [ ] Manual smoke test: start session → flip card → rate → verify DB update in `flashcards` + new row in `review_logs`

---

## Open Questions

1. **`due` backfill for existing cards** — When the S-02 migration adds `due timestamptz DEFAULT now()`, existing cards get `due = migration timestamp`. Recommendation: add `UPDATE flashcards SET due = created_at WHERE due IS NULL` in the migration to surface existing cards immediately. Needs confirmation.

2. **Session size** — The ts-fsrs docs suggest `LIMIT 20`. Hardcode for MVP per Non-Goal #3 (no custom algorithm behaviour). No action needed.

3. **Empty deck UX** — What should the study page show when no cards are due? Options: (a) "No cards due" empty state + link to `/generate`, (b) redirect to `/dashboard`. UI decision needed before implementing `study.astro`.

4. **`finalize_generation_review` RPC — update needed?** — DB-level defaults should cover new card FSRS initialization. Needs to be confirmed during Phase 4 verification by checking a newly generated card's `due`, `state`, `reps` values.
