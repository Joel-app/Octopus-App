-- Web admin dashboard support: staff creation (needs pgcrypto's crypt(),
-- only available in Postgres) and review fields for the safety queue.
--
-- Run this after 0003_rate_options.sql, in the Supabase SQL editor.

create or replace function admin_create_staff(p_full_name text, p_position text, p_pin text)
returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  -- defense in depth: RLS already keeps non-admin sessions from reaching
  -- this function in practice, but check explicitly since this function
  -- runs as the table owner and bypasses RLS internally.
  if not is_admin_or_ops() then
    raise exception 'Admin or operations role required';
  end if;

  insert into profiles (full_name, position, role, pin_hash, active)
  values (p_full_name, p_position, 'staff', crypt(p_pin, gen_salt('bf')), true)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function admin_create_staff(text, text, text) from public;
grant execute on function admin_create_staff(text, text, text) to authenticated;

alter table hazard_reports
  add column review_notes text,
  add column reviewed_by uuid references profiles (id),
  add column reviewed_at timestamptz;

alter table incident_reports
  add column review_notes text,
  add column reviewed_by uuid references profiles (id),
  add column reviewed_at timestamptz;
