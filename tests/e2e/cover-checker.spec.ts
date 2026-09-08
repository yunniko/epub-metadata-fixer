import { test, expect } from "@playwright/test";
import path from "node:path";

const VALID_COVER = path.join(__dirname, "fixtures", "cover-valid.jpg");
const SMALL_COVER = path.join(__dirname, "fixtures", "cover-small.png");

test("passes a properly sized JPEG cover on all three platforms", async ({ page }) => {
  await page.goto("/cover-checker");
  await page.getByLabel("Choose a cover image (PNG or JPEG)").setInputFiles(VALID_COVER);

  const report = page.getByTestId("cover-report");
  await expect(report).toBeVisible();
  await expect(report.getByText("1600×2560px")).toBeVisible();
  await expect(report.getByText("Amazon KDP: Meets requirements")).toBeVisible();
  await expect(report.getByText("Kobo Writing Life: Meets requirements")).toBeVisible();
  await expect(report.getByText("Apple Books: Meets requirements")).toBeVisible();
});

test("fails an undersized PNG cover with a reason on every platform", async ({ page }) => {
  await page.goto("/cover-checker");
  await page.getByLabel("Choose a cover image (PNG or JPEG)").setInputFiles(SMALL_COVER);

  const report = page.getByTestId("cover-report");
  await expect(report).toBeVisible();
  await expect(report.getByText("Amazon KDP: Does not meet requirements")).toBeVisible();
  await expect(report.getByText(/JPEG/)).toBeVisible();
});
