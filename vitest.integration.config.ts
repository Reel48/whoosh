import { defineConfig } from "vitest/config";
import path from "node:path";
import { LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY } from "./src/test/local";

/**
 * Integration tests (`*.itest.ts`) run the real money-engine RPC wrappers in
 * `src/lib/wb/*` against a LOCAL Supabase stack (`npx supabase start`). They are
 * kept out of the default `npm test` (which only matches `*.test.ts`) so unit
 * tests stay fast and Docker-free. Run with `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    // Tests share one local database; run files serially so the global-supply
    // delta assertions aren't perturbed by a concurrent file.
    fileParallelism: false,
    globalSetup: ["./src/test/integration.global.ts"],
    env: {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
