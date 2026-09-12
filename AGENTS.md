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

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
