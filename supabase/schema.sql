-- NuCoat Ops database schema
-- Run once in your Supabase project: SQL Editor > New query > paste this whole file > Run.
--
-- Roles (stored on each person's profile):
--   owner    - Alistair. Sees everything, including retainer hours and billing.
--   editor   - Jodi, Marcel, Brady. Edit everything, have their own task list, and can approve
--              Alistair's posts and videos. Never see hours or billing.
--   reviewer - optional outside viewer. Sees status/scripts/content, comments, approves. Cannot edit or see tasks.
-- The FIRST account created becomes the owner. Everyone after that starts as "editor".
-- The owner can change anyone's role from the Team tab inside the app.
-- All of this is enforced here in the database (row level security), not just hidden on screen.

create extension if not exists pgcrypto;

-- ============================================================ people
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'editor' check (role in ('owner','editor','reviewer')),
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', initcap(split_part(new.email, '@', 1))),
    case when first_user then 'owner' else 'editor' end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Role helpers used by the security policies below.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() = 'owner', false) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() in ('owner','editor'), false) $$;

-- Nobody can promote themselves: only the owner can change a role.
create or replace function public.guard_role_change() returns trigger as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute procedure public.guard_role_change();

-- ============================================================ videos
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  number int,
  title text not null,
  brand text not null default 'NuCoat' check (brand in ('NuCoat','NuFun')),
  stage text not null default 'script'
    check (stage in ('script','client_approval','shoot','edit','client_review','delivered')),
  formats text[] not null default '{long,short}',        -- which versions this video needs
  talent text default 'Jodi',
  shoot_date date,
  due_date date,
  summary text default '',
  script text default '',
  shot_list text default '',
  long_link text default '',
  short_link text default '',
  approval_status text not null default 'none'
    check (approval_status in ('none','pending','approved','changes_requested')),
  waiting_on_brady boolean not null default false,
  waiting_note text default '',
  assigned_to uuid[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Moving a video into a client-review stage automatically flags it as waiting on Brady.
create or replace function public.videos_stage_change() returns trigger as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage and new.stage in ('client_approval','client_review') then
    new.approval_status := 'pending';
    new.waiting_on_brady := true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger videos_before_update
  before update on public.videos
  for each row execute procedure public.videos_stage_change();

-- Internal-only notes (outside reviewers can never read these).
create table public.video_internal (
  video_id uuid primary key references public.videos(id) on delete cascade,
  notes text default ''
);

-- Pre-shoot checklist. Every new video gets the template below automatically.
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz default now()
);

create or replace function public.videos_add_checklist() returns trigger as $$
begin
  insert into public.checklist_items (video_id, title, position)
  select new.id, t.title, t.pos
  from (values
    (1, 'Script approved by Brady'),
    (2, 'Talent confirmed (time, wardrobe, no logos clashing)'),
    (3, 'Location / set cleaned and set up'),
    (4, 'Product and props staged'),
    (5, 'Shot list reviewed'),
    (6, 'Compliance wording double-checked against the script'),
    (7, 'Audio check (mic, room tone)'),
    (8, 'Batteries charged, cards cleared, backup drive ready'),
    (9, 'Cue cards / teleprompter loaded')
  ) as t(pos, title);
  insert into public.video_internal (video_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger videos_after_insert
  after insert on public.videos
  for each row execute procedure public.videos_add_checklist();

-- Comments and approval history (visible to everyone, including Brady).
create table public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  author uuid references public.profiles(id) default auth.uid(),
  kind text not null default 'comment' check (kind in ('comment','approved','changes')),
  body text default '',
  created_at timestamptz default now()
);

-- The Approve / Request changes buttons call this. Any editor (Jodi, Marcel, Brady), a reviewer,
-- or the owner can approve a video.
create or replace function public.review_video(p_video uuid, p_decision text, p_note text default '')
returns void as $$
declare
  v public.videos;
  override boolean := false;
  note text := coalesce(p_note, '');
begin
  if public.my_role() not in ('reviewer','editor','owner') then
    raise exception 'You do not have permission to approve';
  end if;
  select * into v from public.videos where id = p_video;
  if v.id is null then raise exception 'Video not found'; end if;
  if v.stage not in ('client_approval','client_review') then
    -- owner override: approve a script or an edit that was never submitted
    if public.is_owner() and p_decision = 'approved' and v.stage in ('script','edit') then
      override := true;
    else
      raise exception 'This video is not waiting for review';
    end if;
  end if;

  if p_decision = 'approved' then
    update public.videos set
      stage = case when v.stage in ('client_approval','script') then 'shoot' else 'delivered' end,
      approval_status = 'approved', waiting_on_brady = false
    where id = p_video;
  elsif p_decision = 'changes' then
    update public.videos set
      stage = case when v.stage = 'client_approval' then 'script' else 'edit' end,
      approval_status = 'changes_requested', waiting_on_brady = false
    where id = p_video;
  else
    raise exception 'Unknown decision';
  end if;

  if override and note = '' then note := 'Approved by the owner (skipped review)'; end if;
  insert into public.video_comments (video_id, author, kind, body)
  values (p_video, auth.uid(), p_decision, note);
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================ team tasks (staff only)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  video_id uuid references public.videos(id) on delete set null,
  assigned_to uuid[] not null default '{}',
  owner_label text default '',          -- who owns it when they are not an app user (Alex, Jake, ...)
  category text default '',
  notes text default '',
  source text default '',
  due_date date,
  done boolean not null default false,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

-- ============================================================ content calendar (posts + emails)
-- Alistair drafts each post/email. Any other editor (usually Brady) approves it.
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  publish_date date not null,
  brand text not null default 'NuCoat' check (brand in ('NuCoat','NuFun')),
  channel text not null default 'instagram' check (channel in ('email','facebook','instagram','linkedin','other')),
  kind text not null default 'other' check (kind in ('video','takeaway','reminder','offer','other')),
  title text not null,
  brief text default '',          -- what the plan says should go out
  caption text default '',        -- the actual copy that gets approved
  asset_link text default '',
  notes text default '',
  video_id uuid references public.videos(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','changes_requested','scheduled','posted')),
  created_by uuid references public.profiles(id) default auth.uid(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  source text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  author uuid references public.profiles(id) default auth.uid(),
  kind text not null default 'comment' check (kind in ('comment','approved','changes')),
  body text default '',
  created_at timestamptz default now()
);

-- Nobody can mark a post "approved" by editing it directly: only review_content() does that.
-- Editing the copy of an already-approved post sends it back for approval.
create or replace function public.content_guard() returns trigger as $$
declare
  via_rpc boolean := coalesce(current_setting('app.via_rpc', true), '') = 'on';
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.status not in ('draft','in_review') then
      raise exception 'New posts start as a draft';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and not via_rpc then
    if new.status in ('approved','changes_requested') then
      raise exception 'Use Approve / Request changes to review a post';
    end if;
    if new.status in ('scheduled','posted') and old.status not in ('approved','scheduled','posted') then
      raise exception 'A post must be approved before it is scheduled';
    end if;
  end if;
  if not via_rpc and old.status in ('approved','scheduled','posted') and new.status = old.status
     and (new.caption is distinct from old.caption or new.asset_link is distinct from old.asset_link
          or new.title is distinct from old.title or new.publish_date is distinct from old.publish_date
          or new.channel is distinct from old.channel) then
    new.status := 'in_review';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger content_before_write
  before insert or update on public.content_items
  for each row execute procedure public.content_guard();

-- Approve / Request changes on a post. You cannot approve a post you created yourself (the owner can).
create or replace function public.review_content(p_item uuid, p_decision text, p_note text default '')
returns void as $$
declare
  c public.content_items;
  owner_approve boolean := public.is_owner() and p_decision = 'approved';
  note text := coalesce(p_note, '');
  skipped boolean := false;
begin
  if public.my_role() not in ('reviewer','editor','owner') then
    raise exception 'You do not have permission to approve';
  end if;
  select * into c from public.content_items where id = p_item;
  if c.id is null then raise exception 'Post not found'; end if;
  if c.created_by = auth.uid() and not owner_approve then
    raise exception 'You cannot approve a post you created. Another editor needs to review it.';
  end if;
  if c.status <> 'in_review' and not (owner_approve and c.status in ('draft','changes_requested')) then
    raise exception 'This post is not waiting for approval';
  end if;
  skipped := owner_approve and (c.status <> 'in_review' or c.created_by = auth.uid());
  perform set_config('app.via_rpc', 'on', true);
  if p_decision = 'approved' then
    update public.content_items set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = p_item;
  elsif p_decision = 'changes' then
    update public.content_items set status = 'changes_requested', reviewed_by = auth.uid(), reviewed_at = now() where id = p_item;
  else
    raise exception 'Unknown decision';
  end if;
  if skipped and note = '' then note := 'Approved by the owner (skipped review)'; end if;
  insert into public.content_comments (content_id, author, kind, body)
  values (p_item, auth.uid(), p_decision, note);
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================ requests (everyone)
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text default '',
  kind text not null default 'graphic_design'
    check (kind in ('graphic_design','extra_posts','outside_scope','video','other')),
  status text not null default 'submitted'
    check (status in ('submitted','accepted','in_progress','done','declined')),
  requested_by uuid not null references public.profiles(id) default auth.uid(),
  due_date date,
  video_id uuid references public.videos(id) on delete set null,
  decline_reason text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================ hours + billing (OWNER ONLY)
create table public.request_estimates (
  request_id uuid primary key references public.requests(id) on delete cascade,
  estimate_hours numeric(6,2) not null default 0
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  hours numeric(5,2) not null check (hours > 0),
  kind text not null default 'content' check (kind in ('content','request','admin')),
  video_id uuid references public.videos(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  note text default '',
  created_at timestamptz default now()
);

create table public.billing_settings (
  id int primary key default 1 check (id = 1),
  weekly_cap_hours numeric(5,2) not null default 10,
  weekly_fee numeric(8,2) not null default 300,
  overage_rate numeric(8,2)        -- leave empty to pro-rate: weekly_fee / weekly_cap_hours
);
insert into public.billing_settings default values;

-- ============================================================ security
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.video_internal enable row level security;
alter table public.checklist_items enable row level security;
alter table public.video_comments enable row level security;
alter table public.tasks enable row level security;
alter table public.content_items enable row level security;
alter table public.content_comments enable row level security;
alter table public.requests enable row level security;
alter table public.request_estimates enable row level security;
alter table public.time_entries enable row level security;
alter table public.billing_settings enable row level security;

-- profiles: everyone signed in can see names; you edit your own name; the owner edits anyone (incl. role)
create policy "read profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "update own profile" on public.profiles for update using (id = auth.uid());
create policy "owner updates profiles" on public.profiles for update using (public.is_owner());

-- videos: everyone reads; owner + editors write
create policy "read videos" on public.videos for select using (auth.role() = 'authenticated');
create policy "staff write videos" on public.videos for all using (public.is_staff()) with check (public.is_staff());

-- internal notes, checklist, tasks: owner + editors only (outside reviewers never see these)
create policy "staff internal" on public.video_internal for all using (public.is_staff()) with check (public.is_staff());
create policy "staff checklist" on public.checklist_items for all using (public.is_staff()) with check (public.is_staff());
create policy "staff tasks" on public.tasks for all using (public.is_staff()) with check (public.is_staff());

-- comments: everyone reads and can post a plain comment as themselves (approvals only via review_video)
create policy "read comments" on public.video_comments for select using (auth.role() = 'authenticated');
create policy "post comment" on public.video_comments for insert
  with check (author = auth.uid() and kind = 'comment');
create policy "delete own comment" on public.video_comments for delete
  using (author = auth.uid() or public.is_owner());

-- content calendar: everyone reads; owner + editors write (approval only through review_content)
create policy "read content" on public.content_items for select using (auth.role() = 'authenticated');
create policy "staff write content" on public.content_items for all using (public.is_staff()) with check (public.is_staff());
create policy "read content comments" on public.content_comments for select using (auth.role() = 'authenticated');
create policy "post content comment" on public.content_comments for insert
  with check (author = auth.uid() and kind = 'comment');
create policy "delete own content comment" on public.content_comments for delete
  using (author = auth.uid() or public.is_owner());

-- requests: everyone sees the queue and can submit; only the owner triages
create policy "read requests" on public.requests for select using (auth.role() = 'authenticated');
create policy "submit request" on public.requests for insert
  with check (requested_by = auth.uid() and status = 'submitted');
create policy "owner manages requests" on public.requests for all
  using (public.is_owner()) with check (public.is_owner());
create policy "edit own open request" on public.requests for update
  using (requested_by = auth.uid() and status = 'submitted')
  with check (requested_by = auth.uid() and status = 'submitted');
create policy "withdraw own open request" on public.requests for delete
  using (requested_by = auth.uid() and status = 'submitted');

-- hours and billing: owner only, full stop
create policy "owner estimates" on public.request_estimates for all using (public.is_owner()) with check (public.is_owner());
create policy "owner time" on public.time_entries for all using (public.is_owner()) with check (public.is_owner());
create policy "owner billing" on public.billing_settings for all using (public.is_owner()) with check (public.is_owner());

-- Live sync so everyone sees changes without refreshing.
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.videos;
alter publication supabase_realtime add table public.video_internal;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.video_comments;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.content_items;
alter publication supabase_realtime add table public.content_comments;
alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.request_estimates;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.billing_settings;

-- ============================================================ metrics (marketing goals + weekly numbers)
-- Staff only (owner + editors). Each metric is a goal; each entry is one logged number.
alter table public.profiles add column if not exists show_done_green boolean not null default false;

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'NuCoat' check (brand in ('NuCoat','NuFun')),
  name text not null,
  detail text not null default '',           -- how we measure it
  unit text not null default '',             -- '', '%', '$', '★'
  kind text not null default 'number' check (kind in ('number','yesno')),
  rollup text not null default 'latest' check (rollup in ('latest','sum','month')),
  baseline numeric,                          -- starting point (blank = use the first logged number)
  target numeric,
  target_label text not null default '',     -- shown next to the target, e.g. '5 / month'
  relative boolean not null default false,   -- true: the target is a gain over the baseline (+1,000)
  monthly_targets jsonb,                     -- optional {"2026-10":60,"2026-11":85}
  target_date date,
  owner_label text not null default '',
  notes text not null default '',
  position int not null default 0,
  source text default '',
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.metrics(id) on delete cascade,
  entry_date date not null default current_date,
  value numeric not null,
  note text not null default '',
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists metric_entries_metric_idx on public.metric_entries (metric_id, entry_date);

alter table public.metrics enable row level security;
alter table public.metric_entries enable row level security;
drop policy if exists "staff metrics" on public.metrics;
drop policy if exists "staff metric entries" on public.metric_entries;
create policy "staff metrics" on public.metrics for all using (public.is_staff()) with check (public.is_staff());
create policy "staff metric entries" on public.metric_entries for all using (public.is_staff()) with check (public.is_staff());

do $$ begin
  alter publication supabase_realtime add table public.metrics;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.metric_entries;
exception when duplicate_object then null; end $$;

-- ============================================================ starter content
-- The 14-video compliance series as placeholders. Rename them in the app.
insert into public.videos (number, title, brand, stage, talent)
select n, 'Compliance video ' || lpad(n::text, 2, '0') || ' (rename me)', 'NuCoat', 'script', 'Jodi'
from generate_series(1, 14) as n;
