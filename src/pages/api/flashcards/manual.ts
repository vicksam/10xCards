import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const manualCardSchema = z.object({
  front: z.string().trim().min(1, "Front cannot be empty").max(500, "Front exceeds maximum length of 500 characters"),
  back: z.string().trim().min(1, "Back cannot be empty").max(2000, "Back exceeds maximum length of 2,000 characters"),
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
  const result = manualCardSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // 4. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 5. Insert manual flashcard
  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      user_id: context.locals.user.id,
      front: result.data.front,
      back: result.data.back,
      source: "manual",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data }, { status: 201 });
};
