import { createFileRoute } from "@tanstack/react-router";
import { Flame, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InvestorDetail } from "@/components/vc-map/InvestorDetail";
import { PIPELINE, type PipelineStatus } from "@/components/vc-map/pipeline";
import { VcMap } from "@/components/vc-map/VcMap";
import { dataset } from "@/data/source";
import type { Sector, Stage } from "@/data/types";
import { summarizeReviews } from "@/lib/ratings";
import { findWarmPaths } from "@/lib/warm-paths";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "London VC Map" },
      {
        name: "description",
        content: "Every London investor on a map, with warm intro paths through your network.",
      },
    ],
  }),
  component: Index,
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

function Index() {
  const { investors, contacts, reviews } = dataset;
  const [q, setQ] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [warmOnly, setWarmOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pipeline, setStatus] = usePipeline();

  const networkIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);
  const pathsById = useMemo(
    () => new Map(investors.map((v) => [v.id, findWarmPaths(v, contacts)])),
    [investors, contacts],
  );
  const warmIds = useMemo(
    () => new Set([...pathsById].filter(([, p]) => p.length > 0).map(([id]) => id)),
    [pathsById],
  );
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
      .filter((v) => !warmOnly || warmIds.has(v.id))
      .filter(
        (v) =>
          !needle ||
          [v.name, v.oneLiner, v.address, ...v.partners.map((p) => p.name), ...v.portfolio]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => Number(warmIds.has(b.id)) - Number(warmIds.has(a.id)));
  }, [investors, q, stages, sectors, warmOnly, warmIds]);

  const selected = investors.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">London VC Map</h1>
          <p className="text-xs text-muted-foreground">
            {investors.length} investors · {warmIds.size} reachable through your network
          </p>
        </div>
        {dataset.source === "mock" && <Badge variant="outline">Mock data</Badge>}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex min-h-0 flex-1 flex-col border-t md:order-1 md:w-[380px] md:flex-none md:border-r md:border-t-0">
          <div className="space-y-3 border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Firm, partner, portfolio company…"
                className="pl-8"
              />
            </div>
            <ChipRow
              items={STAGES}
              active={stages}
              onToggle={(s) => setStages(toggle(stages, s))}
            />
            <ChipRow
              items={SECTORS}
              active={sectors}
              onToggle={(s) => setSectors(toggle(sectors, s))}
            />
            <button
              onClick={() => setWarmOnly(!warmOnly)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                warmOnly ? "border-orange-600 bg-orange-600 text-white" : "hover:bg-accent",
              )}
            >
              <Flame className="h-3.5 w-3.5" /> Warm intro only
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((v) => {
              const bestPath = pathsById.get(v.id)?.[0];
              const rating = summarizeReviews(reviewsById.get(v.id) ?? [], networkIds).overall;
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
                      {bestPath && (
                        <Badge className="bg-orange-600 text-white hover:bg-orange-600">
                          <Flame className="mr-1 h-3 w-3" />
                          {bestPath.via.length === 1 ? "1st" : "2nd"}° via {bestPath.via[0]?.name}
                        </Badge>
                      )}
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

        <main className="order-1 h-[42vh] md:order-2 md:h-auto md:flex-1">
          <VcMap
            investors={filtered}
            selectedId={selectedId}
            warmIds={warmIds}
            onSelect={setSelectedId}
          />
        </main>

        {selected && (
          <div className="absolute inset-0 z-10 bg-background md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:shadow-xl">
            <InvestorDetail
              investor={selected}
              paths={pathsById.get(selected.id) ?? []}
              reviews={reviewsById.get(selected.id) ?? []}
              contacts={contacts}
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

function ChipRow<T extends string>({
  items,
  active,
  onToggle,
}: {
  items: T[];
  active: T[];
  onToggle: (item: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onToggle(item)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs",
            active.includes(item)
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:bg-accent",
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
