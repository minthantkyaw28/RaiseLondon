import type { Investor } from "@/data/types";

export type Tier = 1 | 2 | 3;

// Of the 281 firms in the 2026-10-28 export: the top 15 are tier 1, the next 50 tier 2.
const TIER_1_SHARE = 15 / 281;
const TIER_2_SHARE = 65 / 281;

export interface Importance {
  /** 0 is the most active firm in the list. */
  rank: number;
  tier: Tier;
}

/**
 * Orders firms by rounds in the last 12 months. Portfolio size breaks ties because it counts
 * distinct companies backed over all time; name keeps the order stable. Tiers are shares of
 * the list passed in, so a filtered or pitch-matched subset still gets its own big names.
 */
export function rankInvestors(investors: Investor[]): Map<string, Importance> {
  const ordered = [...investors].sort(
    (a, b) =>
      b.dealsLast12m - a.dealsLast12m ||
      b.portfolio.length - a.portfolio.length ||
      a.name.localeCompare(b.name),
  );
  const tier1 = Math.max(1, Math.round(ordered.length * TIER_1_SHARE));
  const tier2 = Math.max(tier1, Math.round(ordered.length * TIER_2_SHARE));
  return new Map(
    ordered.map((v, rank) => [v.id, { rank, tier: rank < tier1 ? 1 : rank < tier2 ? 2 : 3 }]),
  );
}
