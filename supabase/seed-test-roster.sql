-- Run this once after 0002_mobile_work.sql, in the Supabase SQL editor.
-- Creates one test customer, minimal rate cards, and three shifts *today*
-- (one per work type) with Joel assigned as Manager — there's nothing for
-- the Work screens to attach to otherwise, since the roster-builder itself
-- isn't built yet (still a future web-admin feature).

do $$
declare
  v_joel_id uuid;
  v_customer_id uuid;
  v_hourly_shift_id uuid;
  v_container_shift_id uuid;
  v_rework_shift_id uuid;
begin
  select id into v_joel_id from profiles where email = 'joel@octopusls.com.au';
  if v_joel_id is null then
    raise exception 'Run supabase/seed-admin.sql first — no profile found for joel@octopusls.com.au';
  end if;

  insert into customers (name, address, operating_hours)
  values ('Test Customer', '{"street":"1 Test St","suburb":"Sydney","state":"NSW","postcode":"2000"}'::jsonb, '7am-5pm')
  returning id into v_customer_id;

  insert into rate_cards (customer_id, work_type, position_or_type, charge_rate, pay_rate) values
    (v_customer_id, 'hourly', 'General Labourer <3 Months', 45.00, 30.00),
    (v_customer_id, 'hourly', 'General Labourer >3 Months', 48.00, 32.00),
    (v_customer_id, 'hourly', 'Forklift Operator', 55.00, 38.00),
    (v_customer_id, 'hourly', 'LO driver', 55.00, 38.00);

  insert into rate_cards (customer_id, work_type, position_or_type, size, charge_rate, pay_rate) values
    (v_customer_id, 'container', 'Standard', '20ft', 220.00, 150.00);

  insert into rate_cards (customer_id, work_type, position_or_type, charge_rate, pay_rate) values
    (v_customer_id, 'rework', 'Repack', 8.00, 5.00);

  insert into shifts (customer_id, date, start_time, shift_type, status)
  values (v_customer_id, current_date, '07:00', 'hourly', 'confirmed')
  returning id into v_hourly_shift_id;

  insert into shifts (customer_id, date, start_time, shift_type, status)
  values (v_customer_id, current_date, '07:00', 'container', 'confirmed')
  returning id into v_container_shift_id;

  insert into shifts (customer_id, date, start_time, shift_type, status)
  values (v_customer_id, current_date, '07:00', 'rework', 'confirmed')
  returning id into v_rework_shift_id;

  insert into shift_assignments (shift_id, staff_id, role) values
    (v_hourly_shift_id, v_joel_id, 'Manager'),
    (v_container_shift_id, v_joel_id, 'Manager'),
    (v_rework_shift_id, v_joel_id, 'Manager');
end $$;
