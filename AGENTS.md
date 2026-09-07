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

## 10xDevs AI Toolkit - Module 2, Lesson 5

Scale the single-change cycle into parallel work with **worktrees, goal-directed delegation, and multi-session orchestration**:

```
worktree per change -> /goal or your AI coding assistant -p -> PR -> review -> merge
```

The lesson focus is safe throughput: isolated contexts, choosing the right execution mode, and capping parallelism at review capacity.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code isolation** | |
| `git worktree add` | You need a separate working directory for a parallel change. One change per worktree, one fresh agent context per worktree. |
| **Complex changes** | |
| `/10x-implement <change-id> phase <n>` | The change has multiple phases, needs manual gates, or benefits from interactive decision-making during execution. |
| **Simple changes** | |
| `/goal` | You have a clear, bounded task and want goal-directed delegation. The agent works autonomously toward the stated goal with a stop condition. |
| `your AI coding assistant -p` | You want headless execution for a well-defined task. The Ralph Wiggum loop (run, check, retry) is the universal autonomous pattern. |
| **Multi-session orchestration** | |
| Superset / Conductor / Antigravity / VS Code Agent View | You are running multiple agent sessions in parallel and need visibility, coordination, or session management across them. |

### Parallel work rules

- One change per worktree or isolated workspace. One fresh agent context per change.
- Choose interactive `/10x-implement` for complex changes, `/goal` or `your AI coding assistant -p` for simple ones.
- Parallelism is capped by review capacity. More agents without review means more unreviewed code, not higher throughput.
- The quality pain from faster shipping is intentional — it bridges into Module 3 testing gates.

### Lesson boundaries

- Do not reteach interactive `/10x-implement` or `/10x-impl-review`; those are Lessons 2 and 3.
- Do not introduce testing strategy here. The quality pain is the motivation for Module 3.
- Worktrees are a mechanism for isolation, not the topic of a full git tutorial.

### Paths used by this lesson

- `context/changes/<change-id>/` - active change folder
- `context/changes/<change-id>/plan.md` - implementation input for any execution mode

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
