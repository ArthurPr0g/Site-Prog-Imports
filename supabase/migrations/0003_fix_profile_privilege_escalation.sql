-- SECURITY FIX: prevent privilege escalation via self-update on profiles.
-- The existing "profiles_update_own_or_admin" RLS policy allows a user to
-- update their own row, but RLS is row-level only — it does not restrict
-- which columns can change. Without this guard, an authenticated customer
-- could call `PATCH /profiles?id=eq.<self>` with { "role": "admin" } directly
-- against the Supabase REST API and grant themselves admin access.
--
-- This trigger silently resets `role` and `email` back to their previous
-- values on any UPDATE performed by a non-admin, regardless of what the
-- caller sent. Admins (is_admin() = true) are unaffected.

create function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute procedure public.guard_profile_privileged_columns();
