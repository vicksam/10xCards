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

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
