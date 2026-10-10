-- =====================================================================
-- Broadcasts drain concurrency lock (additive)
-- Olu Eye Clinic EMR  ·  branch feature/broadcasts  ·  2026-10-10
--
-- Fixes a select/update race: concurrent drain invocations (e.g. the admin
-- clicking "Resume stalled send" repeatedly during an active drain) each SELECT
-- the same 'queued' recipients before any are marked, then each sends — so one
-- recipient gets the SAME WhatsApp message multiple times while its row shows a
-- single 'sent'.
--
-- Fix: a per-broadcast drain LEASE. A running invocation atomically claims
-- broadcasts.drain_locked_until (a timestamp in the near future); other
-- invocations bail while a live lease exists. The lease EXCEEDS the function's
-- maxDuration, so a dead invocation's lock expires on its own and the broadcast
-- becomes resumable rather than permanently stuck. Recipient rows are never put
-- in an intermediate 'sending' state, so there is nothing to un-stick per row.
--
-- Additive + idempotent: one nullable column, safe to run twice.
-- =====================================================================

alter table broadcasts
  add column if not exists drain_locked_until timestamptz;
