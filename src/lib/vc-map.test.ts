import { describe, expect, it } from "vitest";

import type { Contact, Investor, Review } from "@/data/types";
import { summarizeReviews } from "./ratings";
import { findWarmPaths } from "./warm-paths";

const investor = {
  id: "inv_1",
  partners: [
    { id: "p_1", name: "Ada", title: "Partner", focus: [] },
    { id: "p_2", name: "Bo", title: "Principal", focus: [] },
  ],
} as unknown as Investor;

describe("findWarmPaths", () => {
  it("finds direct and two-hop intros, shortest first", () => {
    const contacts: Contact[] = [
      { id: "c_1", name: "Second hop", relation: "", knows: ["p_2"] },
      { id: "c_2", name: "Direct", relation: "", knows: ["p_1", "c_1"] },
    ];
    const paths = findWarmPaths(investor, contacts);
    expect(paths.map((p) => p.via.map((c) => c.id))).toEqual([["c_2"], ["c_1"], ["c_2", "c_1"]]);
  });

  it("returns nothing when no contact reaches a partner", () => {
    expect(findWarmPaths(investor, [{ id: "c_1", name: "", relation: "", knows: [] }])).toEqual([]);
  });
});

describe("summarizeReviews", () => {
  const score = (n: 1 | 5) => ({ responsiveness: n, valueAdd: n, fairTerms: n, founderFirst: n });
  const base = { investorId: "inv_1", portfolioCompany: "X", tags: [], date: "2026-01-01" };

  it("weights network-verified reviews above unverified noise", () => {
    const reviews: Review[] = [
      { ...base, id: "r1", verified: true, reviewerContactId: "c_1", scores: score(5) },
      { ...base, id: "r2", verified: false, scores: score(1) },
    ];
    const s = summarizeReviews(reviews, new Set(["c_1"]));
    expect(s.overall).toBeCloseTo(4.6, 1);
    expect(s.fromNetwork).toBe(1);
    expect(s.verifiedCount).toBe(1);
  });

  it("returns null scores with no reviews", () => {
    expect(summarizeReviews([], new Set()).overall).toBeNull();
  });
});
