-- Run this once after 0001_init.sql, in the Supabase SQL editor.
-- Creates an admin profile with a PIN, so the mobile app's PIN sign-in has
-- someone to authenticate as. This does NOT create a Supabase Auth account
-- (no email/password web login yet) — it's PIN-only for now, same as any
-- staff profile, just with role = 'admin'.

insert into profiles (full_name, email, role, pin_hash, active)
values (
  'Joel Appleby',
  'joel@octopusls.com.au',
  'admin',
  crypt('28977860', gen_salt('bf')),
  true
);
