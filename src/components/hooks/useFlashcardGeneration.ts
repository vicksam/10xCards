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
    // Abort any previous pending user request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({ status: "loading" });

    const parseError = async (res: Response): Promise<string> => {
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) return body.error;
      } catch {
        // Not JSON
      }
      return `Request failed with status ${res.status}`;
    };

    const executeAttempt = async (): Promise<GenerateResponse> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => {
        controller.abort("TIMEOUT");
      }, 35_000);

      try {
        const response = await fetch("/api/flashcards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await parseError(response);
          const error = new Error(message) as Error & { status: number };
          error.status = response.status;
          throw error;
        }

        const data = (await response.json()) as GenerateResponse;
        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Attempt 1
    try {
      const data = await executeAttempt();
      abortControllerRef.current = null;
      setState({
        status: "success",
        generationId: data.generationId,
        candidates: data.candidates,
      });
      return;
    } catch (err) {
      const isAbort = (err instanceof DOMException && err.name === "AbortError") || err === "TIMEOUT";
      const status = typeof err === "object" && err && "status" in err ? (err as { status: number }).status : 0;
      const isRetryable = isRetryableStatus(status) || (!isAbort && status === 0);

      if (!isRetryable) {
        abortControllerRef.current = null;
        setState({
          status: "error",
          message: isAbort
            ? "Request timed out after 35 seconds"
            : err instanceof Error
              ? err.message
              : "Generation failed",
        });
        return;
      }

      // Attempt 2 (silent retry on network / 5xx error)
      try {
        const retryData = await executeAttempt();
        abortControllerRef.current = null;
        setState({
          status: "success",
          generationId: retryData.generationId,
          candidates: retryData.candidates,
        });
        return;
      } catch (retryErr) {
        abortControllerRef.current = null;
        const isRetryAbort =
          (retryErr instanceof DOMException && retryErr.name === "AbortError") || retryErr === "TIMEOUT";
        setState({
          status: "error",
          message: isRetryAbort
            ? "Request timed out after 35 seconds"
            : retryErr instanceof Error
              ? retryErr.message
              : "Network error. Please try again.",
        });
      }
    }
  }, []);

  return { state, generate, reset };
}
