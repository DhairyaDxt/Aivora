create policy "org members read knowledge docs" on storage.objects for select to authenticated
using (bucket_id = 'knowledge-docs' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "org members upload knowledge docs" on storage.objects for insert to authenticated
with check (bucket_id = 'knowledge-docs' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "org members delete knowledge docs" on storage.objects for delete to authenticated
using (bucket_id = 'knowledge-docs' and public.is_org_member(((storage.foldername(name))[1])::uuid));