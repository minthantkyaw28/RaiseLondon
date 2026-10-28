import { describe, expect, it } from "vitest";

import type { Investor } from "@/data/types";

import { roundProgress } from "./round";

const firm = (id: string, min: number, max: number) =>
  ({ id, checkSizeGbp: { min, max } }) as unknown as Investor;

describe("roundProgress", () => {
  const investors = [firm("a", 100_000, 300_000), firm("b", 400_000, 600_000)];

  it("weights each live firm's typical cheque by its stage", () => {
    expect(roundProgress({ a: "target", b: "meeting" }, investors)).toEqual({
      firms: 2,
      reach: 700_000,
      expected: 185_000, // 200k × 0.05 + 500k × 0.35
      estimated: 0,
    });
  });

  it("leaves out passed firms and firms no longer in the dataset", () => {
    expect(roundProgress({ a: "passed", gone: "meeting" }, investors)).toEqual({
      firms: 0,
      reach: 0,
      expected: 0,
      estimated: 0,
    });
  });
});
