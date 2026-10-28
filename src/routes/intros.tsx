import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Shell } from "@/components/raise/shell";
import { useRaiseData } from "@/components/raise/use-raise-data";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { matchIntros, parseConnectionsCsv } from "@/lib/raise/intros";
import type { IntroMatch } from "@/lib/raise/types";

export const Route = createFileRoute("/intros")({
  component: IntrosPage,
});

function IntrosPage() {
  const { dataset } = useRaiseData();
  const [matches, setMatches] = useState<IntroMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const investors = new Map(dataset.investors.map((investor) => [investor.uuid, investor]));

  return (
    <Shell>
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Warm intros</h1>
          <p className="text-sm text-muted-foreground">
            Upload the connections CSV from LinkedIn. Raise matches profile URLs, then exact names
            when only one person in this dataset has that name. It does not call LinkedIn, and the
            file never leaves your browser.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem("connections");
            const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
            if (!file) return;
            // Matching runs in the browser only. The file lists other people's contacts, so
            // nothing from it is uploaded or stored.
            void file.text().then((text) => {
              const connections = parseConnectionsCsv(text);
              const found = matchIntros(connections, dataset.people);
              setMatches(found);
              setMessage(
                `${found.length} matches from ${connections.length} connections. Matched on this device; nothing was uploaded.`,
              );
            });
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="connections">Connections CSV</Label>
            <input
              id="connections"
              name="connections"
              type="file"
              accept=".csv,text/csv"
              className="text-sm"
            />
          </div>
          <Button type="submit">Find overlaps</Button>
        </form>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <ul className="space-y-3">
          {matches.map((match) => {
            const investor = investors.get(match.investorUuid);
            return (
              <li
                key={`${match.person.id}:${match.via}:${match.connection.name}`}
                className="rounded-xl border p-4 text-sm"
              >
                <p className="font-medium">{match.connection.name}</p>
                <p className="text-muted-foreground">
                  {match.via === "linkedin" ? "LinkedIn URL match" : "Exact name match"} with{" "}
                  {match.person.name}
                  {match.person.role ? `, ${match.person.role}` : ""}
                  {investor ? (
                    <>
                      {" at "}
                      <Link
                        to="/investors/$id"
                        params={{ id: investor.uuid }}
                        className="underline"
                      >
                        {investor.name}
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
