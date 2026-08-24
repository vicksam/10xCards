# AI Flashcard Generation Implementation Plan

## Overview

Implement the S-01 north-star slice: a user-facing flow that lets authenticated users paste study text, trigger AI-powered flashcard generation via OpenRouter, review candidates card-by-card (accept / edit inline / reject), and save accepted cards to their Supabase deck. Persist aggregate review outcomes without study text so the current user can track the product's core KPIs (≥75% AI acceptance rate, ≥75% AI creation preference).

## Current State Analysis

What's already in place:

- **Auth**: fully wired — cookie sessions, middleware, protected routes, signin/signup/signout API routes
- **Database**: `flashcards` table landed with `source: 'ai' | 'manual'` enum + RLS on all 4 operations (F-01 done)
- **Types**: `Flashcard`, `FlashcardInsert`, `FlashcardUpdate`, `CardSource` exported from `src/types.ts`
- **Supabase client**: `createClient(headers, cookies)` in `src/lib/supabase.ts`, typed with `Database` generic, returns `null` if env vars missing
- **Dashboard**: placeholder only — "This page is only for authenticated users", no flashcard UI
- **No AI SDK, no AI env vars, no `src/lib/services/`, no `src/components/hooks/`**
- **shadcn/ui**: only `button.tsx` installed (new-york style, CVA-powered)
- **Zod**: not installed (AGENTS.md mandates it for API input validation)

## Desired End State

After this change is complete:

1. `POST /api/flashcards/generate` accepts `{ text: string }` with valid auth, returns `{ generationId: string | null, candidates: CandidateCard[] }` — text is never persisted (NFR)
2. `POST /api/flashcards` accepts `{ generationId, cards: [{front, back, outcome}] }` with valid auth, atomically finalizes aggregate review counts and inserts accepted/edited cards with `source: 'ai'`; zero-card finalization is valid
3. `/generate` and `/stats` are in `PROTECTED_ROUTES` — unauthenticated visitors are redirected to `/auth/signin`
4. The `/generate` page renders the full flow: textarea → loading spinner → card-by-card review → explicit save/finish → success state → reset to textarea
5. `/stats` shows the current user's overall AI acceptance, AI creation preference, and acceptance trend without exposing study text or other users' data
6. Dashboard has CTAs linking to `/generate` and `/stats`
7. `npx tsc --noEmit` exits clean
8. `npm run lint` exits clean
9. `npm run build` succeeds; because `OPENROUTER_API_KEY` is optional in the Astro schema, it is required at runtime for generation but not for the build

### Key Discoveries

- `src/lib/supabase.ts` — `createClient(requestHeaders, cookies)` returns typed client or `null` if env vars missing; every API route must guard against `null`
- `src/pages/api/auth/signin.ts` — establishes the `POST: APIRoute` and request-scoped Supabase client pattern, but uses form data and redirects; the new flashcard routes establish the project's Zod-validated JSON response pattern and explicitly add `prerender = false`
- `src/middleware.ts` — `PROTECTED_ROUTES` string array; middleware populates `context.locals.user` before route handlers run
- `src/types/database.ts` — `FlashcardInsert` requires `{ back, front, source, user_id }` minimum; `source` is `"ai" | "manual"`
- `astro.config.mjs` — env schema pattern: `envField.string({ context: "server", access: "secret", optional: true })`
- `src/lib/utils.ts` — `cn()` helper for all conditional class merging; AGENTS.md forbids string concatenation for classes
- No hooks directory exists yet — must create `src/components/hooks/`
- No services directory exists yet — must create `src/lib/services/`

## What We're NOT Doing

- No flashcard list or CRUD management UI (S-03's scope)
- No spaced repetition study session (S-02's scope)
- No manual card creation form in this slice
- No streaming LLM responses — batch + loading state pattern chosen (reliable under Cloudflare Workers edge limits)
- No file/URL import (PRD non-goal #1)
- No toast notification library install — success state is in-component Tailwind only
- No additional shadcn/ui component installs beyond `button.tsx` already in place
- No test files (TypeScript + lint are the verification gates for this project)
- No global or admin analytics — `/stats` is scoped to the authenticated user's own data

## Implementation Approach

Five phases in dependency order: (1) add the aggregate review schema, install dependencies, and wire env vars, DTO types, and the AI service; (2) API routes with Zod validation, auth guards, and atomic review finalization; (3) React hooks and the review component; (4) Astro generation/stats pages, middleware update, and dashboard CTAs; (5) end-to-end verification.

The service layer (`src/lib/services/ai-generation.ts`) is the single place that knows about OpenRouter. API routes call it and return its output as JSON. The React component calls API routes via `fetch` from the client; it never calls OpenRouter directly.

## Critical Implementation Details

**OpenRouter:**

- Package: `openai` (npm) — OpenRouter exposes an OpenAI-compatible API
- `baseURL`: `https://openrouter.ai/api/v1`
- Default model: `openai/gpt-4o-mini` (cost-effective, JSON mode supported, changeable in the service file)
- Env var: `OPENROUTER_API_KEY` — declared in `astro.config.mjs` env schema as `{ context: "server", access: "secret", optional: true }`; must also be added to `.env.example` and `.dev.vars.example`

**Zod:**

- Not currently in `package.json` — `npm install zod` is the first step of Phase 1
- AGENTS.md mandates Zod validation on all API inputs

**LLM prompt contract:**

- System prompt instructs: output exactly `{ "cards": [{"front": "question", "back": "answer"}] }` with at most 15 cards, front limited to 500 characters, and back limited to 2,000 characters
- `response_format: { type: "json_object" }` passed to OpenAI client (supported by gpt-4o-mini via OpenRouter)
- Request caps output with `max_completion_tokens: 2500`; the service strips optional Markdown code fences, parses `response.cards` (or a top-level array), trims whitespace, filters invalid or over-limit entries, and returns at most 15 `CandidateCard` entries
- Null, empty, or invalid JSON content produces a controlled service error; changing the model requires verifying `response_format` support because parsing cannot recover from a rejected request parameter
- Empty candidate set (zero valid cards) is handled by the component — shows "No cards could be generated from this text" and resets to idle

**Auto-retry:**

- Client-side only, in `useFlashcardGeneration` hook
- One silent retry only on a network error or HTTP 408, 429, or 5xx response; other 4xx responses fail immediately
- A shared 30-second `AbortController` deadline covers both attempts so retry cannot extend the request indefinitely
- Loading spinner stays visible through the retry — invisible to user
- Error state shown only after both attempts fail

**Text privacy NFR:**

- `text` lives in the request body → passed to `generateFlashcards(text)` → sent to OpenRouter → discarded
- No `console.log` of the text value, no DB write, no response body that echoes it back
- Comment in the generate route and service file marks this as an NFR constraint

**KPI persistence:**

- `generation_reviews` stores only `user_id`, candidate/outcome counts, and timestamps — never source text or rejected card content
- A generation row is created only when at least one valid candidate exists; empty results return `generationId: null`
- The finalization function locks the generation row, derives accepted/edited counts from submitted card outcomes and rejected count from `generated_count`, inserts accepted/edited cards, and marks the review finalized in one transaction
- Repeated finalization of the same `generationId` is idempotent and must not insert duplicate cards
- AI acceptance is `(accepted_count + edited_count) / generated_count`; AI creation preference is AI-sourced saved cards / all saved cards
- `/stats` displays current-user aggregates and an acceptance-over-time trend; before manual creation exists, the AI-preference KPI is labeled as provisional

**Soft text validation:**

- Client shows a warning badge when `text.trim().length < 50` ("This text is quite short — generated cards may not be useful")
- Generate button is disabled only when trimmed text is empty or over 10,000 characters; the textarea uses `maxLength={10000}`
- API-level Zod schema trims and enforces `min(1)` and `max(10000)` as hard limits

**Card content validation:**

- Front is trimmed and limited to 1–500 characters; back is trimmed and limited to 1–2,000 characters
- The same limits are enforced by AI candidate filtering, the edit hook, save-route Zod schema, finalization function, and database constraints
- Invalid inline edits remain open with an error instead of advancing the review

**Missing OpenRouter configuration:**

- Add OpenRouter to `configStatuses` so `Layout.astro` renders the established missing-service banner
- `generate.astro` computes `Boolean(OPENROUTER_API_KEY)` on the server and passes only that boolean to the React island; the secret value never reaches the browser
- `FlashcardGenerator` disables generation and explains the missing configuration when the key is absent, rather than waiting for a 500 response
- Production setup uses `npx wrangler secret put OPENROUTER_API_KEY`; local Cloudflare development continues to use `.dev.vars`

**Auth guard in API routes:**

- `context.locals.user` is already populated by middleware — a simple `if (!context.locals.user)` check at the top of the handler is sufficient (consistent with the existing auth route pattern)

**React component split:**

- `FlashcardGenerator.tsx` is the outer component (manages generation state, owns textarea input)
- `CardReview` is an inner sub-component within the same file, rendered when candidates arrive (accepts `candidates: CandidateCard[]` prop and uses `useCardReview` internally — avoids conditional hook calls)
- Hooks in `src/components/hooks/` per AGENTS.md rule

---

## Phase 1: Data contract, dependencies, env, types, and AI service

**Goal**: everything the generation API route needs exists before the route is written.

Files to create:

- `src/lib/services/ai-generation.ts` — new
- `supabase/migrations/20260824000000_generation_reviews.sql` — new

Files to modify:

- `package.json` — add `openai` and `zod` to `dependencies`
- `package-lock.json` — updated by `npm install` so CI's `npm ci` installs the new direct dependencies
- `astro.config.mjs` — add `OPENROUTER_API_KEY` to `env.schema`
- `.env.example` — add `OPENROUTER_API_KEY=###`
- `.dev.vars.example` — add `OPENROUTER_API_KEY=your-openrouter-api-key`
- `src/lib/config-status.ts` — register OpenRouter in the existing missing-service banner system
- `README.md` — document `npx wrangler secret put OPENROUTER_API_KEY` for production
- `src/types.ts` — add DTO and KPI types
- `src/types/database.ts` — regenerate after applying the migration

**`generation_reviews` migration contract:**

- Columns: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null` FK to `auth.users` with cascade delete, `generated_count integer not null check > 0`, non-negative `accepted_count`, `edited_count`, and `rejected_count` integers defaulting to 0, `created_at timestamptz not null default now()`, and nullable `finalized_at timestamptz`
- Enable RLS with explicit SELECT/INSERT policies scoped to `auth.uid() = user_id`; direct UPDATE/DELETE policies deny client mutation
- Add trimmed-length constraints to `flashcards.front` (1–500) and `flashcards.back` (1–2,000) so future write paths share the same integrity boundary
- Add `finalize_generation_review(generation_id uuid, cards jsonb)` as a security-definer function with a fixed `search_path`
- The function requires `auth.uid()`, locks and verifies the caller's unfinalized generation row, rejects a card count greater than `generated_count`, validates and trims front/back values against the shared length limits and `outcome: "accepted" | "edited"`, inserts cards with `source: "ai"`, derives all outcome counts, and sets `finalized_at`
- If the row is already finalized, return its saved count without inserting again so retry after a lost response is idempotent
- Grant function execution only to `authenticated`

**`src/types.ts` additions** (append after existing exports):

```typescript
// AI generation DTOs
export interface CandidateCard {
  front: string;
  back: string;
}

export interface GenerateResponse {
  generationId: string | null;
  candidates: CandidateCard[];
}

export interface UserKpiStats {
  generated: number;
  accepted: number;
  edited: number;
  rejected: number;
  acceptanceRate: number | null;
  aiCards: number;
  totalCards: number;
  aiPreferenceRate: number | null;
  trend: { date: string; generated: number; acceptanceRate: number }[];
}
```

**`src/lib/services/ai-generation.ts`** contract:

- Imports: `OpenAI` from `"openai"`, `OPENROUTER_API_KEY` from `"astro:env/server"`, `CandidateCard` from `"@/types"`
- Exports: `async function generateFlashcards(text: string): Promise<CandidateCard[]>`
- Guards: throws `Error("OPENROUTER_API_KEY is not configured")` if key is falsy
- Creates `new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1", timeout: 25_000, maxRetries: 0 })` so SDK retries do not multiply the client retry
- Calls `client.chat.completions.create` with model `"openai/gpt-4o-mini"`, `response_format: { type: "json_object" }`, `max_completion_tokens: 2500`, `temperature: 0.3`, and a system prompt requesting at most 15 cards in `{ "cards": [{front, back}] }` JSON shape with the shared 500/2,000-character limits
- Rejects null/empty content, strips one optional outer Markdown code fence, parses JSON, picks `parsed.cards` if array or a top-level array, trims strings, filters to non-empty `{front, back}` entries within the shared length limits, then returns `.slice(0, 15)`
- Never logs `text` — adds `// NFR: study text must not be logged or persisted` comment

#### Automated Verification:

- `npm install` succeeds (no peer conflicts)
- `npx astro sync` regenerates the `astro:env/server` declaration with `OPENROUTER_API_KEY`
- `npx supabase db reset` applies the review migration and function cleanly
- `npx tsc --noEmit` exits clean (new types and service compile)

---

## Phase 2: API routes

**Goal**: two typed, auth-protected, Zod-validated endpoints.

Files to create:

- `src/pages/api/flashcards/generate.ts` — new
- `src/pages/api/flashcards/index.ts` — new

**`src/pages/api/flashcards/generate.ts`** contract:

- `export const prerender = false`
- `export const POST: APIRoute`
- Zod schema: `z.object({ text: z.string().trim().min(1).max(10000) })`
- Guards in order: (1) `context.locals.user` null check → 401, (2) `request.json()` parse error → 400, (3) Zod `safeParse` failure → 400, (4) `createClient` null check → 503, (5) `generateFlashcards` call → 500 on throw
- For a non-empty candidate set, insert `{ user_id, generated_count }` into `generation_reviews` and return its ID; do not persist candidate content
- Success: `200 { generationId: string, candidates: CandidateCard[] }`; an empty result returns `{ generationId: null, candidates: [] }` without a review row
- Text value is passed directly to `generateFlashcards` and not referenced again — satisfies NFR

**`src/pages/api/flashcards/index.ts`** contract:

- `export const prerender = false`
- `export const POST: APIRoute`
- Zod schema: `z.object({ generationId: z.string().uuid(), cards: z.array(z.object({ front: z.string().trim().min(1).max(500), back: z.string().trim().min(1).max(2000), outcome: z.enum(["accepted", "edited"]) })) })`; an empty cards array is valid
- Guards in order: (1) `context.locals.user` null check → 401, (2) JSON parse error → 400, (3) Zod failure → 400, (4) `createClient` null check → 503
- Call `supabase.rpc("finalize_generation_review", { generation_id: generationId, cards })`; ownership is enforced in the function as well as by RLS
- Success: `200 { saved: number }`, including `{ saved: 0 }` when every candidate was rejected
- Supabase error: `500 { error: error.message }`

#### Automated Verification:

- `npx tsc --noEmit` exits clean
- `npm run lint` exits clean

---

## Phase 3: React hooks and review component

**Goal**: the interactive generation + review UI, fully typed, all side effects in hooks.

Files to create:

- `src/components/hooks/useFlashcardGeneration.ts` — new
- `src/components/hooks/useCardReview.ts` — new
- `src/components/FlashcardGenerator.tsx` — new

**`src/components/hooks/useFlashcardGeneration.ts`** contract:

- Manages fetch lifecycle to `POST /api/flashcards/generate`
- State union: `{ status: "idle" } | { status: "loading" } | { status: "success"; generationId: string | null; candidates: CandidateCard[] } | { status: "error"; message: string }`
- `generate(text: string)`: sets loading, creates one 30-second abort deadline shared by both attempts, and retries once only for a network failure or HTTP 408, 429, or 5xx; other 4xx responses fail immediately
- `reset()`: sets idle; the component wraps it in `handleReset()` to clear its separately owned textarea text as well
- Returns `{ state, generate, reset }`

**`src/components/hooks/useCardReview.ts`** contract:

- Initialised with `generationId: string` and `initialCandidates: CandidateCard[]`
- Internal state: `cards: ReviewCard[]` (extends `CandidateCard` with `id`, `status: "pending" | "accepted" | "rejected"`, `edited: boolean`), `currentIndex: number`, `editState: { front: string; back: string } | null`, `editError: string | null`, `isSaving: boolean`, `savedCount: number | null`, `saveError: string | null`
- `accept()`: marks `cards[currentIndex]` as accepted, increments index
- `reject()`: marks `cards[currentIndex]` as rejected, increments index
- `startEdit()`: sets `editState` from current card values
- `saveEdit()`: trims and validates front/back against the shared limits; invalid values set `editError` and keep the editor open, while valid values update the card (sets `status: "accepted"`, `edited: true`), clear edit state/errors, and increment index
- `cancelEdit()`: clears `editState` without advancing
- `saveAccepted()`: no-ops while `isSaving`, POSTs `{ generationId, cards: acceptedCards.map({front, back,outcome: edited ? "edited" : "accepted"}) }` to `/api/flashcards`, and always finalizes, including with an empty cards array; it sets `savedCount` on success or `saveError` on failure
- `isDone`: `currentIndex >= cards.length`
- Returns all state and actions

**`src/components/FlashcardGenerator.tsx`** structure:

```
FlashcardGenerator (default export; `isConfigured: boolean` prop)
  — uses useFlashcardGeneration
  — manages textarea text state + soft-length warning
  — `handleReset()` clears textarea text and generation state
  — renders:
      idle / loading / error  →  TextInputSection (inline, not a separate file)
      success, generationId !== null, candidates.length > 0 → <CardReview generationId={state.generationId} candidates={state.candidates} onReset={handleReset} />
      success, generationId === null or no candidates       → empty-result message + Try again → handleReset()

CardReview (non-exported inner component, same file)
  — uses useCardReview(generationId, candidates)
  — renders:
      !isDone, !editState  →  card view (front, back, Accept/Edit/Reject buttons, N of total)
      !isDone, editState   →  inline edit (front textarea, back textarea, Save/Cancel buttons)
      isDone, savedCount === null  →  summary + Save to deck when accepted count > 0, or Finish review when it is 0; button is disabled while saving
      isDone, savedCount !== null  →  success ("X cards added to your deck") + Generate more button → onReset(); no per-session percentages
      saveError            →  error message with Retry and Discard / generate more actions
```

- Uses `cn()` from `@/lib/utils` for all conditional classes
- Uses `Button` from `@/components/ui/button`
- No `"use client"` directive (AGENTS.md hard rule)
- No business logic in JSX — all state management in hooks
- Handles empty candidates: if `candidates.length === 0`, renders "No cards could be generated from this text. Try with more content." and a "Try again" button that calls `onReset()`

#### Automated Verification:

- No `"use client"` in any created file (`grep -r "use client" src/` returns nothing new)
- `npx tsc --noEmit` exits clean
- `npm run lint` exits clean

---

## Phase 4: Generation page, stats page, middleware, and navigation

**Goal**: wire the component into a protected Astro route and link it from the dashboard.

Files to create:

- `src/pages/generate.astro` — new
- `src/pages/stats.astro` — new

Files to modify:

- `src/middleware.ts` — add `"/generate"` and `"/stats"` to `PROTECTED_ROUTES`
- `src/pages/dashboard.astro` — add "Generate flashcards" and "View stats" CTAs

**`src/pages/generate.astro`** contract:

```astro
---
import Layout from "@/layouts/Layout.astro";
import FlashcardGenerator from "@/components/FlashcardGenerator";
import { OPENROUTER_API_KEY } from "astro:env/server";
---

<Layout title="Generate Flashcards">
  <main class="min-h-screen p-6">
    <FlashcardGenerator isConfigured={Boolean(OPENROUTER_API_KEY)} client:load />
  </main>
</Layout>
```

**`src/middleware.ts`** change:

```typescript
const PROTECTED_ROUTES = ["/dashboard", "/generate", "/stats"];
```

**`src/pages/dashboard.astro`** change:
Add prominent "Generate flashcards" and "View stats" CTAs (anchor tags styled as buttons using Tailwind, linking to `/generate` and `/stats`) to the existing dashboard card section.

**`src/pages/stats.astro`** contract:

- Static Astro page with no React island or chart dependency
- Uses `Astro.locals.user` and the request-scoped Supabase client; guards missing user/client even though middleware protects the route
- Selects only the current user's finalized `generation_reviews` count fields/timestamps and flashcard `source` values; RLS remains the primary isolation boundary
- Computes `UserKpiStats` server-side, grouping finalized review rows by date for the trend
- Renders KPI cards for overall acceptance and AI creation preference plus a simple accessible SVG/CSS acceptance trend
- Shows a clear empty state when no reviews exist and labels AI creation preference as provisional until manual creation is available

#### Manual Verification:

- Unauthenticated GET /generate → 302 redirect to /auth/signin
- Authenticated GET /generate → 200, FlashcardGenerator renders in browser
- Missing OpenRouter key → existing configuration banner renders and generation controls are disabled
- Unauthenticated GET /stats → 302 redirect to /auth/signin
- Authenticated GET /stats → 200, only that user's KPI aggregates and trend render
- Dashboard renders both CTA links

---

## Phase 5: End-to-end verification

**Goal**: confirm the full pipeline is green before marking the change complete.

#### Automated Verification:

- `npx tsc --noEmit` — no type errors
- `npm run lint` — no lint errors
- `npm run build` — build succeeds with the optional OpenRouter key absent; generation requires it at runtime

#### Manual Verification:

- Unauthenticated user visits /generate → redirected to /auth/signin
- Authenticated user visits /generate → FlashcardGenerator UI renders
- OpenRouter key absent → configuration banner and disabled generation state render without exposing the key
- Paste text >50 chars → no warning; click Generate → spinner visible within 2s (NFR ✓)
- Paste text <50 chars → soft warning badge shown; Generate button still enabled
- Empty/whitespace text → Generate remains disabled; input over 10,000 characters cannot be submitted
- Generation succeeds → card-by-card review shown ("Card 1 of N")
- Accept card → moves to card 2 of N
- Reject card → moves to next card
- Click Edit → inline front/back textareas appear; edit; click Save → accepted + edited, moves to next
- Empty or over-limit edit → inline validation shown and review does not advance
- Click Edit → click Cancel → stays on current card in view mode
- All cards reviewed → summary shown ("X accepted, Y rejected") + "Save to deck" button
- Click Save → accepted cards inserted to Supabase → "X cards added to your deck" success state
- Reject all cards → "Finish review" persists a zero-saved review outcome and reaches the success state
- Persistent save failure → Retry remains available; Discard returns to an empty textarea
- Click "Generate more" → UI resets to an empty textarea (idle)
- Generation API failure → auto-retries once silently → shows error + "Try again" button
- AI response containing more than 15 valid cards → only the first 15 enter review
- AI response containing an over-limit front/back value → invalid candidate is filtered before review
- Generation API 400 response → fails immediately without a silent retry
- POST /api/flashcards/generate without auth → 401 JSON
- POST /api/flashcards without auth → 401 JSON
- Repeating the same finalization request does not duplicate cards or KPI counts
- A second user cannot finalize another user's `generationId` or see its KPI row
- Stats page shows current-user KPI cards and acceptance trend
- Dashboard renders "Generate flashcards" and "View stats" CTAs
- Production setup documents `npx wrangler secret put OPENROUTER_API_KEY`

---

## Open Risks & Assumptions

- **`response_format: { type: "json_object" }` coverage**: Works for `openai/gpt-4o-mini` via OpenRouter. Any model change must verify JSON-mode support; the content parser handles fenced JSON but cannot recover when a provider rejects the request parameter.
- **Cloudflare Workers + `openai` package**: The `openai` v4+ package is fetch-based. The `nodejs_compat` compatibility flag in `wrangler.jsonc` provides the remaining Node polyfills. No issues expected.
- **OpenRouter as intermediary**: Provider outages propagate. The one-retry logic handles transient failures within a shared 30-second client deadline; persistent failures surface as user-visible errors with a retry button.
- **MVP cost boundary**: Each request is bounded to 10,000 input characters, 2,500 completion tokens, and 15 returned cards. Per-user quotas are deferred until usage or provider spend justifies durable rate-limit state.
- **Empty candidate set**: If the AI returns zero valid cards, `CardReview` renders a "No cards could be generated" message with a "Try again" button — must be handled explicitly (not just an empty review list).

---

## Progress

### Phase 1: Data contract, dependencies, env, types, and AI service

- [x] 1.1 `npm install` succeeds (no peer conflicts) — df52fc1
- [x] 1.2 `npx astro sync` regenerates the `astro:env/server` declaration with `OPENROUTER_API_KEY` — df52fc1
- [x] 1.3 `npx supabase db reset` applies the review migration and function cleanly — df52fc1
- [x] 1.4 `npx tsc --noEmit` exits clean (new types and service compile) — df52fc1

### Phase 2: API routes

- [x] 2.1 `npx tsc --noEmit` exits clean — b0da042
- [x] 2.2 `npm run lint` exits clean — b0da042

### Phase 3: React hooks and review component

- [x] 3.1 No `"use client"` in any created file (`grep -r "use client" src/` returns nothing new) — c934b58
- [x] 3.2 `npx tsc --noEmit` exits clean — c934b58
- [x] 3.3 `npm run lint` exits clean — c934b58

### Phase 4: Generation page, stats page, middleware, and navigation

- [x] 4.1 Unauthenticated GET /generate → 302 redirect to /auth/signin — 5b2f9f4
- [x] 4.2 Authenticated GET /generate → 200, FlashcardGenerator renders in browser — 5b2f9f4
- [x] 4.3 Missing OpenRouter key → existing configuration banner renders and generation controls are disabled — 5b2f9f4
- [x] 4.4 Unauthenticated GET /stats → 302 redirect to /auth/signin — 5b2f9f4
- [x] 4.5 Authenticated GET /stats → 200, only that user's KPI aggregates and trend render — 5b2f9f4
- [x] 4.6 Dashboard renders both CTA links — 5b2f9f4

### Phase 5: End-to-end verification

- [ ] 5.1 `npx tsc --noEmit` — no type errors
- [ ] 5.2 `npm run lint` — no lint errors
- [ ] 5.3 `npm run build` — build succeeds with the optional OpenRouter key absent; generation requires it at runtime
- [ ] 5.4 Unauthenticated user visits /generate → redirected to /auth/signin
- [ ] 5.5 Authenticated user visits /generate → FlashcardGenerator UI renders
- [ ] 5.6 OpenRouter key absent → configuration banner and disabled generation state render without exposing the key
- [ ] 5.7 Paste text >50 chars → no warning; click Generate → spinner visible within 2s (NFR ✓)
- [ ] 5.8 Paste text <50 chars → soft warning badge shown; Generate button still enabled
- [ ] 5.9 Empty/whitespace text → Generate remains disabled; input over 10,000 characters cannot be submitted
- [ ] 5.10 Generation succeeds → card-by-card review shown ("Card 1 of N")
- [ ] 5.11 Accept card → moves to card 2 of N
- [ ] 5.12 Reject card → moves to next card
- [ ] 5.13 Click Edit → inline front/back textareas appear; edit; click Save → accepted + edited, moves to next
- [ ] 5.14 Empty or over-limit edit → inline validation shown and review does not advance
- [ ] 5.15 Click Edit → click Cancel → stays on current card in view mode
- [ ] 5.16 All cards reviewed → summary shown ("X accepted, Y rejected") + "Save to deck" button
- [ ] 5.17 Click Save → accepted cards inserted to Supabase → "X cards added to your deck" success state
- [ ] 5.18 Reject all cards → "Finish review" persists a zero-saved review outcome and reaches the success state
- [ ] 5.19 Persistent save failure → Retry remains available; Discard returns to an empty textarea
- [ ] 5.20 Click "Generate more" → UI resets to an empty textarea (idle)
- [ ] 5.21 Generation API failure → auto-retries once silently → shows error + "Try again" button
- [ ] 5.22 AI response containing more than 15 valid cards → only the first 15 enter review
- [ ] 5.23 AI response containing an over-limit front/back value → invalid candidate is filtered before review
- [ ] 5.24 Generation API 400 response → fails immediately without a silent retry
- [ ] 5.25 POST /api/flashcards/generate without auth → 401 JSON
- [ ] 5.26 POST /api/flashcards without auth → 401 JSON
- [ ] 5.27 Repeating the same finalization request does not duplicate cards or KPI counts
- [ ] 5.28 A second user cannot finalize another user's `generationId` or see its KPI row
- [ ] 5.29 Stats page shows current-user KPI cards and acceptance trend
- [ ] 5.30 Dashboard renders "Generate flashcards" and "View stats" CTAs
- [ ] 5.31 Production setup documents `npx wrangler secret put OPENROUTER_API_KEY`
