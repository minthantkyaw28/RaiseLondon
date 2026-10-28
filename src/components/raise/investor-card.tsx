import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCheque, investorKind } from "@/lib/raise/format";
import { investorStages } from "@/lib/raise/stages";
import type { Investor } from "@/lib/raise/types";

export function InvestorCard({ investor, note }: { investor: Investor; note?: string }) {
  const stages = investorStages(investor).slice(0, 3).join(", ");
  return (
    <Card
      data-investor-id={investor.uuid}
      data-lat={investor.lat ?? ""}
      data-lon={investor.lon ?? ""}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            <Link to="/investors/$id" params={{ id: investor.uuid }} className="hover:underline">
              {investor.name}
            </Link>
          </CardTitle>
          <Badge variant="secondary">{investorKind(investor.investorType)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>{formatCheque(investor)}</p>
        <p>{stages || "Stage not stated"}</p>
        <p>{investor.sectors.slice(0, 4).join(", ") || "No sector tags"}</p>
        <p>
          {investor.londonRoundsSince2024} London rounds since 2024
          {investor.lat != null && investor.lon != null
            ? ` · ${investor.lat.toFixed(4)}, ${investor.lon.toFixed(4)}`
            : ""}
        </p>
        {note ? <p className="text-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  );
}
