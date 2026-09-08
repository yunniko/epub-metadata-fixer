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
    timeout: 120_000,
  },
});
