-- ============================================================ post engagement and email stats
-- Numbers logged per post (likes, reach...) or per email (sent, opens, clicks...). Safe to run more than once.
alter table public.content_items add column if not exists stats jsonb not null default '{}'::jsonb;
