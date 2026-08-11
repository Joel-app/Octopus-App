-- Mobile work functionality — sign-on/breaks, container & rework jobs with
-- crew pay-splitting, pay/payslip view, leave, and hazard/incident safety
-- reporting. Ported from the HTML prototype's mobile flows — draft pay
-- formula and field set, not a locked spec (see migration 0001's header
-- for the same caveat).
--
-- Run this after 0001_init.sql, in the Supabase SQL editor.

-- =========================================================================
-- Staff sessions
-- =========================================================================

-- Staff have no Supabase Auth session (PIN-only by design). This is the
-- credential every staff-facing RPC below checks instead of auth.uid().
create table staff_sessions (
  token uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

alter table staff_sessions enable row level security;
-- no policies — only security definer functions (running as the table
-- owner) touch this table; anon/authenticated get nothing directly.

create or replace function current_staff_id(p_token uuid) returns uuid
language sql stable security definer as $$
  select profile_id from staff_sessions
  where token = p_token and expires_at > now();
$$;

-- Replaces the 0001 version: same PIN check, now also mints a session.
-- Return type changed (added session_token), so the old function must be
-- dropped first — `create or replace` can't change a function's signature.
drop function if exists verify_staff_pin(text);

create or replace function verify_staff_pin(pin text)
returns table (id uuid, full_name text, role text, session_token uuid)
language plpgsql security definer as $$
declare
  v_id uuid;
  v_full_name text;
  v_role text;
  v_token uuid;
begin
  select p.id, p.full_name, p.role into v_id, v_full_name, v_role
  from profiles p
  where p.active
    and p.pin_hash is not null
    and p.pin_hash = crypt(pin, p.pin_hash)
  limit 1;

  if v_id is null then
    return;
  end if;

  insert into staff_sessions (profile_id) values (v_id) returning token into v_token;

  return query select v_id, v_full_name, v_role, v_token;
end;
$$;

revoke all on function verify_staff_pin(text) from public;
grant execute on function verify_staff_pin(text) to anon, authenticated;

-- =========================================================================
-- Jobs table: container/rework-specific columns
-- =========================================================================

alter table jobs
  add column container_number text,
  add column carton_count integer,
  add column sku_count integer,
  add column notes text,
  add column started_at timestamptz,
  add column finalised_at timestamptz,
  add column pauses jsonb not null default '[]';

alter table job_crew add constraint job_crew_unique unique (job_id, staff_id);

alter table incident_reports add column details jsonb not null default '{}';

create sequence if not exists incident_report_seq;

-- =========================================================================
-- Internal helpers (not granted to anon — only called from within other
-- security definer functions below, which run as the table owner)
-- =========================================================================

create or replace function is_shift_manager(p_staff_id uuid, p_shift_id uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from shift_assignments
    where shift_id = p_shift_id and staff_id = p_staff_id and role = 'Manager'
  );
$$;

create or replace function active_sign_on_id(p_staff_id uuid, p_shift_id uuid) returns uuid
language sql stable security definer as $$
  select id from sign_ons
  where shift_id = p_shift_id and staff_id = p_staff_id and sign_off_time is null
  order by sign_on_time desc limit 1;
$$;

-- Mirrors the prototype's resolveHourlyRateKey: role-based, with a
-- forklift-licensed Manager treated as a Forklift Operator, and a
-- <3-months/>3-months split for General Labourer by start_date.
create or replace function resolve_hourly_rate_key(p_staff_id uuid, p_shift_id uuid) returns text
language plpgsql stable security definer as $$
declare
  v_role text;
  v_start_date date;
  v_forklift_expiry date;
begin
  select sa.role into v_role from shift_assignments sa
  where sa.shift_id = p_shift_id and sa.staff_id = p_staff_id;

  select start_date into v_start_date from profiles where id = p_staff_id;
  select forklift_licence_expiry into v_forklift_expiry from staff_sensitive where profile_id = p_staff_id;

  if v_role = 'Forklift Driver' then
    return 'Forklift Operator';
  end if;
  if v_role = 'LO Driver' then
    return 'LO driver';
  end if;
  if v_role = 'Manager' and v_forklift_expiry is not null and v_forklift_expiry > current_date then
    return 'Forklift Operator';
  end if;

  if v_start_date is not null and v_start_date > (current_date - interval '3 months') then
    return 'General Labourer <3 Months';
  end if;
  return 'General Labourer >3 Months';
end;
$$;

-- Draft formula, ported from the prototype: base pay = hours * matched
-- rate, +5% flat if the person worked the shift as Manager.
create or replace function compute_hourly_pay(p_sign_on_id uuid) returns numeric
language plpgsql stable security definer as $$
declare
  v_staff_id uuid;
  v_shift_id uuid;
  v_customer_id uuid;
  v_role text;
  v_sign_on timestamptz;
  v_sign_off timestamptz;
  v_break_seconds numeric;
  v_rate_key text;
  v_pay_rate numeric;
  v_hours numeric;
  v_base_pay numeric;
begin
  select staff_id, shift_id, sign_on_time, sign_off_time
    into v_staff_id, v_shift_id, v_sign_on, v_sign_off
  from sign_ons where id = p_sign_on_id;

  if v_sign_off is null then
    return 0;
  end if;

  select coalesce(sum(extract(epoch from (coalesce(end_time, now()) - start_time))), 0)
    into v_break_seconds
  from breaks where sign_on_id = p_sign_on_id;

  select customer_id into v_customer_id from shifts where id = v_shift_id;
  select role into v_role from shift_assignments where shift_id = v_shift_id and staff_id = v_staff_id;

  v_rate_key := resolve_hourly_rate_key(v_staff_id, v_shift_id);

  select pay_rate into v_pay_rate from rate_cards
  where customer_id = v_customer_id and work_type = 'hourly' and position_or_type = v_rate_key
  limit 1;

  if v_pay_rate is null then
    return 0;
  end if;

  v_hours := (extract(epoch from (v_sign_off - v_sign_on)) - v_break_seconds) / 3600.0;
  v_base_pay := v_pay_rate * v_hours;

  if v_role = 'Manager' then
    v_base_pay := v_base_pay * 1.05; -- draft 5% manager bonus, ported from the prototype
  end if;

  return round(v_base_pay, 2);
end;
$$;

-- Draft formula, ported from the prototype: total job pay from the rate
-- card, a flat 5% bonus per manager in the crew off the top, remainder
-- split by participation_pct, independent-rounding leftover reconciled
-- onto whoever has the highest participation.
create or replace function compute_job_pay(p_job_id uuid)
returns table (staff_id uuid, amount numeric)
language plpgsql stable security definer as $$
declare
  v_shift_id uuid;
  v_customer_id uuid;
  v_job_type text;
  v_type text;
  v_size text;
  v_quantity numeric;
  v_status text;
  v_rate_pay numeric;
  v_total_pay numeric;
  v_manager_bonus_total numeric := 0;
  v_pool numeric;
  v_staff_ids uuid[] := '{}';
  v_amounts numeric[] := '{}';
  v_participations numeric[] := '{}';
  v_is_manager boolean[] := '{}';
  v_running numeric;
  v_max_idx int := 1;
  v_max_val numeric := -1;
  i int;
  r record;
begin
  select shift_id, job_type, type, size, quantity, status
    into v_shift_id, v_job_type, v_type, v_size, v_quantity, v_status
  from jobs where id = p_job_id;

  if v_status is distinct from 'finalised' then
    return;
  end if;

  select customer_id into v_customer_id from shifts where id = v_shift_id;

  if v_job_type = 'container' then
    select pay_rate into v_rate_pay from rate_cards
    where customer_id = v_customer_id and work_type = 'container'
      and position_or_type = v_type and size is not distinct from v_size
    limit 1;
    v_total_pay := coalesce(v_rate_pay, 0);
  else
    select pay_rate into v_rate_pay from rate_cards
    where customer_id = v_customer_id and work_type = 'rework' and position_or_type = v_type
    limit 1;
    v_total_pay := coalesce(v_rate_pay, 0) * coalesce(v_quantity, 0);
  end if;

  for r in
    select jc.staff_id, coalesce(jc.participation_pct, 0) as participation_pct,
      (sa.role = 'Manager') as is_manager
    from job_crew jc
    left join shift_assignments sa on sa.shift_id = v_shift_id and sa.staff_id = jc.staff_id
    where jc.job_id = p_job_id
  loop
    if r.is_manager then
      v_manager_bonus_total := v_manager_bonus_total + v_total_pay * 0.05;
    end if;
    v_staff_ids := v_staff_ids || r.staff_id;
    v_participations := v_participations || r.participation_pct;
    v_is_manager := v_is_manager || coalesce(r.is_manager, false);
  end loop;

  if coalesce(array_length(v_staff_ids, 1), 0) = 0 then
    return;
  end if;

  v_pool := v_total_pay - v_manager_bonus_total;

  for i in 1 .. array_length(v_staff_ids, 1) loop
    v_amounts := v_amounts || round(v_pool * (v_participations[i] / 100.0), 2);
    if v_participations[i] > v_max_val then
      v_max_val := v_participations[i];
      v_max_idx := i;
    end if;
  end loop;

  select sum(x) into v_running from unnest(v_amounts) x;
  v_amounts[v_max_idx] := v_amounts[v_max_idx] + (v_pool - v_running);

  for i in 1 .. array_length(v_staff_ids, 1) loop
    staff_id := v_staff_ids[i];
    amount := v_amounts[i];
    if v_is_manager[i] then
      amount := amount + round(v_total_pay * 0.05, 2);
    end if;
    return next;
  end loop;
end;
$$;

-- =========================================================================
-- Shift lookup & sign-on/break/sign-off (client-facing)
-- =========================================================================

create or replace function get_my_shift_today(p_token uuid, p_shift_type text)
returns table (shift_id uuid, customer_name text, role text, start_time time, status text)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select s.id, c.name, sa.role, s.start_time, s.status
    from shifts s
    join shift_assignments sa on sa.shift_id = s.id
    join customers c on c.id = s.customer_id
    where sa.staff_id = v_staff_id
      and s.shift_type = p_shift_type
      and s.date = current_date
    limit 1;
end;
$$;

create or replace function get_sign_on_status(p_token uuid, p_shift_id uuid)
returns table (sign_on_id uuid, sign_on_time timestamptz, sign_off_time timestamptz, breaks jsonb)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select so.id, so.sign_on_time, so.sign_off_time,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', b.id, 'start_time', b.start_time, 'end_time', b.end_time) order by b.start_time)
        from breaks b where b.sign_on_id = so.id
      ), '[]'::jsonb)
    from sign_ons so
    where so.shift_id = p_shift_id and so.staff_id = v_staff_id
    order by so.sign_on_time desc
    limit 1;
end;
$$;

create or replace function sign_on(p_token uuid, p_shift_id uuid) returns uuid
language plpgsql security definer as $$
declare v_staff_id uuid; v_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  v_id := active_sign_on_id(v_staff_id, p_shift_id);
  if v_id is not null then
    return v_id;
  end if;

  insert into sign_ons (shift_id, staff_id) values (p_shift_id, v_staff_id) returning id into v_id;
  return v_id;
end;
$$;

create or replace function start_break(p_token uuid, p_shift_id uuid) returns uuid
language plpgsql security definer as $$
declare v_staff_id uuid; v_sign_on_id uuid; v_open_break uuid; v_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  v_sign_on_id := active_sign_on_id(v_staff_id, p_shift_id);
  if v_sign_on_id is null then raise exception 'Not signed on'; end if;

  select id into v_open_break from breaks where sign_on_id = v_sign_on_id and end_time is null;
  if v_open_break is not null then
    return v_open_break;
  end if;

  insert into breaks (sign_on_id, start_time) values (v_sign_on_id, now()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function end_break(p_token uuid, p_shift_id uuid) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_sign_on_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  v_sign_on_id := active_sign_on_id(v_staff_id, p_shift_id);
  if v_sign_on_id is null then raise exception 'Not signed on'; end if;

  update breaks set end_time = now() where sign_on_id = v_sign_on_id and end_time is null;
end;
$$;

create or replace function sign_off(p_token uuid, p_shift_id uuid) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_sign_on_id uuid; v_open_break uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  v_sign_on_id := active_sign_on_id(v_staff_id, p_shift_id);
  if v_sign_on_id is null then raise exception 'Not signed on'; end if;

  select id into v_open_break from breaks where sign_on_id = v_sign_on_id and end_time is null;
  if v_open_break is not null then raise exception 'End your break first'; end if;

  update sign_ons set sign_off_time = now() where id = v_sign_on_id;
end;
$$;

revoke all on function get_my_shift_today(uuid, text) from public;
revoke all on function get_sign_on_status(uuid, uuid) from public;
revoke all on function sign_on(uuid, uuid) from public;
revoke all on function start_break(uuid, uuid) from public;
revoke all on function end_break(uuid, uuid) from public;
revoke all on function sign_off(uuid, uuid) from public;
grant execute on function get_my_shift_today(uuid, text) to anon, authenticated;
grant execute on function get_sign_on_status(uuid, uuid) to anon, authenticated;
grant execute on function sign_on(uuid, uuid) to anon, authenticated;
grant execute on function start_break(uuid, uuid) to anon, authenticated;
grant execute on function end_break(uuid, uuid) to anon, authenticated;
grant execute on function sign_off(uuid, uuid) to anon, authenticated;

-- =========================================================================
-- Container & rework jobs (client-facing)
-- =========================================================================

create or replace function get_jobs_for_shift(p_token uuid, p_shift_id uuid)
returns table (
  job_id uuid, job_type text, type text, size text, quantity numeric,
  container_number text, carton_count int, sku_count int, notes text,
  status text, started_at timestamptz, finalised_at timestamptz, pauses jsonb,
  crew jsonb, ncr jsonb
)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select j.id, j.job_type, j.type, j.size, j.quantity,
      j.container_number, j.carton_count, j.sku_count, j.notes,
      j.status, j.started_at, j.finalised_at, j.pauses,
      coalesce((
        select jsonb_agg(jsonb_build_object('staff_id', jc.staff_id, 'full_name', p.full_name, 'participation_pct', jc.participation_pct))
        from job_crew jc join profiles p on p.id = jc.staff_id
        where jc.job_id = j.id
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(jsonb_build_object('id', n.id, 'issues', n.issues, 'created_at', n.created_at) order by n.created_at)
        from ncr_reports n where n.job_id = j.id
      ), '[]'::jsonb)
    from jobs j
    where j.shift_id = p_shift_id
    order by j.created_at;
end;
$$;

create or replace function get_crew_candidates(p_token uuid, p_shift_id uuid)
returns table (staff_id uuid, full_name text, role text)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select sa.staff_id, p.full_name, sa.role
    from shift_assignments sa join profiles p on p.id = sa.staff_id
    where sa.shift_id = p_shift_id;
end;
$$;

create or replace function add_job(
  p_token uuid, p_shift_id uuid, p_job_type text, p_type text,
  p_size text default null, p_quantity numeric default null,
  p_container_number text default null, p_carton_count int default null,
  p_sku_count int default null, p_notes text default null
) returns uuid
language plpgsql security definer as $$
declare v_staff_id uuid; v_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;
  if not is_shift_manager(v_staff_id, p_shift_id) then raise exception 'Manager role required'; end if;

  insert into jobs (shift_id, job_type, type, size, quantity, container_number, carton_count, sku_count, notes)
  values (p_shift_id, p_job_type, p_type, p_size, p_quantity, p_container_number, p_carton_count, p_sku_count, p_notes)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function set_job_crew(p_token uuid, p_job_id uuid, p_staff_ids uuid[]) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_shift_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select shift_id into v_shift_id from jobs where id = p_job_id;
  if not is_shift_manager(v_staff_id, v_shift_id) then raise exception 'Manager role required'; end if;

  delete from job_crew where job_id = p_job_id;
  insert into job_crew (job_id, staff_id) select p_job_id, unnest(p_staff_ids);
end;
$$;

create or replace function start_job(p_token uuid, p_job_id uuid) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_shift_id uuid; v_crew_count int;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select shift_id into v_shift_id from jobs where id = p_job_id;
  if not is_shift_manager(v_staff_id, v_shift_id) then raise exception 'Manager role required'; end if;

  select count(*) into v_crew_count from job_crew where job_id = p_job_id;
  if v_crew_count = 0 then raise exception 'Assign crew before starting'; end if;

  update jobs set status = 'started', started_at = coalesce(started_at, now()) where id = p_job_id;
end;
$$;

create or replace function pause_job(p_token uuid, p_job_id uuid) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_shift_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select shift_id into v_shift_id from jobs where id = p_job_id;
  if not is_shift_manager(v_staff_id, v_shift_id) then raise exception 'Manager role required'; end if;

  update jobs set status = 'paused',
    pauses = pauses || jsonb_build_array(jsonb_build_object('start_time', now()))
  where id = p_job_id;
end;
$$;

create or replace function resume_job(p_token uuid, p_job_id uuid) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_shift_id uuid; v_pauses jsonb; v_last_idx int;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select shift_id, pauses into v_shift_id, v_pauses from jobs where id = p_job_id;
  if not is_shift_manager(v_staff_id, v_shift_id) then raise exception 'Manager role required'; end if;

  v_last_idx := jsonb_array_length(v_pauses) - 1;
  update jobs set status = 'started',
    pauses = case when v_last_idx >= 0
      then jsonb_set(v_pauses, array[v_last_idx::text, 'end_time'], to_jsonb(now()))
      else v_pauses
    end
  where id = p_job_id;
end;
$$;

create or replace function finalise_job(p_token uuid, p_job_id uuid, p_participation jsonb) returns void
language plpgsql security definer as $$
declare v_staff_id uuid; v_shift_id uuid; v_total numeric; v_item jsonb;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select shift_id into v_shift_id from jobs where id = p_job_id;
  if not is_shift_manager(v_staff_id, v_shift_id) then raise exception 'Manager role required'; end if;

  select sum((elem->>'participation_pct')::numeric) into v_total
  from jsonb_array_elements(p_participation) elem;

  if v_total is null or abs(v_total - 100) > 0.5 then
    raise exception 'Participation must sum to 100 (got %)', v_total;
  end if;

  for v_item in select * from jsonb_array_elements(p_participation) loop
    update job_crew set participation_pct = (v_item->>'participation_pct')::numeric
    where job_id = p_job_id and staff_id = (v_item->>'staff_id')::uuid;
  end loop;

  update jobs set status = 'finalised', finalised_at = now() where id = p_job_id;
end;
$$;

create or replace function add_ncr(p_token uuid, p_job_id uuid, p_issues text[]) returns uuid
language plpgsql security definer as $$
declare v_staff_id uuid; v_shift_id uuid; v_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select shift_id into v_shift_id from jobs where id = p_job_id;
  if not exists (select 1 from shift_assignments where shift_id = v_shift_id and staff_id = v_staff_id) then
    raise exception 'Not assigned to this shift';
  end if;

  insert into ncr_reports (job_id, issues) values (p_job_id, p_issues) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function get_jobs_for_shift(uuid, uuid) from public;
revoke all on function get_crew_candidates(uuid, uuid) from public;
revoke all on function add_job(uuid, uuid, text, text, text, numeric, text, int, int, text) from public;
revoke all on function set_job_crew(uuid, uuid, uuid[]) from public;
revoke all on function start_job(uuid, uuid) from public;
revoke all on function pause_job(uuid, uuid) from public;
revoke all on function resume_job(uuid, uuid) from public;
revoke all on function finalise_job(uuid, uuid, jsonb) from public;
revoke all on function add_ncr(uuid, uuid, text[]) from public;
grant execute on function get_jobs_for_shift(uuid, uuid) to anon, authenticated;
grant execute on function get_crew_candidates(uuid, uuid) to anon, authenticated;
grant execute on function add_job(uuid, uuid, text, text, text, numeric, text, int, int, text) to anon, authenticated;
grant execute on function set_job_crew(uuid, uuid, uuid[]) to anon, authenticated;
grant execute on function start_job(uuid, uuid) to anon, authenticated;
grant execute on function pause_job(uuid, uuid) to anon, authenticated;
grant execute on function resume_job(uuid, uuid) to anon, authenticated;
grant execute on function finalise_job(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function add_ncr(uuid, uuid, text[]) to anon, authenticated;

-- =========================================================================
-- Pay (client-facing)
-- =========================================================================

-- Computed live from sign_ons/jobs + current rate_cards, not persisted —
-- matches the prototype's own behaviour (a rate-card edit retroactively
-- changes past pay). Revisit if that turns out to be the wrong call.
create or replace function get_my_pay(p_token uuid, p_start_date date, p_end_date date)
returns table (item_date date, customer_name text, label text, amount numeric)
language plpgsql security definer as $$
declare v_staff_id uuid; r record; v_amt numeric;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  for r in
    select so.id as sign_on_id, s.date, c.name as customer_name
    from sign_ons so
    join shifts s on s.id = so.shift_id
    join customers c on c.id = s.customer_id
    where so.staff_id = v_staff_id and so.sign_off_time is not null
      and s.date between p_start_date and p_end_date
  loop
    v_amt := compute_hourly_pay(r.sign_on_id);
    if v_amt > 0 then
      item_date := r.date; customer_name := r.customer_name; label := 'Hourly'; amount := v_amt;
      return next;
    end if;
  end loop;

  for r in
    select j.id as job_id, s.date, c.name as customer_name, j.job_type, j.type
    from jobs j
    join shifts s on s.id = j.shift_id
    join customers c on c.id = s.customer_id
    join job_crew jc on jc.job_id = j.id and jc.staff_id = v_staff_id
    where j.status = 'finalised' and s.date between p_start_date and p_end_date
  loop
    select cjp.amount into v_amt from compute_job_pay(r.job_id) cjp where cjp.staff_id = v_staff_id;
    if v_amt is not null and v_amt > 0 then
      item_date := r.date; customer_name := r.customer_name;
      label := initcap(r.job_type) || ' — ' || r.type;
      amount := v_amt;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function get_my_pay(uuid, date, date) from public;
grant execute on function get_my_pay(uuid, date, date) to anon, authenticated;

-- =========================================================================
-- Leave (client-facing)
-- =========================================================================

create or replace function submit_leave_request(p_token uuid, p_type text, p_start_date date, p_end_date date) returns uuid
language plpgsql security definer as $$
declare v_staff_id uuid; v_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;
  if p_end_date < p_start_date then raise exception 'End date must be on or after start date'; end if;

  insert into leave_requests (staff_id, type, start_date, end_date)
  values (v_staff_id, p_type, p_start_date, p_end_date)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function cancel_leave_request(p_token uuid, p_leave_id uuid) returns void
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  delete from leave_requests where id = p_leave_id and staff_id = v_staff_id;
end;
$$;

create or replace function get_my_leave_requests(p_token uuid)
returns table (id uuid, type text, start_date date, end_date date, status text, created_at timestamptz)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select l.id, l.type, l.start_date, l.end_date, l.status, l.created_at
    from leave_requests l
    where l.staff_id = v_staff_id
    order by l.start_date desc;
end;
$$;

revoke all on function submit_leave_request(uuid, text, date, date) from public;
revoke all on function cancel_leave_request(uuid, uuid) from public;
revoke all on function get_my_leave_requests(uuid) from public;
grant execute on function submit_leave_request(uuid, text, date, date) to anon, authenticated;
grant execute on function cancel_leave_request(uuid, uuid) to anon, authenticated;
grant execute on function get_my_leave_requests(uuid) to anon, authenticated;

-- =========================================================================
-- Safety reporting (client-facing)
-- =========================================================================

create or replace function list_customers(p_token uuid)
returns table (id uuid, name text)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;
  return query select c.id, c.name from customers c order by c.name;
end;
$$;

create or replace function submit_hazard_report(
  p_token uuid, p_customer_id uuid, p_category text, p_description text, p_severity text
) returns uuid
language plpgsql security definer as $$
declare v_staff_id uuid; v_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  insert into hazard_reports (staff_id, customer_id, category, description, severity)
  values (v_staff_id, p_customer_id, p_category, p_description, p_severity)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function get_my_hazard_reports(p_token uuid)
returns table (id uuid, customer_name text, category text, description text, severity text, status text, created_at timestamptz)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select h.id, c.name, h.category, h.description, h.severity, h.status, h.created_at
    from hazard_reports h
    left join customers c on c.id = h.customer_id
    where h.staff_id = v_staff_id
    order by h.created_at desc;
end;
$$;

create or replace function submit_incident_report(
  p_token uuid, p_customer_id uuid, p_description text, p_details jsonb
) returns text
language plpgsql security definer as $$
declare v_staff_id uuid; v_report_no text;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  v_report_no := 'INC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('incident_report_seq')::text, 4, '0');

  insert into incident_reports (report_no, staff_id, customer_id, description, details)
  values (v_report_no, v_staff_id, p_customer_id, p_description, p_details);

  return v_report_no;
end;
$$;

create or replace function get_my_incident_reports(p_token uuid)
returns table (id uuid, report_no text, customer_name text, description text, status text, details jsonb, created_at timestamptz)
language plpgsql security definer as $$
declare v_staff_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  return query
    select i.id, i.report_no, c.name, i.description, i.status, i.details, i.created_at
    from incident_reports i
    left join customers c on c.id = i.customer_id
    where i.staff_id = v_staff_id
    order by i.created_at desc;
end;
$$;

revoke all on function list_customers(uuid) from public;
revoke all on function submit_hazard_report(uuid, uuid, text, text, text) from public;
revoke all on function get_my_hazard_reports(uuid) from public;
revoke all on function submit_incident_report(uuid, uuid, text, jsonb) from public;
revoke all on function get_my_incident_reports(uuid) from public;
grant execute on function list_customers(uuid) to anon, authenticated;
grant execute on function submit_hazard_report(uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function get_my_hazard_reports(uuid) to anon, authenticated;
grant execute on function submit_incident_report(uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function get_my_incident_reports(uuid) to anon, authenticated;
