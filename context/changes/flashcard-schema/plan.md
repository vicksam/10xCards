# Flashcard Schema Implementation Plan

## Overview

Set up the Supabase migration pipeline and land the `flashcards` table with a `card_source` enum, per-column content constraints, per-user RLS policies (SELECT / INSERT / UPDATE / DELETE), and end-to-end TypeScript type wiring. This is the F-01 foundation slice — nothing in S-01, S-02, or S-03 can ship without it.

## Current State Analysis

- **Supabase CLI**: installed (`supabase@2.23.4` in devDependencies), fully initialized (`supabase/config.toml` present with `project_id = "10x-astro-starter"`, Postgres 17, ports 54321/54322/54323)
- **Migrations**: `supabase/migrations/` does not exist — this plan creates it
- **Supabase client**: `src/lib/supabase.ts` calls `createServerClient` without a `Database` generic — currently untyped
- **Shared types**: `src/types.ts` does not exist; `src/env.d.ts` declares only `App.Locals.user`
- **Auth**: fully wired — cookie-based sessions via `@supabase/ssr`, middleware resolves `user`, auth API routes in `src/pages/api/auth/`
- **Seed file**: `supabase/config.toml` references `./seed.sql` — does not exist, will create a minimal stub

### Key Discoveries

- `supabase/config.toml` — `project_id = "10x-astro-starter"`; DB major version 17
- `src/lib/supabase.ts` — `createServerClient(SUPABASE_URL, SUPABASE_KEY, { … })` — needs `<Database>` generic added
- `AGENTS.md` — "All new Supabase tables in `supabase/migrations/` must have RLS enabled with explicit per-operation policies"; migration naming: `YYYYMMDDHHmmss_short_description.sql`
- PRD §Access Control — flat user model, private flashcards, no cross-user access
- PRD §Success Criteria — `source` column required now to measure the ≥75% AI preference KPI without a future schema migration

## Desired End State

After this change is complete:

1. `supabase/migrations/20260823150404_flashcard_schema.sql` exists and is valid SQL
2. Running `npx supabase db reset` against a local Supabase instance produces:
   - A `card_source` enum with values `'ai'` and `'manual'`
   - A `flashcards` table with columns: `id uuid PK`, `user_id uuid FK→auth.users`, `front text NOT NULL`, `back text NOT NULL`, `source card_source NOT NULL`, `created_at timestamptz`, `updated_at timestamptz`
   - Non-empty constraint enforced on `front` and `back`
   - RLS enabled on `flashcards` with 4 policies — each scoped to `auth.uid() = user_id`
3. `src/types/database.ts` contains the generated Supabase TypeScript types (output of `supabase gen types typescript`)
4. `src/types.ts` exists and re-exports a convenience `Flashcard` type
5. `src/lib/supabase.ts` passes the `Database` generic to `createServerClient` — all `.from('flashcards')` calls are fully typed
6. `npx tsc --noEmit` exits clean

## What We're NOT Doing

- **No scheduling columns** (e.g. `next_review_at`, `interval`, `ease_factor`) — S-02 adds these when needed
- **No deck or category grouping** — single flat collection per user for MVP
- **No soft-delete** — `DELETE` is hard; no `deleted_at` column
- **No service-role bypass policy** — Supabase service role bypasses RLS by default; no explicit policy needed
- **No seed data with flashcard rows** — seed stub is a comment-only placeholder so `db reset` does not fail
- **No API endpoints** — data access logic belongs to S-01/S-02/S-03
- **No UI changes**

## Implementation Approach

Write the migration file first (single source of truth for the schema), then generate types from it, then wire the types into the client. This order ensures the TypeScript layer always reflects the real schema.

## Critical Implementation Details

- **Migration file name**: `20260823150404_flashcard_schema.sql` — follows `YYYYMMDDHHmmss_short_description.sql` from AGENTS.md
- **`user_id` FK**: `REFERENCES auth.users(id) ON DELETE CASCADE` — deleting a Supabase auth user removes all their flashcards automatically
- **`updated_at` trigger**: use `moddatetime` extension trigger to keep `updated_at` current; `moddatetime` is available in local Supabase via `pg_moddatetime`
- **RLS enable first**: `ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;` must appear before `CREATE POLICY` statements
- **Type output path**: `src/types/database.ts` — keeps generated code separate from hand-written types
- **`Database` generic**: `createServerClient<Database>(…)` in `src/lib/supabase.ts` — requires importing from `@/types/database`
- **`supabase gen types` command**: `npx supabase gen types typescript --local > src/types/database.ts` — requires local Supabase to be running

---

## Phase 1 — Migration file

**Goal**: create `supabase/migrations/` and the initial SQL migration.

Files to create:
- `supabase/migrations/20260823150404_flashcard_schema.sql` — new
- `supabase/seed.sql` — new (stub, prevents `db reset` seed-path error)

Migration SQL:

```sql
-- Enable moddatetime extension for auto-updating updated_at
create extension if not exists moddatetime schema extensions;

-- Card source enum
create type card_source as enum ('ai', 'manual');

-- Flashcards table
create table flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  front       text not null check (char_length(front) > 0),
  back        text not null check (char_length(back) > 0),
  source      card_source not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on row change
create trigger handle_updated_at
  before update on flashcards
  for each row
  execute procedure extensions.moddatetime(updated_at);

-- Row Level Security
alter table flashcards enable row level security;

create policy "Users can select their own flashcards"
  on flashcards for select
  using (auth.uid() = user_id);

create policy "Users can insert their own flashcards"
  on flashcards for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own flashcards"
  on flashcards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own flashcards"
  on flashcards for delete
  using (auth.uid() = user_id);
```

Seed stub:

```sql
-- Seed file placeholder.
-- Flashcard rows are user-owned and created via the app, not seeded.
```

Verification:
- `npx supabase start` succeeds
- `npx supabase db reset` applies migration without errors
- Supabase Studio (localhost:54323): `flashcards` table has 7 columns, RLS enabled, 4 policies listed

---

## Phase 2 — TypeScript type generation

**Goal**: produce `src/types/database.ts` and `src/types.ts`.

Steps:
- Ensure local Supabase is running (`npx supabase start`)
- Run: `npx supabase gen types typescript --local > src/types/database.ts`
- Create `src/types.ts`:

```typescript
import type { Database } from "@/types/database";

export type Flashcard = Database["public"]["Tables"]["flashcards"]["Row"];
export type FlashcardInsert = Database["public"]["Tables"]["flashcards"]["Insert"];
export type FlashcardUpdate = Database["public"]["Tables"]["flashcards"]["Update"];
export type CardSource = Database["public"]["Enums"]["card_source"];
```

Verification:
- `src/types/database.ts` contains `flashcards` table definitions and `card_source` enum
- `src/types.ts` imports without errors

---

## Phase 3 — Wire `Database` generic into Supabase client

**Goal**: update `src/lib/supabase.ts` so all Supabase queries are fully typed.

Edit `src/lib/supabase.ts` — add `Database` import and pass the generic:

```typescript
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import type { Database } from "@/types/database";

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
```

Verification:
- `npx tsc --noEmit` exits with no errors
- `npm run lint` exits clean

---

## Phase 4 — Verify end-to-end

**Goal**: confirm the full pipeline is green before marking the change complete.

Steps:
- `npx supabase status` — all services running
- `npx supabase db reset` — migration applies cleanly
- Supabase Studio (`:54323`): `flashcards` table has all 7 columns, RLS enabled, 4 policies
- `npx tsc --noEmit` — no type errors
- `npm run lint` — no lint errors
- `npm run build` — build succeeds (requires `SUPABASE_URL` + `SUPABASE_KEY` in `.env`)

---

## Open Risks & Assumptions

- **`moddatetime` extension**: available in local Supabase dev by default via the `pg_moddatetime` contrib module. If the remote Supabase project restricts extensions, fall back to a manual `BEFORE UPDATE` trigger (same effect, no extension dependency).
- **`supabase gen types --local`**: requires Docker and local Supabase to be running. If Docker is unavailable, types can be generated against the remote project with `--project-id <id>` instead.
- **`updated_at` trigger schema**: the trigger calls `extensions.moddatetime(updated_at)`. If `moddatetime` lands in `public` rather than `extensions`, adjust the schema prefix accordingly after inspecting `\dx` output.

---

## Progress

- [x] Phase 1 — Migration file (`supabase/migrations/20260823150404_flashcard_schema.sql` + `supabase/seed.sql`) — 768b794
- [x] Phase 2 — TypeScript type generation (`src/types/database.ts`, `src/types.ts`)
- [ ] Phase 3 — Wire `Database` generic (`src/lib/supabase.ts`)
- [ ] Phase 4 — End-to-end verification (reset, tsc, lint, build)
