---
project: 10xCards
researched_at: 2026-08-08
recommended_platform: Cloudflare Workers + Pages
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6
  runtime: Cloudflare Workers (V8 isolate with nodejs_compat)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

Cloudflare is the natural fit for this Astro 6 SSR app: the project already uses the `@astrojs/cloudflare` adapter (v13.5), `wrangler` (v4.90), and has a working `wrangler.jsonc` configured for Workers deployment. The free tier provides 100K requests/day (~3M/month) — far beyond MVP needs — making it the cheapest viable option. The developer has existing Cloudflare familiarity (interview Q3), and the platform scores Pass on all five agent-friendly criteria. External services (Supabase + OpenRouter) connect via standard `fetch()`, which Workers supports natively.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers + Pages** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **5/5** |
| **Netlify** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **5/5** |
| **Vercel** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟡 Partial | **4.5/5** |
| **Fly.io** | ✅ Pass | 🟡 Partial | ✅ Pass | ✅ Pass | 🟡 Partial | **3.5/5** |
| **Railway** | ✅ Pass | 🟡 Partial | ✅ Pass | ✅ Pass | 🟡 Partial | **3.5/5** |
| **Render** | 🟡 Partial | 🟡 Partial | ✅ Pass | 🟡 Partial | ✅ Pass | **3/5** |

**Scoring notes:**

- **Cloudflare**: `wrangler` CLI covers the full operational loop (deploy, rollback, tail, secrets). V8 isolate runtime is fully managed — no containers, no Dockerfiles. Docs available via `llms.txt` and GitHub markdown. `wrangler deploy` is deterministic with structured output. Multiple MCP servers available (docs, Workers, observability). All features GA.
- **Netlify**: Strong across the board with a mature MCP server (GA). However, the free tier uses a credit-based system (300 credits/month) that can silently suspend sites on exhaustion. No CLI rollback command — requires API or dashboard. Commercial MVP would likely need the $20/month Pro plan.
- **Vercel**: Excellent DX and Astro adapter support. However, the Hobby tier explicitly prohibits commercial use — a commercial MVP requires Pro at $20/month/member. MCP server is in public beta (Aug 2026). Vercel Postgres and KV have been deprecated (June 2025), migrated to marketplace integrations.
- **Fly.io**: Full Node.js runtime in containers — no V8 isolate limitations. However, requires Docker knowledge and Dockerfile authoring. Free tier deprecated (Aug 2026); replaced by a 7-day trial. MCP server is experimental/preview. Cold starts possible with scale-to-zero.
- **Railway**: Good DX with Nixpacks auto-detection. $5/month minimum (Hobby plan). MCP integration via Railway Skills (public beta, Aug 2026). No Astro-specific adapter — deploys as generic Node.js server. Multi-region is beta/region-limited.
- **Render**: Render MCP Server is GA. However, CLI rollback is missing (API-only). Free tier web services spin down after 15 minutes with 30-60s cold starts. Free Postgres auto-deleted after 30 days. Region is immutable after creation.

**Soft-weight adjustments applied:**
- Cost minimization (Q2) → Cloudflare's $0/month free tier is unmatched; penalized Vercel ($20/mo), Fly.io ($5/mo), Railway ($5/mo), Render ($7/mo for non-free)
- Cloudflare familiarity (Q3) → tie-breaker over Netlify (both scored 5/5 on raw criteria)
- Single region (Q4) → edge-native platforms get no bonus; does not penalize single-region platforms
- External providers (Q5) → co-located services not weighted; all platforms pass since Supabase + OpenRouter are external

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Cloudflare wins on three fronts: (1) the project is already configured for it — `@astrojs/cloudflare` adapter, `wrangler.jsonc`, and `nodejs_compat` flag are in place; (2) the free tier (100K req/day) eliminates hosting cost entirely at MVP scale; (3) the developer's existing Cloudflare familiarity reduces onboarding friction. The platform scores Pass on all five agent-friendly criteria, with a particularly strong MCP ecosystem (docs search, Workers management, observability — all GA).

#### 2. Netlify

Netlify matches Cloudflare on raw criteria scoring (5/5) and has the most mature MCP server in the ecosystem (GA). Its first-party Astro adapter works well. The gap: the credit-based free tier is less generous and less transparent than Cloudflare's, and a commercial MVP may need the $20/month Pro plan. No developer familiarity advantage. Rollback requires API calls rather than a single CLI command.

#### 3. Vercel

Vercel offers excellent DX with instant rollbacks (`vercel rollback`) and strong Astro support. The critical gap: the Hobby tier prohibits commercial use, forcing a $20/month/member Pro plan for any production MVP. Vercel Postgres and KV have been deprecated and replaced by marketplace integrations, adding complexity. MCP server is in public beta.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **V8 isolate ≠ Node.js**: Workers runtime uses a V8 isolate with `nodejs_compat`, not actual Node.js. Any npm package relying on native bindings (e.g., `bcrypt`, `sharp`, `canvas`) will fail. Supabase and OpenRouter use `fetch()` (safe), but future dependencies may not.
2. **Memory and CPU limits**: Free plan caps at 128MB memory and 10ms CPU time per invocation. While network I/O wait (Supabase/OpenRouter calls) doesn't count toward CPU, heavy prompt assembly or response parsing for AI generation could approach limits on large inputs.
3. **Debugging opacity**: `wrangler dev` runs a local `workerd` runtime that doesn't perfectly match production. Subtle differences in crypto APIs, fetch behavior, and environment variable resolution can cause "works locally, fails in production" bugs.
4. **Pages Functions routing edge cases**: The `@astrojs/cloudflare` adapter abstracts Pages Functions routing, but community reports exist around middleware ordering and redirect chain edge cases in Astro 6.
5. **Vendor lock-in through runtime**: Code using Workers-specific APIs (`env` bindings, `ctx.waitUntil()`, KV/D1/R2 bindings) doesn't port to other platforms without rewriting the platform integration layer.

### Pre-Mortem — How This Could Fail

The team deployed 10xCards on Cloudflare Pages in August 2026. Initial deployment was smooth — `wrangler pages deploy` worked on the first try, the free tier covered all traffic, and edge latency was excellent.

Three months in, they needed to add PDF export for flashcard decks. The PDF library required native Node.js APIs (`fs`, `child_process`) unavailable in the V8 isolate. Three alternative libraries all relied on Node.js internals. They ended up running a separate microservice on Railway for PDF generation, splitting their architecture across two platforms and doubling operational complexity.

Meanwhile, the `@astrojs/cloudflare` adapter v13 lagged behind Astro's point releases. After upgrading to Astro 6.4, the adapter broke middleware handling. The fix took two weeks to land, during which they pinned the old version and skipped a security patch. The AI generation endpoint also hit the 10ms CPU limit during a spike — the OpenRouter response parsing for 50-card batches consumed more CPU than expected.

By month six, what started as a clean single-platform deployment had become a two-platform hybrid with an outdated framework version, and the team spent more time on infrastructure workarounds than product features.

### Unknown Unknowns

- **Supabase client cookie handling in V8 isolate**: `@supabase/ssr` cookie operations may behave subtly differently from Node.js in Workers' V8 runtime. Silent auth session issues could manifest only under specific browser/cookie configurations — hard to reproduce in development.
- **OpenRouter streaming behavior**: Workers' `ReadableStream` implementation has differences from Node.js streams. If using streaming responses for AI generation progress, `TransformStream` error handling and backpressure may behave unexpectedly.
- **Build size limit**: Workers have a 10MB compressed script size limit. An Astro SSR build with React 19, Tailwind v4, and multiple routes can approach this — tree-shaking gaps in the adapter cause unexpected bloat.
- **No graceful shutdown on deploy**: Workers are terminated instantly when a new version deploys. Any in-flight OpenRouter request (10-30 seconds for AI generation) will be killed without cleanup. There's no `SIGTERM` equivalent.
- **Wrangler version churn**: `wrangler` CLI has shipped breaking changes between minor versions. CI pipelines using `npx wrangler@latest` can break when a new version changes flags or defaults. Pin the version in `package.json` (already done: `^4.90.0`).

## Operational Story

- **Preview deploys**: Cloudflare Pages creates a preview URL for every non-production branch push (`<branch>.<project>.pages.dev`). These are publicly accessible by default — add Cloudflare Access policies if the app contains sensitive data in preview. Fork PRs do not get preview deployments by default (requires explicit configuration).
- **Secrets**: Environment variables are set via `wrangler pages secret put <KEY>` for production, or in `.dev.vars` locally (gitignored). Secrets are encrypted at rest and scoped per project. Rotation: delete and re-add via CLI. GitHub Actions CI uses repository secrets (`SUPABASE_URL`, `SUPABASE_KEY`) for the build step.
- **Rollback**: `wrangler pages deployment rollback <deployment-id>` reverts to a previous deployment. Typical time-to-revert: < 30 seconds (edge propagation). Caveat: rollback only reverts application code — database migrations applied via Supabase do not roll back automatically.
- **Approval**: Human-required actions: publish to production (first time), rotate Supabase/OpenRouter secrets, delete the Pages project, modify billing. Agent-safe actions: deploy to preview, tail logs, read deployment list, read environment variable names (not values).
- **Logs**: `wrangler pages deployment tail <deployment-id>` for real-time log streaming. `wrangler pages deployment list` to find deployment IDs. Cloudflare dashboard provides historical logs via Workers Observability (enabled in `wrangler.jsonc`).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Native Node.js binding dependency breaks on V8 isolate | Devil's advocate | M | H | Audit all npm dependencies for native bindings before adding. Use WASM alternatives (e.g., `@aspect-build/image` instead of `sharp`). |
| CPU limit exceeded on AI response parsing | Devil's advocate | L | M | Monitor CPU usage via Workers Analytics. Paid plan raises limit to 50ms. Offload heavy parsing to client-side if needed. |
| `@astrojs/cloudflare` adapter lags behind Astro releases | Pre-mortem | M | M | Pin adapter version. Test upgrades in preview before production. Follow adapter repo releases. |
| Supabase SSR cookie handling differs in V8 | Unknown unknowns | L | H | Integration test auth flows on deployed preview (not just local `wrangler dev`). Monitor for session-related bug reports. |
| In-flight OpenRouter requests killed on deploy | Unknown unknowns | M | L | Deploy during low-traffic windows. Consider retry logic on client side for AI generation requests. |
| Build size approaches 10MB limit | Unknown unknowns | L | M | Monitor bundle size in CI. Use dynamic imports for heavy server-only code. Review Astro's `serverMinify` option. |
| Wrangler CLI breaking changes | Unknown unknowns | L | L | Pin wrangler version in `package.json` (already at `^4.90.0`). Use exact versions in CI (`npm ci`). |
| Preview deploys publicly accessible | Research finding | M | L | Add Cloudflare Access policy for preview environments if app contains user data. |

## Getting Started

The project is already configured for Cloudflare deployment. These steps cover first-time production deployment:

1. **Authenticate wrangler** (if not already):
   ```bash
   npx wrangler login
   ```

2. **Set production secrets** (Supabase and OpenRouter credentials):
   ```bash
   npx wrangler pages secret put SUPABASE_URL
   npx wrangler pages secret put SUPABASE_KEY
   ```

3. **Deploy to production**:
   ```bash
   npm run build && npx wrangler pages deploy ./dist
   ```
   The first deploy will create the Pages project. Subsequent deploys update it.

4. **Verify the deployment**:
   ```bash
   npx wrangler pages deployment list
   npx wrangler pages deployment tail <deployment-id>
   ```

5. **Connect GitHub for auto-deploy** (optional): Link the repository in the Cloudflare dashboard under Pages → Settings → Builds & deployments. This enables automatic preview deploys on PRs and production deploys on merge to `master`.

> **Note on local development**: `npm run dev` (Astro's dev server with the Cloudflare adapter) already runs via `wrangler`'s local `workerd` runtime, providing near-production fidelity. There is no need for a separate `wrangler dev` command — the Astro dev server handles this through the `@astrojs/cloudflare` adapter.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
