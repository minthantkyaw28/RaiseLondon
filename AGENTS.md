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
