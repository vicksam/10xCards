import { useState, useCallback, useRef } from "react";
import type { CandidateCard, GenerateResponse } from "@/types";

export type GenerationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; generationId: string | null; candidates: CandidateCard[] }
  | { status: "error"; message: string };

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function useFlashcardGeneration() {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({ status: "idle" });
  }, []);

  const generate = useCallback(async (text: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30_000);

    setState({ status: "loading" });

    const makeRequest = async () => {
      return fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
    };

    const parseError = async (res: Response): Promise<string> => {
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) return body.error;
      } catch {
        // Response wasn't JSON
      }
      return `Request failed with status ${res.status}`;
    };

    try {
      // Attempt 1
      try {
        const response = await makeRequest();
        if (response.ok) {
          const data = (await response.json()) as GenerateResponse;
          setState({
            status: "success",
            generationId: data.generationId,
            candidates: data.candidates,
          });
          return;
        }

        if (!isRetryableStatus(response.status)) {
          const message = await parseError(response);
          setState({ status: "error", message });
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState({ status: "error", message: "Request timed out after 30 seconds" });
          return;
        }
        // Network error on attempt 1: fall through to retry
      }

      // Attempt 2 (silent retry)
      try {
        const retryResponse = await makeRequest();
        if (retryResponse.ok) {
          const data = (await retryResponse.json()) as GenerateResponse;
          setState({
            status: "success",
            generationId: data.generationId,
            candidates: data.candidates,
          });
          return;
        }

        const message = await parseError(retryResponse);
        setState({ status: "error", message });
      } catch (retryErr) {
        if (retryErr instanceof DOMException && retryErr.name === "AbortError") {
          setState({ status: "error", message: "Request timed out after 30 seconds" });
        } else {
          setState({
            status: "error",
            message: retryErr instanceof Error ? retryErr.message : "Network error. Please try again.",
          });
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  return { state, generate, reset };
}
