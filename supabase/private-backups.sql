-- Apply to the dedicated MDK project. The owner must be provisioned through
-- the dashboard; there is deliberately no public signup or owner self-enrollment.
create table if not exists public.mdk_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.mdk_owners enable row level security;
revoke all on public.mdk_owners from anon, authenticated;
grant select on public.mdk_owners to authenticated;
drop policy if exists "Owner can check membership" on public.mdk_owners;
create policy "Owner can check membership" on public.mdk_owners
  for select to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mdk-private', 'mdk-private', false, 52428800, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['application/json'];

drop policy if exists "MDK owner reads private archive" on storage.objects;
create policy "MDK owner reads private archive" on storage.objects
  for select to authenticated using (
    bucket_id = 'mdk-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.mdk_owners where user_id = (select auth.uid()))
  );
drop policy if exists "MDK owner writes private archive" on storage.objects;
create policy "MDK owner writes private archive" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mdk-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.mdk_owners where user_id = (select auth.uid()))
  );
-- Files are immutable. No client update/delete policy is granted.
-- After creating the owner's Auth user, run:
-- insert into public.mdk_owners(user_id) values ('OWNER_AUTH_USER_UUID');
