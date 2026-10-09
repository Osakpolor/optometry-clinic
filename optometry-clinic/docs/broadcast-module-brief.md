# Build brief — WhatsApp Broadcast / Campaigns module

**For:** Claude Code, working in the `optometry-clinic` repo.
**Author:** Osakpolor (planned with Claude on claude.ai).
**Status:** ready to build. Olu Eye Clinic is LIVE and in production use.

---

## 0. How to use this brief (read first)

- This is a **beginner-owned** codebase. Write **complete file contents**, not diffs,
  for any new file. For edits to existing files, show the full updated file unless the
  change is one or two clearly-scoped lines.
- **Never work on `main`.** `main` auto-deploys to Vercel production, which the clinic
  is using right now. Do ALL work on a feature branch:
  ```
  git checkout -b feature/broadcasts
  ```
  Commit in small steps per phase. When a phase is tested on the Vercel **preview**
  deployment, we merge via PR. Do not merge to main yourself without the go-ahead.
- Build in the **phases below, in order**. Stop after each phase so it can be tested
  before moving on. Don't scaffold all phases at once.
- Match the existing design system exactly: Geist font, brand teal (`bg-brand`,
  `text-foreground`, `text-muted-foreground` tokens already in the Tailwind/shadcn
  setup), `max-w-5xl` containers, shadow-sm bordered cards, sentence-case titles,
  shadcn `Button`/`Separator`/etc.
- **Reuse existing code, don't reinvent it.** In particular reuse, from `lib/whatsapp.ts`:
  `formatNigerianPhone()`, `logWhatsAppMessage()`, the `getSettings()` /
  `isAllowedRecipient()` / `settings.automated_sends_enabled` control layer, and the
  exact template-send shape used by `sendAppointmentReminderTemplate()`.

---

## 1. What we're building

An admin-only **Broadcasts** section in the dashboard that sends one approved WhatsApp
**Marketing template** (image header + text body + a URL button) to many patients at
once — e.g. a World Sight Day greeting — either **now** or **scheduled** for a date.
Every recipient's delivery status is tracked. Opted-out patients are always excluded.

Scale: ~2,000 patients today. Must be throttled and resumable.

Two product decisions already made:
- **Scheduling: YES** in v1 (schedule a broadcast for a future date).
- **Header image: UPLOAD** in v1 (admin uploads an image per campaign — not a preset library).

---

## 2. Hard constraints (don't design around these — design WITH them)

1. **Vercel Hobby = 1 cron/day, already used** by `app/api/cron/appointment-reminders/route.ts`.
   The broadcast sender therefore must NOT depend on a new frequent Vercel cron.
   We use a **self-chaining drain endpoint** instead (see §5). Scheduled broadcasts are
   picked up by appending a few lines to the EXISTING daily cron.
2. **Marketing cap / error 131049.** Marketing-category templates are subject to a
   per-user cap and can be silently dropped (this already happened in production — see
   the comment in `sendVisitThankYou`). Treat a `131049` response as recipient status
   `capped`, NOT a failure, and keep going. Expect meaningfully less than 100% delivery.
3. **24-hour window.** Broadcasts go to people who haven't messaged recently, so they
   MUST be an approved **template** send (not free-form text). Free-form is impossible here.
4. **Respect the messaging-control layer.** The sender must honour
   `settings.automated_sends_enabled` (global pause) and `isAllowedRecipient()` (test-mode
   allowlist), exactly like `sendAppointmentReminderTemplate()` does.
5. **Opt-out is mandatory** for marketing. Excluded always; "STOP" sets the flag.

---

## 3. SaaS / multi-tenant readiness (do the cheap half now)

Vision is to make this EMR multi-tenant later. For THIS module:
- **Do now (cheap):** add a `clinic_id` column to every new table, and create a `clinics`
  table with one row for Olu. This means tenant-scoping is already in the schema.
- **Do NOT do now:** per-clinic WhatsApp credentials, tenant onboarding, billing/metering,
  RLS-by-tenant on existing tables. In v1 the sender keeps reading the existing env vars
  (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`) — leave a `// TODO(multi-tenant): read
  WA creds from clinics row` where it reads them. We'll switch to per-clinic creds in a
  later multi-tenant phase. Keeping env-based send in v1 avoids a risky creds migration
  on a live app.

---

## 4. Data model

### Migration SQL (Phase 1)

New table `clinics` (SaaS anchor, one row now):
- `id uuid pk default gen_random_uuid()`
- `name text not null`
- `wa_phone_number_id text` (nullable; unused in v1, for later per-tenant creds)
- `wa_waba_id text`
- `messaging_tier text`
- `created_at timestamptz default now()`
- Seed one row: name 'Olu Eye Clinic'.

New table `broadcasts`:
- `id uuid pk default gen_random_uuid()`
- `clinic_id uuid references clinics(id)`
- `title text not null`
- `template_name text not null`
- `language text not null default 'en'`
- `header_image_url text`            -- public Supabase Storage URL
- `body_params jsonb default '[]'`   -- ordered body {{1}},{{2}}… values
- `button_url text`                  -- URL-button value if the template has a dynamic button
- `audience_filter jsonb default '{}'`
- `status text not null default 'draft'`  -- draft|scheduled|sending|sent|failed
- `scheduled_at timestamptz`
- `total_count int default 0`
- `sent_count int default 0`
- `delivered_count int default 0`
- `read_count int default 0`
- `failed_count int default 0`
- `capped_count int default 0`
- `created_by uuid references staff_profiles(id)`
- `created_at timestamptz default now()`

New table `broadcast_recipients` (the queue AND the delivery log):
- `id uuid pk default gen_random_uuid()`
- `broadcast_id uuid references broadcasts(id) on delete cascade`
- `patient_id uuid references patients(id)`
- `phone text not null`
- `status text not null default 'queued'`  -- queued|sent|delivered|read|failed|skipped|capped
- `wa_message_id text`                      -- Meta message id, for status webhook matching
- `error text`
- `sent_at timestamptz`
- `updated_at timestamptz default now()`
- Index on `(broadcast_id, status)` and on `wa_message_id`.

Alter `patients`:
- `add column marketing_opted_out boolean not null default false`
- `add column marketing_opted_out_at timestamptz`

Supabase Storage:
- Create a **public** bucket `broadcast-media` for uploaded header images (same approach
  as the existing patient-documents storage). Public so Meta can fetch the image by URL.

> Remember the project gotcha: PostgREST caps reads at 1000 rows. When enqueuing ~2,000
> recipients, page through patients with the service-role admin client and `.range()`, or
> insert in chunks — don't assume one `.select()` returns everyone.

---

## 5. Sending pipeline

### 5a. New lib `lib/broadcasts.ts`

A `sendBroadcastTemplate()` that mirrors `sendAppointmentReminderTemplate()` but builds a
template with an **image header + body params + optional URL button component**, e.g.:

```ts
template: {
  name: broadcast.template_name,
  language: { code: broadcast.language },
  components: [
    { type: 'header', parameters: [{ type: 'image', image: { link: headerImageUrl } }] },
    { type: 'body',   parameters: bodyParams.map(t => ({ type: 'text', text: t })) },
    // include a button component only if the approved template has a dynamic URL button
  ],
}
```
- Use the same `API_URL`, `ACCESS_TOKEN`, headers as `lib/whatsapp.ts`.
- Before sending each recipient: check `settings.automated_sends_enabled` and
  `isAllowedRecipient()` (reuse `getSettings()`); skip → status `skipped`.
- On success: status `sent`, store `wa_message_id`, call `logWhatsAppMessage()` so the
  broadcast shows in the Conversations viewer.
- On Meta error `131049`: status `capped` (not failed).
- Other errors: status `failed`, store `error`.

### 5b. Drain endpoint `app/api/broadcasts/drain/route.ts` (self-chaining)

Auth: `Authorization: Bearer ${CRON_SECRET}` header, same as the reminders cron.
Logic:
1. Find broadcasts with status `sending`. (Optionally accept a `broadcast_id` query param.)
2. Pull the next batch of `queued` recipients (BATCH_SIZE ~ 40) for that broadcast,
   excluding `marketing_opted_out` patients.
3. Send each via `sendBroadcastTemplate()`, update recipient row + roll up broadcast counts.
4. If `queued` rows remain → **trigger the next invocation**: `await fetch(<self URL>/api/broadcasts/drain, { headers: { Authorization: Bearer CRON_SECRET } })` and return. Each
   invocation is short, so no serverless timeout. Idempotent: only ever touches `queued`
   rows, so an overlap can never double-send.
5. If none remain → set broadcast status `sent`, return summary.

> Scaling note (not for v1): if you later move to Vercel **Pro**, you can replace the
> self-chaining with a per-minute cron. Alternatively Supabase `pg_cron` can drain the
> queue independently of Vercel. Keep v1 self-chaining — zero extra cost, one codebase.

### 5c. Send-now vs Schedule

- **Send now:** a server action sets broadcast `sending`, enqueues recipient rows
  (all active non-opted-out patients matching `audience_filter`), then kicks the drain
  endpoint once.
- **Schedule:** store `status='scheduled'` + `scheduled_at`. Then, in the EXISTING daily
  cron `app/api/cron/appointment-reminders/route.ts`, AFTER the reminder windows, add:
  find broadcasts where `status='scheduled'` and `scheduled_at <= now()`, set them
  `sending`, enqueue recipients, kick the drain endpoint. Daily granularity is fine for
  date-based campaigns like World Sight Day. (Finer-grained timing would need Vercel Pro.)

---

## 6. Delivery tracking + opt-out (extend the existing webhook)

In `app/api/whatsapp/webhook/route.ts`:
- **Statuses:** Meta also posts `value.statuses[]` (not just `value.messages`). Handle it:
  match `statuses[].id` to `broadcast_recipients.wa_message_id`, update status to
  `delivered` / `read` / `failed`, roll up the broadcast's counts. Map error `131049`
  here to `capped` too.
- **STOP:** in the inbound-message path, if the text (trimmed, upper-cased) is `STOP`,
  `UNSUBSCRIBE`, or `CANCEL`, set that patient's `marketing_opted_out = true` and
  `marketing_opted_out_at = now()`, and reply confirming they won't get marketing messages.

---

## 7. Permissions + nav

- `lib/auth/roles.ts`: add
  ```ts
  export function canManageBroadcasts(role: string | null): boolean {
    return role === 'admin'
  }
  ```
- `components/DashboardNav.tsx`: add Broadcasts to the **admin-only** array, next to Staff
  and Audit:
  ```ts
  { href: '/dashboard/broadcasts', label: 'Broadcasts' },
  ```
- Server-side guard every `/dashboard/broadcasts*` page and the server actions with
  `canManageBroadcasts(await getUserRole())`, redirecting non-admins — same pattern as the
  existing admin pages.

---

## 8. UI (admin-only, existing design system)

1. `/dashboard/broadcasts` — campaign list: title, status badge, sent/delivered/read/
   capped counts, date. Badge colors like the rebooking status badges.
2. `/dashboard/broadcasts/new` — composer:
   - Template name (text for now; later a registry) + language.
   - **Header image upload** → upload to `broadcast-media` bucket → store public URL.
   - Body param inputs ({{1}}, {{2}}…) with helper text.
   - Button URL (if the template has a dynamic URL button).
   - Audience: default "all active patients (excluding opted-out)", with optional filters
     (last-visit range, has upcoming appointment). Show a live **recipient count**.
   - A WhatsApp-style **preview bubble** (image + body + button).
   - "Send now" or "Schedule" (date/time picker → `scheduled_at`).
3. `/dashboard/broadcasts/[id]` — detail: delivery funnel (queued→sent→delivered→read,
   plus failed/capped) and the recipient table with per-row status.

---

## 9. Phase order (stop after each; test on Vercel preview)

- **Phase 0 (manual, Osakpolor, in Meta — blocks sending):** create & get approval for a
  **Marketing** template with an IMAGE header, body variables, and (optional) a URL button.
  Note its exact name + variable order. Nothing can send until this is approved.
- **Phase 1:** migration SQL (tables, patient columns, indexes) + `broadcast-media` bucket.
- **Phase 2:** `lib/broadcasts.ts` sender + `/api/broadcasts/drain` self-chaining endpoint.
  Test by enqueuing ONE recipient (your own allowlisted number, test mode on).
- **Phase 3:** webhook extensions — `statuses` tracking + STOP opt-out.
- **Phase 4:** permissions + nav + the three UI pages.
- **Phase 5:** scheduled pickup appended to the daily reminders cron.

Each phase: small commits on `feature/broadcasts`, push, test on the preview URL, then next.

---

## 10. Compliance reminders to honor in code

- Exclude `marketing_opted_out` patients from every broadcast — enforce in the enqueue
  query, not just the UI.
- Keep marketing sends inside the existing `automated_sends_enabled` + test-mode controls.
- Throttle (the BATCH_SIZE + self-chain) to protect the number's quality rating.
- Log every send via `logWhatsAppMessage()` so staff see broadcasts in Conversations.
