# Database — schema, migrations and recovery

_Olu Eye Clinic EMR. Written 12 Sep 2026._

The database schema is the most valuable thing in this project and, until now,
the only copy of it lived inside the Supabase dashboard. This document exists to
change that: from here on, **every schema change is a file in this repo.**

---

## Why this matters

Without migrations in version control you cannot:

- stand up a staging database to test a change before it hits live patients;
- review a schema change before it lands, or roll one back after;
- rebuild the database if the Supabase project is ever lost;
- perform the Phase 3 multi-tenant migration (`clinic_id` on every table plus
  rewritten RLS policies) with any safety at all.

A live clinical system with ~1,900 patients should not have an unreproducible
schema.

---

## Repo layout note

The git repository root is the **parent** folder:

```
CLINIC Project\            <- .git lives here
├── optometry-clinic\      <- the Next.js app; supabase/ goes in here
├── website-olu-eye-clinic\
├── other files & tokens\  <- MUST be git-ignored (root .gitignore)
└── ...
```

Because of this, a `.gitignore` inside `optometry-clinic` cannot exclude
anything outside it. Ignore rules for sibling folders belong in a `.gitignore`
at `CLINIC Project\`.

---

## One-time setup

Run from the app folder, in CMD:

```
cd /d "C:\Users\Osakpolor Omoregie\Desktop\CLINIC Project\optometry-clinic"

npx supabase init
npx supabase login
npx supabase link --project-ref sjasscoqswyjqgbbveow
```

`link` prompts for the **database password** (Supabase dashboard → Settings →
Database → Database password). This is not the anon key or the service-role key.
If you no longer have it, reset it there — resetting the DB password does not
affect the API keys the app uses.

Then capture the live schema as the baseline:

```
npx supabase db pull
```

This writes `supabase/migrations/<timestamp>_remote_schema.sql` containing every
table, column, index, constraint, function and RLS policy currently live. Open
it and read it — this is the first complete picture of the database in one place.

Commit it:

```
cd /d "C:\Users\Osakpolor Omoregie\Desktop\CLINIC Project"
git add optometry-clinic/supabase
git commit -m "chore(db): capture live schema as baseline migration"
git push
```

---

## Making a schema change from now on

Never edit tables by hand in the dashboard again. Instead:

```
cd /d "C:\Users\Osakpolor Omoregie\Desktop\CLINIC Project\optometry-clinic"
npx supabase migration new short_description_here
```

Write the SQL into the generated file in `supabase/migrations/`, then apply it:

```
npx supabase db push
```

Rules:

- **One migration per logical change**, with a descriptive name.
- **Additive first.** Add columns and backfill before dropping anything. Never
  drop a column in the same migration that stops writing to it.
- **Every new table needs RLS enabled and a policy in the same migration.** A
  table without a policy fails silently — it returns zero rows and looks like a
  bug, not a security error.
- **Deploy off-peak.** Doctors are using this during clinic hours.
- If you ever do change something in the dashboard by accident, run
  `npx supabase db pull` immediately to capture it before the drift compounds.

---

## Notes on this schema

### jsonb columns

`visit_records` stores clinical detail in `jsonb`: `eye_test_results`,
`refraction`, `anterior_segment`, `posterior_segment`, `medications`. Because
jsonb is schemaless, **adding a new clinical field needs no migration** — the app
just writes a new key. This is why the Sept 2026 tonometry/pachymetry/A-scan work
required no DDL.

The trade-off is that nothing validates those keys and a typo writes silently.
Validation at the save boundary is an open task.

These columns have **two historical shapes**:

- legacy: `{"raw": "...free text..."}` from the Word-document migration
- current: structured per-field keys (`sph_prx_od`, `iop_od`, …)

Any code reading them must handle both. The visit detail page does this via
`isLegacyEyeTest` / `isLegacyRefraction` / `isLegacyAnterior`.

### Clinical values are stored as unit-suffixed strings

`iop_od: "18mmHg"`, `pachy_od: "540µm"`, `ascan_od: "23.5mm"`. This is consistent
across the app but means the values are **not queryable, sortable or trendable**,
which blocks IOP and axial-length progression tracking.

Planned fix (non-breaking, no app changes): Postgres generated columns extracting
numerics out of the jsonb, e.g.

```sql
alter table visit_records
  add column iop_od_mmhg numeric
  generated always as (
    nullif(regexp_replace(eye_test_results->>'iop_od', '[^0-9.]', '', 'g'), '')::numeric
  ) stored;
```

Then index and chart them normally.

### Key gotchas

- `legacy_id` (old Access DB row ID) and `file_number` (the clinic's real
  physical reference) are **different numbering systems** that happened to
  overlap for the first ~196 patients. Never copy one into the other.
- PostgREST caps reads at 1000 rows. Raise Max Rows in the dashboard and use the
  service-role admin client for large reads.
- Some foreign keys needed `ON DELETE CASCADE` added manually — check when
  adding new ones.

---

## Backups and recovery

**Verify, then test.** In the Supabase dashboard, Settings → Database → Backups,
confirm the retention window and whether point-in-time recovery is available on
the current plan.

Whatever it says, add an export the clinic controls independently of the vendor:

```
npx supabase db dump --data-only -f backup-data.sql
npx supabase db dump -f backup-schema.sql
```

Store these off-machine (not in the git repo — they contain patient data).

**A backup that has never been restored is not a backup.** Restore one into a
throwaway Supabase project at least once, confirm the patient count matches, and
write down how long it took. That number is your recovery time objective, and
right now nobody knows what it is.

---

## Open database tasks

1. Capture the baseline migration (this document's setup section).
2. Generated columns for IOP, pachymetry and axial length.
3. Zod validation on jsonb writes.
4. Verify backups; add independent scheduled export; run one restore test.
5. Add `clinic_id` + per-tenant RLS while the data is still small.
