# Raise — project reference

(Formerly "London VC Map" and "RaiseUK". Scope is London only.)

## The idea

Chasing VCs at events is tiring and random. Raise is a live database of every London
investor on a map. It tells you, for each one, **how well it fits your pitch** and **what founders
who took their money say about them**.

Two pillars:

1. **Map + directory**: every London investor (VC, CVC, angel network, accelerator) pinned at
   their office, filterable by stage, sector and cheque size.
2. **Rate My VC**: founder ratings of investors, like Rate My Teachers, built so people can't
   shitpost and the information stays trustworthy.

Only London. Not a fundraising CRM, not live valuations.

## Inspiration: londonstartupmap.com (reverse engineered 2026-10-28)

| Thing      | What they do                                                                | What we copy                                                  |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Stack      | Next.js on Cloudflare (OpenNext), Mapbox GL                                 | Map + list layout; we use MapLibre + OpenFreeMap (no API key) |
| Data       | ~1,008 startups, Airtable records (`rec…` ids), embedded in the page        | One flat JSON dataset loaded at build time                    |
| Pins       | Building-level only, never floor/unit; startups in one building share a pin | Same rule for investor offices                                |
| Clustering | Mapbox GeoJSON source clustering                                            | MapLibre GeoJSON clustering                                   |
| Filters    | `q`, `stage`, `sector`, `events=1`, `yc=1`, `sort`                          | `q`, stage, sector                                            |
| Profile    | One-liner, founders, investors, address, upcoming Luma events               | One-liner, partners, portfolio, cheque size, ratings          |
| Agents     | `llms.txt` and a `.md` version of every page                                | Later, cheap win                                              |
| Revenue    | £99/30 days sponsored card slots                                            | Later                                                         |

## Look and feel

- **Map style:** inspired by [tiny.london](https://tiny.london), an isometric pixel-art map of
  London. We do **not** use their tiles. They're the author's artwork built from Google map data
  ("Map data ©2026 Google"), and tiny.london is one huge OpenSeadragon deep-zoom image, not a
  slippy map. We recreate the look ourselves:
  - our own bright style (the Pixel view in `src/components/vc-map/map-styles.ts`) on OpenFreeMap vector tiles;
  - a pitched, rotated camera (pitch 55, bearing -30) with 3D buildings from zoom 14.5;
  - the city drawn at half the device resolution (`pixelScale: 0.5`, so 2×2 blocks on retina) on
    a base map, upscaled with
    `image-rendering: pixelated`. Labels and pins sit on a full-resolution map on top, so text
    stays sharp. Both maps use WebGL antialiasing.
- **Map views (toggle, top-left of the map, remembered per browser):** Pixel (default, bright
  pixel art), Chalk (a white architectural model, after the "chalk" look in owenb/mubit_hackathon)
  and Night (dark city with glowing cyan main roads, after its "night" look). That repo is a
  native Metal renderer, so only the looks carry over, not code. Every view is one `Look` palette
  passed to `buildStyle`.
- **Palette:** cream land, sky-blue water, bright greens, yellow main roads, peach buildings.
  Investor pins are one colour per view: orange-red in Pixel and Chalk, orange in Night.
- **Fonts:** Host Grotesk for the UI (clean, not widely used) and Silkscreen for pixel touches
  (wordmark, map labels). Loaded from Google Fonts in `__root.tsx`.
- Keep it clean: no gradients, no glow, no emoji. Bright colour lives on the map; the panels stay
  light and quiet.

## Data: Dealroom → JSON → Lovable

The Dealroom API key must never reach Lovable or the browser. The flow is:

1. **Min** pulls London investors from the Dealroom API with his key, on his machine.
2. He maps the response into the `Dataset` shape in `src/data/types.ts` and writes it to a JSON
   file in `src/data/` (for example `investors.json`).
3. He changes the one import in `src/data/source.ts` from the mock file to the real file and
   commits to `main`. GitHub syncs it to Lovable. That's the whole "port into Lovable" trick: the
   data is just a file in the repo.

When the data needs to refresh on a schedule, move it to a Supabase table (Lovable Cloud) filled by
a scheduled job that holds the key server-side. Not needed for the prototype.

### Dataset shape (`src/data/types.ts`)

- `Investor`: name, type, one-liner, website, building-level address + lat/lng, stages, sectors,
  cheque size (GBP), fund size, deals in the last 12 months, portfolio, partners.
- `Partner`: name, title, LinkedIn, sector focus.
- `Review`: investor id, portfolio company, verified flag, four 1–5 scores, tags and date.

The mock (`src/data/investors.mock.json`) holds **fictional** firms and people at real London
locations: 28 investors and 76 reviews. Never mix real firm names with made-up people
or ratings.

## Rate My VC: trust rules (`src/lib/ratings.ts`)

The tension: founders need to speak honestly ("this guy is a tool") without the site turning into
a shitposting board. The rules:

- **Structured scores, not free text.** Responsiveness, value-add, fair terms, founder-first (1–5),
  plus tags from a fixed list ("Replies in 24h", "Ghosted after IC"). There's no comment box to
  shitpost in.
- **Verified against the portfolio.** A review counts fully only when the reviewer founded a
  company in that investor's portfolio (checkable against Dealroom portfolio data).
- **Hidden from the public, known to the system.** Other users never see who wrote a review. We
  keep the identity so we can verify it and remove abuse.
- **Weighting.** Unverified = 0.25, verified = 1.
- Always show the count and how many are verified next to the score.

Open questions: a minimum number of reviews before showing a score (so a single reviewer can't be
identified), whether investors can reply, and how disputes and takedowns work.

## Pipeline

A per-user status for each firm: Target → Intro asked → Meeting → Passed. The prototype keeps it
in the browser's localStorage. With accounts it moves into the database.

## Pitch matcher (`src/lib/pitch-profile.ts`, `src/lib/match.ts`)

"Match my pitch" in the header opens `PitchMatcher.tsx`:

1. The founder records their pitch (MediaRecorder in the browser, with a Stop button and timer) or
   pastes it. On stop the audio goes to the `transcribePitch` server function
   (`src/lib/transcribe.functions.ts`), which calls ElevenLabs Scribe (`scribe_v2`) with the
   connector's `ELEVENLABS_API_KEY`. The transcript is appended to the textarea, which is always
   editable.
2. `extractProfile` turns the text into a profile: sectors, stage, company status, raise, solo or
   co-founders, technical or not. If the stage isn't said, it's inferred from status and raise.
3. `matchInvestors` scores every firm out of 100: stage 40, sector overlap 35, raise inside the
   cheque range 20 (half within 2x), deals in the last 12 months 5. The top 8 show with reasons
   and misses; clicking one selects it on the map.

Neither audio nor transcript is stored or logged anywhere: no database, no storage, no transcript
in logs. Extraction is still keyword rules in the browser. The speech key lives only on the server.

## For AI agents

Read-only markdown endpoints, rendered by `src/lib/agent-markdown.ts`, cached for 5 minutes:

- `GET /llms.txt`: what Raise is, when to use it and how to call it.
- `GET /index.md`: every investor as a markdown list. Filters: `stage` and `sector`
  (comma-separated slugs) and `q` (name, one-liner, partner names).
- `GET /investor/<slug>.md`: one investor's profile with partners, portfolio and review
  summary. Unknown slugs return 404.

## Code map

| Path                                       | What                                                            |
| ------------------------------------------ | --------------------------------------------------------------- |
| `src/routes/index.tsx`                     | Page: filters, list, map, detail panel                          |
| `src/components/vc-map/VcMap.tsx`          | MapLibre map, clusters, pins (client-only, loaded in an effect) |
| `src/components/vc-map/InvestorDetail.tsx` | Firm profile, pipeline, ratings                                 |
| `src/data/source.ts`                       | The single place the dataset is loaded; swap mock → real here   |
| `src/lib/*.test.ts`                        | Tests for rating weights and the pitch matcher                  |

## Guidelines

- **Lovable is connected to `main`.** Every push to `main` shows up in the Lovable editor. Keep
  `main` working. Never force-push or rewrite pushed history (see `AGENTS.md`).
- Gate before pushing: `bunx prettier --check src`, `bunx tsc --noEmit`, `bun run lint`,
  `bun run test`, `bun run build`.
- Map tiles come from OpenFreeMap (free, no key). Use `Noto Sans` font stacks for map labels;
  OpenFreeMap doesn't serve the default font.
- MapLibre needs its worker URL set explicitly (`setWorkerUrl`) because Vite pre-bundling moves it.
- No secrets in the repo. The Dealroom key stays with Min.
- Building-level addresses only.
- London only.

## Decisions (2026-10-28)

- Warm intros removed: no data source for founders' networks. Revisit only with a real source
  (e.g. a LinkedIn connections import).
- No matching or scoring on founder demographics (age, sex, race): UK Equality Act risk, and that
  data is special category under UK GDPR. Only aggregate, public deal trends.
- Planned: a "why they said no" questionnaire after investor meetings, verified like reviews.
- London only for now.
- Investor types: take whatever Dealroom returns; no new types up front.
- Target data path: Supabase table filled by a Make/Integromat import from the Dealroom API.
- Seasonal easter eggs: parked.

## Next up

1. Real Dealroom data from Min (swap `source.ts`).
2. A "why they said no" questionnaire after investor meetings, verified like reviews.
3. Accounts and a review submission flow with portfolio verification.
4. Upcoming investor events (Luma), like londonstartupmap.
