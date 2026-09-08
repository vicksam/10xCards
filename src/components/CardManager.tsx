import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCardManager } from "@/components/hooks/useCardManager";
import { cn } from "@/lib/utils";

import type { Flashcard } from "@/types";

interface CardManagerProps {
  initialCards?: Flashcard[];
  initialCount?: number;
}

export default function CardManager({ initialCards = [], initialCount = 0 }: CardManagerProps) {
  const { cards, count, isLoading, error, page, limit, setPage, fetchCards } = useCardManager(
    initialCards,
    initialCount,
    1,
    10,
  );

  const totalPages = Math.max(1, Math.ceil(count / limit));

  function formatDue(due: string | null): string {
    if (!due) return "N/A";
    const date = new Date(due);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">My Flashcards</h1>
          <p className="mt-1 text-sm text-slate-400">Manage, review, and organize your collection of flashcards.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchCards()} className="mt-2 text-xs">
            Retry
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-[35%] text-slate-300">Front</TableHead>
              <TableHead className="w-[40%] text-slate-300">Back</TableHead>
              <TableHead className="w-[12%] text-slate-300">Source</TableHead>
              <TableHead className="w-[13%] text-slate-300">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                    <span>Loading flashcards...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : cards.length === 0 ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                  No flashcards found. Create one manually or generate via Dashboard!
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <TableRow key={card.id} className="border-white/5 transition-colors hover:bg-white/[0.03]">
                  <TableCell className="max-w-[240px] truncate font-medium text-white">{card.front}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-slate-300">{card.back}</TableCell>
                  <TableCell>
                    <Badge
                      variant={card.source === "ai" ? "default" : "secondary"}
                      className={cn(
                        "text-xs capitalize",
                        card.source === "ai"
                          ? "border-purple-500/30 bg-purple-600/30 text-purple-200"
                          : "border-blue-500/30 bg-blue-600/30 text-blue-200",
                      )}
                    >
                      {card.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{formatDue(card.due)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        {!isLoading && count > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-slate-400">
            <span>
              Showing {Math.min((page - 1) * limit + 1, count)} to {Math.min(page * limit, count)} of {count} cards
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage(page - 1);
                }}
                className="border-white/10 text-xs text-white hover:bg-white/10"
              >
                Previous
              </Button>
              <span className="px-2 text-xs text-slate-300">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage(page + 1);
                }}
                className="border-white/10 text-xs text-white hover:bg-white/10"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
