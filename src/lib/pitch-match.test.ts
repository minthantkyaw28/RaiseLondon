import { describe, expect, it } from "vitest";

import type { Investor } from "@/data/types";
import type { Investor as RaiseInvestor } from "@/lib/raise/types";
import { matchInvestors, scoreTier, type Match } from "./match";
import { extractProfile, parseRaise, type PitchProfile } from "./pitch-profile";

describe("extractProfile", () => {
  it("reads a stated stage", () => {
    expect(extractProfile("We're raising our pre seed round").stage).toBe("pre-seed");
    expect(extractProfile("This is a Pre-Seed raise").stage).toBe("pre-seed");
    expect(extractProfile("Opening our Series A next month").stage).toBe("series-a");
    expect(extractProfile("A seed round to hire engineers").stage).toBe("seed");
  });

  it("parses raise amounts", () => {
    expect(parseRaise("raising 1.5m")).toBe(1_500_000);
    expect(parseRaise("we want £750k")).toBe(750_000);
    expect(parseRaise("about 1.5 million pounds")).toBe(1_500_000);
    expect(parseRaise("raising £500,000")).toBe(500_000);
    expect(parseRaise("500k")).toBe(500_000);
  });

  it("prefers the raise over revenue and ignores counts that aren't money", () => {
    expect(parseRaise("We do £1.2m ARR and are raising £3m")).toBe(3_000_000);
    expect(parseRaise("10k users after 18 months")).toBeNull();
    expect(parseRaise("two founders, 3 years in")).toBeNull();
  });

  it("detects founders and technical background", () => {
    expect(extractProfile("My co-founder and I met at Monzo").founders).toBe("co-founders");
    expect(extractProfile("We are two engineers").founders).toBe("co-founders");
    expect(extractProfile("I'm a solo founder").founders).toBe("solo");
    expect(extractProfile("I'm building alone for now").founders).toBe("solo");
    expect(extractProfile("I'm a non-technical founder").technicalFounder).toBe(false);
    expect(extractProfile("I'm the CTO").technicalFounder).toBe(true);
    expect(extractProfile("Two technical co-founders").technicalFounder).toBe(true);
  });

  it("finds sectors", () => {
    const p = extractProfile("LLM agents that automate payments reconciliation for SMBs");
    expect(p.sectors).toEqual(["ai", "fintech", "b2b-saas"]);
    expect(extractProfile("A lending app").sectors).toEqual(["fintech"]);
    expect(extractProfile("We said hello").sectors).toEqual([]);
  });

  it("reads company status, treating pre-revenue as not revenue", () => {
    expect(extractProfile("£40k MRR from paying customers").companyStatus).toBe("revenue");
    expect(extractProfile("Pre-revenue, 2,000 on the waitlist").companyStatus).toBe("waitlist");
    expect(extractProfile("Just an idea so far").companyStatus).toBe("idea");
  });

  it("infers stage when it isn't said", () => {
    expect(extractProfile("Just an idea so far").stage).toBe("pre-seed");
    expect(extractProfile("Raising £150k to build the MVP").stage).toBe("pre-seed");
    expect(extractProfile("We have 300 users and are raising £800k").stage).toBe("seed");
    expect(extractProfile("£1m ARR, revenue growing, raising £4m").stage).toBe("series-a");
    expect(extractProfile("Nothing useful here").stage).toBeNull();
  });
});

const investor = (over: Partial<Investor>): Investor => ({
  id: "inv",
  slug: "inv",
  name: "Firm",
  type: "vc",
  oneLiner: "",
  website: "",
  address: "",
  lat: 0,
  lng: 0,
  stages: ["seed"],
  sectors: ["fintech"],
  checkSizeGbp: { min: 250_000, max: 1_000_000 },
  dealsLast12m: 10,
  portfolio: [],
  partners: [],
  ...over,
});

// Min's Dealroom row for the investor with the same id; this is what the matcher scores.
const row = (over: Partial<RaiseInvestor> & Pick<RaiseInvestor, "uuid">): RaiseInvestor => ({
  name: over.uuid,
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
  chequeMax: 1_000_000,
  chequeCurrency: "GBP",
  preferredRound: "SEED",
  stages: ["Seed"],
  stageMix: [],
  sectors: ["Fintech"],
  lastRoundDate: "2025-06",
  investmentsCount: 10,
  londonRoundsSince2024: 10,
  isActive: true,
  thesis: null,
  ...over,
});

const empty: PitchProfile = {
  sectors: [],
  stage: null,
  companyStatus: null,
  raiseGbp: null,
  founders: null,
  technicalFounder: null,
};
const seedFintech: PitchProfile = {
  ...empty,
  sectors: ["fintech"],
  stage: "seed",
  raiseGbp: 500_000,
};

function nth(ranked: Match[], i: number): Match {
  const m = ranked[i];
  if (!m) throw new Error(`expected a match at position ${i}, got ${ranked.length} matches`);
  return m;
}

describe("extractProfile: neurotech and waitlists", () => {
  const pitch =
    "I'm building an EEG headband that tracks focus. 400 users on our waitlist, raising £500k.";

  it("reads an EEG headband as healthtech and deep tech", () => {
    expect(extractProfile(pitch).sectors).toEqual(
      expect.arrayContaining(["healthtech", "deeptech"]),
    );
  });

  it("treats users on a waitlist as a waitlist, and infers pre-seed", () => {
    const p = extractProfile(pitch);
    expect(p.companyStatus).toBe("waitlist");
    expect(p.stage).toBe("pre-seed");
  });

  it("still counts real usage alongside a waitlist as users", () => {
    expect(extractProfile("300 active users and a waitlist of 2,000").companyStatus).toBe(
      "has-users",
    );
  });
});

describe("matchInvestors", () => {
  it("ranks a perfect fit first with readable reasons", () => {
    const ranked = matchInvestors(
      seedFintech,
      [investor({ id: "b", name: "Alpha Off" }), investor({ id: "a", name: "Zed Perfect" })],
      [
        row({ uuid: "b", preferredRound: "SERIES C", stages: ["Series C"], sectors: ["Music"] }),
        row({ uuid: "a" }),
      ],
      "Payments for SMEs, £30k MRR, raising a £500k seed.",
    );
    const first = nth(ranked, 0);
    const second = nth(ranked, 1);
    expect(first.investor.id).toBe("a");
    expect(first.investor.name).toBe("Zed Perfect");
    expect(first.score).toBe(100);
    expect(first.reasons).toEqual([
      "Sector overlap on fintech.",
      "Their recent rounds include Seed.",
      "The raise sits inside the stated ticket (£250,000–£1,000,000 stated).",
      "10 London VC rounds since 2024.",
      "Traction band “seed” lines up with Seed.",
    ]);
    expect(first.misses).toEqual([]);
    expect(second.misses).toContain("Their recent rounds do not match Seed.");
    expect(second.misses).toContain("No sector overlap with fintech.");
  });

  it("gives partial credit for a stage next to the one asked for", () => {
    const m = nth(
      matchInvestors(
        { ...empty, stage: "series-a" },
        [investor({})],
        [row({ uuid: "inv", londonRoundsSince2024: 0 })],
      ),
      0,
    );
    expect(m.reasons).toContain("They invest next to Series A, not exactly on it.");
    expect(m.score).toBe(15 + 4);
  });

  it("breaks ties by London activity, then by name", () => {
    const ranked = matchInvestors(
      empty,
      [
        investor({ id: "b", name: "B" }),
        investor({ id: "a", name: "A" }),
        investor({ id: "c", name: "C" }),
      ],
      [
        row({ uuid: "b", name: "B" }),
        row({ uuid: "a", name: "A" }),
        row({ uuid: "c", name: "C", londonRoundsSince2024: 12 }),
      ],
    );
    expect(ranked.map((m) => m.investor.name)).toEqual(["C", "A", "B"]);
  });

  it("handles an empty profile without misses it can't justify", () => {
    const m = nth(
      matchInvestors(
        empty,
        [investor({})],
        [row({ uuid: "inv", preferredRound: "PRE-SEED", stages: [], londonRoundsSince2024: 0 })],
      ),
      0,
    );
    expect(m.score).toBe(10);
    expect(m.reasons).toEqual(["Traction band “too early” lines up with Pre-Seed."]);
    expect(m.misses).toEqual(["No London VC round in this dataset since 2024."]);
    expect(matchInvestors(empty, [], [])).toEqual([]);
  });

  it("leaves out investors with no Dealroom row", () => {
    expect(matchInvestors(seedFintech, [investor({ id: "x" })], [row({ uuid: "y" })])).toEqual([]);
  });
});

describe("scoreTier", () => {
  it("bands scores at 80, 60 and 40", () => {
    expect([100, 80, 79, 60, 59, 40, 39, 0].map(scoreTier)).toEqual([
      "strong",
      "strong",
      "good",
      "good",
      "fair",
      "fair",
      "weak",
      "weak",
    ]);
  });
});
