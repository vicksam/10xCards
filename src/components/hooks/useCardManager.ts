import { useState, useCallback } from "react";
import type { Flashcard } from "@/types";

interface UseCardManagerResult {
  cards: Flashcard[];
  count: number;
  isLoading: boolean;
  error: string | null;
  page: number;
  limit: number;
  setPage: (page: number) => void;
  fetchCards: () => Promise<void>;
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
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to fetch flashcards");
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
  };
}
