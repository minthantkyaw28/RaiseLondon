// Browser-safe helpers for the pitch recorder.

export function appendTranscript(existing: string, addition: string): string {
  return [existing.trim(), addition.trim()].filter(Boolean).join(" ");
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// getUserMedia rejects with DOMExceptions whose names users can't act on.
export function micErrorMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access was blocked. Allow the microphone for this site, or paste your pitch.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone found. Plug one in, or paste your pitch.";
    case "NotReadableError":
      return "Your microphone is being used by another app. Close it and try again, or paste your pitch.";
    default:
      return "Couldn't start recording. Try again, or paste your pitch.";
  }
}

export const TRANSCRIBE_FAILED =
  "Couldn't transcribe your recording. Try again, or paste your pitch.";
export const TRANSCRIBE_NOT_CONFIGURED =
  "Voice transcription isn't set up yet. Paste your pitch instead.";
export const NOTHING_HEARD = "Didn't catch anything. Check your microphone and try again.";
export const RECORDING_UNSUPPORTED =
  "Recording isn't available in this browser. Paste your pitch below instead.";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  return MIME_CANDIDATES.find((t) => isSupported(t));
}

export function fileNameFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "pitch.mp4";
  if (mimeType.includes("ogg")) return "pitch.ogg";
  return "pitch.webm";
}
