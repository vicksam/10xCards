import { useState, useCallback } from "react";
import type { Flashcard } from "@/types";

async function extractError(res: Response, defaultMessage: string) {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error ?? defaultMessage;
  } catch {
    return defaultMessage;
  }
}

interface UseCardManagerResult {
  cards: Flashcard[];
  count: number;
  isLoading: boolean;
  error: string | null;
  page: number;
  limit: number;
  setPage: (page: number) => void;
  fetchCards: (targetPage?: number) => Promise<void>;
  createCard: (front: string, back: string) => Promise<{ success: boolean; error?: string }>;
  updateCard: (id: string, front: string, back: string) => Promise<{ success: boolean; error?: string }>;
  deleteCard: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function useCardManager(
  initialCards: Flashcard[] = [],
  initialCount = 0,
  initialPage = 1,
  limit = 10,
): UseCardManagerResult {
  const [cards, setCards] = useState<Flashcard[]>(() => initialCards);
  const [count, setCount] = useState<number>(() => initialCount);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initialPage);

  const fetchCards = useCallback(
    async (targetPage = page) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/flashcards?page=${targetPage}&limit=${limit}`);
        if (!res.ok) {
          throw new Error(await extractError(res, "Failed to fetch flashcards"));
        }
        const json = (await res.json()) as { data: Flashcard[]; count: number };
        setCards(json.data);
        setCount(json.count);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit],
  );

  const createCard = useCallback(
    async (front: string, back: string) => {
      try {
        const res = await fetch("/api/flashcards/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front, back }),
        });
        if (!res.ok) {
          return { success: false, error: await extractError(res, "Failed to create flashcard") };
        }
        await fetchCards(1);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to create card" };
      }
    },
    [fetchCards],
  );

  const updateCard = useCallback(async (id: string, front: string, back: string) => {
    try {
      const res = await fetch(`/api/flashcards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });
      if (!res.ok) {
        return { success: false, error: await extractError(res, "Failed to update flashcard") };
      }
      const json = (await res.json()) as { data: Flashcard };
      setCards((prev) => prev.map((c) => (c.id === id ? json.data : c)));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to update card" };
    }
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/flashcards/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        return { success: false, error: await extractError(res, "Failed to delete flashcard") };
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
      setCount((prev) => Math.max(0, prev - 1));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to delete card" };
    }
  }, []);

  return {
    cards,
    count,
    isLoading,
    error,
    page,
    limit,
    setPage: (newPage: number) => {
      void fetchCards(newPage);
    },
    fetchCards,
    createCard,
    updateCard,
    deleteCard,
  };
}
