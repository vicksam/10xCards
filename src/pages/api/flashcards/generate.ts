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
  const t0 = Date.now();
  // eslint-disable-next-line no-console
  console.log("[api/generate] Starting request for user:", context.locals.user?.id);

  // 1. Guard: Check authentication
  if (!context.locals.user) {
    // eslint-disable-next-line no-console
    console.log("[api/generate] 401 Unauthorized");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Guard: Parse request JSON body
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    // eslint-disable-next-line no-console
    console.log("[api/generate] 400 Invalid JSON");
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 3. Guard: Validate input with Zod
  const result = generateSchema.safeParse(body);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.log("[api/generate] 400 Validation error:", result.error.issues[0]?.message);
    return Response.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // 4. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.log("[api/generate] 503 Supabase not configured");
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 5. Generate flashcards
  // NFR: study text must not be logged or persisted
  try {
    // eslint-disable-next-line no-console
    console.log("[api/generate] Calling generateFlashcards...");
    const candidates = await generateFlashcards(result.data.text);
    // eslint-disable-next-line no-console
    console.log(`[api/generate] generateFlashcards returned ${candidates.length} cards in ${Date.now() - t0}ms`);

    if (candidates.length === 0) {
      const emptyResponse: GenerateResponse = {
        generationId: null,
        candidates: [],
      };
      return Response.json(emptyResponse, { status: 200 });
    }

    // eslint-disable-next-line no-console
    console.log("[api/generate] Inserting review row into Supabase...");
    const tDb = Date.now();
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

    // eslint-disable-next-line no-console
    console.log(
      `[api/generate] Supabase insert succeeded (id: ${data.id}) in ${Date.now() - tDb}ms. Total: ${Date.now() - t0}ms`,
    );

    const response: GenerateResponse = {
      generationId: data.id,
      candidates,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[api/generate] Error in generation after ${Date.now() - t0}ms:`, error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate flashcards" },
      { status: 500 },
    );
  }
};
