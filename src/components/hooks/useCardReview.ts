import { useState, useCallback } from "react";
import type { CandidateCard } from "@/types";

export interface ReviewCard extends CandidateCard {
  id: string;
  status: "pending" | "accepted" | "rejected";
  edited: boolean;
}

export interface EditCardState {
  front: string;
  back: string;
}

export function useCardReview(generationId: string, initialCandidates: CandidateCard[]) {
  const [cards, setCards] = useState<ReviewCard[]>(() =>
    initialCandidates.map((candidate, index) => ({
      ...candidate,
      id: `candidate-${index}`,
      status: "pending",
      edited: false,
    })),
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [editState, setEditState] = useState<EditCardState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentCard = cards[currentIndex] as ReviewCard | undefined;
  const isDone = currentIndex >= cards.length;
  const acceptedCount = cards.filter((c) => c.status === "accepted").length;
  const rejectedCount = cards.filter((c) => c.status === "rejected").length;

  const accept = useCallback(() => {
    if (currentIndex >= cards.length || isSaving) return;
    setCards((prev) => prev.map((card, idx) => (idx === currentIndex ? { ...card, status: "accepted" } : card)));
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, cards.length, isSaving]);

  const reject = useCallback(() => {
    if (currentIndex >= cards.length || isSaving) return;
    setCards((prev) => prev.map((card, idx) => (idx === currentIndex ? { ...card, status: "rejected" } : card)));
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, cards.length, isSaving]);

  const startEdit = useCallback(() => {
    if (currentIndex >= cards.length || isSaving) return;
    const card = cards[currentIndex];
    setEditState({ front: card.front, back: card.back });
    setEditError(null);
  }, [currentIndex, cards, isSaving]);

  const saveEdit = useCallback(() => {
    if (!editState || currentIndex >= cards.length || isSaving) return;

    const frontTrimmed = editState.front.trim();
    const backTrimmed = editState.back.trim();

    if (!frontTrimmed) {
      setEditError("Front cannot be empty");
      return;
    }
    if (frontTrimmed.length > 500) {
      setEditError("Front exceeds maximum length of 500 characters");
      return;
    }
    if (!backTrimmed) {
      setEditError("Back cannot be empty");
      return;
    }
    if (backTrimmed.length > 2000) {
      setEditError("Back exceeds maximum length of 2,000 characters");
      return;
    }

    setCards((prev) =>
      prev.map((card, idx) =>
        idx === currentIndex
          ? {
              ...card,
              front: frontTrimmed,
              back: backTrimmed,
              status: "accepted",
              edited: true,
            }
          : card,
      ),
    );
    setEditState(null);
    setEditError(null);
    setCurrentIndex((prev) => prev + 1);
  }, [editState, currentIndex, cards.length, isSaving]);

  const cancelEdit = useCallback(() => {
    setEditState(null);
    setEditError(null);
  }, []);

  const saveAccepted = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    const acceptedCards = cards.filter((c) => c.status === "accepted");
    const payload = {
      generationId,
      cards: acceptedCards.map((c) => ({
        front: c.front,
        back: c.back,
        outcome: c.edited ? ("edited" as const) : ("accepted" as const),
      })),
    };

    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as { saved: number };
        setSavedCount(data.saved);
      } else {
        let errorMessage = `Failed to save flashcards (status ${response.status})`;
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) {
            errorMessage = body.error;
          }
        } catch {
          // not JSON
        }
        setSaveError(errorMessage);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save flashcards");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, cards, generationId]);

  return {
    cards,
    currentIndex,
    currentCard,
    editState,
    editError,
    isSaving,
    savedCount,
    saveError,
    isDone,
    acceptedCount,
    rejectedCount,
    accept,
    reject,
    startEdit,
    saveEdit,
    cancelEdit,
    saveAccepted,
    setEditState,
  };
}
