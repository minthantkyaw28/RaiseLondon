import { describe, expect, it } from "vitest";

import type { Company, Deal, Investor } from "@/lib/raise/types";
import { inferSectors, withInferredSectors } from "./infer-sectors";

const company = (uuid: string, sectors: string[]): Company => ({
  uuid,
  name: uuid,
  tagline: null,
  about: null,
  website: null,
  linkedin: null,
  image: null,
  dealroomUrl: null,
  hqCity: "London",
  hqCountry: "United Kingdom",
  lat: null,
  lon: null,
  sectors,
  launchYear: null,
  employees: null,
  totalFunding: null,
  focus: "life_sciences",
});

let dealId = 0;
const deal = (investorUuid: string, companyUuid: string | null): Deal => ({
  id: String(++dealId),
  transactionId: String(dealId),
  investorUuid,
  companyUuid,
  companyName: companyUuid ?? "Undisclosed company",
  roundYear: 2025,
  roundMonth: 1,
  standardizedRound: "SEED",
  roundType: null,
  amount: null,
  currency: "GBP",
  isLead: null,
  sourceUrl: null,
});

const investor = (uuid: string, sectors: string[]): Investor => ({
  uuid,
  name: uuid,
  investorType: "venture_capital",
  investorTypes: [],
  recordType: "organization",
  tagline: null,
  about: null,
  website: null,
  linkedin: null,
  image: null,
  dealroomUrl: null,
  hqCity: "London",
  hqCountry: "United Kingdom",
  lat: null,
  lon: null,
  chequeMin: null,
  chequeMax: null,
  chequeCurrency: "GBP",
  preferredRound: null,
  stages: [],
  stageMix: [],
  sectors,
  lastRoundDate: null,
  investmentsCount: 0,
  londonRoundsSince2024: 0,
  isActive: true,
  thesis: null,
});

/** `n` portfolio companies Dealroom has no profile for. */
const unprofiled = (investorUuid: string, n: number) =>
  Array.from({ length: n }, (_, i) => deal(investorUuid, `${investorUuid}-unknown-${i}`));

describe("inferSectors", () => {
  it("takes a tag two portfolio companies share, however large the portfolio", () => {
    const companies = [company("c1", ["Health", "Oncology"]), company("c2", ["Health"])];
    const deals = [deal("v", "c1"), deal("v", "c2"), ...unprofiled("v", 30)];
    expect(inferSectors(deals, companies).get("v")).toEqual(["Health"]);
  });

  it("takes a tag held by 25% or more of a small portfolio", () => {
    const companies = [company("c1", ["Medical Devices"])];
    expect(inferSectors([deal("v", "c1"), ...unprofiled("v", 3)], companies).get("v")).toEqual([
      "Medical Devices",
    ]);
    expect(inferSectors([deal("v", "c1"), ...unprofiled("v", 4)], companies).get("v")).toBe(
      undefined,
    );
  });

  it("counts a company once however many deals name it", () => {
    const companies = [company("c1", ["Health"])];
    const deals = [deal("v", "c1"), deal("v", "c1"), ...unprofiled("v", 4)];
    expect(inferSectors(deals, companies).get("v")).toBe(undefined);
  });

  it("ignores deals with no company and tags under three letters", () => {
    const companies = [company("c1", ["nt", "Health"])];
    const deals = [deal("v", "c1"), deal("v", null)];
    expect(inferSectors(deals, companies).get("v")).toEqual(["Health"]);
  });

  it("merges tags that differ only in case", () => {
    const companies = [company("c1", ["BioTechnology"]), company("c2", ["Biotechnology"])];
    const deals = [deal("v", "c1"), deal("v", "c2"), ...unprofiled("v", 20)];
    expect(inferSectors(deals, companies).get("v")).toEqual(["BioTechnology"]);
  });
});

describe("withInferredSectors", () => {
  const companies = [company("c1", ["Health", "Life sciences"])];
  const deals = [deal("tagged", "c1"), deal("blank", "c1"), deal("none", null)];

  it("adds portfolio tags without repeating Dealroom's own, and leaves the input alone", () => {
    const input = [investor("tagged", ["Life Sciences"]), investor("blank", [])];
    const out = withInferredSectors(input, deals, companies);
    expect(out.map((v) => v.sectors)).toEqual([
      ["Life Sciences", "Health"],
      ["Health", "Life sciences"],
    ]);
    expect(input.map((v) => v.sectors)).toEqual([["Life Sciences"], []]);
  });

  it("returns an investor with nothing to add unchanged", () => {
    const none = investor("none", ["SaaS"]);
    expect(withInferredSectors([none], deals, companies)[0]).toBe(none);
  });
});
