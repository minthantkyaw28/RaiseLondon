import { BadgeCheck, ExternalLink, MapPin, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Investor, Review } from "@/data/types";
import { SECTOR_LABEL, STAGE_LABEL } from "@/lib/labels";
import { DIMENSIONS, summarizeReviews } from "@/lib/ratings";
import { PIPELINE, type PipelineStatus } from "./pipeline";

interface Props {
  investor: Investor;
  reviews: Review[];
  status: PipelineStatus;
  onStatus: (s: PipelineStatus) => void;
  onClose: () => void;
}

const gbp = (n: number) => (n >= 1_000_000 ? `£${n / 1_000_000}m` : `£${n / 1000}k`);

export function InvestorDetail({ investor, reviews, status, onStatus, onClose }: Props) {
  const summary = summarizeReviews(reviews);

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
              {STAGE_LABEL[s]}
            </Badge>
          ))}
          {investor.sectors.map((s) => (
            <Badge key={s} variant="outline">
              {SECTOR_LABEL[s]}
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
        <h3 className="text-sm font-semibold">Partners</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {investor.partners.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground"> · {p.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {p.focus.map((f) => SECTOR_LABEL[f]).join(", ")}
              </span>
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
          {summary.count} reviews · {summary.verifiedCount} verified portfolio founders. Verified
          reviews weigh more.
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {r.verified ? (
                        <p className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Founder at {r.portfolioCompany}</span>
                        </p>
                      ) : (
                        <p className="font-medium text-muted-foreground">Unverified</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatReviewDate(r.date)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {reviewScore(r)}
                      <span className="text-xs font-normal text-muted-foreground">/5</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t}
                      </span>
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

const formatReviewDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const reviewScore = (r: Review) => {
  const values = DIMENSIONS.map((d) => r.scores[d.key]);
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
