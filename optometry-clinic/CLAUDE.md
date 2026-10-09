# CLAUDE.md — Olu Eye Clinic EMR

Persistent instructions for Claude Code. Read every session. Keep replies and
changes consistent with everything below without being reminded.

## What this is

A **live production** clinic-management web app for Olu Eye Clinic, a real
optometry practice in Benin City, Nigeria — in daily use by real staff and
~1,900+ patients. It is also being built toward a **multi-tenant EMR SaaS**.
Judge every decision twice: does it serve Olu today, AND does it survive
becoming a product for many clinics? When those conflict, say so — don't
silently pick one.

## Working style (the human is a beginner, learning by reading code)

- Give **complete file contents**, not diffs, for any new or substantially
  changed file. Only use a small diff for a tiny, clearly-scoped edit.
- Be **proactive**: flag consequences, tech debt and risk without being asked —
  especially anything harder to fix later (schema shape, tenancy, data types,
  security).
- Explain the "why" briefly; this is a learning project.

## Git — READ THIS, it is easy to get wrong

- **The repo root is the PARENT folder `C:\Users\Osakpolor Omoregie\Desktop\CLINIC Project`**,
  NOT `optometry-clinic`. Confirmed with `git rev-parse --show-toplevel`. There
  is no `.git` inside the app folder. The GitHub remote is *named*
  `optometry-clinic` but holds everything under `CLINIC Project`.
- **Never run `git add .` from `CLINIC Project`** (it would stage branding,
  tokens, other files). Staging from inside `optometry-clinic` is safe — it only
  stages from the current dir down. Prefer adding specific files by name.
- `.gitignore` patterns can't escape upward; rules for sibling folders belong in
  a `.gitignore` at `CLINIC Project\`.
- **Verify environment facts, don't infer them.** One command that prints the
  truth beats a confident guess.

## Branch discipline (non-negotiable — the app is live)

- **Never commit directly to `main`.** `main` auto-deploys to Vercel production,
  which the clinic is using right now.
- Start every feature on a branch: `git checkout -b feature/<name>`, commit in
  small steps, push, test on the **Vercel preview deployment**, then open a PR.
- Do not merge to main without the human's explicit go-ahead. Deploy off-peak.

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind + shadcn/ui, Supabase
(Postgres + Auth + RLS + Storage), Meta WhatsApp Cloud API, Claude API (the
WhatsApp AI "Iris"), Resend (email), Vercel (hosting; **Hobby plan — 1 cron/day**),
Python 3.14 for local migration/sync tooling (not part of the deployed app).

## Non-negotiables for a clinical product

- **Integrity** — patient data must never blend, drift or silently fail. Always
  verify a group is genuinely one person before merging on any shared key
  (a real blended-record incident happened via file_number).
- **Security** — RLS on every table; server-side role guards on every privileged
  route (not just hidden buttons); least privilege; never put the service-role
  key in client code; no credentials in the repo or its history.
- **Auditability** — destructive actions record who/what/when.
- **Privacy** — NDPR (Nigeria) is the baseline; design as if an auditor will read it.
- **Never break historical data** — prefer additive changes; when a key must
  change, read both old and new.
- **Keep all touchpoints in sync** — a field change touches the new form, the
  edit form, the read view and the Past Visits drawer. Ship them together.

## Key data model facts & gotchas

- Core tables: `patients`, `visit_records`, `staff_profiles`, `appointments`,
  `leads`, `rebook_requests`, `whatsapp_conversations`, `audit_log`.
- **`legacy_id` ≠ `file_number`** — two different numbering systems that only
  overlapped for the first ~196 patients. Never copy one into the other without
  checking for collisions. `file_number` is the clinic's real reference (admin-
  only edit, single source of truth).
- **PostgREST caps reads at 1000 rows** even with `.range()`. For large reads use
  the service-role admin client with a plain `.select().range()`, and/or page in
  chunks. Also raise Settings → API → Max Rows in Supabase.
- Some FKs needed `ON DELETE CASCADE` added manually (`appointments`,
  `audit_log` → `patients`). Fix as encountered.
- `visit_records` jsonb fields have TWO shapes: legacy `{"raw": "..."}` and new
  per-field keys. Any reader must handle both.
- Roles live in `staff_profiles.role` (admin/doctor/receptionist); helpers in
  `lib/auth/roles.ts` (`canManageVisits`, `canManageStaff`, etc.).
- **Schema is NOT yet in version control** (gap to close). When you write
  migration SQL, also save it as a `.sql` file in the repo so schema becomes
  reviewable and reproducible — don't leave changes dashboard-only.
- Clinical numbers are currently unit-suffixed strings in jsonb (`"18mmHg"`) —
  not queryable; a known debt, don't add more of it.

## WhatsApp / Meta specifics

- All sends go through `lib/whatsapp.ts` (env: `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_TOKEN`; Graph API v23.0). Reuse `formatNigerianPhone()`,
  `logWhatsAppMessage()`, and the template-send shape in
  `sendAppointmentReminderTemplate()`.
- **Messaging controls**: `getSettings()` / `isAllowedRecipient()` /
  `settings.automated_sends_enabled` gate automated sends and a test-mode
  allowlist. Any new automated send MUST respect them.
- **24-hour window**: outside 24h of a patient's last message you can only send
  approved **templates**, not free-form text.
- **Marketing cap (error 131049)**: a review link once flipped a template to
  Marketing and sends were silently dropped by the per-user marketing cap.
  Keep utility templates utility; treat 131049 as "capped", not a crash.
- Cron: `app/api/cron/appointment-reminders/route.ts` runs once daily (Hobby
  limit), auth via `Authorization: Bearer ${CRON_SECRET}`, uses the service-role
  client, and flips a boolean per appointment so each reminder fires once.
- Storage object keys reject some Unicode punctuation (smart quotes, dashes,
  backticks) even URL-encoded — sanitize filenames to ASCII before upload.

## Design conventions

- Geist font; brand teal `#0d7b5f`; dark `#171717`; light bg `#f9fafb`; 6px
  radius; shadow-as-border cards; 4px spacing scale; **sentence-case titles**;
  `max-w-5xl` containers at the dashboard layout level.
- Eyes compared: **OD = pink** (`border-pink-200 bg-pink-50`), **OS = green**
  (`border-green-200 bg-green-50`) everywhere.
- Section titles render through `text-transform: uppercase` — never put `µ` or
  lowercase Greek in a heading (it uppercases into a Latin-looking capital).
  Units belong in the input suffix, not the heading.

## Middleware gotcha

- The auth guard covers `/dashboard` only. **Do NOT add a rule redirecting
  authenticated users away from `/auth/set-password`** — it breaks the staff
  invite flow (happened once already).
