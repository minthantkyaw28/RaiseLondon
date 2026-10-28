import { describe, expect, it } from "vitest";

import type { Investor as OurInvestor, Sector } from "@/data/types";
import { dataset } from "@/lib/raise/dataset";
import { rankInvestors } from "@/lib/raise/score";
import type { Investor } from "@/lib/raise/types";
import { matchInvestors } from "./match";
import { extractProfile, type PitchProfile } from "./pitch-profile";
import {
  DEALROOM_TERMS,
  parseRevenue,
  pitchToStartup,
  rankPitch,
  termsFor,
} from "./pitch-to-startup";

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
    sectors: [],
    lastRoundDate: "2025-06",
    investmentsCount: 12,
    londonRoundsSince2024: 4,
    isActive: true,
    thesis: null,
    ...overrides,
  };
}

const ours = (id: string, name: string): OurInvestor => ({
  id,
  slug: id,
  name,
  type: "vc",
  oneLiner: "",
  website: "",
  address: "London",
  lat: 51.5,
  lng: -0.12,
  stages: ["seed"],
  sectors: [],
  checkSizeGbp: { min: 250_000, max: 2_000_000 },
  dealsLast12m: 0,
  portfolio: [],
  partners: [],
});

const empty: PitchProfile = {
  sectors: [],
  stage: null,
  companyStatus: null,
  raiseGbp: null,
  founders: null,
  technicalFounder: null,
};

describe("parseRevenue", () => {
  it("reads MRR and ARR written after the amount", () => {
    expect(parseRevenue("£20k MRR")).toEqual({ mrr: 20_000, arr: 0 });
    expect(parseRevenue("We do £1.2m ARR and are raising £3m")).toEqual({
      mrr: 0,
      arr: 1_200_000,
    });
    expect(parseRevenue("about 20k monthly revenue")).toEqual({ mrr: 20_000, arr: 0 });
    expect(parseRevenue("£250,000 annual recurring revenue")).toEqual({ mrr: 0, arr: 250_000 });
  });

  it("reads MRR and ARR written before the amount", () => {
    expect(parseRevenue("MRR of £40k")).toEqual({ mrr: 40_000, arr: 0 });
    expect(parseRevenue("ARR: £2m, MRR is 150k")).toEqual({ mrr: 150_000, arr: 2_000_000 });
  });

  it("converts dollars and euros to pounds", () => {
    expect(parseRevenue("$1.2m ARR").arr).toBe(948_000);
    expect(parseRevenue("€100k MRR").mrr).toBe(85_000);
  });

  it("ignores usage counts and raises", () => {
    expect(parseRevenue("12,000 monthly active users, raising £750k")).toEqual({ mrr: 0, arr: 0 });
    expect(parseRevenue("pre-revenue, raising £1m")).toEqual({ mrr: 0, arr: 0 });
  });
});

describe("pitchToStartup", () => {
  it("turns a profile and pitch into Min's StartupInput", () => {
    const text =
      "We help SMEs automate VAT. £20k MRR, 3 LOIs and 5 pre-orders, raising a £1.5m seed.";
    expect(pitchToStartup(extractProfile(text), text)).toEqual({
      name: "",
      description: text,
      sector: "",
      stage: "Seed",
      raiseAmount: 1_500_000,
      lois: 3,
      preOrders: 5,
      arr: 0,
      mrr: 20_000,
      tractionNotes: "",
    });
  });

  it("maps every one of our stages to his stage names", () => {
    const stages = (["pre-seed", "seed", "series-a", "series-b", "growth"] as const).map(
      (stage) => pitchToStartup({ ...empty, stage }, "").stage,
    );
    expect(stages).toEqual(["Pre-Seed", "Seed", "Series A", "Series B", "Growth"]);
    expect(pitchToStartup(empty, "").stage).toBe("");
  });
});

describe("DEALROOM_TERMS", () => {
  const tags = [
    ...dataset.investors.flatMap((v) => v.sectors),
    ...(dataset.companies ?? []).flatMap((c) => c.sectors),
  ].map((t) => t.toLowerCase());

  it("has terms for every sector, each matching a tag in the real export", () => {
    for (const [sector, terms] of Object.entries(DEALROOM_TERMS)) {
      expect(terms.length, sector).toBeGreaterThan(0);
      for (const term of terms)
        expect(
          tags.some((t) => t.includes(term)),
          term,
        ).toBe(true);
    }
  });

  it("sends a healthtech pitch to health, life sciences and medical tags", () => {
    expect(termsFor(["healthtech"])).toEqual(
      expect.arrayContaining(["health", "life sciences", "medical"]),
    );
  });

  it("lists shared terms once", () => {
    const terms = termsFor(["healthtech", "deeptech"] as Sector[]);
    expect(new Set(terms).size).toBe(terms.length);
  });
});

describe("rankPitch", () => {
  const insurer = investor({ uuid: "ins", name: "Insurer", sectors: ["Insurance"] });
  const saas = investor({ uuid: "saas", name: "Saas Fund", sectors: ["SaaS"] });
  const neither = investor({ uuid: "none", name: "Neither", sectors: ["Music"] });
  const pitch = { ...empty, sectors: ["fintech", "b2b-saas"] as Sector[] };

  it("scores each of our sectors and keeps every investor's best", () => {
    const ranked = rankPitch(pitch, "", [neither, saas, insurer]);
    const score = (uuid: string) => ranked.find((r) => r.investor.uuid === uuid)?.score;
    expect(score("ins")).toBe(score("saas"));
    expect(score("ins")! - score("none")!).toBe(40);
    expect(ranked.map((r) => r.investor.uuid)).toEqual(["ins", "saas", "none"]);
    expect(ranked.find((r) => r.investor.uuid === "saas")?.reasons).toContain(
      "Sector overlap on saas.",
    );
  });

  it("matches a single-sector run of his scorer for that sector's best term", () => {
    const [best] = rankPitch({ ...empty, sectors: ["b2b-saas"] }, "", [saas]);
    const [his] = rankInvestors([saas], { ...pitchToStartup(empty, ""), sector: "saas" });
    expect(best).toEqual(his);
  });

  it("returns every investor once", () => {
    expect(rankPitch(pitch, "", [insurer, saas, neither])).toHaveLength(3);
  });
});

describe("matchInvestors end to end", () => {
  const text = "Open banking payroll for SMEs. £30k MRR, raising a £1m seed.";
  const fit = investor({
    uuid: "fit",
    name: "Zed Fintech",
    sectors: ["Financial Service"],
    londonRoundsSince2024: 8,
  });
  const late = investor({
    uuid: "late",
    name: "Alpha Growth",
    sectors: ["Music"],
    preferredRound: "SERIES C",
    stages: ["Series C"],
    stageMix: [],
    chequeMin: 10_000_000,
    chequeMax: 50_000_000,
    londonRoundsSince2024: 0,
  });
  const notOnMap = investor({ uuid: "elsewhere", name: "Elsewhere", sectors: ["Fintech"] });

  it("ranks the real fit first, with his score and reasons and the misses split out", () => {
    const ranked = matchInvestors(
      extractProfile(text),
      [ours("late", "Alpha Growth"), ours("fit", "Zed Fintech"), ours("absent", "No Row")],
      [late, fit, notOnMap],
      text,
    );
    expect(ranked.map((m) => m.investor.id)).toEqual(["fit", "late"]);
    const [first, second] = ranked;
    expect(first?.investor.name).toBe("Zed Fintech");
    expect(first?.score).toBe(100);
    expect(first?.reasons).toEqual([
      "Sector overlap on financial.",
      "Their recent rounds include Seed.",
      "The raise sits inside the stated ticket (£250,000–£2,000,000 stated).",
      "8 London VC rounds since 2024.",
      "Traction band “seed” lines up with Seed.",
    ]);
    expect(first?.misses).toEqual([]);
    expect(second?.score).toBe(0);
    expect(second?.misses).toEqual([
      "No sector overlap with fintech.",
      "Their recent rounds do not match Seed.",
      "The raise sits outside the stated ticket (£10,000,000–£50,000,000 stated).",
      "No London VC round in this dataset since 2024.",
      "Traction band “seed” does not match where they invest.",
    ]);
  });
});
