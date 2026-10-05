-- NuCoat Ops: starter data imported from the two marketing Google Sheets
-- ("Marketing Meeting" and Brady's "NuCoat/NuFun Marketing 2026"), imported 2026-10-05.
--
-- Run this AFTER schema.sql and AFTER you have created the accounts (Alistair first), so the
-- tasks and posts attach to the right people. It is safe to run only once: a second run stops with an error.
--
-- What is in here:
--   * the 9 finished compliance videos get their real titles and are marked Delivered
--   * open tasks from both sheets (with the owner's name kept even when they are not an app user)
--   * the email + social calendar from 10/5/2026 onward as Draft posts for you to submit for approval
-- Not imported on purpose: the Marketing Passwords tab, completed 2025 tradeshow items, past 2025
-- calendars, the large-account prospect list, and anything dated before 10/5/2026.

do $$
declare
  v_owner uuid := (select id from public.profiles where role = 'owner' order by created_at limit 1);
begin
  if exists (select 1 from public.tasks where source = 'sheets-2026-10') then
    raise exception 'The sheet data was already imported. Nothing was changed.';
  end if;

  -- 1. The 9 finished videos
  update public.videos v set title = x.title, stage = 'delivered', approval_status = 'approved', waiting_on_brady = false
  from (values
    (1, 'We Asked Retailers If Their Shirts Were Safe. 90% Couldn''t Answer.'),
    (2, 'What''s Actually on Your Kids'' Clothes?'),
    (3, '"Our Vendor Never Told Us" Is Not a Legal Defense'),
    (4, 'The "Non-Toxic" Ink That Wasn''t'),
    (5, 'Expensive Doesn''t Mean Non-Toxic'),
    (6, 'What Is in Your DTF Film?'),
    (7, 'How to Vet a DTF Supplier'),
    (8, 'Hazards Hiding in Your Facility')
  ) as x(num, title)
  where v.number = x.num and v.brand = 'NuCoat' and v.title like 'Compliance video % (rename me)';
  update public.videos set stage = 'delivered', approval_status = 'approved', waiting_on_brady = false
  where number = 9 and brand = 'NuCoat' and stage = 'script';

  -- 2. Tasks
  insert into public.tasks (title, assigned_to, owner_label, category, notes, due_date, source, created_by) values
    ('Confirm access to Google Domain workspace + Google Ads workspace (via DTS)', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'SEO', 'Was working with DTS on 9/14. Brady has Search Console access if needed.', '2026-09-29'::date, 'sheets-2026-10', v_owner),
    ('Add pictures to the Google and Apple Maps listings, and report the current Google review count', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'SEO', 'First step toward the 3.7 to 4.5 star goal. The review count decides whether 4.5 is reachable by 12/31.', '2026-10-02'::date, 'sheets-2026-10', v_owner),
    ('Google review push: ask friends, family and happy customers (target 5 per month)', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'SEO', 'Ongoing from 10/2. Tracked monthly on Goals & Metrics. 15 new 5-star reviews across Q4.', '2026-10-30'::date, 'sheets-2026-10', v_owner),
    ('Finish the Instagram grid cleanup (remove or adjust anything sales-heavy)', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Social', 'Keep NuCoat active and relevant, B2B tone.', '2026-10-09'::date, 'sheets-2026-10', v_owner),
    ('Instagram grid upkeep: weekly, every Friday', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Social', 'Recurring weekly once the cleanup is done.', '2026-10-16'::date, 'sheets-2026-10', v_owner),
    ('Capture September baseline numbers (website views, YouTube views, Klaviyo opens/clicks, Google review count)', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Goals & Metrics', 'Website baseline already filled in from Shopify. Still needs YouTube + Klaviyo + review count.', '2026-10-05'::date, 'sheets-2026-10', v_owner),
    ('Log the week''s numbers on Goals & Metrics (video page views, YouTube views, email opens/clicks, reviews)', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Goals & Metrics', 'Every Friday, 5 to 10 minutes. The monthly meeting reviews it.', '2026-10-09'::date, 'sheets-2026-10', v_owner),
    ('Look into posting and marketing DTF products in Facebook groups', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Social', 'Separate project, ongoing.', '2026-10-30'::date, 'sheets-2026-10', v_owner),
    ('Trade shows and publications: do we advertise there? Look into Printing United platform opportunities', array(select id from public.profiles where role = 'owner'), 'Ali Bea / Team', 'Advertising', 'Part of maintaining relevance.', '2026-10-01'::date, 'sheets-2026-10', v_owner),
    ('Blog page: add posts as needed so each video has a matching article', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%'), 'Ali Bea / Brady', 'Website', 'All 9 videos already have a summarized article on the site. Brady assists with language.', '2026-10-01'::date, 'sheets-2026-10', v_owner),
    ('Decide the owner and first SKUs for moving discontinued products on Amazon', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%') || array(select id from public.profiles where display_name ilike 'jodi%') || array(select id from public.profiles where display_name ilike 'marcel%'), 'Team', 'NuFun', 'Amazon is now the primary channel (Etsy is not an option for now). Decide at the 10/5 meeting.', '2026-10-05'::date, 'sheets-2026-10', v_owner),
    ('Move discontinued products on Amazon: list the SKUs, set pricing, manage stock', '{}'::uuid[], 'Heather / Taylor', 'NuFun', 'Per Jodi 9/21. First SKUs live by Fri 10/30. Units and dollars reviewed monthly in the DTF Ops meeting.', '2026-10-30'::date, 'sheets-2026-10', v_owner),
    ('Brady: Monday check-in with Ali Bea to confirm this week''s email and posts are scheduled', array(select id from public.profiles where display_name ilike 'brady%'), 'Brady', 'Planning', 'Weekly, every Monday (15 min).', '2026-10-06'::date, 'sheets-2026-10', v_owner),
    ('Brady: add Jake''s print-sales progress (calls, quotes, orders) as a standing topic in the weekly sales meeting', array(select id from public.profiles where display_name ilike 'brady%'), 'Brady', 'Print', 'Added at Jodi''s request 9/21.', '2026-10-06'::date, 'sheets-2026-10', v_owner),
    ('Brady: work with Shaenna to get Alex''s monthly print video onto his task list', array(select id from public.profiles where display_name ilike 'brady%'), 'Brady', 'NuFun', 'So the monthly video is not disregarded.', '2026-10-06'::date, 'sheets-2026-10', v_owner),
    ('Brady: create ink flyer for X203 inks (similar to MS/Dover)', array(select id from public.profiles where display_name ilike 'brady%'), 'Brady', 'Flyers / TDS', '', '2026-10-19'::date, 'sheets-2026-10', v_owner),
    ('Brady: discuss using AI tools (Opus 5.5 / GPT 6) for marketing prompts at the 10/5 meeting', array(select id from public.profiles where display_name ilike 'brady%') || array(select id from public.profiles where display_name ilike 'marcel%'), 'Brady', 'Planning', 'Marcel sent prompts from social media and asked whether we can look into this.', '2026-10-05'::date, 'sheets-2026-10', v_owner),
    ('Align the plan with Jodi (meet briefly if the direction has changed)', array(select id from public.profiles where display_name ilike 'brady%') || array(select id from public.profiles where display_name ilike 'jodi%'), 'Brady / Jodi', 'Planning', 'Some items in the new plan differ from the last meeting. Meet before making changes.', '2026-10-05'::date, 'sheets-2026-10', v_owner),
    ('Jake: cold-call for print orders and report calls/quotes/orders weekly (6-month evaluation)', '{}'::uuid[], 'Jake / Brady', 'Print', 'Started 9/8/2026, Tue and Fri mornings. Evaluate at ~3/8/2027.', '2027-03-08'::date, 'sheets-2026-10', v_owner),
    ('Matte Canvas NuCoat TDS', '{}'::uuid[], 'Alex Jarvey', 'Flyers / TDS', 'Waiting on info on the aqueous matte canvas option, then same process as Gloss Canvas.', null, 'sheets-2026-10', v_owner),
    ('Wallpaper TDS', '{}'::uuid[], 'Alex Jarvey', 'Flyers / TDS', 'Once info is received on the wallpaper option.', null, 'sheets-2026-10', v_owner),
    ('Matte Photopaper TDS', '{}'::uuid[], 'Alex Jarvey', 'Flyers / TDS', 'Pricing received and being pushed to Michaels. Still need graphics and selling features.', null, 'sheets-2026-10', v_owner),
    ('Hidden web page for loyal customers (flushing procedure, cleaning and profiling tips, maybe SDS)', '{}'::uuid[], 'Alex Jarvey', 'Website', 'Information we should not share openly with the general public.', null, 'sheets-2026-10', v_owner),
    ('Create content needed for social posts (video reels, pictures, standard video)', '{}'::uuid[], 'BC / AJ', 'Social', '', null, 'sheets-2026-10', v_owner),
    ('Zoho Marketing Automation: work side by side with Brady as it gets implemented with consultants', '{}'::uuid[], 'BC / AJ', 'Planning', 'Ongoing.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Home page: rename About Us to Home, add mission/vision, year established and brief history', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', 'Serves as the central hub and brand identity. From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Our Products page: add DTF Consumables dropdown (Inks, Powder, Film, Parts), retail pricing only with crossed-out MSRP', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', 'Do not show dealer pricing. From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Capabilities page: refresh graphics and add sourcing/development and support sections', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', 'Keep the existing layout. From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Learning Center: new page with FAQs (safety and compliance), setup guides and tutorials subpages', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', 'FAQ page is on the staging site (50 question limit). From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Product detail pages: safety-first copy per product, downloadable TDS PDFs, updated product graphics', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', ' From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Visual enhancements: printer-in-action video in the Learning Center, replace outdated graphics', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', ' From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Website plan: Site navigation: rename menu tabs (Home, Products, Capabilities, Technical Achievements, Learning Center, How to Order)', array(select id from public.profiles where role = 'owner'), 'Ali Bea', 'Website', 'Make sure all new pages are reachable from the main nav. From the 2025 website plan. Check whether this was already done.', null, 'sheets-2026-10', v_owner),
    ('Flyer: co-branded MP4 and Shaker/Dryer unit (one flyer)', '{}'::uuid[], 'Team', 'Flyers / TDS', 'From the 2025 marketing goals list.', null, 'sheets-2026-10', v_owner),
    ('Flyer: co-branded cutter option', '{}'::uuid[], 'Team', 'Flyers / TDS', 'From the 2025 marketing goals list.', null, 'sheets-2026-10', v_owner),
    ('Flyer: Caldera RIP software information and capabilities', '{}'::uuid[], 'Team', 'Flyers / TDS', 'From the 2025 marketing goals list.', null, 'sheets-2026-10', v_owner),
    ('Decide: dye sub papers. Compatible with MS JP4/MP4, and does it compete with current MS Italy distributors?', '{}'::uuid[], 'Team', 'Planning', 'From the 2025 marketing goals list.', null, 'sheets-2026-10', v_owner),
    ('Brainstorm: focus communication and literature on distributors rather than end customers', '{}'::uuid[], 'Team', 'Planning', 'Who are the distributors, and what is the flow of goods? From the 2025 marketing goals list.', null, 'sheets-2026-10', v_owner),
    ('Apparelist article: "20 Critical Questions You Need to Ask Before Purchasing Your Next DTF Printer"', '{}'::uuid[], 'Team', 'Content', 'Include information on safety. From the 2025 marketing goals list.', null, 'sheets-2026-10', v_owner),
    ('Collect customer testimonials (written and video) for the website and socials', array(select id from public.profiles where display_name ilike 'jodi%') || array(select id from public.profiles where display_name ilike 'marcel%') || array(select id from public.profiles where display_name ilike 'brady%'), 'Marcel / Jodi / Brady', 'Content', 'Wilson written testimonial (Jodi). Others noted: Shimsen''s, SunFrog, BasicPrint, Wolfsmark, Stephan Soccer, Kettle Embroidery.', null, 'sheets-2026-10', v_owner),
    ('Printing United 2026: shared booth with NC, MS, JK and Lindmo ($15K total contribution). Start planning', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%') || array(select id from public.profiles where display_name ilike 'jodi%') || array(select id from public.profiles where display_name ilike 'marcel%'), 'Team', 'Tradeshow', 'From the Printing United 2026 notes.', null, 'sheets-2026-10', v_owner),
    ('Renew OEKO-TEX certification for the S201 film (working with the supplier)', '{}'::uuid[], 'Hemant / Team', 'Compliance', 'From the Safety checklist.', null, 'sheets-2026-10', v_owner),
    ('Monthly marketing meeting, 10:30am CST (review Goals & Metrics + Weekly Plan)', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%'), 'Team', 'Planning', '1st Monday.', '2026-10-05'::date, 'sheets-2026-10', v_owner),
    ('Monthly marketing meeting, 10:30am CST (review Goals & Metrics + Weekly Plan)', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%'), 'Team', 'Planning', '1st Monday.', '2026-11-02'::date, 'sheets-2026-10', v_owner),
    ('Alex''s monthly print video (DTF prints being made) delivered to Ali Bea + Jake', '{}'::uuid[], 'Alex', 'NuFun', '1st Thursday. Used in NuFun posts + Jake''s print sales. Needed for NuFun posts and Jake''s print sales.', '2026-11-05'::date, 'sheets-2026-10', v_owner),
    ('Alex''s monthly print video (DTF prints being made) delivered to Ali Bea + Jake', '{}'::uuid[], 'Alex', 'NuFun', '1st Thursday. Used in NuFun posts + Jake''s print sales. Needed for NuFun posts and Jake''s print sales.', '2026-12-03'::date, 'sheets-2026-10', v_owner),
    ('Monthly marketing meeting, 10:30am CST (review Goals & Metrics + Weekly Plan)', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%'), 'Team', 'Planning', '1st Monday.', '2026-12-07'::date, 'sheets-2026-10', v_owner),
    ('Monthly marketing meeting, 10:30am CST (review Goals & Metrics + Weekly Plan)', array(select id from public.profiles where role = 'owner') || array(select id from public.profiles where display_name ilike 'brady%'), 'Team', 'Planning', '1st Monday.', '2027-01-04'::date, 'sheets-2026-10', v_owner),
    ('Alex''s monthly print video (DTF prints being made) delivered to Ali Bea + Jake', '{}'::uuid[], 'Alex', 'NuFun', '1st Thursday. Used in NuFun posts + Jake''s print sales. Needed for NuFun posts and Jake''s print sales.', '2027-01-07'::date, 'sheets-2026-10', v_owner);

  -- 3. Email + social calendar (Draft: submit for approval from the Content tab)
  insert into public.content_items (publish_date, brand, channel, kind, title, brief, notes, video_id, status, source, created_by)
  select c.d::date, c.brand, c.channel,
    case when c.t like 'offer%' then 'offer' when c.t like 'video%' then 'video' when c.t = 'takeaway_post' then 'takeaway' else 'reminder' end,
    case c.t
      when 'video_email' then 'Video ' || c.vn || ' email'
      when 'reminder_email' then 'Reminder email: recap of Video ' || c.vn
      when 'video_post' then 'Video ' || c.vn || ' vertical video post'
      when 'takeaway_post' then 'Video ' || c.vn || ' takeaway post'
      when 'article_post' then 'Video ' || c.vn || ' article / credibility post'
      when 'offer_email_disc' then 'NuFun offer email: discontinued products'
      when 'offer_email_print' then 'NuFun offer email: print offer'
      when 'offer_post_disc' then 'NuFun post: discontinued products'
      else 'NuFun post: print offer' end,
    case c.t
      when 'video_email' then 'VIDEO EMAIL: link to the video and its article on the Safety & Compliance page.'
      when 'reminder_email' then 'REMINDER EMAIL: recap of the video, "in case you missed it" link, tease the next video.'
      when 'video_post' then 'Post the vertical video. Caption: 1-2 line takeaway + link to the article.'
      when 'takeaway_post' then 'Takeaway post: key stat or one-line lesson graphic, link to the article.'
      when 'article_post' then 'Share the video article (blog link) or a behind-the-scenes / credibility post. Keep the page active.'
      when 'offer_email_disc' then 'Discount / clearance offer on discontinued products, point to the Amazon listing.'
      when 'offer_email_print' then 'Discount / offer on custom DTF prints (supports Jake''s print selling).'
      when 'offer_post_disc' then 'Discount / clearance offer on discontinued products, point to the Amazon listing. Use Alex''s latest print video/photos.'
      else 'Discount / offer on custom DTF prints (supports Jake''s print selling). Use Alex''s latest print video/photos.' end,
    case when c.t like '%email' then 'Klaviyo. Credibility/trust tone, not a product pitch.'
         when c.t = 'video_post' then 'Reel on IG.'
         when c.t = 'takeaway_post' then 'Non-sales. Same asset on all 3 channels.'
         when c.t = 'article_post' then 'Off week: 1 post per channel.'
         else '' end,
    (select id from public.videos where number = c.vn and brand = 'NuCoat' limit 1),
    'draft', 'sheets-2026-10', v_owner
  from (values
    ('2026-10-06', 'NuCoat', 'email', 'video_email', 2),
    ('2026-10-07', 'NuFun', 'email', 'offer_email_disc', null),
    ('2026-10-07', 'NuCoat', 'facebook', 'video_post', 2),
    ('2026-10-07', 'NuCoat', 'instagram', 'video_post', 2),
    ('2026-10-07', 'NuCoat', 'linkedin', 'video_post', 2),
    ('2026-10-08', 'NuFun', 'facebook', 'offer_post_disc', null),
    ('2026-10-08', 'NuFun', 'instagram', 'offer_post_disc', null),
    ('2026-10-09', 'NuCoat', 'facebook', 'takeaway_post', 2),
    ('2026-10-09', 'NuCoat', 'instagram', 'takeaway_post', 2),
    ('2026-10-09', 'NuCoat', 'linkedin', 'takeaway_post', 2),
    ('2026-10-13', 'NuCoat', 'email', 'reminder_email', 2),
    ('2026-10-15', 'NuCoat', 'facebook', 'article_post', 2),
    ('2026-10-15', 'NuCoat', 'instagram', 'article_post', 2),
    ('2026-10-15', 'NuCoat', 'linkedin', 'article_post', 2),
    ('2026-10-20', 'NuCoat', 'email', 'video_email', 3),
    ('2026-10-21', 'NuFun', 'email', 'offer_email_print', null),
    ('2026-10-21', 'NuCoat', 'facebook', 'video_post', 3),
    ('2026-10-21', 'NuCoat', 'instagram', 'video_post', 3),
    ('2026-10-21', 'NuCoat', 'linkedin', 'video_post', 3),
    ('2026-10-22', 'NuFun', 'facebook', 'offer_post_print', null),
    ('2026-10-22', 'NuFun', 'instagram', 'offer_post_print', null),
    ('2026-10-23', 'NuCoat', 'facebook', 'takeaway_post', 3),
    ('2026-10-23', 'NuCoat', 'instagram', 'takeaway_post', 3),
    ('2026-10-23', 'NuCoat', 'linkedin', 'takeaway_post', 3),
    ('2026-10-27', 'NuCoat', 'email', 'reminder_email', 3),
    ('2026-10-29', 'NuCoat', 'facebook', 'article_post', 3),
    ('2026-10-29', 'NuCoat', 'instagram', 'article_post', 3),
    ('2026-10-29', 'NuCoat', 'linkedin', 'article_post', 3),
    ('2026-11-03', 'NuCoat', 'email', 'video_email', 4),
    ('2026-11-04', 'NuFun', 'email', 'offer_email_disc', null),
    ('2026-11-04', 'NuCoat', 'facebook', 'video_post', 4),
    ('2026-11-04', 'NuCoat', 'instagram', 'video_post', 4),
    ('2026-11-04', 'NuCoat', 'linkedin', 'video_post', 4),
    ('2026-11-05', 'NuFun', 'facebook', 'offer_post_disc', null),
    ('2026-11-05', 'NuFun', 'instagram', 'offer_post_disc', null),
    ('2026-11-06', 'NuCoat', 'facebook', 'takeaway_post', 4),
    ('2026-11-06', 'NuCoat', 'instagram', 'takeaway_post', 4),
    ('2026-11-06', 'NuCoat', 'linkedin', 'takeaway_post', 4),
    ('2026-11-10', 'NuCoat', 'email', 'reminder_email', 4),
    ('2026-11-12', 'NuCoat', 'facebook', 'article_post', 4),
    ('2026-11-12', 'NuCoat', 'instagram', 'article_post', 4),
    ('2026-11-12', 'NuCoat', 'linkedin', 'article_post', 4),
    ('2026-11-17', 'NuCoat', 'email', 'video_email', 5),
    ('2026-11-18', 'NuFun', 'email', 'offer_email_print', null),
    ('2026-11-18', 'NuCoat', 'facebook', 'video_post', 5),
    ('2026-11-18', 'NuCoat', 'instagram', 'video_post', 5),
    ('2026-11-18', 'NuCoat', 'linkedin', 'video_post', 5),
    ('2026-11-19', 'NuFun', 'facebook', 'offer_post_print', null),
    ('2026-11-19', 'NuFun', 'instagram', 'offer_post_print', null),
    ('2026-11-20', 'NuCoat', 'facebook', 'takeaway_post', 5),
    ('2026-11-20', 'NuCoat', 'instagram', 'takeaway_post', 5),
    ('2026-11-20', 'NuCoat', 'linkedin', 'takeaway_post', 5),
    ('2026-11-24', 'NuCoat', 'email', 'reminder_email', 5),
    ('2026-11-25', 'NuCoat', 'facebook', 'article_post', 5),
    ('2026-11-25', 'NuCoat', 'instagram', 'article_post', 5),
    ('2026-11-25', 'NuCoat', 'linkedin', 'article_post', 5),
    ('2026-12-01', 'NuCoat', 'email', 'video_email', 6),
    ('2026-12-02', 'NuFun', 'email', 'offer_email_disc', null),
    ('2026-12-02', 'NuCoat', 'facebook', 'video_post', 6),
    ('2026-12-02', 'NuCoat', 'instagram', 'video_post', 6),
    ('2026-12-02', 'NuCoat', 'linkedin', 'video_post', 6),
    ('2026-12-03', 'NuFun', 'facebook', 'offer_post_disc', null),
    ('2026-12-03', 'NuFun', 'instagram', 'offer_post_disc', null),
    ('2026-12-04', 'NuCoat', 'facebook', 'takeaway_post', 6),
    ('2026-12-04', 'NuCoat', 'instagram', 'takeaway_post', 6),
    ('2026-12-04', 'NuCoat', 'linkedin', 'takeaway_post', 6),
    ('2026-12-08', 'NuCoat', 'email', 'reminder_email', 6),
    ('2026-12-10', 'NuCoat', 'facebook', 'article_post', 6),
    ('2026-12-10', 'NuCoat', 'instagram', 'article_post', 6),
    ('2026-12-10', 'NuCoat', 'linkedin', 'article_post', 6),
    ('2026-12-15', 'NuCoat', 'email', 'video_email', 7),
    ('2026-12-16', 'NuFun', 'email', 'offer_email_print', null),
    ('2026-12-16', 'NuCoat', 'facebook', 'video_post', 7),
    ('2026-12-16', 'NuCoat', 'instagram', 'video_post', 7),
    ('2026-12-16', 'NuCoat', 'linkedin', 'video_post', 7),
    ('2026-12-17', 'NuFun', 'facebook', 'offer_post_print', null),
    ('2026-12-17', 'NuFun', 'instagram', 'offer_post_print', null),
    ('2026-12-18', 'NuCoat', 'facebook', 'takeaway_post', 7),
    ('2026-12-18', 'NuCoat', 'instagram', 'takeaway_post', 7),
    ('2026-12-18', 'NuCoat', 'linkedin', 'takeaway_post', 7),
    ('2026-12-22', 'NuCoat', 'email', 'reminder_email', 7),
    ('2026-12-23', 'NuCoat', 'facebook', 'article_post', 7),
    ('2026-12-23', 'NuCoat', 'instagram', 'article_post', 7),
    ('2026-12-23', 'NuCoat', 'linkedin', 'article_post', 7),
    ('2026-12-29', 'NuCoat', 'email', 'video_email', 8),
    ('2026-12-30', 'NuCoat', 'facebook', 'video_post', 8),
    ('2026-12-30', 'NuCoat', 'instagram', 'video_post', 8),
    ('2026-12-30', 'NuCoat', 'linkedin', 'video_post', 8),
    ('2026-12-31', 'NuCoat', 'facebook', 'takeaway_post', 8),
    ('2026-12-31', 'NuCoat', 'instagram', 'takeaway_post', 8),
    ('2026-12-31', 'NuCoat', 'linkedin', 'takeaway_post', 8),
    ('2027-01-05', 'NuCoat', 'email', 'reminder_email', 8),
    ('2027-01-06', 'NuFun', 'email', 'offer_email_disc', null),
    ('2027-01-07', 'NuCoat', 'facebook', 'article_post', 8),
    ('2027-01-07', 'NuFun', 'facebook', 'offer_post_disc', null),
    ('2027-01-07', 'NuCoat', 'instagram', 'article_post', 8),
    ('2027-01-07', 'NuFun', 'instagram', 'offer_post_disc', null),
    ('2027-01-07', 'NuCoat', 'linkedin', 'article_post', 8),
    ('2027-01-12', 'NuCoat', 'email', 'video_email', 9),
    ('2027-01-13', 'NuCoat', 'facebook', 'video_post', 9),
    ('2027-01-13', 'NuCoat', 'instagram', 'video_post', 9),
    ('2027-01-13', 'NuCoat', 'linkedin', 'video_post', 9),
    ('2027-01-15', 'NuCoat', 'facebook', 'takeaway_post', 9),
    ('2027-01-15', 'NuCoat', 'instagram', 'takeaway_post', 9),
    ('2027-01-15', 'NuCoat', 'linkedin', 'takeaway_post', 9),
    ('2027-01-20', 'NuFun', 'email', 'offer_email_print', null),
    ('2027-01-21', 'NuFun', 'facebook', 'offer_post_print', null),
    ('2027-01-21', 'NuFun', 'instagram', 'offer_post_print', null)
  ) as c(d, brand, channel, t, vn);
end $$;
