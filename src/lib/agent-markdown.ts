import type { Dataset, Investor, InvestorType } from "@/data/types";
import { SECTOR_LABEL, STAGE_LABEL } from "@/lib/labels";
import { formatGbp } from "@/lib/match";
import { summarizeReviews } from "@/lib/ratings";

export const AGENT_CACHE_CONTROL = "public, max-age=300";

const TYPE_LABEL: Record<InvestorType, string> = {
  vc: "VC",
  cvc: "Corporate VC",
  "angel-network": "Angel network",
  angel: "Angel",
  accelerator: "Accelerator",
};

export interface ListQuery {
  stages: string[];
  sectors: string[];
  q: string;
}

const csv = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function parseListQuery(params: URLSearchParams): ListQuery {
  return {
    stages: csv(params.get("stage")),
    sectors: csv(params.get("sector")),
    q: (params.get("q") ?? "").trim(),
  };
}

export function filterInvestors(investors: Investor[], query: ListQuery): Investor[] {
  const needle = query.q.toLowerCase();
  return investors
    .filter((v) => !query.stages.length || v.stages.some((s) => query.stages.includes(s)))
    .filter((v) => !query.sectors.length || v.sectors.some((s) => query.sectors.includes(s)))
    .filter(
      (v) =>
        !needle ||
        [v.name, v.oneLiner, ...v.partners.map((p) => p.name)]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const dataNote = (dataset: Dataset) =>
  dataset.source === "mock"
    ? "Data is mock: fictional firms and people at real London locations, until the Dealroom import lands."
    : `Data is real: London investors from Dealroom, exported ${dataset.generatedAt}.`;

export function renderLlmsTxt(dataset: Dataset): string {
  const stages = Object.keys(STAGE_LABEL).join(", ");
  const sectors = Object.keys(SECTOR_LABEL).join(", ");
  return `# Raise

> A map and directory of London investors (VCs, corporate VCs, angels, angel networks and accelerators), with stage, sector, cheque size, partners, portfolio and founder ratings.

${dataNote(dataset)} London only. Read-only: there is no write API.

## When to use

- Finding London investors that fit a startup's stage and sector.
- Looking up one investor's cheque range, fund size, partners, portfolio and founder ratings.

## How to call it

- \`GET /index.md\`: every investor as a markdown list. Optional query params, applied to the list:
  - \`stage\`: comma-separated, any of ${stages}
  - \`sector\`: comma-separated, any of ${sectors}
  - \`q\`: text search over name, one-liner and partner names
  - Example: \`/index.md?stage=seed,series-a&sector=ai&q=climate\`
- \`GET /investor/<slug>.md\`: one investor's profile in markdown. Slugs come from \`/index.md\`. Unknown slugs return 404.

## Pages

- [Investor directory](/index.md): ${dataset.investors.length} investors
- [Map](/): the interactive map for people
`;
}

export function renderInvestorList(dataset: Dataset, query: ListQuery): string {
  const investors = filterInvestors(dataset.investors, query);
  const filters = [
    query.stages.length ? `stage=${query.stages.join(",")}` : "",
    query.sectors.length ? `sector=${query.sectors.join(",")}` : "",
    query.q ? `q=${query.q}` : "",
  ].filter(Boolean);
  const lines = [
    "# Raise: London investors",
    "",
    dataNote(dataset),
    "",
    filters.length
      ? `${investors.length} of ${dataset.investors.length} investors match ${filters.join(" ")}.`
      : `${investors.length} investors.`,
    "",
    ...investors.map((v) => `- [${v.name}](/investor/${v.slug}.md): ${v.oneLiner}`),
    "",
    "## Query params",
    "",
    `- \`stage\`: comma-separated, any of ${Object.keys(STAGE_LABEL).join(", ")}`,
    `- \`sector\`: comma-separated, any of ${Object.keys(SECTOR_LABEL).join(", ")}`,
    "- `q`: text search over name, one-liner and partner names",
    "",
  ];
  return lines.join("\n");
}

export function renderInvestorPage(dataset: Dataset, slug: string): string | null {
  const v = dataset.investors.find((i) => i.slug === slug);
  if (!v) return null;
  const summary = summarizeReviews(dataset.reviews.filter((r) => r.investorId === v.id));
  const lines = [
    `# ${v.name}`,
    "",
    v.oneLiner,
    "",
    `- Type: ${TYPE_LABEL[v.type]}`,
    `- Website: ${v.website}`,
    `- Address: ${v.address}`,
    `- Stages: ${v.stages.map((s) => STAGE_LABEL[s]).join(", ")}`,
    `- Sectors: ${v.sectors.map((s) => SECTOR_LABEL[s]).join(", ")}`,
    `- Cheque size: ${formatGbp(v.checkSizeGbp.min)}–${formatGbp(v.checkSizeGbp.max)}`,
    `- Fund size: ${v.fundSizeGbpM ? `£${v.fundSizeGbpM}m` : "Not disclosed"}`,
    `- Deals in the last 12 months: ${v.dealsLast12m}`,
    "",
    "## Partners",
    "",
    ...(v.partners.length ? v.partners.map((p) => `- ${p.name}, ${p.title}`) : ["None listed."]),
    "",
    "## Portfolio",
    "",
    ...(v.portfolio.length ? v.portfolio.map((c) => `- ${c}`) : ["None listed."]),
    "",
    "## Founder reviews",
    "",
    `- Reviews: ${summary.count} (${summary.verifiedCount} verified)`,
    `- Overall score: ${summary.overall === null ? "No reviews yet" : `${summary.overall} / 5`}`,
    "",
    "Verified reviews come from founders in this investor's portfolio and count fully; unverified reviews count a quarter.",
    "",
    "---",
    "",
    `${dataNote(dataset)} [All investors](/index.md)`,
    "",
  ];
  return lines.join("\n");
}

export function renderInvestorNotFound(slug: string): string {
  return `# Investor not found

No investor has the slug \`${slug.replace(/`/g, "")}\`. See [all investors](/index.md).
`;
}
