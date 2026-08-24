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
