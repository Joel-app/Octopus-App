# Workforce App

Web dashboard + mobile app for rostering staff across sites, tracking work, safety reporting, and leave.

## Structure

- `web/` — Next.js admin dashboard (roster, daily view, safety review, leave approval)
- `mobile/` — Expo app for team members (sign-on, work logging, safety reports, leave requests)
- `packages/shared` — shared TypeScript types + Supabase client factory
- `supabase/migrations/` — database schema (Postgres, run via the Supabase SQL editor or CLI)

## Setup

1. Install dependencies:
   ```
   pnpm install
   ```
2. Create a free project at [supabase.com](https://supabase.com).
3. In the Supabase SQL editor, generate a random string (e.g. `openssl rand -base64 32`) and store it in Supabase Vault, once:
   ```sql
   select vault.create_secret('paste-your-random-string-here', 'app_encryption_key');
   ```
   Keep the random string somewhere safe too (e.g. a password manager) — it's the encryption key for staff bank/tax/super details and is never stored in this repo.
4. In the same SQL editor, run `supabase/migrations/0001_init.sql`.
5. Copy `.env.example` to `.env.local` (web) / `.env` (mobile) in each app and fill in your Supabase project URL + anon key (Project Settings → API).
6. To test the **mobile app's PIN sign-in**, run `supabase/seed-admin.sql` — creates one admin profile with a PIN, no web login involved.
7. To test the **web dashboard's email/password sign-in** (separate from the PIN above): Supabase Dashboard → Authentication → Users → Add user. Then in the SQL editor, promote them to superadmin:
   ```sql
   insert into profiles (auth_user_id, full_name, email, role)
   values ('<their auth.users id, from the Users list>', 'Your Name', '<their email>', 'superadmin');
   ```
8. Run the web app: `pnpm dev:web`
9. Run the mobile app: `pnpm dev:mobile` (then open in Expo Go or a simulator)

## Roles

- **superadmin** / **admin** / **operations** — web dashboard access, varying permissions
- **staff** — mobile app only, signs in with a PIN (set via a future "create staff" admin feature — not built yet)
