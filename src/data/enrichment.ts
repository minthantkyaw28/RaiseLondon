import { investorStages } from "@/lib/raise/stages";
import type { Investor as RaiseInvestor } from "@/lib/raise/types";

import {
  SECTOR_MAP,
  STAGE_ORDER,
  completeCheque,
  dealroomChequeGbp,
  plausibleCheque,
} from "./from-raise";
import type { Investor, Sector, Stage } from "./types";

/** One firm's web-researched facts (`src/data/enrichment.json`), keyed by Dealroom uuid. */
export interface Enrichment {
  uuid: string;
  name: string;
  office: {
    address: string;
    postcode: string;
    lat: number;
    lng: number;
    source: string;
  } | null;
  sectors: string[] | null;
  sectorsSource: string | null;
  stages: Stage[] | null;
  stagesSource: string | null;
  chequeGbp: { min: number | null; max: number | null } | null;
  chequeSource: string | null;
  confidence: "high" | "medium";
  notes: string | null;
}

/** The JSON as TypeScript reads it: stage and confidence values are plain strings. */
export type RawEnrichment = Omit<Enrichment, "stages" | "confidence"> & {
  stages: string[] | null;
  confidence: string;
};

const isStage = (s: string): s is Stage => (STAGE_ORDER as string[]).includes(s);

/** The enrichment file keyed by uuid. Throws on a stage or confidence value it doesn't know. */
export function loadEnrichment(raw: RawEnrichment[]): Map<string, Enrichment> {
  return new Map(
    raw.map((e) => {
      const stages = e.stages?.map((s) => {
        if (!isStage(s)) throw new Error(`enrichment.json: ${e.name} has unknown stage "${s}"`);
        return s;
      });
      const { confidence } = e;
      if (confidence !== "high" && confidence !== "medium") {
        throw new Error(`enrichment.json: ${e.name} has unknown confidence "${confidence}"`);
      }
      return [e.uuid, { ...e, stages: stages ?? null, confidence }];
    }),
  );
}

export const GENERALIST = "generalist";

const names = (entry: Enrichment) => (entry.sectors ?? []).map((s) => s.trim().toLowerCase());

/** The enrichment's sector names mapped onto our sectors through the adapter's table. */
function enrichedSectors(entry: Enrichment): Sector[] {
  return names(entry).flatMap((n) => {
    const sector = SECTOR_MAP[n];
    return sector ? [sector] : [];
  });
}

function enrichedCheque(entry: Enrichment): Investor["checkSizeGbp"] | null {
  if (!entry.chequeGbp) return null;
  const cheque = completeCheque(entry.chequeGbp.min, entry.chequeGbp.max);
  return cheque && plausibleCheque(cheque) ? cheque : null;
}

/** Our Investor before the default cheque: null means Dealroom stated no plausible ticket. */
export type DraftInvestor = Omit<Investor, "checkSizeGbp"> & {
  checkSizeGbp: Investor["checkSizeGbp"] | null;
};

/**
 * Fills what Dealroom lacks from the web enrichment:
 * - office: its pin and street address replace Dealroom's (often only the centre of London);
 * - sectors: added to Dealroom's; "generalist" adds none and flags the firm instead;
 * - stages: only when Dealroom maps to none;
 * - cheque: only when Dealroom's is missing or implausible (the draft's cheque is null).
 * Office, stages and cheque record their source URL in `sources`.
 */
export function applyEnrichment(investor: DraftInvestor, entry: Enrichment): DraftInvestor {
  const out: DraftInvestor = { ...investor };
  const sources: NonNullable<Investor["sources"]> = { ...investor.sources };
  if (entry.office) {
    out.lat = entry.office.lat;
    out.lng = entry.office.lng;
    out.address = entry.office.address;
    sources.office = entry.office.source;
  }
  out.sectors = [...new Set([...investor.sectors, ...enrichedSectors(entry)])];
  if (names(entry).includes(GENERALIST)) out.generalist = true;
  if (!investor.stages.length && entry.stages?.length && entry.stagesSource) {
    const stages = entry.stages;
    out.stages = STAGE_ORDER.filter((s) => stages.includes(s));
    sources.stages = entry.stagesSource;
  }
  const cheque = enrichedCheque(entry);
  if (!investor.checkSizeGbp && cheque && entry.chequeSource) {
    out.checkSizeGbp = cheque;
    sources.cheque = entry.chequeSource;
  }
  return Object.keys(sources).length ? { ...out, sources } : out;
}

/**
 * The tag Min's scorer gets for each of our sectors. His `sectorPoints` matches by substring, so
 * each tag is one of that sector's `DEALROOM_TERMS` and matches no other sector's terms ("ai"
 * would match "retail", so AI is "artificial intelligence"). A test checks both.
 */
export const SCORER_TAG: Record<Sector, string> = {
  ai: "artificial intelligence",
  fintech: "fintech",
  healthtech: "health",
  climate: "climate",
  devtools: "developer",
  consumer: "consumer",
  "b2b-saas": "saas",
  deeptech: "hardware",
};

/**
 * Min's Dealroom row as his scorer should see it: an implausible ticket is dropped, and the
 * enrichment fills sectors (as `SCORER_TAG`s), stages when he reads none, and the cheque when
 * Dealroom's is missing or implausible.
 */
export function enrichScoringRow(row: RaiseInvestor, entry: Enrichment | undefined): RaiseInvestor {
  const dealroom = dealroomChequeGbp(row);
  const stated = dealroom && plausibleCheque(dealroom);
  const out: RaiseInvestor = { ...row };
  if (dealroom && !stated) {
    out.chequeMin = null;
    out.chequeMax = null;
  }
  if (!entry) return out;
  const have = new Set(row.sectors.map((s) => s.toLowerCase()));
  const tags = [...new Set(enrichedSectors(entry).map((s) => SCORER_TAG[s]))];
  out.sectors = [...row.sectors, ...tags.filter((t) => !have.has(t))];
  if (!investorStages(row).length && entry.stages?.length) out.stages = [...entry.stages];
  const cheque = enrichedCheque(entry);
  if (!stated && cheque) {
    out.chequeMin = cheque.min;
    out.chequeMax = cheque.max;
    out.chequeCurrency = "GBP";
  }
  return out;
}
