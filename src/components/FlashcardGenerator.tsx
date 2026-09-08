import React, { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Check, X, Pencil, CheckCircle2, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlashcardGeneration } from "@/components/hooks/useFlashcardGeneration";
import { useCardReview } from "@/components/hooks/useCardReview";
import { cn } from "@/lib/utils";
import type { CandidateCard } from "@/types";

interface FlashcardGeneratorProps {
  isConfigured?: boolean;
}

export default function FlashcardGenerator({ isConfigured = true }: FlashcardGeneratorProps) {
  const [text, setText] = useState("");
  const { state, generate, reset, cancel } = useFlashcardGeneration();

  const handleReset = () => {
    setText("");
    reset();
  };

  const handleCancel = () => {
    const generationId = state.status === "success" ? (state.generationId ?? undefined) : undefined;
    void cancel(generationId);
    setText("");
  };

  const trimmedLength = text.trim().length;
  const showShortWarning = trimmedLength > 0 && trimmedLength < 50;
  const isGenerateDisabled = !isConfigured || trimmedLength === 0 || text.length > 10000 || state.status === "loading";

  return (
    <div className="mx-auto w-full max-w-3xl">
      {!isConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-300">OpenRouter API key is not configured</p>
            <p className="mt-1 text-amber-200/80">
              AI flashcard generation is disabled. Please configure{" "}
              <code className="rounded bg-amber-950/60 px-1 py-0.5 font-mono text-xs">OPENROUTER_API_KEY</code> in your
              environment to enable this feature.
            </p>
          </div>
        </div>
      )}

      {(state.status === "idle" || state.status === "loading" || state.status === "error") && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
                Generate Flashcards with AI
              </h1>
              <p className="mt-2 text-sm text-blue-100/70">
                Paste your study notes, articles, or summary text below. The AI will extract key concepts and generate
                Q&A flashcards for review.
              </p>
            </div>
            {state.status === "loading" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="self-start border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
              >
                <X className="size-3.5" />
                Cancel generation
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                }}
                placeholder="Paste your study text here (articles, notes, documentation)..."
                maxLength={10000}
                rows={10}
                disabled={!isConfigured || state.status === "loading"}
                className={cn(
                  "w-full resize-y rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  showShortWarning && "border-amber-500/50 focus:border-amber-400 focus:ring-amber-400/30",
                )}
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                {showShortWarning ? (
                  <span className="flex items-center gap-1.5 font-medium text-amber-300">
                    <Info className="size-3.5" />
                    This text is quite short — generated cards may not be useful
                  </span>
                ) : (
                  <span className="text-white/50">Minimum 1 character, maximum 10,000</span>
                )}
                <span className={cn("text-white/50", text.length > 9500 && "font-semibold text-amber-300")}>
                  {text.length.toLocaleString()} / 10,000
                </span>
              </div>
            </div>

            {state.status === "loading" && (
              <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 text-sm text-purple-200">
                <Loader2 className="size-5 animate-spin text-purple-400" />
                <span>Generating flashcards with AI... This usually takes a few seconds.</span>
              </div>
            )}

            {state.status === "error" && (
              <div className="border-destructive/30 bg-destructive/10 text-destructive-foreground flex flex-col gap-3 rounded-xl border p-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">Generation failed</p>
                    <p className="mt-0.5 text-white/80">{state.message}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => generate(text)}
                    className="border-destructive/30 bg-destructive/20 hover:bg-destructive/30 text-white"
                  >
                    <RotateCcw className="size-3.5" />
                    Try again (up to 60s)
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => generate(text)}
                disabled={isGenerateDisabled}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-600 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
              >
                {state.status === "loading" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate Flashcards
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {state.status === "success" && state.generationId !== null && state.candidates.length > 0 && (
        <CardReview
          generationId={state.generationId}
          candidates={state.candidates}
          onReset={handleReset}
          onCancel={handleCancel}
        />
      )}

      {state.status === "success" && (state.generationId === null || state.candidates.length === 0) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-white/10 text-blue-200">
            <Info className="size-6" />
          </div>
          <h2 className="text-xl font-bold text-white">No cards generated</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-blue-100/70">
            No cards could be generated from this text. Try with more content or more structured notes.
          </p>
          <div className="mt-6">
            <Button
              type="button"
              onClick={handleReset}
              variant="outline"
              className="border-white/20 bg-black/50 text-white hover:bg-white/10 hover:text-white"
            >
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CardReviewProps {
  generationId: string;
  candidates: CandidateCard[];
  onReset: () => void;
  onCancel?: () => void;
}

function CardReview({ generationId, candidates, onReset, onCancel }: CardReviewProps) {
  const {
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
  } = useCardReview(generationId, candidates);

  // 1. Success state after saving
  if (isDone && savedCount !== null) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-white/5 p-8 text-center shadow-xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="bg-gradient-to-r from-emerald-200 to-teal-100 bg-clip-text text-2xl font-bold text-transparent">
          {savedCount === 1 ? "1 card added to your deck" : `${savedCount} cards added to your deck`}
        </h2>
        <p className="mt-2 text-sm text-blue-100/70">
          {savedCount > 0
            ? "Your new flashcards are ready for study sessions."
            : "Review completed without adding any cards to your deck."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            onClick={onReset}
            className="bg-gradient-to-r from-blue-500 to-purple-600 font-semibold text-white"
          >
            <Sparkles className="size-4" />
            Generate more
          </Button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // 2. Review completed, ready to save / finalize
  if (isDone && savedCount === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl md:p-8">
        {onCancel && (
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
            >
              <X className="size-3.5" />
              Cancel generation
            </Button>
          </div>
        )}
        <div className="text-center">
          <h2 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
            Review Complete
          </h2>
          <p className="mt-1 text-sm text-blue-100/70">You have reviewed all {cards.length} generated cards.</p>

          <div className="my-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="text-3xl font-bold text-emerald-300">{acceptedCount}</div>
              <div className="mt-1 text-xs font-medium tracking-wider text-emerald-200/70 uppercase">Accepted</div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="text-3xl font-bold text-red-300">{rejectedCount}</div>
              <div className="mt-1 text-xs font-medium tracking-wider text-red-200/70 uppercase">Rejected</div>
            </div>
          </div>

          {saveError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive-foreground mb-6 flex flex-col gap-3 rounded-xl border p-4 text-left text-sm">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold text-white">Save failed</p>
                  <p className="mt-0.5 text-white/80">{saveError}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancel ?? onReset}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  Discard / Generate more
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveAccepted}
                  disabled={isSaving}
                  className="bg-destructive/20 hover:bg-destructive/30 text-white"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  Retry save
                </Button>
              </div>
            </div>
          )}

          {!saveError && (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              {acceptedCount > 0 ? (
                <Button
                  type="button"
                  onClick={saveAccepted}
                  disabled={isSaving}
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg transition-all hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving cards...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Save {acceptedCount} {acceptedCount === 1 ? "card" : "cards"} to deck
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={saveAccepted}
                  disabled={isSaving}
                  size="lg"
                  className="bg-white/15 font-semibold text-white shadow-lg transition-all hover:bg-white/25 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Finish review
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Card-by-card review active
  if (!currentCard) return null;

  const progressPercent = (currentIndex / cards.length) * 100;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl md:p-8">
      {/* Header & Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-blue-200">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">
              {acceptedCount} accepted · {rejectedCount} rejected
            </span>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
              >
                <X className="size-3.5" />
                Cancel generation
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Edit Mode */}
      {editState ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-purple-200">Editing Card {currentIndex + 1}</h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-blue-100/80">Front (Question / Prompt)</label>
                <textarea
                  value={editState.front}
                  onChange={(e) => {
                    setEditState({ ...editState, front: e.target.value });
                  }}
                  maxLength={500}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-white focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none"
                />
                <div className="mt-1 text-right text-xs text-white/40">{editState.front.length}/500</div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-blue-100/80">Back (Answer / Explanation)</label>
                <textarea
                  value={editState.back}
                  onChange={(e) => {
                    setEditState({ ...editState, back: e.target.value });
                  }}
                  maxLength={2000}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-white focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none"
                />
                <div className="mt-1 text-right text-xs text-white/40">{editState.back.length}/2,000</div>
              </div>
            </div>

            {editError && (
              <div className="border-destructive/30 bg-destructive/10 text-destructive-foreground mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                <AlertTriangle className="text-destructive size-3.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveEdit}
                className="bg-purple-600 font-semibold text-white hover:bg-purple-700"
              >
                <Check className="size-3.5" />
                Save & Accept
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-2 text-xs font-medium tracking-wider text-blue-200/60 uppercase">Front (Question)</div>
              <p className="text-base leading-relaxed whitespace-pre-wrap text-white">{currentCard.front}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-2 text-xs font-medium tracking-wider text-purple-200/60 uppercase">Back (Answer)</div>
              <p className="text-base leading-relaxed whitespace-pre-wrap text-blue-100/90">{currentCard.back}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={reject}
              className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
            >
              <X className="size-4" />
              Reject
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={startEdit}
                className="border-white/20 bg-white/5 text-white hover:bg-white/15"
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                onClick={accept}
                className="bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-700"
              >
                <Check className="size-4" />
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
