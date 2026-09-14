# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-14

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` — 23 commits/30 days across hand-written application code.

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                                                                                                                                                                                                           | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | LLM response is malformed, null, fenced-JSON, or contains over-limit cards — parsing fails silently or throws uncaught, breaking the north-star generation flow                                                                                                                                                                                                                                                   | High   | High       | PRD US-01 / S-01 archive risk note / interview Q1 #1 (most important) + Q2 / hot-spot dir `src/lib/services` (4 commits/30d)                                                                                                                                   |
| R2  | User finalizes a generation session; the finalize RPC fails (network, RLS, already-finalized path) — cards are lost and no error is shown to the user                                                                                                                                                                                                                                                             | High   | Medium     | PRD FR-004 / S-01 archive / interview Q1 #2 + Q3 / hot-spot dir `src/pages/api/flashcards` (8 commits/30d)                                                                                                                                                     |
| R3  | User abandons mid-review (tab close, navigation away) — the generation review row is never finalized and never cleaned up; cancel only covers the loading phase, not the review phase                                                                                                                                                                                                                             | Medium | High       | S-04 archive (cancel covers loading only, not review-phase abandonment) / interview Q1 #2 + Q3 / hot-spot dir `src/components/hooks` (9 commits/30d)                                                                                                           |
| R4  | Retry state machine applies the wrong timeout tier or short-circuits incorrectly — two observed modes: (A) auto-retry sequence reports failure for ~75s but request actually resolves within ~12s (timeout tier not applied / premature-failure signal); (B) manual 60s retry returns error immediately without waiting (retry logic bypassed entirely) — unpredictable: can silently over-retry or silently skip | Medium | High       | interview Q2 (direct burn — all 3 tiers exhausted on real requests) / user observation 2026-09-10 (Mode A: resolves ~12s despite 30s→45s tiers; Mode B: 60s manual retry fails instantly) / S-04 archive / hot-spot dir `src/components/hooks` (9 commits/30d) |
| R6  | User B submits User A's generation ID to finalize or delete — the security-definer finalize RPC bypasses row-level security; ownership check lives inside the function body and is unverified end-to-end                                                                                                                                                                                                          | High   | Low        | PRD Access Control (flat model, each user owns only their own data) / S-01 archive (security-definer function with fixed search_path) / S-04 archive (DELETE endpoint)                                                                                         |
| R7  | Study text appears in an error response body or logged output on the generation error path — the text-privacy NFR is violated even though the success path is clean                                                                                                                                                                                                                                               | High   | Low        | PRD NFR (study text leaves no trace after request completes) / S-01 archive (NFR comment in service)                                                                                                                                                           |
| R5  | Auth cookie expires during a study session — client-side Supabase calls silently fail or show a generic error with no clear auth-expired message                                                                                                                                                                                                                                                                  | Medium | Low        | PRD FR-002 (7-day session, extended on use) / interview Q1 #3                                                                                                                                                                                                  |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Must challenge                                                                                                                                                                                                                                            | Context `/10x-research` must ground                                                                                                                                                                                | Likely cheapest layer                                                                                          | Anti-pattern to avoid                                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | Given known-bad payloads (null content, bare array, fenced JSON, >15 cards, over-limit front/back), the service returns a clean candidate list or throws a typed error — never a silent empty result from valid content                                                                                                                                                                                                                                                                                                                                                                               | "The code has branches for each case" — verify each branch with real fixture payloads, not just the happy-path JSON                                                                                                                                       | Exact parsing branches and the error-throw vs. empty-return decision; what happens when JSON.parse fails                                                                                                           | Unit (pure function, no network)                                                                               | Testing only the happy-path JSON; asserting output matches the implementation's output instead of the PRD's contract                                                                              |
| R2   | When the finalize RPC fails, the UI shows a visible error with retry and discard options — the user is never left with accepted cards silently lost                                                                                                                                                                                                                                                                                                                                                                                                                                                   | "The error state is set so it works" — simulate RPC failure and verify the UI transition, not just the state variable                                                                                                                                     | How the review hook handles save errors; what UI elements appear on error; whether retry reinvokes the same call                                                                                                   | e2e (Playwright) — elevated from integration per explicit user direction (critical-path full-stack confidence) | Asserting the error state variable is set without verifying the rendered error message and retry option appear                                                                                    |
| R3   | KPI queries exclude unfinalized rows from acceptance-rate denominators — orphaned rows do not corrupt stats over time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | "Cancel button covers cleanup" — S-04 cancel only fires during loading, not review-phase abandonment                                                                                                                                                      | Lifecycle of unfinalized rows; whether KPI queries filter on finalized_at; whether any cleanup path exists for review-phase abandonment                                                                            | Integration for KPI exclusion check; research must determine if review-phase abandon has any cleanup           | Testing only the cancel-during-loading path and assuming it covers tab-close during review                                                                                                        |
| R4   | Three distinct behaviors must be verifiable: (1) on a 408/429/5xx on attempt 1, retry fires with the 45s timeout and actually waits that long before resolving; (2) a 4xx fails immediately without retry; (3) a manual retry uses the 60s timeout and waits — it does not return an error immediately. Mode A (resolves in ~12s during the 30s→45s window) means the timeout tier is not being applied or a premature-success/failure signal is leaking. Mode B (instant failure on 60s manual retry) means the retry path is short-circuiting. Both must be exposed by controlled timing assertions | "The code says it retries so it does" — Q2 burn + 2026-09-10 observation shows the state machine is unpredictable in both directions (too fast AND immediate fail); verify the actual elapsed time and status per attempt, not just that fetch was called | How AbortController is instantiated per attempt vs. shared; what triggers Mode A early resolution; what causes Mode B immediate failure on the 60s path; whether a stale cancelled signal is reused across retries | Unit (mock fetch, control response codes, mock timers to assert elapsed per attempt)                           | Asserting fetch was called twice without verifying the correct timeout duration elapsed each time; testing only the happy-path retry without covering the 60s manual-retry immediate-failure path |
| R6   | User B cannot finalize or delete User A's generation ID, even with a valid UUID — the call returns an error or affects zero rows                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | "RLS protects this" — the finalize function is security-definer and bypasses RLS; the ownership check is inside the function body and must be verified independently of the policy                                                                        | Exact ownership predicate inside the finalize function; whether the DELETE endpoint adds its own user_id filter beyond RLS                                                                                         | Integration (two test users, cross-ownership call, verify rejection)                                           | Testing only that the RLS policy exists, not that a cross-user call is actually blocked end-to-end                                                                                                |
| R7   | Known study text does not appear in the response body, any logged output, or DB state after a failed generation request                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | "There's a comment in the code so it's safe" — error catch blocks could accidentally echo the request body                                                                                                                                                | What gets logged in the generate route's catch blocks; what the 400/500 response bodies contain; whether any DB write includes a text field                                                                        | Integration (call generate endpoint, inspect error response + DB state)                                        | Checking only the success path; skipping error paths where text might be echoed                                                                                                                   |
| R5   | When the session cookie expires during a study session, the component shows a clear auth-expired message rather than silent failure or a generic error                                                                                                                                                                                                                                                                                                                                                                                                                                                | "Middleware protects the route" — middleware runs on page load, not on every client-side Supabase call during a session                                                                                                                                   | How the study session component makes Supabase calls (direct vs. API route); whether the client detects a 401 and shows a specific message                                                                         | Integration (simulate expired session, verify error state)                                                     | Testing only the happy session path; assuming middleware coverage implies all in-session Supabase calls are safe                                                                                  |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                 | Goal (one line)                                                                                           | Risks covered | Test types                                              | Status        | Change folder                          |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------- | ------------- | -------------------------------------- |
| 1   | Bootstrap + critical-path unit             | Install vitest and cover LLM parsing and retry state machine — highest signal at zero infrastructure cost | R1, R4        | unit                                                    | complete      | testing-bootstrap-critical-path        |
| 2   | e2e — critical path finalization           | Cover finalization failure surfacing with full-stack confidence                                           | R2            | e2e (Playwright)                                        | complete      | testing-e2e-critical-path-finalization |
| 3   | Integration — data integrity & error paths | Cover orphaned-row KPI impact and text leakage on error paths                                             | R3, R7        | integration (mocked Supabase + API)                     | complete      | testing-integration-data-integrity     |
| 4   | Integration — ownership & auth boundaries  | Cover IDOR on generation review and auth-expiry surfacing during study                                    | R5, R6        | integration (two test users, simulated expired session) | complete      | testing-integration-ownership-auth     |
| 5   | Quality-gates wiring                       | Add `npm test` script; lock vitest + lint + typecheck in CI                                               | — (floor)     | gate config                                             | complete      | testing-quality-gates-wiring           |

**Status vocabulary** (fixed — parser literals):

| Value           | Meaning                                                             |
| --------------- | ------------------------------------------------------------------- |
| `not started`   | No change folder for this rollout phase yet.                        |
| `change opened` | `context/changes/<id>/` exists with `change.md`; research not done. |
| `researched`    | `research.md` exists in the change folder.                          |
| `planned`       | `plan.md` exists with a `## Progress` section.                      |
| `implementing`  | Progress section has at least one `[x]` and at least one `[ ]`.     |
| `complete`      | Progress section is fully `[x]`.                                    |

---

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer              | Tool                            | Version       | Notes                                                                                                          |
| ------------------ | ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| unit + integration | Vitest                          | ^4.1.11       | Installed (shipped in Phase 1). Tests in `test/` running with `vitest run`. Compatible with Cloudflare Workers |
| API mocking        | MSW (Mock Service Worker)       | latest stable | Not yet installed. Recommended for mocking fetch at the network edge in hook integration tests                 |
| e2e                | Playwright (`@playwright/test`) | ^1.63.0       | Installed; required for Phase 2 e2e test covering R2 (finalization failure error path)                         |
| AI-native          | none                            | —             | No AI-native test layer justified under cost × signal for current risk map                                     |

**Stack grounding tools (current session):**

- Docs: Context7 — available; can validate vitest/Astro/Cloudflare Workers testing setup and API; checked: 2026-09-10
- Search: Exa.ai — available; can check current tool ecosystem status and Cloudflare Workers test compatibility; checked: 2026-09-10
- Runtime/browser: no Playwright MCP in session — not available; not used
- Provider/platform: Cloudflare MCP — available (Cloudflare Workers stack); Supabase — no MCP in session; not used for quality-gate purposes in current session

Test runner bootstrapped (`vitest` installed and unit tests present in `test/`; `@playwright/test` installed). Test-base profile: **sparse** (Phase 1 complete).

---

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate                   | Where                                                    | Required?                    | Catches                                                                                         |
| ---------------------- | -------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| lint + typecheck       | local + CI (already wired in `.github/workflows/ci.yml`) | required (already active)    | syntactic / type drift                                                                          |
| unit + integration     | local + CI                                               | required after §3 Phase 1    | logic regressions in parsing, retry, finalization, ownership                                    |
| post-edit hook         | local (agent loop)                                       | recommended after §3 Phase 5 | regressions at edit time                                                                        |
| e2e on critical flows  | CI on PR                                                 | required after §3 Phase 2    | broken critical user paths (R2 finalization failure error path)                                 |
| visual diff / snapshot | CI on PR                                                 | not planned                  | rendering regressions — excluded per §7 (look-and-feel budget exclusion)                        |
| pre-prod smoke         | between merge + prod                                     | optional / manual            | environment-specific failures; currently covered by manual verification steps in archived plans |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test (pure function or hook)

**File location**: `test/` mirroring `src/` hierarchy.
e.g. `src/lib/services/foo.ts` → `test/lib/services/foo.test.ts`

**Environment**:

- Pure functions (no DOM): default `node` pool — no docblock needed.
- React hooks: add `// @vitest-environment jsdom` as first line of the test file.

**Mock patterns established in Phase 1:**

- `astro:env/server`: aliased globally in `vitest.config.ts` → `src/__mocks__/astro-env-server.ts`. No per-test mock needed.
- OpenAI SDK: `vi.mock('openai')` at top of file; configure `chat.completions.create` per test with `vi.mocked(...).mockResolvedValueOnce(...)`.
- `fetch`: `global.fetch = vi.fn()` in `beforeEach`; configure per test with `.mockResolvedValueOnce(new Response(...))`.
- Timers: `vi.useFakeTimers()` / `vi.useRealTimers()` in `beforeEach` / `afterEach`; advance with `await act(() => vi.advanceTimersByTimeAsync(ms))`.

**Oracle rule**: assertion values come from PRD, archived plans, or explicit spec — never from reading the implementation output and asserting it back.

**Fixture convention**: inline fixtures (string literals) for parsing tests; no fixture files needed for Phase 1 scope.

### 6.2 Adding an e2e test (critical path full-stack)

**File location**: `tests/e2e/` (e.g. `tests/e2e/seed.spec.ts`).

**Runner**: Playwright (`@playwright/test`) configured in `playwright.config.ts`.

- Command to run: `npx playwright test tests/e2e/<spec>.spec.ts`

**Auth & Session pattern:**

- Authenticated state is managed via `tests/e2e/auth.setup.ts` producing `playwright/.auth/user.json`.
- The `chromium` project in `playwright.config.ts` depends on `setup` and injects `storageState: "playwright/.auth/user.json"`.

**Mocking boundaries vs Real boundaries:**

- Real: Authentication cookies, SSR page loading, React island hydration, client routing, DOM state transitions.
- Mocked via `page.route()`: External LLM generation endpoints (`POST **/api/flashcards/generate`) to ensure zero token cost and fast deterministic runs; and backend RPC failure simulation (`POST **/api/flashcards`) to verify error recovery without corrupting live DB state.

**Locators & Waiting discipline:**

- Accessibility tree first: `getByRole`, `getByPlaceholder`, `getByText`.
- Wait for state, never for time: `expect(...).toBeVisible()`, `page.waitForResponse(...)`. Strictly no `page.waitForTimeout()`.

### 6.3 Adding an integration test (API route or hook + mocked network)

**File location**: `test/integration/` (e.g. `test/integration/data-integrity.test.ts`).

**Environment**: default `node` pool.

**Mock patterns established in Phase 3:**

- `createClient`: instantiate with mock headers and cookies (`createMockCookies()`).
- Supabase fetch mocking: intercept database queries via `globalThis.fetch = vi.fn().mockResolvedValue(createMockJsonResponse(...))`. Assert URL contains PostgREST filters (e.g. `finalized_at=not.is.null`) to verify filtering at the database edge.
- API route testing: invoke exported HTTP handlers (e.g., `POST(context)`) with a mocked `APIContext` (constructed `Request`, `locals.user`, and `cookies`).
- Text leakage / privacy assertions: spy on `console.error` with `.mockReturnValue()`, simulate upstream errors with known sentinel text, and assert that neither the HTTP response body (`JSON.stringify(body)`) nor any arguments passed to `console.error` contain the sensitive string.

### 6.4 Adding a test for a cross-user ownership boundary

**File location**: `test/integration/` (e.g. `test/integration/ownership-boundary.test.ts`, `test/integration/auth-expiry.test.ts`).

**Environment**:

- API route & database query boundary tests: default `node` pool.
- React hook & component auth expiry tests: `// @vitest-environment jsdom` as first line of the file.

**Mock patterns established in Phase 4:**

- **IDOR / Ownership filtering at database edge**:
  - Mock `APIContext` with caller User B (`context.locals.user = { id: userBId }`).
  - Intercept outbound PostgREST requests by mocking `globalThis.fetch`.
  - Assert that outbound queries append ownership filters (e.g. `user_id=eq.${userBId}`) so attempts to access User A's ID filter down to zero rows at the database edge.
  - Assert early rejection (HTTP 401 Unauthorized or HTTP 400 Bad Request) without touching `globalThis.fetch` when requests lack authentication or pass invalid UUID formats.
- **Security-definer RPC boundary validation**:
  - For endpoints dispatching to security-definer Postgres functions (e.g., `finalize_generation_review`), verify that `supabase.rpc(fn, params)` receives explicit identifiers (`generation_id`, candidate cards) and that error responses from unauthorized or missing reviews (Postgres error `P0001`) correctly map to HTTP 500 without leaking sensitive state.
- **Auth expiry handling during active sessions**:
  - Mock `fetch` returning `401 Unauthorized` responses mid-session (e.g. `/api/study/review`).
  - Verify that the study session hook sets `isAuthExpired: true` alongside `submitError` without discarding in-progress cards or resetting index.
  - Verify that the UI displays an inline "Session Expired" notification with an external link (`/auth/signin`, `target="_blank"`) preserving card state, and clears the alert on successful retry after re-authenticating.

### 6.5 Adding a quality gate to CI

**Workflow location**: `.github/workflows/ci.yml`.

**Gate execution sequence**:
1. `npm run lint` — ESLint static analysis.
2. `npm run typecheck` — `tsc --noEmit` TypeScript typechecking.
3. `npm run test` — Vitest unit & integration test execution (isolated without Supabase secrets to enforce mocking).
4. `npm run build` — Astro build gated by passing tests (with repository `SUPABASE_URL` and `SUPABASE_KEY` secrets).
5. `npx playwright install --with-deps` & `npx playwright test` — Playwright browser tests (with repository secrets).

### 6.6 Per-rollout-phase notes

(Filled in after each phase ships — surprises, fixture locations, naming conventions discovered during implementation.)

---

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Look and feel / visual rendering** — CSS, Tailwind class correctness, component appearance. Re-evaluate if a design system or component library with documented visual contracts is introduced. (Source: interview Q5.)
- **`/stats` page** — read-only aggregates; no write path, no ownership boundary, no external call. Low blast radius. Re-evaluate if the page gains write operations or user-visible KPI calculations with business consequences. (Source: interview Q5.)
- **Scaffold-cleanup slice (S-05)** — purely cosmetic and config changes with no logic. No test value. (Source: roadmap S-05 risk note.)
- **Third-party spaced repetition algorithm output** — PRD non-goal #3 locks integration of an existing open-source implementation without modification; the algorithm is not authored here and is not a test target. (Source: PRD §Non-Goals #3.)

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-11 (R2 elevated to e2e Playwright per explicit user direction; Phase 1 complete; test-base profile updated to sparse)
- Stack versions last verified: 2026-09-11
- AI-native tool references last verified: 2026-09-11 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
