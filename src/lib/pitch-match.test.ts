import { describe, expect, it } from "vitest";

import type { Investor } from "@/data/types";
import { matchInvestors, type Match } from "./match";
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
    expect(extractProfile("Pre-revenue, 2,000 on the waitlist").companyStatus).toBe("has-users");
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

describe("matchInvestors", () => {
  it("ranks a perfect fit first with readable reasons", () => {
    const perfect = investor({ id: "a", name: "Zed Perfect", dealsLast12m: 20 });
    const off = investor({ id: "b", name: "Alpha Off", stages: ["growth"], sectors: ["climate"] });
    const ranked = matchInvestors(seedFintech, [off, perfect]);
    const first = nth(ranked, 0);
    const second = nth(ranked, 1);
    expect(first.investor.id).toBe("a");
    expect(first.score).toBe(100);
    expect(first.reasons).toEqual([
      "Invests at seed",
      "Backs fintech",
      "£500k fits their £250k–£1m cheque",
      "20 deals in the last 12 months",
    ]);
    expect(first.misses).toEqual([]);
    expect(second.misses).toContain("Doesn't invest at seed (growth)");
    expect(second.misses).toContain("Doesn't back fintech");
  });

  it("gives partial credit for a raise within 2x of the cheque", () => {
    const m = nth(matchInvestors({ ...empty, raiseGbp: 1_500_000 }, [investor({})]), 0);
    expect(m.reasons).toContain("£1.5m is close to their £250k–£1m cheque");
    expect(m.score).toBe(10 + 3);
  });

  it("breaks ties by name", () => {
    const ranked = matchInvestors(empty, [investor({ name: "B" }), investor({ name: "A" })]);
    expect(ranked.map((m) => m.investor.name)).toEqual(["A", "B"]);
  });

  it("handles an empty profile without misses it can't justify", () => {
    const m = nth(matchInvestors(empty, [investor({ dealsLast12m: 0 })]), 0);
    expect(m.score).toBe(0);
    expect(m.reasons).toEqual([]);
    expect(m.misses).toEqual(["No deals in the last 12 months"]);
    expect(matchInvestors(empty, [])).toEqual([]);
  });
});
