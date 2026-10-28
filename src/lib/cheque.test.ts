import { describe, expect, it } from "vitest";

import { chequeFits, parseGbpAmount } from "./cheque";

describe("chequeFits", () => {
  it("matches every investor when no bucket is chosen", () => {
    expect(chequeFits({ min: 0, max: 0 }, "any")).toBe(true);
  });

  it("matches ranges that overlap the bucket", () => {
    expect(chequeFits({ min: 100_000, max: 500_000 }, "250k-1m")).toBe(true);
    expect(chequeFits({ min: 100_000, max: 500_000 }, "under-250k")).toBe(true);
    expect(chequeFits({ min: 100_000, max: 500_000 }, "1m-5m")).toBe(false);
  });

  it("treats a reversed range the same as an ordered one", () => {
    expect(chequeFits({ min: 8_000_000, max: 2_000_000 }, "over-5m")).toBe(true);
  });

  it("never matches an unknown cheque size to a specific bucket", () => {
    expect(chequeFits({ min: 0, max: 0 }, "under-250k")).toBe(false);
  });
});

describe("parseGbpAmount", () => {
  it("reads plain and shorthand amounts", () => {
    expect(parseGbpAmount("250000")).toBe(250_000);
    expect(parseGbpAmount("£250,000")).toBe(250_000);
    expect(parseGbpAmount("250k")).toBe(250_000);
    expect(parseGbpAmount("1.5m")).toBe(1_500_000);
    expect(parseGbpAmount("2bn")).toBe(2_000_000_000);
  });

  it("returns null for blank input", () => {
    expect(parseGbpAmount("  ")).toBeNull();
  });

  it("returns NaN for text it cannot read", () => {
    expect(parseGbpAmount("about a million")).toBeNaN();
    expect(parseGbpAmount("1m-2m")).toBeNaN();
  });
});
