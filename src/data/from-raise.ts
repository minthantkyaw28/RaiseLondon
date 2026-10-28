import type {
  Dataset as RaiseDataset,
  Deal as RaiseDeal,
  Investor as RaiseInvestor,
  Person as RaisePerson,
} from "@/lib/raise/types";

import { applyEnrichment, type DraftInvestor, type Enrichment } from "./enrichment";
import type { Dataset, Investor, InvestorType, Partner, Sector, Stage } from "./types";

// Dealroom investor_type → ours. An "angel" is one person; an "angel_fund" pools several.
export const TYPE_MAP: Record<string, InvestorType> = {
  venture_capital: "vc",
  angel: "angel",
  angel_fund: "angel-network",
};

// Dealroom round labels (upper-cased: the export mixes "Seed" and "SEED") → our stages.
export const STAGE_MAP: Record<string, Stage> = {
  ANGEL: "pre-seed",
  "PRE-SEED": "pre-seed",
  SEED: "seed",
  "EARLY VC": "series-a",
  "SERIES A": "series-a",
  "SERIES B": "series-b",
  "SERIES C": "growth",
  "SERIES D": "growth",
  "SERIES E": "growth",
  "SERIES F+": "growth",
  GROWTH: "growth",
  "GROWTH EQUITY": "growth",
  "GROWTH EQUITY VC": "growth",
  "LATE VC": "growth",
};

// Dealroom sector, industry and technology tags, and the web enrichment's sector names, → our
// sectors. Tags that describe the investor itself (Investing, Techstars 501 Investors, B Corp,
// Equity Research…) are left out on purpose, and so is the enrichment's "generalist" (a flag, not
// a sector: see applyEnrichment).
export const SECTOR_MAP: Record<string, Sector> = {
  ai: "ai",
  "enterprise ai": "ai",
  "ai infrastructure": "ai",
  "foundation models": "ai",
  "generative ai": "ai",
  "ai safety": "ai",
  "ai computing infrastructure": "ai",
  "climate fintech": "fintech",
  insurance: "fintech",
  "financial service": "fintech",
  bitcoin: "fintech",
  fintech: "fintech",
  insurtech: "fintech",
  payments: "fintech",
  lending: "fintech",
  crypto: "fintech",
  defi: "fintech",
  "blockchain infrastructure": "fintech",
  risktech: "fintech",
  "life sciences": "healthtech",
  "life science": "healthtech",
  biotechnology: "healthtech",
  pharmaceutical: "healthtech",
  "medical / healthcare": "healthtech",
  "medical & healthcare": "healthtech",
  "medical technology": "healthtech",
  "health care": "healthtech",
  healthcare: "healthtech",
  health: "healthtech",
  "health services industry": "healthtech",
  "digital health and medical technologies": "healthtech",
  healthtech: "healthtech",
  medtech: "healthtech",
  "digital health": "healthtech",
  "health and wellness": "healthtech",
  therapeutics: "healthtech",
  "advanced therapies": "healthtech",
  biotech: "healthtech",
  bio: "healthtech",
  biology: "healthtech",
  "synthetic biology": "healthtech",
  biopharma: "healthtech",
  pharma: "healthtech",
  longevity: "healthtech",
  agritech: "climate",
  climate: "climate",
  energy: "climate",
  "renewable energy": "climate",
  "energy storage": "climate",
  cleantech: "climate",
  sustainability: "climate",
  "environmental tech": "climate",
  "circular economy": "climate",
  "carbon mitigation": "climate",
  "carbon removal": "climate",
  "industrial decarbonisation": "climate",
  "food and water": "climate",
  "oceans and water": "climate",
  "forestry and land": "climate",
  "developer tools": "devtools",
  "data infrastructure": "devtools",
  "cloud infrastructure": "devtools",
  "software infrastructure": "devtools",
  paas: "devtools",
  "cloud services": "devtools",
  "social media": "consumer",
  social: "consumer",
  messaging: "consumer",
  "wellness / beauty": "consumer",
  wellness: "consumer",
  "consumer electronics": "consumer",
  "consumer goods": "consumer",
  "consumer internet": "consumer",
  apparel: "consumer",
  wearable: "consumer",
  music: "consumer",
  video: "consumer",
  entertainment: "consumer",
  "media production": "consumer",
  "on-demand": "consumer",
  retail: "consumer",
  travel: "consumer",
  accommodation: "consumer",
  classifieds: "consumer",
  "sharing economy": "consumer",
  mutiplayer: "consumer",
  consumer: "consumer",
  gaming: "consumer",
  media: "consumer",
  "media tech": "consumer",
  "creator economy": "consumer",
  commerce: "consumer",
  "e-commerce": "consumer",
  ecommerce: "consumer",
  d2c: "consumer",
  "retail tech": "consumer",
  "wellness and beauty": "consumer",
  "food and drink": "consumer",
  lifestyle: "consumer",
  hospitality: "consumer",
  "sports tech": "consumer",
  saas: "b2b-saas",
  analytics: "b2b-saas",
  "data analytics": "b2b-saas",
  "business intelligence": "b2b-saas",
  crm: "b2b-saas",
  "content management": "b2b-saas",
  "mobile enterprise": "b2b-saas",
  "lead generation": "b2b-saas",
  adtech: "b2b-saas",
  targeting: "b2b-saas",
  security: "b2b-saas",
  "b2b saas": "b2b-saas",
  software: "b2b-saas",
  "enterprise software": "b2b-saas",
  "sme tech": "b2b-saas",
  "business services": "b2b-saas",
  "future of work": "b2b-saas",
  "hr tech": "b2b-saas",
  productivity: "b2b-saas",
  automation: "b2b-saas",
  legaltech: "b2b-saas",
  martech: "b2b-saas",
  cybersecurity: "b2b-saas",
  data: "b2b-saas",
  aerospace: "deeptech",
  "space tech": "deeptech",
  scientific: "deeptech",
  "deep tech": "deeptech",
  science: "deeptech",
  space: "deeptech",
  hardware: "deeptech",
  robotics: "deeptech",
  semiconductors: "deeptech",
  quantum: "deeptech",
  materials: "deeptech",
  "critical materials": "deeptech",
  compute: "deeptech",
  computation: "deeptech",
  "compute and infrastructure": "deeptech",
  "industrial tech": "deeptech",
  defence: "deeptech",
};

// Fixed rates, good enough to compare cheque sizes. Every cheque in the 2026-10-28 export is GBP.
export const GBP_PER: Record<string, number> = { GBP: 1, USD: 0.79, EUR: 0.85 };

// debt: a firm with no stated ticket gets a typical range for its type, so the matcher can still
// place it. ceiling: these ranges are guesses, not the firm's own numbers. upgrade: when
// investor_overrides or Dealroom fill in cheque_min/cheque_max for most of the cohort.
export const DEFAULT_CHEQUE_GBP: Record<InvestorType, { min: number; max: number }> = {
  vc: { min: 250_000, max: 2_000_000 },
  cvc: { min: 500_000, max: 5_000_000 },
  "angel-network": { min: 25_000, max: 250_000 },
  angel: { min: 10_000, max: 100_000 },
  accelerator: { min: 50_000, max: 250_000 },
};

export const STAGE_ORDER: Stage[] = ["pre-seed", "seed", "series-a", "series-b", "growth"];

const LONDON = { lat: 51.5074, lng: -0.1278 };
const GREATER_LONDON = { south: 51.28, north: 51.7, west: -0.52, east: 0.34 };
// Within ~350 m of the centre means Dealroom only knew the city, not the street.
const CITY_LEVEL_DEG = 0.003;
const SPREAD_STEP_DEG = 0.0009;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface FromRaiseReport {
  dataset: Dataset;
  skipped: { noCoordinates: number; outsideLondon: number; unknownType: number };
  /** Investors whose pins were spread round the centre because Dealroom only had "London". */
  cityLevelPins: number;
  droppedStages: Record<string, number>;
  droppedSectors: Record<string, number>;
  /** Dealroom tickets thrown away as data errors (see `plausibleCheque`). */
  discardedCheques: number;
  /** Firms that took each field from the web enrichment; generalists are flagged, not tagged. */
  enriched: { pins: number; sectors: number; stages: number; cheques: number; generalists: number };
}

const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slugs from names; every firm sharing a name gets a uuid suffix, so no slug depends on order. */
function slugsFor(investors: RaiseInvestor[]): Map<string, string> {
  const base = new Map(investors.map((i) => [i.uuid, slugify(i.name) || i.uuid.slice(0, 8)]));
  const seen = new Map<string, number>();
  for (const slug of base.values()) seen.set(slug, (seen.get(slug) ?? 0) + 1);
  return new Map(
    [...base].map(([uuid, slug]) => [
      uuid,
      (seen.get(slug) ?? 0) > 1 ? `${slug}-${uuid.slice(0, 8)}` : slug,
    ]),
  );
}

function mapStages(raw: string[], dropped: Record<string, number>): Stage[] {
  const out = new Set<Stage>();
  for (const label of raw) {
    const stage = STAGE_MAP[label.trim().toUpperCase()];
    if (stage) out.add(stage);
    else bump(dropped, label);
  }
  return STAGE_ORDER.filter((s) => out.has(s));
}

function mapSectors(raw: string[], dropped: Record<string, number>): Sector[] {
  const out = new Set<Sector>();
  for (const label of raw) {
    const sector = SECTOR_MAP[label.trim().toLowerCase()];
    if (sector) out.add(sector);
    else bump(dropped, label);
  }
  return [...out];
}

function toGbp(amount: number | null, currency: string): number | null {
  const rate = GBP_PER[currency.toUpperCase()];
  if (amount == null || rate === undefined) return null;
  return Math.round(amount * rate);
}

type Cheque = Investor["checkSizeGbp"];

// A ticket outside this range is a Dealroom data error (RTP Global and Blossom at £8.3bn, Crane at
// £4, Hedosophia at £38), not a ticket.
export const PLAUSIBLE_CHEQUE_GBP = { min: 1_000, max: 500_000_000 };

/** A missing floor is a tenth of the ceiling; a missing ceiling is ten times the floor. */
export function completeCheque(min: number | null, max: number | null): Cheque | null {
  if (min !== null && max !== null) return { min, max };
  if (max !== null) return { min: Math.round(max / 10), max };
  if (min !== null) return { min, max: min * 10 };
  return null;
}

export const plausibleCheque = (c: Cheque): boolean =>
  c.min <= c.max && c.max >= PLAUSIBLE_CHEQUE_GBP.min && c.max <= PLAUSIBLE_CHEQUE_GBP.max;

/**
 * Dealroom's ticket in GBP, or null when it states none. Dealroom stores an unknown floor as 0 or
 * 1, so a floor under £1k is treated as missing. Not checked for plausibility.
 */
export function dealroomChequeGbp(v: RaiseInvestor): Cheque | null {
  const rawMin = toGbp(v.chequeMin, v.chequeCurrency);
  const rawMax = toGbp(v.chequeMax, v.chequeCurrency);
  const min = rawMin !== null && rawMin >= 1000 ? rawMin : null;
  const max = rawMax !== null && rawMax > 0 ? rawMax : null;
  return completeCheque(min, max);
}

/** Dealroom's ticket in GBP when it states one that is plausible, else null. */
export function statedChequeGbp(v: RaiseInvestor): Cheque | null {
  const cheque = dealroomChequeGbp(v);
  return cheque && plausibleCheque(cheque) ? cheque : null;
}

const monthIndex = (year: number, month: number) => year * 12 + (month - 1);

/** Rounds in the 12 calendar months up to and including the month the export was generated. */
function recentRoundCount(deals: RaiseDeal[], generatedAt: string): number {
  const at = new Date(generatedAt);
  if (Number.isNaN(at.getTime())) return 0;
  const end = monthIndex(at.getUTCFullYear(), at.getUTCMonth() + 1);
  const rounds = new Set<string>();
  for (const d of deals) {
    if (d.roundYear == null || d.roundMonth == null) continue;
    const i = monthIndex(d.roundYear, d.roundMonth);
    if (i <= end && i > end - 12) rounds.add(d.transactionId);
  }
  return rounds.size;
}

const PORTFOLIO_MAX = 12;

function portfolioFrom(deals: RaiseDeal[]): string[] {
  const newestFirst = [...deals].sort(
    (a, b) =>
      monthIndex(b.roundYear ?? 0, b.roundMonth ?? 1) -
      monthIndex(a.roundYear ?? 0, a.roundMonth ?? 1),
  );
  const names = new Set<string>();
  for (const d of newestFirst) {
    if (d.companyName && d.companyName !== "Undisclosed company") names.add(d.companyName);
  }
  return [...names].slice(0, PORTFOLIO_MAX);
}

function partnerFrom(p: RaisePerson): Partner {
  return {
    id: p.id,
    name: p.name,
    title: p.role ?? "Team member",
    ...(p.linkedin ? { linkedinUrl: p.linkedin } : {}),
    focus: [],
  };
}

const TYPE_NOUN: Record<InvestorType, string> = {
  vc: "Venture capital firm",
  cvc: "Corporate venture capital firm",
  "angel-network": "Angel fund",
  angel: "Angel investor",
  accelerator: "Accelerator",
};

function firstSentence(text: string): string {
  const match = /^.*?[.!?](\s|$)/s.exec(text);
  return (match ? match[0] : text).trim();
}

function oneLinerFor(v: RaiseInvestor, type: InvestorType): string {
  if (v.tagline) return v.tagline;
  if (v.about) return firstSentence(v.about);
  const rounds = v.londonRoundsSince2024;
  return `${TYPE_NOUN[type]} in London, ${rounds} London ${rounds === 1 ? "round" : "rounds"} since 2024.`;
}

const insideLondon = (lat: number, lng: number) =>
  lat >= GREATER_LONDON.south &&
  lat <= GREATER_LONDON.north &&
  lng >= GREATER_LONDON.west &&
  lng <= GREATER_LONDON.east;

const cityLevel = (lat: number, lng: number) =>
  !insideLondon(lat, lng) ||
  (Math.abs(lat - LONDON.lat) <= CITY_LEVEL_DEG && Math.abs(lng - LONDON.lng) <= CITY_LEVEL_DEG);

/**
 * Point i of a sunflower spiral round the centre of London.
 * debt: firms Dealroom only geocoded to "London" (and London-HQ angels with a broken lat of 1)
 * are fanned out round the centre so every pin can be clicked. ceiling: the pin is not their
 * office; the profile says just "London". upgrade: when the export carries street addresses.
 */
function spreadPoint(i: number): { lat: number; lng: number } {
  const r = SPREAD_STEP_DEG * Math.sqrt(i + 1);
  const theta = i * GOLDEN_ANGLE;
  return {
    lat: LONDON.lat + r * Math.sin(theta),
    lng: LONDON.lng + (r * Math.cos(theta)) / Math.cos((LONDON.lat * Math.PI) / 180),
  };
}

function lastRoundOf(deals: RaiseDeal[]): { lastRound?: string } {
  const dated = deals.filter((d) => d.roundYear != null);
  if (!dated.length) return {};
  const latest = dated.reduce((a, b) =>
    monthIndex(b.roundYear!, b.roundMonth ?? 1) > monthIndex(a.roundYear!, a.roundMonth ?? 1) ? b : a,
  );
  return { lastRound: `${latest.roundYear}-${String(latest.roundMonth ?? 1).padStart(2, "0")}` };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) out.set(key(item), [...(out.get(key(item)) ?? []), item]);
  return out;
}

/**
 * Min's Dealroom export → the Dataset the home page map, list, profiles and matcher read.
 * `enrichment` (web research keyed by Dealroom uuid) fills offices, sectors, stages and cheques
 * Dealroom lacks; see `applyEnrichment`.
 */
export function fromRaise(
  raw: RaiseDataset,
  enrichment: ReadonlyMap<string, Enrichment> = new Map(),
): FromRaiseReport {
  const skipped = { noCoordinates: 0, outsideLondon: 0, unknownType: 0 };
  const droppedStages: Record<string, number> = {};
  const droppedSectors: Record<string, number> = {};
  const enriched = { pins: 0, sectors: 0, stages: 0, cheques: 0, generalists: 0 };
  let discardedCheques = 0;
  const dealsBy = groupBy(raw.deals, (d) => d.investorUuid);
  const peopleBy = groupBy(raw.people, (p) => p.investorUuid);
  const slugs = slugsFor(raw.investors);

  const kept: { v: RaiseInvestor; type: InvestorType; lat: number; lng: number }[] = [];
  for (const v of raw.investors) {
    const type = TYPE_MAP[v.investorType];
    if (!type) skipped.unknownType++;
    else if (v.lat == null || v.lon == null) skipped.noCoordinates++;
    else if (v.hqCity !== "London") skipped.outsideLondon++;
    else kept.push({ v, type, lat: v.lat, lng: v.lon });
  }

  // Firms with a researched office get that pin, so only the rest are fanned out.
  const centred = kept
    .filter((k) => !enrichment.get(k.v.uuid)?.office && cityLevel(k.lat, k.lng))
    .sort((a, b) => a.v.uuid.localeCompare(b.v.uuid));
  centred.forEach((k, i) => Object.assign(k, spreadPoint(i)));

  const approximate = new Set(centred.map((k) => k.v.uuid));
  const investors: Investor[] = kept.map(({ v, type, lat, lng }) => {
    const deals = dealsBy.get(v.uuid) ?? [];
    const stated = statedChequeGbp(v);
    if (!stated && dealroomChequeGbp(v)) discardedCheques++;
    const draft: DraftInvestor = {
      id: v.uuid,
      slug: slugs.get(v.uuid) ?? v.uuid,
      name: v.name,
      type,
      oneLiner: oneLinerFor(v, type),
      website: v.website ?? v.linkedin ?? v.dealroomUrl ?? "",
      address: "London",
      lat,
      lng,
      stages: mapStages(v.stages, droppedStages),
      sectors: mapSectors(v.sectors, droppedSectors),
      checkSizeGbp: stated,
      dealsLast12m: recentRoundCount(deals, raw.generatedAt),
      portfolio: portfolioFrom(deals),
      partners: (peopleBy.get(v.uuid) ?? []).map(partnerFrom),
    };
    const entry = enrichment.get(v.uuid);
    const filled = entry ? applyEnrichment(draft, entry) : draft;
    if (filled.sources?.office) enriched.pins++;
    if (filled.sources?.stages) enriched.stages++;
    if (filled.sources?.cheque) enriched.cheques++;
    if (filled.sectors.length > draft.sectors.length) enriched.sectors++;
    if (filled.generalist) enriched.generalists++;
    return {
      ...filled,
      checkSizeGbp: filled.checkSizeGbp ?? DEFAULT_CHEQUE_GBP[type],
      chequeEstimated: filled.checkSizeGbp == null,
      approximateLocation: approximate.has(v.uuid),
      leadsRounds: deals.some((d) => d.isLead === true),
      ...lastRoundOf(deals),
      ...(v.dealroomUrl ? { sourceUrl: v.dealroomUrl } : {}),
    };
  });

  return {
    dataset: {
      generatedAt: raw.generatedAt.slice(0, 10),
      source: "dealroom",
      investors,
      // Never attach mock reviews or debriefs to real firms: that would invent their ratings.
      reviews: [],
      debriefs: [],
    },
    skipped,
    cityLevelPins: centred.length,
    droppedStages,
    droppedSectors,
    discardedCheques,
    enriched,
  };
}
