-- ============================================================ private project tasks + done dates
-- 1. A task that belongs to a project is only visible to that project's members and the owner.
--    Tasks with no project work exactly as before.
-- 2. Tasks remember when they were finished, so the weekly digest can say what got done.
-- Run after migration_07. Safe to run again.

create or replace function public.can_see_project(p uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_owner() or exists (
     select 1 from public.projects where id = p and auth.uid() = any(member_ids)
   ) $$;

drop policy if exists "staff tasks" on public.tasks;
create policy "staff tasks" on public.tasks for all
  using (public.is_staff() and (project_id is null or public.can_see_project(project_id)))
  with check (public.is_staff() and (project_id is null or public.can_see_project(project_id)));

alter table public.tasks add column if not exists done_at timestamptz;

create or replace function public.tasks_done_stamp() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.done then new.done_at := now(); end if;
  elsif new.done and not old.done then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_done_stamp on public.tasks;
create trigger tasks_done_stamp
  before insert or update on public.tasks
  for each row execute procedure public.tasks_done_stamp();

-- ============================================================ job titles + who approves
-- title: a free-text job title shown next to the person's name ("Sales lead", "Founder").
-- can_approve: untick it for people who should not be asked to review posts and videos.
-- The owner can always approve.
alter table public.profiles add column if not exists title text not null default '';
alter table public.profiles add column if not exists can_approve boolean not null default true;

create or replace function public.guard_role_change() returns trigger as $$
begin
  if (new.role is distinct from old.role
      or new.hidden_tabs is distinct from old.hidden_tabs
      or new.department is distinct from old.department
      or new.title is distinct from old.title
      or new.can_approve is distinct from old.can_approve)
     and not public.is_owner() then
    raise exception 'Only the owner can change roles, titles, tabs or approvals';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.can_approve() returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_owner() or coalesce((select can_approve from public.profiles where id = auth.uid()), false) $$;

-- Same as before, plus the can_approve check.
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
  if not public.can_approve() then
    raise exception 'Approvals are switched off for your account';
  end if;
  select * into v from public.videos where id = p_video;
  if v.id is null then raise exception 'Video not found'; end if;
  if v.stage not in ('client_approval','client_review') then
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
  if not public.can_approve() then
    raise exception 'Approvals are switched off for your account';
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
