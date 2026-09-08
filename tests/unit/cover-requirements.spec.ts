import { describe, it, expect } from "vitest";
import { checkAmazonKdp, checkKobo, checkAppleBooks } from "@/lib/cover-requirements";

describe("checkAmazonKdp", () => {
  it("passes a properly sized JPEG cover with no warnings-worthy issues beyond the fixed colour-space caveat", () => {
    const result = checkAmazonKdp({ format: "jpeg", width: 1600, height: 2560, fileSizeBytes: 500_000 });
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("warns (does not hard-fail) on PNG format, since KDP's format rule applies to the standalone upload", () => {
    const result = checkAmazonKdp({ format: "png", width: 1600, height: 2560, fileSizeBytes: 500_000 });
    expect(result.pass).toBe(true);
    expect(result.warnings.some((w) => w.includes("JPEG"))).toBe(true);
  });

  it("fails an image below the minimum resolution (checked by shortest/longest side, not raw width/height)", () => {
    const result = checkAmazonKdp({ format: "jpeg", width: 400, height: 600, fileSizeBytes: 100_000 });
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("625"))).toBe(true);
  });

  it("passes a landscape image whose shortest side still meets the minimum", () => {
    const result = checkAmazonKdp({ format: "jpeg", width: 1000, height: 625, fileSizeBytes: 100_000 });
    expect(result.reasons).toEqual([]);
  });

  it("warns but does not fail on a ratio below 1.6:1, since KDP documents it as a recommendation", () => {
    const result = checkAmazonKdp({ format: "jpeg", width: 1000, height: 1200, fileSizeBytes: 100_000 });
    expect(result.pass).toBe(true);
    expect(result.warnings.some((w) => w.includes("1.6"))).toBe(true);
  });

  it("fails an oversized image", () => {
    const result = checkAmazonKdp({ format: "jpeg", width: 12000, height: 15000, fileSizeBytes: 100_000 });
    expect(result.pass).toBe(false);
  });
});

describe("checkKobo", () => {
  it("passes a portrait image under the 5MB limit", () => {
    const result = checkKobo({ format: "jpeg", width: 1600, height: 2400, fileSizeBytes: 4 * 1024 * 1024 });
    expect(result.pass).toBe(true);
  });

  it("fails a landscape or square image", () => {
    const result = checkKobo({ format: "jpeg", width: 2400, height: 1600, fileSizeBytes: 500_000 });
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("portrait"))).toBe(true);
  });

  it("fails a file over the 5MB limit", () => {
    const result = checkKobo({ format: "jpeg", width: 1600, height: 2400, fileSizeBytes: 6 * 1024 * 1024 });
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("5MB"))).toBe(true);
  });

  it("warns rather than fails on low resolution, since no documented Kobo minimum exists", () => {
    const result = checkKobo({ format: "jpeg", width: 900, height: 1400, fileSizeBytes: 100_000 });
    expect(result.pass).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("checkAppleBooks", () => {
  it("passes an image with a 1400px shorter side", () => {
    expect(checkAppleBooks({ format: "jpeg", width: 1400, height: 2100, fileSizeBytes: 500_000 }).pass).toBe(true);
  });

  it("fails an image below 1400px on the shorter side", () => {
    const result = checkAppleBooks({ format: "png", width: 1200, height: 1800, fileSizeBytes: 500_000 });
    expect(result.pass).toBe(false);
  });
});
