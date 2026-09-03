# ts-fsrs API Reference — S-02

> Fetched 2026-09-02 via Context7 / open-spaced-repetition/ts-fsrs (score 88.38, High reputation).
> Library version: 5.4.1. Node.js ≥ 20 required (dev environment; library is pure math and runs on Cloudflare Workers edge runtime).

---

## Installation

```bash
npm install ts-fsrs
```

---

## Imports

```typescript
import {
  // Factory & classes
  fsrs,
  createEmptyCard,
  TypeConvert,
  generatorParameters,

  // Enums
  State,
  Rating,

  // Types
  type Card,
  type CardInput,
  type FSRSParameters,
  type RecordLogItem,
  type Grade,
} from 'ts-fsrs'
```

---

## Data Types

### `Card` — per-flashcard scheduling state

```typescript
interface Card {
  due: Date              // next review due date
  stability: number      // memory stability (interval at 90% recall)
  difficulty: number     // card difficulty (1–10)
  elapsed_days: number   // days since last review (deprecated in v6, still stored)
  scheduled_days: number // days until next review
  learning_steps: number // current step in learning sequence
  reps: number           // total review count (incremented on every review)
  lapses: number         // times card was forgotten
  state: State           // current state (see below)
  last_review?: Date     // date of last review (optional for new cards)
}
```

### `State` enum

```typescript
State.New        = 0   // never reviewed
State.Learning   = 1   // in initial learning phase
State.Review     = 2   // long-term review
State.Relearning = 3   // relearning after a lapse (Again on a Review card)
```

### `Rating` enum

```typescript
Rating.Again = 1   // forgot / completely wrong  → very short re-review
Rating.Hard  = 2   // recalled with difficulty   → shorter interval
Rating.Good  = 3   // normal recall              → default progression
Rating.Easy  = 4   // too easy                   → longer interval
```

### `ReviewLog` — one row per review event

```typescript
interface ReviewLog {
  rating: Rating         // rating given during this review
  state: State           // card state at time of review
  due: Date              // card's due date before this review
  stability: number      // stability before this review
  difficulty: number     // difficulty before this review
  elapsed_days: number   // days since last review
  last_elapsed_days: number
  scheduled_days: number // days until next review (set by this review)
  learning_steps: number // learning step before this review
  review: Date           // timestamp of this review
}
```

---

## Scheduler API

### Initialize the scheduler

```typescript
// Default config (good for MVP)
const scheduler = fsrs()

// With overrides
const scheduler = fsrs({
  request_retention: 0.9,       // target recall probability (default 0.9)
  maximum_interval: 36500,      // max days between reviews (default 36500)
  enable_fuzz: true,            // add slight randomness to intervals
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})
```

**Configuration presets:**

```typescript
// Lightweight (fewer reviews)
const scheduler = fsrs({
  request_retention: 0.75,
  learning_steps: ['1m', '10m'],
  enable_fuzz: true,
})

// Rigorous (more reviews)
const scheduler = fsrs({
  request_retention: 0.95,
  learning_steps: ['1m', '5m', '30m', '2h'],
  relearning_steps: ['1m', '10m', '1h'],
})
```

---

### `createEmptyCard(now?)` — initialize a new card

Call once when a flashcard is first saved. Persist the resulting `Card` fields alongside the flashcard content row.

```typescript
const card = createEmptyCard()
// or with explicit due date:
const card = createEmptyCard(new Date())
```

New cards get `state = State.New`, all numeric fields `0`, `due = now`.

---

### `scheduler.next(card, now, grade)` — apply a rating

Use when the **user has already chosen a rating**. Returns the updated card state + a review log entry to persist.

```typescript
const { card: updatedCard, log } = scheduler.next(card, new Date(), Rating.Good)

updatedCard.due            // Date — next review due date
updatedCard.state          // State enum
updatedCard.scheduled_days // number of days until next review
log.rating                 // Rating — what user chose
log.review                 // Date — when this review happened
```

**With `afterHandler` for direct DB serialization** (converts `Date` → ISO string):

```typescript
const saved = scheduler.next(card, new Date(), Rating.Good, ({ card, log }) => ({
  card: {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString() ?? null,
  },
  log: {
    ...log,
    due: log.due.toISOString(),
    review: log.review.toISOString(),
  },
}))
```

> Throws `FSRSValidationError` if grade is not 1–4.

---

### `scheduler.repeat(card, now)` — preview all four outcomes

Use **before** the user rates a card to show what interval each button would produce.

```typescript
const preview = scheduler.repeat(card, new Date())

preview[Rating.Again].card.due           // due date if Again
preview[Rating.Again].log.scheduled_days // interval in days if Again
preview[Rating.Hard].log.scheduled_days
preview[Rating.Good].log.scheduled_days
preview[Rating.Easy].log.scheduled_days
```

Returns `IPreview` — an object keyed by `Rating` (1–4), each value being a `RecordLogItem` (`{ card, log }`). Does **not** modify card state.

---

### `TypeConvert.card(stored)` — deserialize from DB

Supabase rows are plain objects; convert before passing to the scheduler. Accepts strings for `state` and ISO strings / numeric timestamps for dates.

```typescript
import { TypeConvert } from 'ts-fsrs'

const { data: dbRow } = await supabase
  .from('flashcards')
  .select('*')
  .eq('id', id)
  .single()

const card = TypeConvert.card({
  state: dbRow.state,              // 'Review' string or State.Review enum — both ok
  due: dbRow.due,                  // ISO string, timestamp number, or Date — all ok
  stability: dbRow.stability,
  difficulty: dbRow.difficulty,
  elapsed_days: dbRow.elapsed_days,
  scheduled_days: dbRow.scheduled_days,
  learning_steps: dbRow.learning_steps,
  reps: dbRow.reps,
  lapses: dbRow.lapses,
  last_review: dbRow.last_review,  // nullable
})
```

> Throws `FSRSValidationError` if the input is invalid.

---

### `scheduler.forget(card, now, reset_count?)` — reset a card

```typescript
// Reset to New state, keep reps/lapses counts
const { card: reset } = scheduler.forget(card, new Date(), false)

// Reset to New state AND clear reps/lapses to 0
const { card: hardReset } = scheduler.forget(card, new Date(), true)

reset.state      // State.New
reset.stability  // 0
```

---

### `scheduler.get_retrievability(card, now?, format?)` — recall probability

```typescript
const pct = scheduler.get_retrievability(card)                    // "85.50%"
const dec = scheduler.get_retrievability(card, new Date(), false) // 0.855

// At a future date
const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const futureR = scheduler.get_retrievability(card, future, false) // lower value
```

---

## Database Schema Extension

The `Card` fields must be persisted. These columns **extend** the `flashcards` table created in F-01, added via the S-02 migration.

### Columns to add to `flashcards`

| Column | Postgres type | Default | Notes |
|---|---|---|---|
| `due` | `timestamptz` | `now()` | next review date |
| `stability` | `float8` | `0` | |
| `difficulty` | `float8` | `0` | |
| `elapsed_days` | `int4` | `0` | |
| `scheduled_days` | `int4` | `0` | |
| `learning_steps` | `int4` | `0` | |
| `reps` | `int4` | `0` | |
| `lapses` | `int4` | `0` | |
| `state` | `int2` | `0` | 0=New 1=Learning 2=Review 3=Relearning |
| `last_review` | `timestamptz` | `null` | nullable |

### New `review_logs` table

| Column | Postgres type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `flashcard_id` | `uuid` FK | `→ flashcards.id ON DELETE CASCADE` |
| `user_id` | `uuid` FK | `→ auth.users.id` |
| `rating` | `int2` | 1–4 |
| `state` | `int2` | State at review time |
| `scheduled_days` | `int4` | |
| `due` | `timestamptz` | Due date before this review |
| `review` | `timestamptz` | When this review happened |
| `stability` | `float8` | |
| `difficulty` | `float8` | |

RLS required on both tables (`user_id = auth.uid()`), per AGENTS.md.

---

## Study Queue SQL

Fetch cards due for review:

```sql
SELECT *
FROM flashcards
WHERE user_id = auth.uid()
  AND due <= NOW()
ORDER BY due ASC
LIMIT 20;
```

New cards (`state = 0`) have `due` set to their creation timestamp, so they surface naturally without special handling.

---

## Minimal Session Flow

```typescript
import { fsrs, TypeConvert, Rating } from 'ts-fsrs'

const scheduler = fsrs()

// 1. Load due cards from DB
const { data: dueRows } = await supabase
  .from('flashcards')
  .select('*')
  .lte('due', new Date().toISOString())
  .order('due', { ascending: true })
  .limit(20)

// 2. For each card shown, preview intervals for UI buttons
const card = TypeConvert.card(dueRows[0])
const preview = scheduler.repeat(card, new Date())

// Show in UI: "Again (${preview[1].log.scheduled_days}d)" etc.
const intervals = {
  again: preview[Rating.Again].log.scheduled_days,
  hard:  preview[Rating.Hard].log.scheduled_days,
  good:  preview[Rating.Good].log.scheduled_days,
  easy:  preview[Rating.Easy].log.scheduled_days,
}

// 3. User clicks a rating — apply it
const { card: updatedCard, log } = scheduler.next(card, new Date(), Rating.Good)

// 4. Persist updated card state
await supabase
  .from('flashcards')
  .update({
    due:            updatedCard.due.toISOString(),
    stability:      updatedCard.stability,
    difficulty:     updatedCard.difficulty,
    elapsed_days:   updatedCard.elapsed_days,
    scheduled_days: updatedCard.scheduled_days,
    learning_steps: updatedCard.learning_steps,
    reps:           updatedCard.reps,
    lapses:         updatedCard.lapses,
    state:          updatedCard.state,
    last_review:    updatedCard.last_review?.toISOString() ?? null,
  })
  .eq('id', dueRows[0].id)

// 5. Append review log
await supabase.from('review_logs').insert({
  flashcard_id:   dueRows[0].id,
  user_id:        userId,
  rating:         log.rating,
  state:          log.state,
  scheduled_days: log.scheduled_days,
  due:            log.due.toISOString(),
  review:         log.review.toISOString(),
  stability:      log.stability,
  difficulty:     log.difficulty,
})
```
