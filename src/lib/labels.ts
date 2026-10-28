import type {
  DebriefReason,
  InvestorType,
  MeetingOutcome,
  PickyTopic,
  Sector,
  Stage,
} from "@/data/types";

export const TYPE_LABEL: Record<InvestorType, string> = {
  vc: "VC fund",
  cvc: "Corporate VC",
  "angel-network": "Angel network",
  angel: "Angel",
  accelerator: "Accelerator",
};

export const STAGE_LABEL: Record<Stage, string> = {
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  growth: "Growth",
};

export const SECTOR_LABEL: Record<Sector, string> = {
  ai: "AI",
  fintech: "Fintech",
  healthtech: "Healthtech",
  climate: "Climate",
  devtools: "Dev tools",
  consumer: "Consumer",
  "b2b-saas": "B2B SaaS",
  deeptech: "Deep tech",
};

export const OUTCOME_LABEL: Record<MeetingOutcome, string> = {
  passed: "Passed",
  "follow-up": "Follow-up",
  "term-sheet": "Term sheet",
  ghosted: "Ghosted",
};

export const REASON_LABEL: Record<DebriefReason, string> = {
  "too-early": "Too early",
  "market-size": "Market size",
  team: "Team",
  traction: "Traction",
  valuation: "Valuation",
  "not-our-thesis": "Not our thesis",
  competition: "Competition",
  timing: "Timing",
  "no-reason-given": "No reason given",
};

export const PICKY_LABEL: Record<PickyTopic, string> = {
  metrics: "Metrics",
  "team-background": "Team background",
  "market-sizing": "Market sizing",
  "tech-depth": "Tech depth",
  "go-to-market": "Go-to-market",
  "cap-table": "Cap table",
  "unit-economics": "Unit economics",
};
