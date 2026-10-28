import type { Debrief, DebriefReason, MeetingOutcome, PickyTopic } from "@/data/types";
import { PICKY_LABEL, REASON_LABEL } from "./labels";

// Below this, a firm's debriefs could point back to a single founder, so we show no patterns.
export const MIN_DEBRIEFS_TO_SHOW = 3;

export interface DebriefSummary {
  count: number;
  outcomes: Record<MeetingOutcome, number>;
  topReasons: { reason: DebriefReason; count: number }[];
  topPicky: { topic: PickyTopic; count: number }[];
}

function topThree<T extends string>(items: T[], labels: Record<T, string>) {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || labels[a].localeCompare(labels[b]))
    .slice(0, 3);
}

export function summarizeDebriefs(debriefs: Debrief[]): DebriefSummary {
  const outcomes: Record<MeetingOutcome, number> = {
    passed: 0,
    "follow-up": 0,
    "term-sheet": 0,
    ghosted: 0,
  };
  for (const d of debriefs) outcomes[d.outcome] += 1;
  return {
    count: debriefs.length,
    outcomes,
    topReasons: topThree(
      debriefs.flatMap((d) => d.reasons),
      REASON_LABEL,
    ).map(([reason, count]) => ({ reason, count })),
    topPicky: topThree(
      debriefs.flatMap((d) => d.pickyAbout),
      PICKY_LABEL,
    ).map(([topic, count]) => ({ topic, count })),
  };
}
