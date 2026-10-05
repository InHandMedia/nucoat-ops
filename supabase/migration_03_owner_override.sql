-- ============================================================ owner approval override
-- The owner can approve a video or a post without submitting it first, and can approve their own posts.
-- Everyone else works exactly as before (nobody else can approve a post they created).

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
