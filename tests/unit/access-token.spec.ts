import { describe, it, expect } from "vitest";
import { createAccessToken, verifyAccessToken, ACCESS_TOKEN_TTL_MS } from "@/lib/access-token";

const SECRET = "unit-test-secret";
const NOW = 1_800_000_000_000;

describe("access token", () => {
  it("round-trips a freshly created token", () => {
    const token = createAccessToken(SECRET, NOW);
    expect(verifyAccessToken(SECRET, token, NOW)).toBe(true);
    expect(verifyAccessToken(SECRET, token, NOW + ACCESS_TOKEN_TTL_MS - 1)).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = createAccessToken(SECRET, NOW);
    expect(verifyAccessToken(SECRET, token, NOW + ACCESS_TOKEN_TTL_MS)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = createAccessToken("other-secret", NOW);
    expect(verifyAccessToken(SECRET, token, NOW)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const token = createAccessToken(SECRET, NOW);
    const [exp, sig] = token.split(".");
    const later = `${Number(exp) + 1_000_000}.${sig}`;
    expect(verifyAccessToken(SECRET, later, NOW)).toBe(false);
  });

  it("rejects malformed, missing, and unconfigured cases without throwing", () => {
    expect(verifyAccessToken(SECRET, undefined, NOW)).toBe(false);
    expect(verifyAccessToken(SECRET, "", NOW)).toBe(false);
    expect(verifyAccessToken(SECRET, "garbage", NOW)).toBe(false);
    expect(verifyAccessToken(SECRET, "123.notahexsig", NOW)).toBe(false);
    expect(verifyAccessToken("", createAccessToken(SECRET, NOW), NOW)).toBe(false);
    expect(() => createAccessToken("", NOW)).toThrow();
  });
});
