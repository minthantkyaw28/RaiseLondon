import type { Investor, InvestorFilter } from "./types";
import { orderedCheque } from "./format";
import { canonicalStage, investorStages } from "./stages";

export const CHEQUE_BUCKETS = [
  { id: "any", label: "Any cheque" },
  { id: "under-250k", label: "Under 250k", min: 0, max: 250_000 },
  { id: "250k-1m", label: "250k–1m", min: 250_000, max: 1_000_000 },
  { id: "1m-5m", label: "1m–5m", min: 1_000_000, max: 5_000_000 },
  { id: "5m-plus", label: "5m+", min: 5_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export function chequeOverlaps(investor: Investor, bucketId: string): boolean {
  if (!bucketId || bucketId === "any") return true;
  const bucket = CHEQUE_BUCKETS.find((item) => item.id === bucketId);
  if (!bucket || !("min" in bucket)) return true;
  const { low, high } = orderedCheque(investor.chequeMin, investor.chequeMax);
  if (low == null && high == null) return false;
  const floor = low ?? 0;
  const ceiling = high ?? low ?? 0;
  return ceiling >= bucket.min && floor <= bucket.max;
}

export function sectorOptions(investors: Investor[]): string[] {
  const counts = new Map<string, number>();
  for (const investor of investors) {
    for (const sector of investor.sectors) {
      counts.set(sector, (counts.get(sector) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export function filterInvestors(investors: Investor[], filter: InvestorFilter): Investor[] {
  const query = filter.query.trim().toLowerCase();
  const wantedStage = filter.stage ? canonicalStage(filter.stage) : null;
  return investors.filter((investor) => {
    if (!investor.isActive) return false;
    if (
      filter.sector &&
      !investor.sectors.some((sector) => sector.toLowerCase() === filter.sector.toLowerCase())
    ) {
      return false;
    }
    if (wantedStage && !investorStages(investor).includes(wantedStage)) return false;
    if (!chequeOverlaps(investor, filter.cheque)) return false;
    if (!query) return true;
    const haystack = [investor.name, investor.tagline ?? "", investor.sectors.join(" ")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
