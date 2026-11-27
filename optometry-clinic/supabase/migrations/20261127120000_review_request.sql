-- =====================================================================
-- One-time (configurable) Google review request in the thank-you
-- Olu Eye Clinic EMR  ·  branch feature/review-request  ·  2026-11-27
--
-- WHAT THIS ADDS
--   1. patients.review_request_sent_at   — "last asked" marker. Stamped
--      whenever the review template (v5) is ACCEPTED by Meta, in every mode.
--      Drives the "Once per patient" and "Every N days" modes.
--   2. message_log.visit_id              — lets the webhook rebuild a utility
--      (v4) thank-you if the review template (v5, MARKETING) is capped (131049)
--      after Meta accepted it, so the patient still gets their next-appointment
--      message. We read the appointment date back from the visit.
--   3. clinics.wa_waba_id                — record the confirmed WhatsApp
--      Business Account id (was NULL). Used by tooling that lists templates.
--   4. BACKFILL                          — pre-stamp patients who ALREADY got a
--      review link (thank-you OR visit summary) BEFORE 2026-10-10, so the
--      "once"/"interval" modes don't ask them again. The window ~Oct 10–Nov 26
--      was billing-restricted (almost nothing delivered), so sends in it are
--      deliberately EXCLUDED — those patients never saw the link.
--
--   The admin setting itself ("always"/"once"/"interval" + N days) needs NO
--   DDL: it lives in the existing app_settings key/value table as the keys
--   review_link_mode and review_link_interval_days, read by getSettings().
--
-- NON-NEGOTIABLES: additive only, fully idempotent (safe to run twice),
-- nothing dropped or rewritten. ONE shared Supabase project (preview +
-- production), so this is run ONCE, before the code that depends on it merges.
-- =====================================================================


-- 1. "last asked" marker ------------------------------------------------
alter table patients
  add column if not exists review_request_sent_at timestamptz;


-- 2. tie a thank-you send to its visit, so the 131049 webhook fallback can
--    rebuild the utility thank-you (needs the appointment date from the visit).
alter table message_log
  add column if not exists visit_id uuid references visit_records(id) on delete set null;


-- 3. record the confirmed WABA id (only if not already set) --------------
update clinics
  set wa_waba_id = '2146677612729368'
  where wa_waba_id is null;


-- 4. BACKFILL — stamp each already-asked patient with their REAL last-asked
--    date (max over their qualifying messages), so "every N days" measures
--    from when they were actually last asked.
--
--    OUTGOING messages only (role <> 'user' — i.e. 'system'/'assistant'); a
--    patient-typed line that happens to contain "review" must not count.
--    BEFORE the 2026-10-10 billing-restriction cutoff only.
--    Matches a patient to a conversation by the bare last-10 digits of the
--    phone (handles 234…, 0…, +234…, bare-10 forms), the same canonical key
--    the app matches on. NOTE: a few patients share a household phone, so this
--    can stamp slightly more patients than there are distinct phones — intended.
update patients p
  set review_request_sent_at = sub.last_asked
  from (
    select
      right(regexp_replace(c.phone_number, '\D', '', 'g'), 10) as p10,
      max(c.created_at)                                        as last_asked
    from whatsapp_conversations c
    where c.role <> 'user'
      and c.created_at < '2026-10-10T00:00:00Z'
      and (
        c.message ilike '%Review: http%'
        or c.message ilike '%leave us a review%'
        or c.message ilike '%olueyeclinic.com/review%'
      )
    group by 1
  ) sub
  where right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = sub.p10
    and length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 10
    and p.review_request_sent_at is null;

-- =====================================================================
-- End of review-request migration.
-- =====================================================================
