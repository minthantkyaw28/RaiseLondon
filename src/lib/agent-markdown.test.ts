import { describe, expect, it } from "vitest";

import type { Dataset, Investor, Review } from "@/data/types";
import {
  parseListQuery,
  renderInvestorList,
  renderInvestorNotFound,
  renderInvestorPage,
  renderLlmsTxt,
} from "./agent-markdown";

const investor = (over: Partial<Investor>): Investor => ({
  id: "inv_x",
  slug: "x",
  name: "X",
  type: "vc",
  oneLiner: "A fund.",
  website: "https://x.example",
  address: "1 Somewhere Street, London EC1A 1AA",
  lat: 51.5,
  lng: -0.1,
  stages: ["seed"],
  sectors: ["ai"],
  checkSizeGbp: { min: 250_000, max: 2_000_000 },
  dealsLast12m: 4,
  portfolio: [],
  partners: [],
  ...over,
});

const score = (n: 1 | 5) => ({ responsiveness: n, valueAdd: n, fairTerms: n, founderFirst: n });
const review = (id: string, verified: boolean, n: 1 | 5): Review => ({
  id,
  investorId: "inv_a",
  portfolioCompany: "Gridwise",
  verified,
  scores: score(n),
  tags: [],
  date: "2026-01-01",
});

const dataset: Dataset = {
  generatedAt: "2026-10-28",
  source: "mock",
  debriefs: [],
  investors: [
    investor({
      id: "inv_a",
      slug: "alder-capital",
      name: "Alder Capital",
      type: "angel-network",
      oneLiner: "Pre-seed climate angels.",
      stages: ["pre-seed", "series-a"],
      sectors: ["climate", "b2b-saas"],
      fundSizeGbpM: 120,
      portfolio: ["Gridwise", "Lumen"],
      partners: [{ id: "p1", name: "Freya Haddad", title: "General Partner", focus: [] }],
    }),
    investor({
      id: "inv_b",
      slug: "birch-ventures",
      name: "Birch Ventures",
      oneLiner: "Seed AI fund.",
      stages: ["seed"],
      sectors: ["ai"],
      partners: [{ id: "p2", name: "Ravi Osei", title: "Partner", focus: [] }],
    }),
  ],
  reviews: [review("r1", true, 5), review("r2", false, 1)],
};

const list = (qs: string) => renderInvestorList(dataset, parseListQuery(new URLSearchParams(qs)));

describe("renderInvestorList", () => {
  it("lists every investor as a markdown link to its .md page", () => {
    const md = list("");
    expect(md).toContain("- [Alder Capital](/investor/alder-capital.md): Pre-seed climate angels.");
    expect(md).toContain("- [Birch Ventures](/investor/birch-ventures.md): Seed AI fund.");
    expect(md).toContain("2 investors.");
    expect(md).toContain("mock");
  });

  it("filters by stage, accepting comma-separated slugs", () => {
    expect(list("stage=seed")).not.toContain("Alder Capital");
    expect(list("stage=seed")).toContain("Birch Ventures");
    const both = list("stage=series-a,seed");
    expect(both).toContain("Alder Capital");
    expect(both).toContain("Birch Ventures");
  });

  it("filters by sector", () => {
    const md = list("sector=climate");
    expect(md).toContain("Alder Capital");
    expect(md).not.toContain("Birch Ventures");
    expect(md).toContain("1 of 2 investors match sector=climate.");
  });

  it("searches name, one-liner and partner names with q, case-insensitively", () => {
    expect(list("q=birch")).not.toContain("Alder Capital");
    expect(list("q=CLIMATE")).toContain("Alder Capital");
    expect(list("q=ravi osei")).toContain("Birch Ventures");
    expect(list("q=ravi osei")).not.toContain("Alder Capital");
  });

  it("does not match q against fields outside the documented set", () => {
    expect(list("q=Gridwise")).toContain("0 of 2 investors match");
  });

  it("combines filters with AND", () => {
    expect(list("stage=seed&sector=climate")).toContain("0 of 2 investors match");
  });
});

describe("renderInvestorPage", () => {
  it("renders the full profile with readable labels and the review summary", () => {
    const md = renderInvestorPage(dataset, "alder-capital");
    expect(md).not.toBeNull();
    expect(md).toContain("# Alder Capital");
    expect(md).toContain("- Type: Angel network");
    expect(md).toContain("- Website: https://x.example");
    expect(md).toContain("- Address: 1 Somewhere Street, London EC1A 1AA");
    expect(md).toContain("- Stages: Pre-seed, Series A");
    expect(md).toContain("- Sectors: Climate, B2B SaaS");
    expect(md).toContain("- Cheque size: £250k–£2m");
    expect(md).toContain("- Fund size: £120m");
    expect(md).toContain("- Deals in the last 12 months: 4");
    expect(md).toContain("- Freya Haddad, General Partner");
    expect(md).toContain("- Gridwise");
    expect(md).toContain("- Reviews: 2 (1 verified)");
    expect(md).toContain("- Overall score: 4.2 / 5");
  });

  it("handles an investor with no reviews and no disclosed fund", () => {
    const md = renderInvestorPage(dataset, "birch-ventures");
    expect(md).toContain("- Reviews: 0 (0 verified)");
    expect(md).toContain("- Overall score: No reviews yet");
    expect(md).toContain("- Fund size: Not disclosed");
  });

  it("returns null for an unknown slug", () => {
    expect(renderInvestorPage(dataset, "nope")).toBeNull();
    expect(renderInvestorNotFound("nope")).toContain("No investor has the slug `nope`");
  });
});

describe("renderLlmsTxt", () => {
  it("says the data is mock, read-only, and documents the endpoints", () => {
    const txt = renderLlmsTxt(dataset);
    expect(txt.startsWith("# Raise")).toBe(true);
    expect(txt).toContain("mock");
    expect(txt).toContain("no write API");
    expect(txt).toContain("/index.md");
    expect(txt).toContain("/investor/<slug>.md");
  });

  it("stops calling the data mock once it comes from Dealroom", () => {
    const txt = renderLlmsTxt({ ...dataset, source: "dealroom" });
    expect(txt).not.toContain("mock");
    expect(txt).toContain("Dealroom");
    expect(
      renderInvestorList({ ...dataset, source: "dealroom" }, parseListQuery(new URLSearchParams())),
    ).not.toContain("mock");
  });
});
