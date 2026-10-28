import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InvestorDetail } from "@/components/vc-map/InvestorDetail";
import { PIPELINE, type PipelineStatus } from "@/components/vc-map/pipeline";
import { MAP_VIEWS, type MapViewId } from "@/components/vc-map/map-styles";
import { PitchMatcher } from "@/components/vc-map/PitchMatcher";
import { VcMap } from "@/components/vc-map/VcMap";
import { loadDataset } from "@/data/source";
import type { Sector, Stage } from "@/data/types";
import { summarizeReviews } from "@/lib/ratings";
import { SECTOR_LABEL, STAGE_LABEL } from "@/lib/labels";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      .filter(
        (v) =>
          !needle ||
          [v.name, v.oneLiner, v.address, ...v.partners.map((p) => p.name), ...v.portfolio]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [investors, q, stages, sectors]);

  const selected = investors.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h1 className="font-pixel text-lg leading-none">Raise</h1>
          <p className="text-xs text-muted-foreground">{investors.length} London investors</p>
        </div>
        <div className="flex items-center gap-2">
          {dataset.source === "mock" && <Badge variant="outline">Mock data</Badge>}
          <PitchMatcher investors={investors} onSelect={setSelectedId} />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex min-h-0 flex-1 flex-col border-t md:order-1 md:w-[380px] md:flex-none md:border-r md:border-t-0">
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
                {stages.length + sectors.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {stages.length + sectors.length}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")}
              />
            </button>
            <div className={cn("space-y-4", !filtersOpen && "hidden md:block")}>
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
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((v) => {
              const rating = summarizeReviews(reviewsById.get(v.id) ?? []).overall;
              const status = pipeline[v.id];
              return (
                <li key={v.id}>
                  <button
                    onClick={() => setSelectedId(v.id)}
                    className={cn(
                      "w-full border-b px-4 py-3 text-left hover:bg-accent",
                      selectedId === v.id && "bg-accent",
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
              <li className="p-6 text-center text-sm text-muted-foreground">No investors match.</li>
            )}
          </ul>
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
            investors={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
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
            />
          </div>
        )}
      </div>
    </div>
  );
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
