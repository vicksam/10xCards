# SR Algorithm Libraries — S-02 Research

> Scope: S-02 (`spaced-repetition-session`) — open-source scheduling library compatible with **Astro 6 + Cloudflare Workers + TypeScript + npm**.
>
> Stack constraints: Cloudflare Workers (edge runtime), TypeScript end-to-end, ESM-friendly, zero native modules.

---

## Quick verdict

| Rank | Package | Algorithm | Pick for |
|------|---------|-----------|----------|
| ⭐ **1** | [`ts-fsrs`](https://www.npmjs.com/package/ts-fsrs) | FSRS v6 | Best recall accuracy, most active, 114k weekly DLs |
| **2** | [`supermemo`](https://www.npmjs.com/package/supermemo) | SM-2 | Simplest schema, proven, 1.8k weekly DLs |
| **3** | [`@open-spaced-repetition/sm-2`](https://www.npmjs.com/package/@open-spaced-repetition/sm-2) | SM-2 | Same org as ts-fsrs, newly released (Aug 2025) |

---

## Candidates

### 1. `ts-fsrs` ⭐ Recommended
**Algorithm:** FSRS v6 (Free Spaced Repetition Scheduler)

```bash
npm install ts-fsrs
```

| Property | Value |
|---|---|
| Version | 5.4.1 |
| Weekly downloads | **114,027** |
| License | MIT |
| TypeScript | First-class (written in TS) |
| Zero deps | ✅ (current version) |
| ESM + CJS | ✅ |
| Cloudflare Workers | ✅ (pure math, no Node I/O) |
| GitHub stars | ~750 |
| Last update | May 2026 |

**Usage:**
```ts
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';

const scheduler = fsrs();
const card = createEmptyCard();
const result = scheduler.next(card, new Date(), Rating.Good);
// result.card has: due, stability, difficulty, reps, lapses, state
```

**Why it wins:**
- FSRS significantly outperforms SM-2 on recall accuracy (81% better log-loss on 20M reviews)
- The roadmap explicitly lists `SM-2/FSRS` as candidates — FSRS is the modern choice
- Actively maintained by the `open-spaced-repetition` org (also behind the Anki optimizer)
- Pure TypeScript + ESM — runs cleanly in Cloudflare Workers edge runtime
- Configurable `request_retention`, `maximum_interval`, fuzz jitter

> **Note:** The README says "Node.js >= 20 required" — this refers to the **dev/build** environment, not the runtime. The library is pure math with no Node I/O and runs fine on Cloudflare Workers. (The project uses Node.js 22.14.0 per `.nvmrc`, so dev environment is fine too.)

**Schema impact (extends F-01 flashcards table):**
FSRS needs per-card state columns: `stability FLOAT`, `difficulty FLOAT`, `due TIMESTAMPTZ`, `reps INT`, `lapses INT`, `state TEXT` (New/Learning/Review/Relearning), `last_review TIMESTAMPTZ`.

---

### 2. `supermemo`
**Algorithm:** SM-2 (classic, original SuperMemo algorithm)

```bash
npm install supermemo
```

| Property | Value |
|---|---|
| Version | 2.0.23 |
| Weekly downloads | 1,800 |
| License | MIT |
| TypeScript | ✅ (ships `.d.ts`) |
| Zero deps | ✅ |
| ESM + CJS | ✅ |
| Cloudflare Workers | ✅ |
| GitHub stars | 338 |
| Last update | Mar 2025 |

**Usage:**
```ts
import { supermemo, SuperMemoItem, SuperMemoGrade } from 'supermemo';

const item: SuperMemoItem = { interval: 0, repetition: 0, efactor: 2.5 };
const grade: SuperMemoGrade = 4; // 0–5
const updated = supermemo(item, grade);
// updated: { interval, repetition, efactor }
```

**Schema impact:** simpler — only 3 columns: `interval INT`, `repetition INT`, `efactor FLOAT`, plus `due TIMESTAMPTZ`.

**Why consider it:**
- Simpler state model (3 numbers vs 7 for FSRS)
- More battle-tested across the wider ecosystem
- Grades map naturally to a 0–5 scale (easy to model in UI)

**Why skip it:**
- SM-2 is algorithmically inferior to FSRS on recall accuracy
- The roadmap already acknowledges FSRS as the preferred path

---

### 3. `@open-spaced-repetition/sm-2`
**Algorithm:** SM-2 (TypeScript rewrite, same org as ts-fsrs)

```bash
npm install @open-spaced-repetition/sm-2
```

| Property | Value |
|---|---|
| Version | 0.2.1 (unstable) |
| Weekly downloads | 7 |
| License | MIT |
| TypeScript | ✅ |
| Zero deps | ✅ |
| ESM | ✅ |
| Cloudflare Workers | ✅ |
| GitHub stars | 4 |
| Published | Aug 2025 |

**Why skip it:** Very new (3 versions, 7 weekly DLs), explicitly marked unstable. Same org as `ts-fsrs` — if picking SM-2 stick with the proven `supermemo` package instead.

---

## Eliminated

| Package | Reason |
|---|---|
| `@dtjv/sm-2` | **Archived** on GitHub, last release Sep 2021 |
| `@kirklin/supermemo2` | Last release Mar 2023, 32 weekly DLs, no meaningful adoption |
| `@monkey-dev-vibes/spaced-repetition` | 0 stars, 0 forks, May 2026 — unknown quality |
| `@squeakyrobot/fsrs` | FSRS v4.5 only, 1 version, 7 weekly DLs — superseded by `ts-fsrs` |
| `quanta-fsrs` | 2 weekly DLs, niche, no community |

---

## Recommendation

**Use `ts-fsrs`** — it's the only option that is:
1. Actively maintained by the canonical open-spaced-repetition org
2. Implements FSRS (the algorithm the roadmap already prefers over SM-2)
3. Ships full TypeScript types, ESM+CJS, zero runtime dependencies
4. Runs on Cloudflare Workers edge runtime (pure math, no Node I/O)
5. Dominates weekly downloads vs. all SM-2 alternatives combined

The additional schema columns FSRS requires are manageable and enable better retention outcomes — which directly serves the guardrail KPI ("Study Session Reliability") that gates S-02 launch.

---

*Researched: 2026-09-02. Sources: npm registry, GitHub, exa web search.*
