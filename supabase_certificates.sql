-- Storage certificati medici
-- Eseguire nel SQL Editor del progetto Supabase.

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do update set public = false;

drop policy if exists "Students can upload their own certificates" on storage.objects;
create policy "Students can upload their own certificates"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Students can read their own certificates" on storage.objects;
create policy "Students can read their own certificates"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Students can update their own certificates" on storage.objects;
create policy "Students can update their own certificates"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Students can delete their own certificates" on storage.objects;
create policy "Students can delete their own certificates"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Admins can read certificates" on storage.objects;
create policy "Admins can read certificates"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'certificates'
    and exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.is_admin = true
    )
);