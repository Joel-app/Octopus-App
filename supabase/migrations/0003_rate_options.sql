-- Lets the mobile app populate a dropdown of valid container/rework
-- type+size combos from the customer's actual rate cards, instead of free
-- text — a typo there meant compute_job_pay found no matching rate and pay
-- silently came out as $0 (and get_my_pay filters out zero-amount rows, so
-- it just looked like nothing happened).
--
-- Run this after 0002_mobile_work.sql, in the Supabase SQL editor.

create or replace function get_rate_options(p_token uuid, p_shift_id uuid, p_job_type text)
returns table (position_or_type text, size text)
language plpgsql security definer as $$
declare v_staff_id uuid; v_customer_id uuid;
begin
  v_staff_id := current_staff_id(p_token);
  if v_staff_id is null then raise exception 'Invalid or expired session'; end if;

  select customer_id into v_customer_id from shifts where id = p_shift_id;

  return query
    select rc.position_or_type, rc.size
    from rate_cards rc
    where rc.customer_id = v_customer_id and rc.work_type = p_job_type
    order by rc.position_or_type, rc.size;
end;
$$;

revoke all on function get_rate_options(uuid, uuid, text) from public;
grant execute on function get_rate_options(uuid, uuid, text) to anon, authenticated;
