import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".astro"],
    reporters: ["verbose"],
    passWithNoTests: true,
    alias: {
      "astro:env/server": new URL("./src/__mocks__/astro-env-server.ts", import.meta.url).pathname,
    },
  },
});
