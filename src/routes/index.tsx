import { createFileRoute, Link } from "@tanstack/react-router";

import { Shell } from "@/components/raise/shell";
import { useRaiseData } from "@/components/raise/use-raise-data";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { dataset, source } = useRaiseData();
  const vcs = dataset.investors.filter((investor) => investor.investorType === "venture_capital").length;
  const angels = dataset.investors.length - vcs;

  return (
    <Shell>
      <div className="max-w-2xl space-y-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">London investors, ranked for your round.</h1>
          <p className="text-muted-foreground">
            Raise is a working directory of active London VCs and angels. Describe the startup, get a
            score and a ranked list, and see who on your LinkedIn export sits next to an investor.
            The 3D map can replace this layout later. Every card already carries latitude and longitude.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {dataset.investors.length === 0
            ? "The investor dataset is empty."
            : `${dataset.investors.length} investors in this cut (${vcs} VCs, ${angels} angels and angel funds), loaded from ${source === "supabase" ? "Supabase" : "the repo dataset"}.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/investors" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Browse investors
          </Link>
          <Link to="/match" className="rounded-md border px-4 py-2 text-sm font-medium">
            Rate and match
          </Link>
        </div>
      </div>
    </Shell>
  );
}
