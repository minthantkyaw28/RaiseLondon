import { describe, expect, it, vi } from "vitest";

import { appendTranscript, formatElapsed, micErrorMessage } from "./recording";
import { transcribeAudio } from "./transcribe.server";

describe("appendTranscript", () => {
  it("appends a new recording after text already in the box", () => {
    expect(appendTranscript("We build payments agents.", "Raising £750k pre-seed.")).toBe(
      "We build payments agents. Raising £750k pre-seed.",
    );
  });

  it("uses the transcript as-is when the box is empty", () => {
    expect(appendTranscript("  ", "Raising £750k.")).toBe("Raising £750k.");
  });
});

describe("formatElapsed", () => {
  it("shows minutes and zero-padded seconds", () => {
    expect(formatElapsed(65_400)).toBe("1:05");
  });
});

describe("micErrorMessage", () => {
  it("explains a blocked microphone in plain words, without the error code", () => {
    const msg = micErrorMessage(new DOMException("denied", "NotAllowedError"));
    expect(msg).toBe(
      "Microphone access was blocked. Allow the microphone for this site, or paste your pitch.",
    );
  });
});

describe("transcribeAudio", () => {
  const audio = new Blob(["fake"], { type: "audio/webm" });

  it("sends the audio to ElevenLabs Scribe with the server-side key", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ text: " Hello there " }));
    const res = await transcribeAudio(audio, "key-123", fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ ok: true, text: "Hello there" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("key-123");
    expect((init.body as FormData).get("model_id")).toBe("scribe_v2");
  });

  it("reports not-configured without calling ElevenLabs when the key is missing", async () => {
    const fetchImpl = vi.fn();
    const res = await transcribeAudio(audio, undefined, fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a failure instead of throwing when ElevenLabs errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota_exceeded", { status: 429 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await transcribeAudio(audio, "key-123", fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, reason: "failed" });
  });
});
