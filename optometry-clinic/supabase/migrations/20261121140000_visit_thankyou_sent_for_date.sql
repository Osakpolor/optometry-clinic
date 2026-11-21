-- 20261121140000_visit_thankyou_sent_for_date.sql
-- Add visit_records.thankyou_sent_for_date — the appointment DATE a post-visit
-- thank-you was actually sent FOR.
--
-- WHY: the once-only guard must know *which* date was thanked, so that:
--   • re-saving the same date does not re-send (the date is already recorded),
--   • a genuinely new/changed future date DOES send (no row has it yet),
--   • a second same-day visit with the same date does not re-send.
-- Keying on this recorded date makes the dedup fully server-authoritative — it
-- never depends on a client-sent "did the date change?" flag (which compared a
-- stale originally-loaded value and caused repeat sends).
--
-- ADDITIVE & nullable, NO backfill: existing rows are NULL (never thanked under
-- this scheme). `thankyou_sent_at` is kept separately as the audit timestamp.
--
-- THIS ONE MUST BE APPLIED to Supabase before the feature deploys/merges — the
-- send action reads and writes this column.

alter table public.visit_records
  add column if not exists thankyou_sent_for_date date;
