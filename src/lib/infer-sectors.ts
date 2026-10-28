import type { Company, Deal, Investor } from "@/lib/raise/types";

/** A tag carries over from the portfolio when at least this many portfolio companies have it… */
export const MIN_COMPANIES = 2;
/** …or when at least this share of the investor's portfolio has it. */
export const MIN_SHARE = 0.25;
// Dealroom has a few junk tags ("nt"). Min's scorer matches sectors by substring, so a two-letter
// tag would hit any pitch word that contains it.
const MIN_TAG_LENGTH = 3;

/**
 * Sectors an investor's portfolio points to, keyed by investor uuid.
 *
 * The portfolio is every distinct company the investor's deals name. The share is taken over that
 * whole portfolio, including companies Dealroom has no profile for, so one tagged company in a
 * portfolio of forty does not label the investor. Tags are kept as Dealroom spells them.
 */
export function inferSectors(deals: Deal[], companies: Company[]): Map<string, string[]> {
  const tagsByCompany = new Map(companies.map((c) => [c.uuid, c.sectors]));
  const portfolios = new Map<string, Set<string>>();
  for (const d of deals) {
    if (!d.companyUuid) continue;
    const set = portfolios.get(d.investorUuid) ?? new Set<string>();
    set.add(d.companyUuid);
    portfolios.set(d.investorUuid, set);
  }

  const out = new Map<string, string[]>();
  for (const [investorUuid, portfolio] of portfolios) {
    const counts = new Map<string, { tag: string; n: number }>();
    for (const companyUuid of portfolio) {
      const seen = new Set<string>();
      for (const tag of tagsByCompany.get(companyUuid) ?? []) {
        const key = tag.trim().toLowerCase();
        if (key.length < MIN_TAG_LENGTH || seen.has(key)) continue;
        seen.add(key);
        const entry = counts.get(key) ?? { tag: tag.trim(), n: 0 };
        entry.n++;
        counts.set(key, entry);
      }
    }
    const kept = [...counts.values()]
      .filter(({ n }) => n >= MIN_COMPANIES || n / portfolio.size >= MIN_SHARE)
      .map(({ tag }) => tag);
    if (kept.length) out.set(investorUuid, kept);
  }
  return out;
}

/** Copies of the investors with inferred portfolio sectors added to their Dealroom ones. */
export function withInferredSectors(
  investors: Investor[],
  deals: Deal[],
  companies: Company[],
): Investor[] {
  const inferred = inferSectors(deals, companies);
  return investors.map((v) => {
    const extra = inferred.get(v.uuid);
    if (!extra) return v;
    const have = new Set(v.sectors.map((s) => s.toLowerCase()));
    const added = extra.filter((s) => !have.has(s.toLowerCase()));
    return added.length ? { ...v, sectors: [...v.sectors, ...added] } : v;
  });
}
