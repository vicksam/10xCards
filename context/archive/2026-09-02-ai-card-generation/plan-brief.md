# Plan Brief: ai-card-generation (S-01)

**Change**: AI flashcard generation from pasted text with card-by-card candidate review
**Status**: plan_reviewed | **Phases**: 5

## Stack decisions locked
- **AI provider**: OpenRouter via `openai` npm package (`baseURL: https://openrouter.ai/api/v1`, model: `openai/gpt-4o-mini`)
- **New env var**: `OPENROUTER_API_KEY` (server, secret, optional) in `astro.config.mjs`, `.env.example`, `.dev.vars.example`
- **New packages**: `openai`, `zod`
- **Review UX**: card-by-card (one at a time), inline edit
- **Generation UX**: optimistic loading (spinner within 2s), all candidates revealed at once
- **Card count/cost bound**: at most 15 cards, 2,500 completion tokens, 10,000 input characters
- **Error handling**: one silent retry only for network/408/429/5xx within a shared 30-second deadline
- **Text privacy**: never logged or persisted (NFR — study text lives only in request body)
- **Review persistence**: aggregate generated/accepted/edited/rejected counts only; accepted-card insertion and review finalization are atomic and idempotent
- **Post-review**: explicit Save to deck / Finish review, inline success, then "Generate more" resets to an empty textarea
- **KPIs**: current-user `/stats` page with acceptance, provisional AI creation preference, and acceptance trend
- **Navigation**: `/generate` and `/stats` in `PROTECTED_ROUTES`; dashboard links to both
- **Validation**: trimmed text; card front 1–500 and back 1–2,000 characters across AI filtering, UI, API, function, and database
- **Missing config**: existing banner pattern plus disabled generation UI; production secret documented
- **UI**: plain Tailwind (no new shadcn installs)

## New files
| File | Type | Purpose |
|---|---|---|
| `supabase/migrations/20260824000000_generation_reviews.sql` | migration | aggregate KPI rows, RLS, card constraints, atomic finalization function |
| `src/lib/services/ai-generation.ts` | service | OpenRouter call, JSON parse, candidate filtering |
| `src/pages/api/flashcards/generate.ts` | API route | POST, Zod-validated, returns generation ID + candidates |
| `src/pages/api/flashcards/index.ts` | API route | POST, atomically finalizes KPI counts + accepted cards |
| `src/components/hooks/useFlashcardGeneration.ts` | hook | fetch + auto-retry state machine |
| `src/components/hooks/useCardReview.ts` | hook | card-by-card navigation, validation, and finalization |
| `src/components/FlashcardGenerator.tsx` | component | orchestrator + `CardReview` inner component |
| `src/pages/generate.astro` | page | SSR page, mounts FlashcardGenerator |
| `src/pages/stats.astro` | page | current-user KPI cards and acceptance trend |

## Modified files
| File | Change |
|---|---|
| `src/middleware.ts` | add `"/generate"` and `"/stats"` to `PROTECTED_ROUTES` |
| `src/pages/dashboard.astro` | add CTA links to `/generate` and `/stats` |
| `src/types.ts` | add generation DTOs and `UserKpiStats` |
| `src/types/database.ts` | regenerate for review table and finalization RPC |
| `src/lib/config-status.ts` | add OpenRouter to missing-service statuses |
| `astro.config.mjs` | add `OPENROUTER_API_KEY` to env schema |
| `package.json` / `package-lock.json` | add and lock `openai`, `zod` |
| `.env.example` / `.dev.vars.example` | add `OPENROUTER_API_KEY` |
| `README.md` | document the production OpenRouter secret command |

## Key constraints
- No `"use client"` in any file (AGENTS.md hard rule)
- Use `cn()` for all conditional classes
- All API routes: `export const prerender = false`
- Zod-validate all API inputs
- `generation_reviews` has RLS; finalization also verifies `auth.uid()` and is idempotent
- Never persist source study text or rejected card content
- `/stats` is current-user only; no global/admin analytics
- `createClient()` can return `null` — every route must guard against it
- `OPENROUTER_API_KEY` is optional at build time but required for generation at runtime
