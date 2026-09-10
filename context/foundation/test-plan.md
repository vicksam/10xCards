# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-10

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
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` — 23 commits/30 days across hand-written application code.

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| R1 | LLM response is malformed, null, fenced-JSON, or contains over-limit cards — parsing fails silently or throws uncaught, breaking the north-star generation flow | High | High | PRD US-01 / S-01 archive risk note / interview Q1 #1 (most important) + Q2 / hot-spot dir `src/lib/services` (4 commits/30d) |
| R2 | User finalizes a generation session; the finalize RPC fails (network, RLS, already-finalized path) — cards are lost and no error is shown to the user | High | Medium | PRD FR-004 / S-01 archive / interview Q1 #2 + Q3 / hot-spot dir `src/pages/api/flashcards` (8 commits/30d) |
| R3 | User abandons mid-review (tab close, navigation away) — the generation review row is never finalized and never cleaned up; cancel only covers the loading phase, not the review phase | Medium | High | S-04 archive (cancel covers loading only, not review-phase abandonment) / interview Q1 #2 + Q3 / hot-spot dir `src/components/hooks` (9 commits/30d) |
| R4 | Retry state machine applies the wrong timeout tier or fires with an already-cancelled signal — user sees failure on a request that would have succeeded, or the retry silently skips | Medium | High | interview Q2 (direct burn — saw all 3 tiers exhaust on real requests) / S-04 archive / hot-spot dir `src/components/hooks` (9 commits/30d) |
| R6 | User B submits User A's generation ID to finalize or delete — the security-definer finalize RPC bypasses row-level security; ownership check lives inside the function body and is unverified end-to-end | High | Low | PRD Access Control (flat model, each user owns only their own data) / S-01 archive (security-definer function with fixed search_path) / S-04 archive (DELETE endpoint) |
| R7 | Study text appears in an error response body or logged output on the generation error path — the text-privacy NFR is violated even though the success path is clean | High | Low | PRD NFR (study text leaves no trace after request completes) / S-01 archive (NFR comment in service) |
| R5 | Auth cookie expires during a study session — client-side Supabase calls silently fail or show a generic error with no clear auth-expired message | Medium | Low | PRD FR-002 (7-day session, extended on use) / interview Q1 #3 |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| R1 | Given known-bad payloads (null content, bare array, fenced JSON, >15 cards, over-limit front/back), the service returns a clean candidate list or throws a typed error — never a silent empty result from valid content | "The code has branches for each case" — verify each branch with real fixture payloads, not just the happy-path JSON | Exact parsing branches and the error-throw vs. empty-return decision; what happens when JSON.parse fails | Unit (pure function, no network) | Testing only the happy-path JSON; asserting output matches the implementation's output instead of the PRD's contract |
| R2 | When the finalize RPC fails, the UI shows a visible error with retry and discard options — the user is never left with accepted cards silently lost | "The error state is set so it works" — simulate RPC failure and verify the UI transition, not just the state variable | How the review hook handles save errors; what UI elements appear on error; whether retry reinvokes the same call | Integration (hook + mocked API) | Asserting the error state variable is set without verifying the rendered error message and retry option appear |
| R3 | KPI queries exclude unfinalized rows from acceptance-rate denominators — orphaned rows do not corrupt stats over time | "Cancel button covers cleanup" — S-04 cancel only fires during loading, not review-phase abandonment | Lifecycle of unfinalized rows; whether KPI queries filter on finalized_at; whether any cleanup path exists for review-phase abandonment | Integration for KPI exclusion check; research must determine if review-phase abandon has any cleanup | Testing only the cancel-during-loading path and assuming it covers tab-close during review |
| R4 | On a 408/429/5xx on attempt 1, the hook retries with the 45s timeout; a 4xx fails immediately without retry; a manual retry uses the 60s timeout; no shared AbortController cancels the retry prematurely | "The code says it retries so it does" — Q2 burn shows real edge cases exist; verify the actual timeout value applied per attempt, not just that fetch was called twice | How AbortController is instantiated per attempt vs. shared; retry trigger conditions; how lastAttemptTimeout tracks state | Unit (mock fetch, control response codes and timing) | Asserting fetch was called twice without verifying the correct timeout was applied each time |
| R6 | User B cannot finalize or delete User A's generation ID, even with a valid UUID — the call returns an error or affects zero rows | "RLS protects this" — the finalize function is security-definer and bypasses RLS; the ownership check is inside the function body and must be verified independently of the policy | Exact ownership predicate inside the finalize function; whether the DELETE endpoint adds its own user_id filter beyond RLS | Integration (two test users, cross-ownership call, verify rejection) | Testing only that the RLS policy exists, not that a cross-user call is actually blocked end-to-end |
| R7 | Known study text does not appear in the response body, any logged output, or DB state after a failed generation request | "There's a comment in the code so it's safe" — error catch blocks could accidentally echo the request body | What gets logged in the generate route's catch blocks; what the 400/500 response bodies contain; whether any DB write includes a text field | Integration (call generate endpoint, inspect error response + DB state) | Checking only the success path; skipping error paths where text might be echoed |
| R5 | When the session cookie expires during a study session, the component shows a clear auth-expired message rather than silent failure or a generic error | "Middleware protects the route" — middleware runs on page load, not on every client-side Supabase call during a session | How the study session component makes Supabase calls (direct vs. API route); whether the client detects a 401 and shows a specific message | Integration (simulate expired session, verify error state) | Testing only the happy session path; assuming middleware coverage implies all in-session Supabase calls are safe |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bootstrap + critical-path unit | Install vitest and cover LLM parsing and retry state machine — highest signal at zero infrastructure cost | R1, R4 | unit | change opened | testing-bootstrap-critical-path |
| 2 | Integration — data integrity & error paths | Cover finalization failure surfacing, orphaned-row KPI impact, and text leakage on error paths | R2, R3, R7 | integration (mocked Supabase + API) | not started | — |
| 3 | Integration — ownership & auth boundaries | Cover IDOR on generation review and auth-expiry surfacing during study | R5, R6 | integration (two test users, simulated expired session) | not started | — |
| 4 | Quality-gates wiring | Add `npm test` script; lock vitest + lint + typecheck in CI | — (floor) | gate config | not started | — |

**Status vocabulary** (fixed — parser literals):

| Value | Meaning |
|---|---|
| `not started` | No change folder for this rollout phase yet. |
| `change opened` | `context/changes/<id>/` exists with `change.md`; research not done. |
| `researched` | `research.md` exists in the change folder. |
| `planned` | `plan.md` exists with a `## Progress` section. |
| `implementing` | Progress section has at least one `[x]` and at least one `[ ]`. |
| `complete` | Progress section is fully `[x]`. |

---

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Vitest | latest stable | Not yet installed — see §3 Phase 1. Compatible with Cloudflare Workers via `@cloudflare/vitest-pool-workers` or standard jsdom/node pool for pure-function and hook tests |
| API mocking | MSW (Mock Service Worker) | latest stable | Not yet installed — see §3 Phase 2. Recommended for mocking fetch at the network edge in hook integration tests |
| e2e | none yet | — | No e2e tooling planned in current rollout; Cloudflare Workers e2e complexity is high relative to signal for these risks |
| AI-native | none | — | No AI-native test layer justified under cost × signal for current risk map |

**Stack grounding tools (current session):**
- Docs: Context7 — available; can validate vitest/Astro/Cloudflare Workers testing setup and API; checked: 2026-09-10
- Search: Exa.ai — available; can check current tool ecosystem status and Cloudflare Workers test compatibility; checked: 2026-09-10
- Runtime/browser: no Playwright MCP in session — not available; not used
- Provider/platform: Cloudflare MCP — available (Cloudflare Workers stack); Supabase — no MCP in session; not used for quality-gate purposes in current session

No test runner config exists in the project today (`package.json` has no `test` script; no `vitest.config.*`, `jest.config.*`, or `playwright.config.*` found). Test-base profile: **none** — Phase 1 bootstraps the runner.

---

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local + CI (already wired in `.github/workflows/ci.yml`) | required (already active) | syntactic / type drift |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions in parsing, retry, finalization, ownership |
| post-edit hook | local (agent loop) | recommended after §3 Phase 4 | regressions at edit time |
| e2e on critical flows | CI on PR | not planned for current rollout | broken critical user paths — deferred; integration layer covers the critical risk surface |
| visual diff / snapshot | CI on PR | not planned | rendering regressions — excluded per §7 (look-and-feel budget exclusion) |
| pre-prod smoke | between merge + prod | optional / manual | environment-specific failures; currently covered by manual verification steps in archived plans |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test (pure function or hook)

TBD — see §3 Phase 1 for the LLM parsing and retry state machine unit test patterns.

### 6.2 Adding an integration test (API route or hook + mocked network)

TBD — see §3 Phase 2 for the finalization error path and KPI exclusion integration test patterns.

### 6.3 Adding a test for a cross-user ownership boundary

TBD — see §3 Phase 3 for the IDOR / security-definer RPC integration test pattern.

### 6.4 Adding a quality gate to CI

TBD — see §3 Phase 4 for the `npm test` script and CI wiring pattern.

### 6.5 Per-rollout-phase notes

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

- Strategy (§1–§5) last reviewed: 2026-09-10
- Stack versions last verified: 2026-09-10
- AI-native tool references last verified: 2026-09-10 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
