# Raise on Lovable

This repo is already a TanStack Start app. After it syncs from GitHub, wire Supabase to the files that are already here. Do not redesign the data model, do not call the Dealroom API, and do not add a Make or Integromat scenario.

## What is already in the repo

- `data/investors.csv`, `data/deals.csv`, `data/news.csv`, `data/people.csv`, and `data/companies.csv` are the source of truth. `data/README.md` records the London cohort and the life-sciences add-on.
- `supabase/migrations/20261028190000_raise.sql` creates the tables, the public review view, and the row level policies.
- `supabase/seed.sql` upserts Dealroom-owned rows. It does not delete investors and it does not write `investor_overrides`.
- `src/lib/raise` scores matches, rates a startup, and matches a LinkedIn export. Those functions do not need an LLM key.
- Routes already cover `/`, `/investors`, `/investors/$id`, `/match`, `/news`, and `/intros`. Keep file routes under `src/routes`. Do not add `src/pages` or a Next.js layout. Do not edit `src/routeTree.gen.ts` by hand. The home route must not set its own `head()`.

## What to do on Lovable

1. Link the project's Supabase database if it is not linked yet.
2. Apply `supabase/migrations/20261028190000_raise.sql` if those tables are not already there. Do not create a second set of investor tables.
3. Run `supabase/seed.sql` in the SQL editor. If a later dataset is generated locally, run the new seed the same way.
4. Enable the Email auth provider so founders can sign in.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.example`. Do not add the Dealroom client id or secret. They are not in this repo on purpose.
6. Leave the deterministic ranker in place. A written blurb can sit on top of `rankInvestors` later. Do not replace the score with a model call.

The app reads Supabase when those two env vars exist. If the investor query fails or the table is empty, it falls back to `src/lib/raise/dataset.json`.

## Tables

| Table | Who can read | Who can write |
| --- | --- | --- |
| `investors`, `companies`, `deals`, `news`, `people` | anyone | seed only |
| `investor_overrides` | anyone | signed-in users |
| `startup_profiles` | the owner | the owner |
| `investor_reviews` | the owner, on the base table | the owner |
| `investor_reviews_public` | anyone | nobody |
| `connection_imports` | the owner | the owner |

`investor_reviews_public` omits `user_id`. The view is not `security_invoker` because anonymous users have no select policy on the base table. Do not "fix" that by turning security invoker on, or public reviews disappear. A signed-in review means the account exists. It does not prove the investor funded the company.

Reseed rule: upsert the four Dealroom tables only. Never `delete from investors`, because that cascades into overrides, reviews, deals, and people.

## Map

The pages already on `/`, `/investors`, `/match`, `/news`, and `/intros` are a plain placeholder so the data and scores can be clicked through. Replace them. Do not change the scoring functions or the table names to do that. Investor cards expose `data-investor-id`, `data-lat`, and `data-lon` for the map. Startup profiles are `companies`, tagged `focus = life_sciences`. Investors in that set have `Life sciences` in `sectors`.

## Intros

`/intros` reads a LinkedIn connections CSV in the browser and compares it with `people`. It does not use the LinkedIn API. Matches are by profile URL, then by exact full name when only one person has that name.
