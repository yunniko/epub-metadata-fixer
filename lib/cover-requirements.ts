// Cover-image thresholds for the three storefronts self-published authors
// most commonly target. Sourcing quality varies per platform — labelled
// per-check below rather than with one blanket caveat, after a domain-expert
// review (2026-09-08, see docs/domain-reference.md) found one flatly wrong
// number (Kobo's file-size cap) and one over-strict rule (KDP's ratio) in an
// earlier version of this file:
//
//   Amazon KDP: figures corroborate across multiple independent publishing-
//   service round-ups, all citing KDP's own Cover Image Guidelines page
//   (https://kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX), which this
//   tool could not fetch directly (WebFetch unavailable this run). KDP's own
//   wording describes 1600x2560px / 1.6:1 as the RECOMMENDED/ideal ratio, not
//   a stated hard-rejection rule — treated here as a soft recommendation, not
//   a pass/fail criterion, after an earlier version wrongly hard-failed it.
//   KDP's own minimum-size wording is "625px on the shortest side and 1000px
//   on the longest side", which this file checks directly (not just
//   width/height, which would misjudge a landscape image).
//
//   Kobo Writing Life: the 5MB file-size cap and "portrait, not landscape"
//   rule come from Kobo's own Help Centre article ("Cover Image Tips",
//   kobowritinglife.zendesk.com) — a primary source. Kobo's own help text
//   does not state a specific minimum pixel count; third-party guides
//   disagree with each other on a number (1400px vs 2400px), so this file
//   does not assert one as a hard requirement, only a soft resolution
//   recommendation.
//
//   Apple Books: the 1400px-shorter-side minimum comes from Apple's own
//   Book Cover Art guide (help.apple.com/itc/booksassetguide), a primary
//   source reached via a search snippet (not a fetched page — WebFetch was
//   unavailable this run, so treat as high-but-not-certain confidence).
//
// Not checked at all (real gaps, not silently assumed fine): colour space
// (KDP/Apple require RGB, reject CMYK) and whether the image is upscaled/
// blurry — neither is reliably detectable from just width/height/format.
export interface ImageInfo {
  format: "png" | "jpeg";
  width: number;
  height: number;
  fileSizeBytes: number;
}

export interface PlatformCheckResult {
  platform: string;
  pass: boolean;
  reasons: string[];
  warnings: string[];
  sourceNote: string;
}

export function checkAmazonKdp(image: ImageInfo): PlatformCheckResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const shortSide = Math.min(image.width, image.height);
  const longSide = Math.max(image.width, image.height);

  if (image.format !== "jpeg") {
    warnings.push(
      "KDP's standalone cover upload requires JPEG or TIFF (PNG is rejected there). If this image is embedded inside your EPUB rather than uploaded separately as your KDP cover file, this doesn't apply to it directly.",
    );
  }
  if (shortSide < 625 || longSide < 1000) {
    reasons.push(`Below KDP's stated minimum of 625px on the shortest side and 1000px on the longest side (this image is ${image.width}×${image.height}px).`);
  }
  const ratio = longSide / shortSide;
  if (ratio < 1.6) {
    warnings.push(`KDP recommends a height:width ratio of at least 1.6:1 for the sharpest result on Kindle devices (this image is ${ratio.toFixed(2)}:1); ideal size is 1600×2560px. Not a documented hard rejection rule, so this is a recommendation, not a failure.`);
  }
  if (image.width > 10000 || image.height > 10000) {
    reasons.push("Exceeds KDP's maximum of 10,000×10,000px.");
  }
  if (image.fileSizeBytes > 50 * 1024 * 1024) {
    reasons.push("Exceeds KDP's 50MB file size limit.");
  }
  warnings.push("Colour space (RGB vs. CMYK) isn't checked by this tool — KDP requires RGB and rejects CMYK.");

  return {
    platform: "Amazon KDP",
    pass: reasons.length === 0,
    reasons,
    warnings,
    sourceNote: "Aggregated from multiple independent publishing-service guides citing KDP's own Cover Image Guidelines (not fetched directly this run).",
  };
}

export function checkKobo(image: ImageInfo): PlatformCheckResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (image.width >= image.height) {
    reasons.push("Kobo Writing Life requires a portrait cover, not landscape or square.");
  }
  const shorterSide = Math.min(image.width, image.height);
  if (shorterSide < 2000) {
    warnings.push(`For a sharp cover on high-DPI devices, aim for at least ~2000px on the shorter side (this image's shorter side is ${shorterSide}px). Kobo's own help page doesn't publish an exact minimum, and third-party guides disagree on one, so this is a recommendation, not a documented requirement.`);
  }
  if (image.fileSizeBytes > 5 * 1024 * 1024) {
    reasons.push("Exceeds Kobo Writing Life's 5MB file size limit.");
  }

  return {
    platform: "Kobo Writing Life",
    pass: reasons.length === 0,
    reasons,
    warnings,
    sourceNote: "File-size limit and portrait requirement are from Kobo Writing Life's own Help Centre; the resolution figure is an unverified third-party recommendation, not a documented Kobo minimum.",
  };
}

export function checkAppleBooks(image: ImageInfo): PlatformCheckResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const shorterSide = Math.min(image.width, image.height);
  if (shorterSide < 1400) {
    reasons.push(`Apple Books requires at least 1400px on the shorter side (this image's shorter side is ${shorterSide}px).`);
  }
  warnings.push("Colour space (Apple recommends sRGB) and image sharpness/upscaling aren't checked by this tool.");

  return {
    platform: "Apple Books",
    pass: reasons.length === 0,
    reasons,
    warnings,
    sourceNote: "From Apple's own Book Cover Art guide, reached via a search snippet rather than a fetched page this run.",
  };
}

export function checkAllPlatforms(image: ImageInfo): PlatformCheckResult[] {
  return [checkAmazonKdp(image), checkKobo(image), checkAppleBooks(image)];
}
