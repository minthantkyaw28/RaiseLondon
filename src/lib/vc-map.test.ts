import { describe, expect, it } from "vitest";

import type { Review } from "@/data/types";
import { summarizeReviews } from "./ratings";

describe("summarizeReviews", () => {
  const score = (n: 1 | 5) => ({ responsiveness: n, valueAdd: n, fairTerms: n, founderFirst: n });
  const base = { investorId: "inv_1", portfolioCompany: "X", tags: [], date: "2026-01-01" };

  it("weights verified reviews above unverified noise", () => {
    const reviews: Review[] = [
      { ...base, id: "r1", verified: true, scores: score(5) },
      { ...base, id: "r2", verified: false, scores: score(1) },
    ];
    const s = summarizeReviews(reviews);
    expect(s.overall).toBeCloseTo(4.2, 1);
    expect(s.verifiedCount).toBe(1);
  });

  it("returns null scores with no reviews", () => {
    expect(summarizeReviews([]).overall).toBeNull();
  });
});
