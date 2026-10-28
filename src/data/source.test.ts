import { describe, expect, it } from "vitest";

import mock from "./investors.mock.json";
import { fetchDataset } from "./source.server";

describe("home page dataset", () => {
  const ds = fetchDataset();

  it("serves the real London investors from the Dealroom export", () => {
    expect(ds.source).toBe("dealroom");
    expect(ds.investors.length).toBeGreaterThan(200);
    expect(new Set(ds.investors.map((i) => i.slug)).size).toBe(ds.investors.length);
  });

  it("contains none of the 28 fictional mock firms", () => {
    const real = new Set(ds.investors.map((i) => i.name));
    expect(mock.investors.filter((i) => real.has(i.name))).toEqual([]);
  });

  it("carries no reviews or debriefs, so no real firm gets an invented rating", () => {
    expect(ds.reviews).toEqual([]);
    expect(ds.debriefs).toEqual([]);
  });

  it("puts every pin inside Greater London", () => {
    for (const v of ds.investors) {
      expect(v.lat).toBeGreaterThan(51.28);
      expect(v.lat).toBeLessThan(51.7);
      expect(v.lng).toBeGreaterThan(-0.52);
      expect(v.lng).toBeLessThan(0.34);
    }
  });
});
