// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  devToolbar: { enabled: false },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Pre-bundle server-side packages at startup to prevent lazy-discovery mid-request,
      // which causes the SSR dep optimizer to re-run, invalidate chunk hashes, and crash.
      include: ["@supabase/supabase-js", "ts-fsrs"],
      // openai has a complex ESM structure that is incompatible with Vite's dep optimizer
      // (Vite itself says: "The dependency might be incompatible with the dep optimizer.
      // Try adding it to optimizeDeps.exclude"). Excluding it means Vite transforms it
      // module-by-module on demand instead of pre-bundling into shared chunks that can
      // become stale mid-request. The Cloudflare adapter's noExternal:true still bundles
      // it correctly for the runtime — this only affects the dev-mode optimizer path.
      exclude: ["openai"],
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
