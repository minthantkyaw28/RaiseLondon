-- Trust hardening for the Dealroom-backed tables.
-- 1. Only Raise admins may edit investor profiles (before: any signed-in account could).
-- 2. Reviews stay hidden until the team verifies them, and are capped at 1,000 characters.
-- 3. Users can no longer mark their own review as verified.

-- Admins are added by hand in the Supabase dashboard:
--   insert into public.raise_admins (user_id) values ('<auth user id>');
create table public.raise_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.raise_admins enable row level security;

-- A signed-in user can see only their own row, which is how the app knows to show admin tools.
create policy raise_admins_self on public.raise_admins
  for select to authenticated using (auth.uid() = user_id);

grant select on public.raise_admins to authenticated;

create function public.is_raise_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.raise_admins where user_id = auth.uid());
$$;

revoke all on function public.is_raise_admin() from public;
grant execute on function public.is_raise_admin() to authenticated;

-- 1. Profile edits: admins only.
drop policy overrides_insert on public.investor_overrides;
drop policy overrides_update on public.investor_overrides;

create policy overrides_insert on public.investor_overrides
  for insert to authenticated with check (public.is_raise_admin());
create policy overrides_update on public.investor_overrides
  for update to authenticated
  using (public.is_raise_admin()) with check (public.is_raise_admin());

-- 2. Reviews: verification flag and length cap.
alter table public.investor_reviews
  add column verified boolean not null default false,
  add constraint investor_reviews_body_length check (char_length(body) between 1 and 1000);

-- 3. Users may write only their own content columns, never `verified`. The team verifies in the
-- dashboard (service role), after checking the reviewer really dealt with the investor.
revoke insert, update on public.investor_reviews from authenticated;
grant insert (user_id, investor_uuid, rating, body, relationship) on public.investor_reviews
  to authenticated;
grant update (user_id, investor_uuid, rating, body, relationship) on public.investor_reviews
  to authenticated;

-- Editing a verified review sends it back for verification.
create function public.investor_reviews_reverify()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.rating, new.body, new.relationship) is distinct from (old.rating, old.body, old.relationship)
     and auth.role() = 'authenticated' then
    new.verified := false;
  end if;
  return new;
end;
$$;

create trigger investor_reviews_reverify
  before update on public.investor_reviews
  for each row execute function public.investor_reviews_reverify();

-- The public list shows verified reviews only. Same columns, so the app query is unchanged.
create or replace view public.investor_reviews_public as
select id, investor_uuid, rating, body, relationship, created_at
from public.investor_reviews
where verified;

alter view public.investor_reviews_public set (security_invoker = false);
grant select on public.investor_reviews_public to anon, authenticated;
