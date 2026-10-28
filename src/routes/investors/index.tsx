import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { InvestorCard } from "@/components/raise/investor-card";
import { Shell } from "@/components/raise/shell";
import { useRaiseData } from "@/components/raise/use-raise-data";
import { CHEQUE_BUCKETS, filterInvestors, sectorOptions } from "@/lib/raise/filters";
import { STAGE_ORDER } from "@/lib/raise/stages";

export const Route = createFileRoute("/investors/")({
  component: InvestorsPage,
});

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm";

function InvestorsPage() {
  const { dataset } = useRaiseData();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [cheque, setCheque] = useState("any");
  const sectors = useMemo(() => sectorOptions(dataset.investors).slice(0, 40), [dataset.investors]);
  const rows = useMemo(
    () =>
      filterInvestors(dataset.investors, { query, sector, stage, cheque }).sort(
        (a, b) => b.londonRoundsSince2024 - a.londonRoundsSince2024 || a.name.localeCompare(b.name),
      ),
    [cheque, dataset.investors, query, sector, stage],
  );

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Investors</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {rows.length} of {dataset.investors.length}. Coordinates sit on each card as data-lat and
            data-lon for the map.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className={fieldClass}
            placeholder="Search name or sector"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search investors"
          />
          <select className={fieldClass} value={sector} onChange={(event) => setSector(event.target.value)} aria-label="Sector">
            <option value="">Any sector</option>
            {sectors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select className={fieldClass} value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Stage">
            <option value="">Any stage</option>
            {STAGE_ORDER.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select className={fieldClass} value={cheque} onChange={(event) => setCheque(event.target.value)} aria-label="Cheque size">
            {CHEQUE_BUCKETS.map((bucket) => (
              <option key={bucket.id} value={bucket.id}>
                {bucket.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((investor) => (
            <InvestorCard key={investor.uuid} investor={investor} />
          ))}
        </div>
      </div>
    </Shell>
  );
}
