-- ============================================================================
-- 0010_kyc_storage.sql
-- Supabase Storage bucket for KYC documents (ID, utility bill).
-- Files are stored under `<user_id>/<filename>`; users can only touch their own folder.
--
-- ROLLBACK:
--   delete from storage.buckets where id = 'kyc-documents';
--   drop policy if exists "kyc: users read own folder" on storage.objects;
--   drop policy if exists "kyc: users upload own folder" on storage.objects;
--   drop policy if exists "kyc: users update own folder" on storage.objects;
--   drop policy if exists "kyc: users delete own folder" on storage.objects;
--   drop policy if exists "kyc: admin read all" on storage.objects;
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

create policy "kyc: users read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc: users upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc: users update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc: users delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc: admin read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc-documents' and public.is_admin()
  );
