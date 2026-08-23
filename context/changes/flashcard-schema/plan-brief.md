# Plan Brief: flashcard-schema (F-01)

**Change**: Set up Supabase migration pipeline; land `flashcards` table with RLS.
**Status**: planned | **Unlocks**: S-01, S-02, S-03

## Decisions locked

| Question | Decision |
|---|---|
| Columns | `id`, `user_id`, `front`, `back`, `source`, `created_at`, `updated_at` |
| Content constraints | `text NOT NULL CHECK (char_length > 0)` on `front` and `back` |
| `source` type | Native PG enum `card_source ('ai', 'manual')` |
| RLS | All 4 ops (`SELECT/INSERT/UPDATE/DELETE`) scoped to `auth.uid() = user_id` |
| TypeScript | Generate types → `src/types/database.ts`; wire `Database` generic into `createClient` |

## Files touched

| File | Action |
|---|---|
| `supabase/migrations/20260823150404_flashcard_schema.sql` | create |
| `supabase/seed.sql` | create (stub) |
| `src/types/database.ts` | create (generated) |
| `src/types.ts` | create |
| `src/lib/supabase.ts` | edit — add `Database` generic |

## Phases

1. Migration file + seed stub
2. `supabase gen types typescript --local > src/types/database.ts` + write `src/types.ts`
3. Wire `<Database>` generic into `src/lib/supabase.ts`
4. Verify: `db reset`, tsc, lint, build

## Key risks

- `moddatetime` extension must be in `extensions` schema on remote — fallback: manual `BEFORE UPDATE` trigger
- Type generation requires Docker + `npx supabase start`
