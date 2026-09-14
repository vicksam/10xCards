import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIContext, AstroCookies } from "astro";
import { DELETE } from "@/pages/api/flashcards/generation/[id]";
import { POST } from "@/pages/api/flashcards/index";

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
    statusText: status === 200 ? "OK" : status === 204 ? "No Content" : "Error",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function getFetchCallDetails(fetchSpy: ReturnType<typeof vi.fn>, callIndex = 0) {
  const calls = fetchSpy.mock.calls as unknown as ([string | URL | Request, RequestInit | undefined] | undefined)[];
  const call = calls[callIndex];
  if (!call) return { url: "", method: "GET", body: null };

  const [calledUrl, init] = call;
  let url = "";
  let method = init?.method ?? "GET";
  let body: unknown = init?.body ?? null;

  if (typeof calledUrl === "string") {
    url = calledUrl;
  } else if (calledUrl instanceof URL) {
    url = calledUrl.toString();
  } else if (calledUrl instanceof Request) {
    url = calledUrl.url;
    method = calledUrl.method;
  }

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      // keep raw string if not json
    }
  }

  return { url, method, body };
}

describe("R6: Ownership Boundary Integration Tests", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("DELETE /api/flashcards/generation/:id", () => {
    function createMockDeleteContext(params: Record<string, string | undefined>, userId?: string): APIContext {
      return {
        params,
        locals: {
          user: userId ? ({ id: userId } as NonNullable<App.Locals["user"]>) : null,
        },
        request: new Request(`http://localhost/api/flashcards/generation/${params.id ?? ""}`, {
          method: "DELETE",
        }),
        cookies: createMockCookies(),
      } as unknown as APIContext;
    }

    it("appends user_id filter matching context.locals.user.id to prevent cross-user IDOR deletion", async () => {
      const userBId = "user-b-uuid-456";
      const userAGenerationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

      const fetchSpy = vi.fn().mockResolvedValue(createMockJsonResponse([], 200));
      globalThis.fetch = fetchSpy;

      const context = createMockDeleteContext({ id: userAGenerationId }, userBId);
      const response = await DELETE(context);

      expect(response.status).toBe(204);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const { url, method } = getFetchCallDetails(fetchSpy);

      // Verify the PostgREST request method and endpoint
      expect(method).toBe("DELETE");
      expect(url).toContain("/rest/v1/generation_reviews");

      // Verify strict ownership filters applied at the database edge
      expect(url).toContain(`id=eq.${userAGenerationId}`);
      expect(url).toContain(`user_id=eq.${userBId}`);
      expect(url).toContain("finalized_at=is.null");
    });

    it("rejects unauthenticated deletion requests with 401 without querying database", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const context = createMockDeleteContext({ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }, undefined);
      const response = await DELETE(context);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Unauthorized");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects invalid generation UUIDs with 400 without querying database", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const context = createMockDeleteContext({ id: "not-a-valid-uuid" }, "user-123");
      const response = await DELETE(context);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid generation ID");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/flashcards (Finalize generation review)", () => {
    function createMockPostContext(body: unknown, userId?: string): APIContext {
      return {
        locals: {
          user: userId ? ({ id: userId } as NonNullable<App.Locals["user"]>) : null,
        },
        request: new Request("http://localhost/api/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        cookies: createMockCookies(),
      } as unknown as APIContext;
    }

    it("invokes finalize_generation_review RPC with the specified generation_id and candidate cards", async () => {
      const userId = "user-b-uuid-456";
      const targetGenerationId = "b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22";
      const mockCards = [
        { front: "What is an IDOR?", back: "Insecure Direct Object Reference", outcome: "accepted" as const },
        { front: "What is RLS?", back: "Row Level Security", outcome: "edited" as const },
      ];

      const fetchSpy = vi.fn().mockResolvedValue(createMockJsonResponse(2, 200));
      globalThis.fetch = fetchSpy;

      const context = createMockPostContext(
        {
          generationId: targetGenerationId,
          cards: mockCards,
        },
        userId,
      );

      const response = await POST(context);

      expect(response.status).toBe(200);
      const resBody = (await response.json()) as { saved?: number };
      expect(resBody.saved).toBe(2);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const { url, method, body } = getFetchCallDetails(fetchSpy);

      // Verify POST to the security-definer RPC endpoint
      expect(url).toContain("/rest/v1/rpc/finalize_generation_review");
      expect(method).toBe("POST");

      // Verify correct RPC parameters passed
      expect(body).toEqual({
        generation_id: targetGenerationId,
        cards: mockCards,
      });
    });

    it("propagates database error if finalize_generation_review RPC fails or rejects ownership", async () => {
      const userId = "user-b-uuid-456";
      const userAGenerationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

      const fetchSpy = vi.fn().mockResolvedValue(
        createMockJsonResponse(
          {
            code: "P0001",
            message: "Generation review not found or already finalized",
          },
          400,
        ),
      );
      globalThis.fetch = fetchSpy;

      const context = createMockPostContext(
        {
          generationId: userAGenerationId,
          cards: [{ front: "Front", back: "Back", outcome: "accepted" as const }],
        },
        userId,
      );

      const response = await POST(context);

      expect(response.status).toBe(500);
      const resBody = (await response.json()) as { error?: string };
      expect(resBody.error).toBe("Generation review not found or already finalized");
    });

    it("rejects unauthenticated finalize requests with 401 without invoking RPC", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const context = createMockPostContext(
        {
          generationId: "b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22",
          cards: [],
        },
        undefined,
      );

      const response = await POST(context);

      expect(response.status).toBe(401);
      const resBody = (await response.json()) as { error?: string };
      expect(resBody.error).toBe("Unauthorized");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects invalid generationId with 400 without invoking RPC", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const context = createMockPostContext(
        {
          generationId: "invalid-uuid",
          cards: [],
        },
        "user-123",
      );

      const response = await POST(context);

      expect(response.status).toBe(400);
      const resBody = (await response.json()) as { error?: string };
      expect(resBody.error).toBe("Invalid generation ID");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
