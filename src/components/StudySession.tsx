import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useStudySession } from "@/components/hooks/useStudySession";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types";

interface StudySessionProps {
  cards: Flashcard[];
}

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

export default function StudySession({ cards: initialCards }: StudySessionProps) {
  const {
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
  } = useStudySession(initialCards);

  // 1. Empty state
  if (totalCount === 0) {
    return (
      <div className="mx-auto w-full max-w-xl text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl">
          <h2 className="mb-2 text-2xl font-bold text-white">No Cards Due</h2>
          <p className="mb-6 text-sm text-blue-100/70">You have no cards due for review.</p>
          <Button
            asChild
            variant="outline"
            className="border-white/20 bg-black/50 text-white hover:bg-white/10 hover:text-white"
          >
            <a href="/dashboard">Back to Dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  // 2. Session complete
  if (sessionDone) {
    return (
      <div className="mx-auto w-full max-w-xl text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl">
          <h2 className="mb-2 text-2xl font-bold text-white">Session Complete!</h2>
          <p className="mb-6 text-sm text-blue-100/70">You&apos;ve reviewed all due cards for now. Great job!</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
              className="border-white/20 bg-black/50 text-white hover:bg-white/10 hover:text-white"
            >
              Study more cards
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <a href="/dashboard">Back to Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active session
  const progressValue = totalCount > 0 ? ((totalCount - remainingCount) / totalCount) * 100 : 0;
  const stateLabel = STATE_LABELS[currentCard.state ?? 0] ?? "New";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Session Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>
            {totalCount - remainingCount} of {totalCount} reviewed
          </span>
          <span>{remainingCount} remaining</span>
        </div>
        <Progress value={progressValue} className="h-2 bg-white/10" />
      </div>

      {/* Card Surface */}
      <Card className="min-h-64 border-white/10 bg-white/5 text-white shadow-xl backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-4">
          <span className="text-xs font-semibold tracking-wider text-white/50 uppercase">Question</span>
          <Badge variant="secondary" className="bg-white/10 text-xs text-white/80">
            {stateLabel}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <p className="text-lg font-medium whitespace-pre-wrap md:text-xl">{currentCard.front}</p>

          {isFlipped && (
            <div className="animate-in fade-in-50 border-t border-white/10 pt-6 duration-200">
              <span className="mb-2 block text-xs font-semibold tracking-wider text-white/50 uppercase">Answer</span>
              <p className="text-base whitespace-pre-wrap text-blue-100/90 md:text-lg">{currentCard.back}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action / Rating Buttons */}
      {!isFlipped ? (
        <Button
          onClick={flip}
          variant="outline"
          className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
        >
          Show answer
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button
            variant="outline"
            className={cn(
              "border-rose-500/30 bg-white/5 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200",
              "flex h-auto flex-col items-center justify-center py-5",
            )}
            disabled={isSubmitting}
            onClick={() => void rate(1)}
          >
            <span className="font-semibold">Again</span>
            <span className="text-xs opacity-70">
              ({currentIntervals?.again !== undefined ? `${currentIntervals.again}d` : "—"})
            </span>
          </Button>

          <Button
            variant="outline"
            className={cn(
              "border-amber-500/30 bg-white/5 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200",
              "flex h-auto flex-col items-center justify-center py-5",
            )}
            disabled={isSubmitting}
            onClick={() => void rate(2)}
          >
            <span className="font-semibold">Hard</span>
            <span className="text-xs opacity-70">
              ({currentIntervals?.hard !== undefined ? `${currentIntervals.hard}d` : "—"})
            </span>
          </Button>

          <Button
            variant="outline"
            className={cn(
              "border-blue-500/30 bg-white/5 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200",
              "flex h-auto flex-col items-center justify-center py-5",
            )}
            disabled={isSubmitting}
            onClick={() => void rate(3)}
          >
            <span className="font-semibold">Good</span>
            <span className="text-xs opacity-70">
              ({currentIntervals?.good !== undefined ? `${currentIntervals.good}d` : "—"})
            </span>
          </Button>

          <Button
            variant="outline"
            className={cn(
              "border-emerald-500/30 bg-white/5 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200",
              "flex h-auto flex-col items-center justify-center py-5",
            )}
            disabled={isSubmitting}
            onClick={() => void rate(4)}
          >
            <span className="font-semibold">Easy</span>
            <span className="text-xs opacity-70">
              ({currentIntervals?.easy !== undefined ? `${currentIntervals.easy}d` : "—"})
            </span>
          </Button>
        </div>
      )}

      {/* Error feedback */}
      {isAuthExpired ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-semibold text-amber-200">Session Expired</p>
            <p className="text-xs text-amber-200/80">
              Your session has expired. Sign in in a new tab, then try rating again to save your progress.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/30 bg-black/40 text-amber-200 hover:bg-amber-500/20 hover:text-white"
          >
            <a href="/auth/signin" target="_blank" rel="noopener noreferrer">
              Sign in
            </a>
          </Button>
        </div>
      ) : submitError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-sm text-rose-200">
          {submitError}
        </div>
      ) : null}
    </div>
  );
}
