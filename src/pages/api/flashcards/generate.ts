import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { generateFlashcards } from "@/lib/services/ai-generation";
import type { GenerateResponse } from "@/types";

export const prerender = false;

const generateSchema = z.object({
  text: z.string().trim().min(1, "Text cannot be empty").max(10000, "Text exceeds maximum length of 10,000 characters"),
});

export const POST: APIRoute = async (context) => {
  // 1. Guard: Check authentication
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Guard: Parse request JSON body
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 3. Guard: Validate input with Zod
  const result = generateSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // 4. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 5. Generate flashcards
  // NFR: study text must not be logged or persisted
  try {
    const candidates = await generateFlashcards(result.data.text, context.request.signal);

    if (context.request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    if (candidates.length === 0) {
      const emptyResponse: GenerateResponse = {
        generationId: null,
        candidates: [],
      };
      return Response.json(emptyResponse, { status: 200 });
    }

    // Clean up any unfinalized generation reviews for this user before creating a new one
    try {
      const { error: cleanupError } = await supabase
        .from("generation_reviews")
        .delete()
        .eq("user_id", context.locals.user.id)
        .is("finalized_at", null);

      if (cleanupError) {
        // eslint-disable-next-line no-console
        console.error("[api/generate] Cleanup unfinalized generation_reviews error:", cleanupError);
      }
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error("[api/generate] Cleanup unfinalized generation_reviews exception:", cleanupErr);
    }

    const { data, error } = await supabase
      .from("generation_reviews")
      .insert({
        user_id: context.locals.user.id,
        generated_count: candidates.length,
      })
      .select("id")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[api/generate] Supabase insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const response: GenerateResponse = {
      generationId: data.id,
      candidates,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    if (
      context.request.signal.aborted ||
      (error instanceof Error && (error.name === "AbortError" || error.name === "APIUserAbortError"))
    ) {
      return new Response(null, { status: 499 });
    }

    // eslint-disable-next-line no-console
    console.error("[api/generate] Error in generation:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate flashcards" },
      { status: 500 },
    );
  }
};
