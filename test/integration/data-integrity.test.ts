import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AstroCookies } from "astro";
import { createClient } from "@/lib/supabase";

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
