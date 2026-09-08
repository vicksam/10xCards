import * as React from "react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCardManager } from "@/components/hooks/useCardManager";
import { cn } from "@/lib/utils";
import { Plus, Edit2, Trash2 } from "lucide-react";
import type { Flashcard } from "@/types";

interface CardManagerProps {
  initialCards?: Flashcard[];
  initialCount?: number;
}

export default function CardManager({ initialCards = [], initialCount = 0 }: CardManagerProps) {
  const { cards, count, isLoading, error, page, limit, setPage, fetchCards, createCard, updateCard, deleteCard } =
    useCardManager(initialCards, initialCount, 1, 10);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFront, setCreateFront] = useState("");
  const [createBack, setCreateBack] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal state
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete modal state
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  function handleOpenCreate() {
    setCreateFront("");
    setCreateBack("");
    setCreateError(null);
    setIsCreateOpen(true);
  }

  async function handleCreateSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const frontTrimmed = createFront.trim();
    const backTrimmed = createBack.trim();

    if (!frontTrimmed) {
      setCreateError("Front cannot be empty");
      return;
    }
    if (frontTrimmed.length > 500) {
      setCreateError("Front exceeds maximum length of 500 characters");
      return;
    }
    if (!backTrimmed) {
      setCreateError("Back cannot be empty");
      return;
    }
    if (backTrimmed.length > 2000) {
      setCreateError("Back exceeds maximum length of 2,000 characters");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const res = await createCard(frontTrimmed, backTrimmed);
    setIsCreating(false);

    if (res.success) {
      setIsCreateOpen(false);
      setCreateFront("");
      setCreateBack("");
    } else {
      setCreateError(res.error ?? "Failed to create card");
    }
  }

  function handleOpenEdit(card: Flashcard) {
    setEditingCard(card);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditError(null);
  }

  async function handleEditSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!editingCard) return;

    const frontTrimmed = editFront.trim();
    const backTrimmed = editBack.trim();

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

    setIsUpdating(true);
    setEditError(null);

    const res = await updateCard(editingCard.id, frontTrimmed, backTrimmed);
    setIsUpdating(false);

    if (res.success) {
      setEditingCard(null);
    } else {
      setEditError(res.error ?? "Failed to update card");
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingCard) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await deleteCard(deletingCard.id);
    setIsDeleting(false);
    if (res.success) {
      setDeletingCard(null);
    } else {
      setDeleteError(res.error ?? "Failed to delete card");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">My Flashcards</h1>
          <p className="mt-1 text-sm text-slate-400">Manage, review, and organize your collection of flashcards.</p>
        </div>
        <div>
          <Button
            onClick={handleOpenCreate}
            className="cursor-pointer gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:from-purple-500 hover:to-indigo-500"
          >
            <Plus className="size-4" />
            <span>Create Card</span>
          </Button>
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
              <TableHead className="w-[32%] text-slate-300">Front</TableHead>
              <TableHead className="w-[38%] text-slate-300">Back</TableHead>
              <TableHead className="w-[10%] text-slate-300">Source</TableHead>
              <TableHead className="w-[10%] text-slate-300">Due</TableHead>
              <TableHead className="w-[10%] text-right text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                    <span>Loading flashcards...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : cards.length === 0 ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  No flashcards found. Create one manually or generate via Dashboard!
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <TableRow key={card.id} className="border-white/5 transition-colors hover:bg-white/[0.03]">
                  <TableCell className="max-w-[220px] truncate font-medium text-white">{card.front}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-slate-300">{card.back}</TableCell>
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleOpenEdit(card);
                        }}
                        className="h-8 px-2 text-xs text-purple-300 hover:bg-white/10 hover:text-white"
                        title="Edit Card"
                      >
                        <Edit2 className="mr-1 size-3.5" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingCard(card);
                          setDeleteError(null);
                        }}
                        className="h-8 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        title="Delete Card"
                      >
                        <Trash2 className="mr-1 size-3.5" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </TableCell>
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

      {/* Create Card Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-lg">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-white">Create Flashcard</DialogTitle>
              <DialogDescription className="text-sm text-slate-400">
                Add a new flashcard manually to your study collection.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {createError && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-front" className="text-xs font-medium text-slate-200">
                    Front (Question)
                  </Label>
                  <span className="text-[10px] text-slate-400">{createFront.length}/500</span>
                </div>
                <Textarea
                  id="create-front"
                  value={createFront}
                  onChange={(e) => {
                    setCreateFront(e.target.value);
                  }}
                  placeholder="Enter front question or prompt..."
                  maxLength={500}
                  rows={3}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-purple-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-back" className="text-xs font-medium text-slate-200">
                    Back (Answer)
                  </Label>
                  <span className="text-[10px] text-slate-400">{createBack.length}/2000</span>
                </div>
                <Textarea
                  id="create-back"
                  value={createBack}
                  onChange={(e) => {
                    setCreateBack(e.target.value);
                  }}
                  placeholder="Enter back answer or explanation..."
                  maxLength={2000}
                  rows={5}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-purple-400"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                }}
                disabled={isCreating}
                className="border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating} className="bg-purple-600 text-white hover:bg-purple-500">
                {isCreating ? "Creating..." : "Create Card"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog
        open={Boolean(editingCard)}
        onOpenChange={(open) => {
          if (!open) setEditingCard(null);
        }}
      >
        <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-lg">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-white">Edit Flashcard</DialogTitle>
              <DialogDescription className="text-sm text-slate-400">
                Update the front and back content of this card.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editError && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-front" className="text-xs font-medium text-slate-200">
                    Front (Question)
                  </Label>
                  <span className="text-[10px] text-slate-400">{editFront.length}/500</span>
                </div>
                <Textarea
                  id="edit-front"
                  value={editFront}
                  onChange={(e) => {
                    setEditFront(e.target.value);
                  }}
                  placeholder="Enter front question or prompt..."
                  maxLength={500}
                  rows={3}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-purple-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-back" className="text-xs font-medium text-slate-200">
                    Back (Answer)
                  </Label>
                  <span className="text-[10px] text-slate-400">{editBack.length}/2000</span>
                </div>
                <Textarea
                  id="edit-back"
                  value={editBack}
                  onChange={(e) => {
                    setEditBack(e.target.value);
                  }}
                  placeholder="Enter back answer or explanation..."
                  maxLength={2000}
                  rows={5}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-purple-400"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingCard(null);
                }}
                disabled={isUpdating}
                className="border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating} className="bg-purple-600 text-white hover:bg-purple-500">
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Card Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingCard)}
        onOpenChange={(open) => {
          if (!open) setDeletingCard(null);
        }}
      >
        <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">Delete Flashcard</DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Are you sure you want to delete this flashcard? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {deleteError}
            </div>
          )}

          {deletingCard && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
              <p className="truncate font-medium text-white">{deletingCard.front}</p>
              <p className="mt-1 truncate text-xs text-slate-400">{deletingCard.back}</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeletingCard(null);
              }}
              disabled={isDeleting}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {isDeleting ? "Deleting..." : "Delete Flashcard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
