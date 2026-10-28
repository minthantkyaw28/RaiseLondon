import { describe, expect, it } from "vitest";

import type {
  Dataset as RaiseDataset,
  Deal as RaiseDeal,
  Investor as RaiseInvestor,
  Person as RaisePerson,
} from "@/lib/raise/types";

import { DEFAULT_CHEQUE_GBP, fromRaise, slugify, statedChequeGbp } from "./from-raise";

const raiseInvestor = (over: Partial<RaiseInvestor>): RaiseInvestor => ({
  uuid: "uuid-0000-a",
  name: "Northfield Ventures",
  investorType: "venture_capital",
  investorTypes: ["venture_capital"],
  recordType: "organization",
  tagline: "Seed fund for British software.",
  about: null,
  website: "https://northfield.example",
  linkedin: null,
  image: null,
  dealroomUrl: "https://app.dealroom.co/investors/northfield",
  hqCity: "London",
  hqCountry: "United Kingdom",
  lat: 51.5246,
  lon: -0.0784,
  chequeMin: 250_000,
  chequeMax: 1_500_000,
  chequeCurrency: "GBP",
  preferredRound: "SEED",
  stages: ["SEED", "Seed", "Series A", "Other"],
  stageMix: [],
  sectors: ["SaaS", "Techstars 501 Investors"],
  lastRoundDate: "2026-09",
  investmentsCount: 40,
  londonRoundsSince2024: 12,
  isActive: true,
  thesis: null,
  ...over,
});

const deal = (over: Partial<RaiseDeal>): RaiseDeal => ({
  id: "d",
  transactionId: "t",
  investorUuid: "uuid-0000-a",
  companyUuid: null,
  companyName: "Acme",
  roundYear: 2026,
  roundMonth: 9,
  standardizedRound: "Seed",
  roundType: "SEED",
  amount: 1_000_000,
  currency: "GBP",
  isLead: true,
  sourceUrl: null,
  ...over,
});

const person = (over: Partial<RaisePerson>): RaisePerson => ({
  id: "uuid-0000-a:p1",
  personUuid: "p1",
  investorUuid: "uuid-0000-a",
  name: "Sam Okafor",
  role: "Partner",
  linkedin: "https://www.linkedin.com/in/sam",
  image: null,
  ...over,
});

const raw = (over: Partial<RaiseDataset>): RaiseDataset => ({
  generatedAt: "2026-10-28T19:52:31.215Z",
  currency: "GBP",
  investors: [raiseInvestor({})],
  deals: [],
  news: [],
  people: [],
  ...over,
});

describe("fromRaise", () => {
  it("maps a Dealroom investor onto our Investor", () => {
    const { dataset } = fromRaise(
      raw({
        deals: [
          deal({ transactionId: "t1", companyName: "Acme", roundYear: 2026, roundMonth: 9 }),
          deal({ transactionId: "t2", companyName: "Beta", roundYear: 2025, roundMonth: 11 }),
          deal({ transactionId: "t3", companyName: "Old Co", roundYear: 2025, roundMonth: 10 }),
          deal({ transactionId: "t4", companyName: "Undisclosed company", roundMonth: 8 }),
        ],
        people: [person({}), person({ id: "uuid-0000-a:p2", role: null, linkedin: null })],
      }),
    );
    expect(dataset.source).toBe("dealroom");
    expect(dataset.generatedAt).toBe("2026-10-28");
    expect(dataset.investors).toEqual([
      {
        id: "uuid-0000-a",
        slug: "northfield-ventures",
        name: "Northfield Ventures",
        type: "vc",
        oneLiner: "Seed fund for British software.",
        website: "https://northfield.example",
        address: "London",
        lat: 51.5246,
        lng: -0.0784,
        stages: ["seed", "series-a"],
        sectors: ["b2b-saas"],
        checkSizeGbp: { min: 250_000, max: 1_500_000 },
        // Nov 2025 to Oct 2026: t1, t2 and t4; t3 (Oct 2025) is 13 months back.
        dealsLast12m: 3,
        portfolio: ["Acme", "Beta", "Old Co"],
        partners: [
          {
            id: "uuid-0000-a:p1",
            name: "Sam Okafor",
            title: "Partner",
            linkedinUrl: "https://www.linkedin.com/in/sam",
            focus: [],
          },
          { id: "uuid-0000-a:p2", name: "Sam Okafor", title: "Team member", focus: [] },
        ],
      },
    ]);
  });

  it("maps angels and angel funds, and counts the stages and sectors it drops", () => {
    const report = fromRaise(
      raw({
        investors: [
          raiseInvestor({ uuid: "a1", name: "Jo Bloggs", investorType: "angel" }),
          raiseInvestor({ uuid: "a2", name: "Angel Pool", investorType: "angel_fund" }),
        ],
      }),
    );
    expect(report.dataset.investors.map((i) => i.type)).toEqual(["angel", "angel-network"]);
    expect(report.droppedStages).toEqual({ Other: 2 });
    expect(report.droppedSectors).toEqual({ "Techstars 501 Investors": 2 });
  });

  it("skips investors with no coordinates or HQ outside London, and counts them", () => {
    const report = fromRaise(
      raw({
        investors: [
          raiseInvestor({ uuid: "ok" }),
          raiseInvestor({ uuid: "no-lat", lat: null }),
          raiseInvestor({ uuid: "no-lon", lon: null }),
          raiseInvestor({ uuid: "paris", hqCity: "Paris", lat: 48.87, lon: 2.33 }),
          raiseInvestor({ uuid: "odd", investorType: "family_office" }),
        ],
      }),
    );
    expect(report.dataset.investors.map((i) => i.id)).toEqual(["ok"]);
    expect(report.skipped).toEqual({ noCoordinates: 2, outsideLondon: 1, unknownType: 1 });
  });

  it("fans out pins Dealroom only placed at the centre of London, keeping them in London", () => {
    const report = fromRaise(
      raw({
        investors: [
          raiseInvestor({ uuid: "c1", name: "One", lat: 51.50735, lon: -0.1277583 }),
          raiseInvestor({ uuid: "c2", name: "Two", lat: 51.507446, lon: -0.1277653 }),
          raiseInvestor({ uuid: "c3", name: "Three", lat: 1, lon: -0.127647 }),
          raiseInvestor({ uuid: "s1", name: "Shoreditch", lat: 51.5246, lon: -0.0784 }),
        ],
      }),
    );
    expect(report.cityLevelPins).toBe(3);
    const pins = report.dataset.investors.map((i) => `${i.lat},${i.lng}`);
    expect(new Set(pins).size).toBe(4);
    expect(pins[3]).toBe("51.5246,-0.0784");
    for (const v of report.dataset.investors) {
      expect(Math.abs(v.lat - 51.5074)).toBeLessThan(0.02);
      expect(Math.abs(v.lng + 0.1278)).toBeLessThan(0.06);
    }
  });

  it("never attaches reviews or debriefs to real firms", () => {
    const { dataset } = fromRaise(raw({}));
    expect(dataset.reviews).toEqual([]);
    expect(dataset.debriefs).toEqual([]);
  });

  it("gives firms that share a name distinct, order-independent slugs", () => {
    const a = raiseInvestor({ uuid: "aaaaaaaa-1", name: "Founders Capital" });
    const b = raiseInvestor({ uuid: "bbbbbbbb-2", name: "Founders Capital" });
    const forward = fromRaise(raw({ investors: [a, b] })).dataset.investors;
    const backward = fromRaise(raw({ investors: [b, a] })).dataset.investors;
    expect(forward.map((i) => i.slug)).toEqual([
      "founders-capital-aaaaaaaa",
      "founders-capital-bbbbbbbb",
    ]);
    expect(backward.map((i) => i.slug)).toEqual([
      "founders-capital-bbbbbbbb",
      "founders-capital-aaaaaaaa",
    ]);
    expect(slugify("Bethnal Green Ventures (BGV)")).toBe("bethnal-green-ventures-bgv");
    expect(slugify("Crème Capital")).toBe("creme-capital");
  });

  it("falls back to the about text, then a factual line, for the one-liner", () => {
    const { dataset } = fromRaise(
      raw({
        investors: [
          raiseInvestor({ uuid: "x", tagline: null, about: "We back founders. Since 2010." }),
          raiseInvestor({ uuid: "y", tagline: null, about: null, londonRoundsSince2024: 1 }),
        ],
      }),
    );
    expect(dataset.investors.map((i) => i.oneLiner)).toEqual([
      "We back founders.",
      "Venture capital firm in London, 1 London round since 2024.",
    ]);
  });
});

describe("statedChequeGbp", () => {
  it("converts USD and EUR cheques at the fixed rates", () => {
    const usd = raiseInvestor({ chequeMin: 100_000, chequeMax: 1_000_000, chequeCurrency: "USD" });
    const eur = raiseInvestor({ chequeMin: 100_000, chequeMax: 1_000_000, chequeCurrency: "EUR" });
    expect(statedChequeGbp(usd)).toEqual({ min: 79_000, max: 790_000 });
    expect(statedChequeGbp(eur)).toEqual({ min: 85_000, max: 850_000 });
  });

  it("keeps GBP as is", () => {
    expect(statedChequeGbp(raiseInvestor({}))).toEqual({ min: 250_000, max: 1_500_000 });
  });

  it("treats a 0 or 1 floor as unknown and derives it from the ceiling", () => {
    expect(statedChequeGbp(raiseInvestor({ chequeMin: 1, chequeMax: 15_151_509 }))).toEqual({
      min: 1_515_151,
      max: 15_151_509,
    });
    expect(statedChequeGbp(raiseInvestor({ chequeMin: 0, chequeMax: 0 }))).toBeNull();
  });

  it("returns null when the ticket or currency is missing", () => {
    expect(statedChequeGbp(raiseInvestor({ chequeMin: null, chequeMax: null }))).toBeNull();
    const jpy = raiseInvestor({ chequeMin: 1e7, chequeMax: 1e8, chequeCurrency: "JPY" });
    expect(statedChequeGbp(jpy)).toBeNull();
  });

  it("gives a firm with no stated ticket the default range for its type", () => {
    const none = raiseInvestor({ investorType: "angel", chequeMin: null, chequeMax: null });
    const { dataset } = fromRaise(raw({ investors: [none] }));
    expect(dataset.investors[0]?.checkSizeGbp).toEqual(DEFAULT_CHEQUE_GBP.angel);
  });
});
