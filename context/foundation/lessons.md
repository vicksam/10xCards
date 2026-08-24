# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Stop containers after testing is done

- **Context**: Testing and verification phases involving local containers (e.g. Supabase, Docker)
- **Problem**: Leaving background containers running wastes system resources, especially RAM which severly slows down operations
- **Rule**: Stop all containers immediately after testing and verification are completed and they are no longer needed.
- **Applies to**: implement, impl-review

## Use supabase migration up instead of db reset

- **Context**: Local Supabase database migration workflows during implementation and verification
- **Problem**: `npx supabase db reset` frequently fails with container errors and corrupts auth/schema state, whereas `npx supabase migration up` applies migrations cleanly and reliably.
- **Rule**: Always use `npx supabase migration up` to apply new migrations to a running local Supabase instance instead of `npx supabase db reset`.
- **Applies to**: plan, implement, impl-review
