import type { RatingDimension, Review } from "@/data/types";

export const DIMENSIONS: { key: RatingDimension; label: string }[] = [
  { key: "responsiveness", label: "Responsiveness" },
  { key: "valueAdd", label: "Value-add" },
  { key: "fairTerms", label: "Fair terms" },
  { key: "founderFirst", label: "Founder-first" },
];

// Unverified reviews count for little; a verified founder from your own network counts most.
export function reviewWeight(review: Review, networkIds: Set<string>): number {
  if (!review.verified) return 0.25;
  return review.reviewerContactId && networkIds.has(review.reviewerContactId) ? 2 : 1;
}

export interface RatingSummary {
  overall: number | null;
  byDimension: Record<RatingDimension, number | null>;
  count: number;
  verifiedCount: number;
  fromNetwork: number;
}

export function summarizeReviews(reviews: Review[], networkIds: Set<string>): RatingSummary {
  const totals = { responsiveness: 0, valueAdd: 0, fairTerms: 0, founderFirst: 0 };
  let weightSum = 0;
  for (const r of reviews) {
    const w = reviewWeight(r, networkIds);
    weightSum += w;
    for (const d of DIMENSIONS) totals[d.key] += r.scores[d.key] * w;
  }
  const avg = (n: number) => (weightSum ? Math.round((n / weightSum) * 10) / 10 : null);
  const byDimension = {
    responsiveness: avg(totals.responsiveness),
    valueAdd: avg(totals.valueAdd),
    fairTerms: avg(totals.fairTerms),
    founderFirst: avg(totals.founderFirst),
  };
  const dims = Object.values(byDimension).filter((v): v is number => v !== null);
  return {
    overall: dims.length
      ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 10) / 10
      : null,
    byDimension,
    count: reviews.length,
    verifiedCount: reviews.filter((r) => r.verified).length,
    fromNetwork: reviews.filter((r) => r.reviewerContactId && networkIds.has(r.reviewerContactId))
      .length,
  };
}
