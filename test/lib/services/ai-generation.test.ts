import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";

const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() };
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

import { cleanJsonString, generateFlashcards } from "@/lib/services/ai-generation";

describe("cleanJsonString", () => {
  it("returns trimmed string unchanged when no fence", () => {
    const input = '  {"cards": []}  ';
    expect(cleanJsonString(input)).toBe('{"cards": []}');
  });

  it("strips ``` fence when content is wrapped", () => {
    const input = '```\n{\n  "cards": []\n}\n```';
    expect(cleanJsonString(input)).toBe('{\n  "cards": []\n}');
  });

  it("strips ```json fence when content is wrapped", () => {
    const input = '```json\n{\n  "cards": []\n}\n```';
    expect(cleanJsonString(input)).toBe('{\n  "cards": []\n}');
  });

  it("does NOT strip when closing fence is missing", () => {
    const input = '```json\n{\n  "cards": []\n}';
    expect(cleanJsonString(input)).toBe(input.trim());
  });
});

describe("generateFlashcards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Case 1 — null/empty/whitespace content", () => {
    it('throws "Empty response received from AI model" when content is null', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      await expect(generateFlashcards("study notes")).rejects.toThrow("Empty response received from AI model");
    });

    it('throws "Empty response received from AI model" when content is whitespace-only', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "   \n\t  ",
            },
          },
        ],
      });

      await expect(generateFlashcards("study notes")).rejects.toThrow("Empty response received from AI model");
    });
  });

  describe("Case 2 — fenced JSON", () => {
    it("parses JSON successfully when wrapped in ```json fence", async () => {
      const payload = {
        cards: [{ front: "What is TypeScript?", back: "A typed superset of JavaScript" }],
      };
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "What is TypeScript?", back: "A typed superset of JavaScript" }]);
    });

    it("parses JSON successfully when wrapped in plain ``` fence", async () => {
      const payload = {
        cards: [{ front: "What is Vitest?", back: "A Vite-native test runner" }],
      };
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: `\`\`\`\n${JSON.stringify(payload)}\n\`\`\``,
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "What is Vitest?", back: "A Vite-native test runner" }]);
    });
  });

  describe("Case 3 — bare array response", () => {
    it("accepts a top-level JSON array (no .cards wrapper)", async () => {
      const payload = [
        { front: "Card 1 Question", back: "Card 1 Answer" },
        { front: "Card 2 Question", back: "Card 2 Answer" },
      ];
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(payload),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([
        { front: "Card 1 Question", back: "Card 1 Answer" },
        { front: "Card 2 Question", back: "Card 2 Answer" },
      ]);
    });
  });

  describe("Case 4 — >15 cards", () => {
    it("returns exactly 15 candidates when LLM returns 20 valid cards", async () => {
      const twentyCards = Array.from({ length: 20 }, (_, i) => ({
        front: `Question ${i + 1}`,
        back: `Answer ${i + 1}`,
      }));
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ cards: twentyCards }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toHaveLength(15);
      expect(result[0]).toEqual({ front: "Question 1", back: "Answer 1" });
      expect(result[14]).toEqual({ front: "Question 15", back: "Answer 15" });
    });
  });

  describe("Case 5 — over-limit front/back", () => {
    it("silently drops cards with front > 500 chars", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  { front: "A".repeat(501), back: "Valid answer" },
                  { front: "Valid question", back: "Valid answer" },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "Valid question", back: "Valid answer" }]);
    });

    it("silently drops cards with back > 2000 chars", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  { front: "Valid question", back: "B".repeat(2001) },
                  { front: "Valid question 2", back: "Valid answer 2" },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "Valid question 2", back: "Valid answer 2" }]);
    });

    it("silently drops cards with empty front after trim", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  { front: "   ", back: "Valid answer" },
                  { front: "Valid question", back: "Valid answer" },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "Valid question", back: "Valid answer" }]);
    });

    it("silently drops cards with empty back after trim", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  { front: "Valid question", back: "   " },
                  { front: "Valid question", back: "Valid answer" },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "Valid question", back: "Valid answer" }]);
    });
  });

  describe("Case 6 — malformed JSON", () => {
    it('throws "Failed to parse AI response as JSON" on invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"cards": [{"front": "broken json...',
            },
          },
        ],
      });

      await expect(generateFlashcards("study notes")).rejects.toThrow("Failed to parse AI response as JSON");
    });
  });

  describe("Case 7 — happy path", () => {
    it("returns CandidateCard[] with trimmed front and back", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [{ front: "  Front with spaces  ", back: "  Back with spaces  " }],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: "Front with spaces", back: "Back with spaces" }]);
    });

    it("accepts cards at the exact limit boundaries (front=500, back=2000)", async () => {
      const exactFront = "F".repeat(500);
      const exactBack = "B".repeat(2000);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [{ front: exactFront, back: exactBack }],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([{ front: exactFront, back: exactBack }]);
    });
  });

  describe("Case 8 — empty candidate list", () => {
    it("returns [] when JSON has no .cards key and is not an array", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ status: "ok", data: "something else" }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([]);
    });

    it("returns [] when all cards fail validation", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  { front: "", back: "" },
                  { front: "A".repeat(501), back: "B".repeat(2001) },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([]);
    });

    it("returns [] (does not throw) when valid JSON has zero valid entries", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ cards: [] }),
            },
          },
        ],
      });

      const result = await generateFlashcards("study notes");
      expect(result).toEqual([]);
    });
  });

  describe("text privacy NFR", () => {
    let logSpy: MockInstance;
    let errorSpy: MockInstance;
    let warnSpy: MockInstance;
    let infoSpy: MockInstance;
    const confidentialText = "SUPER_SECRET_USER_STUDY_TEXT_12345";

    beforeEach(() => {
      logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function assertTextNotLogged(secret: string) {
      const allSpies = [logSpy, errorSpy, warnSpy, infoSpy];
      for (const spy of allSpies) {
        for (const call of spy.mock.calls) {
          for (const arg of call as unknown[]) {
            const formatted = typeof arg === "string" ? arg : JSON.stringify(arg);
            expect(formatted).not.toContain(secret);
          }
        }
      }
    }

    it("does not log the study text on success", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [{ front: "Q", back: "A" }],
              }),
            },
          },
        ],
      });

      await generateFlashcards(confidentialText);
      assertTextNotLogged(confidentialText);
    });

    it("does not log the study text when AI returns empty content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "",
            },
          },
        ],
      });

      await expect(generateFlashcards(confidentialText)).rejects.toThrow();
      assertTextNotLogged(confidentialText);
    });

    it("does not log the study text when JSON parse fails", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "invalid json content",
            },
          },
        ],
      });

      await expect(generateFlashcards(confidentialText)).rejects.toThrow();
      assertTextNotLogged(confidentialText);
    });
  });
});
