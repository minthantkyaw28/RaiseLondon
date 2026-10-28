import { BadgeCheck, ExternalLink, MapPin, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Contact, Investor, Review } from "@/data/types";
import { DIMENSIONS, summarizeReviews } from "@/lib/ratings";
import type { WarmPath } from "@/lib/warm-paths";
import { PIPELINE, type PipelineStatus } from "./pipeline";

interface Props {
  investor: Investor;
  paths: WarmPath[];
  reviews: Review[];
  contacts: Contact[];
  status: PipelineStatus;
  onStatus: (s: PipelineStatus) => void;
  onClose: () => void;
}

const gbp = (n: number) => (n >= 1_000_000 ? `£${n / 1_000_000}m` : `£${n / 1000}k`);

export function InvestorDetail({
  investor,
  paths,
  reviews,
  contacts,
  status,
  onStatus,
  onClose,
}: Props) {
  const networkIds = new Set(contacts.map((c) => c.id));
  const summary = summarizeReviews(reviews, networkIds);
  const contactName = (id?: string) => contacts.find((c) => c.id === id)?.name;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {investor.type.replace("-", " ")}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{investor.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{investor.oneLiner}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <section className="space-y-3 border-b p-5 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {investor.address}
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat
            label="Cheque"
            value={`${gbp(investor.checkSizeGbp.min)}–${gbp(investor.checkSizeGbp.max)}`}
          />
          <Stat label="Fund" value={investor.fundSizeGbpM ? `£${investor.fundSizeGbpM}m` : "—"} />
          <Stat label="Deals 12m" value={String(investor.dealsLast12m)} />
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {investor.stages.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
          {investor.sectors.map((s) => (
            <Badge key={s} variant="outline">
              {s}
            </Badge>
          ))}
        </div>
        <a
          href={investor.website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          Website <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      <section className="border-b p-5">
        <h3 className="text-sm font-semibold">Your pipeline</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PIPELINE.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={status === p.key ? "default" : "outline"}
              onClick={() => onStatus(status === p.key ? "none" : p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="border-b p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Warm intro paths
        </h3>
        {paths.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No one in your network reaches this firm yet. Cold outreach, or ask around.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {paths.map((p, i) => (
              <li key={i} className="rounded-lg border border-warm/30 bg-warm/10 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-medium">You</span>
                  {p.via.map((c) => (
                    <span key={c.id}>
                      → <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground"> ({c.relation})</span>
                    </span>
                  ))}
                  <span>
                    → <span className="font-medium">{p.partnerName}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.via.length === 1
                    ? "1st-degree — ask directly"
                    : "2nd-degree — needs a double intro"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b p-5">
        <h3 className="text-sm font-semibold">Partners</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {investor.partners.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground"> · {p.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{p.focus.join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Founder ratings</h3>
          {summary.overall !== null && (
            <span className="text-2xl font-semibold">
              {summary.overall}
              <span className="text-sm font-normal text-muted-foreground">/5</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.count} reviews · {summary.verifiedCount} verified portfolio founders ·{" "}
          {summary.fromNetwork} from your network. Verified and in-network reviews weigh more.
        </p>
        {summary.overall === null ? (
          <p className="mt-3 text-sm text-muted-foreground">No founder reviews yet.</p>
        ) : (
          <>
            <dl className="mt-3 space-y-1.5">
              {DIMENSIONS.map((d) => {
                const v = summary.byDimension[d.key] ?? 0;
                return (
                  <div key={d.key} className="flex items-center gap-3 text-sm">
                    <dt className="w-32 text-muted-foreground">{d.label}</dt>
                    <dd className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(v / 5) * 100}%` }}
                      />
                    </dd>
                    <span className="w-8 text-right tabular-nums">{v}</span>
                  </div>
                );
              })}
            </dl>
            <ul className="mt-4 space-y-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {r.verified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="h-3.5 w-3.5" /> Founder at {r.portfolioCompany}
                      </span>
                    ) : (
                      <span>Unverified</span>
                    )}
                    {contactName(r.reviewerContactId) && (
                      <Badge variant="secondary">via {contactName(r.reviewerContactId)}</Badge>
                    )}
                    <span className="ml-auto">{r.date}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
