import type { Investor } from "./types";

export const STAGE_ORDER = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth"] as const;

export type CanonicalStage = (typeof STAGE_ORDER)[number];

export function canonicalStage(raw: string | null | undefined): CanonicalStage | null {
  if (!raw) return null;
  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  if (normalized.includes("pre seed") || normalized.includes("preseed") || normalized === "angel") {
    return "Pre-Seed";
  }
  if (
    normalized.includes("series c") ||
    normalized.includes("series d") ||
    normalized.includes("series e") ||
    normalized.includes("series f")
  ) {
    return "Series C";
  }
  if (normalized.includes("series b")) return "Series B";
  if (normalized.includes("series a")) return "Series A";
  if (normalized.includes("seed")) return "Seed";
  if (normalized.includes("early")) return "Seed";
  if (normalized.includes("growth") || normalized.includes("late")) return "Growth";
  return null;
}

export function investorStages(investor: Investor): CanonicalStage[] {
  const found: CanonicalStage[] = [];
  const add = (value: string | null | undefined) => {
    const stage = canonicalStage(value);
    if (stage && !found.includes(stage)) found.push(stage);
  };
  add(investor.preferredRound);
  for (const stage of investor.stages) add(stage);
  for (const mix of investor.stageMix) add(mix.stage);
  return found;
}
