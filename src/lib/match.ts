import type { Investor } from "@/data/types";
import type { PitchProfile } from "./pitch-profile";

export interface Match {
  investor: Investor;
  score: number;
  reasons: string[];
  misses: string[];
}

const WEIGHTS = { stage: 35, sector: 30, raise: 20, activity: 5, warm: 10 };
// Deal counts in London run roughly 0-30 a year; 20+ is as active as it gets.
const BUSY_DEALS = 20;

export const formatGbp = (n: number) =>
  n >= 1_000_000 ? `£${Math.round(n / 100_000) / 10}m` : `£${Math.round(n / 1000)}k`;

interface Part {
  points: number;
  reason?: string;
  miss?: string;
}

function stageFit(profile: PitchProfile, v: Investor): Part {
  if (!profile.stage) return { points: 0 };
  return v.stages.includes(profile.stage)
    ? { points: WEIGHTS.stage, reason: `Invests at ${profile.stage}` }
    : { points: 0, miss: `Doesn't invest at ${profile.stage} (${v.stages.join(", ")})` };
}

function sectorFit(profile: PitchProfile, v: Investor): Part {
  if (!profile.sectors.length) return { points: 0 };
  const hits = profile.sectors.filter((s) => v.sectors.includes(s));
  if (!hits.length) return { points: 0, miss: `Doesn't back ${profile.sectors.join(" or ")}` };
  return {
    points: (WEIGHTS.sector * hits.length) / profile.sectors.length,
    reason: `Backs ${hits.join(", ")}`,
  };
}

// Full credit inside the cheque range, half credit within 2x either side of it.
function raiseFit(profile: PitchProfile, v: Investor): Part {
  const raise = profile.raiseGbp;
  if (raise === null) return { points: 0 };
  const { min, max } = v.checkSizeGbp;
  const range = `${formatGbp(min)}–${formatGbp(max)}`;
  if (raise >= min && raise <= max)
    return { points: WEIGHTS.raise, reason: `${formatGbp(raise)} fits their ${range} cheque` };
  if (raise >= min / 2 && raise <= max * 2)
    return {
      points: WEIGHTS.raise / 2,
      reason: `${formatGbp(raise)} is close to their ${range} cheque`,
    };
  const side = raise < min ? "below" : "above";
  return { points: 0, miss: `${formatGbp(raise)} is well ${side} their ${range} cheque` };
}

function activityFit(v: Investor): Part {
  const points = (WEIGHTS.activity * Math.min(v.dealsLast12m, BUSY_DEALS)) / BUSY_DEALS;
  return v.dealsLast12m > 0
    ? { points, reason: `${v.dealsLast12m} deals in the last 12 months` }
    : { points: 0, miss: "No deals in the last 12 months" };
}

function scoreInvestor(profile: PitchProfile, v: Investor, warm: boolean): Match {
  const parts: Part[] = [
    stageFit(profile, v),
    sectorFit(profile, v),
    raiseFit(profile, v),
    activityFit(v),
    warm ? { points: WEIGHTS.warm, reason: "Warm intro available" } : { points: 0 },
  ];
  return {
    investor: v,
    score: Math.round(parts.reduce((sum, p) => sum + p.points, 0)),
    reasons: parts.flatMap((p) => (p.reason ? [p.reason] : [])),
    misses: parts.flatMap((p) => (p.miss ? [p.miss] : [])),
  };
}

export function matchInvestors(
  profile: PitchProfile,
  investors: Investor[],
  warmIds: Set<string>,
): Match[] {
  return investors
    .map((v) => scoreInvestor(profile, v, warmIds.has(v.id)))
    .sort((a, b) => b.score - a.score || a.investor.name.localeCompare(b.investor.name));
}
