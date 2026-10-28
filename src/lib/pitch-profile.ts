import type { Sector, Stage } from "@/data/types";

export type CompanyStatus = "idea" | "building" | "has-users" | "revenue";

export interface PitchProfile {
  sectors: Sector[];
  stage: Stage | null;
  companyStatus: CompanyStatus | null;
  raiseGbp: number | null;
  founders: "solo" | "co-founders" | null;
  technicalFounder: boolean | null;
}

const SECTOR_RULES: [Sector, RegExp][] = [
  ["ai", /\b(ai|llms?|machine learning|ml|agents?|artificial intelligence|gpt|genai)\b/],
  ["fintech", /\b(fintech|payments?|banking|bank|lending|loans?|neobank|insurtech|credit)\b/],
  ["healthtech", /\b(healthtech|health ?care|health|medical|clinic(al|s)?|patients?|nhs)\b/],
  ["climate", /\b(climate|carbon|net zero|renewables?|solar|energy|emissions|sustainab\w*)\b/],
  ["devtools", /\b(devtools|developer tools?|developers?|sdks?|apis?|open source|ci\/cd)\b/],
  ["consumer", /\b(consumer|d2c|dtc|social app|shoppers|e-?commerce|creators?|gen z)\b/],
  ["b2b-saas", /\b(saas|b2b|enterprise|smbs?|smes?|workflow software)\b/],
  [
    "deeptech",
    /\b(deep ?tech|quantum|robotics?|semiconductors?|hardware|photonics|space ?tech|satellites?)\b/,
  ],
];

const STAGE_RULES: [Stage, RegExp][] = [
  ["pre-seed", /\bpre[- ]?seed\b/],
  ["series-a", /\bseries a\b/],
  ["series-b", /\bseries b\b/],
  ["growth", /\b(series [c-f]|growth (stage|round))\b/],
  ["seed", /\bseed\b/],
];

const MONEY =
  /(£)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k|m|mn|million|thousand)?\b(?!\s?(users|customers|downloads|sign-?ups|people|members|arr|mrr|revenue|months|years))/g;
const RAISE_CUE = /\b(rais\w*|round|seeking|looking for|investment|cheque|check|fundrais\w*)\b/;

function amount(digits: string, unit: string | undefined): number {
  const n = Number(digits.replace(/,/g, ""));
  if (unit === "k" || unit === "thousand") return n * 1_000;
  if (unit === "m" || unit === "mn" || unit === "million") return n * 1_000_000;
  return n;
}

// Only bare numbers with a £ or a k/m unit count as money, so "two co-founders, 3 years" is ignored.
// A figure near "raising" beats one that is just mentioned (often revenue or a past round).
export function parseRaise(text: string): number | null {
  const candidates: { value: number; cued: boolean }[] = [];
  for (const m of text.matchAll(MONEY)) {
    const [, pound, digits, unit] = m;
    if (!digits || (!pound && !unit)) continue;
    const value = amount(digits, unit);
    if (value < 10_000) continue;
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
    candidates.push({ value, cued: RAISE_CUE.test(before) });
  }
  return (candidates.find((c) => c.cued) ?? candidates[0])?.value ?? null;
}

function detectStatus(text: string): CompanyStatus | null {
  const withoutPreRevenue = text.replace(/\b(pre-?revenue|no revenue|not yet revenue)\b/g, "");
  if (/\b(revenue|arr|mrr|paying|paid customers)\b/.test(withoutPreRevenue)) return "revenue";
  if (/\b(users|waitlist|wait list|customers|pilots?|beta testers|signups|sign-ups)\b/.test(text))
    return "has-users";
  if (/\b(building|built|mvp|prototype|beta|launched|launching)\b/.test(text)) return "building";
  if (/\b(idea|concept|pre-?product|exploring)\b/.test(text)) return "idea";
  return null;
}

function detectFounders(text: string): PitchProfile["founders"] {
  if (/\b(solo founder|sole founder|building (this |it )?alone|on my own|just me)\b/.test(text))
    return "solo";
  if (
    /\b(co-?founders?|co founders?|we are (two|three)|we're (two|three)|(two|three) founders|founding team)\b/.test(
      text,
    )
  )
    return "co-founders";
  return null;
}

function detectTechnical(text: string): boolean | null {
  if (/\b(non-?technical|need a cto|looking for a cto|can't code|cannot code)\b/.test(text))
    return false;
  if (
    /\b(technical (co-?)?founders?|i'm an engineer|i am an engineer|cto|i write the code|phd)\b/.test(
      text,
    )
  )
    return true;
  return null;
}

export function inferStage(status: CompanyStatus | null, raise: number | null): Stage | null {
  if (status === "idea" || (raise !== null && raise < 250_000)) return "pre-seed";
  if (status === "has-users" && (raise === null || raise < 2_000_000)) return "seed";
  if (status === "revenue" && raise !== null && raise >= 2_000_000) return "series-a";
  if (status === "revenue") return "seed";
  if (status === "building") return "pre-seed";
  return null;
}

export function extractProfile(text: string): PitchProfile {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  const sectors = SECTOR_RULES.filter(([, re]) => re.test(t)).map(([s]) => s);
  const companyStatus = detectStatus(t);
  const raiseGbp = parseRaise(t);
  const said = STAGE_RULES.find(([, re]) => re.test(t))?.[0] ?? null;
  return {
    sectors,
    stage: said ?? inferStage(companyStatus, raiseGbp),
    companyStatus,
    raiseGbp,
    founders: detectFounders(t),
    technicalFounder: detectTechnical(t),
  };
}
