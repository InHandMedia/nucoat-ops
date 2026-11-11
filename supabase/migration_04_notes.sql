-- ============================================================ dashboard notes and pins
-- Notes on everyone's dashboard. A note is private (only you), for everyone, or for one person.
-- A pinned note stays at the top of the recipient's dashboard. A note can point at a video, post or task.
-- Safe to run more than once.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  scope text not null default 'private' check (scope in ('private','everyone','person')),
  to_user uuid references public.profiles(id) on delete cascade,
  pinned boolean not null default false,
  ref_type text check (ref_type in ('video','content','task')),
  ref_id uuid,
  ref_label text not null default '',
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "read own or shared notes" on public.notes;
create policy "read own or shared notes" on public.notes for select using (
  author = auth.uid() or scope = 'everyone' or (scope = 'person' and to_user = auth.uid())
);

-- Anyone can keep private notes. Only the owner and editors can share or pin onto other people's dashboards.
drop policy if exists "write notes" on public.notes;
create policy "write notes" on public.notes for insert with check (
  author = auth.uid() and (scope = 'private' or public.is_staff())
);

drop policy if exists "edit own notes" on public.notes;
create policy "edit own notes" on public.notes for update
  using (author = auth.uid() or public.is_owner())
  with check ((author = auth.uid() or public.is_owner()) and (scope = 'private' or public.is_staff()));

drop policy if exists "delete own notes" on public.notes;
create policy "delete own notes" on public.notes for delete using (author = auth.uid() or public.is_owner());

do $$ begin
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then null; end $$;
