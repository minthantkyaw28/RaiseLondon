import { Check, Flame, Mic, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Investor } from "@/data/types";
import { formatGbp, matchInvestors, type Match } from "@/lib/match";
import { extractProfile, type PitchProfile } from "@/lib/pitch-profile";
import { cn } from "@/lib/utils";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const TOP_N = 8;

interface Props {
  investors: Investor[];
  warmIds: Set<string>;
  onSelect: (id: string) => void;
}

export function PitchMatcher({ investors, warmIds, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [result, setResult] = useState<{ profile: PitchProfile; matches: Match[] } | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSpeechSupported(getRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  };

  const startRecording = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    const base = transcript.trim();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-GB";
    rec.onresult = (e) => {
      const spoken = Array.from(e.results, (r) => r[0].transcript).join("");
      setTranscript([base, spoken.trim()].filter(Boolean).join(" "));
    };
    rec.onerror = (e) =>
      setMicError(
        e.error === "not-allowed"
          ? "Microphone access was blocked."
          : `Recording stopped: ${e.error}`,
      );
    rec.onend = () => {
      recognitionRef.current = null;
      setRecording(false);
    };
    recognitionRef.current = rec;
    setMicError(null);
    setRecording(true);
    rec.start();
  };

  const findMatches = () => {
    const profile = extractProfile(transcript);
    setResult({ profile, matches: matchInvestors(profile, investors, warmIds).slice(0, TOP_N) });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) stopRecording();
    setOpen(next);
  };

  const pick = (id: string) => {
    handleOpenChange(false);
    onSelect(id);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Sparkles className="h-4 w-4" /> Match my pitch
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match my pitch</DialogTitle>
          <DialogDescription>
            Say or paste your pitch: what you build, your stage, how much you're raising, who's on
            the team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {speechSupported && (
            <Button
              variant={recording ? "destructive" : "outline"}
              size="sm"
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {recording ? "Stop recording" : "Record pitch"}
            </Button>
          )}
          {speechSupported === false && (
            <p className="text-xs text-muted-foreground">
              Voice recording isn't supported in this browser. Paste your pitch below instead.
            </p>
          )}
          {micError && <p className="text-xs text-destructive">{micError}</p>}
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="We're two technical co-founders building AI agents for payments teams. 300 users on the waitlist, raising £750k pre-seed."
            className="min-h-[120px]"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Raise doesn't store or send your pitch. Recording uses your browser's speech service.
            </p>
            <Button size="sm" onClick={findMatches} disabled={!transcript.trim()}>
              Find my VCs
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-3 border-t pt-4">
            <ProfileChips profile={result.profile} />
            <ol className="space-y-2">
              {result.matches.map((m) => (
                <li key={m.investor.id}>
                  <button
                    onClick={() => pick(m.investor.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left hover:bg-accent",
                      warmIds.has(m.investor.id) && "border-warm/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        {m.investor.name}
                        {warmIds.has(m.investor.id) && <Flame className="h-3.5 w-3.5 text-warm" />}
                      </span>
                      <span className="font-pixel text-sm tabular-nums">{m.score}</span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-xs">
                      {m.reasons.map((r) => (
                        <li key={r} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {r}
                        </li>
                      ))}
                      {m.misses.map((r) => (
                        <li key={r} className="pl-[18px] text-muted-foreground">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const STATUS_LABEL: Record<NonNullable<PitchProfile["companyStatus"]>, string> = {
  idea: "Idea stage",
  building: "Building",
  "has-users": "Has users",
  revenue: "Revenue",
};

function ProfileChips({ profile }: { profile: PitchProfile }) {
  const chips = [
    profile.stage,
    ...profile.sectors,
    profile.raiseGbp !== null ? `Raising ${formatGbp(profile.raiseGbp)}` : null,
    profile.companyStatus ? STATUS_LABEL[profile.companyStatus] : null,
    profile.founders === "solo" ? "Solo founder" : null,
    profile.founders === "co-founders" ? "Co-founders" : null,
    profile.technicalFounder === true ? "Technical founder" : null,
    profile.technicalFounder === false ? "Non-technical founder" : null,
  ].filter((c): c is string => c !== null);

  if (!chips.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nothing picked up yet. Mention your stage, sector and how much you're raising.
      </p>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Badge key={c} variant="secondary">
          {c}
        </Badge>
      ))}
    </div>
  );
}
