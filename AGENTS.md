# Repository Guidelines

This is the repository for 10xCards, an Astro 6 SSR application utilizing React 19, Tailwind CSS v4, and Supabase. It is configured for deployment to Cloudflare Workers.

## Hard Rules & Critical Instructions

- **No "use client"**: Do not include `"use client"` in React components. Extract hooks to `src/components/hooks/`.
- **Astro vs React**: Use Astro components for static content/layout; use React components only when interactivity is needed.
- **Tailwind merging**: Always use the `cn()` helper from `@/lib/utils` for conditional/merged classes; never concatenate class strings manually.
- **Supabase RLS**: All new Supabase tables in `supabase/migrations/` must have Row Level Security (RLS) enabled with explicit per-operation policies.
- **Migration naming**: Use format `YYYYMMDDHHmmss_short_description.sql` in `supabase/migrations/`.
- **Secret variables**: Do not commit secrets. Use `.env` for local Node tasks and `.dev.vars` for Cloudflare local dev.

## Project Structure

- `src/pages/` - Server-rendered routes. API routes go under `src/pages/api/` and must export `const prerender = false`.
- `src/components/` - Astro components (static/layout) and React components (interactive).
- `src/components/ui/` - shadcn/ui components ("new-york" style). Install via `npx shadcn@latest add [name]`.
- `src/components/hooks/` - Place extracted React hooks here.
- `src/lib/` - Shared services and utilities (e.g. `@/lib/supabase.ts`).
- `src/lib/services/` - Place extracted business logic here.
- `src/types.ts` - Place shared TypeScript types (entities, DTOs) here.

## Development & Build Commands

- `npm run dev` - Start the local Astro dev server (Cloudflare workerd runtime).
- `npm run build` - Build the production bundle. Requires `SUPABASE_URL` and `SUPABASE_KEY` env vars.
- `npm run preview` - Preview the production build.
- `npm run lint` / `npm run lint:fix` - Run ESLint checks or automatically fix lint issues.
- `npm run format` - Format code with Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss).

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` (rules in `@.prettierrc.json`) on `*.{json,css,md}`.

## Coding Style & Conventions

- **Path Alias**: Import using the `@/*` alias pointing to `src/*` (see `@tsconfig.json`).
- **API Methods**: Export uppercase functions (e.g., `GET`, `POST`) from API endpoints; validate inputs using Zod.

## Architecture

Full server-side rendering (`output: "server"` in `@astro.config.mjs`). All pages are server-rendered by default.

### Auth flow

- `src/lib/supabase.ts` — Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in `astro.config.mjs` `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

## Environment

- Node.js v22.14.0 (see `.nvmrc`).
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev).
- Local Supabase: `npx supabase start` (requires Docker).
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored).
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth).

## Commit & PR Guidelines

- **Commits**: Follow Conventional Commits format (e.g. `feat: add card handler`, `fix: auth redirect`).
- **CI Pipeline**: All PRs to `master` trigger `.github/workflows/ci.yml` running linting and building. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
