-- Raise schema. Dealroom-owned columns live on investors, deals, news, and people.
-- investor_overrides holds founder edits and must survive a reseed.
-- supabase/seed.sql upserts Dealroom columns only. It must not delete from investors
-- and must not insert into investor_overrides.

create table public.investors (
  uuid text primary key,
  name text not null,
  investor_type text not null,
  investor_types text not null default '',
  record_type text not null default 'organization',
  tagline text,
  about text,
  website text,
  linkedin text,
  image text,
  dealroom_url text,
  hq_city text,
  hq_country text,
  lat double precision,
  lon double precision,
  cheque_min bigint,
  cheque_max bigint,
  cheque_currency text not null default 'USD',
  preferred_round text,
  stages text not null default '',
  stage_mix text not null default '',
  sectors text not null default '',
  last_round_date text,
  investments_count integer not null default 0,
  london_rounds_since_2024 integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.investor_overrides (
  investor_uuid text primary key references public.investors (uuid) on delete cascade,
  thesis text,
  cheque_min bigint,
  cheque_max bigint,
  stages text,
  sectors text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.companies (
  uuid text primary key,
  name text not null,
  tagline text,
  about text,
  website text,
  linkedin text,
  image text,
  dealroom_url text,
  hq_city text,
  hq_country text,
  lat double precision,
  lon double precision,
  sectors text not null default '',
  launch_year text,
  employees text,
  total_funding bigint,
  focus text not null default 'life_sciences'
);

create table public.deals (
  id text primary key,
  transaction_id text not null,
  investor_uuid text not null references public.investors (uuid) on delete cascade,
  company_uuid text,
  company_name text,
  round_year integer,
  round_month integer,
  standardized_round text,
  round_type text,
  amount bigint,
  currency text,
  is_lead boolean,
  source_url text
);

create index deals_investor_idx on public.deals (investor_uuid);

create table public.news (
  id text primary key,
  title text not null,
  summary text,
  url text,
  published_at timestamptz,
  article_type text,
  amount bigint,
  sector text,
  hq_country text,
  related_investor_uuids text not null default ''
);

create index news_published_idx on public.news (published_at desc);

create table public.people (
  id text primary key,
  person_uuid text,
  investor_uuid text not null references public.investors (uuid) on delete cascade,
  name text not null,
  role text,
  linkedin text,
  image text
);

create index people_investor_idx on public.people (investor_uuid);

create table public.startup_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  description text,
  sector text,
  stage text,
  raise_amount bigint,
  currency text default 'GBP',
  lois integer,
  pre_orders integer,
  arr bigint,
  mrr bigint,
  traction_notes text,
  updated_at timestamptz not null default now()
);

create table public.investor_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  investor_uuid text not null references public.investors (uuid) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  relationship text not null check (relationship in ('pitched', 'invested', 'passed')),
  created_at timestamptz not null default now(),
  unique (user_id, investor_uuid)
);

-- Public reads use this view so user_id never leaves the database.
-- security_invoker stays off on purpose: anon has no select policy on the base
-- table, and the view owner is what makes the anonymous columns readable.
create view public.investor_reviews_public as
select id, investor_uuid, rating, body, relationship, created_at
from public.investor_reviews;

alter view public.investor_reviews_public set (security_invoker = false);

create table public.connection_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  company text,
  linkedin text,
  created_at timestamptz not null default now()
);

create index connection_imports_user_idx on public.connection_imports (user_id);

alter table public.investors enable row level security;
alter table public.investor_overrides enable row level security;
alter table public.companies enable row level security;
alter table public.deals enable row level security;
alter table public.news enable row level security;
alter table public.people enable row level security;
alter table public.startup_profiles enable row level security;
alter table public.investor_reviews enable row level security;
alter table public.connection_imports enable row level security;

create policy investors_read on public.investors
  for select to anon, authenticated using (true);

create policy companies_read on public.companies
  for select to anon, authenticated using (true);

create policy deals_read on public.deals
  for select to anon, authenticated using (true);

create policy news_read on public.news
  for select to anon, authenticated using (true);

create policy people_read on public.people
  for select to anon, authenticated using (true);

create policy overrides_read on public.investor_overrides
  for select to anon, authenticated using (true);

create policy overrides_insert on public.investor_overrides
  for insert to authenticated with check (true);

create policy overrides_update on public.investor_overrides
  for update to authenticated using (true) with check (true);

create policy startup_own on public.startup_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy reviews_own on public.investor_reviews
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy connections_own on public.connection_imports
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.investors, public.companies, public.deals, public.news, public.people, public.investor_overrides to anon, authenticated;
grant insert, update on public.investor_overrides to authenticated;
grant select, insert, update, delete on public.startup_profiles to authenticated;
grant select, insert, update, delete on public.investor_reviews to authenticated;
grant select on public.investor_reviews_public to anon, authenticated;
grant select, insert, update, delete on public.connection_imports to authenticated;
