-- 20261121130000_visit_thankyou_sent_at.sql
-- Document the visit_records.thankyou_sent_at column in version control.
--
-- This column ALREADY EXISTS in the live database (it predates this migration,
-- but was never captured in a migration file and was previously unused). Phase 1
-- of the thank-you work now uses it as the once-only marker:
--   thankyou_sent_at IS NOT NULL  ⟺  the post-visit thank-you was sent for this
--   visit's CURRENT follow_up_date.
--
-- NO-OP ON PRODUCTION: `add column if not exists` does nothing where the column
-- is already present. It exists so a fresh environment reproduces the schema.
-- There is nothing to apply before merge.

alter table public.visit_records
  add column if not exists thankyou_sent_at timestamptz;
