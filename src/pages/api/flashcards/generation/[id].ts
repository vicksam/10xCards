import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const paramsSchema = z.object({
  id: z.uuid("Invalid generation ID"),
});

export const DELETE: APIRoute = async (context) => {
  // 1. Guard: Check authentication
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Guard: Validate URL params
  const paramResult = paramsSchema.safeParse(context.params);
  if (!paramResult.success) {
    return Response.json({ error: paramResult.error.issues[0]?.message ?? "Invalid generation ID" }, { status: 400 });
  }

  // 3. Guard: Check Supabase client configuration
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // 4. Execute deletion for unfinalized review owned by the user
  const { error } = await supabase
    .from("generation_reviews")
    .delete()
    .eq("id", paramResult.data.id)
    .eq("user_id", context.locals.user.id)
    .is("finalized_at", null);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[api/generation/delete] Error deleting generation review:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
};
