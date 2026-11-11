-- ============================================================ post preview images
-- Lets you attach a JPEG/PNG preview to any post on the Content page. Safe to run more than once.

alter table public.content_items add column if not exists preview_url text not null default '';

insert into storage.buckets (id, name, public)
values ('post-previews', 'post-previews', true)
on conflict (id) do update set public = true;

drop policy if exists "view post previews" on storage.objects;
create policy "view post previews" on storage.objects for select
  using (bucket_id = 'post-previews');

drop policy if exists "staff add post previews" on storage.objects;
create policy "staff add post previews" on storage.objects for insert
  with check (bucket_id = 'post-previews' and public.is_staff());

drop policy if exists "staff change post previews" on storage.objects;
create policy "staff change post previews" on storage.objects for update
  using (bucket_id = 'post-previews' and public.is_staff());

drop policy if exists "staff remove post previews" on storage.objects;
create policy "staff remove post previews" on storage.objects for delete
  using (bucket_id = 'post-previews' and public.is_staff());
