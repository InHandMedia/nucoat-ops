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
-- ============================================================ link sheet owners to real teammates
-- Tasks imported from the sheets name people ("Ali Bea / Brady"). Link anyone who now has a profile
-- whose name starts with that first name. Safe to run again after a new teammate signs up.
update public.tasks t
set assigned_to = (
  select coalesce(array_agg(distinct x), '{}'::uuid[])
  from unnest(
    t.assigned_to || array(
      select p.id from public.profiles p
      where p.role <> 'reviewer'
        and exists (
          select 1 from unnest(regexp_split_to_array(t.owner_label, '\s*(/|,|&|\+)\s*')) as tok
          where length(split_part(trim(tok), ' ', 1)) >= 3
            and lower(split_part(p.display_name, ' ', 1)) like lower(split_part(trim(tok), ' ', 1)) || '%'
        )
    )
  ) as x
)
where coalesce(t.owner_label, '') <> '';
-- ============================================================ starter metrics from the Goals & Metrics sheet
-- Runs once (skips itself if already loaded). Numbers you log in the app are never touched.
do $$
declare v_owner uuid;
begin
  if exists (select 1 from public.metrics where source = 'sheets-2026-10') then
    raise notice 'Metrics already loaded, skipping';
    return;
  end if;
  select id into v_owner from public.profiles where role = 'owner' limit 1;

  insert into public.metrics (position, brand, name, detail, unit, kind, rollup, baseline, target, target_label, relative, monthly_targets, target_date, owner_label, notes, source, created_by) values
    (1,  'NuCoat', 'Google rating', 'Google Business rating (stars)', '★', 'number', 'latest', 3.7, 4.5, '', false, null, '2027-03-31', 'Ali Bea', 'Needs a steady flow of new 5-star reviews.', 'sheets-2026-10', v_owner),
    (2,  'NuCoat', 'Maps listings updated', 'Pictures added to both Google and Apple Maps (1 = done)', '', 'yesno', 'latest', 0, 1, '', false, null, '2026-10-02', 'Ali Bea', 'Needs Google Domain and Ads workspace access via DTS.', 'sheets-2026-10', v_owner),
    (3,  'NuCoat', 'New Google reviews (Q4)', 'New 5-star Google reviews, Oct 1 to Dec 31', '', 'number', 'sum', 0, 15, '5 / month', false, null, '2026-12-31', 'Ali Bea', 'Friends, family and happy customers. Starts once the listing pictures are live.', 'sheets-2026-10', v_owner),
    (4,  'NuCoat', 'Compliance video views on the website', 'Entry sessions on the Safety & Compliance page or a video page (Shopify). Log weekly; the month adds up.', '', 'number', 'month', 23, 110, 'Oct 60 · Nov 85 · Dec 110', false, '{"2026-10":60,"2026-11":85,"2026-12":110}'::jsonb, '2026-12-31', 'Ali Bea', 'The main metric we agreed to track. Baseline is Sep 1 to 20, before the campaign.', 'sheets-2026-10', v_owner),
    (5,  'NuCoat', 'YouTube views (compliance videos)', 'Cumulative views across the compliance videos', '', 'number', 'latest', null, 1000, '+1,000 over the first number logged', true, null, '2026-12-31', 'Ali Bea', 'Log the baseline first, then update after each release week.', 'sheets-2026-10', v_owner),
    (6,  'NuCoat', 'Email open rate', 'Open rate on the video emails (Klaviyo)', '%', 'number', 'latest', null, null, 'target to set', false, null, null, 'Ali Bea', 'Supporting metric. Clicks matter more than opens.', 'sheets-2026-10', v_owner),
    (7,  'NuCoat', 'Email click rate', 'Click rate on the video emails (Klaviyo)', '%', 'number', 'latest', null, null, 'target to set', false, null, null, 'Ali Bea', 'This is the one that shows people are going to the videos.', 'sheets-2026-10', v_owner),
    (8,  'NuCoat', 'Instagram grid cleanup', 'Cleanup complete (1 = done), then weekly upkeep on Fridays', '', 'yesno', 'latest', 0, 1, '', false, null, '2026-10-09', 'Ali Bea', 'Keep NuCoat active and relevant, B2B tone.', 'sheets-2026-10', v_owner),
    (9,  'NuFun',  'NuFun offers posted', 'Offer emails plus FB/IG posts across the quarter', '', 'number', 'sum', 0, 18, '6 emails + 12 posts', false, null, '2026-12-31', 'Ali Bea', 'Print offer and discontinued-product offer, alternating.', 'sheets-2026-10', v_owner),
    (10, 'NuFun',  'Print calls', 'Cold calls made, reported weekly', '', 'number', 'sum', 0, null, 'target to set', false, null, '2027-03-08', 'Jake', 'Started 9/8. Standing topic in the weekly sales meeting. 6-month review in March.', 'sheets-2026-10', v_owner),
    (11, 'NuFun',  'Print quotes', 'Quotes sent from those calls', '', 'number', 'sum', 0, null, 'target to set', false, null, '2027-03-08', 'Jake', '', 'sheets-2026-10', v_owner),
    (12, 'NuFun',  'New print customers', 'New print customers from the cold calls', '', 'number', 'sum', 0, null, 'target to set', false, null, '2027-03-08', 'Jake', '', 'sheets-2026-10', v_owner),
    (13, 'NuFun',  'Discontinued products: units moved', 'Units of discontinued product sold (Amazon + site)', '', 'number', 'sum', null, null, 'target to set', false, null, '2026-12-31', 'Heather / Taylor', 'First SKUs live by 10/30. Reviewed monthly in DTF Ops.', 'sheets-2026-10', v_owner),
    (14, 'NuFun',  'Discontinued products: dollars moved', 'Dollars of discontinued product sold (Amazon + site)', '$', 'number', 'sum', null, null, 'target to set', false, null, '2026-12-31', 'Heather / Taylor', '', 'sheets-2026-10', v_owner),
    (15, 'NuFun',  'Monthly print video from Alex', 'Delivered by the 1st Thursday (log 1 each month it lands)', '', 'number', 'sum', 0, 3, '10/1, 11/5, 12/3', false, null, '2026-12-31', 'Alex', 'Brady and Shaenna keep it on his list.', 'sheets-2026-10', v_owner);
end $$;
