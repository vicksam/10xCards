-- Allow users to delete their own unfinalized generation reviews
drop policy if exists "Users cannot delete generation reviews directly" on generation_reviews;

create policy "Users can delete their own unfinalized generation reviews"
  on generation_reviews for delete
  using (auth.uid() = user_id and finalized_at is null);
