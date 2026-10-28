# Raise dataset

Generated 2026-10-28T19:41:50.315Z.

London means Dealroom city id 628061 (London, United Kingdom). Other cities named London are excluded.

Eligible rows are headquartered there, have investor type `venture_capital`, `angel`, or `angel_fund`, and a last investment on or after 2024-01-01. There are 1312 eligible investors in this pull. The shipped cohort is the top 180 venture capital firms and the top 100 angels and angel funds.

Rank is London-HQ company VC rounds since 2024 (excluding Mature and Outside Tech), then total investment count, then latest round date. 3988 of 3988 scanned rounds included an investor list.

`london_rounds_since_2024` is the full count. `deals.csv` is every stored participation for the cohort. Stated ticket is Dealroom `deal_size` in GBP, not a reconstructed cheque. A ticket of 0–0 is stored as unknown. `stages` mixes `preferred_round` with the labels of those London rounds because stated stage lists are usually empty. Sectors keep taxonomy types sector, industry, sub_industry, and technology. Dealroom leaves those tags empty on most of this cohort, so the sector filter only narrows investors who have them.

News is capped at 150 recent `vc_round` articles, cohort mentions first, then other United Kingdom articles. People are the angel themselves and current team members, capped at 12 per investor. Team requests that failed: 0.

Do not commit Dealroom credentials. Re-run `node scripts/pull-raise-data.mjs` locally, then re-apply `supabase/seed.sql`. The seed upserts Dealroom columns and does not touch `investor_overrides`.

## Life sciences

Added 2026-10-28T19:52:31.215Z. 100 life-sciences investors were taken from who actually shows up on London health VC rounds since 2023 (Dealroom health industry 125403), capped at 100. 54 were new and 46 were already in the London cohort, now also tagged Life sciences. 100 startup profiles are in `data/companies.csv`. 236 health-round participations were added. New team profiles: 375.
