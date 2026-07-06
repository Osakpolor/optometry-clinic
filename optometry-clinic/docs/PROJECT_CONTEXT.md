# Olu Eye Clinic — Project Context

*Last updated: July 2026 (post pre-launch sync + file number integrity
fix, fully complete). Replaces the previous version.*

## What this is

A production clinic management web app for Olu Eye Clinic, a real
optometry practice in Benin City, Nigeria. **Live and in use by a real
business, not a tutorial project.** Full staff launch is this coming
Monday, and all pre-launch data prep is done.

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS, Supabase
(Postgres + Auth + RLS + Storage), shadcn/ui, Resend (transactional
email via SMTP), Vercel (hosting/deploy), Claude API (WhatsApp AI
layer), Meta WhatsApp Cloud API, Python 3.14 (migration/sync tooling,
run locally from Command Prompt, not part of the deployed app).

## Key locations

- Live app: `https://optometry-clinic-liard.vercel.app`
- GitHub: `github.com/Osakpolor/optometry-clinic`
- Supabase project: `https://sjasscoqswyjqgbbveow.supabase.co`
- Local path: `C:\Users\Osakpolor Omoregie\Desktop\CLINIC Project\optometry-clinic`
- Migration/sync scripts: run from `Desktop` via `python script.py`

## My skill level

Beginner, learning via Angela Yu's Udemy Full Stack course. Write
complete code — I learn by reading it. Always give full file contents
(not diffs) unless doing a small, clearly-scoped edit.

---

## Current scale

**~1,930+ active patients** in production. Every patient now has
exactly one valid, non-conflicting file_number (see "Recently
completed" below for the full data-integrity story).

---

## Folder structure (current)

```
optometry-clinic/
├── app/
│   ├── actions/
│   │   ├── staffActions.ts
│   │   └── deletePatient.ts
│   ├── auth/
│   │   ├── confirm/route.ts
│   │   ├── set-password/page.tsx
│   │   └── error/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── staff/page.tsx
│   │   └── patients/
│   │       ├── page.tsx            ← admin client bypasses PostgREST cap
│   │       ├── new/page.tsx
│   │       └── [id]/
│   │           ├── page.tsx        ← role-gated New visit / Delete buttons
│   │           ├── appointments/new/page.tsx
│   │           └── visits/
│   │               ├── new/page.tsx        ← server-side role guard confirmed
│   │               └── [visitId]/
│   │                   ├── page.tsx        ← role-gated Edit visit button
│   │                   └── edit/page.tsx   ← server-side role guard confirmed
│   ├── book/page.tsx
│   ├── login/page.tsx
│   ├── services/page.tsx
│   ├── api/send-confirmation/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── patients/
│   │   ├── EditPatientDialog.tsx
│   │   └── DeletePatientButton.tsx
│   ├── staff/
│   │   ├── InviteStaffForm.tsx
│   │   └── StaffList.tsx
│   ├── DashboardNav.tsx
│   ├── PatientDocuments.tsx
│   ├── PatientsTable.tsx
│   ├── AppointmentsTable.tsx
│   ├── DashboardRefresh.tsx
│   ├── EditVisitForm.tsx
│   ├── LeadsTable.tsx
│   ├── NewAppointmentForm.tsx
│   ├── NewVisitForm.tsx
│   ├── PatientNotes.tsx
│   ├── RegisterPatientForm.tsx
│   ├── SignOutButton.tsx
│   └── SiteNav.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── auth/
│       └── roles.ts                ← getUserRole(), canManageVisits(),
│                                       canManageFileNumber(), canDeletePatients(),
│                                       canManageStaff()
└── middleware.ts                   ← auth guard for /dashboard only.
                                        Do NOT redirect authenticated users
                                        away from /auth/set-password — broke
                                        staff invite flow once, already fixed.
```

---

## Database tables (current)

- **`patients`** — `id, full_name, phone, phone2, email, sex, date_of_birth,
  address, notes, legacy_id (int, historical Access DB reference only —
  NOT interchangeable with file_number, see gotchas), file_number (text,
  unique partial index, admin-only edit, single source of truth for the
  clinic's real reference number), deleted_at (soft delete), created_at`
- **`visit_records`** — `id, patient_id, doctor_id, visit_date,
  reason_for_visit, symptoms_presented, last_eye_exam, age_at_visit, bp,
  eye_test_results (jsonb), refraction (jsonb), anterior_segment (jsonb),
  posterior_segment (jsonb), medications (jsonb), diagnosis, referral,
  ref_test, ref_date, notes, follow_up_date, created_at, updated_at`
  — jsonb fields have TWO shapes: legacy raw text (`{"raw": "..."}`) vs
  new structured per-field keys (`sph_prx_od` etc). Visit detail page
  handles both.
- **`staff_profiles`** — `id, full_name, role (admin/doctor/receptionist),
  email, is_active, created_at`
- **`appointments`**, **`leads`**, **`audit_log`** — some FKs needed
  `ON DELETE CASCADE` added manually.

**Supabase functions:**
- `get_patients_sorted()` — numeric file_number sort, `LIMIT 5000` inside
- `next_file_number()` — highest existing numeric file_number + 1

---

## What's fully built and live

1. Bulk legacy data migration (original ~1,939 files)
2. File number system, admin-only edit/reassign, every patient now has
   exactly one valid non-conflicting number (see below)
3. Staff management — invite/role/deactivate, working end-to-end
4. Role-based access control — buttons hidden per role, AND
   server-side redirect guards on `/visits/new` and `/visits/[id]/edit`
   confirmed in place. Fully complete.
5. Soft delete, admin-only, typed-name confirmation
6. Legacy document viewer on patient profiles
7. Visit detail dual-format rendering
8. Mobile responsive nav + clinical data tables
9. WhatsApp AI, PDF prescription export, booking flow with calendar

---

## RECENTLY COMPLETED — Pre-launch data re-sync (fully done)

The clinic kept adding patients as Word docs since the original
migration. Full audit + sync pipeline built and run to completion:

1. **`sync_audit.py`** — found 297 new-patient files (235 unique),
   48 new docs, 17 updated docs, 14 name-mismatches, 57 no-file-number.
2. **`extract_new_patient_records.py` → `import_new_patients.py`** —
   imported new patients + visits, handling multi-file-per-patient
   correctly (multiple visits for one person over time).
3. **Critical bug found and fixed:** grouping files by file_number
   during import meant that if two DIFFERENT people's files shared one
   unclaimed number, BOTH people's clinical visit data ended up on one
   patient record. Caught via `verify_duplicate_conflicts.py`
   (22 of 25 flagged rows affected), fixed via:
   - `fix_blended_patients.py` — split 3 genuinely-blended records,
     moving misattributed visits by matching visit date + diagnosis.
   - `fix_name_mismatches.py` — handled the other 14 cases (mismatched
     document against an already-existing pre-sync patient). Fully
     parsed and created a proper new patient for the real owner.
   - 2 remaining cases (#170, #594) manually confirmed as same person.
   - One accidental empty duplicate patient removed via direct SQL.
4. **`upload_sync_documents.py`** + **`upload_unmatched_docs.py`** —
   uploaded all synced documents (0 errors on final runs). Fixed along
   the way: always upsert=true (some "new" files already existed in
   storage from months ago), sanitize smart quotes/dashes/backticks in
   filenames (Supabase Storage rejects some Unicode punctuation in
   object keys even URL-encoded), and exclude Word's own `~WRL*.tmp`
   temp/lock files, which aren't real documents.
5. **`fix_missing_file_numbers.py` → `resolve_file_number_collisions.py`**
   — **important discovery:** `legacy_id` (the old Access DB's internal
   row ID) is NOT the same numbering system as `file_number` (the
   clinic's real physical reference number), even though the first
   ~196 patients originally had them match. Over time, low numbers
   freed up during earlier duplicate-cleanup work got reassigned to
   brand-new patients, while the *original* legacy-DB patient holding
   that same `legacy_id` had never had `file_number` populated at all.
   This surfaced as 55 collisions out of 81 patients missing a
   file_number. Resolution: every genuinely conflicting legacy-DB
   patient was given a fresh new file_number (`legacy_id` kept purely
   as historical reference, no longer used as their live number). 7
   patients backfilled cleanly from `legacy_id` with no conflict, 18
   with no `legacy_id` at all got a fresh number outright. **Every
   patient now has exactly one valid file_number — this data
   integrity work is fully closed out.**
6. **Dashboard patient count fixed** — was showing all rows including
   soft-deleted duplicates (1958) instead of matching the patient list
   (1865). Root cause: the count query had no `deleted_at IS NULL`
   filter. Fixed in `app/dashboard/page.tsx`.
7. **Search restricted to name + file number only** — phone number
   removed from the search filter in `PatientsTable.tsx` per clinic
   preference (phone still displays in the table, just isn't matched
   by the search box).

---

## NEXT UP

1. Review `unmatched_docs_review.csv` remnants (a handful of rows with
   no matched_file_number were skipped) — whenever convenient, not
   launch-blocking.
2. ~120 gaps in the file_number sequence confirmed as inherited from
   the clinic's original paper filing system (pre-existing gaps, not
   a bug) — no action needed, this was investigated and closed out.
3. Consider trimming this doc for Claude Project knowledge size limits
   as it keeps growing.

**All launch-blocking work is now complete.**

---

## Known gotchas worth remembering

- **`legacy_id` and `file_number` are NOT interchangeable** — they're
  two different numbering systems that happened to overlap for the
  first ~196 patients. Never assume copying one into the other is
  safe without checking for collisions first.
- PostgREST caps at 1000 rows even with `.range()` — must also raise
  Settings → API → Max Rows in Supabase Dashboard. For truly large
  reads, using the service-role admin client with a plain
  `.select().range()` query (not RPC) has been the most reliable fix.
- Missing `ON DELETE CASCADE` on some foreign keys (`appointments`,
  `audit_log` → `patients`) — fix as encountered.
- Word docx merged table cells repeat text once per spanned grid
  column when read via python-docx — must de-duplicate consecutive
  repeats.
- Regex label-matching must anchor to start of line, never search
  mid-line, or "RX" matches inside "FINAL SUBJECTIVE RX".
- PDFs are never auto-parsed for clinical data — always attach as
  document only.
- Don't add a middleware rule redirecting authenticated users away
  from `/auth/set-password` — breaks the staff invite flow.
- When grouping records by a shared key (like file_number) before
  bulk-importing, always verify the group is genuinely one person
  before merging their data — two different people sharing an
  unclaimed number will silently blend bio AND clinical visit data
  onto one patient record if not checked first.
- Supabase Storage rejects some Unicode punctuation (smart quotes,
  dashes, backticks) in object keys even when URL-encoded — sanitize
  filenames to plain ASCII equivalents before uploading. Also exclude
  Word's own `~WRL*.tmp` temp/lock files — not real documents.
- SSL errors (`INVALID_SESSION_ID`, `BAD_RECORD_MAC` etc.) during bulk
  Python scripts are transient network hiccups — safe to just re-run,
  as long as the script is idempotent (checks for existing
  records/uses upsert) rather than blindly re-creating things.

## Design conventions

Geist font, brand teal `#0d7b5f`, dark `#171717`, light bg `#f9fafb`,
6px border radius, shadow-as-border cards, 4px spacing scale,
sentence-case titles, `max-w-5xl` enforced at the dashboard layout
level only.
