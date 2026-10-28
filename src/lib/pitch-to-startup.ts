import { GBP_PER } from "@/data/from-raise";
import type { Sector } from "@/data/types";
import { rankInvestors } from "@/lib/raise/score";
import { canonicalStage } from "@/lib/raise/stages";
import type { Investor, MatchResult, StartupInput } from "@/lib/raise/types";

import type { PitchProfile } from "./pitch-profile";

/**
 * Our sectors → words Min's scorer looks for in Dealroom sector names. His `sectorPoints` counts a
 * hit when a tag contains the word (or the word contains the tag), and gives partial credit when
 * any longer word of a multi-word term appears anywhere in the tags. So terms are single words or
 * phrases whose words don't occur in unrelated tags: "deep tech" would give partial credit to every
 * tag containing "tech", so deep tech is matched through hardware, space and the like instead.
 * Every term matches tags present in src/lib/raise/dataset.json (investor or portfolio company).
 * "Wellness" and "wearable" are not consumer terms: in this data they mostly come from health
 * portfolios ("Corporate Wellness", "Health and Wellness"), so a social app would hit health funds.
 */
export const DEALROOM_TERMS: Record<Sector, string[]> = {
  ai: [
    "artificial intelligence",
    "generative ai",
    "machine learning",
    "core ai",
    "ai applications",
    "ai agents",
    "ai safety",
  ],
  fintech: ["fintech", "financial", "insurance", "bitcoin", "regtech"],
  healthtech: [
    "health",
    "life sciences",
    "medical",
    "biotech",
    "pharma",
    "femtech",
    "neurology",
    "wearable",
  ],
  climate: ["climate", "agritech", "circular", "recycling", "biodiversity"],
  devtools: ["developer", "paas", "cloud", "mlops"],
  consumer: [
    "consumer",
    "social",
    "messaging",
    "apparel",
    "music",
    "video",
    "entertainment",
    "on-demand",
    "retail",
    "travel",
    "classifieds",
    "mobile app",
  ],
  "b2b-saas": ["saas", "analytics", "crm", "enterprise", "adtech", "security", "workforce"],
  deeptech: ["hardware", "space", "scientific", "semiconductor", "robotics", "photonics", "sensor"],
};

const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)`;
const UNIT = String.raw`(k|m|mn|million|thousand)?`;
const CUR = String.raw`([£$€])?`;
const MONTHLY = String.raw`mrr|monthly (?:recurring )?revenue`;
const ANNUAL = String.raw`arr|annual (?:recurring )?revenue|annual run[- ]rate`;
// "£20k MRR", "20k monthly revenue", "$1.2m ARR"
const AMOUNT_FIRST = new RegExp(
  String.raw`${CUR}\s?${NUMBER}\s?${UNIT}\s+(?:in\s+)?(${MONTHLY}|${ANNUAL})\b`,
  "g",
);
// "MRR of £20k", "ARR: $1.2m"
const LABEL_FIRST = new RegExp(
  String.raw`\b(${MONTHLY}|${ANNUAL})\s*(?:of|is|at|:|=)?\s*${CUR}\s?${NUMBER}\s?${UNIT}\b`,
  "g",
);

const SYMBOL_CURRENCY: Record<string, string> = { "£": "GBP", $: "USD", "€": "EUR" };

function toGbp(digits: string, unit: string | undefined, symbol: string | undefined): number {
  const n = Number(digits.replace(/,/g, ""));
  const scale =
    unit === "k" || unit === "thousand"
      ? 1_000
      : unit === "m" || unit === "mn" || unit === "million"
        ? 1_000_000
        : 1;
  const rate = GBP_PER[SYMBOL_CURRENCY[symbol ?? "£"] ?? "GBP"] ?? 1;
  return Math.round(n * scale * rate);
}

/** Monthly and annual recurring revenue said in a pitch, in GBP (dollars and euros converted). */
export function parseRevenue(text: string): { mrr: number; arr: number } {
  const t = text.toLowerCase();
  const out = { mrr: 0, arr: 0 };
  const record = (label: string, value: number) => {
    const key = /^(mrr|monthly)/.test(label) ? "mrr" : "arr";
    if (!out[key]) out[key] = value;
  };
  for (const [, symbol, digits, unit, label] of t.matchAll(AMOUNT_FIRST)) {
    if (digits && label) record(label, toGbp(digits, unit, symbol));
  }
  for (const [, label, symbol, digits, unit] of t.matchAll(LABEL_FIRST)) {
    if (digits && label) record(label, toGbp(digits, unit, symbol));
  }
  return out;
}

function count(text: string, re: RegExp): number {
  const m = re.exec(text.toLowerCase());
  return m?.[1] ? Number(m[1].replace(/,/g, "")) : 0;
}

/**
 * Our pitch reading → Min's StartupInput. `sector` is left empty: our pitches name several
 * sectors and his scorer takes one, so `rankPitch` scores each Dealroom term separately.
 */
export function pitchToStartup(profile: PitchProfile, text: string): StartupInput {
  const { mrr, arr } = parseRevenue(text);
  return {
    name: "",
    description: text.trim(),
    sector: "",
    stage: canonicalStage(profile.stage) ?? "",
    raiseAmount: profile.raiseGbp,
    lois: count(text, /\b(\d[\d,]*)\s+(?:lois?|letters? of intent)\b/),
    preOrders: count(text, /\b(\d[\d,]*)\s+pre-?(?:orders?|purchase orders?)\b/),
    arr,
    mrr,
    tractionNotes: "",
  };
}

/** The Dealroom terms for a profile's sectors, in order, without repeats. */
export function termsFor(sectors: Sector[]): string[] {
  return [...new Set(sectors.flatMap((s) => DEALROOM_TERMS[s]))];
}

const byRank = (a: MatchResult, b: MatchResult) =>
  b.score - a.score ||
  b.investor.londonRoundsSince2024 - a.investor.londonRoundsSince2024 ||
  a.investor.name.localeCompare(b.investor.name);

// Min's partial sector overlap is worth 18 of 40; a firm that backs any sector gets the same.
export const GENERALIST_POINTS = 18;
const NO_SECTOR_OVERLAP = /^No sector overlap with /;

/** A generalist that missed on sector gets partial sector credit in place of the miss. */
function creditGeneralist(r: MatchResult): MatchResult {
  const miss = r.reasons.findIndex((reason) => NO_SECTOR_OVERLAP.test(reason));
  if (miss < 0) return r;
  const reasons = [...r.reasons];
  reasons[miss] = "Generalist investor.";
  return { ...r, score: Math.min(100, r.score + GENERALIST_POINTS), reasons };
}

/**
 * Min's ranking for a pitch. Only the sector part of his score depends on the sector, so ranking
 * once per Dealroom term and keeping each investor's best result is his score with the best
 * sector fit across every sector we read in the pitch. `generalists` (uuids) get partial sector
 * credit where no term overlapped.
 */
export function rankPitch(
  profile: PitchProfile,
  text: string,
  investors: Investor[],
  generalists: ReadonlySet<string> = new Set(),
) {
  const input = pitchToStartup(profile, text);
  const terms = termsFor(profile.sectors);
  if (!terms.length) return rankInvestors(investors, input);
  const best = new Map<string, MatchResult>();
  for (const sector of terms) {
    for (const r of rankInvestors(investors, { ...input, sector })) {
      const prev = best.get(r.investor.uuid);
      if (!prev || r.score > prev.score) best.set(r.investor.uuid, r);
    }
  }
  return [...best.values()]
    .map((r) => (generalists.has(r.investor.uuid) ? creditGeneralist(r) : r))
    .sort(byRank);
}
