---
project: "10xCards"
version: 1
status: draft
created: 2026-08-22
updated: 2026-08-24
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Manual flashcard creation is slow and happens when energy is lowest — after a study session. Professionals drop the habit entirely. 10xCards shifts the user's role from card author to card reviewer: paste study text, let AI generate candidate Q&A pairs, accept or reject each, then study them on a spaced repetition schedule. The core product hypothesis — the claim that, if disproven, means the product doesn't work — is that AI-generated cards are good enough that users prefer them over manual creation (≥75% acceptance, ≥75% AI-to-manual ratio).

## North star

**S-01: User can paste study text, trigger AI generation, review candidates, and save accepted cards to their deck** — this is the validation milestone (the smallest end-to-end slice whose successful delivery proves the core product hypothesis), placed first because both primary Success Criteria (≥75% AI acceptance rate, ≥75% AI creation preference) measure exactly this flow.

> "North star" in this roadmap means: the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | flashcard-schema | (foundation) Supabase migration pipeline and flashcards table with RLS landed | — | Access Control | done |
| S-01 | ai-card-generation | paste study text, trigger AI generation, review candidates (accept/edit/reject), and save accepted cards | F-01 | US-01, FR-001, FR-002, FR-003, FR-004 | in-progress |
| S-02 | spaced-repetition-session | start a spaced repetition study session with scheduling | F-01 | FR-007 | ready |
| S-03 | card-management | manually create a flashcard and view, edit, delete saved flashcards | F-01 | FR-005, FR-006 | ready |

## Baseline

What's already in place in the codebase as of `2026-08-22` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19, shadcn/ui + Radix, Tailwind CSS v4, pages and routing in place (`src/pages/`)
- **Backend / API:** present — Astro SSR (`output: "server"`), Cloudflare adapter, API routes for auth (`src/pages/api/auth/`), middleware (`src/middleware.ts`)
- **Data:** partial — Supabase client SDK installed (`@supabase/supabase-js`, `@supabase/ssr`), but no migrations, schemas, or seed data (`supabase/migrations/` does not exist)
- **Auth:** present — Supabase Auth via `@supabase/ssr`, cookie-based sessions, auth middleware protecting routes (`src/middleware.ts`)
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`), CI via GitHub Actions (`.github/workflows/ci.yml` — lint + build, no auto-deploy)
- **Observability:** partial — Platform-level only (`wrangler.jsonc` observability flag); no app-level logging, error tracking, or metrics

## Foundations

### F-01: Flashcard data schema with RLS

- **Outcome:** (foundation) Supabase migration pipeline set up; flashcards table with per-user Row Level Security policies landed.
- **Change ID:** flashcard-schema
- **PRD refs:** Access Control (flat user model — each user manages only their own private flashcards)
- **Unlocks:** S-01, S-02, S-03
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** If the base schema is wrong, every downstream slice needs migration fixes. Sequenced first to catch data-model issues early; scope is intentionally minimal (flashcard columns only — scheduling metadata is added by S-02 when needed).
- **Status:** done

## Slices

### S-01: AI flashcard generation and candidate review ★

- **Outcome:** user can paste study text, trigger AI generation, review candidates (accept/edit/reject), and save accepted cards to their deck.
- **Change ID:** ai-card-generation
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004
- **Prerequisites:** F-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** LLM integration quality directly determines both primary KPIs (≥75% acceptance, ≥75% AI preference). The NFR requiring study text to leave no trace in operator-accessible storage after generation constrains the implementation. Auth (FR-001, FR-002) is already baseline-present and not re-implemented here. Sequenced as the north star — without this flow, there is nothing to measure.
- **Status:** in-progress

### S-02: Spaced repetition study session

- **Outcome:** user can start a spaced repetition study session using an open-source scheduling algorithm; cards recalled easily appear later, cards recalled with difficulty appear sooner.
- **Change ID:** spaced-repetition-session
- **PRD refs:** FR-007
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Integrating an SR algorithm (SM-2/FSRS) is low-risk technically (mature libraries exist), but the review-loop UI must be reliable — the guardrail KPI ("Study Session Reliability") gates launch. Scheduling metadata extends the base schema from F-01. Sequenced after S-01 in the speed bias because study sessions require cards in the deck to be meaningful.
- **Status:** ready

### S-03: Manual card creation and flashcard management

- **Outcome:** user can manually create a flashcard (front + back) and view, edit, and delete their saved flashcards.
- **Change ID:** card-management
- **PRD refs:** FR-005, FR-006
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low implementation risk (standard CRUD). Manual creation is the safety valve for AI generation failures. Sequenced last because it is off the critical retention loop (generate → study) and does not block other slices.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | flashcard-schema | Set up Supabase migrations and flashcards table with RLS | done | — |
| S-01 | ai-card-generation | AI flashcard generation from pasted text with candidate review | done | North star; plan reviewed, run `/10x-implement ai-card-generation phase 1` |
| S-02 | spaced-repetition-session | Spaced repetition study session with SR algorithm | yes | Sequence after S-01 |
| S-03 | card-management | Manual card creation and flashcard CRUD | yes | Parallel with S-01 |

## Open Roadmap Questions

_None — all product-level decisions were locked during shaping (PRD §Open Questions is empty)._

## Parked

- **File import (PDF, DOCX, URL)** — Why parked: PRD §Non-Goals #1. Copy-paste is the only input method for MVP.
- **Deck sharing or collaboration** — Why parked: PRD §Non-Goals #2. Single-tenant, private decks only.
- **Custom spaced repetition algorithm** — Why parked: PRD §Non-Goals #3. Integrate existing open-source implementation without modification.
- **Mobile app or mobile-optimized UI** — Why parked: PRD §Non-Goals #4. Desktop web browsers only for MVP.
- **Offline-first capability** — Why parked: PRD §Non-Goals #5. Internet connection required for all features.
- **OAuth or passwordless auth** — Why parked: PRD §Non-Goals #6. Email + password only for MVP.

## Done

- **F-01: (foundation) Supabase migration pipeline and flashcards table with RLS landed** — Archived 2026-08-23 → `context/archive/2026-08-23-flashcard-schema/`. Lesson: —.
