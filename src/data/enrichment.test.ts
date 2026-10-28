import { describe, expect, it } from "vitest";

import { rankInvestors } from "@/lib/raise/score";
import type { Dataset as RaiseDataset, Investor as RaiseInvestor } from "@/lib/raise/types";
import { DEALROOM_TERMS } from "@/lib/pitch-to-startup";

import {
  SCORER_TAG,
  applyEnrichment,
  enrichScoringRow,
  loadEnrichment,
  type DraftInvestor,
  type Enrichment,
  type RawEnrichment,
} from "./enrichment";
import enrichmentJson from "./enrichment.json";
import { DEFAULT_CHEQUE_GBP, fromRaise } from "./from-raise";
import type { Sector } from "./types";

const row = (over: Partial<RaiseInvestor>): RaiseInvestor => ({
  uuid: "u1",
  name: "Northfield Ventures",
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
  lat: 51.5246,
  lon: -0.0784,
  chequeMin: null,
  chequeMax: null,
  chequeCurrency: "GBP",
  preferredRound: null,
  stages: ["Seed"],
  stageMix: [],
  sectors: [],
  lastRoundDate: null,
  investmentsCount: 10,
  londonRoundsSince2024: 4,
  isActive: true,
  thesis: null,
  ...over,
});

const raw = (investors: RaiseInvestor[]): RaiseDataset => ({
  generatedAt: "2026-10-28T19:52:31.215Z",
  currency: "GBP",
  investors,
  deals: [],
  news: [],
  people: [],
});

const draft = (over: Partial<DraftInvestor>): DraftInvestor => ({
  id: "u1",
  slug: "northfield-ventures",
  name: "Northfield Ventures",
  type: "vc",
  oneLiner: "",
  website: "",
  address: "London",
  lat: 51.5074,
  lng: -0.1278,
  stages: ["seed"],
  sectors: [],
  checkSizeGbp: null,
  dealsLast12m: 0,
  portfolio: [],
  partners: [],
  ...over,
});

const entry = (over: Partial<Enrichment>): Enrichment => ({
  uuid: "u1",
  name: "Northfield Ventures",
  office: null,
  sectors: null,
  sectorsSource: null,
  stages: null,
  stagesSource: null,
  chequeGbp: null,
  chequeSource: null,
  confidence: "high",
  notes: null,
  ...over,
});

const office = {
  address: "1 Example Street, London EC2A 1AA",
  postcode: "EC2A 1AA",
  lat: 51.52,
  lng: -0.08,
  source: "https://northfield.example/contact",
};

describe("loadEnrichment", () => {
  it("loads the committed file, keyed by Dealroom uuid", () => {
    const map = loadEnrichment(enrichmentJson);
    expect(map.size).toBe(157);
    expect(map.get("81bca5ea-1155-4e7e-93ef-0149c565446c")?.name).toBe("SFC Capital");
  });

  it("rejects a stage or confidence it doesn't know", () => {
    const base: RawEnrichment = { ...entry({}), stages: null, confidence: "high" };
    expect(() => loadEnrichment([{ ...base, stages: ["series-z"] }])).toThrow(/series-z/);
    expect(() => loadEnrichment([{ ...base, confidence: "low" }])).toThrow(/low/);
  });
});

describe("applyEnrichment", () => {
  it("puts the pin and address on the researched office, with its source", () => {
    const out = applyEnrichment(draft({}), entry({ office }));
    expect(out).toMatchObject({
      lat: 51.52,
      lng: -0.08,
      address: "1 Example Street, London EC2A 1AA",
      sources: { office: "https://northfield.example/contact" },
    });
  });

  it("adds enrichment sectors to Dealroom's through the mapping table, once each", () => {
    const out = applyEnrichment(
      draft({ sectors: ["healthtech"] }),
      entry({ sectors: ["Life sciences", "insurtech", "AI", "healthtech", "edtech"] }),
    );
    expect(out.sectors).toEqual(["healthtech", "fintech", "ai"]);
    expect(out.generalist).toBeUndefined();
  });

  it("marks a generalist without adding sectors", () => {
    const out = applyEnrichment(draft({ sectors: [] }), entry({ sectors: ["generalist"] }));
    expect(out.sectors).toEqual([]);
    expect(out.generalist).toBe(true);
  });

  it("uses enrichment stages only when Dealroom has none", () => {
    const e = entry({ stages: ["seed", "pre-seed"], stagesSource: "https://n.example/faq" });
    const filled = applyEnrichment(draft({ stages: [] }), e);
    expect(filled.stages).toEqual(["pre-seed", "seed"]);
    expect(filled.sources).toEqual({ stages: "https://n.example/faq" });
    const kept = applyEnrichment(draft({ stages: ["series-a"] }), e);
    expect(kept.stages).toEqual(["series-a"]);
    expect(kept.sources).toBeUndefined();
  });

  it("uses the enrichment cheque only when Dealroom's is missing", () => {
    const e = entry({
      chequeGbp: { min: 100_000, max: 300_000 },
      chequeSource: "https://n.example/faq",
    });
    const filled = applyEnrichment(draft({ checkSizeGbp: null }), e);
    expect(filled.checkSizeGbp).toEqual({ min: 100_000, max: 300_000 });
    expect(filled.sources).toEqual({ cheque: "https://n.example/faq" });
    const stated = { min: 500_000, max: 2_000_000 };
    expect(applyEnrichment(draft({ checkSizeGbp: stated }), e).checkSizeGbp).toEqual(stated);
  });

  it("derives a missing bound the way the adapter does", () => {
    const only = (min: number | null, max: number | null) =>
      applyEnrichment(draft({}), entry({ chequeGbp: { min, max }, chequeSource: "https://s" }))
        .checkSizeGbp;
    expect(only(null, 3_000_000)).toEqual({ min: 300_000, max: 3_000_000 });
    expect(only(100_000, null)).toEqual({ min: 100_000, max: 1_000_000 });
  });

  it("ignores an implausible enrichment cheque", () => {
    const e = entry({ chequeGbp: { min: 5_000_000, max: 1_000_000 }, chequeSource: "https://s" });
    expect(applyEnrichment(draft({}), e).checkSizeGbp).toBeNull();
  });
});

describe("fromRaise with enrichment", () => {
  it("pins a researched office instead of fanning it out round the centre", () => {
    const centre = { lat: 51.50735, lon: -0.1277583 };
    const report = fromRaise(
      raw([row({ uuid: "u1", ...centre }), row({ uuid: "u2", name: "Other", ...centre })]),
      new Map([["u1", entry({ office })]]),
    );
    const [enriched, spread] = report.dataset.investors;
    expect(enriched).toMatchObject({ lat: 51.52, lng: -0.08, address: office.address });
    expect(spread?.address).toBe("London");
    expect(report.cityLevelPins).toBe(1);
    expect(report.enriched.pins).toBe(1);
  });

  it("discards implausible Dealroom cheques even without enrichment", () => {
    const report = fromRaise(
      raw([
        row({ uuid: "rtp", chequeMin: 1_893_939, chequeMax: 8_333_330_000 }),
        row({ uuid: "crane", chequeMin: 189_394, chequeMax: 4 }),
        row({ uuid: "hedo", chequeMin: 1, chequeMax: 38 }),
        row({ uuid: "flip", chequeMin: 2_000_000, chequeMax: 1_000_000 }),
        row({ uuid: "ok", chequeMin: 250_000, chequeMax: 2_000_000 }),
      ]),
    );
    expect(report.dataset.investors.map((i) => i.checkSizeGbp)).toEqual([
      DEFAULT_CHEQUE_GBP.vc,
      DEFAULT_CHEQUE_GBP.vc,
      DEFAULT_CHEQUE_GBP.vc,
      DEFAULT_CHEQUE_GBP.vc,
      { min: 250_000, max: 2_000_000 },
    ]);
    expect(report.discardedCheques).toBe(4);
  });

  it("replaces an implausible Dealroom cheque with the enrichment's", () => {
    const report = fromRaise(
      raw([row({ chequeMin: 1_893_939, chequeMax: 8_333_330_000 })]),
      new Map([
        [
          "u1",
          entry({ chequeGbp: { min: 1_000_000, max: 10_000_000 }, chequeSource: "https://s" }),
        ],
      ]),
    );
    expect(report.dataset.investors[0]).toMatchObject({
      checkSizeGbp: { min: 1_000_000, max: 10_000_000 },
      sources: { cheque: "https://s" },
    });
    expect(report.enriched).toMatchObject({ cheques: 1, pins: 0 });
  });
});

describe("enrichScoringRow", () => {
  it("drops an implausible Dealroom ticket, even without enrichment", () => {
    const out = enrichScoringRow(row({ chequeMin: 37_879, chequeMax: 8_333_330_000 }), undefined);
    expect([out.chequeMin, out.chequeMax]).toEqual([null, null]);
    const fine = enrichScoringRow(row({ chequeMin: 250_000, chequeMax: 2_000_000 }), undefined);
    expect([fine.chequeMin, fine.chequeMax]).toEqual([250_000, 2_000_000]);
  });

  it("fills the cheque when Dealroom's is missing or implausible, never over a stated one", () => {
    const e = entry({ chequeGbp: { min: null, max: 3_000_000 }, chequeSource: "https://s" });
    const missing = enrichScoringRow(row({}), e);
    expect([missing.chequeMin, missing.chequeMax, missing.chequeCurrency]).toEqual([
      300_000,
      3_000_000,
      "GBP",
    ]);
    const corrupt = enrichScoringRow(row({ chequeMin: 189_394, chequeMax: 4 }), e);
    expect([corrupt.chequeMin, corrupt.chequeMax]).toEqual([300_000, 3_000_000]);
    const stated = enrichScoringRow(row({ chequeMin: 250_000, chequeMax: 2_000_000 }), e);
    expect([stated.chequeMin, stated.chequeMax]).toEqual([250_000, 2_000_000]);
  });

  it("adds sectors as tags his scorer matches, without repeats; generalist adds none", () => {
    const out = enrichScoringRow(
      row({ sectors: ["Health"] }),
      entry({ sectors: ["life sciences", "fintech", "insurtech", "AI", "generalist"] }),
    );
    expect(out.sectors).toEqual(["Health", "fintech", "artificial intelligence"]);
  });

  it("uses enrichment stages only when he reads none from Dealroom", () => {
    const e = entry({ stages: ["pre-seed", "seed"], stagesSource: "https://s" });
    const none = row({ stages: ["Other"], stageMix: [], preferredRound: null });
    expect(enrichScoringRow(none, e).stages).toEqual(["pre-seed", "seed"]);
    expect(enrichScoringRow(row({ stages: ["Series A"] }), e).stages).toEqual(["Series A"]);
  });
});

describe("SCORER_TAG", () => {
  const sectorReason = (tag: string, term: string) => {
    const [r] = rankInvestors([row({ sectors: [tag] })], {
      name: "",
      description: "",
      sector: term,
      stage: "",
      raiseAmount: null,
      lois: 0,
      preOrders: 0,
      arr: 0,
      mrr: 0,
      tractionNotes: "",
    });
    return r?.reasons[0] ?? "";
  };
  const sectors = Object.keys(SCORER_TAG) as Sector[];

  it("gets full sector credit from one of its own sector's terms", () => {
    for (const s of sectors) {
      expect(DEALROOM_TERMS[s]).toContain(SCORER_TAG[s]);
    }
  });

  it("gets no sector credit, full or partial, from any other sector's terms", () => {
    for (const s of sectors) {
      for (const other of sectors.filter((o) => o !== s)) {
        for (const term of DEALROOM_TERMS[other]) {
          expect(sectorReason(SCORER_TAG[s], term), `${s} tag vs ${term}`).toMatch(/^No sector/);
        }
      }
    }
  });
});
