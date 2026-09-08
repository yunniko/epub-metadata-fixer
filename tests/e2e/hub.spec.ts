import { test, expect } from "@playwright/test";

test("home page links to all three tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EPUB Metadata Fixer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "EPUB Metadata Checker" })).toBeVisible();
  await expect(page.getByRole("link", { name: "EPUB Metadata Fixer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "EPUB Cover Image Checker" })).toBeVisible();
});
