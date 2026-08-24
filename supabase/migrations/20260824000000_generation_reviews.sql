-- Generation reviews table to track aggregate review outcomes without storing study text
create table generation_reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  generated_count integer not null check (generated_count > 0),
  accepted_count  integer not null default 0 check (accepted_count >= 0),
  edited_count    integer not null default 0 check (edited_count >= 0),
  rejected_count  integer not null default 0 check (rejected_count >= 0),
  created_at      timestamptz not null default now(),
  finalized_at    timestamptz
);

-- Row Level Security for generation_reviews
alter table generation_reviews enable row level security;

create policy "Users can select their own generation reviews"
  on generation_reviews for select
  using (auth.uid() = user_id);

create policy "Users can insert their own generation reviews"
  on generation_reviews for insert
  with check (auth.uid() = user_id);

create policy "Users cannot update generation reviews directly"
  on generation_reviews for update
  using (false);

create policy "Users cannot delete generation reviews directly"
  on generation_reviews for delete
  using (false);

-- Add trimmed-length constraints to flashcards table
alter table flashcards
  add constraint flashcards_front_length check (char_length(trim(front)) >= 1 and char_length(trim(front)) <= 500),
  add constraint flashcards_back_length check (char_length(trim(back)) >= 1 and char_length(trim(back)) <= 2000);

-- Atomic review finalization function
create or replace function finalize_generation_review(
  generation_id uuid,
  cards jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_review generation_reviews%rowtype;
  v_card jsonb;
  v_front text;
  v_back text;
  v_outcome text;
  v_accepted_count integer := 0;
  v_edited_count integer := 0;
  v_rejected_count integer := 0;
  v_input_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Lock and retrieve the generation review row
  select * into v_review
  from generation_reviews
  where id = generation_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Generation review not found';
  end if;

  -- Idempotency: if already finalized, return previous saved count without inserting again
  if v_review.finalized_at is not null then
    return v_review.accepted_count + v_review.edited_count;
  end if;

  -- Validate input cards JSON array
  if jsonb_typeof(cards) != 'array' then
    raise exception 'Invalid cards payload: expected JSON array';
  end if;

  v_input_count := jsonb_array_length(cards);
  if v_input_count > v_review.generated_count then
    raise exception 'Card count exceeds generated count';
  end if;

  -- Process and insert each accepted/edited card
  for v_card in select * from jsonb_array_elements(cards)
  loop
    v_front := trim(coalesce(v_card->>'front', ''));
    v_back := trim(coalesce(v_card->>'back', ''));
    v_outcome := coalesce(v_card->>'outcome', '');

    if char_length(v_front) < 1 or char_length(v_front) > 500 then
      raise exception 'Front text length must be between 1 and 500 characters';
    end if;

    if char_length(v_back) < 1 or char_length(v_back) > 2000 then
      raise exception 'Back text length must be between 1 and 2000 characters';
    end if;

    if v_outcome = 'accepted' then
      v_accepted_count := v_accepted_count + 1;
    elsif v_outcome = 'edited' then
      v_edited_count := v_edited_count + 1;
    else
      raise exception 'Invalid card outcome: must be "accepted" or "edited"';
    end if;

    insert into flashcards (user_id, front, back, source)
    values (v_user_id, v_front, v_back, 'ai');
  end loop;

  v_rejected_count := v_review.generated_count - (v_accepted_count + v_edited_count);
  if v_rejected_count < 0 then
    raise exception 'Saved card count exceeds generated count';
  end if;

  -- Update generation review with outcome counts and finalize timestamp
  update generation_reviews
  set
    accepted_count = v_accepted_count,
    edited_count = v_edited_count,
    rejected_count = v_rejected_count,
    finalized_at = now()
  where id = generation_id;

  return v_accepted_count + v_edited_count;
end;
$$;

-- Restrict function execution to authenticated users
revoke all on function finalize_generation_review(uuid, jsonb) from public;
grant execute on function finalize_generation_review(uuid, jsonb) to authenticated;
