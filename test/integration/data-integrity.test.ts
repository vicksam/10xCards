import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIContext, AstroCookies } from "astro";
import { createClient } from "@/lib/supabase";

const { mockGenerateFlashcards } = vi.hoisted(() => ({
  mockGenerateFlashcards: vi.fn(),
}));

vi.mock("@/lib/services/ai-generation", () => ({
  generateFlashcards: mockGenerateFlashcards,
}));

import { POST } from "@/pages/api/flashcards/generate";

export function createMockCookies(): AstroCookies {
  return {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    headers: vi.fn(),
  } as unknown as AstroCookies;
}

export function createMockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("Data Integrity & Error Paths Integration - Setup and Mock Utilities", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("intercepts Supabase queries via global.fetch and returns simulated response", async () => {
    const mockData = [{ id: "test-1", name: "test item" }];
    const fetchSpy = vi.fn().mockResolvedValue(createMockJsonResponse(mockData));
    globalThis.fetch = fetchSpy;

    const client = createClient(new Headers(), createMockCookies());
    expect(client).not.toBeNull();
    if (!client) {
      throw new Error("Client initialization failed");
    }

    const { data, error } = await client.from("generation_reviews").select("id");

    expect(error).toBeNull();
    expect(data).toEqual(mockData);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/rest/v1/generation_reviews"), expect.anything());
  });
});

describe("R3: KPI Orphaned Row Test", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("excludes unfinalized generation reviews at database edge using finalized_at=not.is.null", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(createMockJsonResponse([]));
    globalThis.fetch = fetchSpy;

    const client = createClient(new Headers(), createMockCookies());
    expect(client).not.toBeNull();
    if (!client) {
      throw new Error("Client initialization failed");
    }

    const userId = "test-user-123";

    // Replicate KPI query from src/pages/stats.astro
    await client
      .from("generation_reviews")
      .select("generated_count, accepted_count, edited_count, rejected_count, created_at, finalized_at")
      .eq("user_id", userId)
      .not("finalized_at", "is", null)
      .order("created_at", { ascending: true });

    expect(fetchSpy).toHaveBeenCalled();
    const calls = fetchSpy.mock.calls as [string | URL | Request, ...unknown[]][];
    const calledUrl = calls[0]?.[0];
    const urlString =
      typeof calledUrl === "string"
        ? calledUrl
        : calledUrl instanceof URL
          ? calledUrl.toString()
          : calledUrl instanceof Request
            ? calledUrl.url
            : "";

    expect(urlString).toContain("/rest/v1/generation_reviews");
    expect(urlString).toContain("finalized_at=not.is.null");
    expect(urlString).toContain(`user_id=eq.${userId}`);
  });
});

describe("R7: Text Leakage Error Path Test", () => {
  function createMockContext(body: unknown, userId = "test-user-123"): APIContext {
    return {
      locals: {
        user: userId ? ({ id: userId } as NonNullable<App.Locals["user"]>) : null,
      },
      request: new Request("http://localhost/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      cookies: createMockCookies(),
    } as unknown as APIContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not leak sensitive study text into error response or console.error on AI failure", async () => {
    const sensitiveStudyText = "SUPER_SECRET_PATIENT_MEDICAL_HISTORY_DATA_98765";
    const sensitiveError = new Error(
      `OpenAI upstream failure while processing payload containing: ${sensitiveStudyText}`,
    );

    mockGenerateFlashcards.mockRejectedValueOnce(sensitiveError);

    const consoleErrorSpy = vi.spyOn(console, "error").mockReturnValue();

    const context = createMockContext({ text: sensitiveStudyText });
    const response = await POST(context);

    expect(response.status).toBe(500);

    const body = (await response.json()) as { error?: string };

    // Assert response body does not contain sensitive text and returns generic error
    expect(JSON.stringify(body)).not.toContain(sensitiveStudyText);
    expect(body.error).toBe("Internal server error during generation");

    // Assert console.error calls do not contain sensitive text
    expect(consoleErrorSpy).toHaveBeenCalled();
    for (const call of consoleErrorSpy.mock.calls) {
      for (const arg of call) {
        const text =
          typeof arg === "string" ? arg : arg instanceof Error ? `${arg.name}: ${arg.message}` : JSON.stringify(arg);
        expect(text).not.toContain(sensitiveStudyText);
      }
    }
  });
});
