import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext, AstroCookies } from "astro";
import type { GenerateResponse } from "@/types";

const { mockGenerateFlashcards, mockDelete, mockEq, mockIs, mockInsert, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn(() => ({ single: mockSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockIs = vi.fn();
  const mockEq = vi.fn(() => ({ is: mockIs }));
  const mockDelete = vi.fn(() => ({ eq: mockEq }));
  const mockGenerateFlashcards = vi.fn();

  return {
    mockGenerateFlashcards,
    mockDelete,
    mockEq,
    mockIs,
    mockInsert,
    mockSingle,
  };
});

vi.mock("@/lib/services/ai-generation", () => ({
  generateFlashcards: mockGenerateFlashcards,
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "generation_reviews") {
        return {
          delete: mockDelete,
          insert: mockInsert,
        };
      }
      return {};
    }),
  })),
}));

import { POST } from "@/pages/api/flashcards/generate";

function createMockContext(body: unknown, userId = "user-123"): APIContext {
  return {
    locals: {
      user: userId ? ({ id: userId } as NonNullable<App.Locals["user"]>) : null,
    },
    request: new Request("http://localhost/api/flashcards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as AstroCookies,
  } as unknown as APIContext;
}

describe("POST /api/flashcards/generate - Synchronous Cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateFlashcards.mockResolvedValue([{ front: "What is TDD?", back: "Test Driven Development" }]);
    mockIs.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: { id: "gen-new" }, error: null });
  });

  it("cleans up unfinalized generation reviews for the user before inserting a new record", async () => {
    const context = createMockContext({ text: "Valid text for generating cards" });
    const res = await POST(context);

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
    expect(mockIs).toHaveBeenCalledWith("finalized_at", null);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      generated_count: 1,
    });
  });

  it("proceeds with generation even if cleanup delete fails", async () => {
    mockIs.mockResolvedValueOnce({ error: { message: "DB cleanup failed" } });
    const context = createMockContext({ text: "Valid text for generating cards" });
    const res = await POST(context);

    expect(res.status).toBe(200);
    const json = (await res.json()) as GenerateResponse;
    expect(json.generationId).toBe("gen-new");
    expect(mockInsert).toHaveBeenCalled();
  });
});
