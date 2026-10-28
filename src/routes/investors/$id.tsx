import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthPanel, useAuth } from "@/components/raise/auth-panel";
import { Shell } from "@/components/raise/shell";
import { useRaiseData } from "@/components/raise/use-raise-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCheque, formatMoney, investorKind } from "@/lib/raise/format";
import { investorStages } from "@/lib/raise/stages";
import { supabase } from "@/lib/raise/supabase";

export const Route = createFileRoute("/investors/$id")({
  component: InvestorProfile,
});

type PublicReview = {
  id: string;
  rating: number;
  body: string;
  relationship: string;
  created_at: string;
};

function InvestorProfile() {
  const { id } = Route.useParams();
  const { dataset } = useRaiseData();
  const { userId } = useAuth();
  const investor = dataset.investors.find((item) => item.uuid === id);
  const deals = dataset.deals
    .filter((deal) => deal.investorUuid === id)
    .sort(
      (a, b) =>
        (b.roundYear ?? 0) - (a.roundYear ?? 0) || (b.roundMonth ?? 0) - (a.roundMonth ?? 0),
    )
    .slice(0, 8);
  const people = dataset.people.filter((person) => person.investorUuid === id);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [rating, setRating] = useState("4");
  const [relationship, setRelationship] = useState("pitched");
  const [body, setBody] = useState("");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [thesis, setThesis] = useState("");
  const [chequeMin, setChequeMin] = useState("");
  const [chequeMax, setChequeMax] = useState("");
  const [stages, setStages] = useState("");
  const [sectors, setSectors] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!investor) return;
    setThesis(investor.thesis ?? "");
    setChequeMin(investor.chequeMin == null ? "" : String(investor.chequeMin));
    setChequeMax(investor.chequeMax == null ? "" : String(investor.chequeMax));
    setStages(investorStages(investor).join(", "));
    setSectors(investor.sectors.join(", "));
    setIsActive(investor.isActive);
  }, [investor]);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("investor_reviews_public")
      .select("id, rating, body, relationship, created_at")
      .eq("investor_uuid", id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setReviews(data as PublicReview[]);
      });
  }, [id]);

  if (!investor) {
    return (
      <Shell>
        <p>That investor is not in this dataset.</p>
        <Link to="/investors" className="text-sm underline">
          Back to investors
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div
        className="space-y-8"
        data-investor-id={investor.uuid}
        data-lat={investor.lat ?? ""}
        data-lon={investor.lon ?? ""}
      >
        <div className="space-y-3">
          <Link to="/investors" className="text-sm text-muted-foreground hover:text-foreground">
            All investors
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{investor.name}</h1>
            <Badge variant="secondary">{investorKind(investor.investorType)}</Badge>
          </div>
          <p className="text-muted-foreground">{investor.tagline}</p>
          <p className="text-sm text-muted-foreground">
            {formatCheque(investor)} · {investorStages(investor).join(", ") || "Stage not stated"} ·{" "}
            {investor.londonRoundsSince2024} London rounds since 2024
            {investor.lat != null && investor.lon != null
              ? ` · ${investor.lat.toFixed(4)}, ${investor.lon.toFixed(4)}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {investor.website ? (
              <a className="underline" href={investor.website}>
                Website
              </a>
            ) : null}
            {investor.linkedin ? (
              <a className="underline" href={investor.linkedin}>
                LinkedIn
              </a>
            ) : null}
            {investor.dealroomUrl ? (
              <a className="underline" href={investor.dealroomUrl}>
                Dealroom
              </a>
            ) : null}
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What they invest in</h2>
          {investor.thesis ? <p>{investor.thesis}</p> : null}
          <p className="text-sm text-muted-foreground">
            {investor.about || "No Dealroom description."}
          </p>
          <p className="text-sm">{investor.sectors.join(", ") || "No sector tags"}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Update the profile</h2>
          <p className="text-sm text-muted-foreground">
            Edits go to investor_overrides and stay put when the Dealroom seed is run again. A blank
            cheque field keeps the Dealroom number.
          </p>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!supabase || !userId) {
                setOverrideMessage("Sign in with Supabase to save an override.");
                return;
              }
              const pipe = (value: string) =>
                value
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .join("|");
              void supabase
                .from("investor_overrides")
                .upsert(
                  {
                    investor_uuid: investor.uuid,
                    thesis: thesis.trim() || null,
                    cheque_min: chequeMin.trim() ? Number(chequeMin) : null,
                    cheque_max: chequeMax.trim() ? Number(chequeMax) : null,
                    stages: pipe(stages),
                    sectors: pipe(sectors),
                    is_active: isActive,
                  },
                  { onConflict: "investor_uuid" },
                )
                .then(({ error }) => {
                  setOverrideMessage(error ? error.message : "Saved.");
                });
            }}
          >
            <div className="grid gap-1">
              <Label htmlFor="thesis">Current interest</Label>
              <Textarea
                id="thesis"
                value={thesis}
                onChange={(event) => setThesis(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="cheque-min">Cheque min</Label>
                <Input
                  id="cheque-min"
                  inputMode="numeric"
                  value={chequeMin}
                  onChange={(event) => setChequeMin(event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="cheque-max">Cheque max</Label>
                <Input
                  id="cheque-max"
                  inputMode="numeric"
                  value={chequeMax}
                  onChange={(event) => setChequeMax(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="stages">Stages, comma separated</Label>
              <Input
                id="stages"
                value={stages}
                onChange={(event) => setStages(event.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="sectors">Sectors, comma separated</Label>
              <Input
                id="sectors"
                value={sectors}
                onChange={(event) => setSectors(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Show in the directory
            </label>
            <Button type="submit">Save override</Button>
            {overrideMessage ? (
              <p className="text-sm text-muted-foreground">{overrideMessage}</p>
            ) : null}
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recent London rounds</h2>
          {deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stored London rounds.</p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {deals.map((deal) => (
              <li key={deal.id} className="rounded-md border px-3 py-2">
                <span className="font-medium">{deal.companyName}</span>
                {" · "}
                {deal.standardizedRound || deal.roundType || "Round"}
                {deal.roundYear
                  ? ` · ${deal.roundYear}${deal.roundMonth ? `-${String(deal.roundMonth).padStart(2, "0")}` : ""}`
                  : ""}
                {deal.amount != null ? ` · ${formatMoney(deal.amount, deal.currency)}` : ""}
                {deal.isLead ? " · lead" : ""}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">People</h2>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">No people stored.</p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {people.map((person) => (
              <li key={person.id}>
                {person.name}
                {person.role ? ` · ${person.role}` : ""}
                {person.linkedin ? (
                  <>
                    {" · "}
                    <a className="underline" href={person.linkedin}>
                      LinkedIn
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Rate this investor</h2>
          <p className="text-sm text-muted-foreground">
            A review is anonymous on the public list. Verified means the writer was signed in. It
            does not prove this investor funded the company.
          </p>
          <AuthPanel />
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">
                  {review.rating}/5 · {review.relationship}
                </p>
                <p>{review.body}</p>
              </li>
            ))}
          </ul>
          <form
            className="grid max-w-xl gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!supabase || !userId) {
                setReviewMessage("Sign in to save a review.");
                return;
              }
              void supabase
                .from("investor_reviews")
                .upsert(
                  {
                    user_id: userId,
                    investor_uuid: investor.uuid,
                    rating: Number(rating),
                    body: body.trim(),
                    relationship,
                  },
                  { onConflict: "user_id,investor_uuid" },
                )
                .then(({ error }) => {
                  setReviewMessage(error ? error.message : "Review saved.");
                  if (!error) {
                    setReviews((current) => [
                      {
                        id: `${userId}-${investor.uuid}`,
                        rating: Number(rating),
                        body: body.trim(),
                        relationship,
                        created_at: new Date().toISOString(),
                      },
                      ...current.filter((review) => review.id !== `${userId}-${investor.uuid}`),
                    ]);
                  }
                });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="rating">Rating</Label>
                <select
                  id="rating"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                >
                  {["1", "2", "3", "4", "5"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="relationship">Relationship</Label>
                <select
                  id="relationship"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value)}
                >
                  <option value="pitched">Pitched</option>
                  <option value="invested">Invested</option>
                  <option value="passed">Passed</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="review-body">What happened</Label>
              <Textarea
                id="review-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
              />
            </div>
            <Button type="submit">Submit review</Button>
            {reviewMessage ? (
              <p className="text-sm text-muted-foreground">{reviewMessage}</p>
            ) : null}
          </form>
        </section>
      </div>
    </Shell>
  );
}
