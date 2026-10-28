import { describe, expect, it } from "vitest";

import type { Investor } from "@/data/types";
import { rankInvestors } from "./importance";

const firm = (id: string, dealsLast12m: number, portfolioSize = 0, name = id): Investor => ({
  id,
  slug: id,
  name,
  type: "vc",
  oneLiner: "",
  website: "",
  address: "London",
  lat: 51.5,
  lng: -0.1,
  stages: [],
  sectors: [],
  checkSizeGbp: { min: 0, max: 0 },
  dealsLast12m,
  portfolio: Array.from({ length: portfolioSize }, (_, i) => `co-${i}`),
  partners: [],
});

describe("rankInvestors", () => {
  it("ranks by recent rounds, then portfolio size, then name", () => {
    const ranks = rankInvestors([firm("b", 2, 1), firm("a", 2, 1), firm("c", 2, 5), firm("d", 9)]);
    expect(["d", "c", "a", "b"].map((id) => ranks.get(id)?.rank)).toEqual([0, 1, 2, 3]);
  });

  it("puts the top 15 of 281 in tier 1 and the next 50 in tier 2", () => {
    const list = Array.from({ length: 281 }, (_, i) => firm(`f${i}`, 281 - i));
    const tiers = [...rankInvestors(list).values()].map((v) => v.tier);
    expect(tiers.filter((t) => t === 1)).toHaveLength(15);
    expect(tiers.filter((t) => t === 2)).toHaveLength(50);
    expect(tiers.filter((t) => t === 3)).toHaveLength(216);
  });

  it("always gives a short list at least one tier-1 firm", () => {
    const ranks = rankInvestors([firm("a", 0), firm("b", 0), firm("c", 0)]);
    expect(ranks.get("a")?.tier).toBe(1);
    expect(ranks.get("c")?.tier).toBe(3);
  });

  it("returns an empty map for no firms", () => {
    expect(rankInvestors([]).size).toBe(0);
  });
});
