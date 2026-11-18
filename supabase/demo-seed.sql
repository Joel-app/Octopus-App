-- DEMO DATA — fake customers, staff and a week of work so the Dashboard has
-- something to show. Everything it creates is named "DEMO ..." and is removed
-- by supabase/demo-cleanup.sql.
--
-- WARNING: this app has one database shared by local development and the
-- live site. Until you run the cleanup, the demo customers, staff and shifts
-- appear everywhere — including Customer Invoicing, Staff Pays and their
-- Excel exports.
--
-- Creates: 3 customers (with rate cards), 12 staff (with compliance records),
-- hourly + container shifts for the previous 7 days (no Sundays) with
-- sign-ons, a few no-shows and late arrivals, finalised containers and two
-- rework jobs, 4 hazard reports + 1 incident, 3 leave requests, and a few
-- upcoming shifts (one container shift with no Manager).
--
-- Run in the Supabase SQL editor. Safe to re-run only after the cleanup.

do $$
declare
  v_tz text := 'Australia/Sydney';
  v_today date := (now() at time zone 'Australia/Sydney')::date;
  c_harbour uuid;
  c_westgate uuid;
  c_eastern uuid;
  s uuid[] := '{}';
  v_id uuid;
  v_shift uuid;
  v_sign uuid;
  v_job uuid;
  v_start timestamptz;
  v_on timestamptz;
  v_off timestamptz;
  d date;
  i int;
  k int;
  r record;
  v_names text[] := array['Alex Nguyen', 'Sam Patel', 'Jordan Lee', 'Taylor Smith', 'Chris Walker', 'Morgan Brown',
                          'Riley Chen', 'Jamie Wilson', 'Casey Martin', 'Drew Thompson', 'Avery Kim', 'Quinn Roberts'];
  v_positions text[] := array['General Labourer', 'General Labourer', 'Forklift Operator', 'LO driver', 'General Labourer',
                              'Forklift Operator', 'General Labourer', 'General Labourer', 'Forklift Operator',
                              'General Labourer', 'General Labourer', 'General Labourer'];
begin
  if exists (select 1 from customers where name like 'DEMO %') then
    raise exception 'Demo data is already loaded. Run supabase/demo-cleanup.sql first.';
  end if;

  perform setseed(0.42); -- same "random" week every time

  -- Customers + rate cards -------------------------------------------------
  insert into customers (name, address, operating_hours)
  values ('DEMO Harbour Logistics', '{"street":"1 Wharf Rd","suburb":"Port Botany","state":"NSW","postcode":"2036"}', '6am-4pm')
  returning id into c_harbour;
  insert into customers (name, address, operating_hours)
  values ('DEMO Westgate DC', '{"street":"40 Westgate Dr","suburb":"Wetherill Park","state":"NSW","postcode":"2164"}', '7am-5pm')
  returning id into c_westgate;
  insert into customers (name, address, operating_hours)
  values ('DEMO Eastern Creek Warehouse', '{"street":"9 Old Wallgrove Rd","suburb":"Eastern Creek","state":"NSW","postcode":"2766"}', '7am-6pm')
  returning id into c_eastern;

  insert into rate_cards (customer_id, work_type, position_or_type, size, charge_rate, pay_rate)
  select c.id, rc.work_type, rc.position_or_type, rc.size, rc.charge_rate, rc.pay_rate
  from (values (c_harbour), (c_westgate), (c_eastern)) as c(id)
  cross join (values
    ('hourly', 'General Labourer <3 Months', null::text, 48.00, 30.00),
    ('hourly', 'General Labourer >3 Months', null::text, 50.00, 32.00),
    ('hourly', 'Forklift Operator', null::text, 56.00, 36.00),
    ('hourly', 'LO driver', null::text, 60.00, 38.00),
    ('container', 'Unpack', '20ft', 420.00, 260.00),
    ('container', 'Unpack', '40ft', 650.00, 420.00),
    ('rework', 'Relabel', null::text, 0.60, 0.35)
  ) as rc(work_type, position_or_type, size, charge_rate, pay_rate);

  -- Staff (no PIN, no web login) + compliance records ------------------------
  for i in 1..12 loop
    insert into profiles (full_name, role, position, start_date, active)
    values ('DEMO ' || v_names[i], 'staff', v_positions[i],
            v_today - case when i in (5, 10, 11) then 30 else 400 end, true)
    returning id into v_id;
    s := s || v_id;

    insert into staff_sensitive (
      profile_id, address, bank_name, bank_account_name, bank_bsb_encrypted, bank_account_number_encrypted,
      tax_type, tfn_encrypted, abn, visa_status, visa_expiry, forklift_licence_expiry, lo_licence_expiry
    ) values (
      v_id,
      case when i in (7, 12) then null
           else jsonb_build_object('street', i || ' Demo St', 'suburb', 'Parramatta', 'state', 'NSW', 'postcode', '2150') end,
      case when i = 10 then null else 'Demo Bank' end,
      case when i = 10 then null else 'DEMO ' || v_names[i] end,
      case when i = 10 then null else encrypt_sensitive('062000') end,
      case when i = 10 then null else encrypt_sensitive('1234' || lpad(i::text, 4, '0')) end,
      case when i = 11 then null when i in (2, 5, 8, 12) then 'ABN' else 'TFN' end,
      case when i in (1, 3, 4, 6, 7, 9, 10) then encrypt_sensitive('123456782') end,
      case when i in (2, 5, 8, 12) then '510000000' || lpad(i::text, 2, '0') end,
      case when i = 7 then 'No' else 'Yes' end,
      case when i = 7 then v_today + 30 end,                       -- visa expiring
      case i when 3 then v_today + 200 when 6 then v_today + 20    -- forklift: valid, expiring,
             when 9 then v_today - 5 end,                          --   and already expired
      case when i = 4 then v_today + 45 end                        -- LO licence expiring
    );
  end loop;

  -- The past week -----------------------------------------------------------
  for d in select generate_series(v_today - 7, v_today - 1, interval '1 day')::date loop
    continue when extract(dow from d) = 0; -- no Sunday work

    -- Hourly: Harbour 06:00 (4 staff), Westgate 07:00 (3 staff)
    insert into shifts (customer_id, date, start_time, shift_type, status)
    values (c_harbour, d, '06:00', 'hourly', 'confirmed') returning id into v_shift;
    insert into shift_assignments (shift_id, staff_id, role) values
      (v_shift, s[1], 'General Hand'), (v_shift, s[2], 'General Hand'),
      (v_shift, s[3], 'Forklift Driver'), (v_shift, s[4], 'LO Driver');

    insert into shifts (customer_id, date, start_time, shift_type, status)
    values (c_westgate, d, '07:00', 'hourly', 'confirmed') returning id into v_shift;
    insert into shift_assignments (shift_id, staff_id, role) values
      (v_shift, s[5], 'General Hand'), (v_shift, s[7], 'General Hand'), (v_shift, s[10], 'General Hand');

    -- Sign-ons for the day's hourly shifts: ~6% no-shows, ~12% late.
    for r in
      select sh.id as shift_id, sh.date, sh.start_time, sa.staff_id
      from shifts sh join shift_assignments sa on sa.shift_id = sh.id
      where sh.date = d and sh.shift_type = 'hourly' and sh.customer_id in (c_harbour, c_westgate)
    loop
      continue when random() < 0.06;
      v_start := (r.date + r.start_time) at time zone v_tz;
      if random() < 0.12 then
        v_on := v_start + make_interval(mins => 8 + floor(random() * 15)::int);
      else
        v_on := v_start + make_interval(mins => -10 + floor(random() * 13)::int);
      end if;
      v_off := v_on + make_interval(mins => 450 + floor(random() * 90)::int);
      insert into sign_ons (shift_id, staff_id, sign_on_time, sign_off_time)
      values (r.shift_id, r.staff_id, v_on, v_off) returning id into v_sign;
      insert into breaks (sign_on_id, start_time, end_time)
      values (v_sign, v_on + interval '4 hours', v_on + interval '4 hours 30 minutes');
    end loop;

    -- Container: Eastern Creek 07:00 (Manager + 2), 3-5 containers, rework Tue/Fri
    insert into shifts (customer_id, date, start_time, shift_type, status)
    values (c_eastern, d, '07:00', 'container', 'confirmed') returning id into v_shift;
    insert into shift_assignments (shift_id, staff_id, role) values
      (v_shift, s[6], 'Manager'), (v_shift, s[11], 'General Hand'), (v_shift, s[12], 'General Hand');
    v_on := (d + time '07:15') at time zone v_tz;
    for k in 1..(3 + floor(random() * 3)::int) loop
      insert into jobs (shift_id, job_type, type, size, container_number, status, started_at, finalised_at)
      values (v_shift, 'container', 'Unpack', case when random() < 0.6 then '40ft' else '20ft' end,
              'DEMO' || (100000 + floor(random() * 900000))::int, 'finalised',
              v_on, v_on + make_interval(mins => 80 + floor(random() * 70)::int))
      returning id, finalised_at into v_job, v_off;
      insert into job_crew (job_id, staff_id, participation_pct)
      values (v_job, s[6], 34), (v_job, s[11], 33), (v_job, s[12], 33);
      v_on := v_off + interval '10 minutes';
    end loop;
    if extract(dow from d) in (2, 5) then
      insert into jobs (shift_id, job_type, type, quantity, status, started_at, finalised_at)
      values (v_shift, 'rework', 'Relabel', 600 + floor(random() * 400), 'finalised', v_on, v_on + interval '2 hours')
      returning id into v_job;
      insert into job_crew (job_id, staff_id, participation_pct)
      values (v_job, s[6], 34), (v_job, s[11], 33), (v_job, s[12], 33);
    end if;

    -- Container: Westgate 08:00 (Manager + 1), 2-3 containers
    insert into shifts (customer_id, date, start_time, shift_type, status)
    values (c_westgate, d, '08:00', 'container', 'confirmed') returning id into v_shift;
    insert into shift_assignments (shift_id, staff_id, role) values
      (v_shift, s[9], 'Manager'), (v_shift, s[8], 'General Hand');
    v_on := (d + time '08:15') at time zone v_tz;
    for k in 1..(2 + floor(random() * 2)::int) loop
      insert into jobs (shift_id, job_type, type, size, container_number, status, started_at, finalised_at)
      values (v_shift, 'container', 'Unpack', case when random() < 0.5 then '40ft' else '20ft' end,
              'DEMO' || (100000 + floor(random() * 900000))::int, 'finalised',
              v_on, v_on + make_interval(mins => 100 + floor(random() * 80)::int))
      returning id, finalised_at into v_job, v_off;
      insert into job_crew (job_id, staff_id, participation_pct)
      values (v_job, s[9], 50), (v_job, s[8], 50);
      v_on := v_off + interval '10 minutes';
    end loop;
  end loop;

  -- Safety reports ------------------------------------------------------------
  insert into hazard_reports (staff_id, customer_id, category, description, severity, status, created_at) values
    (s[1], c_harbour, 'Slip/trip hazard', 'DEMO: Loose shrink-wrap on the floor near dock 3.', 'Medium', 'open',
     (v_today - 2 + time '10:15') at time zone v_tz),
    (s[5], c_westgate, 'Manual handling', 'DEMO: Heavy cartons stacked above shoulder height.', 'High', 'in_review',
     (v_today - 4 + time '09:30') at time zone v_tz),
    (s[11], c_eastern, 'Equipment/machinery', 'DEMO: Pallet jack wheel damaged.', 'Low', 'resolved',
     (v_today - 6 + time '14:05') at time zone v_tz),
    (s[3], c_harbour, 'Electrical', 'DEMO: Exposed cable at the forklift charging station.', 'Critical', 'open',
     (v_today - 1 + time '07:45') at time zone v_tz);

  insert into incident_reports (report_no, staff_id, customer_id, description, status, details, created_at)
  values ('DEMO-INC-0001', s[12], c_eastern, 'DEMO: Minor hand cut while removing strapping.', 'in_review',
          jsonb_build_object('incidentType', 'Injury', 'potentialSeverity', 'Medium', 'firstAidGiven', 'Yes',
                             'injuredPersonName', 'DEMO Quinn Roberts', 'taskActivity', 'Unpacking 40ft container'),
          (v_today - 3 + time '13:40') at time zone v_tz);

  -- Leave -------------------------------------------------------------------
  insert into leave_requests (staff_id, type, start_date, end_date, status) values
    (s[2], 'Annual', v_today + 2, v_today + 4, 'approved'),
    (s[7], 'Sick', v_today + 1, v_today + 1, 'approved'),
    (s[10], 'Annual', v_today + 10, v_today + 14, 'pending');

  -- A few upcoming shifts, so the Roster & leave tab has something --------------
  for d in select generate_series(v_today + 1, v_today + 3, interval '1 day')::date loop
    continue when extract(dow from d) = 0;
    insert into shifts (customer_id, date, start_time, shift_type, status)
    values (c_harbour, d, '06:00', 'hourly', 'confirmed') returning id into v_shift;
    insert into shift_assignments (shift_id, staff_id, role) values
      (v_shift, s[1], 'General Hand'), (v_shift, s[3], 'Forklift Driver'), (v_shift, s[4], 'LO Driver');

    insert into shifts (customer_id, date, start_time, shift_type, status)
    values (c_eastern, d, '07:00', 'container', 'draft') returning id into v_shift;
    if d = v_today + 2 then
      -- deliberately no Manager, so it shows up as needing one
      insert into shift_assignments (shift_id, staff_id, role) values (v_shift, s[11], 'General Hand');
    else
      insert into shift_assignments (shift_id, staff_id, role) values
        (v_shift, s[6], 'Manager'), (v_shift, s[11], 'General Hand');
    end if;
  end loop;
end $$;
