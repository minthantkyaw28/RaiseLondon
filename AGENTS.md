<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Rules

- Speech-to-text goes through the `transcribePitch` server function, which reads the ElevenLabs connector key from `process.env`; why: the key must never reach the browser.
- Never persist or log pitch audio or transcripts (no tables, buckets or transcript logs); why: founders are promised their pitch is not kept.
- The investor directory is read only through `fetchDataset()` in `src/data/source.server.ts` (public read-only key, server-side) and falls back to the bundled mock JSON on any failure; why: the demo must never break and the browser never talks to the tables directly.
- Directory tables (`investors`, `reviews`, `debriefs`) are public read, service-role write only; why: the Dealroom/Make import is the only writer.
