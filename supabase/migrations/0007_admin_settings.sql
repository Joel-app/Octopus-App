-- Adds: remaining staff compliance fields (visa/super sub-fields the
-- prototype captures that 0001 didn't), a default-landing-tab preference,
-- and superadmin-gated admin-management RPCs (promote/demote), so granting
-- someone a web login no longer requires hand-editing the database.
--
-- Run this in the Supabase SQL editor.

alter table staff_sensitive
  add column bank_name text,
  add column gst_registered text check (gst_registered in ('Yes', 'No')),
  add column abn_lookup_link text,
  add column visa_subclass text,
  add column visa_number text,
  add column visa_notes text,
  add column super_fund_abn text,
  add column super_usi text,
  add column super_account_name text,
  add column super_fund_address jsonb;

alter table profiles
  add column default_tab text;

-- =========================================================================
-- Admin management
-- =========================================================================

create or replace function count_superadmins() returns int
language sql stable security definer as $$
  select count(*)::int from profiles where role = 'superadmin' and active;
$$;

-- Called from a Server Action after it has already created/invited the
-- person's Supabase Auth login via the admin API (needs the service role
-- key, which only exists server-side in Next.js — plain SQL can't call
-- auth.admin.inviteUserByEmail). This function only does the DB-side link:
-- attaching that new auth user id to their existing staff profile and
-- granting the role. Gated on is_superadmin() explicitly rather than
-- relying solely on the broader profiles_admin_write RLS policy, since
-- that policy currently lets any admin/operations write to profiles
-- (including role) — this is the one place role escalation should be
-- superadmin-only.
create or replace function promote_to_admin(p_staff_id uuid, p_auth_user_id uuid, p_role text)
returns void
language plpgsql security definer as $$
begin
  if not is_superadmin() then
    raise exception 'Superadmin role required';
  end if;
  if p_role not in ('admin', 'operations') then
    raise exception 'Role must be admin or operations';
  end if;

  update profiles set auth_user_id = p_auth_user_id, role = p_role where id = p_staff_id;
end;
$$;

-- Drops someone back to a plain staff profile (role='staff', auth_user_id
-- cleared — their Supabase Auth login still exists but is no longer linked
-- to anything, so it can't reach the web dashboard). Blocks removing the
-- last superadmin, same safeguard as the original prototype.
create or replace function demote_admin(p_profile_id uuid) returns void
language plpgsql security definer as $$
declare v_role text;
begin
  if not is_superadmin() then
    raise exception 'Superadmin role required';
  end if;

  select role into v_role from profiles where id = p_profile_id;

  if v_role = 'superadmin' and count_superadmins() <= 1 then
    raise exception 'Cannot remove the last superadmin';
  end if;

  update profiles set role = 'staff', auth_user_id = null where id = p_profile_id;
end;
$$;

revoke all on function count_superadmins() from public;
revoke all on function promote_to_admin(uuid, uuid, text) from public;
revoke all on function demote_admin(uuid) from public;
grant execute on function count_superadmins() to authenticated;
grant execute on function promote_to_admin(uuid, uuid, text) to authenticated;
grant execute on function demote_admin(uuid) to authenticated;
