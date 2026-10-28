import { createServerFn } from "@tanstack/react-start";

import { transcribeAudio } from "./transcribe.server";

// ~5 MB is several minutes of compressed speech, enough for any pitch, and caps what one
// request can spend on ElevenLabs credits.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const transcribePitch = createServerFn({ method: "POST" })
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const audio = data.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) throw new Error("Missing audio");
    if (audio.size > MAX_AUDIO_BYTES) throw new Error("Audio too large");
    return { audio };
  })
  .handler(async ({ data }) => transcribeAudio(data.audio, process.env["ELEVENLABS_API_KEY"]));
