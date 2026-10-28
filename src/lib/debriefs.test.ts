import { describe, expect, it } from "vitest";

import type { Debrief } from "@/data/types";
import { MIN_DEBRIEFS_TO_SHOW, summarizeDebriefs } from "./debriefs";

const debrief = (id: string, overrides: Partial<Debrief>): Debrief => ({
  id,
  investorId: "inv_1",
  outcome: "passed",
  reasons: [],
  pickyAbout: [],
  date: "2026-10-01",
  ...overrides,
});

describe("summarizeDebriefs", () => {
  it("counts outcomes, reasons and picky topics", () => {
    const s = summarizeDebriefs([
      debrief("d1", { reasons: ["traction", "valuation"], pickyAbout: ["metrics"] }),
      debrief("d2", { reasons: ["traction"], pickyAbout: ["metrics", "cap-table"] }),
      debrief("d3", { outcome: "term-sheet", pickyAbout: ["metrics"] }),
      debrief("d4", { outcome: "ghosted", reasons: ["no-reason-given"] }),
    ]);
    expect(s.count).toBe(4);
    expect(s.outcomes).toEqual({ passed: 2, "follow-up": 0, "term-sheet": 1, ghosted: 1 });
    expect(s.topReasons[0]).toEqual({ reason: "traction", count: 2 });
    expect(s.topPicky).toEqual([
      { topic: "metrics", count: 3 },
      { topic: "cap-table", count: 1 },
    ]);
  });

  it("keeps the top three and breaks ties by label", () => {
    const s = summarizeDebriefs([
      debrief("d1", { reasons: ["valuation", "team", "timing", "competition"] }),
      debrief("d2", { reasons: ["valuation"] }),
    ]);
    expect(s.topReasons).toEqual([
      { reason: "valuation", count: 2 },
      { reason: "competition", count: 1 },
      { reason: "team", count: 1 },
    ]);
  });

  it("returns zeros for no debriefs", () => {
    const s = summarizeDebriefs([]);
    expect(s.count).toBe(0);
    expect(s.outcomes).toEqual({ passed: 0, "follow-up": 0, "term-sheet": 0, ghosted: 0 });
    expect(s.topReasons).toEqual([]);
    expect(s.topPicky).toEqual([]);
  });

  it("only shows patterns from three or more founders", () => {
    expect(MIN_DEBRIEFS_TO_SHOW).toBe(3);
    const two = summarizeDebriefs([debrief("d1", {}), debrief("d2", {})]);
    const three = summarizeDebriefs([debrief("d1", {}), debrief("d2", {}), debrief("d3", {})]);
    expect(two.count >= MIN_DEBRIEFS_TO_SHOW).toBe(false);
    expect(three.count >= MIN_DEBRIEFS_TO_SHOW).toBe(true);
  });
});
