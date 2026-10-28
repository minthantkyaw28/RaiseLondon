import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Debrief, DebriefReason, MeetingOutcome, PickyTopic } from "@/data/types";
import { OUTCOME_LABEL, PICKY_LABEL, REASON_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface Props {
  investorId: string;
  investorName: string;
  onSave: (debrief: Debrief) => void;
}

const OUTCOMES = Object.keys(OUTCOME_LABEL) as MeetingOutcome[];
const REASONS = Object.keys(REASON_LABEL) as DebriefReason[];
const TOPICS = Object.keys(PICKY_LABEL) as PickyTopic[];

const hasReasons = (o: MeetingOutcome | null) => o === "passed" || o === "ghosted";

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function DebriefForm({ investorId, investorName, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null);
  const [reasons, setReasons] = useState<DebriefReason[]>([]);
  const [pickyAbout, setPickyAbout] = useState<PickyTopic[]>([]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setOutcome(null);
      setReasons([]);
      setPickyAbout([]);
    }
  };

  const save = () => {
    if (!outcome) return;
    onSave({
      id: crypto.randomUUID(),
      investorId,
      outcome,
      reasons: hasReasons(outcome) ? reasons : [],
      pickyAbout,
      date: today(),
    });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Add your debrief
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Meeting debrief</DialogTitle>
          <DialogDescription>How did your meeting with {investorName} go?</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold">Outcome</legend>
            <RadioGroup
              value={outcome ?? ""}
              onValueChange={(v) => setOutcome(v as MeetingOutcome)}
              className="mt-2 grid-cols-2"
            >
              {OUTCOMES.map((o) => (
                <div key={o} className="flex items-center gap-2">
                  <RadioGroupItem value={o} id={`outcome-${o}`} />
                  <Label htmlFor={`outcome-${o}`} className="font-normal">
                    {OUTCOME_LABEL[o]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          {hasReasons(outcome) && (
            <fieldset>
              <legend className="text-sm font-semibold">Why, if they said</legend>
              <Chips
                items={REASONS}
                labels={REASON_LABEL}
                active={reasons}
                onToggle={(r) => setReasons((prev) => toggle(prev, r))}
              />
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-semibold">They were picky about</legend>
            <Chips
              items={TOPICS}
              labels={PICKY_LABEL}
              active={pickyAbout}
              onToggle={(t) => setPickyAbout((prev) => toggle(prev, t))}
            />
          </fieldset>

          <p className="text-xs text-muted-foreground">
            Debriefs are anonymous. Only patterns from 3+ founders are shown.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={!outcome}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chips<T extends string>({
  items,
  labels,
  active,
  onToggle,
}: {
  items: T[];
  labels: Record<T, string>;
  active: T[];
  onToggle: (item: T) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onToggle(item)}
          aria-pressed={active.includes(item)}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
            active.includes(item)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground/80 hover:bg-secondary",
          )}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}
