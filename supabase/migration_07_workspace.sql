-- ============================================================ workspace upgrade
-- Per-person tabs, departments, live team view, projects, meetings, custom tabs,
-- and the calendar feed used by the Mac Calendar widget.
-- Run once: SQL Editor > New query > paste this whole file > Run. Safe to run again.

-- ------------------------------------------------------------ people
-- First run only: add the tab switches and turn Series off for everyone except the owner.
-- (Done before the guard below is replaced, so this script is allowed to set them.)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'hidden_tabs'
  ) then
    alter table public.profiles add column hidden_tabs text[] not null default '{}';
    update public.profiles set hidden_tabs = array['series'] where role <> 'owner';
  end if;
end $$;

alter table public.profiles add column if not exists department text not null default 'Marketing';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Fill in each person's email from their login, so meeting invites know where to go.
update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email = '' and u.email is not null;

-- New people: keep the email, and start with Series switched off.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, display_name, role, email, hidden_tabs)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', initcap(split_part(new.email, '@', 1))),
    case when first_user then 'owner' else 'editor' end,
    coalesce(new.email, ''),
    case when first_user then '{}'::text[] else array['series'] end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Only the owner can change a role, which tabs someone sees, or their department.
create or replace function public.guard_role_change() returns trigger as $$
begin
  if (new.role is distinct from old.role
      or new.hidden_tabs is distinct from old.hidden_tabs
      or new.department is distinct from old.department)
     and not public.is_owner() then
    raise exception 'Only the owner can change roles, tabs or departments';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------ projects
-- A project is only visible to its members and the owner. Enforced here, not just on screen.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  department text not null default 'Marketing',
  status text not null default 'active' check (status in ('planning','active','paused','done')),
  member_ids uuid[] not null default '{}',
  outside_members text not null default '',     -- people who do not have a login yet
  due_date date,
  link text not null default '',
  show_in_menu boolean not null default true,   -- gives each member a tab for this project
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author uuid references public.profiles(id) default auth.uid(),
  body text not null default '',
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.projects enable row level security;
alter table public.project_updates enable row level security;

drop policy if exists "read my projects" on public.projects;
create policy "read my projects" on public.projects for select
  using (public.is_owner() or auth.uid() = any(member_ids));
drop policy if exists "owner manages projects" on public.projects;
create policy "owner manages projects" on public.projects for all
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "read project updates" on public.project_updates;
create policy "read project updates" on public.project_updates for select
  using (exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists "post project update" on public.project_updates;
create policy "post project update" on public.project_updates for insert
  with check (author = auth.uid() and exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists "delete own project update" on public.project_updates;
create policy "delete own project update" on public.project_updates for delete
  using (author = auth.uid() or public.is_owner());

-- ------------------------------------------------------------ meetings
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null default 30 check (duration_min > 0),
  attendee_ids uuid[] not null default '{}',
  extra_emails text not null default '',        -- invitees who are not in the app
  join_link text not null default '',           -- paste the Teams link here after sending
  notes text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.meetings enable row level security;
drop policy if exists "read meetings" on public.meetings;
create policy "read meetings" on public.meetings for select
  using (public.is_staff() or auth.uid() = any(attendee_ids));
drop policy if exists "staff write meetings" on public.meetings;
create policy "staff write meetings" on public.meetings for all
  using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------ custom tabs
-- Extra tabs the owner adds for chosen people: an embedded sheet, a report, a link.
create table if not exists public.custom_tabs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  mode text not null default 'embed' check (mode in ('embed','link')),
  everyone boolean not null default false,
  member_ids uuid[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.custom_tabs enable row level security;
drop policy if exists "read my custom tabs" on public.custom_tabs;
create policy "read my custom tabs" on public.custom_tabs for select
  using (public.is_owner() or everyone or auth.uid() = any(member_ids));
drop policy if exists "owner manages custom tabs" on public.custom_tabs;
create policy "owner manages custom tabs" on public.custom_tabs for all
  using (public.is_owner()) with check (public.is_owner());

-- ------------------------------------------------------------ live sync
do $$ begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.project_updates; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meetings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.custom_tabs; exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------ calendar feed (Mac widget)
-- Each person gets a private address. Apple Calendar subscribes to it and its widget
-- then shows that person's open tasks and meetings. The token is the only key, so
-- treat the address like a password. "Reset" in the app makes a new one.
create table if not exists public.feed_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null default gen_random_uuid()
);
alter table public.feed_tokens enable row level security;
drop policy if exists "own feed token" on public.feed_tokens;
create policy "own feed token" on public.feed_tokens for select using (user_id = auth.uid());

create or replace function public.my_feed_token(p_reset boolean default false) returns uuid as $$
declare
  t uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_reset then delete from public.feed_tokens where user_id = auth.uid(); end if;
  insert into public.feed_tokens (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select token into t from public.feed_tokens where user_id = auth.uid();
  return t;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.ics_esc(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''), '\', '\\'), ';', '\;'), ',', '\,'), E'\r', ''), E'\n', '\n')
$$;

create or replace function public.calendar_feed(p_token uuid) returns text as $$
declare
  uid uuid;
  crlf text := E'\r\n';
  ics text;
  stamp text := to_char(now() at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"');
  today date := (now() at time zone 'America/New_York')::date;
  open_count int;
  open_list text;
  r record;
begin
  select user_id into uid from public.feed_tokens where token = p_token;
  if uid is null then return null; end if;

  ics := 'BEGIN:VCALENDAR' || crlf || 'VERSION:2.0' || crlf || 'PRODID:-//NuCoat Ops//EN' || crlf
      || 'CALSCALE:GREGORIAN' || crlf || 'X-WR-CALNAME:NuCoat Ops' || crlf
      || 'REFRESH-INTERVAL;VALUE=DURATION:PT15M' || crlf || 'X-PUBLISHED-TTL:PT15M' || crlf;

  -- One line at the top of today: how many tasks are open, with the list inside.
  select count(*), string_agg('- ' || title || case when due_date is not null then ' (due ' || to_char(due_date, 'Mon DD') || ')' else '' end, E'\n' order by due_date nulls last)
    into open_count, open_list
  from public.tasks where not done and uid = any(assigned_to);
  if open_count > 0 then
    ics := ics || 'BEGIN:VEVENT' || crlf || 'UID:open-' || uid || '@nucoat-ops' || crlf || 'DTSTAMP:' || stamp || crlf
        || 'DTSTART;VALUE=DATE:' || to_char(today, 'YYYYMMDD') || crlf
        || 'DTEND;VALUE=DATE:' || to_char(today + 1, 'YYYYMMDD') || crlf
        || 'SUMMARY:' || public.ics_esc(open_count || ' open NuCoat task' || case when open_count = 1 then '' else 's' end) || crlf
        || 'DESCRIPTION:' || public.ics_esc(open_list) || crlf || 'END:VEVENT' || crlf;
  end if;

  -- Each dated task on its due date. Overdue ones roll forward to today.
  for r in
    select id, title, notes, due_date from public.tasks
    where not done and due_date is not null and uid = any(assigned_to)
  loop
    ics := ics || 'BEGIN:VEVENT' || crlf || 'UID:task-' || r.id || '@nucoat-ops' || crlf || 'DTSTAMP:' || stamp || crlf
        || 'DTSTART;VALUE=DATE:' || to_char(greatest(r.due_date, today), 'YYYYMMDD') || crlf
        || 'DTEND;VALUE=DATE:' || to_char(greatest(r.due_date, today) + 1, 'YYYYMMDD') || crlf
        || 'SUMMARY:' || public.ics_esc(case when r.due_date < today then 'OVERDUE: ' else 'Due: ' end || r.title) || crlf
        || 'DESCRIPTION:' || public.ics_esc(r.notes) || crlf || 'END:VEVENT' || crlf;
  end loop;

  -- Meetings this person is in.
  for r in
    select id, title, notes, join_link, starts_at, duration_min from public.meetings
    where (uid = any(attendee_ids) or created_by = uid) and starts_at > now() - interval '30 days'
  loop
    ics := ics || 'BEGIN:VEVENT' || crlf || 'UID:meeting-' || r.id || '@nucoat-ops' || crlf || 'DTSTAMP:' || stamp || crlf
        || 'DTSTART:' || to_char(r.starts_at at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"') || crlf
        || 'DTEND:' || to_char((r.starts_at + make_interval(mins => r.duration_min)) at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"') || crlf
        || 'SUMMARY:' || public.ics_esc(r.title) || crlf
        || case when r.join_link <> '' then 'LOCATION:' || public.ics_esc(r.join_link) || crlf else '' end
        || 'DESCRIPTION:' || public.ics_esc(r.notes) || crlf || 'END:VEVENT' || crlf;
  end loop;

  return ics || 'END:VCALENDAR' || crlf;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.calendar_feed(uuid) to anon, authenticated;

-- ------------------------------------------------------------ starter project
-- The TikTok Shop launch. Taylor and Halle are listed by name until they have logins;
-- then add them as members from the Projects tab.
insert into public.projects (name, description, department, status, member_ids, outside_members, created_by)
select 'TikTok Shop launch', 'Get the TikTok Shop set up and selling.', 'Marketing', 'planning',
       array[o.id], 'Taylor, Halle', o.id
from (select id from public.profiles where role = 'owner' order by created_at limit 1) o
where not exists (select 1 from public.projects);
