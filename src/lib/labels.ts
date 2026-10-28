import type { Sector, Stage } from "@/data/types";

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
