import type { APIRoute } from "astro";
import { z } from "zod";
import { fsrs, TypeConvert, Rating, type CardInput } from "ts-fsrs";
import { createClient } from "@/lib/supabase";
import type { Flashcard, ReviewResponse } from "@/types";

export const prerender = false;

const reviewSchema = z.object({
  flashcard_id: z.uuid("Invalid flashcard ID"),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  next_flashcard_id: z.uuid("Invalid next flashcard ID").optional(),
});

function toCardInput(row: Flashcard): CardInput {
  return {
    due: row.due ?? new Date(),
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: row.elapsed_days ?? 0,
    scheduled_days: row.scheduled_days ?? 0,
    learning_steps: row.learning_steps ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: row.state ?? 0,
    last_review: row.last_review,
  };
}

export const POST: APIRoute = async (context) => {
  // 1. Guard: Check authentication
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Guard: Parse request JSON body
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 3. Guard: Validate input with Zod
  const result = reviewSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // 4. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 5. Fetch the card row scoped to the authenticated user
  const { data: cardRow, error: fetchError } = await supabase
    .from("flashcards")
    .select("*")
    .eq("id", result.data.flashcard_id)
    .eq("user_id", context.locals.user.id)
    .single();

  if (fetchError) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  // 6. Apply FSRS scheduling algorithm
  const scheduler = fsrs();
  const now = new Date();
  const card = TypeConvert.card(toCardInput(cardRow));
  const { card: updatedCard, log } = scheduler.next(card, now, result.data.rating, ({ card: c, log: l }) => ({
    card: {
      ...c,
      due: c.due.toISOString(),
      last_review: c.last_review?.toISOString() ?? null,
    },
    log: {
      ...l,
      due: l.due.toISOString(),
      review: l.review.toISOString(),
    },
  }));

  // 7. Persist updated card state
  const { error: updateError } = await supabase
    .from("flashcards")
    .update({
      due: updatedCard.due,
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      elapsed_days: updatedCard.elapsed_days,
      scheduled_days: updatedCard.scheduled_days,
      learning_steps: updatedCard.learning_steps,
      reps: updatedCard.reps,
      lapses: updatedCard.lapses,
      state: updatedCard.state,
      last_review: updatedCard.last_review,
    })
    .eq("id", result.data.flashcard_id);

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error("flashcards update failed", updateError);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // 8. Persist review log
  const { error: insertError } = await supabase.from("review_logs").insert({
    flashcard_id: result.data.flashcard_id,
    user_id: context.locals.user.id,
    rating: log.rating,
    state: log.state,
    scheduled_days: log.scheduled_days,
    due: log.due,
    review: log.review,
    stability: log.stability,
    difficulty: log.difficulty,
  });

  if (insertError) {
    // eslint-disable-next-line no-console
    console.error("review_logs insert failed after card update", insertError);
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // 9. Optionally compute preview intervals for next card
  let next_intervals: ReviewResponse["next_intervals"] = null;
  if (result.data.next_flashcard_id) {
    const { data: nextCardRow } = await supabase
      .from("flashcards")
      .select("*")
      .eq("id", result.data.next_flashcard_id)
      .eq("user_id", context.locals.user.id)
      .single();

    if (nextCardRow) {
      const nextCard = TypeConvert.card(toCardInput(nextCardRow));
      const preview = scheduler.repeat(nextCard, now);
      next_intervals = {
        again: preview[Rating.Again].log.scheduled_days,
        hard: preview[Rating.Hard].log.scheduled_days,
        good: preview[Rating.Good].log.scheduled_days,
        easy: preview[Rating.Easy].log.scheduled_days,
      };
    }
  }

  const responseBody: ReviewResponse = {
    due: updatedCard.due,
    state: updatedCard.state,
    scheduled_days: updatedCard.scheduled_days,
    next_intervals,
  };

  return Response.json(responseBody, { status: 200 });
};
