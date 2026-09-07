import { OPENROUTER_API_KEY } from "astro:env/server";
import OpenAI from "openai";
import type { CandidateCard } from "@/types";

// NFR: study text must not be logged or persisted

const SYSTEM_PROMPT = `You are a flashcard generation assistant. Given study notes or text, generate concise and effective question-answer flashcard pairs to help a user learn and retain the material.

Output your response strictly as a JSON object in this format:
{
  "cards": [
    {
      "front": "Question or prompt (max 500 characters)",
      "back": "Answer or explanation (max 2000 characters)"
    }
  ]
}

Rules:
- Generate at most 15 high-quality cards.
- Each "front" must be a concise question or concept prompt (1-500 characters).
- Each "back" must be a clear, accurate answer or explanation (1-2000 characters).
- Do not include extra conversational text outside the JSON object.`;

/**
 * Strips optional outer Markdown code fence (e.g. ```json ... ``` or ``` ... ```).
 */
function cleanJsonString(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    if (lines.length >= 2 && lines[lines.length - 1].trim() === "```") {
      return lines.slice(1, -1).join("\n").trim();
    }
  }
  return trimmed;
}

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  timeout: 65_000,
  maxRetries: 0,
  defaultHeaders: {
    "HTTP-Referer": "https://10xcards.app",
    "X-Title": "10xCards",
  },
});

export async function generateFlashcards(text: string, signal?: AbortSignal): Promise<CandidateCard[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const completion = await openai.chat.completions.create(
    {
      // Gemini 2.5 Flash: supports JSON mode via OpenRouter, better cost/latency than gpt-4o-mini
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    },
    { signal },
  );

  const content = completion.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Empty response received from AI model");
  }

  const cleaned = cleanJsonString(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }

  let rawCards: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawCards = parsed;
  } else if (parsed && typeof parsed === "object" && "cards" in parsed && Array.isArray(parsed.cards)) {
    rawCards = parsed.cards;
  }

  const candidates: CandidateCard[] = [];
  for (const item of rawCards) {
    if (item && typeof item === "object" && "front" in item && "back" in item) {
      const rawFront = item.front;
      const rawBack = item.back;

      if (typeof rawFront === "string" && typeof rawBack === "string") {
        const front = rawFront.trim();
        const back = rawBack.trim();

        if (front.length >= 1 && front.length <= 500 && back.length >= 1 && back.length <= 2000) {
          candidates.push({ front, back });
        }
      }
    }
  }

  return candidates.slice(0, 15);
}
