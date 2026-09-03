import type { Database } from "@/types/database";

export type Flashcard = Database["public"]["Tables"]["flashcards"]["Row"];
export type FlashcardInsert = Database["public"]["Tables"]["flashcards"]["Insert"];
export type FlashcardUpdate = Database["public"]["Tables"]["flashcards"]["Update"];
export type CardSource = Database["public"]["Enums"]["card_source"];

export type GenerationReview = Database["public"]["Tables"]["generation_reviews"]["Row"];
export type GenerationReviewInsert = Database["public"]["Tables"]["generation_reviews"]["Insert"];
export type GenerationReviewUpdate = Database["public"]["Tables"]["generation_reviews"]["Update"];

// AI generation DTOs
export interface CandidateCard {
  front: string;
  back: string;
}

export interface GenerateResponse {
  generationId: string | null;
  candidates: CandidateCard[];
}

export interface UserKpiStats {
  generated: number;
  accepted: number;
  edited: number;
  rejected: number;
  acceptanceRate: number | null;
  aiCards: number;
  totalCards: number;
  aiPreferenceRate: number | null;
  trend: { date: string; generated: number; acceptanceRate: number }[];
}

export type ReviewLog = Database["public"]["Tables"]["review_logs"]["Row"];
export type ReviewLogInsert = Database["public"]["Tables"]["review_logs"]["Insert"];

// Study session DTOs
export interface ReviewRequest {
  flashcard_id: string; // uuid — card being rated
  rating: 1 | 2 | 3 | 4; // Again | Hard | Good | Easy
  next_flashcard_id?: string; // uuid — next card in queue (omit if last card)
}

export interface ReviewResponse {
  due: string; // ISO timestamp — next review date
  state: number; // 0-3 FSRS State enum
  scheduled_days: number; // days until next review (applied result)
  next_intervals: {
    // preview intervals for the *next* card's buttons
    again: number; // days if rated Again
    hard: number; // days if rated Hard
    good: number; // days if rated Good
    easy: number; // days if rated Easy
  } | null; // null when queue is exhausted (no next card)
}
