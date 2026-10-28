import { afterEach, describe, expect, it, vi } from "vitest";

import { fallbackDataset } from "./fallback";
import { rowsToDataset, type DatasetRows } from "./rows";
import { fetchDataset } from "./source.server";

const stamp = "2026-10-28T12:00:00+00:00";

// The inverse of rows.ts, mirroring how the migration seeded the tables from the mock JSON.
function mockAsRows(source = "mock"): DatasetRows {
  return {
    investors: fallbackDataset.investors.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      type: i.type,
      one_liner: i.oneLiner,
      website: i.website,
      address: i.address,
      lat: i.lat,
      lng: i.lng,
      stages: i.stages,
      sectors: i.sectors,
      check_size_min_gbp: i.checkSizeGbp.min,
      check_size_max_gbp: i.checkSizeGbp.max,
      fund_size_gbp_m: i.fundSizeGbpM ?? null,
      deals_last_12m: i.dealsLast12m,
      portfolio: i.portfolio,
      partners: JSON.parse(JSON.stringify(i.partners)),
      source,
      updated_at: stamp,
    })),
    reviews: fallbackDataset.reviews.map((r) => ({
      id: r.id,
      investor_id: r.investorId,
      portfolio_company: r.portfolioCompany,
      verified: r.verified,
      responsiveness: r.scores.responsiveness,
      value_add: r.scores.valueAdd,
      fair_terms: r.scores.fairTerms,
      founder_first: r.scores.founderFirst,
      tags: r.tags,
      date: r.date,
      source,
      updated_at: stamp,
    })),
    debriefs: fallbackDataset.debriefs.map((d) => ({
      id: d.id,
      investor_id: d.investorId,
      outcome: d.outcome,
      reasons: d.reasons,
      picky_about: d.pickyAbout,
      date: d.date,
      source,
      updated_at: stamp,
    })),
  };
}

describe("database rows → Dataset", () => {
  it("rebuilds the bundled 28 investors, 76 reviews and 40 debriefs exactly", () => {
    const ds = rowsToDataset(mockAsRows());
    expect(ds.investors).toHaveLength(28);
    expect(ds.reviews).toHaveLength(76);
    expect(ds.debriefs).toHaveLength(40);
    expect(ds.investors).toEqual(fallbackDataset.investors);
    expect(ds.reviews).toEqual(fallbackDataset.reviews);
    expect(ds.debriefs).toEqual(fallbackDataset.debriefs);
  });

  it("keeps the bundled order whatever order the rows come back in", () => {
    const rows = mockAsRows();
    rows.investors.reverse();
    rows.reviews.reverse();
    const ds = rowsToDataset(rows);
    expect(ds.investors.map((i) => i.id).slice(0, 3)).toEqual(["inv_1", "inv_2", "inv_3"]);
    expect(ds.reviews[9]!.id).toBe("r_10");
  });

  it("keeps the Mock data badge while any mock row remains", () => {
    const rows = mockAsRows("dealroom");
    expect(rowsToDataset(rows).source).toBe("dealroom");
    rows.debriefs[0]!.source = "mock";
    expect(rowsToDataset(rows).source).toBe("mock");
  });
});

describe("fetchDataset fallback", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves the bundled data and logs when the database settings are missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const ds = await fetchDataset();
    expect(ds).toBe(fallbackDataset);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("serves the bundled data when the database is unreachable", async () => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:9");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const ds = await fetchDataset();
    expect(ds.investors).toHaveLength(28);
    expect(ds).toBe(fallbackDataset);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
