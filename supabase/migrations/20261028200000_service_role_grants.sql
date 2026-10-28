-- The Dealroom import runs server-side as service_role. Row level security does not apply to
-- service_role, but it still needs table privileges, which 20261028190000_raise.sql never grants.
grant select, insert, update, delete on
  public.investors,
  public.investor_overrides,
  public.companies,
  public.deals,
  public.news,
  public.people,
  public.startup_profiles,
  public.investor_reviews,
  public.connection_imports
to service_role;

grant select on public.investor_reviews_public to service_role;
