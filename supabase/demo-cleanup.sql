-- Removes everything created by demo-seed.sql: all "DEMO ..." customers and
-- staff, and everything attached to them (rate cards, shifts, assignments,
-- sign-ons, breaks, jobs, crews, compliance records, leave, safety reports).
--
-- Only touches profiles with no web login, so it can never remove a real
-- admin account. Run in the Supabase SQL editor.

do $$
begin
  delete from hazard_reports
  where staff_id in (select id from profiles where full_name like 'DEMO %')
     or customer_id in (select id from customers where name like 'DEMO %');

  delete from incident_reports
  where staff_id in (select id from profiles where full_name like 'DEMO %')
     or customer_id in (select id from customers where name like 'DEMO %');

  -- cascades: rate_cards, shifts -> shift_assignments, sign_ons -> breaks, jobs -> job_crew
  delete from customers where name like 'DEMO %';

  -- cascades: staff_sensitive, leave_requests, any remaining assignments/sign-ons/crew rows
  delete from profiles where full_name like 'DEMO %' and auth_user_id is null;
end $$;
