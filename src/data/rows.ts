import type { Database } from "@/integrations/supabase/types";

import type {
  Dataset,
  Debrief,
  DebriefReason,
  Investor,
  InvestorType,
  MeetingOutcome,
  Partner,
  PickyTopic,
  Review,
  Sector,
  Stage,
} from "./types";

type Tables = Database["public"]["Tables"];
export type InvestorRow = Tables["investors"]["Row"];
export type ReviewRow = Tables["reviews"]["Row"];
export type DebriefRow = Tables["debriefs"]["Row"];

export interface DatasetRows {
  investors: InvestorRow[];
  reviews: ReviewRow[];
  debriefs: DebriefRow[];
}

type Score = 1 | 2 | 3 | 4 | 5;

// "inv_2" before "inv_10": keeps the same order as the bundled JSON, whatever order the rows arrive in.
const byNaturalId = (a: { id: string }, b: { id: string }) =>
  a.id.localeCompare(b.id, "en", { numeric: true });

export function investorFromRow(r: InvestorRow): Investor {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    type: r.type as InvestorType,
    oneLiner: r.one_liner,
    website: r.website,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    stages: r.stages as Stage[],
    sectors: r.sectors as Sector[],
    checkSizeGbp: { min: r.check_size_min_gbp, max: r.check_size_max_gbp },
    ...(r.fund_size_gbp_m == null ? {} : { fundSizeGbpM: Number(r.fund_size_gbp_m) }),
    dealsLast12m: r.deals_last_12m,
    portfolio: r.portfolio,
    partners: (r.partners ?? []) as unknown as Partner[],
  };
}

export function reviewFromRow(r: ReviewRow): Review {
  return {
    id: r.id,
    investorId: r.investor_id,
    portfolioCompany: r.portfolio_company,
    verified: r.verified,
    scores: {
      responsiveness: r.responsiveness as Score,
      valueAdd: r.value_add as Score,
      fairTerms: r.fair_terms as Score,
      founderFirst: r.founder_first as Score,
    },
    tags: r.tags,
    date: r.date,
  };
}

export function debriefFromRow(r: DebriefRow): Debrief {
  return {
    id: r.id,
    investorId: r.investor_id,
    outcome: r.outcome as MeetingOutcome,
    reasons: r.reasons as DebriefReason[],
    pickyAbout: r.picky_about as PickyTopic[],
    date: r.date,
  };
}

export function rowsToDataset(rows: DatasetRows): Dataset {
  const all = [...rows.investors, ...rows.reviews, ...rows.debriefs];
  const newest = all.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), "");
  return {
    generatedAt: newest.slice(0, 10),
    // Any mock row left means the directory still contains fictional firms, so keep the badge.
    source: all.some((r) => r.source === "mock") ? "mock" : "dealroom",
    investors: [...rows.investors].sort(byNaturalId).map(investorFromRow),
    reviews: [...rows.reviews].sort(byNaturalId).map(reviewFromRow),
    debriefs: [...rows.debriefs].sort(byNaturalId).map(debriefFromRow),
  };
}
