// Server-only: talks to ElevenLabs Scribe with the connector's key.
// Privacy rule: never log, store or cache the audio or the transcript.

export type TranscribeResult =
  { ok: true; text: string } | { ok: false; reason: "not-configured" | "failed" };

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export async function transcribeAudio(
  audio: Blob,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<TranscribeResult> {
  if (!apiKey) {
    console.error("ElevenLabs transcription skipped: ELEVENLABS_API_KEY is not linked");
    return { ok: false, reason: "not-configured" };
  }

  const form = new FormData();
  form.append("file", audio, audio instanceof File ? audio.name : "pitch.webm");
  form.append("model_id", "scribe_v2");
  form.append("language_code", "eng");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");

  let response: Response;
  try {
    response = await fetchImpl(ELEVENLABS_STT_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });
  } catch (error) {
    console.error("ElevenLabs transcription request failed:", (error as Error).message);
    return { ok: false, reason: "failed" };
  }

  if (!response.ok) {
    // The error body describes the API failure, not the pitch, so it is safe to log.
    const body = (await response.text()).slice(0, 500);
    console.error(`ElevenLabs transcription failed [${response.status}]: ${body}`);
    return { ok: false, reason: "failed" };
  }

  const json = (await response.json()) as { text?: unknown };
  return { ok: true, text: typeof json.text === "string" ? json.text.trim() : "" };
}
