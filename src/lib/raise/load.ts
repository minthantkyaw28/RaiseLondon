import { dataset as bundled } from "./dataset";
import { supabase } from "./supabase";
import type { Company, Dataset, Deal, Investor, InvestorOverride, NewsItem, Person } from "./types";

function at(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function splitPipe(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function investorFromRow(row: Record<string, unknown>): Investor {
  return {
    uuid: String(at(row, "uuid") ?? ""),
    name: String(at(row, "name") ?? ""),
    investorType: String(at(row, "investor_type") ?? ""),
    investorTypes: splitPipe(at(row, "investor_types")),
    recordType: String(at(row, "record_type") ?? "organization"),
    tagline: text(at(row, "tagline")),
    about: text(at(row, "about")),
    website: text(at(row, "website")),
    linkedin: text(at(row, "linkedin")),
    image: text(at(row, "image")),
    dealroomUrl: text(at(row, "dealroom_url")),
    hqCity: text(at(row, "hq_city")) ?? "London",
    hqCountry: text(at(row, "hq_country")) ?? "United Kingdom",
    lat: num(at(row, "lat")),
    lon: num(at(row, "lon")),
    chequeMin: num(at(row, "cheque_min")),
    chequeMax: num(at(row, "cheque_max")),
    chequeCurrency: text(at(row, "cheque_currency")) ?? "USD",
    preferredRound: text(at(row, "preferred_round")),
    stages: splitPipe(at(row, "stages")),
    stageMix: splitPipe(at(row, "stage_mix")).flatMap((part) => {
      const splitAt = part.lastIndexOf(":");
      const stage = splitAt >= 0 ? part.slice(0, splitAt) : part;
      if (!stage) return [];
      const count = splitAt >= 0 ? Number(part.slice(splitAt + 1)) : 0;
      return [{ stage, count: Number.isFinite(count) ? count : 0 }];
    }),
    sectors: splitPipe(at(row, "sectors")),
    lastRoundDate: text(at(row, "last_round_date")),
    investmentsCount: num(at(row, "investments_count")) ?? 0,
    londonRoundsSince2024: num(at(row, "london_rounds_since_2024")) ?? 0,
    isActive: true,
    thesis: null,
  };
}

export function companyFromRow(row: Record<string, unknown>): Company {
  return {
    uuid: String(at(row, "uuid") ?? ""),
    name: String(at(row, "name") ?? ""),
    tagline: text(at(row, "tagline")),
    about: text(at(row, "about")),
    website: text(at(row, "website")),
    linkedin: text(at(row, "linkedin")),
    image: text(at(row, "image")),
    dealroomUrl: text(at(row, "dealroom_url")),
    hqCity: text(at(row, "hq_city")),
    hqCountry: text(at(row, "hq_country")),
    lat: num(at(row, "lat")),
    lon: num(at(row, "lon")),
    sectors: splitPipe(at(row, "sectors")),
    launchYear: text(at(row, "launch_year")),
    employees: text(at(row, "employees")),
    totalFunding: num(at(row, "total_funding")),
    focus: text(at(row, "focus")) ?? "life_sciences",
  };
}

export function dealFromRow(row: Record<string, unknown>): Deal {
  return {
    id: String(at(row, "id") ?? ""),
    transactionId: String(at(row, "transaction_id") ?? ""),
    investorUuid: String(at(row, "investor_uuid") ?? ""),
    companyUuid: text(at(row, "company_uuid")),
    companyName: text(at(row, "company_name")) ?? "Undisclosed company",
    roundYear: num(at(row, "round_year")),
    roundMonth: num(at(row, "round_month")),
    standardizedRound: text(at(row, "standardized_round")),
    roundType: text(at(row, "round_type")),
    amount: num(at(row, "amount")),
    currency: text(at(row, "currency")) ?? "USD",
    isLead: bool(at(row, "is_lead")),
    sourceUrl: text(at(row, "source_url")),
  };
}

export function newsFromRow(row: Record<string, unknown>): NewsItem {
  return {
    id: String(at(row, "id") ?? ""),
    title: text(at(row, "title")) ?? "Untitled",
    summary: text(at(row, "summary")),
    url: text(at(row, "url")),
    publishedAt: text(at(row, "published_at")),
    articleType: text(at(row, "article_type")),
    amount: num(at(row, "amount")),
    sector: text(at(row, "sector")),
    hqCountry: text(at(row, "hq_country")),
    relatedInvestorUuids: splitPipe(at(row, "related_investor_uuids")),
  };
}

export function personFromRow(row: Record<string, unknown>): Person {
  return {
    id: String(at(row, "id") ?? ""),
    personUuid: text(at(row, "person_uuid")),
    investorUuid: String(at(row, "investor_uuid") ?? ""),
    name: text(at(row, "name")) ?? "Unknown",
    role: text(at(row, "role")),
    linkedin: text(at(row, "linkedin")),
    image: text(at(row, "image")),
  };
}

export function overrideFromRow(row: Record<string, unknown>): InvestorOverride {
  return {
    investorUuid: String(at(row, "investor_uuid") ?? ""),
    thesis: text(at(row, "thesis")),
    chequeMin: num(at(row, "cheque_min")),
    chequeMax: num(at(row, "cheque_max")),
    stages: splitPipe(at(row, "stages")),
    sectors: splitPipe(at(row, "sectors")),
    isActive: at(row, "is_active") !== false,
  };
}

export function applyOverrides(investors: Investor[], overrides: InvestorOverride[]): Investor[] {
  const byId = new Map(overrides.map((override) => [override.investorUuid, override]));
  return investors.map((investor) => {
    const override = byId.get(investor.uuid);
    if (!override) return investor;
    return {
      ...investor,
      thesis: override.thesis,
      chequeMin: override.chequeMin ?? investor.chequeMin,
      chequeMax: override.chequeMax ?? investor.chequeMax,
      stages: override.stages.length ? override.stages : investor.stages,
      sectors: override.sectors.length ? override.sectors : investor.sectors,
      isActive: override.isActive,
    };
  });
}

export async function loadRaiseData(): Promise<{
  dataset: Dataset;
  source: "bundle" | "supabase";
}> {
  if (!supabase) return { dataset: bundled, source: "bundle" };
  const [investorsRes, dealsRes, newsRes, peopleRes, companiesRes, overridesRes] =
    await Promise.all([
      supabase.from("investors").select("*"),
      supabase.from("deals").select("*"),
      supabase.from("news").select("*"),
      supabase.from("people").select("*"),
      supabase.from("companies").select("*"),
      supabase.from("investor_overrides").select("*"),
    ]);
  if (investorsRes.error || !investorsRes.data?.length)
    return { dataset: bundled, source: "bundle" };
  const investors = applyOverrides(
    investorsRes.data.map((row) => investorFromRow(row as Record<string, unknown>)),
    (overridesRes.data ?? []).map((row) => overrideFromRow(row as Record<string, unknown>)),
  );
  return {
    source: "supabase",
    dataset: {
      generatedAt: bundled.generatedAt,
      currency: investors[0]?.chequeCurrency ?? bundled.currency,
      investors,
      deals: dealsRes.error
        ? bundled.deals
        : (dealsRes.data ?? []).map((row) => dealFromRow(row as Record<string, unknown>)),
      news: newsRes.error
        ? bundled.news
        : (newsRes.data ?? []).map((row) => newsFromRow(row as Record<string, unknown>)),
      people: peopleRes.error
        ? bundled.people
        : (peopleRes.data ?? []).map((row) => personFromRow(row as Record<string, unknown>)),
      companies: companiesRes.error
        ? (bundled.companies ?? [])
        : (companiesRes.data ?? []).map((row) => companyFromRow(row as Record<string, unknown>)),
    },
  };
}
