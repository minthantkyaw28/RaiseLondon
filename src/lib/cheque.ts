// Cheque-size helpers shared by the home map filter and the profile edit form.

export type ChequeBucketId = "any" | "under-250k" | "250k-1m" | "1m-5m" | "over-5m";

export const CHEQUE_BUCKETS: { id: ChequeBucketId; label: string; min: number; max: number }[] = [
  { id: "any", label: "Any", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "under-250k", label: "Under £250k", min: 0, max: 250_000 },
  { id: "250k-1m", label: "£250k–£1m", min: 250_000, max: 1_000_000 },
  { id: "1m-5m", label: "£1m–£5m", min: 1_000_000, max: 5_000_000 },
  { id: "over-5m", label: "£5m+", min: 5_000_000, max: Number.POSITIVE_INFINITY },
];

// An investor fits when its cheque range overlaps the bucket. Unknown ranges (0–0) never fit a
// specific bucket, so a filter never shows firms whose cheque size we don't know.
export function chequeFits(range: { min: number; max: number }, bucketId: ChequeBucketId): boolean {
  const bucket = CHEQUE_BUCKETS.find((b) => b.id === bucketId);
  if (!bucket || bucket.id === "any") return true;
  const low = Math.min(range.min, range.max);
  const high = Math.max(range.min, range.max);
  if (high <= 0) return false;
  return low < bucket.max && high >= bucket.min;
}

// Reads "250000", "250,000", "£250k", "1.5m" or "2bn". Returns null for blank input and NaN for
// anything else, so the form can tell "keep the Dealroom number" from "typo".
export function parseGbpAmount(input: string): number | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/[£,\s]/g, "");
  if (!text) return null;
  const match = /^(\d+(?:\.\d+)?)(k|m|bn)?$/.exec(text);
  if (!match) return Number.NaN;
  const scale = { k: 1_000, m: 1_000_000, bn: 1_000_000_000 }[match[2] ?? ""] ?? 1;
  return Math.round(Number(match[1]) * scale);
}
