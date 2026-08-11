-- Fixes a serious performance bug in the RLS helper functions from
-- migration 0001: is_admin_or_ops()/is_admin()/is_superadmin() were
-- security invoker, meaning their own internal query against `profiles`
-- was itself subject to profiles' RLS policies — one of which
-- (profiles_admin_select) calls these same functions again. This worked
-- fine as long as every query only ever touched the caller's own profile
-- row (satisfied directly by profiles_self_select, no recursion needed).
-- The moment a query selects OTHER people's profile rows too — e.g. the
-- web dashboard's Roster/Staff pages listing all staff — those rows can
-- only be authorized via profiles_admin_select, which recurses into the
-- same expensive check again and again. In practice this showed up as
-- roster page loads taking 90+ seconds instead of milliseconds.
--
-- Fix: make these SECURITY DEFINER so their internal profiles lookup
-- bypasses RLS entirely — safe, since the check itself doesn't depend on
-- RLS and was never meant to recurse into it.
--
-- Run this in the Supabase SQL editor.

create or replace function is_admin_or_ops() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from profiles
    where auth_user_id = auth.uid() and role in ('superadmin', 'admin', 'operations') and active
  );
$$;

create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from profiles
    where auth_user_id = auth.uid() and role in ('superadmin', 'admin') and active
  );
$$;

create or replace function is_superadmin() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from profiles
    where auth_user_id = auth.uid() and role = 'superadmin' and active
  );
$$;
