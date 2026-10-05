import { todayISO, addDays, weekStartISO } from '../constants.js';

export const DEMO_USERS = [
  { id: 'u-ali', email: 'alistair@demo.test', display_name: 'Ali', role: 'owner' },
  { id: 'u-jodi', email: 'jodi@demo.test', display_name: 'Jodi', role: 'editor' },
  { id: 'u-marcel', email: 'marcel@demo.test', display_name: 'Marcel', role: 'editor' },
  { id: 'u-brady', email: 'brady@demo.test', display_name: 'Brady', role: 'editor' }
];

export const CHECKLIST_TEMPLATE = [
  'Script approved by Brady',
  'Talent confirmed (time, wardrobe, no logos clashing)',
  'Location / set cleaned and set up',
  'Product and props staged',
  'Shot list reviewed',
  'Compliance wording double-checked against the script',
  'Audio check (mic, room tone)',
  'Batteries charged, cards cleared, backup drive ready',
  'Cue cards / teleprompter loaded'
];

// Sample topics only, so the demo feels real. The live database starts with
// "Compliance video 01 (rename me)" placeholders instead.
const TITLES = [
  ['Reading a Safety Data Sheet', 'delivered'],
  ['Hazard labels and pictograms', 'delivered'],
  ['Storing DTF powder and ink safely', 'delivered'],
  ['PPE basics in the print shop', 'client_review'],
  ['Handling ink waste', 'edit'],
  ['Powder dust and ventilation', 'edit'],
  ['Heat press safety', 'shoot'],
  ['Fire safety and extinguishers', 'client_approval'],
  ['Spill response', 'shoot'],
  ['Shipping and labeling chemical products', 'client_approval'],
  ['Safe lifting and ergonomics', 'script'],
  ['Machine guarding and lockout', 'script'],
  ['Is DTF film safe? Customer FAQs', 'script'],
  ['Building a safety culture', 'script']
];

export function buildSeed() {
  const today = todayISO();
  const ws = weekStartISO(today);
  const d = (n) => addDays(today, n);
  let n = 0;
  const id = (p) => `${p}-${++n}`;

  const profiles = DEMO_USERS.map((u) => ({ id: u.id, display_name: u.display_name, role: u.role, created_at: d(-60) }));

  const videos = [];
  const checklist = [];
  const internal = [];
  const comments = [];

  TITLES.forEach(([title, stage], i) => {
    const num = i + 1;
    const vid = `v-${num}`;
    const clientStage = stage === 'client_approval' || stage === 'client_review';
    videos.push({
      id: vid,
      number: num,
      title,
      brand: 'NuCoat',
      stage,
      formats: ['long', 'short'],
      talent: 'Jodi',
      shoot_date: stage === 'shoot' ? d(num % 2 ? 2 : 5) : stage === 'script' || stage === 'client_approval' ? d(8 + num) : d(-20 + num),
      due_date: stage === 'delivered' ? d(-10 + num) : d(10 + num * 2),
      summary: stage === 'script' ? '' : `Covers the key points a shop employee needs for: ${title.toLowerCase()}.`,
      script:
        stage === 'script' && num > 11
          ? ''
          : `HOOK (0:00–0:05)\nJodi on camera: "If you handle DTF supplies, here is the one thing to know about ${title.toLowerCase()}."\n\nBODY\n1. What the rule is and why it exists.\n2. Show it on the real product.\n3. The most common mistake.\n\nCLOSE\n"Questions? Reach out to the NuCoat team."`,
      shot_list: stage === 'script' ? '' : 'Wide of Jodi at the bench\nClose-up of product label\nB-roll: hands demonstrating the step\nOver-the-shoulder on screen/SDS',
      long_link: stage === 'delivered' ? 'https://drive.google.com/example-long' : '',
      short_link: stage === 'delivered' ? 'https://drive.google.com/example-short' : '',
      approval_status: clientStage ? 'pending' : stage === 'delivered' ? 'approved' : 'none',
      waiting_on_brady: clientStage,
      waiting_note: clientStage ? 'Needs sign-off on the compliance wording' : '',
      assigned_to: num % 3 === 0 ? ['u-marcel'] : num % 3 === 1 ? ['u-jodi', 'u-ali'] : ['u-ali'],
      created_by: 'u-ali',
      created_at: d(-40),
      updated_at: d(-(15 - num))
    });
    internal.push({ video_id: vid, notes: num === 4 ? 'Brady wants the PPE shot to show the new gloves.' : '' });
    CHECKLIST_TEMPLATE.forEach((title2, k) => {
      const doneCount = stage === 'script' || stage === 'client_approval' ? (stage === 'client_approval' ? 1 : 0) : 9;
      checklist.push({ id: id('c'), video_id: vid, title: title2, done: k < doneCount, position: k + 1, created_at: d(-30) });
    });
    if (stage === 'delivered') {
      comments.push({ id: id('m'), video_id: vid, author: 'u-brady', kind: 'approved', body: 'Looks great, thanks!', created_at: d(-12) });
    }
    if (num === 4) {
      comments.push({ id: id('m'), video_id: vid, author: 'u-jodi', kind: 'comment', body: 'Both cuts are ready for your review, Brady.', created_at: d(-1) });
    }
  });

  // One NuFun teaser alongside the series
  videos.push({
    id: 'v-15', number: 15, title: 'NuFun teaser: the series is coming', brand: 'NuFun', stage: 'edit',
    formats: ['short'], talent: 'Jodi', shoot_date: d(-3), due_date: d(4),
    summary: 'Playful teaser post that prefaces the compliance series.', script: 'Rainbow title card, quick cuts of crafting, "something new is coming" voiceover.',
    shot_list: '', long_link: '', short_link: '', approval_status: 'none', waiting_on_brady: false, waiting_note: '',
    assigned_to: ['u-marcel'], created_by: 'u-ali', created_at: d(-10), updated_at: d(-1)
  });
  internal.push({ video_id: 'v-15', notes: '' });
  CHECKLIST_TEMPLATE.forEach((t, k) => checklist.push({ id: id('c'), video_id: 'v-15', title: t, done: k < 5, position: k + 1, created_at: d(-9) }));

  const tasks = [
    { id: id('t'), title: 'Record voiceover for PPE video', video_id: 'v-4', assigned_to: ['u-jodi'], due_date: d(-1), done: false, created_by: 'u-ali', created_at: d(-6) },
    { id: id('t'), title: 'Color-grade heat press video', video_id: 'v-7', assigned_to: ['u-marcel'], due_date: d(3), done: false, created_by: 'u-ali', created_at: d(-3) },
    { id: id('t'), title: 'Design lower-third template', video_id: null, assigned_to: ['u-marcel', 'u-ali'], due_date: d(5), done: false, created_by: 'u-jodi', created_at: d(-2) },
    { id: id('t'), title: 'Confirm Jodi’s availability for shoot day', video_id: 'v-9', assigned_to: ['u-ali'], due_date: d(1), done: false, created_by: 'u-ali', created_at: d(-2) },
    { id: id('t'), title: 'Export captions for Spill response', video_id: 'v-9', assigned_to: ['u-jodi'], due_date: null, done: true, created_by: 'u-ali', created_at: d(-8) },
    { id: id('t'), title: 'Add pictures to the Google and Apple Maps listings', video_id: null, assigned_to: ['u-ali'], owner_label: 'Ali Bea', category: 'SEO', notes: 'First step toward the 3.7 to 4.5 star goal.', due_date: d(-3), done: false, created_by: 'u-ali', created_at: d(-9) },
    { id: id('t'), title: 'Create ink flyer for X203 inks', video_id: null, assigned_to: ['u-brady'], owner_label: 'Brady', category: 'Flyers / TDS', notes: '', due_date: d(14), done: false, created_by: 'u-ali', created_at: d(-9) },
    { id: id('t'), title: 'Move discontinued products on Amazon: list the SKUs, set pricing, manage stock', video_id: null, assigned_to: [], owner_label: 'Heather / Taylor', category: 'NuFun', notes: 'First SKUs live by the end of the month.', due_date: d(25), done: false, created_by: 'u-ali', created_at: d(-9) },
    { id: id('t'), title: 'Brady: Monday check-in to confirm this week’s email and posts are scheduled', video_id: null, assigned_to: [], owner_label: 'Brady', category: 'Planning', notes: 'Weekly, every Monday.', due_date: d(1), done: false, created_by: 'u-ali', created_at: d(-9) },
    { id: id('t'), title: 'Align the plan with Jodi', video_id: null, assigned_to: ['u-ali'], owner_label: 'Ali Bea / Jodi', category: 'Planning', notes: '', due_date: d(2), done: false, created_by: 'u-ali', created_at: d(-9) },
    { id: id('t'), title: 'Instagram grid cleanup', video_id: null, assigned_to: ['u-ali'], owner_label: 'Ali Bea', category: 'Social', notes: '', due_date: d(-2), done: true, created_by: 'u-ali', created_at: d(-9) },
    { id: id('t'), title: 'Matte Canvas NuCoat TDS', video_id: null, assigned_to: [], owner_label: 'Alex Jarvey', category: 'Flyers / TDS', notes: 'Waiting on info on the aqueous matte canvas option.', due_date: null, done: false, created_by: 'u-ali', created_at: d(-9) }
  ];

  const mon = weekStartISO(today);
  const ci = (n, day, brand, channel, kind, title, status, extra = {}) => ({
    id: `ci-${n}`, publish_date: addDays(mon, day), brand, channel, kind, title, brief: '', caption: '', asset_link: '', notes: '',
    video_id: null, status, created_by: 'u-ali', reviewed_by: null, reviewed_at: null, created_at: d(-5), updated_at: d(-1), ...extra
  });
  const content_items = [
    ci(1, 1, 'NuCoat', 'email', 'video', 'Video 4 email', 'approved', { video_id: 'v-4', brief: 'VIDEO EMAIL: link to the video + its article on the Safety & Compliance page.', caption: 'Is your “non-toxic” ink really non-toxic? Watch Video 4.', reviewed_by: 'u-brady', reviewed_at: d(-1) }),
    ci(2, 2, 'NuCoat', 'facebook', 'video', 'Video 4 vertical video post', 'in_review', { video_id: 'v-4', caption: 'The “non-toxic” ink that wasn’t. 60 seconds on what to ask your supplier. Full article in the comments.' }),
    ci(3, 2, 'NuCoat', 'instagram', 'video', 'Video 4 vertical video post', 'in_review', { video_id: 'v-4', caption: 'The “non-toxic” ink that wasn’t. 60 seconds on what to ask your supplier.' }),
    ci(4, 2, 'NuCoat', 'linkedin', 'video', 'Video 4 vertical video post', 'draft', { video_id: 'v-4' }),
    ci(5, 3, 'NuFun', 'email', 'offer', 'NuFun offer email: print offer', 'changes_requested', { caption: 'Custom DTF prints, 15% off this week.', reviewed_by: 'u-brady', reviewed_at: d(-1) }),
    ci(6, 4, 'NuCoat', 'facebook', 'takeaway', 'Video 4 takeaway post', 'draft', { video_id: 'v-4' }),
    ci(7, 4, 'NuCoat', 'instagram', 'takeaway', 'Video 4 takeaway post', 'draft', { video_id: 'v-4' }),
    ci(8, 4, 'NuCoat', 'linkedin', 'takeaway', 'Video 4 takeaway post', 'draft', { video_id: 'v-4' }),
    ci(9, 8, 'NuCoat', 'email', 'reminder', 'Reminder email: recap of Video 4', 'draft', { video_id: 'v-4' }),
    ci(10, 10, 'NuCoat', 'facebook', 'reminder', 'Video 4 article / credibility post', 'draft', { video_id: 'v-4' }),
    ci(11, 10, 'NuFun', 'instagram', 'offer', 'NuFun post: discontinued products', 'draft')
  ];
  content_items.push(ci(12, -2, 'NuCoat', 'email', 'video', 'Video 3 email', 'posted', { video_id: 'v-3', reviewed_by: 'u-brady', reviewed_at: d(-4) }));
  content_items.push(ci(13, -1, 'NuCoat', 'facebook', 'takeaway', 'Video 3 takeaway post', 'posted', { video_id: 'v-3', reviewed_by: 'u-brady', reviewed_at: d(-4) }));
  const content_comments = [
    { id: id('cm'), content_id: 'ci-1', author: 'u-brady', kind: 'approved', body: 'Good to go.', created_at: d(-1) },
    { id: id('cm'), content_id: 'ci-5', author: 'u-brady', kind: 'changes', body: 'Please state the offer end date and the discount code.', created_at: d(-1) }
  ];

  const requests = [
    { id: 'r-1', title: 'Social graphic for the NuFun launch teaser', details: 'Square and story sizes, rainbow palette.', kind: 'graphic_design', status: 'accepted', requested_by: 'u-brady', due_date: d(6), video_id: 'v-15', decline_reason: '', created_at: d(-4), updated_at: d(-3) },
    { id: 'r-2', title: 'Update Facebook cover with the new product line', details: '', kind: 'graphic_design', status: 'submitted', requested_by: 'u-brady', due_date: d(9), video_id: null, decline_reason: '', created_at: d(-1), updated_at: d(-1) },
    { id: 'r-3', title: 'Extra Instagram story set for the trade show', details: 'Five frames, booth number and dates.', kind: 'extra_posts', status: 'submitted', requested_by: 'u-jodi', due_date: d(12), video_id: null, decline_reason: '', created_at: d(-1), updated_at: d(-1) },
    { id: 'r-4', title: 'Resize logo for the packaging mockup', details: '', kind: 'graphic_design', status: 'done', requested_by: 'u-marcel', due_date: d(-5), video_id: null, decline_reason: '', created_at: d(-12), updated_at: d(-6) }
  ];
  const request_estimates = [
    { request_id: 'r-1', estimate_hours: 3 },
    { request_id: 'r-4', estimate_hours: 1 }
  ];

  const lastWeek = addDays(ws, -7);
  const twoAgo = addDays(ws, -14);
  const te = [];
  const add = (date, hours, kind, note, extra = {}) => {
    if (date <= today) te.push({ id: id('h'), entry_date: date, hours, kind, note, video_id: null, request_id: null, created_at: date, ...extra });
  };
  add(twoAgo, 3, 'content', 'Script edits', { video_id: 'v-2' });
  add(addDays(twoAgo, 1), 2.5, 'content', 'Edit session', { video_id: 'v-2' });
  add(addDays(twoAgo, 3), 2, 'content', 'Shoot day prep', { video_id: 'v-3' });
  add(addDays(twoAgo, 4), 1.5, 'admin', 'Client call with Brady');
  add(lastWeek, 2.5, 'content', 'Rough cut', { video_id: 'v-4' });
  add(addDays(lastWeek, 1), 3, 'content', 'Edit and captions', { video_id: 'v-4' });
  add(addDays(lastWeek, 2), 1, 'request', 'Logo resize', { request_id: 'r-4' });
  add(addDays(lastWeek, 3), 3, 'content', 'Shoot day', { video_id: 'v-7' });
  add(addDays(lastWeek, 4), 2, 'admin', 'Planning and client emails');
  add(ws, 2.5, 'content', 'Heat press edit', { video_id: 'v-6' });
  add(addDays(ws, 1), 1.5, 'request', 'Teaser graphic draft', { request_id: 'r-1', video_id: 'v-15' });
  add(addDays(ws, 2), 2, 'content', 'Review notes', { video_id: 'v-5' });

  const mk = (n, brand, name, extra) => ({ id: `m-${n}`, brand, name, detail: '', unit: '', kind: 'number', rollup: 'latest', baseline: null, target: null, target_label: '', relative: false, monthly_targets: null, target_date: null, owner_label: 'Ali Bea', notes: '', position: n, created_by: 'u-ali', created_at: d(-20), ...extra });
  const month = today.slice(0, 7);
  const metrics = [
    mk(1, 'NuCoat', 'Google rating', { unit: '★', baseline: 3.7, target: 4.5, target_date: addDays(today, 150), detail: 'Google Business rating (stars)' }),
    mk(2, 'NuCoat', 'New Google reviews (Q4)', { rollup: 'sum', baseline: 0, target: 15, target_label: '5 / month', target_date: addDays(today, 85) }),
    mk(3, 'NuCoat', 'Compliance video views on the website', { rollup: 'month', baseline: 23, target: 110, target_label: 'Oct 60 · Nov 85 · Dec 110', monthly_targets: { [month]: 60 }, detail: 'Entry sessions on the compliance page or a video page' }),
    mk(4, 'NuCoat', 'YouTube views (compliance videos)', { target: 1000, relative: true, target_label: '+1,000 over the first number logged' }),
    mk(5, 'NuCoat', 'Instagram grid cleanup', { kind: 'yesno', baseline: 0, target: 1 }),
    mk(6, 'NuCoat', 'Email click rate', { unit: '%', target_label: 'target to set' }),
    mk(7, 'NuFun', 'Print calls', { rollup: 'sum', baseline: 0, owner_label: 'Jake', target_label: 'target to set' })
  ];
  const metric_entries = [];
  const me2 = (m, off, value, note = '') => metric_entries.push({ id: id('me'), metric_id: m, entry_date: d(off), value, note, created_by: 'u-ali', created_at: d(off) });
  me2('m-1', -20, 3.7); me2('m-1', -2, 3.9, 'Two new reviews');
  me2('m-2', -10, 2); me2('m-2', -3, 3);
  me2('m-3', -9, 14); me2('m-3', -2, 21);
  me2('m-4', -12, 4120, 'Baseline'); me2('m-4', -1, 4560);
  me2('m-5', -4, 1, 'Done');
  me2('m-6', -6, 1.8); me2('m-6', -1, 2.4);
  me2('m-7', -8, 14); me2('m-7', -1, 22);

  return {
    profiles, videos, video_internal: internal, checklist_items: checklist, video_comments: comments,
    tasks, content_items, content_comments, metrics, metric_entries, requests, request_estimates, time_entries: te,
    billing_settings: [{ id: 1, weekly_cap_hours: 10, weekly_fee: 300, overage_rate: null }]
  };
}
