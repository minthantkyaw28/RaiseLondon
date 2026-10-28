import { describe, expect, it } from "vitest";

import type { Sector } from "@/data/types";
import { extractProfile } from "./pitch-profile";
import { SECTOR_TERMS, termsToRegex } from "./sector-keywords";

const sectorsOf = (pitch: string) => extractProfile(pitch).sectors;

describe("termsToRegex", () => {
  it("matches multi-word terms with a space, a hyphen or nothing between words", () => {
    const re = termsToRegex(["e commerce", "buy now pay later"]);
    expect(re.test("an e commerce brand")).toBe(true);
    expect(re.test("an e-commerce brand")).toBe(true);
    expect(re.test("an ecommerce brand")).toBe(true);
    expect(re.test("buy-now-pay-later for vets")).toBe(true);
  });

  it("matches whole words only, plus a plural s", () => {
    const re = termsToRegex(["health", "sdk"]);
    expect(re.test("health records")).toBe(true);
    expect(re.test("our sdks")).toBe(true);
    expect(re.test("healthy margins")).toBe(false);
    expect(re.test("unhealthy")).toBe(false);
  });

  it("escapes regex characters and treats apostrophes as optional", () => {
    const re = termsToRegex(["ci/cd", "women's health"]);
    expect(re.test("faster ci/cd")).toBe(true);
    expect(re.test("womens health")).toBe(true);
    expect(re.test("women's health")).toBe(true);
    expect(termsToRegex(["a.b"]).test("axb")).toBe(false);
  });

  it("has no duplicate terms within a sector", () => {
    for (const terms of Object.values(SECTOR_TERMS)) {
      expect(new Set(terms).size).toBe(terms.length);
    }
  });
});

const POSITIVE: Record<Sector, string[]> = {
  ai: [
    "We're building AI copilots that draft discovery responses using retrieval-augmented generation.",
    "A computer vision model that spots defects on factory lines in real time.",
    "Voice agents built on fine-tuned LLMs that answer calls for clinics.",
    "An agentic platform that helps MLOps teams ship models faster.",
    "Natural language processing that turns call notes into structured data.",
  ],
  fintech: [
    "Open banking rails that let tenants pay rent by bank transfer.",
    "BNPL for vet bills, FCA authorised, with KYC built in.",
    "A stablecoin wallet for remittances from the UK to Nigeria.",
    "Bookkeeping for freelancers that files your tax return with HMRC.",
    "A pensions app that consolidates old workplace pots.",
  ],
  healthtech: [
    "Remote patient monitoring for heart failure patients discharged from NHS trusts.",
    "A femtech app for perimenopause symptom tracking.",
    "A wearable ECG patch that flags atrial fibrillation early.",
    "Telehealth for mental health support in care homes.",
    "Recruiting for clinical trials so pharma sponsors fill studies faster.",
  ],
  climate: [
    "Direct air capture with MRV built in for carbon removal buyers.",
    "We install heat pumps and handle retrofit and insulation grants.",
    "EV charging hubs for taxi fleets across London.",
    "We turn supermarket food waste into compost for regenerative farming.",
    "Green hydrogen electrolysers for heavy industry.",
  ],
  devtools: [
    "An observability SDK that gives you tracing out of the box.",
    "CI/CD pipelines that run your end-to-end tests ten times faster.",
    "A Postgres-compatible serverless database for edge apps.",
    "Secrets management and zero trust access for engineering teams.",
    "A low-code builder for internal tools.",
  ],
  consumer: [
    "A dating app for Gen Z that matches people through shared playlists.",
    "A resale marketplace for vintage streetwear.",
    "A D2C skincare brand for sensitive skin.",
    "A mobile games studio making cosy puzzle games.",
    "Food delivery from local takeaways without the 30% commission.",
  ],
  "b2b-saas": [
    "Vertical SaaS that runs bookings for independent gyms.",
    "A CRM for estate agents and letting agents.",
    "Legal tech that automates contract review for law firms.",
    "Procurement software for local councils.",
    "SOC 2 compliance automation for startups selling to enterprises.",
  ],
  deeptech: [
    "Humanoid robots for warehouse picking.",
    "Quantum computing error correction on superconducting qubits.",
    "A university spinout making photonics chips for data centres.",
    "A brain-computer interface for people with paralysis.",
    "A fusion energy startup building a compact reactor.",
  ],
};

describe("sector keywords: everyday pitch language", () => {
  for (const [sector, pitches] of Object.entries(POSITIVE)) {
    it.each(pitches)(`tags ${sector}: %s`, (pitch) => {
      expect(sectorsOf(pitch)).toContain(sector);
    });
  }
});

const CROSS_CHECKS: [string, Sector][] = [
  ["Card payments for independent cafes with next-day settlement.", "climate"],
  ["A dating app where singles meet at supper clubs.", "healthtech"],
  ["A platform for estate agents to manage viewings.", "ai"],
  ["Software that helps carbon credit buyers verify projects.", "fintech"],
  ["An energy drink brand for gamers.", "climate"],
  ["A social app for book lovers, with audio on our radar.", "deeptech"],
  ["A quantum leap in how small businesses chase late payers.", "deeptech"],
  ["We're fine-tuning our go-to-market and have a database of 10,000 suppliers.", "ai"],
  ["We're fine-tuning our go-to-market and have a database of 10,000 suppliers.", "devtools"],
  ["Our margins are healthy and our growth is sustainable.", "healthtech"],
  ["Our margins are healthy and our growth is sustainable.", "climate"],
  ["A booking tool for property developers and their buyers.", "devtools"],
  ["A fitness app that books gym classes near you.", "b2b-saas"],
  ["HR software for SMEs to manage holidays and payslips.", "consumer"],
  ["A workout app that logs every rep.", "devtools"],
  ["Neural networks that score loan applications.", "healthtech"],
];

describe("sector keywords: no wrong sector", () => {
  it.each(CROSS_CHECKS)("%s is not tagged %s", (pitch, wrong) => {
    expect(sectorsOf(pitch)).not.toContain(wrong);
  });
});
