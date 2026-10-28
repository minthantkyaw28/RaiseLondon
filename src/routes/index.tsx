import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Presentation, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvestorDetail } from "@/components/vc-map/InvestorDetail";
import { PIPELINE, type PipelineStatus } from "@/components/vc-map/pipeline";
import { MAP_VIEWS, type MapViewId } from "@/components/vc-map/map-styles";
import { PitchMatcher } from "@/components/vc-map/PitchMatcher";
import { ScoreBadge } from "@/components/vc-map/ScoreBadge";
import { VcMap } from "@/components/vc-map/VcMap";
import { loadDataset } from "@/data/source";
import type { Investor, Sector, Stage } from "@/data/types";
import { summarizeReviews } from "@/lib/ratings";
import { SECTOR_LABEL, STAGE_LABEL, TYPE_LABEL } from "@/lib/labels";
import { formatGbp, type Match } from "@/lib/match";
import { CHEQUE_BUCKETS, chequeFits, parseGbpAmount, type ChequeBucketId } from "@/lib/cheque";
import { roundProgress } from "@/lib/round";
import { cn } from "@/lib/utils";

const TITLE = "Raise";
const DESCRIPTION = "Every London investor on a map, matched to your pitch.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => loadDataset(),
  component: Index,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-muted-foreground">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">No investors found.</div>,
});

const CHEQUE_LABEL = Object.fromEntries(CHEQUE_BUCKETS.map((b) => [b.id, b.label])) as Record<
  ChequeBucketId,
  string
>;

const STAGES: Stage[] = ["pre-seed", "seed", "series-a", "series-b", "growth"];
const SECTORS: Sector[] = [
  "ai",
  "fintech",
  "healthtech",
  "climate",
  "devtools",
  "consumer",
  "b2b-saas",
  "deeptech",
];
const PIPELINE_KEY = "lvm-pipeline";
const VIEW_KEY = "lvm-map-view";

// Individual angels are private people with no published office; a pin would imply where they are.
const onMap = (v: Investor) => v.type !== "angel";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function usePipeline() {
  const [pipeline, setPipeline] = useState<Record<string, PipelineStatus>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PIPELINE_KEY);
      if (raw) setPipeline(JSON.parse(raw));
    } catch {
      // Storage can be blocked (private mode); the pipeline just won't persist.
    }
  }, []);
  const set = (id: string, status: PipelineStatus) => {
    setPipeline((prev) => {
      const next = { ...prev, [id]: status };
      try {
        window.localStorage.setItem(PIPELINE_KEY, JSON.stringify(next));
      } catch {
        // See above.
      }
      return next;
    });
  };
  return [pipeline, set] as const;
}

function useMapView() {
  const [viewId, setViewId] = useState<MapViewId>("pixel");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_KEY);
      if (MAP_VIEWS.some((v) => v.id === stored)) setViewId(stored as MapViewId);
    } catch {
      // Storage can be blocked; fall back to the default view.
    }
  }, []);
  const choose = (id: MapViewId) => {
    setViewId(id);
    try {
      window.localStorage.setItem(VIEW_KEY, id);
    } catch {
      // See above.
    }
  };
  const view = MAP_VIEWS.find((v) => v.id === viewId) ?? MAP_VIEWS[0]!;
  return [view, choose] as const;
}

function Index() {
  const dataset = Route.useLoaderData();
  const { investors, reviews } = dataset;
  const [q, setQ] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [cheque, setCheque] = useState<ChequeBucketId>("any");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [roundTarget, setRoundTarget] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pitchMatches, setPitchMatches] = useState<Match[] | null>(null);
  const [pipeline, setStatus] = usePipeline();
  const [view, setView] = useMapView();

  const reviewsById = useMemo(() => {
    const m = new Map<string, typeof reviews>();
    for (const r of reviews) m.set(r.investorId, [...(m.get(r.investorId) ?? []), r]);
    return m;
  }, [reviews]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return investors
      .filter((v) => !stages.length || v.stages.some((s) => stages.includes(s)))
      .filter((v) => !sectors.length || v.sectors.some((s) => sectors.includes(s)))
      .filter((v) => chequeFits(v.checkSizeGbp, cheque))
      .filter((v) => !signals.includes("active") || v.dealsLast12m > 0)
      .filter((v) => !signals.includes("leads") || v.leadsRounds === true)
      .filter(
        (v) =>
          !needle ||
          [v.name, v.oneLiner, v.address, ...v.partners.map((p) => p.name), ...v.portfolio]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [investors, q, stages, sectors, cheque, signals]);

  const selected = investors.find((v) => v.id === selectedId) ?? null;
  const filterCount = stages.length + sectors.length + signals.length + (cheque === "any" ? 0 : 1);
  const round = roundProgress(pipeline, investors);
  const target = parseGbpAmount(roundTarget);
  const clearFilters = () => {
    setStages([]);
    setSectors([]);
    setCheque("any");
    setSignals([]);
    setQ("");
  };
  const ranks = useMemo(
    () => (pitchMatches ? new Map(pitchMatches.map((m, i) => [m.investor.id, i + 1])) : undefined),
    [pitchMatches],
  );
  // Refit the map when the founder changes what is shown, not when they hover or select.
  const fitKey = pitchMatches
    ? `match:${pitchMatches.map((m) => m.investor.id).join(",")}`
    : `filter:${stages.join(",")}|${sectors.join(",")}|${cheque}|${signals.join(",")}|${q.trim().toLowerCase()}`;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h1 className="font-pixel text-lg leading-none">Raise</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length === investors.length
              ? `${investors.length} London investors`
              : `Showing ${filtered.length} of ${investors.length} London investors`}
            {dataset.source === "dealroom"
              ? ` · Dealroom data, ${formatDataDate(dataset.generatedAt)}`
              : ""}
            {filterCount > 0 || q.trim() ? (
              <>
                {" · "}
                <button onClick={clearFilters} className="underline underline-offset-2">
                  Clear filters
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataset.source === "mock" && <Badge variant="outline">Mock data</Badge>}
          <Button size="sm" variant="outline" asChild>
            <a href="/deck">
              <Presentation className="h-4 w-4" /> Pitch deck
            </a>
          </Button>
          <PitchMatcher
            investors={investors}
            onSelect={setSelectedId}
            onResults={setPitchMatches}
          />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex min-h-0 flex-1 flex-col border-t md:order-1 md:w-[380px] md:flex-none md:border-r md:border-t-0">
          {pitchMatches ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b p-4">
                <div>
                  <p className="text-sm font-semibold">Matched to your pitch</p>
                  <p className="text-xs text-muted-foreground">
                    Top {pitchMatches.length} of {investors.length} investors
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPitchMatches(null)}>
                  <X className="h-4 w-4" /> Clear
                </Button>
              </div>
              <ol className="min-h-0 flex-1 overflow-y-auto">
                {pitchMatches.map((m) => (
                  <li key={m.investor.id}>
                    <button
                      onClick={() => setSelectedId(m.investor.id)}
                      className={cn(
                        "w-full border-b px-4 py-3 text-left hover:bg-accent",
                        selectedId === m.investor.id && "bg-accent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{m.investor.name}</span>
                        <ScoreBadge score={m.score} />
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {m.reasons.join(" · ") || m.misses[0]}
                      </p>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <div className="space-y-4 border-b p-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Firm, partner, portfolio company…"
                    className="pl-8"
                  />
                </div>
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  aria-expanded={filtersOpen}
                  className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium md:hidden"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" /> Filters
                    {filterCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {filterCount}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")}
                  />
                </button>
                <div className={cn("space-y-4", !filtersOpen && "hidden md:block")}>
                  <FilterGroup label="Quick lists">
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_LISTS.map((list) => (
                        <button
                          key={list.label}
                          onClick={() => {
                            setStages(list.stages);
                            setSectors(list.sectors);
                            setCheque(list.cheque);
                            setFiltersOpen(true);
                          }}
                          className="h-7 rounded-md border px-2.5 text-xs font-medium hover:bg-secondary"
                        >
                          {list.label}
                        </button>
                      ))}
                    </div>
                  </FilterGroup>
                  <FilterGroup label="Stage">
                    <ChipRow
                      items={STAGES}
                      labels={STAGE_LABEL}
                      active={stages}
                      onToggle={(s) => setStages(toggle(stages, s))}
                    />
                  </FilterGroup>
                  <FilterGroup label="Sector">
                    <ChipRow
                      items={SECTORS}
                      labels={SECTOR_LABEL}
                      active={sectors}
                      onToggle={(s) => setSectors(toggle(sectors, s))}
                    />
                  </FilterGroup>
                  <FilterGroup label="Track record">
                    <ChipRow
                      items={SIGNALS}
                      labels={SIGNAL_LABEL}
                      active={signals}
                      onToggle={(s) => setSignals(toggle(signals, s))}
                    />
                  </FilterGroup>
                  <FilterGroup label="Cheque size">
                    <ChipRow
                      items={CHEQUE_BUCKETS.filter((b) => b.id !== "any").map((b) => b.id)}
                      labels={CHEQUE_LABEL}
                      active={cheque === "any" ? [] : [cheque]}
                      onToggle={(id) => setCheque(cheque === id ? "any" : id)}
                    />
                  </FilterGroup>
                </div>
              </div>
              {round.firms > 0 && (
                <div className="space-y-1.5 border-b bg-muted/40 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Your round</span>
                    <label className="flex items-center gap-1 text-muted-foreground">
                      Target
                      <Input
                        value={roundTarget}
                        onChange={(e) => setRoundTarget(e.target.value)}
                        placeholder="£750k"
                        className="h-6 w-20 px-1.5 text-xs"
                        aria-label="Round target"
                      />
                    </label>
                  </div>
                  <p>
                    {round.firms} {round.firms === 1 ? "firm" : "firms"} in your pipeline · typical
                    cheques add up to {formatGbp(round.reach)} · likely about{" "}
                    <strong>{formatGbp(round.expected)}</strong>
                    {target && !Number.isNaN(target)
                      ? ` (${Math.round((round.expected / target) * 100)}% of ${formatGbp(target)})`
                      : ""}
                  </p>
                  <p className="text-muted-foreground">
                    A rough guide: each firm's typical cheque × the usual odds at its stage.
                    {round.estimated > 0
                      ? ` ${round.estimated} of ${round.firms} use a typical range because the firm states no cheque size.`
                      : ""}
                  </p>
                </div>
              )}
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {filtered.map((v) => {
                  const rating = summarizeReviews(reviewsById.get(v.id) ?? []).overall;
                  const status = pipeline[v.id];
                  return (
                    <li key={v.id}>
                      <button
                        onClick={() => setSelectedId(v.id)}
                        onMouseEnter={() => setHoveredId(v.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className={cn(
                          "w-full border-b px-4 py-3 text-left hover:bg-accent",
                          (selectedId === v.id || hoveredId === v.id) && "bg-accent",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{v.name}</span>
                          {rating !== null && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              ★ {rating}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {v.oneLiner}
                        </p>
                        <InvestorFacts investor={v} />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {status && status !== "none" && (
                            <Badge variant="secondary">
                              {PIPELINE.find((p) => p.key === status)?.label}
                            </Badge>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    No investors match.
                  </li>
                )}
              </ul>
            </>
          )}
        </aside>

        <main className="relative order-1 h-[42vh] md:order-2 md:h-auto md:flex-1">
          <div
            role="radiogroup"
            aria-label="Map view"
            className="absolute left-3 top-3 z-[1] flex rounded-lg border bg-background/95 p-0.5 shadow-sm backdrop-blur"
          >
            {MAP_VIEWS.map((v) => (
              <button
                key={v.id}
                role="radio"
                aria-checked={view.id === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-pixel text-[11px] uppercase",
                  view.id === v.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <VcMap
            view={view}
            investors={(pitchMatches ? pitchMatches.map((m) => m.investor) : filtered).filter(
              onMap,
            )}
            selectedId={selectedId}
            hoveredId={hoveredId}
            ranks={ranks}
            fitKey={fitKey}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
        </main>

        {selected && (
          <div className="absolute inset-0 z-10 bg-background md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:shadow-xl">
            <InvestorDetail
              investor={selected}
              reviews={reviewsById.get(selected.id) ?? []}
              status={pipeline[selected.id] ?? "none"}
              onStatus={(s) => setStatus(selected.id, s)}
              onClose={() => setSelectedId(null)}
              dataDate={dataset.source === "dealroom" ? formatDataDate(dataset.generatedAt) : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// "2026-10-28" → "28 Oct 2026": founders should see how fresh the data is.
function formatDataDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

type Signal = "active" | "leads";
const SIGNALS: Signal[] = ["active", "leads"];
// Evidence of recent investing beats a name on a list (the rule ai-angels uses for its list).
const SIGNAL_LABEL: Record<Signal, string> = {
  active: "Invested in last 12m",
  leads: "Leads rounds",
};

// One-tap starting points for founders who don't know what to filter by yet.
const QUICK_LISTS: { label: string; stages: Stage[]; sectors: Sector[]; cheque: ChequeBucketId }[] =
  [
    { label: "First cheque, any sector", stages: ["pre-seed"], sectors: [], cheque: "under-250k" },
    { label: "Seed AI", stages: ["seed"], sectors: ["ai"], cheque: "any" },
    { label: "Pre-seed healthtech", stages: ["pre-seed"], sectors: ["healthtech"], cheque: "any" },
    { label: "Seed fintech", stages: ["seed"], sectors: ["fintech"], cheque: "any" },
    { label: "Climate", stages: [], sectors: ["climate"], cheque: "any" },
  ];

// Type, stage, cheque and recent activity on one line, so cards can be compared without opening.
function InvestorFacts({ investor: v }: { investor: Investor }) {
  const facts = [
    TYPE_LABEL[v.type],
    v.stages
      .slice(0, 2)
      .map((s) => STAGE_LABEL[s])
      .join(", "),
    `${formatGbp(v.checkSizeGbp.min)}–${formatGbp(v.checkSizeGbp.max)}${v.chequeEstimated ? " est." : ""}`,
    v.dealsLast12m ? `${v.dealsLast12m} rounds in 12m` : null,
    v.leadsRounds ? "leads" : null,
  ].filter(Boolean);
  return <p className="mt-1 text-[11px] text-muted-foreground/90">{facts.join(" · ")}</p>;
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ChipRow<T extends string>({
  items,
  labels,
  active,
  onToggle,
}: {
  items: T[];
  labels: Record<T, string>;
  active: T[];
  onToggle: (item: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onToggle(item)}
          aria-pressed={active.includes(item)}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
            active.includes(item)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground/80 hover:bg-secondary",
          )}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}
