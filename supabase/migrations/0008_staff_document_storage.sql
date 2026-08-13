-- Real photo/document uploads for staff compliance records — ID photo,
-- forklift/LO licence photos, and the tax file declaration document. These
-- were deliberately deferred until now; everything else in the app (NCR
-- reports, hazard/incident reports) has no photo capture in the original
-- prototype, so this is the only place it's needed.
--
-- Run this in the Supabase SQL editor.

alter table staff_sensitive
  add column id_photo_path text,
  add column forklift_licence_photo_path text,
  add column lo_licence_photo_path text,
  add column tax_file_declaration_path text;

-- Private bucket — these are identity documents and licences, admin-only
-- (not operations), matching staff_sensitive's own access level.
insert into storage.buckets (id, name, public)
values ('staff-documents', 'staff-documents', false)
on conflict (id) do nothing;

create policy staff_documents_admin_select on storage.objects for select
  using (bucket_id = 'staff-documents' and is_admin());
create policy staff_documents_admin_insert on storage.objects for insert
  with check (bucket_id = 'staff-documents' and is_admin());
create policy staff_documents_admin_update on storage.objects for update
  using (bucket_id = 'staff-documents' and is_admin())
  with check (bucket_id = 'staff-documents' and is_admin());
create policy staff_documents_admin_delete on storage.objects for delete
  using (bucket_id = 'staff-documents' and is_admin());
