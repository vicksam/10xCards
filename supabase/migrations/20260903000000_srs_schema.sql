-- 1. Add FSRS scheduling columns to flashcards
ALTER TABLE flashcards
  ADD COLUMN due            timestamptz DEFAULT now(),
  ADD COLUMN stability      float8      DEFAULT 0,
  ADD COLUMN difficulty     float8      DEFAULT 0,
  ADD COLUMN elapsed_days   int4        DEFAULT 0,
  ADD COLUMN scheduled_days int4        DEFAULT 0,
  ADD COLUMN learning_steps int4        DEFAULT 0,
  ADD COLUMN reps           int4        DEFAULT 0,
  ADD COLUMN lapses         int4        DEFAULT 0,
  ADD COLUMN state          int2        DEFAULT 0,
  ADD COLUMN last_review    timestamptz DEFAULT null;

-- 2. Backfill due for existing cards so they surface immediately
UPDATE flashcards SET due = created_at;

-- 3. Create review_logs table
CREATE TABLE review_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id   uuid        NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id),
  rating         int2        NOT NULL,
  state          int2        NOT NULL,
  scheduled_days int4        NOT NULL,
  due            timestamptz NOT NULL,
  review         timestamptz NOT NULL,
  stability      float8      NOT NULL,
  difficulty     float8      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 4. RLS on review_logs
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own review logs"
  ON review_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review logs"
  ON review_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
