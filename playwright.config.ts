import { defineConfig } from "@playwright/test";

const PORT = 30111; // dev-server port used only for e2e runs, NOT the deploy port (30110)

export default defineConfig({
  testDir: "./tests/e2e",
  retries: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // Batch-fixer e2e: a known signing secret and deliberately NO Stripe keys.
    env: { ...process.env, ACCESS_TOKEN_SECRET: "e2e-access-secret", STRIPE_SECRET_KEY: "", STRIPE_PRICE_ID: "" },
    timeout: 120_000,
  },
});
