# NuCoat Ops

A shared content-ops tool for the NuCoat video series: a 6-stage pipeline for the
14 compliance videos (plus NuFun teasers), a content calendar for posts and emails with
approvals, a request queue for design and outside-scope work, a calendar, a team task
list, and a private retainer-hours tracker that only the owner can see.

Stack: **React + Vite** (frontend) · **Supabase** (database, login, live sync) ·
**Netlify** (hosting). Same stack as Karrya9. No AI key is needed.

## Try it first (no setup)

```
npm install
npm run dev
```

With no Supabase keys, the app opens in **demo mode** with sample data. Pick a person
on the first screen (Ali, Jodi, Marcel, Brady) and use the dropdown in the yellow bar to
switch between them. Nothing is saved; a refresh resets it. Add `?demo` to the live
address any time to see demo mode there too.

## Who can do what

| | Ali (owner) | Jodi, Marcel, Brady (editors) |
|---|---|---|
| See every video, script, post, comment | yes | yes |
| Edit videos, posts, checklist, internal notes | yes | yes |
| Task list | yes | yes |
| Approve Alistair's posts and videos | videos only | **yes** (any editor) |
| Approve a post they created themselves | no | no |
| Submit requests | yes | yes |
| Accept or decline requests, set estimates | yes | no |
| **Hours, billing, retainer terms** | **yes** | **never** |
| Change roles (Team tab) | yes | no |

There is also an optional **Reviewer** role for an outside person who should only read and approve.

These limits are enforced in the database (row level security), not just hidden on
screen, so they hold even if someone pokes at the app. Hours live in tables that only
the owner account can read.

## 1. Create the Supabase project

1. At [supabase.com](https://supabase.com) create a **new project** (name it "nucoat-ops"). Use a separate project from Karrya9.
2. **SQL Editor > New query**, paste all of `supabase/schema.sql`, click **Run**. This creates everything and seeds the 14 series videos as "Compliance video 01 (rename me)" placeholders.
3. **Authentication > Users > Add user > Create new user**. **Create Alistair's account first.** The first account becomes the **owner**. Then add Jodi, Marcel, and Brady (tick "Auto Confirm User" so they can log in right away).
4. Under **Authentication > Providers**, make sure public sign-ups are off. Only accounts you add by hand should exist.
5. **Project Settings > Data API**: copy the **Project URL** and the **anon public** key.
6. Jodi, Marcel and Brady are **Editors** automatically. Sign in as Alistair, open the **Team** tab, and set each person's display name.
7. **Import the sheet data (optional, once):** SQL Editor > New query > paste `supabase/seed_from_sheets.sql` > Run. It loads the open tasks and the 10/5 onward email and social calendar from the two marketing sheets. Run it after the accounts exist, and only once. It also loads the starter goals for the Metrics tab.

## 2. Deploy

```
cp .env.example .env      # then fill in the two Supabase values
git init
git add -A
git commit -m "NuCoat Ops"
```

Create a **new private GitHub repo**, push to it, then in Netlify choose **Add new site > Import an existing project**, pick the repo, and add two environment variables under **Site configuration > Environment variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Trigger a redeploy so they take effect. Give Brady the site address and his login.

## How the pieces work

- **Stages:** Script, Client approval, Shoot, Edit, Client review, Delivered. Moving a video into Client approval or Client review flags it **Waiting on approval** automatically.
- **Approval buttons:** on the Dashboard (and on each video) any editor can **Approve** or **Request changes** with a note. Approving a script moves it to Shoot; approving the final video moves it to Delivered. Requesting changes sends it back to Script or Edit. Every decision is logged under Comments.
- **Content tab (posts and emails):** Alistair adds each post or email as a Draft, writes the copy, and submits it for approval (one click per week, or per post). Any other editor, usually Brady, sees it under "Needs approval" on their Dashboard and approves or asks for changes with a note. You cannot approve a post you created. After approval, mark it Scheduled then Posted. If someone edits the copy of an approved post, it goes back for approval. This is enforced in the database.
- **Tasks tab:** the team list. Tasks can belong to an app user or to someone outside the app (Alex, Jake, Heather...), have a category, and carry notes.
- **Versions:** each video tracks Long-form and Short-form, with a link to each file (Drive, Dropbox, anywhere).
- **Pre-shoot checklist:** every new video gets the same 9-item checklist automatically. Edit the starting list in `supabase/schema.sql` (function `videos_add_checklist`) before the first run, or add and delete items per video in the app.
- **NuFun:** set a video's Brand to NuFun. It gets a rainbow chip and a tinted calendar color, and you can filter the Series board to NuCoat or NuFun only.
- **Requests (everyone):** anyone submits design or outside-scope work. Ali accepts with an hour estimate, which counts against the weekly retainer, then logs time against it. Others only ever see the status (Submitted, Accepted, In progress, Done, Declined), never hours.
- **Hours (owner only):** weekly meter against the included hours, overage in hours and dollars, what accepted requests still need, and the last 8 weeks. Retainer terms (10 hours, $300, overage rate) are editable. Leave the overage rate blank to pro-rate it from the fee and hours.
- **Tasks:** to-dos assignable to one person or several, optionally tied to a video. They show on that person's Dashboard.
- **Rename videos:** open a video and edit the title at the top, then Save.
- **Metrics tab (Owner and Editors):** the top block is worked out from the app itself (videos delivered, posts and emails marked Posted, tasks finished, tasks per person). Below it are the goals from the Goals & Metrics sheet. Log a number (about five minutes on Fridays); each goal can count as the latest number, a running total, or a total for the month. Add your own with "+ New metric".
- **Dashboard:** every widget opens something. The series bar shows all 14 videos with the delivered ones marked, "Videos in progress" lists them by stage, "Waiting on approval" opens the approval boxes, the task and request tiles open those tabs, and the hours panel opens Hours. You can schedule a shoot straight from the dashboard.
- **Green when done:** the "Green" switch next to Sign out shows finished tasks, posted content, delivered videos, done requests and goals that hit their target in green. It is saved per person and is off by default.
- **Task owners:** tasks from the sheets name people ("Ali Bea / Brady"). Anyone whose profile name starts with that first name sees the task on their list; "Link them" saves it permanently. Use the pencil on a task to edit anything about it, including who it is assigned to.
- **Owner approval:** you can approve a video or a post without submitting it (and approve your own posts); the override buttons only show for the Owner. Editors still cannot approve a post they created.
- **Moving posts:** drag a post or email onto another day on the Calendar, or onto another week on the Content tab. Moving an approved post sends it back for approval.
- **Plan field:** each post has an editable Plan. "Auto-fill from the post" writes one from its type, channel and video; new posts get one automatically.
- **Upgrading an existing project:** run `supabase/migration_02_metrics_and_assignments.sql` and then `supabase/migration_03_owner_override.sql` once each (safe to run again).

## Workspace upgrade (migration 07)

Run `supabase/migration_07_workspace.sql` once in the Supabase SQL Editor. Until it is run the app works exactly as before and the Team tab shows a reminder.

- **Team tab (owner):** a live card per person (open tasks, overdue, approvals waiting, next task, next meeting, projects, when they were last active). Click a person to see their task list and menu.
- **Tabs and features:** a grid of people and tabs. Untick a tab to remove it from that person's menu and dashboard. Click a column name to switch it for everyone but you. Series starts switched off for everyone except the owner. Quick setups: Everything, Marketing, Sales, Projects only. This tidies what people see; it is not a security lock (hours and projects are the locked parts).
- **Teams:** each person has a team (Marketing, Sales, Operations...). The live view filters by it. To bring in a sales person: add their login, set Team to Sales, apply the Sales quick setup, add them to projects.
- **Projects:** only members and the owner can see a project (enforced in the database). Each has tasks, updates, meetings, a status and a target date. "Give each member a tab" puts the project in their menu. People without a login can be listed by name until they have one.
- **Meetings:** add one from the Calendar, the Dashboard or a project. After saving: **Send Teams invite** opens Teams with the title, time and attendees filled in (pressing Send there creates the Teams meeting and emails everyone), **Email invite** opens your mail app, **Calendar file** downloads an .ics. Paste the Teams join link back into the meeting so everyone gets a Join button. Invite emails come from each person's email on the Team tab.
- **Calendar:** now shows meetings and your own task due dates. Click a legend item to hide or show that kind of event.
- **Extra tabs:** the owner can add a tab for any web page (a sales sheet, a report) for everyone or chosen people.
- **Mac widget:** Team tab, "On your Mac". The calendar address feeds your open tasks and meetings into Apple Calendar, whose widget then shows them on the desktop. The mini window (`?mini`) is a small live task list you can add to the Dock from Safari. The feed runs through `netlify/functions/feed.mjs` and uses the same two Supabase environment variables (their scope must include Functions).

## Private project tasks and the weekly digest (migration 08)

Run `supabase/migration_08_private_project_tasks.sql` once, after migration 07.

- **Project tasks are members-only.** A task that belongs to a project is visible only to that project's members and the owner, enforced in the database. Tasks with no project are unchanged. Deleting a project releases its tasks back to the shared Tasks tab.
- **Job titles and who approves.** On the Team tab each person gets a free-text job title (shown instead of Editor/Owner next to their name), and an **Approves** tick. Untick it and they are no longer asked to review posts or videos: the approve buttons disappear and the database refuses the approval. Role still decides what they can edit.
- **Done dates.** Tasks record when they were finished. The live team view and the digest use it.
- **Weekly digest.** Every Monday at 13:00 UTC (8 AM Eastern in winter, 9 AM in summer) the owner gets one email: overdue and stuck items, the week ahead, each person's load, project progress, what was finished, and last week's retainer hours. Test it any time from the Team tab ("Send me this week's digest now").
  - Add two environment variables in Netlify (scope must include Functions), then redeploy:
    - `SUPABASE_SERVICE_ROLE_KEY`: Supabase, Project Settings, API keys, the **secret / service_role** key. Never prefix it with `VITE_`; it must stay on the server.
    - `RESEND_API_KEY`: from a free account at resend.com.
  - Until a domain is verified in Resend, it only delivers to the email address the Resend account was created with. Sign up with the same email that is on the owner's profile, or set `DIGEST_TO`. To send from a NuCoat address later, verify the domain in Resend and set `DIGEST_FROM`.

## Updating later

Copy changed files over the project, then `git add -A`, `git commit`, `git push`. Netlify redeploys on its own. If a `supabase/migration_NNN_*.sql` file ever appears, run it once as a **new query** in the SQL Editor first.
