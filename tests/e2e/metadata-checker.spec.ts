import { test, expect } from "@playwright/test";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "sample.epub");

test("checks a valid EPUB and reports no spec issues plus a passing cover", async ({ page }) => {
  await page.goto("/metadata-checker");
  await page.getByLabel("Choose an .epub file").setInputFiles(FIXTURE);

  const report = page.getByTestId("checker-report");
  await expect(report).toBeVisible();
  await expect(report.getByText("Sample Fixture Book")).toBeVisible();
  await expect(report.getByText("Test Author")).toBeVisible();
  await expect(report.getByText("No issues found")).toBeVisible();
  await expect(report.getByText("Amazon KDP: Meets requirements")).toBeVisible();
  await expect(report.getByText("Kobo Writing Life: Meets requirements")).toBeVisible();
  await expect(report.getByText("Apple Books: Meets requirements")).toBeVisible();
});
