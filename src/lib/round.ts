import type { PipelineStatus } from "@/components/vc-map/pipeline";
import type { Investor } from "@/data/types";

// Rough odds that a firm at each pipeline stage ends up investing. Adapted from the round
// builder in fundraise-crm (MIT); deliberately conservative, and shown to founders as a guide.
export const STAGE_ODDS: Record<PipelineStatus, number> = {
  none: 0,
  target: 0.05,
  "intro-asked": 0.15,
  meeting: 0.35,
  passed: 0,
};

export interface RoundProgress {
  firms: number;
  /** Sum of each live firm's typical cheque, before odds. */
  reach: number;
  /** Sum of typical cheque × stage odds. */
  expected: number;
  /** Firms whose cheque range is a typical range for their type, not their own. */
  estimated: number;
}

// A firm's typical cheque is the middle of its range; a guide, not a promise.
export const typicalCheque = (v: Investor) => (v.checkSizeGbp.min + v.checkSizeGbp.max) / 2;

export function roundProgress(
  pipeline: Record<string, PipelineStatus>,
  investors: Investor[],
): RoundProgress {
  const byId = new Map(investors.map((v) => [v.id, v]));
  let firms = 0;
  let reach = 0;
  let expected = 0;
  let estimated = 0;
  for (const [id, status] of Object.entries(pipeline)) {
    const investor = byId.get(id);
    const odds = STAGE_ODDS[status] ?? 0;
    if (!investor || odds === 0) continue;
    firms++;
    if (investor.chequeEstimated) estimated++;
    reach += typicalCheque(investor);
    expected += typicalCheque(investor) * odds;
  }
  return { firms, reach: Math.round(reach), expected: Math.round(expected), estimated };
}
