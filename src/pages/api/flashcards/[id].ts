import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const idSchema = z.uuid("Invalid card ID");

const updateCardSchema = z.object({
  front: z.string().trim().min(1, "Front cannot be empty").max(500, "Front exceeds maximum length of 500 characters"),
  back: z.string().trim().min(1, "Back cannot be empty").max(2000, "Back exceeds maximum length of 2,000 characters"),
});

export const PUT: APIRoute = async (context) => {
  // 1. Guard: Check authentication
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Guard: Validate card ID parameter
  const idResult = idSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: idResult.error.issues[0]?.message ?? "Invalid card ID" }, { status: 400 });
  }

  // 3. Guard: Parse request JSON body
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 4. Guard: Validate input with Zod
  const result = updateCardSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // 5. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 6. Update flashcard (enforcing user ownership)
  const { data, error } = await supabase
    .from("flashcards")
    .update({
      front: result.data.front,
      back: result.data.back,
    })
    .eq("id", idResult.data)
    .eq("user_id", context.locals.user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "Card not found" }, { status: 404 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data }, { status: 200 });
};

export const DELETE: APIRoute = async (context) => {
  // 1. Guard: Check authentication
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Guard: Validate card ID parameter
  const idResult = idSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: idResult.error.issues[0]?.message ?? "Invalid card ID" }, { status: 400 });
  }

  // 3. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 4. Delete flashcard (enforcing user ownership)
  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", idResult.data)
    .eq("user_id", context.locals.user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
};
