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

## Data: Min's Dealroom export → adapter → app

The home page (map, list, profiles, pitch matcher) and the agent endpoints show **real** London
investors from Min's Dealroom export, `src/lib/raise/dataset.json` (generated 2026-10-28, see
`data/README.md`). `src/data/from-raise.ts` `fromRaise()` is a pure adapter from his `Dataset`
(`src/lib/raise/types.ts`) to ours (`src/data/types.ts`). Min's files are his; don't edit them.

How the app reads it (`src/data/`):

- `source.server.ts` `fetchDataset()` runs the adapter once per server process over the bundled
  export. It is server-only, so the 2.4 MB JSON stays out of the home page's browser bundle.
- The home page loader calls it through the `getDataset` server function; the agent endpoints
  (`/llms.txt`, `/index.md`, `/investor/<slug>.md`) call it directly.
- `source` is `"dealroom"`, so the "Mock data" badge is gone and the agent markdown says the data
  is real.
- **Why not Supabase:** the Lovable `investors`/`reviews`/`debriefs` tables hold only the 28 mock
  firms, in our shape. Min's migration (`supabase/migrations/20261028190000_raise.sql`) creates
  its own `public.investors` with a different shape, which clashes with the Lovable table of the
  same name. Until that is settled, the bundled export is the one source that has the real data.
- **No ratings or debriefs on real firms.** The adapter always returns `reviews: []` and
  `debriefs: []`. Mock reviews and debriefs are never attached to real companies.
- The mock (`src/data/investors.mock.json`, 28 **fictional** firms, 76 reviews, 40 debriefs) is now
  only a test fixture (`source.test.ts` checks none of its firms leak into the served data).

### What the adapter keeps and drops (2026-10-28 export)

334 investors in the export, **281 shown**. Skipped: 4 with no coordinates, 49 headquartered
outside London (mostly the life-sciences add-on: Paris, Boston, Oxford…).

- **id / slug:** id is the Dealroom uuid. Slug is the name in kebab-case; firms sharing a name
  (Founders Capital, Velocity Capital) all get `-<first 8 of uuid>`, so no slug depends on order.
- **type:** `venture_capital` → `vc` (182), `angel` → `angel` (93, one person; new type),
  `angel_fund` → `angel-network` (6). Anything else is skipped.
- **oneLiner:** tagline, else the first sentence of about, else a factual line
  ("Venture capital firm in London, 2 London rounds since 2024.").
- **website:** website, else LinkedIn, else the Dealroom page. **address:** "London" (no street
  address in the export).
- **lat/lng:** Dealroom's coordinates. 161 sit on the city centroid (Dealroom only knew "London")
  or carry a broken latitude of 1; those are fanned out on a spiral of about 1 km round the centre
  so every pin can be clicked (a `debt:` marker in the adapter). Their profile says only "London".
- **checkSizeGbp:** `cheque_min`/`cheque_max` converted at fixed rates (GBP 1, USD 0.79,
  EUR 0.85; all of this export is GBP). A floor of 0 or 1 counts as unknown. Missing floor = a
  tenth of the ceiling, missing ceiling = 10x the floor. No ticket at all (195 of 281) gets a
  default by type (`debt:` marker): VC £250k–£2m, angel £10k–£100k, angel network £25k–£250k.
- **dealsLast12m:** distinct rounds in `deals` dated in the 12 calendar months up to the export
  month (Nov 2025 to Oct 2026). `london_rounds_since_2024` covers about 22 months, so it isn't used.
- **portfolio:** company names from that investor's deals, newest first, up to 12, without
  "Undisclosed company". **partners:** that investor's `people` (name + role, "Team member" when
  the role is missing), LinkedIn when present, no sector focus.

**Stages** (matched upper-cased; the export mixes "Seed" and "SEED"):

| Dealroom                                                             | Ours       |
| -------------------------------------------------------------------- | ---------- |
| Angel, Pre-Seed                                                      | `pre-seed` |
| Seed                                                                 | `seed`     |
| Early VC, Series A                                                   | `series-a` |
| Series B                                                             | `series-b` |
| Series C, D, E, F+, Growth, Growth Equity, Growth Equity VC, Late VC | `growth`   |
| Dropped: Other (45), Media for Equity (2), Bridge (1), Debt (1)      |            |

**Sectors** (matched lower-cased). Dealroom leaves sector tags empty on most of this cohort, so 207
of 281 firms have no sector and the matcher's sector points only reach the rest.

| Dealroom                                                                                                                                                                                                                                                                    | Ours         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Generative AI, AI Safety, AI Computing Infrastructure                                                                                                                                                                                                                       | `ai`         |
| Insurance, Financial Service, Bitcoin, Climate Fintech                                                                                                                                                                                                                      | `fintech`    |
| Life sciences, Life Science, Biotechnology, Pharmaceutical, Medical / Healthcare, Medical & Healthcare, Medical Technology, Health Care, Healthcare, Health, Health Services Industry, Digital Health and Medical Technologies                                              | `healthtech` |
| Agritech                                                                                                                                                                                                                                                                    | `climate`    |
| Developer Tools, PaaS, Cloud Services                                                                                                                                                                                                                                       | `devtools`   |
| Social Media, Social, Messaging, Wellness / Beauty, Wellness, Consumer Electronics, Consumer Goods, Consumer Internet, Apparel, Wearable, Music, Video, Entertainment, Media Production, On-Demand, Retail, Travel, Accommodation, Classifieds, Sharing Economy, Mutiplayer | `consumer`   |
| SaaS, Analytics, Data Analytics, Business Intelligence, CRM, Content Management, Mobile Enterprise, Lead Generation, Adtech, Targeting, Security                                                                                                                            | `b2b-saas`   |
| Aerospace, Space Tech, Scientific                                                                                                                                                                                                                                           | `deeptech`   |

Dropped sector tags (they describe the investor, or fit no sector of ours): Techstars 501
Investors (29), B Corp (10), Automotive (8), Investing (5), Investing in Startups (3), Information
Technology, Alternative Investments, Equity Research (2 each), Platform, Social Entrepreneurship,
Crowdsourcing, Communication, Telecommunications, Capital Market, Partners (1 each).

### Dataset shape (`src/data/types.ts`)

- `Investor`: name, type, one-liner, website, address + lat/lng, stages, sectors, cheque size
  (GBP), fund size, deals in the last 12 months, portfolio, partners.
- `Partner`: name, title, LinkedIn, sector focus.
- `Review`: investor id, portfolio company, verified flag, four 1–5 scores, tags and date.

Never mix real firm names with made-up people or ratings.

## Data import (for the Make scenario)

The home page no longer reads these tables (see above). This describes the Lovable tables as they
stand, for if the Make import is picked up again.

**Access.** Everyone can read the three tables; nobody can write with the public key. Inserts and
updates only work with the **service role** key, which bypasses row security. It belongs only in
the importer (Make, or a server-side endpoint), never in the browser, the repo or a `VITE_`
variable. Note: on Lovable Cloud the service role key isn't handed out, so the import goes through a
small server endpoint in this app that holds it, with Make authenticating to that endpoint with its
own secret. That endpoint isn't built yet.

**How to write.** Upsert on `id` (insert or update the same row), investors first, then reviews
and debriefs, which reference `investors.id`. Set `source = 'dealroom'` on imported rows.
`updated_at` is set automatically on every insert and update. Once real data is in, delete the
`source = 'mock'` rows (deleting a mock investor also deletes its reviews and debriefs).

**`investors`**

| Column               | Type              | Notes                                                                                           |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `id`                 | text, primary key | Stable id, e.g. the Dealroom id                                                                 |
| `slug`               | text, unique      | URL name, e.g. `northbank-ventures`                                                             |
| `name`               | text              |                                                                                                 |
| `type`               | text              | `vc`, `cvc`, `angel-network` or `accelerator`                                                   |
| `one_liner`          | text              | Default `''`                                                                                    |
| `website`            | text              | Default `''`                                                                                    |
| `address`            | text              | Building level only, never floor or unit                                                        |
| `lat`, `lng`         | double precision  | Building coordinates                                                                            |
| `stages`             | text[]            | Any of `pre-seed`, `seed`, `series-a`, `series-b`, `growth`                                     |
| `sectors`            | text[]            | Any of `ai`, `fintech`, `healthtech`, `climate`, `devtools`, `consumer`, `b2b-saas`, `deeptech` |
| `check_size_min_gbp` | integer           | ≥ 0                                                                                             |
| `check_size_max_gbp` | integer           | ≥ min                                                                                           |
| `fund_size_gbp_m`    | numeric, nullable | Fund size in £ millions                                                                         |
| `deals_last_12m`     | integer           | Default 0                                                                                       |
| `portfolio`          | text[]            | Company names                                                                                   |
| `partners`           | jsonb array       | `[{ "id", "name", "title", "linkedinUrl"?, "focus": [sectors] }]`                               |
| `source`             | text              | Default `'mock'`; use `'dealroom'`                                                              |
| `updated_at`         | timestamptz       | Automatic                                                                                       |

**`reviews`**: `id` (text, primary key), `investor_id` (→ `investors.id`), `portfolio_company`,
`verified` (boolean), `responsiveness`, `value_add`, `fair_terms`, `founder_first` (1–5 each),
`tags` (text[]), `date` (date), `source`, `updated_at`.

**`debriefs`**: `id` (text, primary key), `investor_id` (→ `investors.id`), `outcome` (`passed`,
`follow-up`, `term-sheet`, `ghosted`), `reasons` (text[], see Meeting debriefs below),
`picky_about` (text[]), `date` (date), `source`, `updated_at`.

The database rejects values outside these lists (unknown stage, sector, type, outcome, reason,
topic, or a score outside 1–5), so map Dealroom's values onto them in Make.

**Example `investors` row** (JSON, as Make would send it):

```json
{
  "id": "dr_123456",
  "slug": "northbank-ventures",
  "name": "Northbank Ventures",
  "type": "vc",
  "one_liner": "Seed fund backing consumer and AI founders in King's Cross.",
  "website": "https://northbankventures.example",
  "address": "162 King's Cross Street, London N1C 4AG",
  "lat": 51.5367,
  "lng": -0.125,
  "stages": ["seed", "series-a"],
  "sectors": ["consumer", "ai"],
  "check_size_min_gbp": 50000,
  "check_size_max_gbp": 200000,
  "fund_size_gbp_m": 600,
  "deals_last_12m": 3,
  "portfolio": ["Heliograph", "Lumen"],
  "partners": [
    {
      "id": "p_1",
      "name": "Freya Haddad",
      "title": "General Partner",
      "linkedinUrl": "https://www.linkedin.com/",
      "focus": ["fintech"]
    }
  ],
  "source": "dealroom"
}
```

The schema and seed are in `drizzle/migrations/0000_investor_directory.sql`.

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

## Meeting debriefs (`src/lib/debriefs.ts`)

The "why they said no" questionnaire, the team's differentiation idea: founders rarely learn why
an investor passed, and no other directory collects it. After a meeting the founder records
"Add your debrief" in the firm's panel, and the panel shows "What founders heard".

- **Structured, no free text**, same as reviews. Outcome: Passed, Follow-up, Term sheet, Ghosted.
  Reasons (only for Passed or Ghosted): too early, market size, team, traction, valuation, not our
  thesis, competition, timing, no reason given. Picky about: metrics, team background, market
  sizing, tech depth, go-to-market, cap table, unit economics.
- **3+ threshold.** `MIN_DEBRIEFS_TO_SHOW = 3`: below it the firm shows only "Not enough debriefs
  yet", so a single founder can't be identified. Above it: an outcome breakdown and the top 3
  reasons and topics.
- **Browser-only storage for now.** `useDebriefs()` keeps the founder's own debriefs in
  localStorage (`raise-debriefs`); a firm shows only the browser's own (real firms carry no seeded debriefs). With
  accounts they move into the database.
- **Verification later works like reviews:** a debrief from a founder we can tie to a real meeting
  counts fully, the rest weigh less.

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
| `src/data/source.ts`                       | The single place the dataset is loaded (real Dealroom data)     |
| `src/data/from-raise.ts`                   | Adapter: Min's Dealroom export → our `Dataset`                  |
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

1. Settle the `investors` table clash between the Lovable tables and Min's migration, then decide
   whether the home page reads Supabase again.
2. Accounts and a review submission flow with portfolio verification.
3. Upcoming investor events (Luma), like londonstartupmap.
