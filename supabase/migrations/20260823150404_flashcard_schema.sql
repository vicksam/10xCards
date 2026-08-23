-- Enable moddatetime extension for auto-updating updated_at
create extension if not exists moddatetime schema extensions;

-- Card source enum
create type card_source as enum ('ai', 'manual');

-- Flashcards table
create table flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  front       text not null check (char_length(front) > 0),
  back        text not null check (char_length(back) > 0),
  source      card_source not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on row change
create trigger handle_updated_at
  before update on flashcards
  for each row
  execute procedure extensions.moddatetime(updated_at);

-- Row Level Security
alter table flashcards enable row level security;

create policy "Users can select their own flashcards"
  on flashcards for select
  using (auth.uid() = user_id);

create policy "Users can insert their own flashcards"
  on flashcards for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own flashcards"
  on flashcards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own flashcards"
  on flashcards for delete
  using (auth.uid() = user_id);
