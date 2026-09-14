// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import StudySession from "@/components/StudySession";
import { useStudySession } from "@/components/hooks/useStudySession";
import type { Flashcard, ReviewResponse } from "@/types";

const mockCards: Flashcard[] = [
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    user_id: "user-123",
    front: "What is the capital of France?",
    back: "Paris",
    source: "ai",
    state: 0,
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    user_id: "user-123",
    front: "What is the capital of Germany?",
    back: "Berlin",
    source: "ai",
    state: 0,
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function createMockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? "OK" : status === 401 ? "Unauthorized" : "Error",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("R5: Auth Expiry During Study Session — useStudySession Hook", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sets isAuthExpired to true and captures error message on 401 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ error: "Unauthorized" }, 401));

    const { result } = renderHook(() => useStudySession(mockCards));

    expect(result.current.isAuthExpired).toBe(false);
    expect(result.current.submitError).toBeNull();

    await act(async () => {
      await result.current.rate(3);
    });

    expect(result.current.isAuthExpired).toBe(true);
    expect(result.current.submitError).toBe("Unauthorized");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.remainingCount).toBe(2);
  });

  it("does not set isAuthExpired on non-401 error response (e.g. 500)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ error: "Internal Server Error" }, 500));

    const { result } = renderHook(() => useStudySession(mockCards));

    await act(async () => {
      await result.current.rate(3);
    });

    expect(result.current.isAuthExpired).toBe(false);
    expect(result.current.submitError).toBe("Internal Server Error");
    expect(result.current.remainingCount).toBe(2);
  });

  it("resets isAuthExpired to false on subsequent successful retry", async () => {
    let callCount = 0;
    const mockSuccessData: ReviewResponse = {
      due: new Date(Date.now() + 86400000).toISOString(),
      state: 1,
      scheduled_days: 1,
      next_intervals: {
        again: 1,
        hard: 1,
        good: 2,
        easy: 4,
      },
    };

    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createMockResponse({ error: "Unauthorized" }, 401);
      }
      return createMockResponse(mockSuccessData, 200);
    });

    const { result } = renderHook(() => useStudySession(mockCards));

    // First attempt fails with 401
    await act(async () => {
      await result.current.rate(3);
    });
    expect(result.current.isAuthExpired).toBe(true);
    expect(result.current.remainingCount).toBe(2);

    // Second attempt succeeds
    await act(async () => {
      await result.current.rate(3);
    });
    expect(result.current.isAuthExpired).toBe(false);
    expect(result.current.submitError).toBeNull();
    expect(result.current.remainingCount).toBe(1);
  });
});

describe("R5: Auth Expiry During Study Session — StudySession Component UI", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("renders inline 'Session Expired' error and 'Sign in' link when review API returns 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ error: "Unauthorized" }, 401));

    render(React.createElement(StudySession, { cards: mockCards }));

    // Initial state: Question visible, no error box
    expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
    expect(screen.queryByText("Session Expired")).not.toBeInTheDocument();

    // Flip card to show answer
    const showAnswerButton = screen.getByRole("button", { name: /Show answer/i });
    fireEvent.click(showAnswerButton);

    // Answer and rating buttons should be visible
    expect(screen.getByText("Paris")).toBeInTheDocument();
    const goodButton = screen.getByRole("button", { name: /Good/i });
    expect(goodButton).toBeInTheDocument();

    // Click rating button to trigger API review
    await act(async () => {
      fireEvent.click(goodButton);
      await Promise.resolve();
    });

    // Verify Session Expired UI is shown
    expect(screen.getByText("Session Expired")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your session has expired\. Sign in in a new tab, then try rating again to save your progress\./i,
      ),
    ).toBeInTheDocument();

    // Verify Sign in button exists with correct href and attributes
    const signinLink = screen.getByRole("link", { name: /Sign in/i });
    expect(signinLink).toBeInTheDocument();
    expect(signinLink).toHaveAttribute("href", "/auth/signin");
    expect(signinLink).toHaveAttribute("target", "_blank");
    expect(signinLink).toHaveAttribute("rel", "noopener noreferrer");

    // Card state should remain preserved (front and back still displayed)
    expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("renders generic error box without 'Session Expired' UI on 500 error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ error: "Database error occurred" }, 500));

    render(React.createElement(StudySession, { cards: mockCards }));

    // Flip card
    fireEvent.click(screen.getByRole("button", { name: /Show answer/i }));

    // Click Good
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Good/i }));
      await Promise.resolve();
    });

    // Generic error shown, auth expired not shown
    expect(screen.queryByText("Session Expired")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
    expect(screen.getByText("Database error occurred")).toBeInTheDocument();
  });

  it("clears auth expiry UI and progresses to next card when rating succeeds after re-authentication", async () => {
    let callCount = 0;
    const mockSuccessData: ReviewResponse = {
      due: new Date(Date.now() + 86400000).toISOString(),
      state: 1,
      scheduled_days: 1,
      next_intervals: {
        again: 1,
        hard: 1,
        good: 2,
        easy: 4,
      },
    };

    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createMockResponse({ error: "Unauthorized" }, 401);
      }
      return createMockResponse(mockSuccessData, 200);
    });

    render(React.createElement(StudySession, { cards: mockCards }));

    // Flip card
    fireEvent.click(screen.getByRole("button", { name: /Show answer/i }));

    // Rate Good - fails with 401
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Good/i }));
      await Promise.resolve();
    });

    expect(screen.getByText("Session Expired")).toBeInTheDocument();

    // User "re-authenticates" in another tab, and clicks Good again in this tab
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Good/i }));
      await Promise.resolve();
    });

    // Error cleared, next card displayed
    expect(screen.queryByText("Session Expired")).not.toBeInTheDocument();
    expect(screen.getByText("What is the capital of Germany?")).toBeInTheDocument();
  });
});
