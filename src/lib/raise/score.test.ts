import { describe, expect, it } from "vitest";

import { filterInvestors } from "./filters";
import { rankInvestors, rateStartup } from "./score";
import { canonicalStage } from "./stages";
import type { Investor, StartupInput } from "./types";

function investor(overrides: Partial<Investor> & Pick<Investor, "uuid" | "name">): Investor {
  return {
    investorType: "venture_capital",
    investorTypes: ["venture_capital"],
    recordType: "organization",
    tagline: null,
    about: null,
    website: null,
    linkedin: null,
    image: null,
    dealroomUrl: null,
    hqCity: "London",
    hqCountry: "United Kingdom",
    lat: 51.5,
    lon: -0.12,
    chequeMin: 250_000,
    chequeMax: 2_000_000,
    chequeCurrency: "GBP",
    preferredRound: "SEED",
    stages: ["Seed"],
    stageMix: [{ stage: "Seed", count: 4 }],
    sectors: ["Fintech"],
    lastRoundDate: "2025-06",
    investmentsCount: 12,
    londonRoundsSince2024: 4,
    isActive: true,
    thesis: null,
    ...overrides,
  };
}

const blankStartup: StartupInput = {
  name: "",
  description: "",
  sector: "",
  stage: "",
  raiseAmount: null,
  lois: 0,
  preOrders: 0,
  arr: 0,
  mrr: 0,
  tractionNotes: "",
};

describe("canonical stages", () => {
  it("maps Dealroom labels onto the filter stages", () => {
    expect(canonicalStage("SERIES A")).toBe("Series A");
    expect(canonicalStage("EARLY VC")).toBe("Seed");
    expect(canonicalStage("ANGEL")).toBe("Pre-Seed");
    expect(canonicalStage("pre-seed")).toBe("Pre-Seed");
  });
});

describe("rankInvestors", () => {
  const fintech = investor({ uuid: "fin", name: "Fin Fund", sectors: ["Fintech"] });
  const health = investor({
    uuid: "health",
    name: "Health Fund",
    sectors: ["Health"],
    preferredRound: "SERIES B",
    stages: ["Series B"],
    stageMix: [{ stage: "Series B", count: 3 }],
    chequeMin: 5_000_000,
    chequeMax: 20_000_000,
    londonRoundsSince2024: 8,
  });
  const quiet = investor({ uuid: "quiet", name: "Quiet Fund", isActive: false });

  it("ranks the sector and stage fit above a larger but mismatched fund", () => {
    const ranked = rankInvestors([health, fintech, quiet], {
      ...blankStartup,
      sector: "Fintech",
      stage: "Seed",
      raiseAmount: 500_000,
      mrr: 30_000,
    });
    expect(ranked.map((result) => result.investor.uuid)).toEqual(["fin", "health"]);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
    expect(ranked[0]?.reasons.some((reason) => reason.includes("Fintech"))).toBe(true);
  });
});

describe("rateStartup", () => {
  it("stays too early when nothing has been entered", () => {
    const rating = rateStartup(blankStartup);
    expect(rating.band).toBe("too early");
    expect(rating.score).toBe(0);
    expect(rating.reasons).toContain("No revenue was entered.");
    expect(rating.reasons).toContain("No letters of intent entered.");
  });

  it("treats six-figure monthly revenue as series A ready", () => {
    const rating = rateStartup({ ...blankStartup, mrr: 120_000, lois: 5, preOrders: 2 });
    expect(rating.band).toBe("series a ready");
    expect(rating.score).toBeGreaterThanOrEqual(60);
  });

  it("marks very high revenue as later", () => {
    expect(rateStartup({ ...blankStartup, mrr: 300_000 }).band).toBe("later");
  });

  it("uses ARR when MRR is empty", () => {
    const rating = rateStartup({ ...blankStartup, arr: 120_000 });
    expect(rating.band).toBe("pre-seed");
    expect(rating.reasons.some((reason) => reason.includes("early commercial"))).toBe(true);
  });
});

describe("filterInvestors", () => {
  const rows = [
    investor({
      uuid: "a",
      name: "Alpha",
      sectors: ["Fintech"],
      chequeMin: 100_000,
      chequeMax: 400_000,
    }),
    investor({ uuid: "b", name: "Beta", sectors: ["Health"], chequeMin: null, chequeMax: null }),
  ];

  it("filters by sector and drops unknown cheques from a size bucket", () => {
    const fintech = filterInvestors(rows, {
      query: "",
      sector: "Fintech",
      stage: "",
      cheque: "any",
    });
    expect(fintech.map((row) => row.uuid)).toEqual(["a"]);
    const sized = filterInvestors(rows, { query: "", sector: "", stage: "", cheque: "under-250k" });
    expect(sized.map((row) => row.uuid)).toEqual(["a"]);
  });

  it("treats a reversed stated ticket as a range", () => {
    const reversed = investor({
      uuid: "rev",
      name: "Rev",
      chequeMin: 189_394,
      chequeMax: 4,
    });
    const sized = filterInvestors([reversed], {
      query: "",
      sector: "",
      stage: "",
      cheque: "under-250k",
    });
    expect(sized.map((row) => row.uuid)).toEqual(["rev"]);
  });
});
