-- Investor directory: investors, founder reviews and meeting debriefs.
-- Public read for everyone; writes only through the service role (Make import).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.investors (
  id text primary key,
  slug text not null unique,
  name text not null,
  type text not null check (type = any (array['vc','cvc','angel-network','accelerator']::text[])),
  one_liner text not null default '',
  website text not null default '',
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  stages text[] not null default '{}' check (stages <@ array['pre-seed','seed','series-a','series-b','growth']::text[]),
  sectors text[] not null default '{}' check (sectors <@ array['ai','fintech','healthtech','climate','devtools','consumer','b2b-saas','deeptech']::text[]),
  check_size_min_gbp integer not null check (check_size_min_gbp >= 0),
  check_size_max_gbp integer not null check (check_size_max_gbp >= check_size_min_gbp),
  fund_size_gbp_m numeric check (fund_size_gbp_m >= 0),
  deals_last_12m integer not null default 0 check (deals_last_12m >= 0),
  portfolio text[] not null default '{}',
  partners jsonb not null default '[]'::jsonb check (jsonb_typeof(partners) = 'array'),
  source text not null default 'mock',
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id text primary key,
  investor_id text not null references public.investors(id) on delete cascade,
  portfolio_company text not null,
  verified boolean not null default false,
  responsiveness smallint not null check (responsiveness between 1 and 5),
  value_add smallint not null check (value_add between 1 and 5),
  fair_terms smallint not null check (fair_terms between 1 and 5),
  founder_first smallint not null check (founder_first between 1 and 5),
  tags text[] not null default '{}',
  date date not null,
  source text not null default 'mock',
  updated_at timestamptz not null default now()
);

create table public.debriefs (
  id text primary key,
  investor_id text not null references public.investors(id) on delete cascade,
  outcome text not null check (outcome = any (array['passed','follow-up','term-sheet','ghosted']::text[])),
  reasons text[] not null default '{}' check (reasons <@ array['too-early','market-size','team','traction','valuation','not-our-thesis','competition','timing','no-reason-given']::text[]),
  picky_about text[] not null default '{}' check (picky_about <@ array['metrics','team-background','market-sizing','tech-depth','go-to-market','cap-table','unit-economics']::text[]),
  date date not null,
  source text not null default 'mock',
  updated_at timestamptz not null default now()
);

create index reviews_investor_id_idx on public.reviews (investor_id);
create index debriefs_investor_id_idx on public.debriefs (investor_id);

grant select on public.investors, public.reviews, public.debriefs to anon, authenticated;
grant all on public.investors, public.reviews, public.debriefs to service_role;

alter table public.investors enable row level security;
alter table public.reviews enable row level security;
alter table public.debriefs enable row level security;

create policy "Anyone can read investors" on public.investors for select to anon, authenticated using (true);
create policy "Anyone can read reviews" on public.reviews for select to anon, authenticated using (true);
create policy "Anyone can read debriefs" on public.debriefs for select to anon, authenticated using (true);

create trigger investors_set_updated_at before update on public.investors
  for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger debriefs_set_updated_at before update on public.debriefs
  for each row execute function public.set_updated_at();

-- Seed: the bundled mock dataset (fictional firms at real London locations).
insert into public.investors (id, slug, name, type, one_liner, website, address, lat, lng, stages, sectors, check_size_min_gbp, check_size_max_gbp, fund_size_gbp_m, deals_last_12m, portfolio, partners, source) values
  ('inv_1', 'northbank-ventures', 'Northbank Ventures', 'accelerator', 'Seed fund backing consumer and AI founders in King''s Cross.', 'https://northbankventures.example', '162 King''s Cross Street, London N1C 4AG', 51.536738516759875, -0.12499030361175538, array['seed','series-a','series-b']::text[], array['consumer','ai','fintech','healthtech']::text[], 50000, 200000, 600, 3, array['Heliograph','Lumen','Haddock','Gridwise','Parcelry','Stonefruit']::text[], '[{"id": "p_1", "name": "Freya Haddad", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "fintech"]}, {"id": "p_2", "name": "Ravi Haddad", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer"]}]'::jsonb, 'mock'),
  ('inv_2', 'thames-ridge-capital', 'Thames Ridge Capital', 'vc', 'Series A fund backing healthtech and B2B SaaS founders in Shoreditch.', 'https://thamesridgecapital.example', '106 Shoreditch Street, London EC2A 3AY', 51.52428906974792, -0.07499551544189453, array['series-a','series-b','growth']::text[], array['healthtech','b2b-saas','fintech']::text[], 50000, 200000, 600, 30, array['Stonefruit','Haddock','Gridwise','Driftwood AI','Parcelry']::text[], '[{"id": "p_3", "name": "Mei Okafor", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}, {"id": "p_4", "name": "Freya Novak", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "b2b-saas"]}, {"id": "p_5", "name": "Amara Kaur", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech", "b2b-saas"]}, {"id": "p_6", "name": "Amara Whitfield", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "fintech"]}]'::jsonb, 'mock'),
  ('inv_3', 'lantern-seed', 'Lantern Seed', 'vc', 'Pre-seed fund backing deep tech and climate founders in Mayfair.', 'https://lanternseed.example', '144 Mayfair Street, London W1K 2PE', 51.51123193869591, -0.14858069057464598, array['pre-seed','seed']::text[], array['deeptech','climate']::text[], 500000, 2000000, 50, 14, array['Parcelry','Fernly','Orbitly','Gridwise','Mintbridge']::text[], '[{"id": "p_7", "name": "Ben Rossi", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_8", "name": "Chloe Novak", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech", "climate"]}, {"id": "p_9", "name": "Sam Ward", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_10", "name": "Sofia Ward", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}]'::jsonb, 'mock'),
  ('inv_4', 'fleet-street-partners', 'Fleet Street Partners', 'vc', 'Seed fund backing consumer and dev tools founders in Soho.', 'https://fleetstreetpartners.example', '162 Soho Street, London W1F 9JR', 51.51170450577735, -0.13849163126945496, array['seed','series-a']::text[], array['consumer','devtools']::text[], 100000, 1000000, 50, 13, array['Lumen','Heliograph','Kiln','Stonefruit','Fernly','Driftwood AI']::text[], '[{"id": "p_11", "name": "Leila Okafor", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer", "devtools"]}, {"id": "p_12", "name": "Marcus Adeyemi", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer", "devtools"]}, {"id": "p_13", "name": "Priya Fraser", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer", "devtools"]}]'::jsonb, 'mock'),
  ('inv_5', 'ravenhill-vc', 'Ravenhill VC', 'accelerator', 'Pre-seed fund backing AI and deep tech founders in Fitzrovia.', 'https://ravenhillvc.example', '81 Fitzrovia Street, London W1T 3JH', 51.51750726242066, -0.1328897946834564, array['pre-seed','seed']::text[], array['ai','deeptech','devtools','fintech']::text[], 1000000, 10000000, 50, 31, array['Kiln','Parcelry','Pebble Health','Stonefruit','Ledgerlark','Brightloop']::text[], '[{"id": "p_14", "name": "Freya Okafor", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_15", "name": "Elena Doyle", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech", "fintech"]}, {"id": "p_16", "name": "Zara Moreau", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai", "devtools"]}, {"id": "p_17", "name": "Zara Ward", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai", "deeptech"]}]'::jsonb, 'mock'),
  ('inv_6', 'copperline-capital', 'Copperline Capital', 'angel-network', 'Seed fund backing deep tech and AI founders in Clerkenwell.', 'https://copperlinecapital.example', '35 Clerkenwell Street, London EC1M 6EB', 51.52248986252546, -0.10816297283172607, array['seed','series-a']::text[], array['deeptech','ai','consumer','climate']::text[], 250000, 1000000, 300, 20, array['Parcelry','Kiln','Ledgerlark','Wayfold','Pebble Health']::text[], '[{"id": "p_18", "name": "Sam Bennett", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_19", "name": "Jonah Rossi", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer", "deeptech"]}, {"id": "p_20", "name": "Theo Okafor", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate", "ai"]}]'::jsonb, 'mock'),
  ('inv_7', 'hollow-oak-ventures', 'Hollow Oak Ventures', 'vc', 'Seed fund backing deep tech and fintech founders in Old Street.', 'https://hollowoakventures.example', '51 Old Street Street, London EC1V 9NR', 51.5277621804595, -0.08883509063720703, array['seed','series-a']::text[], array['deeptech','fintech']::text[], 500000, 2500000, 600, 29, array['Wayfold','Gridwise','Cairnly','Parcelry','Quillstack','Kiln']::text[], '[{"id": "p_21", "name": "Priya Kaur", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}, {"id": "p_22", "name": "Isla Okafor", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}]'::jsonb, 'mock'),
  ('inv_8', 'brick-lane-capital', 'Brick Lane Capital', 'vc', 'Series A fund backing fintech and AI founders in Covent Garden.', 'https://bricklanecapital.example', '153 Covent Garden Street, London WC2E 8RF', 51.51326300115585, -0.12475101280212403, array['series-a','series-b']::text[], array['fintech','ai']::text[], 3000000, 30000000, 600, 21, array['Mintbridge','Lumen','Pebble Health','Tessel']::text[], '[{"id": "p_23", "name": "Sam Ellis", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai", "fintech"]}, {"id": "p_24", "name": "Sam Reyes", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech", "ai"]}, {"id": "p_25", "name": "Elena Kaur", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech", "ai"]}, {"id": "p_26", "name": "Zara Hughes", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech", "ai"]}]'::jsonb, 'mock'),
  ('inv_9', 'saffron-hill-partners', 'Saffron Hill Partners', 'vc', 'Pre-seed fund backing deep tech and B2B SaaS founders in St James''s.', 'https://saffronhillpartners.example', '59 St James''s Street, London SW1Y 4LR', 51.50713607935905, -0.13460456523895264, array['pre-seed','seed']::text[], array['deeptech','b2b-saas','climate','ai']::text[], 50000, 200000, 25, 5, array['Pebble Health','Tessel','Vellum']::text[], '[{"id": "p_27", "name": "Sam Mensah", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_28", "name": "Isla Lin", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "deeptech"]}, {"id": "p_29", "name": "Oliver Ellis", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate"]}]'::jsonb, 'mock'),
  ('inv_10', 'kestrel-fund', 'Kestrel Fund', 'vc', 'Series A fund backing healthtech and deep tech founders in Marylebone.', 'https://kestrelfund.example', '108 Marylebone Street, London W1U 6TQ', 51.51699408516883, -0.14917770762443544, array['series-a','series-b']::text[], array['healthtech','deeptech','devtools']::text[], 100000, 400000, 80, 20, array['Kiln','Mintbridge','Gridwise','Driftwood AI','Ledgerlark','Lumen']::text[], '[{"id": "p_30", "name": "Elena Ellis", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_31", "name": "Oliver Novak", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech", "devtools"]}]'::jsonb, 'mock'),
  ('inv_11', 'primrose-ventures', 'Primrose Ventures', 'vc', 'Series A fund backing fintech and healthtech founders in Notting Hill.', 'https://primroseventures.example', '127 Notting Hill Street, London W11 2PJ', 51.51281215071678, -0.20699169955253602, array['series-a','series-b']::text[], array['fintech','healthtech']::text[], 50000, 500000, 25, 15, array['Driftwood AI','Quillstack','Kiln','Gridwise','Pebble Health']::text[], '[{"id": "p_32", "name": "Sofia Lin", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech"]}, {"id": "p_33", "name": "Jonah Doyle", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "fintech"]}, {"id": "p_34", "name": "Leila Whitfield", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "fintech"]}, {"id": "p_35", "name": "Elena Ellis", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech", "healthtech"]}]'::jsonb, 'mock'),
  ('inv_12', 'wharf-co', 'Wharf & Co', 'vc', 'Seed fund backing dev tools and AI founders in Canary Wharf.', 'https://wharfco.example', '128 Canary Wharf Street, London E14 5AB', 51.50419669237137, -0.02699296760559082, array['seed','series-a','series-b']::text[], array['devtools','ai']::text[], 3000000, 12000000, 50, 16, array['Orbitly','Driftwood AI','Parcelry','Quillstack']::text[], '[{"id": "p_36", "name": "Tom Moreau", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai", "devtools"]}, {"id": "p_37", "name": "Priya Lin", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai"]}, {"id": "p_38", "name": "Priya Hughes", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["devtools"]}, {"id": "p_39", "name": "Elena Clarke", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai"]}]'::jsonb, 'mock'),
  ('inv_13', 'ironmonger-capital', 'Ironmonger Capital', 'angel-network', 'Pre-seed fund backing deep tech and AI founders in Farringdon.', 'https://ironmongercapital.example', '139 Farringdon Street, London EC1M 3HE', 51.52013997726441, -0.103001904296875, array['pre-seed','seed']::text[], array['deeptech','ai','healthtech']::text[], 50000, 500000, 25, 7, array['Driftwood AI','Heliograph','Cairnly']::text[], '[{"id": "p_40", "name": "Theo Ellis", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech", "ai"]}, {"id": "p_41", "name": "Isla Moreau", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai"]}, {"id": "p_42", "name": "Sofia Bennett", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech", "healthtech"]}]'::jsonb, 'mock'),
  ('inv_14', 'bloomsbury-seed', 'Bloomsbury Seed', 'vc', 'Pre-seed fund backing AI and fintech founders in Southwark.', 'https://bloomsburyseed.example', '15 Southwark Street, London SE1 9PG', 51.506972692513465, -0.0932573299407959, array['pre-seed','seed']::text[], array['ai','fintech','consumer','climate']::text[], 3000000, 12000000, 80, 2, array['Pebble Health','Lumen','Stonefruit','Ledgerlark','Haddock']::text[], '[{"id": "p_43", "name": "Isla Ellis", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer", "ai"]}, {"id": "p_44", "name": "Priya Ellis", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai"]}, {"id": "p_45", "name": "Mei Whitfield", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer"]}, {"id": "p_46", "name": "Amara Adeyemi", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai"]}]'::jsonb, 'mock'),
  ('inv_15', 'tideway-ventures', 'Tideway Ventures', 'vc', 'Seed fund backing B2B SaaS and fintech founders in Liverpool Street.', 'https://tidewayventures.example', '154 Liverpool Street Street, London EC2M 7PY', 51.51633607749939, -0.0829293472290039, array['seed','series-a','series-b']::text[], array['b2b-saas','fintech','healthtech']::text[], 1000000, 5000000, 600, 23, array['Nimbleo','Vellum','Gridwise','Wayfold']::text[], '[{"id": "p_47", "name": "Isla Whitfield", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "fintech"]}, {"id": "p_48", "name": "Hannah Mensah", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "fintech"]}]'::jsonb, 'mock'),
  ('inv_16', 'granary-capital', 'Granary Capital', 'angel-network', 'Series A fund backing consumer and AI founders in Hoxton.', 'https://granarycapital.example', '37 Hoxton Street, London N1 6PB', 51.52990791796446, -0.07871424121856689, array['series-a','series-b','growth']::text[], array['consumer','ai','devtools']::text[], 1000000, 5000000, 50, 4, array['Wayfold','Orbitly','Ledgerlark']::text[], '[{"id": "p_49", "name": "Oliver Reyes", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["devtools"]}, {"id": "p_50", "name": "Theo Moreau", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["devtools", "ai"]}, {"id": "p_51", "name": "Ben Moreau", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer"]}]'::jsonb, 'mock'),
  ('inv_17', 'albion-fund', 'Albion Fund', 'accelerator', 'Pre-seed fund backing healthtech and consumer founders in King''s Cross.', 'https://albionfund.example', '178 King''s Cross Street, London N1C 4AG', 51.53516846747399, -0.1281629873275757, array['pre-seed','seed']::text[], array['healthtech','consumer','b2b-saas']::text[], 100000, 400000, 600, 23, array['Mintbridge','Driftwood AI','Parcelry','Vellum']::text[], '[{"id": "p_52", "name": "Daniel Fraser", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas"]}, {"id": "p_53", "name": "Tom Rossi", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "b2b-saas"]}, {"id": "p_54", "name": "Chloe Okafor", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer", "b2b-saas"]}]'::jsonb, 'mock'),
  ('inv_18', 'meridian-square-vc', 'Meridian Square VC', 'cvc', 'Pre-seed fund backing fintech and B2B SaaS founders in Shoreditch.', 'https://meridiansquarevc.example', '74 Shoreditch Street, London EC2A 3AY', 51.52440551767349, -0.08151217994689942, array['pre-seed','seed','series-a']::text[], array['fintech','b2b-saas','deeptech']::text[], 50000, 250000, 150, 15, array['Quillstack','Driftwood AI','Gridwise']::text[], '[{"id": "p_55", "name": "Theo Bennett", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_56", "name": "Ben Bennett", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}, {"id": "p_57", "name": "Tom Clarke", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas"]}]'::jsonb, 'mock'),
  ('inv_19', 'paddington-ventures', 'Paddington Ventures', 'accelerator', 'Seed fund backing healthtech and consumer founders in Mayfair.', 'https://paddingtonventures.example', '184 Mayfair Street, London W1K 2PE', 51.511405391788486, -0.14598203773498536, array['seed','series-a']::text[], array['healthtech','consumer','fintech','devtools']::text[], 1000000, 4000000, 25, 8, array['Tessel','Orbitly','Pebble Health','Gridwise','Fernly','Lumen']::text[], '[{"id": "p_58", "name": "Amara Doyle", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer"]}, {"id": "p_59", "name": "Theo Patel", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}, {"id": "p_60", "name": "Hannah Fraser", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech"]}]'::jsonb, 'mock'),
  ('inv_20', 'little-venice-capital', 'Little Venice Capital', 'vc', 'Series A fund backing B2B SaaS and consumer founders in Soho.', 'https://littlevenicecapital.example', '115 Soho Street, London W1F 9JR', 51.511803972816466, -0.13845030570030215, array['series-a','series-b']::text[], array['b2b-saas','consumer']::text[], 500000, 2500000, 300, 11, array['Lumen','Nimbleo','Ledgerlark']::text[], '[{"id": "p_61", "name": "Arjun Mensah", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer"]}, {"id": "p_62", "name": "Oliver Mensah", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas"]}, {"id": "p_63", "name": "Mei Rossi", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "consumer"]}, {"id": "p_64", "name": "Kofi Mensah", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "consumer"]}]'::jsonb, 'mock'),
  ('inv_21', 'mercer-labs', 'Mercer Labs', 'angel-network', 'Pre-seed fund backing deep tech and B2B SaaS founders in Fitzrovia.', 'https://mercerlabs.example', '46 Fitzrovia Street, London W1T 3JH', 51.51722347487212, -0.13309952748417855, array['pre-seed','seed']::text[], array['deeptech','b2b-saas']::text[], 250000, 2500000, 50, 29, array['Lumen','Ledgerlark','Kiln','Pebble Health']::text[], '[{"id": "p_65", "name": "Hannah Rossi", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["deeptech"]}, {"id": "p_66", "name": "Chloe Patel", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas"]}]'::jsonb, 'mock'),
  ('inv_22', 'highgate-growth', 'Highgate Growth', 'cvc', 'Seed fund backing consumer and healthtech founders in Clerkenwell.', 'https://highgategrowth.example', '84 Clerkenwell Street, London EC1M 6EB', 51.522309319639206, -0.1046444257736206, array['seed','series-a','series-b']::text[], array['consumer','healthtech','climate']::text[], 250000, 1000000, 80, 19, array['Driftwood AI','Wayfold','Lumen']::text[], '[{"id": "p_67", "name": "Kwame Ellis", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "consumer"]}, {"id": "p_68", "name": "Freya Kaur", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "climate"]}, {"id": "p_69", "name": "Tom Hughes", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate", "consumer"]}]'::jsonb, 'mock'),
  ('inv_23', 'borough-angels', 'Borough Angels', 'cvc', 'Seed fund backing climate and fintech founders in Old Street.', 'https://boroughangels.example', '87 Old Street Street, London EC1V 9NR', 51.52304916496277, -0.08958667731285094, array['seed','series-a','series-b']::text[], array['climate','fintech','healthtech']::text[], 3000000, 12000000, 80, 26, array['Gridwise','Orbitly','Stonefruit','Pebble Health']::text[], '[{"id": "p_70", "name": "Freya Hughes", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech"]}, {"id": "p_71", "name": "Arjun Adeyemi", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate"]}, {"id": "p_72", "name": "Daniel Moreau", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate"]}]'::jsonb, 'mock'),
  ('inv_24', 'sterling-pier-ventures', 'Sterling Pier Ventures', 'vc', 'Series A fund backing AI and fintech founders in Covent Garden.', 'https://sterlingpierventures.example', '83 Covent Garden Street, London WC2E 8RF', 51.511442293357845, -0.12713496017456055, array['series-a','series-b']::text[], array['ai','fintech','consumer','deeptech']::text[], 1000000, 5000000, 80, 8, array['Gridwise','Driftwood AI','Lumen']::text[], '[{"id": "p_73", "name": "Leila Patel", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}, {"id": "p_74", "name": "Chloe Ellis", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai", "deeptech"]}, {"id": "p_75", "name": "Isla Clarke", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai", "deeptech"]}]'::jsonb, 'mock'),
  ('inv_25', 'foundry-row-capital', 'Foundry Row Capital', 'vc', 'Series A fund backing AI and consumer founders in St James''s.', 'https://foundryrowcapital.example', '132 St James''s Street, London SW1Y 4LR', 51.506671877670286, -0.14034930572509766, array['series-a','series-b','growth']::text[], array['ai','consumer','deeptech','b2b-saas']::text[], 100000, 1000000, 80, 7, array['Cairnly','Mintbridge','Kiln']::text[], '[{"id": "p_76", "name": "Ben Shah", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["consumer"]}, {"id": "p_77", "name": "Chloe Adeyemi", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas"]}, {"id": "p_78", "name": "Amara Hughes", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas"]}]'::jsonb, 'mock'),
  ('inv_26', 'quayside-partners', 'Quayside Partners', 'angel-network', 'Pre-seed fund backing climate and AI founders in Marylebone.', 'https://quaysidepartners.example', '121 Marylebone Street, London W1U 6TQ', 51.5189191037178, -0.149589497756958, array['pre-seed','seed','series-a']::text[], array['climate','ai','fintech']::text[], 1000000, 4000000, 50, 7, array['Mintbridge','Lumen','Cairnly','Stonefruit']::text[], '[{"id": "p_79", "name": "Theo Fraser", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["ai"]}, {"id": "p_80", "name": "Chloe Ellis", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["fintech"]}]'::jsonb, 'mock'),
  ('inv_27', 'cobalt-bridge-vc', 'Cobalt Bridge VC', 'vc', 'Series A fund backing B2B SaaS and healthtech founders in Notting Hill.', 'https://cobaltbridgevc.example', '52 Notting Hill Street, London W11 2PJ', 51.513022538363934, -0.2043358937263489, array['series-a','series-b','growth']::text[], array['b2b-saas','healthtech','climate']::text[], 250000, 2500000, 25, 6, array['Mintbridge','Orbitly','Pebble Health','Driftwood AI','Haddock']::text[], '[{"id": "p_81", "name": "Zara Bennett", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate"]}, {"id": "p_82", "name": "Oliver Novak", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["healthtech", "b2b-saas"]}]'::jsonb, 'mock'),
  ('inv_28', 'larkspur-ventures', 'Larkspur Ventures', 'cvc', 'Series A fund backing dev tools and climate founders in Canary Wharf.', 'https://larkspurventures.example', '23 Canary Wharf Street, London E14 5AB', 51.50777334674597, -0.02637104606628418, array['series-a','series-b','growth']::text[], array['devtools','climate','deeptech','b2b-saas']::text[], 3000000, 15000000, 600, 29, array['Brightloop','Nimbleo','Gridwise']::text[], '[{"id": "p_83", "name": "Mei Reyes", "title": "General Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "devtools"]}, {"id": "p_84", "name": "Zara Shah", "title": "Partner", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate", "devtools"]}, {"id": "p_85", "name": "Daniel Ward", "title": "Principal", "linkedinUrl": "https://www.linkedin.com/", "focus": ["climate"]}, {"id": "p_86", "name": "Freya Adeyemi", "title": "Investment Manager", "linkedinUrl": "https://www.linkedin.com/", "focus": ["b2b-saas", "devtools"]}]'::jsonb, 'mock');

insert into public.reviews (id, investor_id, portfolio_company, verified, responsiveness, value_add, fair_terms, founder_first, tags, date, source) values
  ('r_1', 'inv_2', 'Driftwood AI', true, 5, 5, 5, 4, array['Founder-friendly terms','Replies in 24h']::text[], '2026-06-08', 'mock'),
  ('r_2', 'inv_2', 'Driftwood AI', true, 4, 4, 4, 5, array['Helped hire']::text[], '2026-09-10', 'mock'),
  ('r_3', 'inv_2', 'Gridwise', true, 4, 4, 5, 4, array['Pushes for board seat']::text[], '2026-04-12', 'mock'),
  ('r_4', 'inv_2', 'Stonefruit', true, 5, 4, 4, 5, array['Founder-friendly terms','Slow to wire']::text[], '2026-08-21', 'mock'),
  ('r_5', 'inv_2', 'Stonefruit', true, 4, 5, 4, 4, array['Pushes for board seat','Replies in 24h']::text[], '2026-03-09', 'mock'),
  ('r_6', 'inv_3', 'Parcelry', true, 4, 3, 3, 3, array['Pushes for board seat']::text[], '2026-03-01', 'mock'),
  ('r_7', 'inv_3', 'Mintbridge', true, 3, 4, 4, 3, array['Slow to wire','Hands-off']::text[], '2026-06-19', 'mock'),
  ('r_8', 'inv_3', 'Fernly', false, 3, 4, 4, 4, array['Ghosted after IC']::text[], '2026-06-25', 'mock'),
  ('r_9', 'inv_3', 'Parcelry', false, 3, 3, 4, 4, array['Founder-friendly terms']::text[], '2026-03-12', 'mock'),
  ('r_10', 'inv_3', 'Mintbridge', true, 3, 3, 4, 3, array['Slow to wire','Pushes for board seat']::text[], '2026-09-04', 'mock'),
  ('r_11', 'inv_4', 'Lumen', false, 2, 2, 2, 1, array['Ghosted after IC','Replies in 24h']::text[], '2026-08-22', 'mock'),
  ('r_12', 'inv_4', 'Stonefruit', true, 3, 2, 2, 1, array['Replies in 24h']::text[], '2026-09-17', 'mock'),
  ('r_13', 'inv_4', 'Driftwood AI', true, 2, 3, 2, 2, array['Great intros','Helped hire']::text[], '2026-07-14', 'mock'),
  ('r_14', 'inv_4', 'Stonefruit', true, 2, 2, 2, 1, array['Hands-off']::text[], '2026-08-13', 'mock'),
  ('r_15', 'inv_5', 'Stonefruit', true, 3, 2, 2, 2, array['Pushes for board seat']::text[], '2026-08-01', 'mock'),
  ('r_16', 'inv_6', 'Kiln', true, 2, 4, 3, 2, array['Helped hire','Slow to wire']::text[], '2026-07-18', 'mock'),
  ('r_17', 'inv_6', 'Kiln', true, 4, 3, 4, 4, array['Helped hire']::text[], '2026-06-05', 'mock'),
  ('r_18', 'inv_6', 'Pebble Health', true, 3, 3, 3, 3, array['Great intros','Hands-off']::text[], '2026-02-17', 'mock'),
  ('r_19', 'inv_6', 'Ledgerlark', false, 3, 3, 4, 4, array['Founder-friendly terms']::text[], '2026-07-10', 'mock'),
  ('r_20', 'inv_7', 'Parcelry', true, 4, 3, 4, 4, array['Slow to wire','Pushes for board seat']::text[], '2026-09-14', 'mock'),
  ('r_21', 'inv_8', 'Mintbridge', true, 4, 4, 5, 5, array['Hands-off']::text[], '2026-06-24', 'mock'),
  ('r_22', 'inv_8', 'Lumen', true, 4, 5, 5, 4, array['Slow to wire']::text[], '2026-06-07', 'mock'),
  ('r_23', 'inv_8', 'Lumen', true, 4, 4, 4, 4, array['Supportive in down round','Pushes for board seat']::text[], '2026-05-26', 'mock'),
  ('r_24', 'inv_8', 'Pebble Health', true, 5, 5, 4, 4, array['Replies in 24h','Pushes for board seat']::text[], '2026-04-20', 'mock'),
  ('r_25', 'inv_9', 'Pebble Health', true, 5, 4, 4, 3, array['Pushes for board seat']::text[], '2026-01-18', 'mock'),
  ('r_26', 'inv_9', 'Vellum', true, 4, 5, 4, 5, array['Pushes for board seat']::text[], '2026-09-08', 'mock'),
  ('r_27', 'inv_9', 'Vellum', false, 4, 4, 4, 5, array['Slow to wire','Great intros']::text[], '2026-04-16', 'mock'),
  ('r_28', 'inv_10', 'Kiln', true, 4, 3, 4, 3, array['Hands-off','Helped hire']::text[], '2026-01-19', 'mock'),
  ('r_29', 'inv_10', 'Ledgerlark', true, 4, 3, 4, 3, array['Helped hire','Replies in 24h']::text[], '2026-01-18', 'mock'),
  ('r_30', 'inv_11', 'Pebble Health', true, 1, 1, 2, 2, array['Pushes for board seat']::text[], '2026-08-14', 'mock'),
  ('r_31', 'inv_11', 'Pebble Health', false, 3, 2, 2, 3, array['Supportive in down round','Slow to wire']::text[], '2026-05-04', 'mock'),
  ('r_32', 'inv_11', 'Gridwise', true, 1, 2, 3, 2, array['Hands-off','Replies in 24h']::text[], '2026-09-07', 'mock'),
  ('r_33', 'inv_11', 'Gridwise', true, 3, 1, 3, 3, array['Pushes for board seat','Supportive in down round']::text[], '2026-02-27', 'mock'),
  ('r_34', 'inv_11', 'Pebble Health', true, 1, 3, 3, 1, array['Ghosted after IC']::text[], '2026-09-07', 'mock'),
  ('r_35', 'inv_12', 'Orbitly', false, 3, 3, 2, 2, array['Supportive in down round']::text[], '2026-09-22', 'mock'),
  ('r_36', 'inv_12', 'Driftwood AI', true, 2, 2, 2, 2, array['Pushes for board seat']::text[], '2026-07-08', 'mock'),
  ('r_37', 'inv_12', 'Parcelry', true, 2, 1, 2, 2, array['Great intros']::text[], '2026-01-08', 'mock'),
  ('r_38', 'inv_12', 'Orbitly', false, 2, 1, 2, 3, array['Replies in 24h','Hands-off']::text[], '2026-07-11', 'mock'),
  ('r_39', 'inv_12', 'Parcelry', true, 2, 3, 2, 2, array['Replies in 24h','Slow to wire']::text[], '2026-02-14', 'mock'),
  ('r_40', 'inv_13', 'Cairnly', true, 4, 4, 4, 3, array['Slow to wire']::text[], '2026-01-01', 'mock'),
  ('r_41', 'inv_13', 'Heliograph', false, 3, 4, 5, 3, array['Pushes for board seat']::text[], '2026-08-22', 'mock'),
  ('r_42', 'inv_14', 'Pebble Health', false, 3, 3, 3, 4, array['Slow to wire']::text[], '2026-09-19', 'mock'),
  ('r_43', 'inv_14', 'Lumen', true, 3, 3, 4, 3, array['Supportive in down round']::text[], '2026-03-08', 'mock'),
  ('r_44', 'inv_15', 'Wayfold', true, 3, 5, 4, 5, array['Replies in 24h','Helped hire']::text[], '2026-04-04', 'mock'),
  ('r_45', 'inv_16', 'Ledgerlark', true, 4, 2, 3, 2, array['Slow to wire']::text[], '2026-01-26', 'mock'),
  ('r_46', 'inv_16', 'Wayfold', false, 3, 3, 2, 2, array['Replies in 24h','Founder-friendly terms']::text[], '2026-02-22', 'mock'),
  ('r_47', 'inv_16', 'Ledgerlark', false, 3, 2, 3, 3, array['Supportive in down round']::text[], '2026-06-21', 'mock'),
  ('r_48', 'inv_16', 'Wayfold', false, 3, 2, 2, 3, array['Replies in 24h']::text[], '2026-03-14', 'mock'),
  ('r_49', 'inv_17', 'Mintbridge', true, 3, 4, 4, 4, array['Pushes for board seat']::text[], '2026-06-15', 'mock'),
  ('r_50', 'inv_17', 'Driftwood AI', true, 4, 4, 4, 3, array['Slow to wire','Founder-friendly terms']::text[], '2026-08-18', 'mock'),
  ('r_51', 'inv_17', 'Driftwood AI', true, 3, 4, 3, 5, array['Ghosted after IC']::text[], '2026-06-20', 'mock'),
  ('r_52', 'inv_17', 'Mintbridge', true, 5, 3, 3, 4, array['Pushes for board seat']::text[], '2026-04-22', 'mock'),
  ('r_53', 'inv_18', 'Gridwise', false, 3, 4, 3, 4, array['Hands-off','Supportive in down round']::text[], '2026-01-24', 'mock'),
  ('r_54', 'inv_18', 'Quillstack', false, 3, 3, 4, 4, array['Replies in 24h','Slow to wire']::text[], '2026-03-03', 'mock'),
  ('r_55', 'inv_18', 'Driftwood AI', false, 5, 5, 4, 3, array['Pushes for board seat','Replies in 24h']::text[], '2026-03-02', 'mock'),
  ('r_56', 'inv_18', 'Quillstack', true, 5, 3, 3, 3, array['Replies in 24h','Hands-off']::text[], '2026-08-03', 'mock'),
  ('r_57', 'inv_18', 'Quillstack', true, 4, 4, 5, 4, array['Great intros']::text[], '2026-07-04', 'mock'),
  ('r_58', 'inv_19', 'Gridwise', true, 5, 5, 5, 5, array['Replies in 24h','Hands-off']::text[], '2026-08-11', 'mock'),
  ('r_59', 'inv_20', 'Ledgerlark', true, 3, 3, 3, 3, array['Replies in 24h','Great intros']::text[], '2026-07-27', 'mock'),
  ('r_60', 'inv_20', 'Nimbleo', false, 3, 2, 3, 2, array['Great intros','Pushes for board seat']::text[], '2026-04-08', 'mock'),
  ('r_61', 'inv_20', 'Lumen', true, 3, 4, 2, 3, array['Replies in 24h','Hands-off']::text[], '2026-07-03', 'mock'),
  ('r_62', 'inv_21', 'Kiln', false, 3, 4, 4, 3, array['Founder-friendly terms','Supportive in down round']::text[], '2026-02-22', 'mock'),
  ('r_63', 'inv_21', 'Ledgerlark', true, 3, 3, 3, 2, array['Pushes for board seat','Great intros']::text[], '2026-02-14', 'mock'),
  ('r_64', 'inv_21', 'Lumen', true, 4, 3, 4, 4, array['Slow to wire','Replies in 24h']::text[], '2026-08-03', 'mock'),
  ('r_65', 'inv_24', 'Lumen', true, 5, 5, 5, 5, array['Helped hire']::text[], '2026-09-05', 'mock'),
  ('r_66', 'inv_24', 'Lumen', false, 4, 5, 4, 4, array['Slow to wire','Founder-friendly terms']::text[], '2026-04-11', 'mock'),
  ('r_67', 'inv_24', 'Lumen', true, 5, 4, 3, 4, array['Replies in 24h']::text[], '2026-03-25', 'mock'),
  ('r_68', 'inv_25', 'Mintbridge', true, 3, 3, 3, 3, array['Great intros','Pushes for board seat']::text[], '2026-04-19', 'mock'),
  ('r_69', 'inv_25', 'Cairnly', true, 3, 3, 3, 4, array['Ghosted after IC']::text[], '2026-06-25', 'mock'),
  ('r_70', 'inv_26', 'Cairnly', true, 1, 1, 2, 2, array['Ghosted after IC']::text[], '2026-07-14', 'mock'),
  ('r_71', 'inv_27', 'Orbitly', false, 4, 2, 4, 4, array['Pushes for board seat','Hands-off']::text[], '2026-07-11', 'mock'),
  ('r_72', 'inv_27', 'Mintbridge', true, 3, 3, 4, 4, array['Replies in 24h']::text[], '2026-05-23', 'mock'),
  ('r_73', 'inv_27', 'Orbitly', true, 2, 3, 3, 3, array['Replies in 24h','Hands-off']::text[], '2026-08-24', 'mock'),
  ('r_74', 'inv_28', 'Brightloop', true, 3, 2, 3, 1, array['Great intros']::text[], '2026-01-27', 'mock'),
  ('r_75', 'inv_28', 'Gridwise', false, 3, 2, 2, 2, array['Helped hire']::text[], '2026-01-13', 'mock'),
  ('r_76', 'inv_28', 'Gridwise', true, 3, 2, 3, 3, array['Hands-off']::text[], '2026-08-03', 'mock');

insert into public.debriefs (id, investor_id, outcome, reasons, picky_about, date, source) values
  ('d_1', 'inv_1', 'follow-up', '{}'::text[], array['tech-depth','go-to-market']::text[], '2026-03-02', 'mock'),
  ('d_2', 'inv_3', 'ghosted', array['traction']::text[], array['market-sizing']::text[], '2026-01-11', 'mock'),
  ('d_3', 'inv_3', 'ghosted', array['traction']::text[], array['market-sizing','tech-depth','go-to-market']::text[], '2026-02-16', 'mock'),
  ('d_4', 'inv_3', 'passed', array['traction']::text[], array['team-background','go-to-market']::text[], '2026-03-15', 'mock'),
  ('d_5', 'inv_3', 'term-sheet', '{}'::text[], array['metrics','team-background','market-sizing']::text[], '2026-04-21', 'mock'),
  ('d_6', 'inv_3', 'passed', array['timing']::text[], array['metrics','market-sizing','go-to-market']::text[], '2026-05-13', 'mock'),
  ('d_7', 'inv_4', 'passed', array['too-early','valuation','timing']::text[], array['metrics']::text[], '2026-08-12', 'mock'),
  ('d_8', 'inv_6', 'passed', array['valuation']::text[], array['cap-table','unit-economics']::text[], '2026-05-19', 'mock'),
  ('d_9', 'inv_6', 'ghosted', array['no-reason-given']::text[], array['market-sizing','unit-economics']::text[], '2026-07-10', 'mock'),
  ('d_10', 'inv_6', 'passed', array['valuation','not-our-thesis']::text[], array['cap-table']::text[], '2026-10-06', 'mock'),
  ('d_11', 'inv_8', 'passed', array['competition']::text[], array['team-background','market-sizing']::text[], '2026-06-07', 'mock'),
  ('d_12', 'inv_9', 'term-sheet', '{}'::text[], array['go-to-market']::text[], '2026-01-20', 'mock'),
  ('d_13', 'inv_9', 'follow-up', '{}'::text[], array['market-sizing','go-to-market']::text[], '2026-05-05', 'mock'),
  ('d_14', 'inv_10', 'ghosted', array['no-reason-given']::text[], array['market-sizing','tech-depth']::text[], '2026-01-12', 'mock'),
  ('d_15', 'inv_10', 'term-sheet', '{}'::text[], array['go-to-market']::text[], '2026-08-28', 'mock'),
  ('d_16', 'inv_11', 'follow-up', '{}'::text[], array['team-background']::text[], '2026-03-22', 'mock'),
  ('d_17', 'inv_11', 'passed', array['not-our-thesis','timing']::text[], array['team-background','unit-economics']::text[], '2026-04-22', 'mock'),
  ('d_18', 'inv_11', 'passed', array['competition','timing']::text[], array['team-background']::text[], '2026-10-21', 'mock'),
  ('d_19', 'inv_12', 'ghosted', array['no-reason-given']::text[], array['market-sizing','tech-depth','cap-table']::text[], '2026-01-06', 'mock'),
  ('d_20', 'inv_12', 'follow-up', '{}'::text[], array['market-sizing']::text[], '2026-03-10', 'mock'),
  ('d_21', 'inv_13', 'follow-up', '{}'::text[], array['tech-depth','go-to-market']::text[], '2026-03-08', 'mock'),
  ('d_22', 'inv_14', 'passed', array['team']::text[], array['metrics','go-to-market']::text[], '2026-07-07', 'mock'),
  ('d_23', 'inv_14', 'passed', array['not-our-thesis']::text[], array['team-background']::text[], '2026-08-04', 'mock'),
  ('d_24', 'inv_14', 'ghosted', array['team']::text[], array['team-background','go-to-market']::text[], '2026-10-09', 'mock'),
  ('d_25', 'inv_14', 'passed', array['market-size','team']::text[], array['team-background','go-to-market']::text[], '2026-10-25', 'mock'),
  ('d_26', 'inv_15', 'passed', array['timing']::text[], array['market-sizing','tech-depth']::text[], '2026-02-15', 'mock'),
  ('d_27', 'inv_17', 'passed', array['too-early','traction']::text[], array['team-background']::text[], '2026-02-09', 'mock'),
  ('d_28', 'inv_17', 'passed', array['too-early']::text[], array['go-to-market']::text[], '2026-03-07', 'mock'),
  ('d_29', 'inv_17', 'passed', array['too-early','market-size']::text[], array['tech-depth']::text[], '2026-04-03', 'mock'),
  ('d_30', 'inv_21', 'follow-up', '{}'::text[], array['cap-table']::text[], '2026-01-26', 'mock'),
  ('d_31', 'inv_21', 'passed', array['market-size','competition']::text[], array['team-background']::text[], '2026-02-11', 'mock'),
  ('d_32', 'inv_21', 'follow-up', '{}'::text[], array['cap-table']::text[], '2026-08-17', 'mock'),
  ('d_33', 'inv_22', 'ghosted', array['not-our-thesis']::text[], array['market-sizing']::text[], '2026-01-02', 'mock'),
  ('d_34', 'inv_22', 'term-sheet', '{}'::text[], array['market-sizing']::text[], '2026-04-27', 'mock'),
  ('d_35', 'inv_22', 'passed', array['competition']::text[], array['metrics','team-background','market-sizing']::text[], '2026-08-12', 'mock'),
  ('d_36', 'inv_28', 'follow-up', '{}'::text[], array['market-sizing']::text[], '2026-01-09', 'mock'),
  ('d_37', 'inv_28', 'passed', array['not-our-thesis','timing']::text[], array['cap-table']::text[], '2026-05-11', 'mock'),
  ('d_38', 'inv_28', 'passed', array['too-early','competition','timing']::text[], array['market-sizing']::text[], '2026-07-04', 'mock'),
  ('d_39', 'inv_28', 'term-sheet', '{}'::text[], array['cap-table']::text[], '2026-07-13', 'mock'),
  ('d_40', 'inv_28', 'ghosted', array['no-reason-given']::text[], array['cap-table','unit-economics']::text[], '2026-07-27', 'mock');