import { test, expect } from "@playwright/test";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "sample.epub");

test("loads an EPUB, edits the title, and downloads a fixed copy", async ({ page }) => {
  await page.goto("/metadata-fixer");
  await page.getByLabel("Choose an .epub file").setInputFiles(FIXTURE);

  const titleInput = page.getByLabel("Title");
  await expect(titleInput).toHaveValue("Sample Fixture Book");
  await titleInput.fill("A Brand New Title");

  await page.getByRole("button", { name: "Apply fixes" }).click();
  await expect(page.getByText("Fixed file ready.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download fixed .epub" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sample-fixed.epub");
});
