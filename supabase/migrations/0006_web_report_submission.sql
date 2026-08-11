-- Lets the web dashboard submit incident reports too (not just review them).
-- Report numbers come from the same incident_report_seq sequence the
-- mobile app's submit_incident_report RPC uses, so numbering stays unique
-- and consistent regardless of which app filed the report. Web admins
-- don't have direct USAGE on the sequence (never granted, since only the
-- security definer mobile RPC touched it) — this wraps the same nextval()
-- call so the admin dashboard can call it too without a broader grant.
--
-- Run this in the Supabase SQL editor.

create or replace function generate_incident_report_no() returns text
language sql security definer as $$
  select 'INC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('incident_report_seq')::text, 4, '0');
$$;

revoke all on function generate_incident_report_no() from public;
grant execute on function generate_incident_report_no() to authenticated;
