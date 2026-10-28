import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mic, Sparkles, Square } from "lucide-react";
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
import {
  NOTHING_HEARD,
  RECORDING_UNSUPPORTED,
  TRANSCRIBE_FAILED,
  TRANSCRIBE_NOT_CONFIGURED,
  appendTranscript,
  fileNameFor,
  formatElapsed,
  micErrorMessage,
  pickMimeType,
} from "@/lib/recording";
import { transcribePitch } from "@/lib/transcribe.functions";

const TOP_N = 8;

type Phase = "idle" | "recording" | "transcribing";

interface Props {
  investors: Investor[];
  onSelect: (id: string) => void;
}

export function PitchMatcher({ investors, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [result, setResult] = useState<{ profile: PitchProfile; matches: Match[] } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);
  const transcribe = useServerFn(transcribePitch);

  const releaseMic = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Closing the dialog or leaving the page drops the recording without sending it.
  const cancelRecording = () => {
    discardRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    releaseMic();
    setPhase((p) => (p === "recording" ? "idle" : p));
  };

  // Only refs are touched on unmount, so the first render's function is enough.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => cancelRecording, []);

  const sendForTranscription = async (audio: Blob, mimeType: string) => {
    setPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", new File([audio], fileNameFor(mimeType), { type: mimeType }));
      const res = await transcribe({ data: form });
      if (!res.ok) {
        setMicError(
          res.reason === "not-configured" ? TRANSCRIBE_NOT_CONFIGURED : TRANSCRIBE_FAILED,
        );
      } else if (!res.text) {
        setMicError(NOTHING_HEARD);
      } else {
        setTranscript((prev) => appendTranscript(prev, res.text));
      }
    } catch {
      setMicError(TRANSCRIBE_FAILED);
    } finally {
      setPhase("idle");
    }
  };

  const startRecording = async () => {
    setMicError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError(RECORDING_UNSUPPORTED);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      setMicError(micErrorMessage(error));
      return;
    }

    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      stream.getTracks().forEach((t) => t.stop());
      setMicError(micErrorMessage(error));
      return;
    }

    const chunks: Blob[] = [];
    discardRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      releaseMic();
      if (discardRef.current) return;
      const type = recorder.mimeType || mimeType || "audio/webm";
      const audio = new Blob(chunks, { type });
      if (audio.size === 0) {
        setMicError(NOTHING_HEARD);
        setPhase("idle");
        return;
      }
      void sendForTranscription(audio, type);
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    const startedAt = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    recorder.start();
    setPhase("recording");
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder?.state === "recording") recorder.stop();
    else {
      releaseMic();
      setPhase("idle");
    }
  };

  const findMatches = () => {
    const profile = extractProfile(transcript);
    setResult({ profile, matches: matchInvestors(profile, investors).slice(0, TOP_N) });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) cancelRecording();
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
          <Button
            variant={phase === "recording" ? "destructive" : "outline"}
            size="sm"
            disabled={phase === "transcribing"}
            onClick={phase === "recording" ? stopRecording : startRecording}
          >
            {phase === "recording" && (
              <>
                <Square className="h-4 w-4" /> Stop
                <span className="tabular-nums">{formatElapsed(elapsedMs)}</span>
              </>
            )}
            {phase === "transcribing" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Transcribing…
              </>
            )}
            {phase === "idle" && (
              <>
                <Mic className="h-4 w-4" /> Record pitch
              </>
            )}
          </Button>
          {micError && <p className="text-xs text-destructive">{micError}</p>}
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="We're two technical co-founders building AI agents for payments teams. 300 users on the waitlist, raising £750k pre-seed."
            className="min-h-[120px]"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Raise doesn't store your pitch. Recordings are transcribed by ElevenLabs and not kept.
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
                    className="w-full rounded-lg border p-3 text-left hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        {m.investor.name}
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
