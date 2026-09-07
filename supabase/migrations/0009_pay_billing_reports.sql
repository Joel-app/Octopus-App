-- Admin-facing Pays and Billing reports for the web dashboard.
--
-- Pay (what staff earn) already has a computation path for the mobile
-- app's own "my pay" screen: compute_hourly_pay/compute_job_pay (0002),
-- driven off rate_cards.pay_rate. This reuses those exact functions rather
-- than re-deriving the formula, just widened from "one staff member" to
-- "everyone" and gated to admin instead of a staff session token.
--
-- Billing (what a customer owes) is the same shape but off
-- rate_cards.charge_rate instead, and — deliberately, as a business-logic
-- call — does NOT apply the 5% manager pay bonus (that's a staff
-- incentive, not something passed through to the customer) and does NOT
-- split job charges across the crew (the customer is billed per job, not
-- per worker; compute_job_pay's crew-split is about dividing *pay*, not
-- about how the charge is derived).
--
-- Run this in the Supabase SQL editor.

create or replace function compute_hourly_charge(p_sign_on_id uuid) returns numeric
language plpgsql stable security definer as $$
declare
  v_staff_id uuid;
  v_shift_id uuid;
  v_customer_id uuid;
  v_sign_on timestamptz;
  v_sign_off timestamptz;
  v_break_seconds numeric;
  v_rate_key text;
  v_charge_rate numeric;
  v_hours numeric;
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
  v_rate_key := resolve_hourly_rate_key(v_staff_id, v_shift_id);

  select charge_rate into v_charge_rate from rate_cards
  where customer_id = v_customer_id and work_type = 'hourly' and position_or_type = v_rate_key
  limit 1;

  if v_charge_rate is null then
    return 0;
  end if;

  v_hours := (extract(epoch from (v_sign_off - v_sign_on)) - v_break_seconds) / 3600.0;
  return round(v_charge_rate * v_hours, 2);
end;
$$;

create or replace function compute_job_charge(p_job_id uuid) returns numeric
language plpgsql stable security definer as $$
declare
  v_shift_id uuid;
  v_customer_id uuid;
  v_job_type text;
  v_type text;
  v_size text;
  v_quantity numeric;
  v_status text;
  v_rate_charge numeric;
begin
  select shift_id, job_type, type, size, quantity, status
    into v_shift_id, v_job_type, v_type, v_size, v_quantity, v_status
  from jobs where id = p_job_id;

  if v_status is distinct from 'finalised' then
    return 0;
  end if;

  select customer_id into v_customer_id from shifts where id = v_shift_id;

  if v_job_type = 'container' then
    select charge_rate into v_rate_charge from rate_cards
    where customer_id = v_customer_id and work_type = 'container'
      and position_or_type = v_type and size is not distinct from v_size
    limit 1;
    return round(coalesce(v_rate_charge, 0), 2);
  else
    select charge_rate into v_rate_charge from rate_cards
    where customer_id = v_customer_id and work_type = 'rework' and position_or_type = v_type
    limit 1;
    return round(coalesce(v_rate_charge, 0) * coalesce(v_quantity, 0), 2);
  end if;
end;
$$;

create or replace function admin_get_pay_report(p_start_date date, p_end_date date)
returns table (item_date date, staff_id uuid, staff_name text, customer_name text, label text, amount numeric)
language plpgsql security definer as $$
declare r record; v_amt numeric;
begin
  if not is_admin() then
    raise exception 'Admin role required';
  end if;

  for r in
    select so.id as sign_on_id, s.date, so.staff_id, p.full_name as staff_name, c.name as customer_name
    from sign_ons so
    join shifts s on s.id = so.shift_id
    join customers c on c.id = s.customer_id
    join profiles p on p.id = so.staff_id
    where so.sign_off_time is not null and s.date between p_start_date and p_end_date
  loop
    v_amt := compute_hourly_pay(r.sign_on_id);
    if v_amt > 0 then
      item_date := r.date; staff_id := r.staff_id; staff_name := r.staff_name;
      customer_name := r.customer_name; label := 'Hourly'; amount := v_amt;
      return next;
    end if;
  end loop;

  for r in
    select j.id as job_id, s.date, c.name as customer_name, j.job_type, j.type,
      jc.staff_id, p.full_name as staff_name
    from jobs j
    join shifts s on s.id = j.shift_id
    join customers c on c.id = s.customer_id
    join job_crew jc on jc.job_id = j.id
    join profiles p on p.id = jc.staff_id
    where j.status = 'finalised' and s.date between p_start_date and p_end_date
  loop
    select cjp.amount into v_amt from compute_job_pay(r.job_id) cjp where cjp.staff_id = r.staff_id;
    if v_amt is not null and v_amt > 0 then
      item_date := r.date; staff_id := r.staff_id; staff_name := r.staff_name;
      customer_name := r.customer_name;
      label := initcap(r.job_type) || ' — ' || r.type;
      amount := v_amt;
      return next;
    end if;
  end loop;
end;
$$;

create or replace function admin_get_billing_report(p_start_date date, p_end_date date)
returns table (item_date date, customer_id uuid, customer_name text, staff_name text, label text, amount numeric)
language plpgsql security definer as $$
declare r record; v_amt numeric;
begin
  if not is_admin() then
    raise exception 'Admin role required';
  end if;

  for r in
    select so.id as sign_on_id, s.date, c.id as cust_id, c.name as customer_name, p.full_name as staff_name
    from sign_ons so
    join shifts s on s.id = so.shift_id
    join customers c on c.id = s.customer_id
    join profiles p on p.id = so.staff_id
    where so.sign_off_time is not null and s.date between p_start_date and p_end_date
  loop
    v_amt := compute_hourly_charge(r.sign_on_id);
    if v_amt > 0 then
      item_date := r.date; customer_id := r.cust_id; customer_name := r.customer_name;
      staff_name := r.staff_name; label := 'Hourly'; amount := v_amt;
      return next;
    end if;
  end loop;

  for r in
    select j.id as job_id, s.date, c.id as cust_id, c.name as customer_name, j.job_type, j.type
    from jobs j
    join shifts s on s.id = j.shift_id
    join customers c on c.id = s.customer_id
    where j.status = 'finalised' and s.date between p_start_date and p_end_date
  loop
    v_amt := compute_job_charge(r.job_id);
    if v_amt > 0 then
      item_date := r.date; customer_id := r.cust_id; customer_name := r.customer_name;
      staff_name := null;
      label := initcap(r.job_type) || ' — ' || r.type;
      amount := v_amt;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function compute_hourly_charge(uuid) from public;
revoke all on function compute_job_charge(uuid) from public;
revoke all on function admin_get_pay_report(date, date) from public;
revoke all on function admin_get_billing_report(date, date) from public;
grant execute on function admin_get_pay_report(date, date) to authenticated;
grant execute on function admin_get_billing_report(date, date) to authenticated;
