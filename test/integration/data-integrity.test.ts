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
