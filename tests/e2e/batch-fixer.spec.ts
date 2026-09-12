import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createAccessToken, ACCESS_COOKIE_NAME } from "../../lib/access-token";

// playwright.config.ts starts the dev server with ACCESS_TOKEN_SECRET set to
// this value and no Stripe keys, so the paywall renders as "unavailable" and
// an entitlement cookie can be minted here without touching Stripe.
const E2E_SECRET = "e2e-access-secret";
const FIXTURE = path.join(__dirname, "fixtures", "sample.epub");

test("without an access cookie the page shows the paywall and no batch form", async ({ page }) => {
  await page.goto("/batch-fixer");
  await expect(page.getByTestId("batch-paywall")).toBeVisible();
  await expect(page.getByTestId("purchase-unavailable")).toBeVisible();
  await expect(page.getByTestId("batch-unlocked")).toHaveCount(0);
});

test("checkout endpoint refuses when Stripe is not configured", async ({ request }) => {
  const response = await request.post("/api/checkout");
  expect(response.status()).toBe(503);
});

test("a forged or expired cookie does not unlock", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: ACCESS_COOKIE_NAME, value: createAccessToken("wrong-secret"), url: baseURL! }]);
  await page.goto("/batch-fixer");
  await expect(page.getByTestId("batch-paywall")).toBeVisible();
});

test("with a valid cookie, fixes two files and downloads one zip", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: ACCESS_COOKIE_NAME, value: createAccessToken(E2E_SECRET), url: baseURL! }]);
  await page.goto("/batch-fixer");
  await expect(page.getByTestId("batch-unlocked")).toBeVisible();

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "epub-batch-"));
  const second = path.join(tmp, "second.epub");
  await fs.copyFile(FIXTURE, second);

  await page.getByLabel("Choose .epub files (select several at once)").setInputFiles([FIXTURE, second]);
  await expect(page.getByTestId("batch-table")).toBeVisible();
  await expect(page.getByLabel("Title for sample.epub")).toHaveValue("Sample Fixture Book");

  await page.getByLabel("Author").fill("Batch Author");
  await page.getByLabel("Title for second.epub").fill("Second Book");
  await page.getByRole("button", { name: "Apply fixes to 2 files" }).click();
  await expect(page.getByTestId("batch-summary")).toContainText("2 of 2 files fixed.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all as .zip" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fixed-epubs.zip");
});
