import { useState, useCallback, useRef } from "react";
import type { CandidateCard, GenerateResponse } from "@/types";

export type GenerationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; generationId: string | null; candidates: CandidateCard[] }
  | { status: "error"; message: string; lastAttemptTimeout?: number };

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function isAbortReasonCancel(controller: AbortController | null, err: unknown): boolean {
  if (err === "CANCEL") return true;
  if (!controller) return false;
  const signal: unknown = controller.signal;
  if (typeof signal === "object" && signal !== null && "reason" in signal) {
    return signal.reason === "CANCEL";
  }
  return false;
}

export function useFlashcardGeneration() {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const [lastAttemptTimeout, setLastAttemptTimeout] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("CANCEL");
      abortControllerRef.current = null;
    }
    setState({ status: "idle" });
    setLastAttemptTimeout(null);
  }, []);

  const cancel = useCallback(async (generationId?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("CANCEL");
    }
    if (generationId) {
      try {
        await fetch(`/api/flashcards/generation/${generationId}`, {
          method: "DELETE",
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[useFlashcardGeneration] Error deleting unfinalized generation:", err);
      }
    }
    setState({ status: "idle" });
    setLastAttemptTimeout(null);
  }, []);

  const generate = useCallback(
    async (text: string, manualRetry?: boolean) => {
      // Abort any previous pending user request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort("CANCEL");
        abortControllerRef.current = null;
      }

      const isManual = manualRetry ?? state.status === "error";
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

      const executeAttempt = async (timeoutMs: number): Promise<GenerateResponse> => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const timeoutId = setTimeout(() => {
          controller.abort("TIMEOUT");
        }, timeoutMs);

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

      // Manual retry: 60s timeout
      if (isManual) {
        try {
          const data = await executeAttempt(60_000);
          abortControllerRef.current = null;
          setLastAttemptTimeout(null);
          setState({
            status: "success",
            generationId: data.generationId,
            candidates: data.candidates,
          });
          return;
        } catch (err) {
          if (isAbortReasonCancel(abortControllerRef.current, err)) {
            abortControllerRef.current = null;
            return;
          }
          abortControllerRef.current = null;
          const isAbort =
            (err instanceof DOMException && err.name === "AbortError") ||
            err === "TIMEOUT" ||
            (err instanceof Error && err.name === "AbortError");
          setLastAttemptTimeout(60);
          setState({
            status: "error",
            message: isAbort
              ? "Request timed out after 60 seconds"
              : err instanceof Error
                ? err.message
                : "Generation failed",
            lastAttemptTimeout: 60,
          });
          return;
        }
      }

      // Attempt 1: 30s timeout
      try {
        const data = await executeAttempt(30_000);
        abortControllerRef.current = null;
        setLastAttemptTimeout(null);
        setState({
          status: "success",
          generationId: data.generationId,
          candidates: data.candidates,
        });
        return;
      } catch (err) {
        if (isAbortReasonCancel(abortControllerRef.current, err)) {
          abortControllerRef.current = null;
          return;
        }
        const isAbort =
          (err instanceof DOMException && err.name === "AbortError") ||
          err === "TIMEOUT" ||
          (err instanceof Error && err.name === "AbortError");
        const status = typeof err === "object" && err && "status" in err ? (err as { status: number }).status : 0;
        const isRetryable = isAbort || isRetryableStatus(status) || status === 0;

        if (!isRetryable) {
          abortControllerRef.current = null;
          setLastAttemptTimeout(30);
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Generation failed",
            lastAttemptTimeout: 30,
          });
          return;
        }

        // Attempt 2: Silent retry with 45s timeout
        try {
          const retryData = await executeAttempt(45_000);
          abortControllerRef.current = null;
          setLastAttemptTimeout(null);
          setState({
            status: "success",
            generationId: retryData.generationId,
            candidates: retryData.candidates,
          });
          return;
        } catch (retryErr) {
          if (isAbortReasonCancel(abortControllerRef.current, retryErr)) {
            abortControllerRef.current = null;
            return;
          }
          abortControllerRef.current = null;
          const isRetryAbort =
            (retryErr instanceof DOMException && retryErr.name === "AbortError") ||
            retryErr === "TIMEOUT" ||
            (retryErr instanceof Error && retryErr.name === "AbortError");
          setLastAttemptTimeout(45);
          setState({
            status: "error",
            message: isRetryAbort
              ? "Request timed out after 45 seconds"
              : retryErr instanceof Error
                ? retryErr.message
                : "Network error. Please try again.",
            lastAttemptTimeout: 45,
          });
        }
      }
    },
    [state.status],
  );

  return { state, generate, reset, cancel, lastAttemptTimeout };
}
