// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useFlashcardGeneration,
  isRetryableStatus,
  isAbortReasonCancel,
} from "@/components/hooks/useFlashcardGeneration";

function mockHangingFetch() {
  return vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
    return new Promise<Response>((_resolve, reject) => {
      if (options?.signal) {
        if (options.signal.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }
    });
  });
}

function mockJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("isRetryableStatus", () => {
  it.each([408, 429, 500, 503, 599])("returns true for %i", (status) => {
    expect(isRetryableStatus(status)).toBe(true);
  });

  it.each([200, 201, 400, 401, 403, 404, 422])("returns false for %i", (status) => {
    expect(isRetryableStatus(status)).toBe(false);
  });
});

describe("isAbortReasonCancel", () => {
  it('returns true when err is the string "CANCEL"', () => {
    expect(isAbortReasonCancel(null, "CANCEL")).toBe(true);
  });

  it('returns true when controller.signal.reason === "CANCEL"', () => {
    const controller = new AbortController();
    controller.abort("CANCEL");
    expect(isAbortReasonCancel(controller, new Error("aborted"))).toBe(true);
  });

  it('returns false when controller.signal.reason === "TIMEOUT"', () => {
    const controller = new AbortController();
    controller.abort("TIMEOUT");
    expect(isAbortReasonCancel(controller, new Error("timeout"))).toBe(false);
  });

  it("returns false when controller is null", () => {
    expect(isAbortReasonCancel(null, new Error("some error"))).toBe(false);
  });
});

describe("useFlashcardGeneration — timeout tier state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Attempt 1 → Attempt 2 path (timeout on attempt 1)", () => {
    it('stays "loading" after 29,999 ms', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });
      expect(result.current.state.status).toBe("loading");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_999);
      });
      expect(result.current.state.status).toBe("loading");
    });

    it('stays "loading" after 30,001 ms (attempt 2 starts silently)', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.state.status).toBe("loading");
    });

    it('transitions to "error" with lastAttemptTimeout=45 after attempt 2 times out at 45s', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });

      // 30s for attempt 1 + 45s for attempt 2 = 75s
      await act(async () => {
        await vi.advanceTimersByTimeAsync(75_001);
      });

      expect(result.current.state.status).toBe("error");
      if (result.current.state.status === "error") {
        expect(result.current.state.lastAttemptTimeout).toBe(45);
        expect(result.current.state.message).toBe("Request timed out after 45 seconds");
      }
    });

    it('transitions to "success" if attempt 2 resolves before timeout', async () => {
      let callCount = 0;
      global.fetch = vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
        callCount++;
        if (callCount === 1) {
          return new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          });
        }
        return Promise.resolve(
          mockJsonResponse({
            generationId: "gen-123",
            candidates: [{ front: "Q", back: "A" }],
          }),
        );
      });

      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });

      // Advance past 30s to trigger attempt 2 resolution
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });

      expect(result.current.state.status).toBe("success");
      if (result.current.state.status === "success") {
        expect(result.current.state.generationId).toBe("gen-123");
        expect(result.current.state.candidates).toEqual([{ front: "Q", back: "A" }]);
      }
    });

    it('stays "loading" through the full 30s+45s window = 75s before error', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(74_999);
      });
      expect(result.current.state.status).toBe("loading");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2);
      });
      expect(result.current.state.status).toBe("error");
    });
  });

  describe("Attempt 1 → Attempt 2 path (retryable HTTP error on attempt 1)", () => {
    it.each([408, 429, 500])("triggers attempt 2 when attempt 1 returns %i", async (status) => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(mockJsonResponse({ error: "Temporary issue" }, status));
        }
        return Promise.resolve(
          mockJsonResponse({
            generationId: "gen-retry",
            candidates: [{ front: "Retry Q", back: "Retry A" }],
          }),
        );
      });

      const { result } = renderHook(() => useFlashcardGeneration());

      await act(async () => {
        await result.current.generate("study text");
      });

      expect(callCount).toBe(2);
      expect(result.current.state.status).toBe("success");
    });

    it('stays "loading" through attempt 2 when attempt 1 returns 503', async () => {
      let callCount = 0;
      global.fetch = vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(mockJsonResponse({ error: "Unavailable" }, 503));
        }
        return new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      });

      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });

      // Let attempt 1 finish rejecting and attempt 2 start
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(callCount).toBe(2);
      expect(result.current.state.status).toBe("loading");
    });
  });

  describe("Immediate fail — non-retryable HTTP error", () => {
    it.each([400, 401, 403, 404])(
      'transitions to "error" immediately (no attempt 2) when attempt 1 returns %i',
      async (status) => {
        const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ error: `Client error ${status}` }, status));
        global.fetch = fetchMock;

        const { result } = renderHook(() => useFlashcardGeneration());

        await act(async () => {
          await result.current.generate("study text");
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.current.state.status).toBe("error");
      },
    );

    it("sets lastAttemptTimeout=30 on immediate non-retryable fail", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ error: "Bad request" }, 400));

      const { result } = renderHook(() => useFlashcardGeneration());

      await act(async () => {
        await result.current.generate("study text");
      });

      expect(result.current.state.status).toBe("error");
      if (result.current.state.status === "error") {
        expect(result.current.state.lastAttemptTimeout).toBe(30);
      }
    });
  });

  describe("Manual retry path (60s timeout)", () => {
    it('uses 60s timeout when called with state.status === "error" (isManual=true)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(mockJsonResponse({ error: "Failed" }, 400));

      const { result } = renderHook(() => useFlashcardGeneration());

      await act(async () => {
        await result.current.generate("study text");
      });
      expect(result.current.state.status).toBe("error");

      global.fetch = mockHangingFetch();

      act(() => {
        void result.current.generate("study text");
      });

      // At 30,001 ms, manual retry should still be loading (using 60s, not 30s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.state.status).toBe("loading");
    });

    it('stays "loading" at 59,999 ms on manual retry', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text", true);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(59_999);
      });
      expect(result.current.state.status).toBe("loading");
    });

    it('transitions to "error" with lastAttemptTimeout=60 after 60,001 ms on manual retry', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text", true);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_001);
      });

      expect(result.current.state.status).toBe("error");
      if (result.current.state.status === "error") {
        expect(result.current.state.lastAttemptTimeout).toBe(60);
        expect(result.current.state.message).toBe("Request timed out after 60 seconds");
      }
    });

    it('transitions to "success" if 60s attempt resolves before timeout', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          generationId: "gen-60",
          candidates: [{ front: "Q60", back: "A60" }],
        }),
      );

      const { result } = renderHook(() => useFlashcardGeneration());

      await act(async () => {
        await result.current.generate("study text", true);
      });

      expect(result.current.state.status).toBe("success");
    });
  });

  describe("Mode B regression — stale closure routing", () => {
    // Hook starts fresh (idle), first call fails (error state), second call (manual retry)
    // must route to the 60s path, not the 30s path.
    // If this test passes green, the bug is not present; keep as regression guard.
    it('routes to 60s timeout on second generate() call when state.status is "error"', async () => {
      // Step 1: initial call fails immediately with 400
      global.fetch = vi.fn().mockResolvedValueOnce(mockJsonResponse({ error: "Client error" }, 400));

      const { result } = renderHook(() => useFlashcardGeneration());

      await act(async () => {
        await result.current.generate("study text");
      });
      expect(result.current.state.status).toBe("error");

      // Step 2: second call with no explicit manualRetry arg — should infer isManual from status === "error"
      global.fetch = mockHangingFetch();

      act(() => {
        void result.current.generate("study text");
      });

      // At 30,001 ms, if it were routed to 30s auto path, it would attempt retry or error.
      // On 60s path, it remains loading past 30s up to 60s.
      // Mode B: stale closure not reproducible in isolated renderHook — behavior confirmed correct in this context
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.state.status).toBe("loading");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(result.current.state.status).toBe("error");
      if (result.current.state.status === "error") {
        expect(result.current.state.lastAttemptTimeout).toBe(60);
      }
    });
  });

  describe("Cancel", () => {
    it('transitions to "idle" when cancel() is called during loading', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });
      expect(result.current.state.status).toBe("loading");

      await act(async () => {
        await result.current.cancel();
      });
      expect(result.current.state.status).toBe("idle");
    });

    it('does not trigger a state "error" when fetch is cancelled via cancel()', async () => {
      global.fetch = mockHangingFetch();
      const { result } = renderHook(() => useFlashcardGeneration());

      act(() => {
        void result.current.generate("study text");
      });

      await act(async () => {
        await result.current.cancel();
      });

      // Advance timers by large amount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100_000);
      });

      expect(result.current.state.status).toBe("idle");
    });
  });
});
