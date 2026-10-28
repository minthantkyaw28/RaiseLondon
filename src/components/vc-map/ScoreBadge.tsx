import { scoreTier, type ScoreTier } from "@/lib/match";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<ScoreTier, string> = {
  strong: "bg-emerald-600 text-white",
  good: "bg-primary text-primary-foreground",
  fair: "bg-amber-400 text-amber-950",
  weak: "bg-muted text-muted-foreground",
};

const TIER_LABEL: Record<ScoreTier, string> = {
  strong: "Strong match",
  good: "Good match",
  fair: "Fair match",
  weak: "Weak match",
};

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tier = scoreTier(score);
  return (
    <span
      title={TIER_LABEL[tier]}
      aria-label={`${TIER_LABEL[tier]}, ${score} out of 100`}
      className={cn(
        "inline-flex min-w-10 items-center justify-center rounded-md px-2 py-0.5 font-pixel text-xs tabular-nums",
        TIER_STYLE[tier],
        className,
      )}
    >
      {score}
    </span>
  );
}
