# Raise demo video

A 24-second, 1920×1080 product demo built with [Remotion](https://www.remotion.dev). It's separate from the app: its own dependencies, not built or linted with it.

```bash
cd video
bun install
npx remotion render src/index.ts Demo out/raise-demo.mp4
```

- Scenes live in `src/Demo.tsx`. The end card's `[demo link]` is a placeholder: put the real URL in `EndCard` and re-render.
- `public/` holds the product screenshots the scenes use. Re-capture them from the running app at 1920×1080 when the UI changes.
- `out/` (the rendered MP4) is not committed.
