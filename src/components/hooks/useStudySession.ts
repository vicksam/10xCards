import { useState, useCallback } from "react";
import { fsrs, TypeConvert, Rating, type CardInput } from "ts-fsrs";
import type { Flashcard, ReviewRequest, ReviewResponse } from "@/types";

export interface StudyIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

function computeInitialIntervals(cardRow?: Flashcard): StudyIntervals | null {
  if (!cardRow) return null;
  try {
    const scheduler = fsrs();
    const cardInput: CardInput = {
      due: cardRow.due ?? new Date(),
      stability: cardRow.stability ?? 0,
      difficulty: cardRow.difficulty ?? 0,
      elapsed_days: cardRow.elapsed_days ?? 0,
      scheduled_days: cardRow.scheduled_days ?? 0,
      learning_steps: cardRow.learning_steps ?? 0,
      reps: cardRow.reps ?? 0,
      lapses: cardRow.lapses ?? 0,
      state: cardRow.state ?? 0,
      last_review: cardRow.last_review,
    };
    const card = TypeConvert.card(cardInput);
    const preview = scheduler.repeat(card, new Date());
    return {
      again: preview[Rating.Again].log.scheduled_days,
      hard: preview[Rating.Hard].log.scheduled_days,
      good: preview[Rating.Good].log.scheduled_days,
      easy: preview[Rating.Easy].log.scheduled_days,
    };
  } catch {
    return null;
  }
}

export function useStudySession(initialCards: Flashcard[]) {
  const [cards, setCards] = useState<Flashcard[]>(() => initialCards);
  const [currentIntervals, setCurrentIntervals] = useState<StudyIntervals | null>(() =>
    computeInitialIntervals(initialCards[0]),
  );
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAuthExpired, setIsAuthExpired] = useState<boolean>(false);
  const [sessionDone, setSessionDone] = useState<boolean>(false);

  const totalCount = initialCards.length;
  const remainingCount = cards.length;
  const currentCard = cards[0];

  const flip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const rate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (isSubmitting || cards.length === 0) return;
      const current = cards[0];
      const nextCard = cards.length > 1 ? cards[1] : undefined;

      setIsSubmitting(true);
      setSubmitError(null);
      setIsAuthExpired(false);

      const payload: ReviewRequest = {
        flashcard_id: current.id,
        rating,
        next_flashcard_id: nextCard ? nextCard.id : undefined,
      };

      try {
        const response = await fetch("/api/study/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = (await response.json()) as ReviewResponse;
          const nextRemainingCards = cards.slice(1);
          setCards(nextRemainingCards);
          setIsFlipped(false);
          setCurrentIntervals(data.next_intervals);
          if (nextRemainingCards.length === 0) {
            setSessionDone(true);
          }
        } else {
          if (response.status === 401) {
            setIsAuthExpired(true);
          }
          let errorMessage = `Failed to record review (status ${response.status})`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body.error) {
              errorMessage = body.error;
            }
          } catch {
            // not JSON
          }
          setSubmitError(errorMessage);
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to record review");
      } finally {
        setIsSubmitting(false);
      }
    },
    [cards, isSubmitting],
  );

  return {
    currentCard,
    currentIntervals,
    isFlipped,
    isSubmitting,
    submitError,
    isAuthExpired,
    sessionDone,
    totalCount,
    remainingCount,
    flip,
    rate,
  };
}
