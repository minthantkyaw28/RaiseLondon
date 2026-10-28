import type { Investor } from "@/data/types";
import type { Investor as RaiseInvestor } from "@/lib/raise/types";

import type { PitchProfile } from "./pitch-profile";
import { rankPitch } from "./pitch-to-startup";

export interface Match {
  investor: Investor;
  score: number;
  reasons: string[];
  misses: string[];
}

export const formatGbp = (n: number) =>
  n >= 1_000_000 ? `£${Math.round(n / 100_000) / 10}m` : `£${Math.round(n / 1000)}k`;

// Min's scorer explains a part it could not score ("No raise amount was entered, so cheque fit is
// not scored."). Our reader simply did not hear it, so that is neither a reason nor a miss.
const NOT_SCORED = /\bis not scored\b/;
const MISS = /^No |\boutside\b|\bdoes not match\b|\bdo not match\b/;

/**
 * Ranks our investors for a pitch with Min's scorer over his Dealroom rows (`scoring`, keyed by
 * the same uuid as our `Investor.id`). Investors with no scoring row are left out. Score and
 * reasons are his, plus partial sector credit for generalists; reasons that count against the fit
 * are split out as misses.
 */
export function matchInvestors(
  profile: PitchProfile,
  investors: Investor[],
  scoring: RaiseInvestor[],
  text = "",
): Match[] {
  const ours = new Map(investors.map((v) => [v.id, v]));
  const rows = scoring.filter((r) => ours.has(r.uuid));
  const generalists = new Set(investors.filter((v) => v.generalist).map((v) => v.id));
  return rankPitch(profile, text, rows, generalists).flatMap((r) => {
    const investor = ours.get(r.investor.uuid);
    if (!investor) return [];
    const said = r.reasons.filter((reason) => !NOT_SCORED.test(reason));
    return [
      {
        investor,
        score: r.score,
        reasons: said.filter((reason) => !MISS.test(reason)),
        misses: said.filter((reason) => MISS.test(reason)),
      },
    ];
  });
}

export type ScoreTier = "strong" | "good" | "fair" | "weak";

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "weak";
}
