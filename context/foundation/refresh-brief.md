# Seed Brief (Refresh)

## What is in the guide today
- Strategy (§1-§5) and Phased Rollout (§3) covering:
  - Phase 1: Bootstrap + critical-path unit (completed)
  - Phase 2: Integration — data integrity & error paths (not started)
  - Phase 3: Integration — ownership & auth boundaries (not started)
  - Phase 4: Quality-gates wiring (not started)
- Top Risks: R1 (LLM parse), R2 (Finalize API fail), R3 (Mid-review abandon), R4 (Retry machine unpredictability), R6 (IDOR finalize), R7 (Text leak), R5 (Auth expire).

## What is stale
- Test-base profile: test runner is now bootstrapped (`vitest` is installed and 2 test files exist in `test/`). Profile is now 'sparse' instead of 'none'.
- Phase 1 in §3 is 'complete' and has shipped.

## What is missing / New User Concerns
1. Worries most: Users lose generated flashcards because the finalization/save step silently fails after they spent time reviewing them. (Aligns with R2)
2. Burned before: The retry state machine acting unpredictably (e.g., retries failing instantly or timing out too early) when the AI API struggles. (Aligns with R4)
3. Change without confidence: The React hooks managing complex state and retries (e.g., useFlashcardGeneration.ts, useCardManager.ts).
4. Under-tested today: The API integration points (e.g., error handling when saving/finalizing flashcards). (Aligns with R2/Phase 2)
5. Do NOT spend on: Visual rendering/look-and-feel, the /stats page, and the third-party spaced repetition algorithm. (Matches §7 exclusions)

**Explicit User Direction for Refresh:**
- Elevate Phase 2 / R2 (Finalization failure / error path) to an **e2e test**. The user considers this an absolute critical path and requires full-stack confidence over the standard integration layer. This explicit direction supersedes the previous "cheapest layer" guidance for R2.

Hot-spots (last 30d):
- `src/components/hooks` (10 commits), `src/pages/api/flashcards` (8 commits)
- `src/lib/services/ai-generation.ts`, `src/components/hooks/useFlashcardGeneration.ts`, `src/pages/api/flashcards/generate.ts`

The rollout should continue with Phase 2. The downstream plan must update §2 and §3 to reflect the e2e elevation for R2 and establish the e2e layer.

After creating the folder, suggest the next natural command to research and plan the test plan updates.
