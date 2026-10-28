import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AuthPanel, useAuth } from "@/components/raise/auth-panel";
import { InvestorCard } from "@/components/raise/investor-card";
import { Shell } from "@/components/raise/shell";
import { useRaiseData } from "@/components/raise/use-raise-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sectorOptions } from "@/lib/raise/filters";
import { rankInvestors, rateStartup } from "@/lib/raise/score";
import { STAGE_ORDER } from "@/lib/raise/stages";
import { supabase } from "@/lib/raise/supabase";
import type { MatchResult, StartupRating } from "@/lib/raise/types";

export const Route = createFileRoute("/match")({
  component: MatchPage,
});

function readCount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function MatchPage() {
  const { dataset } = useRaiseData();
  const { userId } = useAuth();
  const sectors = useMemo(() => sectorOptions(dataset.investors).slice(0, 40), [dataset.investors]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("Seed");
  const [raiseAmount, setRaiseAmount] = useState("");
  const [lois, setLois] = useState("");
  const [preOrders, setPreOrders] = useState("");
  const [arr, setArr] = useState("");
  const [mrr, setMrr] = useState("");
  const [tractionNotes, setTractionNotes] = useState("");
  const [rating, setRating] = useState<StartupRating | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  // Off by default: a pitch is only stored when the founder asks for it.
  const [saveProfile, setSaveProfile] = useState(false);

  return (
    <Shell>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Rate the startup, then match</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The rank is a fixed score: sector, stage, stated ticket, London activity, and how the
            traction band lines up. Figures are GBP. Nothing is stored unless you tick "Save to my
            account". The description is not scored. No language model is required.
          </p>
        </div>
        <form
          className="grid max-w-2xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const input = {
              name,
              description,
              sector,
              stage,
              raiseAmount: raiseAmount.trim() ? readCount(raiseAmount) : null,
              lois: readCount(lois),
              preOrders: readCount(preOrders),
              arr: readCount(arr),
              mrr: readCount(mrr),
              tractionNotes,
            };
            setRating(rateStartup(input));
            setMatches(rankInvestors(dataset.investors, input).slice(0, 20));
            if (supabase && userId && saveProfile) {
              void supabase
                .from("startup_profiles")
                .upsert(
                  {
                    user_id: userId,
                    name: name || null,
                    description: description || null,
                    sector: sector || null,
                    stage,
                    raise_amount: input.raiseAmount,
                    currency: "GBP",
                    lois: input.lois,
                    pre_orders: input.preOrders,
                    arr: input.arr,
                    mrr: input.mrr,
                    traction_notes: tractionNotes || null,
                  },
                  { onConflict: "user_id" },
                )
                .then(({ error }) => {
                  setMessage(error ? error.message : "Profile saved to Supabase.");
                });
            } else {
              setMessage(
                userId
                  ? "Ranked in your browser. Nothing was saved."
                  : "Ranked in your browser. Nothing was saved. Sign in to keep the startup profile.",
              );
            }
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="startup-name">Startup name</Label>
            <Input
              id="startup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="startup-description">What you are building</Label>
            <Textarea
              id="startup-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="startup-sector">Sector</Label>
              <Input
                id="startup-sector"
                list="sector-options"
                value={sector}
                onChange={(event) => setSector(event.target.value)}
              />
              <datalist id="sector-options">
                {sectors.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="startup-stage">Stage</Label>
              <select
                id="startup-stage"
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                {STAGE_ORDER.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="raise"
              label="Raise amount (GBP)"
              value={raiseAmount}
              onChange={setRaiseAmount}
            />
            <NumberField id="mrr" label="MRR (GBP)" value={mrr} onChange={setMrr} />
            <NumberField id="arr" label="ARR (GBP)" value={arr} onChange={setArr} />
            <NumberField id="lois" label="Letters of intent" value={lois} onChange={setLois} />
            <NumberField
              id="orders"
              label="Pre-purchase orders"
              value={preOrders}
              onChange={setPreOrders}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="traction">Traction notes</Label>
            <Textarea
              id="traction"
              value={tractionNotes}
              onChange={(event) => setTractionNotes(event.target.value)}
            />
          </div>
          {userId ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={saveProfile}
                onChange={(event) => setSaveProfile(event.target.checked)}
              />
              Save to my account
            </label>
          ) : null}
          <Button type="submit">Rate and rank</Button>
        </form>
        <AuthPanel />
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {rating ? (
          <section className="space-y-2 rounded-xl border p-4">
            <h2 className="text-lg font-semibold">
              {rating.band} · {rating.score}/100
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {rating.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="grid gap-4">
          {matches.map((match) => (
            <InvestorCard
              key={match.investor.uuid}
              investor={match.investor}
              note={`${match.score}/100. ${match.reasons.slice(0, 3).join(" ")}`}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
